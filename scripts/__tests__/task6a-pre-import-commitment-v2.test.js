import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import test from 'node:test';

const BOOTSTRAP=new URL('../task6a-protected-origin-bootstrap-v2.pl',import.meta.url);
const GUARD=String.raw`# Cold entry stays closed before any candidate PM/XS import.
BEGIN {
    CORE::print STDERR "TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n";
    CORE::exit(2);
}
`;
const ordinary=process.platform==='darwin'&&process.getuid?.()!==0
  &&process.getuid?.()===process.geteuid?.();
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
function once(source,from,to) {
  assert.equal(source.split(from).length,2,`unique disclosed memory substitution: ${from}`);
  return source.replace(from,()=>to);
}
function capture(original,program,maintained=false) {
  assert.ok(ordinary,'ordinary Darwin only; no privileged or host fallback');
  const home=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'task6a-preimport-commitment.'));
  fs.writeFileSync(home+'/program.pl',program,{flag:'wx',mode:0o600});
  const args=maintained?['-f',BOOTSTRAP.pathname]:['-f','-'];
  fs.writeFileSync(home+'/creation.json',JSON.stringify({scope:'ordinary mathematical bytes only',
    executable:'/usr/bin/perl',args,cwd:'/',env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'},
    originalSHA256:digest(original),programSHA256:digest(program),maintained})+'\n',{flag:'wx',mode:0o600});
  const child=spawnSync('/usr/bin/perl',args,{cwd:'/',input:maintained?undefined:program,
    env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'},encoding:'utf8',maxBuffer:65536});
  fs.writeFileSync(home+'/stdout.log',child.stdout??'',{flag:'wx',mode:0o600});
  fs.writeFileSync(home+'/stderr.log',child.stderr??'',{flag:'wx',mode:0o600});
  fs.writeFileSync(home+'/terminal.json',JSON.stringify({pid:child.pid,status:child.status,
    signal:child.signal,error:child.error?.code??null})+'\n',{flag:'wx',mode:0o600});
  // Every original and output is retained before fallible terminal assertions.
  assert.equal(child.error,undefined);assert.equal(child.signal,null);
  return {child,home};
}

test('private pre-import checker support is mechanical, never material or Root admission',()=>{
  const source=fs.readFileSync(BOOTSTRAP,'utf8');
  assert.ok(source.includes('my $preimport_sha256;'),'missing private commitment support');
  assert.ok(source.indexOf('$preimport_sha256=sub {')<source.indexOf('use strict;'));
});

test('maintained cold entry refuses before checker and all candidate imports',(t)=>{
  const source=fs.readFileSync(BOOTSTRAP,'utf8');
  const {child,home}=capture(source,source,true);
  assert.equal(child.status,2);assert.equal(child.stdout,'');
  assert.equal(child.stderr,'TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n');
  t.diagnostic(JSON.stringify({scope:'maintained cold refusal only',home,pid:child.pid}));
});

test('CORE byte commitments run in BEGIN before use and match independent standard oracles',(t)=>{
  const original=fs.readFileSync(BOOTSTRAP,'utf8');
  assert.ok(original.includes('my $preimport_sha256;'),'missing private commitment support');
  const vectors=[
    {name:'empty',expression:"''",bytes:Buffer.alloc(0),
      expected:'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'},
    {name:'nist-abc',expression:"'abc'",bytes:Buffer.from('abc'),
      expected:'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'},
    {name:'nist-two-block',expression:"'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'",
      bytes:Buffer.from('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'),
      expected:'248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1'},
  ];
  // All short padding residues, further block boundaries and the admitted cap.
  for(const length of [...Array.from({length:131},(_,i)=>i),255,256,257,511,512,513,
    4095,4096,4097,65535,271712,524287,524288]) {
    const bytes=Buffer.alloc(length);
    for(let i=0;i<length;i++)bytes[i]=i%256;
    vectors.push({name:`binary-${length}`,bytes,
      expression:`CORE::substr(CORE::pack('C*',0..255) x ${Math.ceil(length/256)},0,${length})`});
  }
  const calls=vectors.map(v=>`CORE::print '${v.name}',"\t",$preimport_sha256->(${v.expression}),"\n";`).join('\n');
  const invalid=[['missing',''],['extra',"'a','b'"],['undefined','undef'],['array','[]'],
    ['hash','{}'],['code','sub {}'],['blessed',"CORE::bless({},'TestOnlyRef')"],
    ['over-cap',"'x' x 524289"],['unicode',"CORE::chr(256)"]];
  const refusals=invalid.map(([name,args])=>`{
    my $ok=eval {$preimport_sha256->(${args});1};my $error=$@;
    CORE::print 'refuse-${name}',"\t",(!$ok&&$error eq "TASK6A_PREIMPORT_BYTES_REFUSED\n"?1:0),"\n";
  }`).join('\n');
  const probe=String.raw`BEGIN {
    package Task6aCommitmentTestTie;
    our $fetches=0;
    sub TIESCALAR { CORE::bless({},$_[0]); }
    sub FETCH { $fetches++;return 'abc'; }
}
BEGIN {
    CORE::die "TEST_IMPORTED_TOO_EARLY\n" if CORE::keys(%INC);
    CORE::print "before-inc\t",scalar(CORE::keys(%INC)),"\n";
`+calls+'\n'+refusals+String.raw`
    my $upgraded='abc';utf8::upgrade($upgraded);
    my $ok=eval {$preimport_sha256->($upgraded);1};my $error=$@;
    CORE::print "refuse-utf8-ascii\t",(!$ok&&$error eq "TASK6A_PREIMPORT_BYTES_REFUSED\n"?1:0),"\n";
    my $tied;CORE::tie($tied,'Task6aCommitmentTestTie');
    my $tie_ok=eval {$preimport_sha256->($tied);1};my $tie_error=$@;
    CORE::print "tied-refused\t",(!$tie_ok&&$tie_error eq "TASK6A_PREIMPORT_BYTES_REFUSED\n"?1:0),"\n";
    CORE::print "tied-fetches\t",$Task6aCommitmentTestTie::fetches,"\n";
    CORE::print "after-checker-inc\t",scalar(CORE::keys(%INC)),"\n";
}
CHECK { CORE::print "after-import-inc\t",scalar(CORE::keys(%INC)),"\n"; }
`;
  let program=once(original,GUARD,String.raw`BEGIN {
    CORE::die "TEST_ORDINARY_ONLY\n" unless $^O eq 'darwin'&&$<!=0&&$<==$>&&@ARGV==0;
}
`);
  program=once(program,'use strict;\n',probe+'use strict;\n');
  program=once(program,'\ntask6a_origin_main();\n',String.raw`
CORE::print "runtime-abc\t",$preimport_sha256->('abc'),"\n";
{
    no warnings 'redefine';
    my $foreign_calls=0;
    local *utf8::is_utf8=sub {$foreign_calls++;return 0;};
    my $flagged='abc';utf8::upgrade($flagged);
    my $ok=eval {$preimport_sha256->($flagged);1};my $error=$@;
    CORE::print "late-utf8-refused\t",(!$ok&&$error eq "TASK6A_PREIMPORT_BYTES_REFUSED\n"?1:0),"\n";
    CORE::print "late-foreign-calls\t",$foreign_calls,"\n";
}
`);
  const {child,home}=capture(original,program);
  assert.equal(child.status,0,child.stdout+child.stderr);assert.equal(child.stderr,'');
  const rows=child.stdout.trim().split('\n').map(row=>row.split('\t'));
  assert.ok(rows.every(row=>row.length===2),'only bounded tabular mathematical output');
  const observed=new Map(rows);
  assert.equal(observed.size,rows.length,'no duplicate observation keys');
  assert.equal(observed.get('before-inc'),'0');assert.equal(observed.get('after-checker-inc'),'0');
  assert.ok(Number(observed.get('after-import-inc'))>0,'actual later fixed imports occurred');
  for(const v of vectors) {
    const expected=digest(v.bytes);
    if(v.expected)assert.equal(expected,v.expected,`published vector ${v.name}`);
    assert.equal(observed.get(v.name),expected,v.name);
    // Independent oracle update partitions, not a checker streaming claim.
    for(const partition of [1,7,64,127]) {
      const oracle=createHash('sha256');
      for(let start=0;start<v.bytes.length;start+=partition)oracle.update(v.bytes.subarray(start,start+partition));
      assert.equal(oracle.digest('hex'),expected,`${v.name} oracle partition ${partition}`);
    }
  }
  for(const [name] of invalid)assert.equal(observed.get(`refuse-${name}`),'1',name);
  assert.equal(observed.get('refuse-utf8-ascii'),'1');
  assert.equal(observed.get('tied-refused'),'1','tied input cannot yield a digest');
  assert.equal(observed.get('tied-fetches'),'0','tied FETCH cannot run inside checker');
  assert.equal(observed.get('runtime-abc'),vectors[1].expected,'compile-time private CODE survives runtime');
  assert.equal(observed.get('late-utf8-refused'),'1','late namespace replacement cannot admit flagged bytes');
  assert.equal(observed.get('late-foreign-calls'),'0','checker calls only its retained original CORE primitive');
  fs.writeFileSync(home+'/witness.json',JSON.stringify({scope:'ordinary mathematical bytes; no custody/Root authority',
    vectors:vectors.map(v=>({name:v.name,bytes:v.bytes.length,expected:digest(v.bytes)})),
    observed:Object.fromEntries(observed)},null,2)+'\n',{flag:'wx',mode:0o600});
  t.diagnostic(JSON.stringify({scope:'ordinary mathematical bytes and BEGIN order only',home,
    pid:child.pid,vectors:vectors.length,refusals:invalid.length+3,foreignCalls:0,tiedFetches:0}));
});
