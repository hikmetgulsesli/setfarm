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
