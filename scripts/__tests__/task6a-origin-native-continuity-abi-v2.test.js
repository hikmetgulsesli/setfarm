import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

// Syntax-only ordinary SDK characterization; no link/load/Mach/runtime proof.
const flag = process.env.SETFARM_TASK6A_NATIVE_CONTINUITY_ABI_TEST;
assert.ok(flag === undefined || flag === '1', 'closed continuity ABI opt-in');
const enabled = flag === '1';
const sourcePath = fileURLToPath(new URL('../task6a-origin-native-continuity-abi-v2.c', import.meta.url));
const selfPath = fileURLToPath(import.meta.url);
const CLT = '/Library/Developer/CommandLineTools';
const CLANG = CLT + '/usr/bin/clang';
const SDK = CLT + '/SDKs/MacOSX26.5.sdk';
const RESOURCE = CLT + '/usr/lib/clang/21';
const ROOTS = {R:RESOURCE+'/include', S:SDK+'/usr/include'};
const NODE = '/opt/homebrew/Cellar/node/26.4.0/bin/node';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

// Independently nominated literal-include superset, INCLUDING inactive headers.
// This is NOT an observed compiler-used set or immutable compiler/Node TCB.
// label | original inode | bytes | octal permissions | original SHA256
const HEADER_ROWS = `
S/mach/message.h|14866476|37637|444|86e9e87ba2a736236613f2c0a8563dbacaeec1a761654b12812eaf8599b55e67
R/stddef.h|14827653|5178|644|e8d92dad1b380f2f2130fd7aa446bcb4fc923f7062a41c7c35beb4913093a8f5
R/stdint.h|14827654|27519|644|f43783466c93f77a6464274ebf18f9e4cc46f0d90770ddee2993c6cf39f7514f
S/machine/limits.h|14866560|511|444|50345f1ab843fca787a38c552a84177e678d79dab86e714434f94f2546839357
S/machine/types.h|14866564|1675|444|76e7c59451d996fe674a6fc7e518366609a95875c9b9aec9fd590a3ac138dddd
S/mach/port.h|14866486|27974|444|e4d48a100252a8d07ef5221e4cac1ea727fb975271a8382e0a6faf121c5c8a56
S/mach/boolean.h|14866378|2823|444|c050da6ed29d186ac403c0ba187031aca3ac32da2b4e618e0d0c8ba1b7665523
S/mach/kern_return.h|14866423|10102|444|2d4b89f7cf91cf7bffafe457cdba8884c3f2e5596a9ef7d5e4a9ea4b239558d8
S/mach/machine/vm_types.h|14866471|1638|444|1c2a4ff4b5843ded602775a447494f353a295015ca8d913a0a13439f4ee28654
S/sys/cdefs.h|14867260|42609|444|ac1a889ee7e6f3025e01be9981d26751489b9e63e926035201cae07ab9e6576f
S/sys/appleapiopts.h|14867255|2065|444|efd9793f56c08917cf1ddf5108b78240ede88a5bbc8977d6fdaf1684b6b01c1c
S/Availability.h|14863527|28849|644|d39d74d343b5f3dc147525c5f4ba99c1ae9133bccc57eb6205a74d0ba99d92cb
R/ptrauth.h|14827604|28660|644|ba686a77ba190020249601f2c40ce45aba88f78322a95c6b756bde86e6f6ba1c
R/__stddef_header_macro.h|14827349|417|644|4cf46e8fbb809df048eecbbd63686fa741da27afa8db4245bd1f61c1fb1611dc
S/stddef.h|14867139|3816|444|1e871643e931a1fe9ba76c2cc55dd32aa1a4b4cdf4584901b65b6203db321d2b
R/__stddef_ptrdiff_t.h|14827354|717|644|b4178a57f3711b7013cba747a72a2f178c29fa9364e77d75b2159754072ced43
R/__stddef_size_t.h|14827356|708|644|d86ddc0238da09b385846ebef814ffc50a44e40cf85d4e3793f485952b7e73ad
R/__stddef_rsize_t.h|14827355|710|644|132339d4f07e852bf2d879bc91c4ccdfcf08c581c7c97f6f3794510e0bdda7bd
R/__stddef_wchar_t.h|14827358|853|644|1900d4998aef3698b06399ed686db0c21e26509b08638a25734fb97ae89b1001
R/__stddef_null.h|14827351|875|644|b1d71b08563ab3d2c22a1e4f8ddf4d9a1111c89e9404b859a45c307e8ebc6c69
R/__stddef_nullptr_t.h|14827352|958|644|898b4465c5d3040d27e760e82983a751b1b0cae23ba280b18a1b81451841f9eb
R/__stddef_unreachable.h|14827357|735|644|bba07c327f8168f37b266a19aed625e0fa633a25cabef4f54f21faf3df5522b8
R/__stddef_max_align_t.h|14827350|857|644|3c1e4de47f4f06b35e2c5890d670052e84f716760505ff51b022fc8b21a9400f
R/__stddef_offsetof.h|14827353|708|644|e5f0f4ff8ff5fc6a1cc8b535f5065f1728eadd2bf1e1401f021f803ec7b4222f
R/__stddef_wint_t.h|14827359|443|644|f2ededa38c5454397242aceaefa65b42b292a1b3cc258e7ca6e216f146e51f0d
S/stdint.h|14867140|5556|444|9d070aad02d9f2ba1f2248d093b4194b62cf8d363778c737d1110f4736e5ed3c
S/i386/limits.h|14866160|5641|444|5f217d3264db40123bd92898ba7d1874c301b7b183d6c3b8c2d84e71bc82f89c
S/arm/limits.h|14864021|5699|444|59fea4e9435607efb7bef02a226e05202b236e8434518bb130fc9aa0932ebdb8
S/i386/types.h|14866164|4921|444|de798ccef8429cb17164d1d2e4e9486c92a89a3321ceedb339a6255afa10543a
S/arm/types.h|14864025|4135|444|b9eccd5a3feb3a62e22e42936656c8822e7e3e8708d759b1512deee05f682f0d
S/sys/_types.h|14867170|4133|444|863c4f07045775002b63b7e616742d9f746e4a02da4441442d8fe1138bbd0ff9
S/sys/_types/_mach_port_t.h|14867205|2098|444|8f178c4c396766f74c2cf8240af9ca420aef38b67bd0d6b7b1ec84c2c48dfc91
S/mach/machine/boolean.h|14866459|1633|444|a22e0c8c541b9117a86d85ab4a977eda49917a9867b24576f5972b6fa6554f23
S/mach/machine/kern_return.h|14866461|1653|444|160d3b4460244b7f469a34f3030071bd717d2918cb748527c1207ca78310d51d
S/mach/i386/vm_types.h|14866422|5449|444|fd08a1f8d73c50d02b568a85ec995937ffc0c1426c8b464d94b79c1ecfce2565
S/mach/arm/vm_types.h|14866373|5836|444|4256065e3413a8a506492ff4e4c46596076a56e44db7c850efbc832c8b12fbb1
S/sys/_symbol_aliasing.h|14867167|43017|444|4f4d5078589b64b735007e08840b4c4c487219ff543d2022c69f5e9ec25c3b9a
S/sys/_posix_availability.h|14867152|2905|444|452bff9ae32655a49b65802e29b21c67a546be1446553f908ef9850a694746bd
R/ptrcheck.h|14827606|16074|644|ac60d1e96ac17d789d1879b968d391dfbfa222f12213ba95f14592453eebe338
S/AvailabilityVersions.h|14863535|32391|644|6dbadbee42ea5232d72416dd7f2d3e7c5de5b2015a395375aa06d7b966328738
S/AvailabilityInternal.h|14863529|68399|644|8161a109696d0e1111daa2f04b71e385d2510d2e83c47b8ce4d0a20b809085d0
S/AvailabilityInternalLegacy.h|14863531|414416|644|4c15ffce0467946a20beaa2eb25eba2cbe1788c620aaeb2516c39436a88fe276
S/_types.h|14863754|2285|444|532c4b0f11274f6b10875db65e154e6cedaa20fdd189f5f40a8780c9a4c39449
S/sys/_types/_null.h|14867210|1724|444|3e021525d2a711070e9c78ea2791e020ef6105c51121d8496d617f89a83d2f92
S/sys/_types/_offsetof.h|14867214|1733|444|5c8098a8d25e17a963e3cb4b75b8be0136812c45f7e303d2f783ee1dc24d5218
S/sys/_types/_ptrdiff_t.h|14867218|1793|444|0b544d00a01bd306ca6d2f44c13422a140e37ed2498f88ea0602ccc520d6e55a
S/sys/_types/_rsize_t.h|14867219|1782|444|ac4928fae2b5d9d3728c1365c8e6552652cc22680158655151ddaf6a49ce795d
S/sys/_types/_size_t.h|14867226|1775|444|3e1bcf6c23ad00e0fe2b5a4683e687299baf51cf26b0a4ebc73db6140378acc2
S/sys/_types/_wchar_t.h|14867250|1857|444|f0c3da0beecb5feb19ddede0ea9d5fbb9274e7b1de1b7cb91f64196ac1395008
S/sys/_types/_wint_t.h|14867251|1456|444|f6bb1d228df3635d191ee34fdd786fad6851f679ed9da7d6c48e12d3f437854e
S/sys/_types/_int8_t.h|14867201|1411|444|607f6beede0251eb801e763493df26fd45d46eb951e4ff9cac17f1ac951b8cc0
S/sys/_types/_int16_t.h|14867198|1417|444|e40d40ad59c6dc98577b2c7cfdba1121ebfee17b29e093cbd10b7936df496d8e
S/sys/_types/_int32_t.h|14867199|1417|444|77127195e57f1690402377ddd72e3dcda684ddf591346f08ef4772dddcbbc281
S/sys/_types/_int64_t.h|14867200|1417|444|a2427b34e5e83996bd28d83cec920cf3b82a366af90e767234557bd11fa33a18
S/_types/_uint8_t.h|14863761|1412|444|0a5c0353c8410f5e502db7971d987ac83a9ec3148905f10984c78152f541de68
S/_types/_uint16_t.h|14863758|1417|444|adf29323b0ecb87cbc43ac3ff25c096de7a214ceb90007c2828616151c66ad37
S/_types/_uint32_t.h|14863759|1415|444|951131475ec815813c8ff40d5e875029cd968334fd3a42d5a65fbe7851d1718c
S/_types/_uint64_t.h|14863760|1421|444|a5692cddb9c42d1b55ebcd6fa445b212c4b0c46db4583aaf3293ed6386d3d0d6
S/sys/_types/_intptr_t.h|14867202|1479|444|b2a7ba9b9b2d357d75e59114874658f893b23ea6d1357815b027d8189075daba
S/sys/_types/_uintptr_t.h|14867245|1534|444|f435cf25e4f06dace9c1884c066392bafd204c6d71f16696e71acde5912bc81f
S/_types/_intmax_t.h|14863755|1579|444|215f90a4efdca4991735be55a1ff701964dde07d8b4a8382ec8ed41ecbf5f115
S/_types/_uintmax_t.h|14863762|1606|444|0b154b16a3945edff78f00321d90a662d522e197c08e7de3b68f0ea44ae0d042
S/i386/_limits.h|14866153|1190|444|cf2c6461281daf4ac20b06459e7b70bc405fec5ce95b9c748475a1f87c302de4
S/arm/_limits.h|14864013|318|444|b64325f6b5aba08a361b7b8e537df3d8d193538c1d6329a4c4a7e72f5aa63478
S/i386/_types.h|14866156|5746|444|570ce4f21d5fb0657a6f8ef02460561b7b0b845f49f7f096412eda28eead085e
S/sys/_types/_u_int8_t.h|14867240|1421|444|7505dbbdf3ecca2b8e585871ad81c0e67a3cb63c97c47abe73fe262e071a3ebb
S/sys/_types/_u_int16_t.h|14867237|1433|444|9dabbd8280c28416a5ba115355678d2540588df1a7251bd9b4a13e30c309a71b
S/sys/_types/_u_int32_t.h|14867238|1425|444|196cba7a865c086bba457758d3b2605a4c1299c54a758366b7d420a585895f1d
S/sys/_types/_u_int64_t.h|14867239|1425|444|d096eee54a5acc2c3cd5cf71256d69198ada8f8d82cdb0a717bc8ed65650ad93
S/arm/_types.h|14864016|4470|444|4f0bde85f9a41cc7d30fff22ebd7e8f4eb206a55a926eda012a2e7481e3524fa
S/machine/_types.h|14866556|1614|444|f27264f8fdec9f164b4fc2b556f666ed7c5c0e5b88fd9f23db0b731ffa6cf864
S/sys/_pthread/_pthread_types.h|14867164|3855|644|741433612525badf767d48b1924d4c7ba564ccc5c1bab5cb7045c238850fa86b
S/mach/i386/boolean.h|14866411|2787|444|ee266280e9982d6efa1decf132c079769e17f66b9ea1908b838c78a8bbbebebb
S/mach/arm/boolean.h|14866361|2677|444|03ceda8c88250b93a3bebca92e03dd558e13fe68e83eff6bba5db32f95b48b6d
S/mach/i386/kern_return.h|14866414|2840|444|3c806753bb3af781d46d45fef3321928691e2e1b4ec86c4d89d163c3f399ad17
S/mach/arm/kern_return.h|14866363|2828|444|c06cb329babef0663cd8c86b5e5f545fafc8d8659bb83cef75506281187ef9f1
S/_bounds.h|14863655|2276|444|3d9f049f5fac54421170fa34a845b244dce7b83a3c68ddd589909df759854700
S/sys/_types/_va_list.h|14867248|1714|444|688c84ca73e82898609ae7282c820e896e4b82b7dc14f4fc92b4263df5827de2
R/stdarg.h|14827648|2497|644|ce6e43d79dc89b50208ecf259b1ffd519f5a78cd3a2c7fcaac6386f376b89fef
R/__stdarg_header_macro.h|14827345|417|644|7b3fbcc442af2508f36bb2dc98d9ad2b8a1f5c0f5333394fb2159c8bd5ecd5b8
R/__stdarg___gnuc_va_list.h|14827343|467|644|feca975bfdfb254d17458a8e3d51f8ad6d9bdc9fd6287727f0f8b2fb81fcb0b0
R/__stdarg_va_list.h|14827348|448|644|81c3055f7033e26e7f53705653bc9d69b5202f25c2692e03b3a4f77ff44a7d76
R/__stdarg_va_arg.h|14827346|771|644|274c75a1db86f649439aa3bcc1dead4170725e6f803925c3fc38a2e93307afdc
R/__stdarg___va_copy.h|14827344|445|644|f0a8d3c963338173f2d57b2cbc209dde38c90536107b15eb0cf78166d4caee1f
R/__stdarg_va_copy.h|14827347|451|644|bb195f56cb08d4cee6a60bd9f62f34466e8ac4f89f6fed043b044cb2f7ead010
`.trim();
const ABSENT = [
  ROOTS.R+'/AvailabilityInternalPrivate.h', ROOTS.S+'/AvailabilityInternalPrivate.h',
  ROOTS.R+'/AvailabilityProhibitedInternal.h', ROOTS.S+'/AvailabilityProhibitedInternal.h',
  ROOTS.R+'/__xnu_libcxx_sentinel.h', ROOTS.S+'/__xnu_libcxx_sentinel.h',
  ROOTS.S+'/stdarg.h',
];

// Independent literal consumer, not assertions supplied by the candidate.
const ORACLE = String.raw`
#if defined(KERNEL) || defined(__MVS__) || !defined(__APPLE__) || !defined(__aarch64__)
#error SFCNT_UNSUPPORTED_USER_TARGET
#endif
_Static_assert(sizeof(mach_msg_header_t)==24,"SFCNT_HEADER_SIZE_24");
_Static_assert(offsetof(mach_msg_header_t,msgh_bits)==0,"SFCNT_BITS_OFFSET_0");
_Static_assert(offsetof(mach_msg_header_t,msgh_size)==4,"SFCNT_SIZE_OFFSET_4");
_Static_assert(offsetof(mach_msg_header_t,msgh_remote_port)==8,"SFCNT_REMOTE_OFFSET_8");
_Static_assert(offsetof(mach_msg_header_t,msgh_local_port)==12,"SFCNT_LOCAL_OFFSET_12");
_Static_assert(offsetof(mach_msg_header_t,msgh_voucher_port)==16,"SFCNT_VOUCHER_OFFSET_16");
_Static_assert(offsetof(mach_msg_header_t,msgh_id)==20,"SFCNT_ID_OFFSET_20");
_Static_assert(sizeof(((sf_continuity_message_v2 *)0)->payload)==32,"SFCNT_PAYLOAD_SIZE_32");
_Static_assert(offsetof(sf_continuity_message_v2,payload)==24,"SFCNT_PAYLOAD_OFFSET_24");
_Static_assert(sizeof(sf_continuity_message_v2)==56,"SFCNT_MESSAGE_SIZE_56");
_Static_assert(sizeof(sf_continuity_frame_v2)==32,"SFCNT_FRAME_SIZE_32");
_Static_assert(sizeof(mach_msg_audit_trailer_t)==52,"SFCNT_AUDIT_SIZE_52");
_Static_assert(offsetof(mach_msg_audit_trailer_t,msgh_audit)==20,"SFCNT_AUDIT_OFFSET_20");
_Static_assert(sizeof(natural_t)==4,"SFCNT_NATURAL_SIZE_4");
_Static_assert(round_msg(sizeof(sf_continuity_message_v2))+
               sizeof(mach_msg_audit_trailer_t)==108,"SFCNT_CAPACITY_108");
`;

const MATERIAL = ['dev','ino','uid','gid','mode','nlink','size','mtimeNs','ctimeNs'];
function same(a,b) { return MATERIAL.every(key=>a[key]===b[key]); }
function digest(fd,size) {
  const hash=createHash('sha256'), buffer=Buffer.alloc(1_048_576); let offset=0;
  while(offset<size) {
    const n=fs.readSync(fd,buffer,0,Math.min(buffer.length,size-offset),offset);
    assert.ok(n>0,'held input ended early'); hash.update(buffer.subarray(0,n)); offset+=n;
  }
  return hash.digest('hex');
}
function hold(filename,{uid,sha,inode,size,mode,limit=1_048_576}={}) {
  const fd=fs.openSync(filename,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW|fs.constants.O_NONBLOCK);
  try {
    const stat=fs.fstatSync(fd,{bigint:true});
    assert.ok(stat.isFile()); assert.equal(stat.nlink,1n); assert.equal(stat.uid,BigInt(uid));
    assert.equal(stat.mode&0o022n,0n); assert.equal(fs.realpathSync(filename),filename);
    assert.ok(stat.size>=0n && stat.size<=BigInt(limit));
    if(inode!==undefined) assert.equal(stat.ino,BigInt(inode));
    if(size!==undefined) assert.equal(stat.size,BigInt(size));
    if(mode!==undefined) assert.equal(stat.mode&0o777n,BigInt(mode));
    let lastAtimeNs=stat.atimeNs;
    const originalHash=digest(fd,Number(stat.size));
    if(sha!==undefined) assert.equal(originalHash,sha,'nominated input: '+filename);
    const check=()=>{
      assert.ok(same(stat,fs.fstatSync(fd,{bigint:true})));
      assert.ok(same(stat,fs.lstatSync(filename,{bigint:true})));
      assert.equal(digest(fd,Number(stat.size)),originalHash);
      const after=fs.fstatSync(fd,{bigint:true});
      assert.ok(same(stat,after));lastAtimeNs=after.atimeNs;
      assert.ok(same(stat,fs.lstatSync(filename,{bigint:true})));
    };
    check();
    return {filename,fd,stat,sha:originalHash,check,
      get atimeAfterNs(){return lastAtimeNs;},read(){
      check(); assert.ok(stat.size<=1_048_576n); const bytes=Buffer.alloc(Number(stat.size));let offset=0;
      while(offset<bytes.length){const n=fs.readSync(fd,bytes,offset,bytes.length-offset,offset);assert.ok(n>0);offset+=n;}
      check();assert.equal(sha256(bytes),originalHash);return bytes;
    },close(){fs.closeSync(fd);}};
  } catch(error) {
    try{fs.closeSync(fd);}catch(cleanup){throw new AggregateError([error,cleanup]);}throw error;
  }
}
function directoryGuard(filename,checks,fixture=false) {
  const before=fs.lstatSync(filename,{bigint:true}); assert.ok(before.isDirectory());
  if(fixture){assert.equal(before.uid,501n);assert.equal(before.mode&0o777n,0o700n);}
  const check=()=>{const actual=fs.lstatSync(filename,{bigint:true});assert.ok(actual.isDirectory());
    for(const key of ['dev','ino','uid','gid','mode'])assert.equal(actual[key],before[key]);};
  checks.push(check);check();return before;
}
function checkAbsent(filename) {
  let observed=false;
  try{fs.lstatSync(filename);}catch(error){if(error.code!=='ENOENT')throw error;observed=true;}
  assert.equal(observed,true,'nominated optional-header absence: '+filename);
}
function settled(args,cwd) {
  return new Promise((resolve,reject)=>{
    const child=spawn(CLANG,args,{cwd,shell:false,stdio:['ignore','pipe','pipe'],
      env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C',TMPDIR:cwd}});
    const chunks=[[],[]],errors=[],eof=[false,false];let exit=null,total=0,overflow=false;
    child.on('error',error=>errors.push(error));
    child.on('exit',(code,signal)=>{exit={code,signal};});
    child.on('close',(code,signal)=>{
      let result;
      try{assert.deepEqual(exit,{code,signal});assert.equal(signal,null);assert.deepEqual(eof,[true,true]);
        assert.equal(overflow,false);result={code,signal,eof:[...eof],
          stdout:Buffer.concat(chunks[0]).toString(),stderr:Buffer.concat(chunks[1]).toString()};
      }catch(error){errors.push(error);}
      if(errors.length)reject(new AggregateError(errors,'owned compiler failed after original close'));
      else resolve(result);
    });
    for(const [i,stream]of[child.stdout,child.stderr].entries()){
      if(!stream){errors.push(new Error('missing compiler stream'));continue;}
      try{stream.on('error',error=>errors.push(error));stream.on('end',()=>{eof[i]=true;});
        stream.on('data',bytes=>{try{total+=bytes.length;if(total<=1_048_576)chunks[i].push(bytes);else overflow=true;}
          catch(error){errors.push(error);}});
      }catch(error){errors.push(error);}
    }
  });
}
async function invokeSyntax(mode) {
  assert.ok(mode==='baseline'||mode==='payload31');
  const held=[],checks=[],failures=[];let result,closed=0;
  try {
    let source;
    try{source=hold(sourcePath,{uid:501});held.push(source);}
    catch(error){if(error.code!=='ENOENT')throw error;return {availability:'source-unavailable'};}
    const self=hold(selfPath,{uid:501});held.push(self);
    const clang=hold(CLANG,{uid:0,inode:14827087,size:290664032,limit:290664032,
      sha:'f30550eab15fdf5ab8c0dc54c52679711241e5d4b636b027e18c09fef531775d'});held.push(clang);
    held.push(hold(SDK+'/SDKSettings.json',{uid:0,
      sha:'f8d005f09381389167f9e0aeaa169bc9e7dff162ef22ca2fd8e98df7ff1acafe'}));
    held.push(hold(NODE,{uid:501,inode:15033141,
      sha:'59cd4fb59cf5bc239f43d5db8c0cd8c23c22db79419612b92da3b7cf34de8553'}));
    assert.equal(fs.realpathSync(process.execPath),NODE,'fixed original test runtime');
    const rows=HEADER_ROWS.split('\n');assert.equal(rows.length,85);const names=new Set();
    for(const row of rows){const [label,inode,size,mode,sha]=row.split('|');
      assert.match(label,/^[RS]\/[A-Za-z0-9_/.]+$/);assert.equal(label.includes('..'),false);
      assert.equal(names.has(label),false);names.add(label);assert.match(sha,/^[a-f0-9]{64}$/);
      const filename=ROOTS[label[0]]+label.slice(1);
      held.push(hold(filename,{uid:0,inode,size,mode:parseInt(mode,8),sha}));
    }
    for(const filename of ABSENT){checkAbsent(filename);checks.push(()=>checkAbsent(filename));}
    const parents=new Set();for(const item of held){let filename=path.dirname(item.filename);
      while(filename!=='/'){parents.add(filename);filename=path.dirname(filename);}}
    for(const filename of parents)directoryGuard(filename,checks);
    let body=source.read().toString();
    if(mode==='payload31'){const anchor='uint8_t payload[32];';assert.equal(body.split(anchor).length,2);
      body=body.replace(anchor,'uint8_t payload[31];');}
    const compiled=Buffer.from(body+'\n'+ORACLE);
    const dir=fs.mkdtempSync('/private/tmp/setfarm-continuity-abi.');
    fs.chmodSync(dir,0o700);const fixtureStat=directoryGuard(dir,checks,true);
    const copy=dir+'/abi.c';fs.writeFileSync(copy,compiled,{flag:'wx',mode:0o600});
    const ownedCopy=hold(copy,{uid:501,sha:sha256(compiled),mode:0o600});held.push(ownedCopy);
    assert.equal(new Set(held.map(item=>item.fd)).size,held.length,'distinct original input descriptors');
    for(const check of checks)check();for(const item of held)item.check();
    const compiler=await settled([
      '--no-default-config','--target=arm64-apple-macos26.5',
      '-resource-dir',RESOURCE,'-isysroot',SDK,'-nostdinc',
      '-isystem',ROOTS.R,'-isystem',ROOTS.S,
      '-fno-modules','-fno-implicit-modules','-fno-implicit-module-maps',
      '-std=c11','-O0','-Wall','-Wextra','-Werror','-fsyntax-only','-x','c',copy],dir);
    assert.deepEqual(fs.readdirSync(dir),['abi.c'],'syntax-only fixture has no binary/cache');
    result={availability:'syntax-observed',compiler,receipt:{mode,dir,
      fixtureDevice:String(fixtureStat.dev),fixtureInode:String(fixtureStat.ino),
      sourceHash:source.sha,testHash:self.sha,copyHash:ownedCopy.sha,clangHash:clang.sha,
      headerNominationHash:sha256(HEADER_ROWS+'\n'),headerCount:85,absences:7,
      inputCount:held.length,copyInode:String(ownedCopy.stat.ino),copyBytes:String(ownedCopy.stat.size),
      limitation:'ordinary mutable-host layout sample; no runtime/complete TCB proof'}};
  }catch(error){failures.push(error);}
  finally{
    for(const check of checks)try{check();}catch(error){failures.push(error);}
    for(const item of held)try{item.check();}catch(error){failures.push(error);}
    try{assert.equal(new Set(held.map(item=>item.fd)).size,held.length,'original descriptors remain distinct');}
    catch(error){failures.push(error);}
    for(const item of held.reverse())try{item.close();closed++;}catch(error){failures.push(error);}
    if(failures.length)throw new AggregateError(failures,'syntax-only fixture failed; artifacts retained');
  }
  result.receipt.checkedInputCloses=closed;
  result.receipt.distinctOriginalInputs=held.length;
  result.receipt.readAtime={assertedInvariant:false,changes:held
    .filter(item=>item.stat.atimeNs!==item.atimeAfterNs)
    .map(item=>({path:item.filename,beforeNs:String(item.stat.atimeNs),afterNs:String(item.atimeAfterNs)}))};
  return result;
}

// Real break: missing/wrong layout typedefs cannot satisfy the compiler consumer.
test('continuity ABI compiles the independent user-layout oracle',{skip:!enabled},async t=>{
  const actual=await invokeSyntax('baseline');
  assert.equal(actual.availability,'syntax-observed');
  assert.deepEqual(actual.compiler,{code:0,signal:null,eof:[true,true],stdout:'',stderr:''});
  assert.equal(actual.receipt.checkedInputCloses,actual.receipt.inputCount);
  t.diagnostic(JSON.stringify(actual));
});

// Real break: message padding must not hide a shortened payload.
test('continuity ABI rejects the padded payload-length mutant',{skip:!enabled},async t=>{
  const actual=await invokeSyntax('payload31');assert.equal(actual.availability,'syntax-observed');
  const {compiler}=actual;assert.equal(compiler.code,1);assert.equal(compiler.signal,null);
  assert.deepEqual(compiler.eof,[true,true]);assert.equal(compiler.stdout,'');
  const errors=compiler.stderr.split('\n').filter(line=>line.includes('error:'));
  assert.equal(errors.length,1,'one actual static-assert diagnostic');
  assert.match(errors[0],/error: static assertion failed.*SFCNT_PAYLOAD_SIZE_32/);
  assert.match(compiler.stderr,/\n1 error generated\.\n$/);
  assert.equal(/warning:|fatal error:/.test(compiler.stderr),false);
  assert.equal(actual.receipt.checkedInputCloses,actual.receipt.inputCount);
  t.diagnostic(JSON.stringify(actual));
});
