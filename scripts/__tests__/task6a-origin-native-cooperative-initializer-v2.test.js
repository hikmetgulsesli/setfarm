import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

// Opt-in ordinary ABI characterization, NOT transport/CONTROL/protected origin.
// Removing the native invocation must fail even with identical JS stderr.
const flag = process.env.SETFARM_TASK6A_NATIVE_INERT_INITIALIZER_TEST;
assert.ok(flag === undefined || flag === '1', 'closed inert test opt-in');
const enabled = flag === '1';
const guardFlag = process.env.SETFARM_TASK6A_NATIVE_CALLBACK_GUARD_TEST;
assert.ok(guardFlag === undefined || guardFlag === '1', 'closed callback guard opt-in');
assert.ok(!(enabled && guardFlag === '1'), 'inert and guard modes are exclusive');
const guardEnabled = guardFlag === '1';

// S10a is a NEW pre-channel source epoch. Historical recipes stay frozen/closed.
const preflightFlag = process.env.SETFARM_TASK6A_NATIVE_CONTRACT_PREFLIGHT_RED;
assert.ok(preflightFlag === undefined || preflightFlag === '1', 'closed contract preflight opt-in');
const preflightEnabled = preflightFlag === '1';
assert.ok(!(preflightEnabled && (enabled || guardEnabled)), 'native modes are exclusive');
assert.equal(enabled || guardEnabled, false, 'historical native recipes are closed in the S10a epoch');
const preflightSelfSha = process.env.SETFARM_TASK6A_NATIVE_CONTRACT_PREFLIGHT_SELF_SHA256;
assert.ok(preflightEnabled ? /^[a-f0-9]{64}$/.test(preflightSelfSha || '') :
  preflightSelfSha === undefined, 'externally nominated preflight self-test epoch');
const sourcePath = fileURLToPath(new URL('../task6a-origin-native-cooperative-initializer-v2.c', import.meta.url));
const entryPath = fileURLToPath(new URL('../task6a-origin-native-cooperative-entry-v2.cjs', import.meta.url));
const CLT = '/Library/Developer/CommandLineTools';
const CLANG = CLT + '/usr/bin/clang';
const LD = CLT + '/usr/bin/ld';
const NM = CLT + '/usr/bin/llvm-nm';
const OTOOL = CLT + '/usr/bin/llvm-otool';
const SDK = CLT + '/SDKs/MacOSX26.5.sdk';
const RESOURCE = CLT + '/usr/lib/clang/21';
const CELLAR = '/opt/homebrew/Cellar/';
const NODE = CELLAR + 'node/26.4.0/bin/node';
const LIBNODE = CELLAR + 'node/26.4.0/lib/libnode.147.dylib';
const HEADERS = CELLAR + 'node/26.4.0/include/node';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

// Independent recorded non-system closure. These pins measure a mutable host
// installation; they do not establish immutable/continuous dyld trust.
const IMAGE_PINS = [
  ['node/26.4.0/bin/node',15033141,'59cd4fb59cf5bc239f43d5db8c0cd8c23c22db79419612b92da3b7cf34de8553'],
  ['node/26.4.0/lib/libnode.147.dylib',15033144,'950c18edeb5c2f3ebcda6f8a703de384caddd95040094cf14fa43eb0c5cfa4f7'],
  ['llhttp/9.4.2/lib/libllhttp.9.4.2.dylib',15033018,'d96838af45e35d753aaad42bd731c82c834be1f92032bb02948adaf8509c133c'],
  ['libuv/1.52.1/lib/libuv.1.0.0.dylib',15021733,'34d4e2cd30b56dca5bda539f4448667360f0994c6b337ffebc5d37d818bc15d5'],
  ['ada-url/3.4.4/lib/libada.3.4.4.dylib',15033073,'a55588fab581b41c9b918f4a5bab044e946091eb72cbed3bc82a8df00db189a2'],
  ['simdjson/4.6.4/lib/libsimdjson.33.0.0.dylib',15021752,'9ac6d74a81c248a5a946fae44bc88ad0705f3a32a495aa1a906fb6a35fe3d258'],
  ['brotli/1.2.0/lib/libbrotlidec.1.2.0.dylib',718123,'d7ac1e69b6c443341fb4302de0169d187489d58d8a641c8eadd6db9ca2cd0cbf'],
  ['brotli/1.2.0/lib/libbrotlienc.1.2.0.dylib',718124,'32e38a8ab06c8770ea4bfaf11ea324d7bcb6fe5f07eaff9d6260f93984ee6729'],
  ['c-ares/1.34.6/lib/libcares.2.19.5.dylib',718166,'e5595a0c640a2341e2df5a0fedaa63e7e9afe99b01c9880338064e0746414518'],
  ['hdrhistogram_c/0.11.9/lib/libhdr_histogram.6.2.3.dylib',718349,'d1f4ba22087781611f0187787217ffef1ef97b96cd76ff2af3fb600a4434bbb6'],
  ['merve/1.2.2_1/lib/libmerve.1.2.2.dylib',15033115,'a39e3416af9b155ba8ab441f30b2ea58b853d5ae955cb35efd53bd72d299299f'],
  ['nbytes/0.1.4/lib/libnbytes.dylib',15033131,'2ebb8415d537b47420fc46efb6d6271b93befd22b30ad2afba75ab5e2be55fcc'],
  ['libnghttp2/1.69.0/lib/libnghttp2.14.dylib',15021670,'b56cd6b95765b0c608a6cb50ab44ffb4ab29303d627f0c2d96a028aa11688cc2'],
  ['libnghttp3/1.17.0/lib/libnghttp3.9.8.0.dylib',15021682,'76af0939e86d0683b071633a017d468ec58e37622248d856175c86c875bc305c'],
  ['libngtcp2/1.23.0/lib/libngtcp2.16.dylib',15021714,'67f329d57b039c58c9cf3714fcfac79ef56d4a13ada72d21d0e2f7937bd9ec23'],
  ['sqlite/3.53.3/lib/libsqlite3.3.53.3.dylib',15021791,'b64abb706584a8952e67a3efd872e3fe6e6852c6a2a0d09adec2e94c4ab08ca5'],
  ['libffi/3.6.0/lib/libffi.8.dylib',15033108,'9c02b6ef72c9713ee6a7c17babbe6983ab8cc47669691f262c05171da113f42f'],
  ['uvwasi/0.0.23/lib/libuvwasi.dylib',718533,'c922288c5179279316b32b2c83d5c50d7b87216b442473ada8c99ef4a58ba312'],
  ['zstd/1.5.7_1/lib/libzstd.1.5.7.dylib',715424,'e2847c4613b386683c234913ae3b7b04299254096caf7616e3b3cd9bb97a39ab'],
  ['openssl@3/3.6.2/lib/libcrypto.3.dylib',7244732,'ef2239cec921003b54b61968f00489271e2a2805d7d1b4e69d632423f38efe1e'],
  ['openssl@3/3.6.2/lib/libssl.3.dylib',7244733,'26ecfd43c742914a142c8b414b1f308cefe0531fcc6e38b6d45021649850e758'],
  ['icu4c@78/78.3/lib/libicui18n.78.3.dylib',15021648,'f319e50c965a1a0065d2cc5595d8553ff60b0e78a2e76bc3173774fd112de9ed'],
  ['icu4c@78/78.3/lib/libicuuc.78.3.dylib',15021652,'177dab8ae0bf0b1357d7ec6404a1e145bcc3d927aa15c3064171d23b2a1fd263'],
  ['brotli/1.2.0/lib/libbrotlicommon.1.2.0.dylib',718122,'3426742c78df5c3b523071df603f07f2bb8dea6bd8e65c366a2c6adf2bf0a3ad'],
  ['simdutf/9.0.0/lib/libsimdutf.34.0.0.dylib',15021768,'9491fe37cead254d8fd5655699f6832606ae45fc885a42ddaa072560c27dc1fc'],
  ['icu4c@78/78.3/lib/libicudata.78.3.dylib',15021647,'e7dafc3fe6613326daa30d1c930aa66219ab5524fe576b0e7b3039451652b6bf'],
  ['node/26.4.0/include/node/node_api.h',15015481,'2d4560831e525b47b060ec8a0864ab73993df9e20215ce9f0fe7b24cd31af32a'],
  ['node/26.4.0/include/node/node_api_types.h',15015482,'a25356630d3058f0a0c8937d9f297e9471e037fda58c2696d8a505c2bd99cb00'],
  ['node/26.4.0/include/node/js_native_api.h',15015474,'8808ef8899a1691411928ef5dd7dae0537aedc93d3a34e223b2d89692e79c788'],
  ['node/26.4.0/include/node/js_native_api_types.h',15015475,'c12406a8c0036aefdb66b98065fc88e2e7a053c1f274deef33af6c26c099b933'],
];
const SELECTORS = [
  ['opt/node',15033146,'../Cellar/node/26.4.0'],
  ['opt/llhttp',15033020,'../Cellar/llhttp/9.4.2'],
  ['opt/llhttp/lib/libllhttp.9.4.dylib',14959139,'libllhttp.9.4.2.dylib'],
  ['opt/libuv',15021736,'../Cellar/libuv/1.52.1'],
  ['opt/libuv/lib/libuv.1.dylib',14957469,'libuv.1.0.0.dylib'],
  ['opt/ada-url',15033075,'../Cellar/ada-url/3.4.4'],
  ['opt/ada-url/lib/libada.3.dylib',14960843,'libada.3.4.4.dylib'],
  ['opt/simdjson',15021754,'../Cellar/simdjson/4.6.4'],
  ['opt/simdjson/lib/libsimdjson.33.dylib',14958575,'libsimdjson.33.0.0.dylib'],
  ['opt/brotli',718128,'../Cellar/brotli/1.2.0'],
  ['opt/brotli/lib/libbrotlidec.1.dylib',681437,'libbrotlidec.1.2.0.dylib'],
  ['opt/brotli/lib/libbrotlienc.1.dylib',681441,'libbrotlienc.1.2.0.dylib'],
  ['opt/c-ares',718168,'../Cellar/c-ares/1.34.6'],
  ['opt/c-ares/lib/libcares.2.dylib',681177,'libcares.2.19.5.dylib'],
  ['opt/hdrhistogram_c',718351,'../Cellar/hdrhistogram_c/0.11.9'],
  ['opt/hdrhistogram_c/lib/libhdr_histogram.6.dylib',681374,'libhdr_histogram.6.2.3.dylib'],
  ['opt/merve',15033117,'../Cellar/merve/1.2.2_1'],
  ['opt/merve/lib/libmerve.1.dylib',14960947,'libmerve.1.2.2.dylib'],
  ['opt/nbytes',15033133,'../Cellar/nbytes/0.1.4'],
  ['opt/libnghttp2',15021672,'../Cellar/libnghttp2/1.69.0'],
  ['opt/libnghttp3',15021684,'../Cellar/libnghttp3/1.17.0'],
  ['opt/libnghttp3/lib/libnghttp3.9.dylib',14957416,'libnghttp3.9.8.0.dylib'],
  ['opt/libngtcp2',15021718,'../Cellar/libngtcp2/1.23.0'],
  ['opt/sqlite',15021793,'../Cellar/sqlite/3.53.3'],
  ['opt/sqlite/lib/libsqlite3.dylib',14960867,'libsqlite3.3.53.3.dylib'],
  ['opt/libffi',15033110,'../Cellar/libffi/3.6.0'],
  ['opt/uvwasi',718536,'../Cellar/uvwasi/0.0.23'],
  ['opt/zstd',715426,'../Cellar/zstd/1.5.7_1'],
  ['opt/zstd/lib/libzstd.1.dylib',678642,'libzstd.1.5.7.dylib'],
  ['opt/openssl@3',7244739,'../Cellar/openssl@3/3.6.2'],
  ['opt/icu4c@78',15021664,'../Cellar/icu4c@78/78.3'],
  ['opt/icu4c@78/lib/libicui18n.78.dylib',15020735,'libicui18n.78.3.dylib'],
  ['opt/icu4c@78/lib/libicuuc.78.dylib',15020751,'libicuuc.78.3.dylib'],
  ['Cellar/brotli/1.2.0/lib/libbrotlicommon.1.dylib',681433,'libbrotlicommon.1.2.0.dylib'],
  ['opt/simdutf',15021770,'../Cellar/simdutf/9.0.0'],
  ['opt/simdutf/lib/libsimdutf.34.dylib',14957719,'libsimdutf.34.0.0.dylib'],
  ['Cellar/icu4c@78/78.3/lib/libicuuc.78.dylib',15020751,'libicuuc.78.3.dylib'],
  ['Cellar/icu4c@78/78.3/lib/libicudata.78.dylib',15020731,'libicudata.78.3.dylib'],
];

// All wrappers below delegate real Node-API operations; no mock status.
const PREFIX = String.raw`
#define _DARWIN_C_SOURCE 1
#define NAPI_VERSION 8
#include <node_api.h>
#include <dlfcn.h>
#include <fcntl.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
NAPI_MODULE_EXPORT napi_value NAPI_CDECL napi_register_module_v1(napi_env, napi_value);
NAPI_MODULE_EXPORT int32_t node_api_module_get_api_version_v1(void);
static napi_callback original_callback;
static napi_env original_env;
static napi_env registration_env;
static napi_value registration_exports;
static napi_value original_function;
static const char *events[16];
static unsigned event_count;
static int fault;
static char image_paths[5][1024];
static unsigned image_counts[5];
static void observe_image(unsigned slot, const void *address) {
    Dl_info image;
    memset(&image,0,sizeof image);
    image_counts[slot]++;
    if (!dladdr(address,&image) || !image.dli_fname || !image.dli_fbase) {
        fault = 1; return;
    }
    unsigned i;
    for (i = 0; i < 1023 && image.dli_fname[i]; i++) {
        if (image.dli_fname[i] == '\n' || image.dli_fname[i] == '\t') fault = 1;
        image_paths[slot][i] = image.dli_fname[i];
    }
    image_paths[slot][i] = '\0';
    if (image.dli_fname[i]) fault = 1;
}
static void record(const char *event) {
    if (event_count < 16) events[event_count++] = event;
    else fault = 1;
}
static napi_value trampoline(napi_env env, napi_callback_info info) {
    record("callback-entry");
    if (!original_callback || env != original_env) { fault = 1; _Exit(73); }
    napi_value value = original_callback(env, info);
    if (value != NULL) fault = 1;
    record("callback-return");
    return value;
}
static napi_status real_create(napi_env env, const char *name, size_t len,
    napi_callback cb, void *data, napi_value *result) {
    observe_image(0,(const void *)napi_create_function);
    if (original_callback || !env || env != registration_env || !name || strcmp(name,"initialize") ||
        len != 10 || !cb || data != NULL || !result) fault = 1;
    original_callback = cb; original_env = env;
    napi_status rc = napi_create_function(env, name, len, trampoline, data, result);
    if (rc == napi_ok && result) original_function = *result;
    if (rc != napi_ok) fault = 1;
    record(rc == napi_ok ? "create:0" : "create:failed");
    return rc;
}
static napi_status real_set(napi_env env, napi_value obj, const char *name, napi_value value) {
    observe_image(1,(const void *)napi_set_named_property);
    if (env != original_env || !obj || obj != registration_exports || !name || strcmp(name,"initialize") ||
        !value || value != original_function) fault = 1;
    napi_status rc = napi_set_named_property(env,obj,name,value);
    if (rc != napi_ok) fault = 1;
    record(rc == napi_ok ? "set:0" : "set:failed"); return rc;
}
static napi_status real_throw(napi_env env, const char *code, const char *message) {
    observe_image(2,(const void *)napi_throw_error);
    if (env != original_env || !code ||
        strcmp(code,"ORIGIN_COOPERATIVE_TRANSPORT_UNAVAILABLE") || !message) fault = 1;
    napi_status rc = napi_throw_error(env,code,message);
    if (rc != napi_ok) fault = 1;
    record(rc == napi_ok ? "throw:0" : "throw:failed"); return rc;
}
static void finish(void) {
    const char *names[5] = {"create","set","throw","register","version"};
    int fd = open("native-trace",O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW,0600);
    if (fd < 0) _Exit(73);
    FILE *trace = fdopen(fd,"w");
    if (!trace) { if (close(fd) != 0) _Exit(74); _Exit(73); }
    int failed = 0;
    if (fprintf(trace,"fault:%d\n",fault) < 0) failed = 1;
    for (unsigned i = 0; i < event_count; i++)
        if (fprintf(trace,"event:%s\n",events[i]) < 0) failed = 1;
    for (unsigned i = 0; i < 5; i++)
        if (image_counts[i] && fprintf(trace,"image:%s\t%u\t%s\n",
            names[i],image_counts[i],image_paths[i]) < 0) failed = 1;
    if (fclose(trace) != 0) failed = 1;
    if (failed) _Exit(73);
}
static __attribute__((constructor)) void setup(void) {
    if (atexit(finish) != 0) _Exit(73);
}
#define napi_create_function real_create
#define napi_set_named_property real_set
#define napi_throw_error real_throw
// Preserve the installed macro's original registration/getter bodies as private
// real delegates. Public typed wrappers below witness the actual entry calls.
#undef NAPI_MODULE_EXPORT
#define NAPI_MODULE_EXPORT static
#undef NAPI_MODULE_INITIALIZER
#define NAPI_MODULE_INITIALIZER underlying_registration
#undef NODE_API_MODULE_GET_API_VERSION
#define NODE_API_MODULE_GET_API_VERSION underlying_version
`;
const SUFFIX = String.raw`
__attribute__((visibility("default"))) int32_t node_api_module_get_api_version_v1(void) {
    observe_image(4,(const void *)node_api_module_get_api_version_v1);
    int32_t version = underlying_version();
    if (version != 8) fault = 1;
    return version;
}
__attribute__((visibility("default"))) napi_value NAPI_CDECL
napi_register_module_v1(napi_env env, napi_value exports) {
    observe_image(3,(const void *)napi_register_module_v1);
    if (registration_env || !env || !exports) fault = 1;
    registration_env = env; registration_exports = exports;
    napi_value result = underlying_registration(env,exports);
    if (result != exports) fault = 1;
    return result;
}
`;

const fields = ['dev','ino','uid','gid','mode','nlink','size','mtimeNs','ctimeNs'];
const same = (a,b) => fields.every(key => a[key] === b[key]);
function digest(fd, size) {
  const h = createHash('sha256'), buffer = Buffer.alloc(1_048_576);
  let offset = 0;
  while (offset < size) {
    const n = fs.readSync(fd, buffer, 0, Math.min(buffer.length,size-offset), offset);
    assert.ok(n > 0, 'held input prematurely ended');
    h.update(buffer.subarray(0,n)); offset += n;
  }
  return h.digest('hex');
}
function hold(path, expectedHash, uid, inode) {
  const fd = fs.openSync(path, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    const stat = fs.fstatSync(fd,{bigint:true});
    assert.ok(stat.isFile()); assert.equal(stat.nlink,1n);
    assert.equal(stat.uid,BigInt(uid)); assert.equal(stat.mode & 0o022n,0n);
    if (inode) assert.equal(stat.ino,BigInt(inode));
    const sha = digest(fd,Number(stat.size));
    if (expectedHash) assert.equal(sha,expectedHash,'recorded input digest: '+path);
    const check = () => {
      assert.ok(same(stat,fs.fstatSync(fd,{bigint:true})));
      assert.ok(same(stat,fs.lstatSync(path,{bigint:true})));
      assert.equal(digest(fd,Number(stat.size)),sha);
      assert.ok(same(stat,fs.fstatSync(fd,{bigint:true})));
      assert.ok(same(stat,fs.lstatSync(path,{bigint:true})));
    };
    check();
    return {path,stat,sha,check,read() {
      check(); const value=Buffer.alloc(Number(stat.size)); let offset=0;
      while (offset<value.length) {
        const n=fs.readSync(fd,value,offset,value.length-offset,offset);
        assert.ok(n>0); offset+=n;
      }
      check(); assert.equal(hash(value),sha); return value;
    },close:()=>fs.closeSync(fd)};
  } catch (error) {
    try { fs.closeSync(fd); } catch (cleanup) { throw new AggregateError([error,cleanup]); }
    throw error;
  }
}
function bytes(item) {
  return item.read();
}
function settled(command,args,cwd) {
  return new Promise((resolve,reject) => {
    const child = spawn(command,args,{cwd,shell:false,
      env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C',TMPDIR:cwd},
      stdio:['ignore','pipe','pipe']});
    const chunks = [[],[]], errors = [], eof = [false,false];
    let exit = null, total = 0, overflow = false;
    child.on('error',e=>errors.push(e));
    child.on('exit',(code,signal)=>{exit={code,signal};});
    child.on('close',(code,signal)=>{
      let result;
      try {
        assert.deepEqual(exit,{code,signal}); assert.equal(signal,null);
        assert.deepEqual(eof,[true,true]); assert.equal(overflow,false);
        result={code,stdout:Buffer.concat(chunks[0]).toString(),stderr:Buffer.concat(chunks[1]).toString()};
      } catch(e) { errors.push(e); }
      if (errors.length) return reject(new AggregateError(errors,'owned child failed after original close'));
      resolve(result);
    });
    for (const [i,stream] of [child.stdout,child.stderr].entries()) {
      if (!stream) { errors.push(new Error('missing owned stream')); continue; }
      try {
        stream.on('error',e=>errors.push(e)); stream.on('end',()=>{eof[i]=true;});
        stream.on('data',value=>{
          try { total+=value.length;
            if (total<=1_048_576) chunks[i].push(value); else overflow=true;
          } catch(error) { errors.push(error); }
        });
      } catch(error) { errors.push(error); }
    }
  });
}
function directoryGuard(path, checks, strict=false) {
  const stat = fs.lstatSync(path,{bigint:true});
  assert.ok(stat.isDirectory());
  if (strict) { assert.equal(stat.uid,501n); assert.equal(stat.mode & 0o777n,0o700n); }
  const check = () => {
    const actual = fs.lstatSync(path,{bigint:true});
    assert.ok(actual.isDirectory());
    for (const key of ['dev','ino','uid','gid','mode']) assert.equal(actual[key],stat[key]);
  };
  checks.push(check); check();
}
function parseTrace(value) {
  assert.ok(value.endsWith('\n')); const lines = value.slice(0,-1).split('\n');
  assert.equal(lines.shift(),'fault:0','native instrumentation fault');
  const events = [], images = [];
  for (const line of lines) {
    if (line.startsWith('event:')) events.push(line.slice(6));
    else {
      const match = /^image:(create|set|throw|register|version)\t([1-9][0-9]*)\t([^\t\n]+)$/.exec(line);
      assert.ok(match,'native trace structure'); images.push({name:match[1],count:Number(match[2]),path:match[3]});
    }
  }
  assert.ok(events.length <= 16); assert.ok(images.length<=5);
  // Deliberately no full semantic sequence rejection here: omission must reach
  // the unchanged consumer's callback-entry assertion, not a helper fault.
  return {events,images,callbackEntries:events.filter(e=>e==='callback-entry').length};
}

async function invokeInertInitializer(mode) {
  assert.ok(['baseline','omission','native-message','argv'].includes(mode));
  const held = [], checks = [], failures = [];
  let result;
  try {
    let original, entry;
    try { original = hold(sourcePath,null,501); held.push(original);
      entry = hold(entryPath,null,501); held.push(entry);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      return {availability:'source-unavailable'};
    }
    assert.equal(original.sha,'cbafba3ddb96857d9e61ad34671121a9afcd2f80a9f03d251fab50eca1303c04',
      'historical S1 source epoch only; use the guarded recipe');
    assert.equal(process.platform,'darwin'); assert.equal(process.getuid(),501);
    assert.equal(process.geteuid(),501);
    held.push(hold(fileURLToPath(import.meta.url),null,501));
    for (const [relative,inode,sha] of IMAGE_PINS) held.push(hold(CELLAR+relative,sha,501,inode));
    for (const [relative,inode,target] of SELECTORS) {
      const path = '/opt/homebrew/'+relative, stat = fs.lstatSync(path,{bigint:true});
      assert.ok(stat.isSymbolicLink()); assert.equal(stat.ino,BigInt(inode));
      assert.equal(stat.uid,501n); assert.equal(stat.gid,80n); assert.equal(stat.nlink,1n);
      assert.equal(fs.readlinkSync(path),target);
      checks.push(()=>{assert.ok(same(stat,fs.lstatSync(path,{bigint:true})));
        assert.equal(fs.readlinkSync(path),target);});
    }
    const directories = new Set();
    for (const item of held) {
      const parts = item.path.split('/').filter(Boolean); let parent='';
      for (const part of parts.slice(0,-1)) { parent += '/'+part; directories.add(parent); }
    }
    for (const path of directories) directoryGuard(path,checks);
    for (const [path,sha] of [
      [CLANG,'f30550eab15fdf5ab8c0dc54c52679711241e5d4b636b027e18c09fef531775d'],
      [LD,'28d85b9af18c923db12e0b4ce70b80ee217f2b7cade0e872baa9e8ddc396c08d'],
      [CLT+'/usr/share/man/man1/ld.1','8570994697756ef9bf0146983a6971892d99cb830a2b36f93fb0d049835e81d5'],
      [NM,'9097f9662024989b801a1448eea2a71a4e916537a595cbaf34d4d051480236f6'],
      [OTOOL,'61ff2c63cf68eeeadf9c4700dadb8271740ff4960f98500f30db82b31521c0de'],
      [SDK+'/SDKSettings.json','f8d005f09381389167f9e0aeaa169bc9e7dff162ef22ca2fd8e98df7ff1acafe'],
      [SDK+'/usr/lib/libSystem.B.tbd','20cfce043f11a083e2eb6111efe3579919a8082fa4cc912a7bd839af2010ec57'],
      [SDK+'/usr/include/dlfcn.h','04294faa7f4d8f08cef5b11c0813595ba0e87aa345677576ff62423aefa77e33'],
      [SDK+'/usr/include/stdio.h','d2220614f42d3cb678ae0de176ba0ab3256e15fb45b3efdb5d17b8ac1f6a4b54'],
      [SDK+'/usr/include/stdlib.h','7995a2df951dd1fdbd9fd4ec38900b79ef1797655ff239728fdbac56bb9bd7ff'],
      [SDK+'/usr/include/string.h','4b1b9c05bfe370d423d7a6bf9e74b189bcc7f59c1cd97f23d6d94f2f3df6a4bc'],
      [SDK+'/usr/include/fcntl.h','289f3be20c07d8eae5589f43994cfdb5fb33b3b099a6aee67f63e00d90039a8f'],
      [SDK+'/usr/include/unistd.h','8d535079658f063bcef358ef4c1c1b52b8e88dacfc22cbf4db0f6bf8abe40637'],
    ]) held.push(hold(path,sha,0));
    for (const path of [CLT,CLT+'/usr/bin',SDK,SDK+'/usr/include',SDK+'/usr/lib',RESOURCE,RESOURCE+'/include'])
      directoryGuard(path,checks);
    const dir = fs.mkdtempSync('/private/tmp/setfarm-native-inert.');
    fs.chmodSync(dir,0o700); directoryGuard(dir,checks,true);
    const entryFile=dir+'/entry.cjs', addon=dir+'/initializer.node';
    let entryBytes=bytes(entry), cBytes=bytes(original);
    if (mode==='omission') {
      const anchor='addon.initialize();'; assert.equal(entryBytes.toString().split(anchor).length,2);
      entryBytes=Buffer.from(entryBytes.toString().replace(anchor,
        "throw Object.assign(new Error('cooperative transport unavailable'), {code:'ORIGIN_COOPERATIVE_TRANSPORT_UNAVAILABLE'});"));
    }
    if (mode==='native-message') {
      const anchor='"cooperative transport unavailable"'; assert.equal(cBytes.toString().split(anchor).length,2);
      cBytes=Buffer.from(cBytes.toString().replace(anchor,'"native refusal changed"'));
    }
    fs.writeFileSync(entryFile,entryBytes,{flag:'wx',mode:0o600});
    held.push(hold(entryFile,hash(entryBytes),501));
    let trace=null;
    if (mode!=='argv') {
      const copy=dir+'/initializer.c', object=dir+'/initializer.o';
      const compiled=Buffer.concat([Buffer.from(PREFIX+'\n'),cBytes,Buffer.from('\n'+SUFFIX)]);
      fs.writeFileSync(copy,compiled,{flag:'wx',mode:0o600});
      held.push(hold(copy,hash(compiled),501));
      const compile=await settled(CLANG,[
        '--no-default-config','--target=arm64-apple-macos26.5',
        '-resource-dir',RESOURCE,'-isysroot',SDK,'-integrated-as',
        '-nostdinc','-isystem',HEADERS,'-isystem',RESOURCE+'/include','-isystem',SDK+'/usr/include',
        '-fno-modules','-fno-lto','-fvisibility=hidden','-std=c11','-O0','-Wall','-Wextra','-Werror',
        '-c',copy,'-o',object],dir);
      assert.deepEqual(compile,{code:0,stdout:'',stderr:''}); held.push(hold(object,null,501));
      const link=await settled(CLANG,[
        '--no-default-config','--target=arm64-apple-macos26.5',
        '-resource-dir',RESOURCE,'-isysroot',SDK,'--ld-path='+LD,
        // Pinned installed ld defaults to undefined-error. Do not suppress
        // or ignore the warning for its redundant deprecated spelling.
        '-bundle','-fno-lto','-nostdlib','-Wl,-Z','-Wl,-syslibroot,'+SDK,
        object,LIBNODE,SDK+'/usr/lib/libSystem.B.tbd','-o',addon],dir);
      assert.deepEqual(link,{code:0,stdout:'',stderr:''}); held.push(hold(addon,null,501));
      const exports=await settled(NM,['-gjU',addon],dir); assert.equal(exports.code,0); assert.equal(exports.stderr,'');
      assert.deepEqual(exports.stdout.trim().split('\n').sort(),['_napi_register_module_v1','_node_api_module_get_api_version_v1']);
      const imports=await settled(NM,['-uj',addon],dir); assert.equal(imports.code,0); assert.equal(imports.stderr,'');
      const allowed=new Set(['_napi_create_function','_napi_set_named_property','_napi_throw_error','__Exit',
        '_atexit','_dladdr','_open','_fdopen$DARWIN_EXTSN','_close','_fclose','_fprintf','_strcmp',
        '_memcpy','___stack_chk_fail','___stack_chk_guard']);
      // Observed SDK alias and compiler-generated copy/stack-protection imports
      // remain enabled; never disable protection or permit dynamic lookup.
      assert.deepEqual(imports.stdout.trim().split('\n').sort(),[...allowed].sort(),
        'exact instrumented derivative imports');
      const dependencies=await settled(OTOOL,['-L',addon],dir); assert.equal(dependencies.code,0); assert.equal(dependencies.stderr,'');
      const names=dependencies.stdout.trim().split('\n').slice(1).map(line=>line.trim().split(' (')[0]).sort();
      assert.deepEqual(names,['/opt/homebrew/opt/node/lib/libnode.147.dylib','/usr/lib/libSystem.B.dylib']);
      const actual=await settled(NODE,[entryFile],dir);
      const traceFile=hold(dir+'/native-trace',null,501); held.push(traceFile);
      assert.equal(traceFile.stat.mode & 0o777n,0o600n,'private native trace permissions');
      assert.ok(traceFile.stat.size<=8192n); trace=parseTrace(bytes(traceFile).toString());
      for (const image of trace.images) {
        const expected=['create','set','throw'].includes(image.name)?LIBNODE:addon;
        assert.equal(fs.realpathSync(image.path),expected,'actual delegate/addon image');
        const expectedHeld=held.find(item=>item.path===expected); assert.ok(expectedHeld);
        assert.ok(same(fs.statSync(image.path,{bigint:true}),expectedHeld.stat)); expectedHeld.check();
      }
      result={availability:'inert-native-observed',...actual,trace,receipt:{dir,sourceHash:original.sha,
        entryHash:entry.sha,compiledSourceHash:hash(compiled),instrumented:true,mode}};
    } else {
      assert.equal(fs.existsSync(addon),false);
      const actual=await settled(NODE,[entryFile,'unexpected'],dir);
      assert.equal(fs.existsSync(addon),false); assert.equal(fs.existsSync(dir+'/native-trace'),false);
      result={availability:'inert-native-observed',...actual,trace:null,receipt:{dir,mode}};
    }
  } catch(error) { failures.push(error); }
  finally {
    for (const check of checks) try { check(); } catch(error) { failures.push(error); }
    for (const item of held) try { item.check(); } catch(error) { failures.push(error); }
    for (const item of held.reverse()) try { item.close(); } catch(error) { failures.push(error); }
    if (failures.length) throw new AggregateError(failures,'inert fixture failed; artifacts retained');
  }
  return result;
}
function assertBaseline(actual) {
  assert.equal(actual.availability,'inert-native-observed'); assert.equal(actual.code,2);
  assert.equal(actual.stdout,'');
  assert.equal(actual.stderr,'cooperative transport unavailable\n','native-error-message');
  assert.equal(actual.trace.callbackEntries,1,'native-callback-entry');
  assert.deepEqual(actual.trace.events,['create:0','set:0','callback-entry','throw:0','callback-return']);
  assert.deepEqual(actual.trace.images.map(i=>[i.name,i.count]),
    [['create',1],['set',1],['throw',1],['register',1],['version',1]]);
}
test('inert native initializer delegates actual callback and refuses',{skip:!enabled},async()=>{
  const actual=await invokeInertInitializer('baseline'); assertBaseline(actual);
  process.stdout.write(JSON.stringify(actual.receipt)+'\n');
});
test('inert initializer omission cannot substitute identical JavaScript stderr',{skip:!enabled},async()=>{
  const actual=await invokeInertInitializer('omission');
  assert.equal(actual.availability,'inert-native-observed');
  assert.deepEqual(actual.trace.events,['create:0','set:0']);
  assert.deepEqual(actual.trace.images.map(i=>[i.name,i.count]),
    [['create',1],['set',1],['register',1],['version',1]]);
  assert.throws(()=>assertBaseline(actual),error=>error.code==='ERR_ASSERTION' && error.message.startsWith('native-callback-entry'));
  process.stdout.write(JSON.stringify(actual.receipt)+'\n');
});
test('inert initializer native message mutation reaches real entry stderr',{skip:!enabled},async()=>{
  const actual=await invokeInertInitializer('native-message');
  assert.equal(actual.availability,'inert-native-observed');
  assert.equal(actual.stderr,'native refusal changed\n');
  assert.equal(actual.trace.callbackEntries,1);
  assert.deepEqual(actual.trace.events,['create:0','set:0','callback-entry','throw:0','callback-return']);
  assert.deepEqual(actual.trace.images.map(i=>[i.name,i.count]),
    [['create',1],['set',1],['throw',1],['register',1],['version',1]]);
  assert.throws(()=>assertBaseline(actual),error=>error.code==='ERR_ASSERTION' && error.message.startsWith('native-error-message'));
  process.stdout.write(JSON.stringify(actual.receipt)+'\n');
});
test('inert initializer extra argv refuses before loading absent addon',{skip:!enabled},async()=>{
  const actual=await invokeInertInitializer('argv');
  assert.equal(actual.availability,'inert-native-observed'); assert.equal(actual.code,2);
  assert.equal(actual.stdout,''); assert.equal(actual.stderr,'cooperative initializer argv refused\n');
  assert.equal(actual.trace,null); process.stdout.write(JSON.stringify(actual.receipt)+'\n');
});

// Independent finite guard characterization, NOT retained-owner restoration.
// PREFIX/SUFFIX and historical test bodies above are intentionally unchanged.
// Independently inventoried b22ef4 additions; not discovered by a test compile.
const GUARD_HEADER_ADDITIONS = `
R/stdbool.h|14827650|1172|48655faf4ebd4ca0af26a1ee8e3e16f8dc68385c9cd550ffb3629320681305b3
S/dlfcn.h|14866088|3218|04294faa7f4d8f08cef5b11c0813595ba0e87aa345677576ff62423aefa77e33
S/fcntl.h|14866107|1002|289f3be20c07d8eae5589f43994cfdb5fb33b3b099a6aee67f63e00d90039a8f
S/sys/fcntl.h|14867284|26949|805fd8c695f8e5e1c327b6852382cc5533738bbfd8f18bc11f850531166e4fe8
S/sys/_types/_mode_t.h|14867207|1465|7c4261bde41387fc23aefe5dee1e6298ae6b6f5592bca51947fdd9736e0640a6
S/sys/_types/_off_t.h|14867213|1460|7b07626d71084f1b3220e045089f54fd30f4d736be9cd0449042c5fe411fc569
S/sys/_types/_pid_t.h|14867216|1458|052a6dbbec8e30623c2d33dd373992f6c5d0c57c57ed4949d2b48c4ab0976487
S/sys/_types/_o_sync.h|14867212|1439|76de975c1a6a1c621851079934547a628665d15049a451dc6c7e2ddec779f1b0
S/sys/_types/_o_dsync.h|14867211|1441|47e59afa1ca0d9beeb20835cbf44ea9d6dddc5bd12822ca35c5c0fc21dd45c49
S/sys/_types/_seek_set.h|14867223|2123|353b2276ef8132f625b1b780e7593a43183fbf054c1bc906c0515f89dad335c8
S/sys/_types/_s_ifmt.h|14867221|3677|95154f4d16869867b303c173ed569ab17957fedb98ce7140583df75bcca2bd9e
S/sys/_types/_timespec.h|14867231|1552|3314f260a6b3ce09c02df185ba2253577b2a268dac05d3cad55f76bb3e8019e8
S/sys/_types/_filesec_t.h|14867185|1440|d5f38f0f50dad1020edf0594798912b34922397a1be0cd33e71e565cd46cf44e
S/stdio.h|14867141|3069|d2220614f42d3cb678ae0de176ba0ab3256e15fb45b3efdb5d17b8ac1f6a4b54
S/_stdio.h|14863746|20526|8417242466f6df6890587974393e97bb0aeac8caeb80cdf82a4e03a97e6d4660
S/sys/stdio.h|14867359|2415|a8078ae1cba1a46a66d0de6fe7f13bbc969cdb7e78fc2d4b9a5c5cdaaf16126b
S/_printf.h|14863743|1196|d90a7023063c22dfb77d3034163d2c35908f3103b458a83659b7f7b38d2d0cb2
S/_ctermid.h|14863656|1328|73ac20b763ff6e1c328563bbd125e3eaa78a367eb92c867626a047ae4ab391b3
S/sys/_types/_ssize_t.h|14867228|1473|58eb3bdea24b27e6b5fb45e203e476faf2510b5c0aa81a0b45c17b528aa9c192
S/secure/_stdio.h|14867076|4070|78633fd545a6a80e6e6c863e767936aed80009b92145e7db78c44441c71b92c3
S/secure/_common.h|14867075|1613|b1d2144ca87b151923029abde3e69b2430f2b39304837e2183b9019fc50a6e96
S/xlocale/_stdio.h|14867521|3790|3074e81ccbe591ac91d41864519cc8f8d5887e4e0ca1ad2524cee6a22b41b5b9
S/__xlocale.h|14863652|1303|c5af9f918506bc8ed9eaa3b9e895bacf4566d12086a22fae13308497b9c2054b
S/_mb_cur_max.h|14863662|1228|bfcdbdea8a728e790ca47166549ffc4fd159dd1ff3af6170ad202a1ebb6127dc
S/_types/_locale_t.h|14863756|1508|3d17f3d35fad80f35b95ab53360a1362b701d1056120f5008a54166a810ca511
S/stdlib.h|14867142|2980|7995a2df951dd1fdbd9fd4ec38900b79ef1797655ff239728fdbac56bb9bd7ff
S/_stdlib.h|14863748|17302|2ba48edd8a9a0445a2a642b4c2cb73cc14f2fb32208ea43ef29c496f7b01d0ba
S/sys/wait.h|14867398|10352|b77f7dd6f592eba8b0d51c15c7b975472fdad50c12ea296f74f062cbf98dcbf7
S/sys/_types/_id_t.h|14867193|1494|fb7255c9872e2a805c206796326e21d47146e22c93c09752126d7166bdaba5e5
S/sys/signal.h|14867347|16829|319fbc4555c1d39c95d8a5e3034956bfe8e0e1bd9142df95ab71ad3ac8bb1f54
S/machine/signal.h|14866563|1614|09b1798034cf3b5217df3e415d6053df9c2e16b858036fc11888e63f4493f53f
S/i386/signal.h|14866163|1675|e44703be27d4b669d69757b811cd54b908bd129449a52e254d19b3b2ba145a68
S/arm/signal.h|14864024|393|de0bc923b92bd88f3bd8bcd38b20f8123277732d7d3309cb2a5bdc60bb4dd8c6
S/machine/_mcontext.h|14866554|1630|9d3425653d2a1623d785dee4601c3c00e05f4797d7e840b00f17d529f8c6c51e
S/i386/_mcontext.h|14866154|6277|5b045b513673ffe42a8b3ec2c9c0a7e75ed107e48cbcc30e65724695d4ca744c
S/mach/machine/_structs.h|14866457|1633|410350f04225bf139bd89f1a99418a55734e4ab2101bb93dc301f790a130f59c
S/mach/i386/_structs.h|14866408|43946|6003cc7f64c45d144be10f5ddb270e0133e0e94f852a98be9a78771dd442ab03
S/mach/arm/_structs.h|14866358|32091|30e201a2bf77b2b09163250db64760f303903590904a3daabd9b96cbcba19b7e
S/arm/_mcontext.h|14864014|2963|6af56aec1a82613dbd54b09d95eaf96fa7b9443a4cf4c7e9ba689f6de6047186
S/sys/_pthread/_pthread_attr_t.h|14867154|1522|987973d4e4f0c84a929fb1288755637453d88bf1410b778f81b2550ea4ad211c
S/sys/_types/_sigaltstack.h|14867224|1992|2bc87d34186fe6524fe89fa1e2d878462c6688134d03880b8bfa1486db297687
S/sys/_types/_ucontext.h|14867242|2466|d67fecbd5fba1fc876b41b0a69ff080e3d47c9884f3ea4012f8a334ffda62681
S/sys/_types/_sigset_t.h|14867225|1483|df99c73ecdbde1fcb3a4a22169871e036240452472b8ea70f287456d42593972
S/sys/_types/_uid_t.h|14867244|1458|d2140a65a17943a857381757c0b73a920f35ade41dc9809437c168be457c276a
S/sys/resource.h|14867338|20152|7d16930e6b75f11ba203238faa5580d31d48fcd4230f2b3f604aaa5fd7e86b58
S/sys/_types/_timeval.h|14867232|1667|f723018fec267200e915777897515b5d7ed20901bcb294873f94b1d835f9ae45
S/machine/endian.h|14866558|1680|37f9e1c8599a729e605477a5b6a77cea727fa66816e4585d0dd32e3ba377f450
S/i386/endian.h|14866158|3898|fd6f9b2e3b397eecb37822ee2c18c79ea78794c60a2b9d93f645fc99a844e827
S/sys/_endian.h|14867151|6555|fcb57b694d555b2a8646e35bc68cc6864deecbc8d5528cd40bf764b1ff14d3fd
S/machine/_endian.h|14866552|1685|17eb7d38845502ce04aac3ab709dffeb4ec253781051b5d7894703e9786730de
S/i386/_endian.h|14866152|5070|31eb3fb3163bc92ba425c93e748398ed4458ae6fdce05179208bd9cdd5e04790
S/sys/__endian.h|14867150|5302|8697850f0ec13e9082081e9b8dda8f94053970f3546e4a8d42738b16400eac91
S/arm/_endian.h|14864012|5063|488530aceccfa1f364f2850a5f2956e22436db8b12b33d2a41567c4ac9d60788
S/libkern/_OSByteOrder.h|14866230|3989|f0febaef6f9ec75339ebdd896dab2a6d1a1934628d76098f165f1db1b4b74c14
S/libkern/i386/_OSByteOrder.h|14866236|2830|1114ce25796b6a04172f4372bf6c2e6c9d5e65919364ed12911d85ed928aaa7d
S/libkern/arm/_OSByteOrder.h|14866233|2801|7c686aa04afa38a20a0163eccca9941aeb8328779884c2603d8a9a773896a677
S/arm/endian.h|14864019|2622|60bd5d1363d89d52e5cfc95b83a35d392a8315835f9d60089d4e05b8f4d1cc68
S/alloca.h|14863770|1450|5e956d0cffbf6d069d2cc9cee52686e1e7b73e3e2939cfb3fd3a7ca096bd8980
R/limits.h|14827533|3794|6b59cc1b6f86c901bf41ce942b8434530e852eb16e79e6e9287f89441f71efca
S/limits.h|14866328|5910|4e09d7a2307887fe787c65e31d63747720c4d462b7ba3bf8f45e401d74f0b246
S/sys/syslimits.h|14867365|6296|170629c923b4ef2b7132dc8a9d71e9f010332bada56363f619b7c758e17d2c83
S/sys/_types/_ct_rune_t.h|14867175|1474|17b8b91c92c4929111a4e854a38a04c3d07fe0da2a31f3692e1407db6a69de63
S/sys/_types/_rune_t.h|14867220|1455|36cd7e6c6ce34e125b4c52f005262d38eba8ef8486c7cac7adedcc5d37cc3b49
S/malloc/_malloc.h|14866567|7171|ca53f7051fd1d227700561e3748fa8080052ba46e65cd2ad6ea65aeaca42fe6e
S/malloc/_malloc_type.h|14866568|9884|d06817cfa17ae797b8ed1be7799ce8be1e3dac5362db10e2035975dd7142a198
S/malloc/_ptrcheck.h|14866570|1459|d3c4e809117b24467e9313cc348c0495aad8780cea6bf58177743b9be09c3591
S/_abort.h|14863653|1163|ad37627745fd324a640fa93c5f9909250c036d577457090a1e72ee939cd7fc7b
S/sys/_types/_dev_t.h|14867176|1481|4ba3d19759544b9f7bf424d2a16a518ff586e31ed968d525440e678cfbb07a5d
S/xlocale/_stdlib.h|14867522|2960|36eb62f47d4c269558d9c815870aae03a0b78f6f69a772e8d3e4ec1d4741208e
S/string.h|14867144|2975|4b1b9c05bfe370d423d7a6bf9e74b189bcc7f59c1cd97f23d6d94f2f3df6a4bc
S/_string.h|14863750|9281|18ce21b76c6876087aae9053dcdb81182adbdb0405afc82f36d8edc000c06b3a
S/sys/_types/_errno_t.h|14867177|1422|ca230b22b22becab1bb191bfe5a8dd4595ea0566f5c8cc9b299eca308ee5a271
S/_strings.h|14863751|4401|76b984c39538b145bcb8a930538e07ce446e9d4ace00916d6110c775151d800e
S/secure/_strings.h|14867078|2667|d635b58e48cb88db18226bab8a3588505d07dcae8820d2244902242f9406c65e
S/secure/_string.h|14867077|9919|66ece2d83b7528b0eb85a1f82c8aab0465cbd074397ea1aa6155706a0244cc67
S/xlocale/_string.h|14867523|1593|30d313d69ccba21dd6a92e9568d8b0004a363745f7a61b03616bd327b5c15ed2
S/unistd.h|14867477|31225|8d535079658f063bcef358ef4c1c1b52b8e88dacfc22cbf4db0f6bf8abe40637
S/sys/unistd.h|14867384|9677|a3c7d6da838b8858cf04711dcbbab6e28fa5a58cc72175fcf4366158f548369a
S/sys/_types/_posix_vdisable.h|14867217|1433|f32872a8af4cfb71be9ca5bcd356241badadceba195d55907129425bc239c222
S/sys/_types/_gid_t.h|14867190|1438|e687ad58c03701c132a02ebf20699c8cacfd34c3a67271bd2a415a5a8e4a9ea7
S/sys/_types/_useconds_t.h|14867246|1484|37c49808a92cc4417181adb1530cc24ca11cc89f064c6c0494a1aff981f92870
S/sys/select.h|14867343|5366|cffe3e51c7c6c6ef68750cc85f7ddc1b7b4be041a4bbb47fd19914125bf1b6df
S/sys/_types/_fd_def.h|14867180|4422|feea8c758abe49372bcf3ab7dd9b0391d02269e4a531ef838895e961e9f43f30
S/sys/_types/_time_t.h|14867230|1468|c0a28cdc5c9c8cf99abea53556895bd8001a6cb13ae6ca9f366955500678b35a
S/sys/_types/_suseconds_t.h|14867229|1490|d799ffc16cf29b6559b36d879fc7d5fec80ec3c39502eaef078ae9178eeaf275
S/sys/_types/_fd_setsize.h|14867183|1444|7cd3a93f51f4521e60151c08b1fab36ea8efbb98988bb03db24264a1c434eaee
S/sys/_types/_fd_set.h|14867182|1438|57009e7fed060e007604e0259788a7bea6afcb18fc4840fc30cd641f58655190
S/sys/_types/_fd_clr.h|14867178|1438|ccb785f37fdf5503df860a3fba82d8570a65f7ecbd754a5558254483b996747c
S/sys/_types/_fd_isset.h|14867181|1444|17bdc86c26b6c82411601e955af5e2563a86f2fdd345568b78ab8642b895d1ae
S/sys/_types/_fd_zero.h|14867184|1438|e5c44af3534182fe3b0872f39617ae17cd2ada72339e6f388eead5472df64c6f
S/sys/_types/_fd_copy.h|14867179|1441|f4f4289b3da098621b7ed0115faa7d4b85b65852c4615c9bad5e222a8ceb0078
S/sys/_select.h|14867165|2468|23e013274b46f4eb46aae8492206ed2862ea6c998e28e793427f38a5e499bb6d
S/sys/_types/_uuid_t.h|14867247|1456|ba8364ff4aed847f5ca3259e27fc2d1920432d02e8e79c7ac57ec043f1dc2842
S/gethostuuid.h|14866129|1944|0a4f4be11c5503f991d5e44f38ee8d50d8b5d4dbfaa5d0da361027968ea4d2c8
S/pthread/pthread.h|14866987|28093|9d621c730d1d96b600893b0e3e4c45822a24d565e7b6b166973c41a6a2eb02e7
S/pthread/sched.h|14866992|1410|07d65b8d135be978a33579b5a333bd4576a8c6b36351ef510e0cca2aa0987020
S/pthread/pthread_impl.h|14866989|1977|42896cbc575d9099c53f8c0afbaa04f40b2d11d24f92af5ccd7dacdaf8690231
S/time.h|14867425|3275|cf4912303943c5bda8404f5fd7a2a8219153353a49df2aeaddbb2dcd4b35c0bf
S/_time.h|14863752|8243|a3dceadf2c95133018af363187829ca072d85a93d69f9682a2e4fb993902f28d
S/sys/_types/_clock_t.h|14867174|1472|e7be094e48f450875288ef68a59409e530dbe2d9449c78ff3d9ea9d654e0e857
S/machine/_limits.h|14866553|1619|5afb73827b325312488c62d0f45644eeee297d732b097a3eef0fc54a44924578
S/xlocale/_time.h|14867524|1568|1f2f8844b8a5877c3ca553d9f7c6f1fecc73c4d0914d27e657e3d0f993135e5f
S/sys/_pthread/_pthread_cond_t.h|14867155|1521|1f44e579de86408da3f83e47918e11d62d41fdce1c0230a7e30f5c56414ef914
S/sys/_pthread/_pthread_condattr_t.h|14867156|1545|167ad51c9e184c2f22e67dd7100e321305b11b3fe2cbeffd074015f20ce4e315
S/sys/_pthread/_pthread_key_t.h|14867157|1515|aa386e8d73d64c95432c42133e1ce1a0f4e6b5769a4720ad38c81c71355e12b9
S/sys/_pthread/_pthread_mutex_t.h|14867158|1526|9af87ec733f482f5bb59ff9c49b7884c6fd58444669fac8e64525da82f03cc91
S/sys/_pthread/_pthread_mutexattr_t.h|14867159|1551|93686494113a5167f198d6a586c1ac1c5f87eb0ef5751b9c441db52df0e9edd9
S/sys/_pthread/_pthread_once_t.h|14867160|1521|5ea5cc064b4770a6c776a0c84f9458f8089540a62244417de37309aa72c89fc9
S/sys/_pthread/_pthread_rwlock_t.h|14867161|1533|1e20731f227b6c0c83d149c9564bceaa62220128d81c04833abd835d469115c7
S/sys/_pthread/_pthread_rwlockattr_t.h|14867162|1557|f60fae1acfd6742846ffdd7a07a47996caab73ac12bb421b49a4aae3edb80d66
S/sys/_pthread/_pthread_t.h|14867163|1491|7bcef3e2436e7a96bf0201e99bad5a11e6d495dbac85b10207441c05d7fb461e
S/pthread/qos.h|14866991|10256|bfcfcf23501c328f5aa7f3bb39c0c8167730ab111393063c5b5fb4bd72d074f2
S/sys/qos.h|14867331|7884|3f1e1e9a2b707f22407df44ee8a8b270348d3b4b53313ec52d06a6198716e273
S/signal.h|14867100|5475|df78bfe0b6769e65ee187814d1f5eeb1bd87b6e7eeac96170b2ecfda231df3d0
`.trim();
const GUARD_HEADER_644 = new Set(`R/stdbool.h R/limits.h S/dlfcn.h S/gethostuuid.h
S/malloc/_malloc.h S/malloc/_malloc_type.h S/malloc/_ptrcheck.h
S/pthread/pthread.h S/pthread/sched.h S/pthread/pthread_impl.h S/pthread/qos.h S/sys/qos.h
S/sys/_pthread/_pthread_attr_t.h S/sys/_pthread/_pthread_cond_t.h
S/sys/_pthread/_pthread_condattr_t.h S/sys/_pthread/_pthread_key_t.h
S/sys/_pthread/_pthread_mutex_t.h S/sys/_pthread/_pthread_mutexattr_t.h
S/sys/_pthread/_pthread_once_t.h S/sys/_pthread/_pthread_rwlock_t.h
S/sys/_pthread/_pthread_rwlockattr_t.h S/sys/_pthread/_pthread_t.h`.split(/\s+/));
const GUARD_PREFIX = String.raw`
#include <pthread.h>
#include <signal.h>
typedef struct {
    const char *name;
    int arg, rc, valid, old, same_thread, active, null_set, nonnull_out;
} guard_event;
static guard_event guard_events[8];
static unsigned guard_count;
static int guard_fault, guard_active;
static pthread_t guard_thread;
static napi_callback guard_original;
static char guard_images[4][1024];
static unsigned guard_image_counts[4];
static int guard_same_thread(void) {
    return pthread_equal(guard_thread, pthread_self()) != 0;
}
static void guard_record(const char *name, int arg, int rc, int valid, int old,
                         int null_set, int nonnull_out) {
    int same_thread = guard_same_thread();
    if (!same_thread) guard_fault = 1;
    if (guard_count >= 8) { guard_fault = 1; return; }
    guard_events[guard_count++] = (guard_event){name,arg,rc,valid,old,
        same_thread,guard_active,null_set,nonnull_out};
}
static int guard_cancel(const char *name, int state, int *old_state) {
    int rc = pthread_setcancelstate(state, old_state);
    int valid = rc == 0 && old_state != NULL;
    guard_record(name,state,rc,valid,valid ? *old_state : 0,-1,old_state != NULL);
    return rc;
}
static __attribute__((used)) int guard_production_cancel(int state, int *old_state) {
    if (!guard_active) guard_fault = 1;
    return guard_cancel("cancel",state,old_state);
}
static __attribute__((used)) int guard_production_mask(int how,
                                      const sigset_t *set, sigset_t *old_set) {
    if (!guard_active) guard_fault = 1;
    int rc = pthread_sigmask(how,set,old_set);
    /* Capture no opaque mask bytes and never inspect an unsuccessful output. */
    guard_record("mask",how,rc,0,0,set == NULL,old_set != NULL);
    return rc;
}
static napi_value guard_trampoline(napi_env env, napi_callback_info info) {
    if (guard_count || guard_active || !guard_original) _Exit(73);
    guard_thread = pthread_self();
    int harness_saved, previous;
    if (guard_cancel("prepare",GUARD_PREP,&harness_saved) != 0 ||
        (harness_saved != PTHREAD_CANCEL_ENABLE &&
         harness_saved != PTHREAD_CANCEL_DISABLE)) _Exit(73);
    guard_active = 1;
    guard_record("guard-enter",-1,-1,0,0,-1,0);
    napi_value result = guard_original(env,info);
    guard_record("guard-leave",-1,-1,0,0,-1,0);
    guard_active = 0;
    if (guard_cancel("harness-restore",harness_saved,&previous) != 0 ||
        previous != GUARD_PREP) _Exit(73);
    if (result != NULL) guard_fault = 1;
    return result;
}
static napi_status guard_create(napi_env env, const char *name, size_t len,
                        napi_callback cb, void *data, napi_value *result) {
    if (guard_original || !cb) { guard_fault = 1; _Exit(73); }
    guard_original = cb;
    return real_create(env,name,len,guard_trampoline,data,result);
}
static void guard_observe_image(unsigned slot, const void *address) {
    Dl_info image;
    guard_image_counts[slot]++;
    if (!dladdr(address,&image) || !image.dli_fname || !image.dli_fbase) {
        guard_fault = 1; return;
    }
    unsigned i;
    for (i = 0; i < 1023 && image.dli_fname[i]; i++) {
        if (image.dli_fname[i] == '\n' || image.dli_fname[i] == '\t') guard_fault = 1;
        guard_images[slot][i] = image.dli_fname[i];
    }
    guard_images[slot][i] = '\0';
    if (image.dli_fname[i]) guard_fault = 1;
}
static void guard_finish(void) {
    const char *names[4] = {"cancel","mask","self","equal"};
    int fd = open("guard-trace",O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW,0600);
    if (fd < 0) _Exit(73);
    FILE *trace = fdopen(fd,"w");
    if (!trace) { if (close(fd) != 0) _Exit(74); _Exit(73); }
    int failed = 0;
    if (fprintf(trace,"fault:%d\n",guard_fault) < 0) failed = 1;
    for (unsigned i = 0; i < guard_count; i++) {
        guard_event e = guard_events[i];
        if (fprintf(trace,"event:%s\t%d\t%d\t%d\t%d\t%d\t%d\t%d\t%d\n",
            e.name,e.arg,e.rc,e.valid,e.old,e.same_thread,e.active,
            e.null_set,e.nonnull_out) < 0) failed = 1;
    }
    for (unsigned i = 0; i < 4; i++)
        if (guard_image_counts[i] && fprintf(trace,"image:%s\t%u\t%s\n",
            names[i],guard_image_counts[i],guard_images[i]) < 0) failed = 1;
    if (fclose(trace) != 0) failed = 1;
    if (failed) _Exit(73);
}
static __attribute__((constructor)) void guard_setup(void) {
    /* Loader observations precede fixture preparation, not the guard interval. */
    guard_observe_image(0,(const void *)pthread_setcancelstate);
    guard_observe_image(1,(const void *)pthread_sigmask);
    guard_observe_image(2,(const void *)pthread_self);
    guard_observe_image(3,(const void *)pthread_equal);
    if (atexit(guard_finish) != 0) _Exit(73);
}
#undef napi_create_function
#define napi_create_function guard_create
#define pthread_setcancelstate guard_production_cancel
#define pthread_sigmask guard_production_mask
`;

function parseGuardTrace(value) {
  assert.ok(value.endsWith('\n'), 'guard trace final newline');
  const lines = value.slice(0,-1).split('\n');
  assert.equal(lines.shift(),'fault:0','guard instrumentation fault');
  const events=[],images=[];
  for (const line of lines) {
    const event=/^event:(prepare|guard-enter|cancel|mask|guard-leave|harness-restore)\t(-?[0-9]+)\t(-?[0-9]+)\t([01])\t(-?[0-9]+)\t([01])\t([01])\t(-1|0|1)\t([01])$/.exec(line);
    if (event) {
      const [arg,rc,valid,old,sameThread,active,nullSet,nonnullOut]=event.slice(2).map(Number);
      assert.ok([arg,rc,old].every(Number.isSafeInteger),'bounded guard integers');
      events.push({name:event[1],arg,rc,valid,old,sameThread,active,nullSet,nonnullOut});
      continue;
    }
    const image=/^image:(cancel|mask|self|equal)\t([1-9][0-9]*)\t([^\t\n]+)$/.exec(line);
    assert.ok(image,'guard trace structure');
    images.push({name:image[1],count:Number(image[2]),path:image[3]});
  }
  assert.ok(events.length<=8); assert.ok(images.length<=4);
  return {events,images}; // Empty production list must reach the real consumer.
}
class GuardWitnessMissing extends Error {
  constructor() { super('actual callback guard witnesses missing'); this.name='GuardWitnessMissing'; }
}
function assertGuardTransaction(trace, mode) {
  assert.ok(mode==='disabled'||mode==='enabled');
  const wanted=mode==='disabled'?0:1;
  assert.deepEqual(trace.images.map(i=>[i.name,i.count,i.path]),
    ['cancel','mask','self','equal'].map(name=>[name,1,'/usr/lib/system/libsystem_pthread.dylib']));
  for(const e of trace.events) assert.equal(e.sameThread,1,'same real invocation thread');
  const outer=trace.events.filter(e=>e.name!=='cancel'&&e.name!=='mask');
  assert.deepEqual(outer.map(e=>e.name),['prepare','guard-enter','guard-leave','harness-restore']);
  const [prepare,enter,leave,restore]=outer;
  assert.equal(prepare.arg,wanted); assert.equal(prepare.rc,0); assert.equal(prepare.valid,1);
  assert.ok(prepare.old===0||prepare.old===1); assert.equal(prepare.active,0);
  assert.equal(prepare.nonnullOut,1); assert.equal(prepare.nullSet,-1);
  for(const e of [enter,leave]) assert.deepEqual(
    [e.arg,e.rc,e.valid,e.old,e.active,e.nullSet,e.nonnullOut],[-1,-1,0,0,1,-1,0]);
  assert.deepEqual([restore.arg,restore.rc,restore.valid,restore.old,restore.active,restore.nullSet,restore.nonnullOut],
    [prepare.old,0,1,wanted,0,-1,1]);
  const production=trace.events.filter(e=>e.name==='cancel'||e.name==='mask');
  if(production.length===0) {
    assert.deepEqual(trace.events.map(e=>e.name),['prepare','guard-enter','guard-leave','harness-restore']);
    throw new GuardWitnessMissing();
  }
  assert.deepEqual(trace.events.map(e=>e.name),
    ['prepare','guard-enter','cancel','mask','cancel','guard-leave','harness-restore']);
  assert.deepEqual(production.map(e=>[e.arg,e.rc,e.valid,e.old,e.active,e.nullSet,e.nonnullOut]),
    [[0,0,1,wanted,1,-1,1],[3,0,0,0,1,1,1],[wanted,0,1,0,1,-1,1]]);
}

function guardMaterial(stat) {
  return Object.fromEntries(fields.map(key=>[key,String(stat[key])]));
}
function guardHold(path, {sha,uid,inode,size,mode,limit=1_048_576}={}) {
  const fd=fs.openSync(path,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW|fs.constants.O_NONBLOCK);
  let closed=false;
  try {
    const stat=fs.fstatSync(fd,{bigint:true});
    assert.ok(stat.isFile());assert.equal(stat.nlink,1n);
    assert.equal(stat.uid,BigInt(uid));assert.equal(stat.mode & 0o022n,0n);
    if(inode!==undefined)assert.equal(stat.ino,BigInt(inode));
    if(size!==undefined)assert.equal(stat.size,BigInt(size));
    if(mode!==undefined)assert.equal(stat.mode & 0o777n,BigInt(mode));
    assert.ok(stat.size<=BigInt(limit),'bounded held input: '+path);
    const actual=digest(fd,Number(stat.size));if(sha)assert.equal(actual,sha,'guard input digest: '+path);
    const first={path,sha:actual,acquiredAt:new Date().toISOString(),...guardMaterial(stat)};
    const check=()=>{
      assert.equal(closed,false,'original descriptor remains held');
      assert.ok(same(stat,fs.fstatSync(fd,{bigint:true})));
      assert.ok(same(stat,fs.lstatSync(path,{bigint:true})));
      assert.equal(digest(fd,Number(stat.size)),actual);
      assert.ok(same(stat,fs.fstatSync(fd,{bigint:true})));
      assert.ok(same(stat,fs.lstatSync(path,{bigint:true})));
    };
    check();
    return {path,fd,stat,sha:actual,first,check,read(){
      check();const value=Buffer.alloc(Number(stat.size));let offset=0;
      while(offset<value.length){const n=fs.readSync(fd,value,offset,value.length-offset,offset);assert.ok(n>0);offset+=n;}
      assert.equal(hash(value),actual);check();return value;
    },close(){assert.equal(closed,false,'checked once close');fs.closeSync(fd);closed=true;}};
  } catch(error) {
    try {assert.equal(closed,false);fs.closeSync(fd);closed=true;}
    catch(cleanup){throw new AggregateError([error,cleanup],'held descriptor close failure');}
    throw error;
  }
}
function guardSpawn(command,args,cwd) {
  return new Promise(resolve=>{
    const startedAt=new Date().toISOString(),errors=[],chunks=[[],[]],eof=[false,false];
    let exit=null,total=0,overflow=false;
    const child=spawn(command,args,{cwd,shell:false,env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C',TMPDIR:cwd},
      stdio:['ignore','pipe','pipe']});
    child.on('error',error=>errors.push(String(error)));
    child.on('exit',(code,signal)=>{exit={code,signal};});
    child.on('close',(code,signal)=>resolve({command,args,startedAt,settledAt:new Date().toISOString(),
      code,signal,exit,close:{code,signal},eof,overflow,errors,
      stdout:Buffer.concat(chunks[0]).toString(),stderr:Buffer.concat(chunks[1]).toString()}));
    for(const [i,stream]of[child.stdout,child.stderr].entries()) {
      if(!stream){errors.push('missing original process stream');continue;}
      stream.on('error',error=>errors.push(String(error)));
      stream.on('end',()=>{eof[i]=true;});
      stream.on('data',chunk=>{total+=chunk.length;if(total<=1_048_576)chunks[i].push(chunk);else overflow=true;});
    }
  });
}
function assertGuardSettlement(actual) {
  assert.deepEqual(actual.errors,[]);assert.equal(actual.overflow,false);
  assert.deepEqual(actual.exit,actual.close);assert.equal(actual.signal,null);
  assert.deepEqual(actual.eof,[true,true]);
}
async function invokeGuardInitializer(mode) {
  assert.ok(['guard-disabled','guard-enabled','guard-omission'].includes(mode));
  const held=[],checks=[],failures=[],processes=[],aliases=[],artifacts=[],ancestors=[];
  let closed=0,result,dir=null,fixture=null;
  const receipt={kind:'finite-callback-guard-FIRST',mode,startedAt:new Date().toISOString(),
    ownerAuthority:false,retentionQualified:false,processes,aliases,artifacts,ancestors};
  const acquire=(path,expected)=>{const item=guardHold(path,expected);held.push(item);return item;};
  const produced=(path,expected)=>{
    try{const item=acquire(path,expected);artifacts.push(item.first);return item;}
    catch(error){if(error.code==='ENOENT'){artifacts.push({path,absentAt:new Date().toISOString()});return null;}throw error;}
  };
  const settle=async(command,args)=>{precheck();const actual=await guardSpawn(command,args,dir);processes.push(actual);return actual;};
  const precheck=()=>{
    assert.equal(new Set(held.map(item=>item.fd)).size,held.length,'distinct original descriptors');
    for(const check of checks)check();for(const item of held)item.check();
  };
  const alias=(path,inode,target,uid,gid,size,mtimeNs,ctimeNs)=>{
    const stat=fs.lstatSync(path,{bigint:true});assert.ok(stat.isSymbolicLink());
    assert.equal(stat.ino,BigInt(inode));assert.equal(stat.uid,BigInt(uid));assert.equal(stat.gid,BigInt(gid));
    assert.equal(stat.nlink,1n);assert.equal(fs.readlinkSync(path),target);
    if(size!==undefined)assert.equal(stat.size,BigInt(size));
    if(mtimeNs!==undefined)assert.equal(stat.mtimeNs,BigInt(mtimeNs));
    if(ctimeNs!==undefined)assert.equal(stat.ctimeNs,BigInt(ctimeNs));
    const resolved=fs.realpathSync(path);aliases.push({path,target,resolved,...guardMaterial(stat)});
    checks.push(()=>{assert.ok(same(stat,fs.lstatSync(path,{bigint:true})));
      assert.equal(fs.readlinkSync(path),target);assert.equal(fs.realpathSync(path),resolved);});
  };
  try {
    assert.equal(process.platform,'darwin');assert.equal(process.getuid(),501);assert.equal(process.geteuid(),501);
    assert.equal(fs.realpathSync(process.execPath),NODE,'fixed test runtime');
    const source=acquire(sourcePath,{uid:501}),entry=acquire(entryPath,{uid:501,
      inode:216276871,sha:'bd83726b1f9270eec4cb1eddb929e97ae767f525a1cdab0003257729dd552c94'});
    const self=acquire(fileURLToPath(import.meta.url),{uid:501});
    const inventory=acquire(fileURLToPath(new URL('./task6a-origin-native-continuity-frame-v2.test.js',import.meta.url)),
      {uid:501,inode:216283209,size:60175,sha:'54575f8e27cfcd4ed33bca4a08206e191a09f89af66ffa0e44417482411548b7'});
    assert.equal(IMAGE_PINS.length,30);assert.equal(SELECTORS.length,38);
    for(const [relative,inode,sha]of IMAGE_PINS)acquire(CELLAR+relative,{uid:501,inode,sha,limit:100_000_000});
    for(const [relative,inode,target]of SELECTORS)alias('/opt/homebrew/'+relative,inode,target,501,80);
    alias(SDK+'/usr/include/pthread.h',14866985,'pthread/pthread.h',0,0,17,
      '1782608311515232577','1782608364253587548');
    const tools=[
      [CLANG,14827087,290664032,'f30550eab15fdf5ab8c0dc54c52679711241e5d4b636b027e18c09fef531775d'],
      [LD,14827148,4953232,'28d85b9af18c923db12e0b4ce70b80ee217f2b7cade0e872baa9e8ddc396c08d'],
      [NM,14827169,33125008,'9097f9662024989b801a1448eea2a71a4e916537a595cbaf34d4d051480236f6'],
      [OTOOL,14827173,138208,'61ff2c63cf68eeeadf9c4700dadb8271740ff4960f98500f30db82b31521c0de'],
      [CLT+'/usr/share/man/man1/ld.1',14830332,62981,'8570994697756ef9bf0146983a6971892d99cb830a2b36f93fb0d049835e81d5'],
      [SDK+'/SDKSettings.json',14830457,7774,'f8d005f09381389167f9e0aeaa169bc9e7dff162ef22ca2fd8e98df7ff1acafe'],
      [SDK+'/usr/lib/libSystem.B.tbd',14867668,334178,'20cfce043f11a083e2eb6111efe3579919a8082fa4cc912a7bd839af2010ec57'],
    ];
    for(const [path,inode,size,sha]of tools)acquire(path,{uid:0,inode,size,sha,limit:size});
    const matches=[...inventory.read().toString().matchAll(/^const HEADER_ROWS = `\n([^`$]*)\n`\.trim\(\);$/gm)];
    assert.equal(matches.length,1,'one literal original header nomination');
    const originalRows=matches[0][1];assert.equal(hash(originalRows+'\n'),
      '55e1f4b0f341f5eef4d375bdf31ec29081fcc8771ef2cf51fe9bbe897e649c0f');
    assert.equal(hash(GUARD_HEADER_ADDITIONS+'\n'),'cd580f87d21fc6695a955bf4ba7a93eaba40e7a8ebed476c6a8c2fd93897ae01');
    assert.equal(originalRows.split('\n').length,85);assert.equal(GUARD_HEADER_ADDITIONS.split('\n').length,114);
    assert.equal(GUARD_HEADER_644.size,22);
    const roots={R:RESOURCE+'/include',S:SDK+'/usr/include'},labels=new Set();
    for(const [body,original]of[[originalRows,true],[GUARD_HEADER_ADDITIONS,false]])for(const row of body.split('\n')) {
      const match=(original?/^([RS]\/[A-Za-z0-9_/.]+)\|([0-9]+)\|([0-9]+)\|(444|644)\|([a-f0-9]{64})$/:
        /^([RS]\/[A-Za-z0-9_/.]+)\|([0-9]+)\|([0-9]+)\|([a-f0-9]{64})$/).exec(row);
      assert.ok(match,'strict literal header row');const [label,inode,size]=match.slice(1,4);
      assert.equal(label.includes('..'),false);assert.equal(labels.has(label),false);labels.add(label);
      const mode=original?parseInt(match[4],8):GUARD_HEADER_644.has(label)?0o644:0o444;
      acquire(roots[label[0]]+label.slice(1),{uid:0,inode,size,mode,sha:match[original?5:4]});
    }
    assert.equal(labels.size,199);receipt.publicHeaderCount=199;
    const absent=[roots.R+'/AvailabilityInternalPrivate.h',roots.S+'/AvailabilityInternalPrivate.h',
      roots.R+'/AvailabilityProhibitedInternal.h',roots.S+'/AvailabilityProhibitedInternal.h',
      roots.R+'/__xnu_libcxx_sentinel.h',roots.S+'/__xnu_libcxx_sentinel.h',roots.S+'/stdarg.h',roots.S+'/stdbool.h'];
    for(const path of absent) {
      const check=()=>assert.throws(()=>fs.lstatSync(path),error=>error.code==='ENOENT','nominated absent input');
      check();checks.push(check);
    }
    receipt.absentInputs=absent;
    const parents=new Set();for(const item of held){const parts=item.path.split('/').filter(Boolean);let p='';
      for(const part of parts.slice(0,-1)){p+='/'+part;parents.add(p);}}
    for(const path of parents){directoryGuard(path,checks);const stat=fs.lstatSync(path,{bigint:true});
      ancestors.push({path,...guardMaterial(stat)});}
    assert.equal(fs.lstatSync(SDK,{bigint:true}).ino,14162438n);
    assert.equal(fs.lstatSync(RESOURCE,{bigint:true}).ino,6714331n);
    let candidate=source.read().toString();
    if(mode==='guard-omission') {
      const expression=/    \/\* SF_FINITE_GUARD_BEGIN \*\/[\s\S]*?    \/\* SF_FINITE_GUARD_END \*\/\n/g;
      assert.equal([...candidate.matchAll(expression)].length,1,'unique finite guard mutation');
      candidate=candidate.replace(expression,'');
    }
    dir=fs.mkdtempSync('/private/tmp/setfarm-native-guard.');fs.chmodSync(dir,0o700);
    directoryGuard(dir,checks,true);fixture=guardMaterial(fs.lstatSync(dir,{bigint:true}));
    receipt.dir=dir;receipt.fixture=fixture;receipt.sourceHash=source.sha;receipt.entryHash=entry.sha;
    receipt.testHash=self.sha;receipt.inventoryHash=inventory.sha;
    receipt.instrumentationHash=hash(PREFIX+'\n'+GUARD_PREFIX+'\n'+SUFFIX);
    const copy=dir+'/initializer.c',entryCopy=dir+'/entry.cjs',object=dir+'/initializer.o',addon=dir+'/initializer.node';
    const prep=mode==='guard-enabled'?1:0;
    const compiled=Buffer.from(PREFIX+'\n#define GUARD_PREP '+prep+'\n'+GUARD_PREFIX+'\n'+candidate+'\n'+SUFFIX);
    const entryBytes=entry.read();
    for(const [path,body]of[[entryCopy,entryBytes],[copy,compiled]]) {
      fs.writeFileSync(path,body,{flag:'wx',mode:0o600});produced(path,{uid:501,sha:hash(body),mode:0o600});
    }
    const compile=await settle(CLANG,['--no-default-config','--target=arm64-apple-macos26.5',
      '-resource-dir',RESOURCE,'-isysroot',SDK,'-integrated-as','-nostdinc','-isystem',HEADERS,
      '-isystem',RESOURCE+'/include','-isystem',SDK+'/usr/include',
      '-fno-modules','-fno-implicit-modules','-fno-implicit-module-maps','-fno-lto',
      '-fstack-protector-strong','-fvisibility=hidden','-std=c11','-O0','-Wall','-Wextra','-Werror',
      '-c',copy,'-o',object]);
    const objectHeld=produced(object,{uid:501,mode:0o644});
    assertGuardSettlement(compile);assert.equal(compile.code,0);assert.equal(compile.stdout,'');assert.equal(compile.stderr,'');
    assert.ok(objectHeld,'actual compiled object');
    const link=await settle(CLANG,['--no-default-config','--target=arm64-apple-macos26.5',
      '-resource-dir',RESOURCE,'-isysroot',SDK,'--ld-path='+LD,'-bundle','-fno-lto','-nostdlib',
      '-Wl,-Z','-Wl,-syslibroot,'+SDK,object,LIBNODE,SDK+'/usr/lib/libSystem.B.tbd','-o',addon]);
    const addonHeld=produced(addon,{uid:501,mode:0o755});
    assertGuardSettlement(link);assert.equal(link.code,0);assert.equal(link.stdout,'');assert.equal(link.stderr,'');
    assert.ok(addonHeld,'actual linked addon');
    const exports=await settle(NM,['-gjU',addon]);assertGuardSettlement(exports);assert.equal(exports.code,0);assert.equal(exports.stderr,'');
    assert.deepEqual(exports.stdout.trim().split('\n').sort(),['_napi_register_module_v1','_node_api_module_get_api_version_v1']);
    const imports=await settle(NM,['-uj',addon]);assertGuardSettlement(imports);assert.equal(imports.code,0);assert.equal(imports.stderr,'');
    assert.deepEqual(imports.stdout.trim().split('\n').sort(),['_napi_create_function','_napi_set_named_property',
      '_napi_throw_error','__Exit','_atexit','_dladdr','_open','_fdopen$DARWIN_EXTSN','_close','_fclose',
      '_fprintf','_strcmp','_memcpy','___stack_chk_fail','___stack_chk_guard',
      '_pthread_setcancelstate','_pthread_sigmask','_pthread_self','_pthread_equal'].sort(),'exact prospective guard imports');
    const deps=await settle(OTOOL,['-L',addon]);assertGuardSettlement(deps);assert.equal(deps.code,0);assert.equal(deps.stderr,'');
    assert.deepEqual(deps.stdout.trim().split('\n').slice(1).map(line=>line.trim().split(' (')[0]).sort(),
      ['/opt/homebrew/opt/node/lib/libnode.147.dylib','/usr/lib/libSystem.B.dylib']);
    const actual=await settle(NODE,[entryCopy]);
    const trace=produced(dir+'/native-trace',{uid:501,mode:0o600,limit:8192});
    const guard=produced(dir+'/guard-trace',{uid:501,mode:0o600,limit:8192});
    assertGuardSettlement(actual);assert.ok(trace);assert.ok(guard);
    result={availability:'inert-native-observed',code:actual.code,stdout:actual.stdout,stderr:actual.stderr,
      nativeTrace:trace.read().toString(),guardTrace:guard.read().toString(),receipt};
    receipt.loadedProviderScope='dladdr attribution only, not shared-cache bytes/backend/TCB';
  }catch(error){failures.push(error);}
  finally {
    for(const check of checks)try{check();}catch(error){failures.push(error);}
    for(const item of held)try{item.check();}catch(error){failures.push(error);}
    receipt.originalInputs=held.map(item=>item.first);
    receipt.distinctOriginalInputs=new Set(held.map(item=>item.fd)).size;
    for(const item of [...held].reverse())try{item.close();closed++;}catch(error){failures.push(error);}
    receipt.checkedOnceCloses=closed;receipt.completedAt=new Date().toISOString();
    receipt.failures=failures.map(error=>({name:error.name,message:error.message}));
    // Full original artifact/process receipt exists even when the real oracle fails.
    process.stdout.write(JSON.stringify(receipt)+'\n');
  }
  if(failures.length)throw new AggregateError(failures,'guard fixture failed; original artifacts retained');
  assert.equal(receipt.distinctOriginalInputs,held.length);assert.equal(closed,held.length);
  return result;
}
function assertGuardBaseline(actual,mode) {
  const trace=parseTrace(actual.nativeTrace);
  assertBaseline({...actual,trace});
  for(const image of trace.images) {
    const expected=['create','set','throw'].includes(image.name)?LIBNODE:actual.receipt.dir+'/initializer.node';
    assert.equal(fs.realpathSync(image.path),expected,'actual NAPI/addon image');
    const original=actual.receipt.originalInputs.find(item=>item.path===expected);assert.ok(original);
    const stat=fs.statSync(image.path,{bigint:true});
    for(const key of fields)assert.equal(String(stat[key]),original[key]);
  }
  assertGuardTransaction(parseGuardTrace(actual.guardTrace),mode);
}
test('native callback guard restores an actually disabled saved state',{skip:!guardEnabled},async()=>{
  const actual=await invokeGuardInitializer('guard-disabled');assertGuardBaseline(actual,'disabled');
});
test('native callback guard characterizes returning enabled restoration',{skip:!guardEnabled},async()=>{
  const actual=await invokeGuardInitializer('guard-enabled');assertGuardBaseline(actual,'enabled');
});
test('native callback guard oracle rejects guard-block omission',{skip:!guardEnabled},async()=>{
  const actual=await invokeGuardInitializer('guard-omission');
  assert.throws(()=>assertGuardBaseline(actual,'disabled'),error=>error instanceof GuardWitnessMissing);
});


// S10a: separate consumer; never invoke old cases or initialize.
const CONTRACT_PREFLIGHT_CONSUMER = String.raw`'use strict';
const assert = require('node:assert/strict');
try {
  assert.equal(process.argv.length, 2, 'sole fixed consumer argument');
  const native = require('./initializer.node');
  assert.equal(Object.hasOwn(native, 'initialize'), true);
  assert.equal(typeof native.initialize, 'function');
  if (!Object.hasOwn(native, 'continuityContract')) {
    assert.deepEqual(Reflect.ownKeys(native), ['initialize']);
    process.stderr.write('S10A_NATIVE_CONTRACT_MISSING\n');
    process.exitCode = 2;
  } else {
    assert.deepEqual(Reflect.ownKeys(native).sort(), ['continuityContract', 'initialize']);
    assert.equal(typeof native.continuityContract, 'function');
    const record = native.continuityContract();
    assert.equal(Object.getPrototypeOf(record), Object.prototype);
    assert.deepEqual(Reflect.ownKeys(record).sort(), ['implementation', 'protocolVersion']);
    assert.deepEqual(record, {protocolVersion: 2, implementation: 'ordinary-continuity-v2'});
  }
} catch {
  process.stderr.write('S10A_NATIVE_PREFLIGHT_OTHER_FAILURE\n');
  process.exitCode = 3;
}
`;

function bindPreflightHeaderSearch(held,checks,receipt,compiledSource) {
  const roots=[['N',HEADERS],['R',RESOURCE+'/include'],['S',SDK+'/usr/include']];
  const rank=p=>roots.findIndex(([,root])=>p===root||p.startsWith(root+'/'));
  const label=p=>{const i=rank(p);assert.ok(i>=0);return roots[i][0]+'/'+p.slice(roots[i][1].length+1);};
  const physical=(base,name)=>fileURLToPath(new URL(name,'file://'+base));
  const queue=[],contexts=new Set(),edges=[],probes=[],unresolved=[],absences=new Map(),directories=new Map(),seeds=[];
  const negative=(p,code)=>{
    let nearest=p.slice(0,p.lastIndexOf('/'));
    for(;;) {
      try {
        const stat=fs.lstatSync(nearest,{bigint:true});assert.ok(stat.isDirectory());
        if(!directories.has(nearest)) {
          directories.set(nearest,stat);
          checks.push(()=>assert.ok(same(stat,fs.lstatSync(nearest,{bigint:true})),
            'header-search absence ancestor unchanged'));
        }
        break;
      } catch(error) {
        if(error.code!=='ENOENT')throw error;
        nearest=nearest.slice(0,nearest.lastIndexOf('/'));assert.ok(nearest.length>0);
      }
    }
    if(!absences.has(p)) {
      absences.set(p,[code,nearest]);
      checks.push(()=>assert.throws(()=>fs.lstatSync(p),error=>error.code===code,
        'per-edge header-search negative binding'));
    }
    return ['absent',p,code,nearest];
  };
  const candidate=p=>{
    assert.ok(rank(p)>=0,'public search roots only');
    let stat;
    try{stat=fs.lstatSync(p,{bigint:true});}
    catch(error){if(error.code==='ENOENT'||error.code==='ENOTDIR')
      return {observation:negative(p,error.code)};throw error;}
    let resolved=p,observation=['regular',p];
    if(stat.isSymbolicLink()) {
      assert.equal(p,SDK+'/usr/include/pthread.h','only nominated C11 header alias');
      const target=fs.readlinkSync(p);assert.equal(target,'pthread/pthread.h');
      resolved=physical(p,target);observation=['selector',p,target,resolved];
    }else assert.ok(stat.isFile(),'regular header candidate');
    const original=held.find(item=>item.path===resolved);
    assert.ok(original,'every resolved header is already a nominated held original: '+resolved);
    original.check();assert.ok(same(original.stat,fs.lstatSync(resolved,{bigint:true})));
    return {p:resolved,observation};
  };
  const resolve=(name,origin,next,quoted)=>{
    assert.ok(!name.includes('\0')&&!name.startsWith('/'),'relative include name');
    const candidates=[];
    if(next)for(let i=origin.rank+1;i<roots.length;i++)candidates.push([roots[i][1]+'/'+name,i]);
    else {
      if(quoted){const p=physical(origin.p,name),i=rank(p);if(i>=0)candidates.push([p,i]);}
      for(let i=0;i<roots.length;i++)candidates.push([roots[i][1]+'/'+name,i]);
    }
    const seen=new Set(),bindings=[];
    for(const [p,i]of candidates) {
      if(seen.has(p))continue;seen.add(p);
      const actual=candidate(p);bindings.push(actual.observation);
      if(actual.p)return {p:actual.p,rank:i,bindings};
    }
    return {error:next?'not-present-in-later-roots':'not-present-in-ordered-roots',bindings};
  };
  const add=actual=>{
    const key=actual.p+'\0'+actual.rank;
    if(!contexts.has(key)){contexts.add(key);queue.push({p:actual.p,rank:actual.rank});}
  };
  const origin={p:HEADERS+'/candidate.cc',rank:0};
  for(const name of ['node_api.h','pthread.h','signal.h','stdlib.h','dlfcn.h','fcntl.h','stdio.h','string.h','unistd.h']) {
    const actual=resolve(name,origin,false,false);assert.equal(actual.error,undefined);
    seeds.push([name,label(actual.p),actual.bindings]);add(actual);
  }
  assert.deepEqual(seeds.map(row=>row[1]),['N/node_api.h','S/pthread/pthread.h','S/signal.h',
    'S/stdlib.h','S/dlfcn.h','S/fcntl.h','S/stdio.h','S/string.h','S/unistd.h']);
  const sourceIncludes=[...compiledSource.matchAll(/^\s*#\s*include\s+<([^>]+)>/gm)].map(m=>m[1]);
  assert.deepEqual(sourceIncludes,['node_api.h','dlfcn.h','fcntl.h','stdio.h','stdlib.h','string.h','unistd.h',
    'node_api.h','pthread.h','signal.h','stdlib.h'],'all eleven actual compiled-source includes');
  for(const name of sourceIncludes)assert.equal(resolve(name,origin,false,false).error,undefined);
  for(let q=0;q<queue.length;q++) {
    const from=queue[q],original=held.find(item=>item.path===from.p);assert.ok(original);
    const text=original.read().toString();
    for(const m of text.matchAll(/__has_include(_next)?\s*\(\s*([<"])([^>"]+)[>"]\s*\)/g)) {
      const actual=resolve(m[3],from,!!m[1],m[2]==='"');
      probes.push([label(from.p),from.rank,m[1]?'has_include_next':'has_include',m[3],
        actual.p?label(actual.p):null,actual.bindings,actual.error||null]);
      if(actual.p)add(actual);
    }
    const lines=text.split('\n');
    for(let i=0;i<lines.length;i++) {
      const m=/^\s*#\s*(include|include_next|import)\s+(.+)$/.exec(lines[i]);if(!m)continue;
      const literal=/^[<"]([^>"]+)[>"]/.exec(m[2]);
      assert.ok(literal,'no unbound computed include');
      const actual=resolve(literal[1],from,m[1]==='include_next',m[2].startsWith('"'));
      edges.push([label(from.p),from.rank,i+1,m[1],literal[1],actual.p?label(actual.p):null,actual.bindings]);
      if(actual.error)unresolved.push([label(from.p),from.rank,i+1,m[1],literal[1],actual.error]);else add(actual);
    }
  }
  assert.equal(contexts.size,190);assert.equal(edges.length,487);assert.equal(probes.length,18);
  assert.equal(absences.size,367);
  assert.equal(hash(JSON.stringify(edges)),'a55687071ca8562f37378a9eee4352fea3ecfdd406033d5f8368bbe9fd9af687');
  assert.equal(hash(JSON.stringify(probes)),'c941323849240c731ac02508c1d412c0b99995940dc6ca999aa04616749f831a');
  const absenceRows=[...absences].map(([p,row])=>[p,...row]).sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0);
  assert.equal(hash(JSON.stringify(absenceRows)),'8cdeba87c5cc7bc51bd67e57a62f666817420194329b1a541743874220b8e833');
  assert.deepEqual(unresolved,[
    ['S/Availability.h',2,200,'include','AvailabilityInternalPrivate.h','not-present-in-ordered-roots'],
    ['S/Availability.h',2,319,'include','AvailabilityProhibitedInternal.h','not-present-in-ordered-roots'],
    ['R/stdbool.h',1,16,'include_next','stdbool.h','not-present-in-later-roots'],
    ['R/stdarg.h',1,29,'include_next','stdarg.h','not-present-in-later-roots'],
    ['S/i386/limits.h',2,62,'include_next','limits.h','not-present-in-later-roots'],
    ['S/arm/limits.h',2,65,'include_next','limits.h','not-present-in-later-roots'],
  ],'only nominated conditional absent edges, not missing active inputs');
  receipt.headerSearch={roots,seeds,contexts:contexts.size,edges,probes,unresolved,
    absences:absenceRows,
    absenceAncestors:[...directories].map(([p,stat])=>({path:p,...guardMaterial(stat)})),
    compiledSourceIncludes:sourceIncludes,compilerUsedClosure:false};
}

async function invokeContractPreflight() {
  const held=[],checks=[],failures=[],processes=[],aliases=[],artifacts=[],ancestors=[];
  let closed=0,result,dir=null,fixture=null;
  const receipt={kind:'S10a-native-contract-preflight-FIRST',recipe:'missing-native-contract-v1',startedAt:new Date().toISOString(),
    ownerAuthority:false,retentionQualified:false,channelAcquired:false,processes,aliases,artifacts,ancestors};
  const acquire=(path,expected)=>{const item=guardHold(path,expected);held.push(item);return item;};
  const produced=(path,expected)=>{
    try{const item=acquire(path,expected);artifacts.push(item.first);return item;}
    catch(error){if(error.code==='ENOENT'){artifacts.push({path,absentAt:new Date().toISOString()});return null;}throw error;}
  };
  const settle=async(command,args)=>{precheck();const actual=await guardSpawn(command,args,dir);processes.push(actual);return actual;};
  const precheck=()=>{
    assert.equal(new Set(held.map(item=>item.fd)).size,held.length,'distinct original descriptors');
    for(const check of checks)check();for(const item of held)item.check();
  };
  const alias=(path,inode,target,uid,gid,size,mtimeNs,ctimeNs)=>{
    const stat=fs.lstatSync(path,{bigint:true});assert.ok(stat.isSymbolicLink());
    assert.equal(stat.ino,BigInt(inode));assert.equal(stat.uid,BigInt(uid));assert.equal(stat.gid,BigInt(gid));
    assert.equal(stat.nlink,1n);assert.equal(fs.readlinkSync(path),target);
    if(size!==undefined)assert.equal(stat.size,BigInt(size));
    if(mtimeNs!==undefined)assert.equal(stat.mtimeNs,BigInt(mtimeNs));
    if(ctimeNs!==undefined)assert.equal(stat.ctimeNs,BigInt(ctimeNs));
    const resolved=fs.realpathSync(path);aliases.push({path,target,resolved,...guardMaterial(stat)});
    checks.push(()=>{assert.ok(same(stat,fs.lstatSync(path,{bigint:true})));
      assert.equal(fs.readlinkSync(path),target);assert.equal(fs.realpathSync(path),resolved);});
  };
  try {
    assert.equal(process.platform,'darwin');assert.equal(process.getuid(),501);assert.equal(process.geteuid(),501);
    assert.equal(fs.realpathSync(process.execPath),NODE,'fixed test runtime');
    const source=acquire(sourcePath,{uid:501,inode:216276870,size:1373,
      sha:'6267af24fc2ced81af7a781352313d357b00ab25bb199513025e69126372da4d'}),entry=acquire(entryPath,{uid:501,
      inode:216276871,sha:'bd83726b1f9270eec4cb1eddb929e97ae767f525a1cdab0003257729dd552c94'});
    const self=acquire(fileURLToPath(import.meta.url),{uid:501,sha:preflightSelfSha});
    const inventory=acquire(fileURLToPath(new URL('./task6a-origin-native-continuity-frame-v2.test.js',import.meta.url)),
      {uid:501,inode:216283209,size:60175,sha:'54575f8e27cfcd4ed33bca4a08206e191a09f89af66ffa0e44417482411548b7'});
    assert.equal(IMAGE_PINS.length,30);assert.equal(SELECTORS.length,38);
    for(const [relative,inode,sha]of IMAGE_PINS)acquire(CELLAR+relative,{uid:501,inode,sha,limit:100_000_000});
    for(const [relative,inode,target]of SELECTORS)alias('/opt/homebrew/'+relative,inode,target,501,80);
    alias(SDK+'/usr/include/pthread.h',14866985,'pthread/pthread.h',0,0,17,
      '1782608311515232577','1782608364253587548');
    const tools=[
      [CLANG,14827087,290664032,'f30550eab15fdf5ab8c0dc54c52679711241e5d4b636b027e18c09fef531775d'],
      [LD,14827148,4953232,'28d85b9af18c923db12e0b4ce70b80ee217f2b7cade0e872baa9e8ddc396c08d'],
      [NM,14827169,33125008,'9097f9662024989b801a1448eea2a71a4e916537a595cbaf34d4d051480236f6'],
      [OTOOL,14827173,138208,'61ff2c63cf68eeeadf9c4700dadb8271740ff4960f98500f30db82b31521c0de'],
      [CLT+'/usr/share/man/man1/ld.1',14830332,62981,'8570994697756ef9bf0146983a6971892d99cb830a2b36f93fb0d049835e81d5'],
      [SDK+'/SDKSettings.json',14830457,7774,'f8d005f09381389167f9e0aeaa169bc9e7dff162ef22ca2fd8e98df7ff1acafe'],
      [SDK+'/usr/lib/libSystem.B.tbd',14867668,334178,'20cfce043f11a083e2eb6111efe3579919a8082fa4cc912a7bd839af2010ec57'],
    ];
    for(const [path,inode,size,sha]of tools)acquire(path,{uid:0,inode,size,sha,limit:size});
    const matches=[...inventory.read().toString().matchAll(/^const HEADER_ROWS = `\n([^`$]*)\n`\.trim\(\);$/gm)];
    assert.equal(matches.length,1,'one literal original header nomination');
    const originalRows=matches[0][1];assert.equal(hash(originalRows+'\n'),
      '55e1f4b0f341f5eef4d375bdf31ec29081fcc8771ef2cf51fe9bbe897e649c0f');
    assert.equal(hash(GUARD_HEADER_ADDITIONS+'\n'),'cd580f87d21fc6695a955bf4ba7a93eaba40e7a8ebed476c6a8c2fd93897ae01');
    assert.equal(originalRows.split('\n').length,85);assert.equal(GUARD_HEADER_ADDITIONS.split('\n').length,114);
    assert.equal(GUARD_HEADER_644.size,22);
    const roots={R:RESOURCE+'/include',S:SDK+'/usr/include'},labels=new Set();
    for(const [body,original]of[[originalRows,true],[GUARD_HEADER_ADDITIONS,false]])for(const row of body.split('\n')) {
      const match=(original?/^([RS]\/[A-Za-z0-9_/.]+)\|([0-9]+)\|([0-9]+)\|(444|644)\|([a-f0-9]{64})$/:
        /^([RS]\/[A-Za-z0-9_/.]+)\|([0-9]+)\|([0-9]+)\|([a-f0-9]{64})$/).exec(row);
      assert.ok(match,'strict literal header row');const [label,inode,size]=match.slice(1,4);
      assert.equal(label.includes('..'),false);assert.equal(labels.has(label),false);labels.add(label);
      const mode=original?parseInt(match[4],8):GUARD_HEADER_644.has(label)?0o644:0o444;
      acquire(roots[label[0]]+label.slice(1),{uid:0,inode,size,mode,sha:match[original?5:4]});
    }
    assert.equal(labels.size,199);receipt.publicHeaderCount=199;
    const absent=[roots.R+'/AvailabilityInternalPrivate.h',roots.S+'/AvailabilityInternalPrivate.h',
      roots.R+'/AvailabilityProhibitedInternal.h',roots.S+'/AvailabilityProhibitedInternal.h',
      roots.R+'/__xnu_libcxx_sentinel.h',roots.S+'/__xnu_libcxx_sentinel.h',roots.S+'/stdarg.h',roots.S+'/stdbool.h'];
    for(const path of absent) {
      const check=()=>assert.throws(()=>fs.lstatSync(path),error=>error.code==='ENOENT','nominated absent input');
      check();checks.push(check);
    }
    receipt.absentInputs=absent;
    const parents=new Set();for(const item of held){const parts=item.path.split('/').filter(Boolean);let p='';
      for(const part of parts.slice(0,-1)){p+='/'+part;parents.add(p);}}
    for(const path of parents){directoryGuard(path,checks);const stat=fs.lstatSync(path,{bigint:true});
      ancestors.push({path,...guardMaterial(stat)});}
    assert.equal(fs.lstatSync(SDK,{bigint:true}).ino,14162438n);
    assert.equal(fs.lstatSync(RESOURCE,{bigint:true}).ino,6714331n);
    assert.equal(held.length,240,'nominated original inputs before fixture creation');
    const candidate=source.read().toString();
    bindPreflightHeaderSearch(held,checks,receipt,PREFIX+'\n'+candidate+'\n'+SUFFIX);
    precheck(); // Includes Node-first shadows and conditional presence bindings before fixture/tools.
    dir=fs.mkdtempSync('/private/tmp/setfarm-native-contract-preflight.');fs.chmodSync(dir,0o700);
    directoryGuard(dir,checks,true);fixture=guardMaterial(fs.lstatSync(dir,{bigint:true}));
    receipt.dir=dir;receipt.fixture=fixture;receipt.sourceHash=source.sha;receipt.entryHash=entry.sha;
    receipt.testHash=self.sha;receipt.inventoryHash=inventory.sha;
    receipt.instrumentationHash=hash(PREFIX+'\n'+SUFFIX);
    receipt.consumerHash=hash(CONTRACT_PREFLIGHT_CONSUMER);
    const copy=dir+'/initializer.c',consumerFile=dir+'/contract-preflight.cjs';
    const object=dir+'/initializer.o',addon=dir+'/initializer.node';
    const compiled=Buffer.from(PREFIX+'\n'+candidate+'\n'+SUFFIX);
    receipt.compiledSourceHash=hash(compiled);
    for(const [path,body]of[[consumerFile,Buffer.from(CONTRACT_PREFLIGHT_CONSUMER)],[copy,compiled]]) {
      fs.writeFileSync(path,body,{flag:'wx',mode:0o600});
      assert.ok(produced(path,{uid:501,sha:hash(body),mode:0o600}),'authored original held before compiler');
    }
    const compile=await settle(CLANG,['--no-default-config','--target=arm64-apple-macos26.5',
      '-resource-dir',RESOURCE,'-isysroot',SDK,'-integrated-as','-nostdinc','-isystem',HEADERS,
      '-isystem',RESOURCE+'/include','-isystem',SDK+'/usr/include',
      '-fno-modules','-fno-implicit-modules','-fno-implicit-module-maps','-fno-lto',
      '-fstack-protector-strong','-fvisibility=hidden','-std=c11','-O0','-Wall','-Wextra','-Werror',
      '-c',copy,'-o',object]);
    const objectHeld=produced(object,{uid:501,mode:0o644});
    assertGuardSettlement(compile);assert.equal(compile.code,0);assert.equal(compile.stdout,'');assert.equal(compile.stderr,'');
    assert.ok(objectHeld,'actual compiled object');
    const link=await settle(CLANG,['--no-default-config','--target=arm64-apple-macos26.5',
      '-resource-dir',RESOURCE,'-isysroot',SDK,'--ld-path='+LD,'-bundle','-fno-lto','-nostdlib',
      '-Wl,-Z','-Wl,-syslibroot,'+SDK,object,LIBNODE,SDK+'/usr/lib/libSystem.B.tbd','-o',addon]);
    const addonHeld=produced(addon,{uid:501,mode:0o755});
    assertGuardSettlement(link);assert.equal(link.code,0);assert.equal(link.stdout,'');assert.equal(link.stderr,'');
    assert.ok(addonHeld,'actual linked addon');
    const exports=await settle(NM,['-gjU',addon]);assertGuardSettlement(exports);assert.equal(exports.code,0);assert.equal(exports.stderr,'');
    assert.deepEqual(exports.stdout.trim().split('\n').sort(),['_napi_register_module_v1','_node_api_module_get_api_version_v1']);
    const imports=await settle(NM,['-uj',addon]);assertGuardSettlement(imports);assert.equal(imports.code,0);assert.equal(imports.stderr,'');
    assert.deepEqual(imports.stdout.trim().split('\n').sort(),['_napi_create_function','_napi_set_named_property',
      '_napi_throw_error','__Exit','_atexit','_dladdr','_open','_fdopen$DARWIN_EXTSN','_close','_fclose',
      '_fprintf','_strcmp','_memcpy','___stack_chk_fail','___stack_chk_guard',
      '_pthread_setcancelstate','_pthread_sigmask'].sort(),'exact preflight imports; not guard invocation witnesses');
    const deps=await settle(OTOOL,['-L',addon]);assertGuardSettlement(deps);assert.equal(deps.code,0);assert.equal(deps.stderr,'');
    assert.deepEqual(deps.stdout.trim().split('\n').slice(1).map(line=>line.trim().split(' (')[0]).sort(),
      ['/opt/homebrew/opt/node/lib/libnode.147.dylib','/usr/lib/libSystem.B.dylib']);
    const actual=await settle(NODE,[consumerFile]);
    const trace=produced(dir+'/native-trace',{uid:501,mode:0o600,limit:8192});
    assertGuardSettlement(actual);assert.ok(trace,'actual natural-exit native trace');
    const nativeTrace=trace.read().toString(),parsed=parseTrace(nativeTrace);
    assert.deepEqual(parsed.events,['create:0','set:0'],'actual registration, no initializer call');
    assert.deepEqual(parsed.images.map(image=>[image.name,image.count]),
      [['create',1],['set',1],['register',1],['version',1]]);
    for(const image of parsed.images) {
      const expected=['create','set'].includes(image.name)?LIBNODE:addon;
      assert.equal(fs.realpathSync(image.path),expected,'actual owned NAPI/addon image');
      const original=held.find(item=>item.path===expected);assert.ok(original);original.check();
      assert.ok(same(original.stat,fs.statSync(image.path,{bigint:true})));
    }
    assert.equal(held.length,245,'240 inputs plus exactly five generated originals');
    assert.equal(artifacts.length,5);assert.equal(processes.length,6);
    receipt.callbackEntries=0;receipt.nativeWitness=parsed;
    result={code:actual.code,stdout:actual.stdout,stderr:actual.stderr,nativeTrace,receipt};
    receipt.loadedProviderScope='dladdr attribution only, not shared-cache bytes/backend/TCB';
  }catch(error){failures.push(error);}
  finally {
    for(const check of checks)try{check();}catch(error){failures.push(error);}
    for(const item of held)try{item.check();}catch(error){failures.push(error);}
    receipt.originalInputs=held.map(item=>item.first);
    receipt.distinctOriginalInputs=new Set(held.map(item=>item.fd)).size;
    for(const item of [...held].reverse())try{item.close();closed++;}catch(error){failures.push(error);}
    receipt.checkedOnceCloses=closed;receipt.completedAt=new Date().toISOString();
    receipt.failures=failures.map(error=>({name:error.name,message:error.message}));
    // Full original artifact/process receipt exists even when the real oracle fails.
    process.stdout.write(JSON.stringify(receipt)+'\n');
  }
  if(failures.length)throw new AggregateError(failures,'preflight fixture failed; original artifacts retained, not the intended RED');
  assert.equal(receipt.distinctOriginalInputs,held.length);assert.equal(closed,held.length);
  return result;
}

class MissingNativeContract extends Error {
  constructor() {
    super('real owned addon is missing continuityContract before initialize');
    this.name='MissingNativeContract';
  }
}
test('ordinary continuity preflight requires a real native contract before initialize',
  {skip:!preflightEnabled},async()=>{
    const actual=await invokeContractPreflight();
    assert.equal(actual.receipt.distinctOriginalInputs,245);
    assert.equal(actual.receipt.checkedOnceCloses,245);
    assert.deepEqual(actual.receipt.failures,[]);
    assert.equal(actual.receipt.callbackEntries,0);
    assert.equal(actual.stdout,'');
    if(actual.code===2) {
      assert.equal(actual.stderr,'S10A_NATIVE_CONTRACT_MISSING\n');
      throw new MissingNativeContract(); // Genuine TDD RED, never assert.throws.
    }
    assert.equal(actual.code,0,'generic preflight faults cannot qualify missing-contract RED');
    assert.equal(actual.stderr,'');
  });
