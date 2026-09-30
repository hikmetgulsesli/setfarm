import assert from 'node:assert/strict';
import {existsSync,readFileSync,lstatSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import test from 'node:test';

const HELPER=new URL('../task6a-origin-mach-recon-v2.py',import.meta.url);
const PY='/Library/Developer/CommandLineTools/Library/Frameworks/Python3.framework/Versions/3.9/Resources/Python.app/Contents/MacOS/Python';
const ENV={PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'};
const ordinary=()=>process.platform==='darwin'&&typeof process.getuid==='function'
  &&typeof process.geteuid==='function'&&process.getuid()!==0&&process.geteuid()!==0
  &&process.getuid()===process.geteuid();
function exercise(program,{source}={}){
  assert.ok(ordinary(),'ordinary macOS required');
  assert.ok(existsSync(HELPER),'owned Mach diagnostic implementation missing');
  const st=lstatSync(PY);assert.ok(st.isFile()&&!st.isSymbolicLink());
  assert.equal(st.uid,0);assert.equal(st.gid,0);assert.equal(st.nlink,1);
  assert.equal(createHash('sha256').update(readFileSync(PY)).digest('hex'),
    '0b7aad9bf1adf74d3922cf351f7d2e908dae19edd5456299d162810ae083523d');
  const loader="import sys,json,struct\np=json.load(sys.stdin)\nns={'__name__':'task6a_test'}\nexec(compile(p['source'],'task6a-test-memory','exec'),ns)\nexec(compile(p['program'],'task6a-test-program','exec'),ns)\nprint('PASS')\n";
  const r=spawnSync(PY,['-I','-S','-E','-B','-c',loader],{cwd:'/',env:ENV,
    input:JSON.stringify({source:source??readFileSync(HELPER,'utf8'),program:PRELUDE+program}),
    encoding:'utf8',timeout:15000,maxBuffer:65536});
  assert.equal(r.error,undefined);assert.equal(r.signal,null);return r;
}
function ok(program,options){const r=exercise(program,options);assert.equal(r.status,0,r.stderr);assert.equal(r.stderr,'');assert.equal(r.stdout,'PASS\n');}
const PRELUDE=`
import struct
FIELDS=[3,7,2,0xfedcba9876543210,11,12,13,14,15,16,17,1,2,0,1,22,23,0,24,0xffffffffffffffff]
def raw(**changes):
    f=list(FIELDS)
    names=['protection','maximumProtection','inheritance','offset','userTag','pagesResident','pagesSharedNowPrivate','pagesSwappedOut','pagesDirtied','referenceCount','shadowDepth','externalPager','shareMode','submap','behavior','objectId','userWiredCount','flags','pagesReusable','objectIdFull']
    for key,value in changes.items(): f[names.index(key)]=value
    return struct.pack('<iiiQIIIIIIHBBiiiHHIQ',*f)
def denied(fn):
    try: fn()
    except ValueError as e: assert str(e)=='TASK6A_ORIGIN_MACH_RECON_REFUSED'; return
    raise AssertionError('unsafe Mach diagnostic unexpectedly accepted')
def decode(data=None,address=4096,size=4096,query=0,requested=0,depth=0,count=19):
    return decode_region(raw() if data is None else data,address,size,query,requested,depth,count)
`;
const NATIVE_PRELUDE=`
import ctypes as real_c
class Fn:
    def __init__(self,fn):self.fn=fn
    def __call__(self,*args):return self.fn(*args)
class Lib:pass
lib=Lib();events=[]
class Port(real_c.c_uint32):
    @classmethod
    def in_dll(cls,dll,name):
        assert dll is lib and name=='mach_task_self_'
        return cls(71)
class Proxy:
    c_uint32=Port
    def __getattr__(self,name):return getattr(real_c,name)
    def CDLL(self,path,use_errno):
        assert path=='/usr/lib/libSystem.B.dylib' and use_errno is True
        return lib
sys.modules['ctypes']=Proxy()
def acquire(self_port,pid,output):
    assert self_port==71 and pid==559 and real_c.get_errno()==0
    output._obj.value=42;return 0
def release(self_port,port):
    events.append(('release',self_port,port));return 0
lib.task_read_for_pid=Fn(acquire)
lib.mach_vm_region_recurse=Fn(lambda *args:0)
lib.mach_port_deallocate=Fn(release)
`;
if(!ordinary())test('Mach diagnostic pure coverage unavailable on unsupported or root host',{skip:true},()=>{});
else{
  test('Mach decoder preserves actual pack4 v2 fields without authority',()=>ok(`
d=decode()
assert d=={'address':4096,'size':4096,'end':8192,'depth':0,'protection':3,'maximumProtection':7,'inheritance':2,'offsetHex':'fedcba9876543210','userTag':11,'pagesResident':12,'pagesSharedNowPrivate':13,'pagesSwappedOut':14,'pagesDirtied':15,'referenceCount':16,'shadowDepth':17,'externalPager':True,'shareMode':2,'submap':False,'behavior':1,'objectId':22,'userWiredCount':23,'flags':0,'pagesReusable':24,'objectIdFullHex':'ffffffffffffffff','currentExecutable':False,'potentialExecutable':True}
`));
  for(const [name,key,value] of [['unknown current','protection',8],['unknown max','maximumProtection',8],['current beyond max','maximumProtection',1],['negative current','protection',-1],['unknown flags','flags',4],['nonboolean external','externalPager',2],['nonboolean submap','submap',2],['unknown sharing','shareMode',9],['zero sharing','shareMode',0],['synthetic footprint','userTag',4294967295],['negative inheritance','inheritance',-1]])
    test('Mach decoder refuses '+name,()=>ok('denied(lambda:decode(raw('+key+'='+value+')))'));
  for(const [name,expr] of [['short','raw()[:-1]'],['suffix',"raw()+bytes([0])"],['text',"'x'*76"],['mutable','bytearray(raw())']])
    test('Mach decoder refuses '+name+' wire bytes',()=>ok('denied(lambda:decode('+expr+'))'));
  for(const [name,args] of [['short count','count=18'],['large count','count=20'],['zero size','size=0'],['overflow end','address=281474976710655,size=2'],['above range','address=281474976710656'],['backtrack','query=8192'],['prior overlapping region','query=4097'],['negative address','address=-1'],['noninteger address','address=1.0'],['boolean address','address=True'],['depth too high','requested=65,depth=65'],['depth beyond requested','requested=1,depth=2']])
    test('Mach decoder refuses '+name,()=>ok('denied(lambda:decode('+args+'))'));
  for(const [current,max,cx,px] of [[0,0,false,false],[0,4,false,true],[3,7,false,true],[5,7,true,true],[7,7,true,true]])
    test('Mach decoder retains '+current+'/'+max+' execute distinction',()=>ok('d=decode(raw(protection='+current+',maximumProtection='+max+'));assert d["currentExecutable"]=='+(cx?'True':'False')+';assert d["potentialExecutable"]=='+(px?'True':'False')));
  test('Mach census descends submaps and advances leaves with returned depth',()=>ok(`
replies=[(0,4096,16384,0,19,raw(submap=1)),(0,4096,4096,1,19,raw()),(0,12288,4096,1,19,raw(protection=5)),(0,24576,4096,0,19,raw()),(1,0,0,0,0,b'')]
trace=[]
def query(a,d): trace.append((a,d)); return replies.pop(0)
result=walk_regions(query,lambda:True,lambda:0)
assert trace==[(0,0),(4096,1),(8192,1),(16384,1),(28672,0)]
assert result['leafCount']==3 and result['submapCount']==1
assert result['currentExecutableCount']==1 and result['potentialExecutableCount']==3
assert result['completeNativeClosure'] is False and result['productionAuthority'] is False
assert result['sampled'] is True and result['terminalCandidate']==1
assert len(result['regions'])==4
`));
  for(const [name,program] of [
    ['initial exhaustion',"denied(lambda:walk_regions(lambda a,d:(1,0,0,0,0,b''),lambda:True,lambda:0))"],
    ['unexpected kernel error',"denied(lambda:walk_regions(lambda a,d:(5,0,0,0,0,b''),lambda:True,lambda:0))"],
    ['lost child',"denied(lambda:walk_regions(lambda a,d:(_ for _ in ()).throw(AssertionError('query after loss')),lambda:False,lambda:0))"],
    ['nonrenewable deadline',"times=iter([0,11]);denied(lambda:walk_regions(lambda a,d:(_ for _ in ()).throw(AssertionError('query after deadline')),lambda:True,lambda:next(times)))"],
    ['post-query child loss',"alive=iter([True,False]);denied(lambda:walk_regions(lambda a,d:(0,4096,4096,0,19,raw()),lambda:next(alive),lambda:0))"],
    ['unbounded submap depth',"denied(lambda:walk_regions(lambda a,d:(0,4096,4096,d,19,raw(submap=1)),lambda:True,lambda:0))"],
    ['repeated backtracking leaf',"denied(lambda:walk_regions(lambda a,d:(0,4096,4096,0,19,raw()),lambda:True,lambda:0))"],
    ['4096 call budget',"calls=[0]\ndef q(a,d): calls[0]+=1;return(0,a,1,0,19,raw())\ndenied(lambda:walk_regions(q,lambda:True,lambda:0));assert calls[0]<=4096"],
  ])test('Mach census refuses '+name,()=>ok(program));
  for(const [name,result,errno,port] of [['negative return',-1,0,12],['positive return',1,0,12],['fresh errno',0,1,12],['null port',0,0,0],['dead port',0,0,4294967295]])
    test('Mach read-port boundary refuses '+name,()=>ok('denied(lambda:checked_read_port('+[result,errno,port].join(',')+'))'));
  test('Mach read-port accepts only checked nondead exact result',()=>ok('assert checked_read_port(0,0,42)==42'));
  test('Mach decoder preserves unsigned native object identifier',()=>ok(`
b=raw();b=b[:56]+struct.pack('<I',0xfedcba98)+b[60:]
assert decode(b)['objectId']==4275878552
`));
  test('Mach native epoch includes read-port acquisition without renewal',()=>ok(`
calls=[];created=[];real=subprocess.Popen
def spawn(*args,**kwargs):p=real(*args,**kwargs);created.append(p);return p
subprocess.Popen=spawn
time.monotonic=lambda:0
class LateNative:
    def __init__(self,pid):time.monotonic=lambda:11
    def query(self,a,d):calls.append((a,d));return(1,0,0,0,0,b'')
    def close(self):pass
NativeReadPort=LateNative
denied(run)
assert calls==[], 'late acquisition must not start any region query'
assert created[0].poll()==0 and all(s.closed for s in (created[0].stdin,created[0].stdout,created[0].stderr))
`));
  for(const edge of ['poll','wait','stdout','stderr'])
    test('Mach cleanup always closes every stream after '+edge+' fault',()=>ok(`
class Stream:
    def __init__(self,name):self.name=name;self.closed=False
    def close(self):self.closed=True
    def read(self,n):
        if self.name==EDGE:raise RuntimeError('read fault')
        return b''
class Child:
    def __init__(self):
        self.stdin=Stream('stdin');self.stdout=Stream('stdout');self.stderr=Stream('stderr');self.returncode=None;self.count=0
    def poll(self):
        self.count+=1
        if EDGE=='poll' and self.count==1:raise RuntimeError('poll fault')
        return self.returncode
    def wait(self,timeout):
        if EDGE=='wait' and self.count==1:raise RuntimeError('wait fault')
        self.returncode=0;return 0
    def send_signal(self,s):raise AssertionError('signal not needed')
child=Child()
denied(lambda:settle(child))
assert all(s.closed for s in (child.stdin,child.stdout,child.stderr))
`.replaceAll('EDGE',JSON.stringify(edge))));
  test('Mach forced TERM then KILL settles only an unreaped child and still refuses success',()=>ok(`
class Stream:
    def __init__(self):self.closed=False
    def close(self):self.closed=True
    def read(self,n):return b''
class Child:
    def __init__(self):self.stdin=Stream();self.stdout=Stream();self.stderr=Stream();self.returncode=None;self.signals=[];self.waits=[]
    def poll(self):return self.returncode
    def send_signal(self,s):assert self.returncode is None;self.signals.append(s)
    def wait(self,timeout):
        self.waits.append(timeout)
        if len(self.waits)<3:raise subprocess.TimeoutExpired('own child',timeout)
        self.returncode=-9;return -9
child=Child();denied(lambda:settle(child))
assert child.waits==[5,2,2] and child.signals==[signal.SIGTERM,signal.SIGKILL]
assert all(s.closed for s in (child.stdin,child.stdout,child.stderr))
`));
  test('Mach cancellation burns results and reaps actual own target without native queries',()=>ok(`
created=[];real=subprocess.Popen
def spawn(*args,**kwargs):p=real(*args,**kwargs);created.append(p);return p
subprocess.Popen=spawn
class CancelledNative:
    def __init__(self,pid):os.kill(os.getpid(),signal.SIGTERM)
    def query(self,a,d):raise AssertionError('query after cancellation')
    def close(self):pass
NativeReadPort=CancelledNative
denied(run)
assert created[0].poll()==0 and all(s.closed for s in (created[0].stdin,created[0].stdout,created[0].stderr))
`));
  test('Mach fixed function bindings use SDK sized nonvariadic ABI',()=>ok(`
import ctypes as c
class Fn: pass
class Lib: pass
l=Lib()
for name in ['task_read_for_pid','mach_vm_region_recurse','mach_port_deallocate']:setattr(l,name,Fn())
bind_functions(l,c)
assert l.task_read_for_pid.argtypes==[c.c_uint32,c.c_int32,c.POINTER(c.c_uint32)]
assert l.task_read_for_pid.restype is c.c_int32
assert l.mach_vm_region_recurse.argtypes==[c.c_uint32,c.POINTER(c.c_uint64),c.POINTER(c.c_uint64),c.POINTER(c.c_uint32),c.POINTER(c.c_int32),c.POINTER(c.c_uint32)]
assert l.mach_vm_region_recurse.restype is c.c_int32
assert l.mach_port_deallocate.argtypes==[c.c_uint32,c.c_uint32]
assert l.mach_port_deallocate.restype is c.c_int32
`));
  test('Mach actual adapter resets count19 and fresh zeroed76 bytes on every query',()=>ok(NATIVE_PRELUDE+`
real_c.set_errno(23)
n=NativeReadPort(559);calls=[0]
def query(port,address,size,depth,info,count):
    assert port==42 and len(info)==19 and bytes(info)==bytes(76)
    assert count._obj.value==19 and address._obj.value==8192 and depth._obj.value==2
    for i,v in enumerate(struct.unpack('<19i',raw())):info[i]=v
    address._obj.value=12288;size._obj.value=4096;depth._obj.value=1
    calls[0]+=1;count._obj.value=18 if calls[0]==1 else 19
    return 0
lib.mach_vm_region_recurse=Fn(query)
assert n.query(8192,2)==(0,12288,4096,1,18,raw())
assert n.query(8192,2)==(0,12288,4096,1,19,raw())
n.close();n.close()
assert events==[('release',71,42)]
denied(lambda:n.query(8192,2))
`));
  test('Mach actual adapter releases uncertain returned right without borrowed self release',()=>ok(NATIVE_PRELUDE+`
def uncertain(self_port,pid,output):
    assert real_c.get_errno()==0;output._obj.value=42;real_c.set_errno(1);return -1
lib.task_read_for_pid=Fn(uncertain)
denied(lambda:NativeReadPort(559))
assert events==[('release',71,42)]
`));
  test('Mach acquisition refusal keeps finite stage and exact fresh kernel diagnostics',()=>ok(NATIVE_PRELUDE+`
def denied_acquire(self_port,pid,output):
    assert real_c.get_errno()==0;real_c.set_errno(13);return -1
lib.task_read_for_pid=Fn(denied_acquire)
try:NativeReadPort(559);raise AssertionError('denied port accepted')
except ValueError as e:
    assert e.details=={'nativeResult':-1,'nativeErrno':13}
assert events==[]
`));
  test('Mach uncertain acquisition plus failed release reports unsettled right without retry',()=>ok(NATIVE_PRELUDE+`
def uncertain(self_port,pid,output):
    assert real_c.get_errno()==0;output._obj.value=42;real_c.set_errno(13);return -1
def failed_release(self_port,port):
    events.append(('release',self_port,port));return 5
lib.task_read_for_pid=Fn(uncertain)
lib.mach_port_deallocate=Fn(failed_release)
try:NativeReadPort(559);raise AssertionError('unsettled right accepted')
except DiagnosticRefusal as e:
    assert e.stage=='read-port-close' and e.details=={}
assert events==[('release',71,42)]
`));
  test('Mach run distinguishes acquired-port close failure from initial acquisition',()=>ok(`
class FailedNative:
    def __init__(self,pid):self.n=0
    def query(self,a,d):self.n+=1;return (0,4096,4096,0,19,raw()) if self.n==1 else (1,0,0,0,0,b'')
    def close(self):raise ValueError('TASK6A_ORIGIN_MACH_RECON_REFUSED')
NativeReadPort=FailedNative
try:run();raise AssertionError('failed release accepted')
except ValueError as e:assert e.stage=='read-port-close'
`));
  test('Mach failure consumer detects missing raw length and protection guards in memory',()=>{
    const source=readFileSync(HELPER,'utf8');
    for(const [from,to,program] of [
      [' or len(raw) != 76','', 'denied(lambda:decode(raw()+bytes([0])))'],
      ['protection & maximum == protection','True','denied(lambda:decode(raw(maximumProtection=1)))'],
    ]){
      assert.equal(source.split(from).length,2);
      let mutant=source.replace(from,to);
      if(from===' or len(raw) != 76'){
        const unpack='struct.unpack("<iiiQIIIIIIHBBiiIHHIQ", raw)';
        assert.equal(mutant.split(unpack).length,2);
        mutant=mutant.replace(unpack,'struct.unpack("<iiiQIIIIIIHBBiiIHHIQ", raw[:76])');
      }
      const r=exercise(program,{source:mutant});
      assert.notEqual(r.status,0,'consumer accepted a coherent unsafe in-memory mutation');
      assert.match(r.stderr,/unsafe Mach diagnostic unexpectedly accepted/);
    }
  });
  test('Mach actual adapter burns a failed release and never retries or queries it',()=>ok(NATIVE_PRELUDE+`
n=NativeReadPort(559)
def failed(self_port,port):events.append(('release',self_port,port));return 5
lib.mach_port_deallocate=Fn(failed)
denied(n.close)
n.close();denied(lambda:n.query(0,0))
assert events==[('release',71,42)]
`));
  test('Mach owned target lifecycle runs real Perl with fake native boundary only',()=>ok(`
class FakeNative:
    def __init__(self,pid): assert pid>1;self.calls=0
    def query(self,a,d):
        self.calls+=1
        return (0,4096,4096,0,19,raw()) if self.calls==1 else (1,0,0,0,0,b'')
    def close(self): pass
NativeReadPort=FakeNative
r=run()
assert r['targetDefinitelyReaped'] is True and r['streamsDefinitelyClosed'] is True
assert r['readPortDefinitelyClosed'] is True and r['productionAuthority'] is False
assert r['leafCount']==1
`));
  for(const [name,bridge] of [['acquisition',`
class FailedNative:
    def __init__(self,pid): raise ValueError('TASK6A_ORIGIN_MACH_RECON_REFUSED')
`],['release',`
class FailedNative:
    def __init__(self,pid):self.n=0
    def query(self,a,d):self.n+=1;return (0,4096,4096,0,19,raw()) if self.n==1 else (1,0,0,0,0,b'')
    def close(self):raise ValueError('TASK6A_ORIGIN_MACH_RECON_REFUSED')
`]])
    test('Mach target definitely settles after read-port '+name+' refusal',()=>ok(`
created=[];real=subprocess.Popen
def spawn(*args,**kwargs):p=real(*args,**kwargs);created.append(p);return p
subprocess.Popen=spawn
`+bridge+`
NativeReadPort=FailedNative
denied(run)
assert len(created)==1 and created[0].poll()==0
assert all(s.closed for s in (created[0].stdin,created[0].stdout,created[0].stderr))
`));
  for(const [name,code] of [['real root','os.getuid=lambda:0'],['effective root','os.geteuid=lambda:0'],['wrong host',"sys.platform='linux'"],['caller PID',"sys.argv=['helper','123']"],['UID mismatch','os.geteuid=lambda:os.getuid()+1']])
    test('Mach entry refuses '+name+' before target or native call',()=>ok(code+`
def forbidden(*args,**kwargs):raise AssertionError('external boundary crossed')
subprocess.Popen=forbidden
NativeReadPort=forbidden
denied(run)
`));
  test('Mach pure suite is reached by the actual npm graph and executes a real leaf',()=>{
    const root=new URL('../../',import.meta.url),pkg=JSON.parse(readFileSync(new URL('package.json',root),'utf8'));
    const target='scripts/__tests__/task6a-origin-mach-recon-v2.test.js';
    function reached(scripts){
      const pending=['test'],seen=new Set(),selectors=[];
      while(pending.length){
        const name=pending.pop();if(seen.has(name))continue;seen.add(name);
        const cmd=scripts[name];assert.equal(typeof cmd,'string');
        for(const m of cmd.matchAll(/\bnpm run ([a-zA-Z0-9:_-]+)/g))pending.push(m[1]);
        if(/\bnode\b[^&]*--test\b/.test(cmd))for(const m of cmd.matchAll(/(?:tests|scripts)\/[a-zA-Z0-9_./*-]+\.test\.(?:js|ts)/g))selectors.push(m[0]);
      }
      assert.ok(selectors.some(x=>new RegExp('^'+x.replace(/[.+?^${}()|[\]\\]/g,'\\$&').replace(/\*/g,'[^/]*')+'$').test(target)),'default graph omitted Mach pure suite');
    }
    reached(pkg.scripts);
    assert.throws(()=>reached({...pkg.scripts,'test:scripts':'node --test scripts/elsewhere/*.test.js'}),/omitted Mach pure/);
    const r=spawnSync(process.execPath,['--test','--test-name-pattern=^Mach decoder preserves actual pack4 v2 fields',target],
      {cwd:root,env:ENV,timeout:5000,maxBuffer:65536,encoding:'utf8'});
    assert.equal(r.error,undefined);assert.equal(r.signal,null);assert.equal(r.status,0,r.stdout+r.stderr);
    assert.match(r.stdout,/(?:ℹ|#) pass 1\b/);assert.match(r.stdout,/(?:ℹ|#) skipped 0\b/);
  });
}
