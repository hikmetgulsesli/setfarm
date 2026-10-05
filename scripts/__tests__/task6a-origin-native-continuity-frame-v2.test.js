import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

// Pure decoder measurement only; no cleanup, channel, retention or P2 proof.
const flag=process.env.SETFARM_TASK6A_NATIVE_CONTINUITY_FRAME_TEST;
assert.ok(flag===undefined || flag==='1','closed continuity frame opt-in');
const enabled=flag==='1';
const encoderFlag=process.env.SETFARM_TASK6A_NATIVE_CONTINUITY_FRAME_ENCODER_TEST;
assert.ok(encoderFlag===undefined || encoderFlag==='1','closed continuity encoder opt-in');
const encoderEnabled=encoderFlag==='1';
assert.equal(enabled&&encoderEnabled,false,'one separately reviewed recipe only');
const sourcePath=fileURLToPath(new URL('../task6a-origin-native-continuity-frame-v2.c',import.meta.url));
const selfPath=fileURLToPath(import.meta.url);
const CLT='/Library/Developer/CommandLineTools';
const CLANG=CLT+'/usr/bin/clang', LD=CLT+'/usr/bin/ld';
const NM=CLT+'/usr/bin/llvm-nm', OTOOL=CLT+'/usr/bin/llvm-otool';
const SDK=CLT+'/SDKs/MacOSX26.5.sdk', RESOURCE=CLT+'/usr/lib/clang/21';
const ROOTS={R:RESOURCE+'/include',S:SDK+'/usr/include'};
const NODE='/opt/homebrew/Cellar/node/26.4.0/bin/node';
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
// Same originally independent conservative superset as S2, not compiler-used TCB.
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


// Independent literals and case map. Candidate supplies neither expected values
// nor diagnostics.71 means wrong nonce accepted as1 after preceding checks.
const CASES=Object.freeze({
  0:'all-literal-cases-and-input-immutability',
  1:'state1',2:'state2',3:'state3',10:'null-frame',11:'null-nonce',
  12:'short-length',13:'extra-length',14:'size-max-length',20:'magic',
  21:'version-byte',22:'little-endian-version',23:'high-state-byte',
  24:'state-zero',25:'state-four',26:'state-255',27:'little-endian-state',
  71:'wrong-nonce-accepted-as-state1',72:'wrong-nonce-other-state',
  90:'input-mutation',91:'driver-storage-contract',
});
const DRIVER = String.raw`
#include <stddef.h>
#include <stdint.h>
unsigned sf_continuity_decode_status_v2(const uint8_t *,size_t,const uint8_t[16]);
static const uint8_t nonce[16]={
  0x00,0x11,0x22,0x33,0x44,0x55,0x66,0x77,
  0x88,0x99,0xaa,0xbb,0xcc,0xdd,0xee,0xff
};
static const uint8_t one[32]={
  'S','F','S','T','A','T','2','!',0,0,0,2,0,0,0,1,
  0x00,0x11,0x22,0x33,0x44,0x55,0x66,0x77,
  0x88,0x99,0xaa,0xbb,0xcc,0xdd,0xee,0xff
};
static const uint8_t two[32]={
  'S','F','S','T','A','T','2','!',0,0,0,2,0,0,0,2,
  0x00,0x11,0x22,0x33,0x44,0x55,0x66,0x77,
  0x88,0x99,0xaa,0xbb,0xcc,0xdd,0xee,0xff
};
static const uint8_t three[32]={
  'S','F','S','T','A','T','2','!',0,0,0,2,0,0,0,3,
  0x00,0x11,0x22,0x33,0x44,0x55,0x66,0x77,
  0x88,0x99,0xaa,0xbb,0xcc,0xdd,0xee,0xff
};
/* Extent is driver-owned storage, never the potentially malformed length. */
static int probe(const uint8_t *frame,size_t extent,size_t length,
                 const uint8_t *expected,unsigned want,int diagnostic) {
  uint8_t saved_frame[33],saved_nonce[16];
  if(extent>33 || (frame==NULL && extent!=0))return 91;
  for(size_t i=0;i<extent;i++)saved_frame[i]=frame[i];
  if(expected!=NULL)for(size_t i=0;i<16;i++)saved_nonce[i]=expected[i];
  unsigned actual=sf_continuity_decode_status_v2(frame,length,expected);
  for(size_t i=0;i<extent;i++)if(frame[i]!=saved_frame[i])return 90;
  if(expected!=NULL)for(size_t i=0;i<16;i++)
    if(expected[i]!=saved_nonce[i])return 90;
  if(actual==want)return 0;
  if(diagnostic==71)return actual==1 ? 71 : 72;
  return diagnostic;
}
static void copy_one(uint8_t frame[33]) {
  for(size_t i=0;i<32;i++)frame[i]=one[i];
  frame[32]=0x5a;
}
#define CHECK(frame,extent,length,expected,want,diagnostic) do { \
  int result=probe(frame,extent,length,expected,want,diagnostic); \
  if(result!=0)return result; \
} while(0)
int main(void) {
  uint8_t frame[33];
  CHECK(one,32,32,nonce,1,1);
  CHECK(two,32,32,nonce,2,2);
  CHECK(three,32,32,nonce,3,3);
  CHECK(NULL,0,32,nonce,0,10);
  CHECK(one,32,32,NULL,0,11);
  for(size_t length=0;length<32;length++)
    CHECK(one,32,length,nonce,0,12);
  copy_one(frame);CHECK(frame,33,33,nonce,0,13);
  CHECK(one,32,SIZE_MAX,nonce,0,14);
  for(size_t i=0;i<8;i++){
    copy_one(frame);frame[i]^=1;CHECK(frame,33,32,nonce,0,20);
  }
  for(size_t i=8;i<12;i++){
    copy_one(frame);frame[i]^=1;CHECK(frame,33,32,nonce,0,21);
  }
  /* Little-endian version2 is not big-endian2. */
  copy_one(frame);frame[8]=2;frame[11]=0;
  CHECK(frame,33,32,nonce,0,22);
  for(size_t i=12;i<15;i++){
    copy_one(frame);frame[i]=0x80;CHECK(frame,33,32,nonce,0,23);
  }
  copy_one(frame);frame[15]=0;CHECK(frame,33,32,nonce,0,24);
  copy_one(frame);frame[15]=4;CHECK(frame,33,32,nonce,0,25);
  copy_one(frame);frame[15]=255;CHECK(frame,33,32,nonce,0,26);
  /* Little-endian state1 is not big-endian1. */
  copy_one(frame);frame[12]=1;frame[15]=0;
  CHECK(frame,33,32,nonce,0,27);
  /* These checks come last so71 cannot hide a preceding invariant failure. */
  for(size_t i=0;i<16;i++){
    copy_one(frame);frame[16+i]^=1;CHECK(frame,33,32,nonce,0,71);
  }
  return 0;
}
`;
// Independent producer fixtures; no decoder call or roundtrip expectation.
const ENCODER_CASES=Object.freeze({
  0:'all-literal-encoder-cases-and-storage-boundaries',
  10:'null-output',11:'null-nonce',12:'short-capacity',13:'extra-capacity',
  14:'size-max-capacity',20:'invalid-state',
  71:'only-version-byte-mutated-to-one',72:'other-output-byte-or-version-failure',
  80:'encoder-return',90:'storage-mutation',91:'output-canary',
});
const ENCODER_DRIVER = String.raw`
#include <stddef.h>
#include <stdint.h>
unsigned sf_continuity_encode_status_v2(uint8_t *,size_t,unsigned,const uint8_t[16]);
static const uint8_t nonce[16]={
  0x00,0x11,0x22,0x33,0x44,0x55,0x66,0x77,
  0x88,0x99,0xaa,0xbb,0xcc,0xdd,0xee,0xff
};
static const uint8_t one[32]={
  'S','F','S','T','A','T','2','!',0,0,0,2,0,0,0,1,
  0x00,0x11,0x22,0x33,0x44,0x55,0x66,0x77,
  0x88,0x99,0xaa,0xbb,0xcc,0xdd,0xee,0xff
};
static const uint8_t two[32]={
  'S','F','S','T','A','T','2','!',0,0,0,2,0,0,0,2,
  0x00,0x11,0x22,0x33,0x44,0x55,0x66,0x77,
  0x88,0x99,0xaa,0xbb,0xcc,0xdd,0xee,0xff
};
static const uint8_t three[32]={
  'S','F','S','T','A','T','2','!',0,0,0,2,0,0,0,3,
  0x00,0x11,0x22,0x33,0x44,0x55,0x66,0x77,
  0x88,0x99,0xaa,0xbb,0xcc,0xdd,0xee,0xff
};
static int refused(size_t capacity,unsigned state,int null_out,int null_nonce,int diagnostic) {
  uint8_t arena[34],saved[34],input[16];
  for(size_t i=0;i<34;i++)arena[i]=saved[i]=0xa5;
  for(size_t i=0;i<16;i++)input[i]=nonce[i];
  unsigned actual=sf_continuity_encode_status_v2(null_out?NULL:arena+1,capacity,
                                               state,null_nonce?NULL:input);
  for(size_t i=0;i<34;i++)if(arena[i]!=saved[i])return 90;
  for(size_t i=0;i<16;i++)if(input[i]!=nonce[i])return 90;
  return actual==0?0:diagnostic;
}
/* overlap=-1 means separate nonce; 0/8/16 use valid arena-owned storage. */
static int encoded(unsigned state,const uint8_t expected[32],int overlap) {
  uint8_t arena[34],input[16];
  for(size_t i=0;i<34;i++)arena[i]=0xa5;
  for(size_t i=0;i<16;i++)input[i]=nonce[i];
  uint8_t *out=arena+1;
  const uint8_t *source=input;
  if(overlap>=0){
    for(size_t i=0;i<16;i++)out[(size_t)overlap+i]=nonce[i];
    source=out+(size_t)overlap;
  }
  unsigned actual=sf_continuity_encode_status_v2(out,32,state,source);
  if(arena[0]!=0xa5 || arena[33]!=0xa5)return 91;
  for(size_t i=0;i<16;i++)if(input[i]!=nonce[i])return 90;
  if(actual!=1)return 80;
  /* Check ALL31 other bytes before admitting the specific version failure. */
  for(size_t i=0;i<32;i++)if(i!=11 && out[i]!=expected[i])return 72;
  if(out[11]!=expected[11])return out[11]==1?71:72;
  return 0;
}
#define REFUSE(capacity,state,null_out,null_nonce,diagnostic) do { \
  int result=refused(capacity,state,null_out,null_nonce,diagnostic); \
  if(result!=0)return result; \
} while(0)
#define ENCODE(state,expected,overlap) do { \
  int result=encoded(state,expected,overlap); \
  if(result!=0)return result; \
} while(0)
int main(void) {
  REFUSE(32,1,1,0,10);REFUSE(32,1,0,1,11);
  for(size_t capacity=0;capacity<32;capacity++)REFUSE(capacity,1,0,0,12);
  REFUSE(33,1,0,0,13);REFUSE(SIZE_MAX,1,0,0,14);
  REFUSE(32,0,0,0,20);REFUSE(32,4,0,0,20);
  REFUSE(32,255,0,0,20);REFUSE(32,~0u,0,0,20);
  ENCODE(1,one,-1);ENCODE(2,two,-1);ENCODE(3,three,-1);
  ENCODE(1,one,0);ENCODE(1,one,8);ENCODE(1,one,16);
  ENCODE(2,two,0);ENCODE(2,two,8);ENCODE(2,two,16);
  ENCODE(3,three,0);ENCODE(3,three,8);ENCODE(3,three,16);
  return 0;
}
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
function settled(command,args,cwd) {
  return new Promise((resolve,reject)=>{
    const child=spawn(command,args,{cwd,shell:false,stdio:['ignore','pipe','pipe'],
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
      if(errors.length)reject(new AggregateError(errors,'owned native child failed after original close'));
      else resolve(result);
    });
    for(const [i,stream]of[child.stdout,child.stderr].entries()){
      if(!stream){errors.push(new Error('missing native child stream'));continue;}
      try{stream.on('error',error=>errors.push(error));stream.on('end',()=>{eof[i]=true;});
        stream.on('data',bytes=>{try{total+=bytes.length;if(total<=1_048_576)chunks[i].push(bytes);else overflow=true;}
          catch(error){errors.push(error);}});
      }catch(error){errors.push(error);}
    }
  });
}

function requireZero(actual,label) {
  assert.deepEqual(actual,{code:0,signal:null,eof:[true,true],stdout:'',stderr:''},label);
}
function artifact(item) {
  const stat=item.stat;
  return {path:item.filename,dev:String(stat.dev),ino:String(stat.ino),
    uid:String(stat.uid),gid:String(stat.gid),mode:Number(stat.mode&0o777n),
    nlink:String(stat.nlink),bytes:String(stat.size),sha256:item.sha,
    mtimeNs:String(stat.mtimeNs),ctimeNs:String(stat.ctimeNs)};
}
async function invokeFrame(mode) {
  assert.ok(['baseline','nonce-omission','encode-baseline','encode-version'].includes(mode));
  const encoder=mode==='encode-baseline'||mode==='encode-version';
  const selectedDriver=encoder?ENCODER_DRIVER:DRIVER;
  const selectedCases=encoder?ENCODER_CASES:CASES;
  const held=[],checks=[],failures=[];let result,closed=0;
  try {
    let source;
    try{source=hold(sourcePath,{uid:501});held.push(source);}
    catch(error){if(error.code!=='ENOENT')throw error;return {availability:'source-unavailable'};}
    const self=hold(selfPath,{uid:501});held.push(self);
    const toolRows=[
      [CLANG,14827087,290664032,'f30550eab15fdf5ab8c0dc54c52679711241e5d4b636b027e18c09fef531775d',0],
      [LD,14827148,4953232,'28d85b9af18c923db12e0b4ce70b80ee217f2b7cade0e872baa9e8ddc396c08d',0],
      [NM,14827169,33125008,'9097f9662024989b801a1448eea2a71a4e916537a595cbaf34d4d051480236f6',0],
      [OTOOL,14827173,138208,'61ff2c63cf68eeeadf9c4700dadb8271740ff4960f98500f30db82b31521c0de',0],
      [NODE,15033141,68032,'59cd4fb59cf5bc239f43d5db8c0cd8c23c22db79419612b92da3b7cf34de8553',501],
    ];
    for(const [filename,inode,size,sha,uid]of toolRows)
      held.push(hold(filename,{uid,inode,size,limit:size,sha}));
    assert.equal(fs.realpathSync(process.execPath),NODE,'fixed original test runtime');
    for(const [filename,sha]of[
      [SDK+'/SDKSettings.json','f8d005f09381389167f9e0aeaa169bc9e7dff162ef22ca2fd8e98df7ff1acafe'],
      [SDK+'/usr/lib/libSystem.B.tbd','20cfce043f11a083e2eb6111efe3579919a8082fa4cc912a7bd839af2010ec57'],
      [CLT+'/usr/share/man/man1/ld.1','8570994697756ef9bf0146983a6971892d99cb830a2b36f93fb0d049835e81d5'],
    ])held.push(hold(filename,{uid:0,sha}));
    const rows=HEADER_ROWS.split('\n'),names=new Set();assert.equal(rows.length,85);
    for(const row of rows){
      const [label,inode,size,mode,sha]=row.split('|');
      assert.match(label,/^[RS]\/[A-Za-z0-9_/.]+$/);assert.equal(label.includes('..'),false);
      assert.equal(names.has(label),false);names.add(label);assert.match(sha,/^[a-f0-9]{64}$/);
      held.push(hold(ROOTS[label[0]]+label.slice(1),
        {uid:0,inode,size,mode:parseInt(mode,8),sha}));
    }
    for(const filename of ABSENT){checkAbsent(filename);checks.push(()=>checkAbsent(filename));}
    const parents=new Set();for(const item of held){let filename=path.dirname(item.filename);
      while(filename!=='/'){parents.add(filename);filename=path.dirname(filename);}}
    for(const filename of parents)directoryGuard(filename,checks);
    assert.equal(fs.lstatSync(SDK,{bigint:true}).ino,14162438n);
    assert.equal(fs.lstatSync(RESOURCE,{bigint:true}).ino,6714331n);
    let candidate=source.read().toString();
    if(mode==='nonce-omission'){
      const anchor='if (bytes[16 + i] != expected_nonce[i]) return 0;';
      assert.equal(candidate.split(anchor).length,2,'unique nonce-comparison mutation');
      candidate=candidate.replace(anchor,'(void)expected_nonce[i];');
    }
    if(mode==='encode-version'){
      const anchor='out[11] = 2;';
      assert.equal(candidate.split(anchor).length,2,'unique encoder version mutation');
      candidate=candidate.replace(anchor,'out[11] = 1;');
    }
    const dir=fs.mkdtempSync('/private/tmp/setfarm-continuity-frame.');
    fs.chmodSync(dir,0o700);const fixtureStat=directoryGuard(dir,checks,true);
    const candidateCopy=dir+'/candidate.c',driverCopy=dir+'/driver.c';
    const candidateObject=dir+'/candidate.o',driverObject=dir+'/driver.o',binary=dir+'/decoder';
    const copies=[];
    for(const [filename,body]of[[candidateCopy,candidate],[driverCopy,selectedDriver]]){
      const bytes=Buffer.from(body);fs.writeFileSync(filename,bytes,{flag:'wx',mode:0o600});
      const owned=hold(filename,{uid:501,sha:sha256(bytes),mode:0o600});
      held.push(owned);copies.push(owned);
    }
    const precheck=()=>{
      assert.equal(new Set(held.map(item=>item.fd)).size,held.length,'distinct original descriptors');
      for(const check of checks)check();for(const item of held)item.check();
    };
    precheck();const compile=[];
    for(const [copy,object]of[[candidateCopy,candidateObject],[driverCopy,driverObject]]){
      const actual=await settled(CLANG,[
        '--no-default-config','--target=arm64-apple-macos26.5',
        '-resource-dir',RESOURCE,'-isysroot',SDK,'-integrated-as','-nostdinc',
        '-isystem',ROOTS.R,'-isystem',ROOTS.S,
        '-fno-modules','-fno-implicit-modules','-fno-implicit-module-maps',
        '-fno-lto','-fstack-protector-strong','-std=c11','-O0','-Wall','-Wextra','-Werror',
        '-c',copy,'-o',object],dir);
      requireZero(actual,'actual compile');compile.push(actual);
      held.push(hold(object,{uid:501}));precheck();
    }
    const link=await settled(CLANG,[
      '--no-default-config','--target=arm64-apple-macos26.5',
      '-resource-dir',RESOURCE,'-isysroot',SDK,'--ld-path='+LD,
      '-fno-lto','-nostdlib','-Wl,-Z','-Wl,-syslibroot,'+SDK,
      candidateObject,driverObject,SDK+'/usr/lib/libSystem.B.tbd','-o',binary],dir);
    let importsResult=null,dependencyResult=null,driver=null;
    if(encoder&&link.code!==0){
      // Preserve actual failed-link channels and original artifacts BEFORE
      // the consuming test's unchanged link0 assertion. Never execute/inspect.
      const noImage=()=>checkAbsent(binary);noImage();checks.push(noImage);
      const inventory=()=>assert.deepEqual(fs.readdirSync(dir).sort(),
        ['candidate.c','candidate.o','driver.c','driver.o']);
      inventory();checks.push(inventory);precheck();
    }else{
    requireZero(link,'actual link');const image=hold(binary,{uid:501});held.push(image);
    assert.ok((image.stat.mode&0o100n)!==0n,'owned executable');precheck();
    importsResult=await settled(NM,['-uj',binary],dir);
    assert.equal(importsResult.code,0);assert.equal(importsResult.signal,null);
    assert.deepEqual(importsResult.eof,[true,true]);assert.equal(importsResult.stderr,'');
    const imports=importsResult.stdout.trim().split('\n').sort();
    assert.deepEqual(imports,['___stack_chk_fail','___stack_chk_guard'],'exact protection imports');
    dependencyResult=await settled(OTOOL,['-L',binary],dir);
    assert.equal(dependencyResult.code,0);assert.equal(dependencyResult.signal,null);
    assert.deepEqual(dependencyResult.eof,[true,true]);assert.equal(dependencyResult.stderr,'');
    const lines=dependencyResult.stdout.trim().split('\n');
    assert.equal(lines.shift(),binary+':');
    assert.equal(lines.length,1,'one direct dependency');
    assert.match(lines[0],/^\s+\/usr\/lib\/libSystem\.B\.dylib \(compatibility version [0-9.]+, current version [0-9.]+\)$/);
    precheck();
    driver=await settled(binary,[],dir);
    assert.deepEqual(fs.readdirSync(dir).sort(),
      ['candidate.c','candidate.o','decoder','driver.c','driver.o']);
    }
    result={availability:driver===null?'frame-link-refused':'frame-observed',compile,link,importsResult,dependencyResult,
      driver,case:driver===null?'not-executed':selectedCases[driver.code]??'unknown-driver-code',caseMap:selectedCases,
      receipt:{mode,dir,fixture:{dev:String(fixtureStat.dev),ino:String(fixtureStat.ino),
        uid:String(fixtureStat.uid),gid:String(fixtureStat.gid),mode:Number(fixtureStat.mode&0o777n)},
        source:artifact(source),test:artifact(self),artifacts:held.filter(item=>item.filename.startsWith(dir+'/')).map(artifact),
        tools:held.filter(item=>toolRows.some(row=>row[0]===item.filename)).map(artifact),
        inputCount:held.length,headerCount:85,absences:7,
        headerNominationHash:sha256(HEADER_ROWS+'\n'),driverHash:sha256(selectedDriver),
        imageCreated:driver!==null,inspectionExecuted:driver!==null,driverExecuted:driver!==null,
        limitation:'ordinary mutable-host codec sample; no cleanup/channel/retention/whole runtime TCB/CONTROL/P2 proof'}};
  }catch(error){failures.push(error);}
  finally{
    for(const check of checks)try{check();}catch(error){failures.push(error);}
    for(const item of held)try{item.check();}catch(error){failures.push(error);}
    try{assert.equal(new Set(held.map(item=>item.fd)).size,held.length);}
    catch(error){failures.push(error);}
    for(const item of held.reverse())try{item.close();closed++;}catch(error){failures.push(error);}
    if(failures.length)throw new AggregateError(failures,'frame fixture failed; artifacts retained');
  }
  result.receipt.checkedInputCloses=closed;result.receipt.distinctOriginalInputs=held.length;
  result.receipt.readAtime={assertedInvariant:false,changes:held.filter(item=>item.stat.atimeNs!==item.atimeAfterNs)
    .map(item=>({path:item.filename,beforeNs:String(item.stat.atimeNs),afterNs:String(item.atimeAfterNs)}))};
  return result;
}

// Break caught: wrong byte checks/state mapping cannot satisfy literal decoder callers.
test('continuity status decoder accepts only exact bound frames',{skip:!enabled},async t=>{
  const actual=await invokeFrame('baseline');assert.equal(actual.availability,'frame-observed');
  t.diagnostic(JSON.stringify(actual));
  assert.deepEqual(actual.driver,{code:0,signal:null,eof:[true,true],stdout:'',stderr:''});
  assert.equal(actual.case,'all-literal-cases-and-input-immutability');
  assert.equal(actual.receipt.checkedInputCloses,actual.receipt.inputCount);
});
// Break caught: ignoring any nonce byte admits an unrelated frame, not a generic fault.
test('continuity status oracle rejects nonce-comparison omission',{skip:!enabled},async t=>{
  const actual=await invokeFrame('nonce-omission');assert.equal(actual.availability,'frame-observed');
  t.diagnostic(JSON.stringify(actual));
  assert.deepEqual(actual.driver,{code:71,signal:null,eof:[true,true],stdout:'',stderr:''});
  assert.equal(actual.case,'wrong-nonce-accepted-as-state1');
  assert.equal(actual.receipt.checkedInputCloses,actual.receipt.inputCount);
});

// Break caught: wrong validation, layout or pre-write overlap snapshot.
test('continuity status encoder produces only literal bound frames',{skip:!encoderEnabled},async t=>{
  const actual=await invokeFrame('encode-baseline');
  t.diagnostic(JSON.stringify(actual));
  requireZero(actual.link,'actual encoder link must succeed');
  assert.equal(actual.availability,'frame-observed');
  assert.deepEqual(actual.driver,{code:0,signal:null,eof:[true,true],stdout:'',stderr:''});
  assert.equal(actual.case,'all-literal-encoder-cases-and-storage-boundaries');
  assert.equal(actual.receipt.checkedInputCloses,actual.receipt.inputCount);
});
// Break caught: only the version-byte mutation, not generic/trailing corruption.
test('continuity status encoder oracle rejects version-byte mutation',{skip:!encoderEnabled},async t=>{
  const actual=await invokeFrame('encode-version');
  t.diagnostic(JSON.stringify(actual));
  requireZero(actual.link,'actual encoder control link must succeed');
  assert.equal(actual.availability,'frame-observed');
  assert.deepEqual(actual.driver,{code:71,signal:null,eof:[true,true],stdout:'',stderr:''});
  assert.equal(actual.case,'only-version-byte-mutated-to-one');
  assert.equal(actual.receipt.checkedInputCloses,actual.receipt.inputCount);
});
