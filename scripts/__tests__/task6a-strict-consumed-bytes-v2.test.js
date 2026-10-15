import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import test from 'node:test';

const BOOTSTRAP=new URL('../task6a-protected-origin-bootstrap-v2.pl',import.meta.url);
const STRICT='/System/Library/Perl/5.34/strict.pm';
const PIN='f1296224730dceb5dd308ee1e72c452c8b13ced7f3bf742ccd16e1e1c416bcb5';
const GUARD=String.raw`# Cold entry stays closed before any candidate PM/XS import.
BEGIN {
    CORE::print STDERR "TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n";
    CORE::exit(2);
}
`;
const ordinary=process.platform==='darwin'&&process.getuid?.()!==0
  &&process.getuid?.()===process.geteuid?.();
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const names=['$strict_completed_readback','$strict_loader_install','$strict_loader_recheck'];
function once(source,from,to) {
  assert.equal(source.split(from).length,2,`unique disclosed memory substitution: ${from}`);
  return source.replace(from,()=>to);
}
function quote(value) {return "'"+value.replaceAll('\\','\\\\').replaceAll("'","\\'")+"'";}
const counterfeit=String.raw`package strict;
$strict::VERSION='MODELED_PMC';
sub import {$^H|=0x602;}
1;
`;

const tieDefinitions=String.raw`BEGIN {
    package Task6aStrictTie;
    our $calls=0;
    sub TIESCALAR {CORE::bless({},$_[0]);}
    sub TIEHASH {CORE::bless({},$_[0]);}
    sub TIEARRAY {CORE::bless({},$_[0]);}
    sub FETCH {$calls++;return 'FOREIGN';}
    sub FETCHSIZE {$calls++;return 0;}
    sub EXISTS {$calls++;return 0;}
}
`;
function tieAlter(mode) {
  return mode==='tied-inc'?"CORE::tie(%INC,'Task6aStrictTie');\n"
    :mode==='tied-inc-array'?"CORE::tie(@INC,'Task6aStrictTie');\n"
    :mode==='tied-main'?"CORE::tie(%main::,'Task6aStrictTie');\n":'';
}

function invoke(mode='healthy',options={}) {
  assert.ok(ordinary,'ordinary Darwin only; no privileged/non-native fallback');
  const original=fs.readFileSync(BOOTSTRAP,'utf8');
  if(mode!=='pathname-companion')for(const name of names)assert.ok(original.includes(name),`missing private support ${name}`);
  const native=fs.readFileSync(STRICT);assert.equal(native.length,4783);assert.equal(sha(native),PIN);
  const home=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'task6a-strict-consumed.'));
  const candidate=options.candidate??native;assert.equal(candidate.length,4783);
  const fixture=home+'/strict.pm';fs.writeFileSync(fixture,candidate,{flag:'wx',mode:0o600});
  fs.writeFileSync(home+'/native-readback.input',native,{flag:'wx',mode:0o600});
  let source=once(original,GUARD,String.raw`BEGIN {
    CORE::die "TEST_ORDINARY_ONLY\n" unless $^O eq 'darwin'&&$<!=0&&$<==$>&&@ARGV==0;
}
`);
  source=once(source,'\ntask6a_origin_main();\n','\n');
  const reader=String.raw`
    my ($fh,$opened,$read,$bytes,$closed);
    my $ok=eval {
        $opened=CORE::sysopen($fh,TEST_PATH,0x01000100);
        CORE::die "TEST_OPEN\n" unless $opened;
        $read=CORE::sysread($fh,$bytes,8192);
        CORE::die "TEST_READ\n" unless defined($read)&&$read==4783;1;
    };my $failure=$@;my $close_ok=eval {$closed=CORE::close($fh);1;} if $opened;
    CORE::die $failure unless $ok;
    CORE::die "TEST_CLOSE\n" unless $close_ok&&$closed&&!defined(CORE::fileno($fh));
`.replace('TEST_PATH',quote(fixture));
  const replaceFiles=`
    for my $path(${quote(fixture)},${quote(home+'/strict.pmc')}) {
        CORE::open(my $changed,'>',$path) or CORE::die "TEST_WINDOW_OPEN\\n";
        CORE::print {$changed} ($path eq ${quote(fixture)}?${quote(counterfeit.replace('MODELED_PMC','MODELED_PM'))}:${quote(counterfeit)}) or CORE::die "TEST_WINDOW_WRITE\\n";
        CORE::close($changed) or CORE::die "TEST_WINDOW_CLOSE\\n";
    }
`;
  let prelude,after;
  if(mode==='pathname-companion') {
    prelude='BEGIN {\n'+reader+replaceFiles+`CORE::unshift(@INC,${quote(home)});\n}\n`;
    after=String.raw`BEGIN {
    CORE::print "companion-version\t",$strict::VERSION,"\n";
    CORE::print "companion-cache\t",$INC{'strict.pm'},"\n";
    CORE::exit(0);
}
`;
  } else {
    const early=['missing','corrupt','utf8','zero-class','pre-cache','pre-stash','install-arity','tied-readback','tied-inc','tied-inc-array','tied-main'].includes(mode);
    const alter=mode==='missing'?'$bytes=undef;':mode==='corrupt'?"$bytes=CORE::substr($bytes,0,-1).'!';"
      :mode==='utf8'?'utf8::upgrade($bytes);'
      :mode==='zero-class'?"$bytes=CORE::bless({},'0');"
      :mode==='pre-cache'?"$INC{'strict.pm'}='MODEL_TRUTHY_CACHE';"
      :mode==='pre-stash'?"$main::{'strict::'}=\*STDOUT;":'';
    prelude=tieDefinitions+'BEGIN {\n'+reader+'my $good_bytes=$bytes;\n'+alter+tieAlter(mode)+(mode==='window'?`CORE::unshift(@INC,${quote(home)});\n`:'')+String.raw`
    $strict_completed_readback=$bytes;
    TIE_READBACK
    my $ok=eval {INSTALL_CALL;1};my $error=$@;
    CORE::print "install\t",$ok?1:0,"\n";
`.replace('TIE_READBACK',mode==='tied-readback'?"CORE::tie($strict_completed_readback,'Task6aStrictTie');":'').replace('INSTALL_CALL',mode==='install-arity'?'$strict_loader_install->(undef)':'$strict_loader_install->()')
      +(early?String.raw`
    CORE::untie($strict_completed_readback) if defined(CORE::tied($strict_completed_readback));
    CORE::untie(%INC) if defined(CORE::tied(%INC));
    CORE::untie(@INC) if defined(CORE::tied(@INC));
    CORE::untie(%main::) if defined(CORE::tied(%main::));
    CORE::delete($INC{'strict.pm'});CORE::delete($main::{'strict::'});
    $strict_completed_readback=$good_bytes;
    my $again=eval {$strict_loader_install->();1};
    CORE::print "install-repeat\t",$again?1:0,"\n";
    CORE::print "tie-callbacks\t",$Task6aStrictTie::calls,"\n";
    CORE::exit(0);
`:'CORE::die $error unless $ok;\n')
      +(mode==='window'?replaceFiles:'')+(mode==='late-original'?"$strict_completed_readback='ALTERED_ORIGINAL';\n":'')+'}\n';
    after=String.raw`BEGIN {
    CORE::print "real-version\t",$strict::VERSION,"\n";
    CORE::print "strict-hints\t",$^H&0x602,"\n";
    CORE::print "cache-type\t",CORE::ref($INC{'strict.pm'}),"\n";
    my $ok=eval {$strict_loader_recheck->();1};
    CORE::print "cache-check\t",$ok?1:0,"\n";
}
`;
    if(mode==='cache-replace'||mode==='cache-clear') {
      after+=String.raw`BEGIN {
    my $cache_original=$INC{'strict.pm'};
    CACHE_CHANGE
    my $ok=eval {$strict_loader_recheck->();1};
    CORE::print "changed-cache-check\t",$ok?1:0,"\n";
    $INC{'strict.pm'}=$cache_original;
    my $restored=eval {$strict_loader_recheck->();1};
    CORE::print "changed-restored-check\t",$restored?1:0,"\n";
    my $again=eval {$strict_loader_install->();1};
    CORE::print "changed-reinstall\t",$again?1:0,"\n";
    CORE::exit(0);
}
`.replace('CACHE_CHANGE',mode==='cache-replace'?"$INC{'strict.pm'}='MODEL_TRUTHY_REPLACEMENT';":"CORE::delete($INC{'strict.pm'});");
    } else after+=String.raw`use strict;
BEGIN {
    my $ok=eval {$strict_loader_recheck->();1};
    CORE::print "repeat-cache-check\t",$ok?1:0,"\n";
}
`;
  }
  source=once(source,'use strict;\n',prelude+(options.beforeUse??'')+'use strict;\n'+(options.afterUse??'')+after);
  // Alternate commitment is a loader-only model. The separate native issuer
  // keeps its fixed genuine commitment and is never invoked by these cases.
  if(options.candidate)source=once(source,"$refuse->() unless $ok&&$digest eq\n            '"+PIN+"';",
    "$refuse->() unless $ok&&$digest eq\n            '"+sha(candidate)+"';");
  if(options.mutate)source=options.mutate(source);
  // Full attempted module is retained. Readback/path/ACL/initial-runtime trust
  // are explicit MODELS; genuine native file bytes and compilation are actual.
  fs.writeFileSync(home+'/program.pl',source,{flag:'wx',mode:0o600});
  fs.writeFileSync(home+'/creation.json',JSON.stringify({mode,scope:'ordinary compiler bytes with MODEL readback authentication',
    originalSHA256:sha(original),programSHA256:sha(source),fixture,nativeReadbackSHA256:sha(native),
    candidateSHA256:sha(candidate),modeledAlternateCommitment:!!options.candidate,
    executable:'/usr/bin/perl',args:['-f',home+'/program.pl'],cwd:'/',env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'}})+'\n',{flag:'wx',mode:0o600});
  const child=spawnSync('/usr/bin/perl',['-f',home+'/program.pl'],{cwd:'/',
    env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'},encoding:'utf8',maxBuffer:262144});
  fs.writeFileSync(home+'/stdout.log',child.stdout??'',{flag:'wx',mode:0o600});
  fs.writeFileSync(home+'/stderr.log',child.stderr??'',{flag:'wx',mode:0o600});
  fs.writeFileSync(home+'/terminal.json',JSON.stringify({pid:child.pid,status:child.status,signal:child.signal,
    error:child.error?.code??null})+'\n',{flag:'wx',mode:0o600});
  fs.writeFileSync(home+'/fixture-after.json',JSON.stringify({pmSHA256:sha(fs.readFileSync(fixture)),pmcSHA256:fs.existsSync(home+'/strict.pmc')?sha(fs.readFileSync(home+'/strict.pmc')):null})+'\n',{flag:'wx',mode:0o600});
  assert.equal(child.error,undefined);assert.equal(child.signal,null);assert.equal(child.status,0,child.stdout+child.stderr);
  assert.equal(child.stderr,'');
  const rows=child.stdout.trim().split('\n').map(row=>row.split('\t'));
  assert.ok(rows.every(row=>row.length===2));assert.equal(new Set(rows.map(row=>row[0])).size,rows.length);const observations=Object.fromEntries(rows);
  fs.writeFileSync(home+'/witness.json',JSON.stringify({mode,pid:child.pid,observations,
    fixtureAfterSHA256:sha(fs.readFileSync(fixture)),scope:'ordinary compiler only; no Root/readback admission'})+'\n',{flag:'wx',mode:0o600});
  return {observations,home,pid:child.pid};
}

test('strict private mechanism support is mechanical and grants no production issuer',()=>{
  const source=fs.readFileSync(BOOTSTRAP,'utf8');
  for(const name of names)assert.ok(source.includes(name),`missing private support ${name}`);
});

test('armed ordinary pathname companion consumes replaced pmc rather than captured bytes',(t)=>{
  const result=invoke('pathname-companion');assert.equal(result.observations['companion-version'],'MODELED_PMC');
  assert.equal(result.observations['companion-cache'],result.home+'/strict.pm');t.diagnostic(JSON.stringify(result));
});

for(const mode of ['healthy','window','late-original'])test(`actual strict compiler receives private captured bytes: ${mode}`,(t)=>{
  const result=invoke(mode),o=result.observations;assert.equal(o.install,'1');assert.equal(o['real-version'],'1.12');
  assert.equal(o['strict-hints'],'1538');assert.equal(o['cache-type'],'CODE');assert.equal(o['cache-check'],'1');
  assert.equal(o['repeat-cache-check'],'1');t.diagnostic(JSON.stringify(result));
});

for(const mode of ['missing','corrupt','utf8','zero-class','pre-cache','pre-stash','install-arity','tied-readback','tied-inc','tied-inc-array','tied-main'])
  test(`strict installer refuses before selection: ${mode}`,(t)=>{
    const result=invoke(mode);assert.equal(result.observations.install,'0');
    assert.equal(result.observations['install-repeat'],'0');assert.equal(result.observations['tie-callbacks'],'0');t.diagnostic(JSON.stringify(result));
  });

for(const mode of ['cache-replace','cache-clear'])test(`explicit original cache recheck burns: ${mode}`,(t)=>{
  const result=invoke(mode),o=result.observations;assert.equal(o.install,'1');assert.equal(o['cache-check'],'1');
  assert.equal(o['changed-cache-check'],'0');assert.equal(o['changed-reinstall'],'0');assert.equal(o['changed-restored-check'],'0');t.diagnostic(JSON.stringify(result));
});

const emit=String.raw`
    CORE::print "probe-refused\t",(!$ok&&$error eq "TASK6A_STRICT_BYTES_REFUSED\n"?1:0),"\n";
    my $again=eval {$original->($original,'strict.pm');1};
    CORE::print "restored-refused\t",$again?0:1,"\n";
    CORE::print "callbacks\t",$Task6aStrictTie::calls,"\n";
    CORE::exit(0);
`;
const argumentProbes={
  'foreign-code':"my $foreign=sub {$Task6aStrictTie::calls++;};my $ok=eval {$original->($foreign,'strict.pm');1};",
  'blessed-CODE-hash':"my $foreign=CORE::bless({},'CODE');my $ok=eval {$original->($foreign,'strict.pm');1};",
  'numeric-original-address':"my $foreign=0+$original;my $ok=eval {$original->($foreign,'strict.pm');1};",
  'native-arity':"my $ok=eval {$original->($original);1};",
  'tied-native-self':"my $foreign;CORE::tie($foreign,'Task6aStrictTie');my $ok=eval {$original->($foreign,'strict.pm');1};",
  'tied-native-filename':"my $filename;CORE::tie($filename,'Task6aStrictTie');my $ok=eval {$original->($original,$filename);1};",
  'utf8-native-filename':"my $filename='strict.pm';utf8::upgrade($filename);my $ok=eval {$original->($original,$filename);1};",
  'reference-native-filename':"my $ok=eval {$original->($original,[]);1};",
  'empty-native-filename':"my $ok=eval {$original->($original,'');1};",
  'oversize-native-filename':"my $ok=eval {$original->($original,'x' x 4097);1};",
  'premature-recheck':"my $ok=eval {$strict_loader_recheck->();1};",
  'duplicate-install':"my $ok=eval {$strict_loader_install->();1};",
  'call-129':"for(1..128){$original->($original,'not-selected.pm');}my $ok=eval {$original->($original,'not-selected.pm');1};",
};
for(const [mode,body] of Object.entries(argumentProbes))test(`actual original hook rejects and burns: ${mode}`,(t)=>{
  const result=invoke(mode,{beforeUse:'BEGIN {my $original=$INC[0];\n'+body+'my $error=$@;\n'+emit+'}\n'});
  assert.equal(result.observations['probe-refused'],'1');assert.equal(result.observations['restored-refused'],'1');
  assert.equal(result.observations.callbacks,'0');t.diagnostic(JSON.stringify(result));
});

for(const change of ['clear','truthy','foreign-code','tied-cell','tied-inc','tied-inc-array'])test(`actual selected-cache change is observed: ${change}`,(t)=>{
  const changeCode=change==='clear'?"CORE::delete($INC{'strict.pm'});"
    :change==='truthy'?"$INC{'strict.pm'}='MODELED_TRUTHY';"
    :change==='foreign-code'?"$INC{'strict.pm'}=sub {$Task6aStrictTie::calls++;};"
    :change==='tied-inc'?"CORE::tie(%INC,'Task6aStrictTie');"
    :change==='tied-inc-array'?"CORE::tie(@INC,'Task6aStrictTie');"
    :"CORE::tie($INC{'strict.pm'},'Task6aStrictTie');";
  const result=invoke('selected-cache-'+change,{afterUse:String.raw`BEGIN {
    my $original=$INC[0];
`+changeCode+String.raw`
    my $ok=eval {$strict_loader_recheck->();1};my $error=$@;
    CORE::untie(%INC) if defined(CORE::tied(%INC));
    CORE::untie(@INC) if defined(CORE::tied(@INC));
    CORE::untie($INC{'strict.pm'}) if defined(CORE::tied($INC{'strict.pm'}));
    $INC{'strict.pm'}=$original;
    my $restored=eval {$strict_loader_recheck->();1};
    CORE::print "restored-same-check-refused\t",$restored?0:1,"\n";
`+emit+'}\n'});
  assert.equal(result.observations['probe-refused'],'1');assert.equal(result.observations['restored-refused'],'1');
  assert.equal(result.observations.callbacks,'0');assert.equal(result.observations['restored-same-check-refused'],'1');t.diagnostic(JSON.stringify(result));
});

test('cleared native cache attempts another actual require and is permanently refused',(t)=>{
  const result=invoke('actual-require-repeat',{afterUse:String.raw`BEGIN {
    my $original=$INC[0];CORE::delete($INC{'strict.pm'});
    my $ok=eval {require 'strict.pm';1};my $error=$@;
    CORE::print "repeat-require-refused\t",(!$ok&&CORE::index($error,'TASK6A_STRICT_BYTES_REFUSED')>=0?1:0),"\n";
    $INC{'strict.pm'}=$original;
    my $again=eval {$strict_loader_recheck->();1};
    CORE::print "restored-cache-refused\t",$again?0:1,"\n";CORE::exit(0);
}
`});
  assert.equal(result.observations['repeat-require-refused'],'1');assert.equal(result.observations['restored-cache-refused'],'1');
  t.diagnostic(JSON.stringify(result));
});

test('private compiler-SV corruption is refused before actual compilation',(t)=>{
  const result=invoke('late-compiler-corruption',{
    mutate:s=>once(s,'        $validate->($compiler_bytes);',String.raw`        $compiler_bytes=CORE::substr($compiler_bytes,0,-1).'!';
        $validate->($compiler_bytes);`),
    beforeUse:String.raw`BEGIN {
    my $original=$INC[0];my $ok=eval {require 'strict.pm';1};my $error=$@;
    CORE::print "compiler-refused\t",(!$ok&&CORE::index($error,'TASK6A_STRICT_BYTES_REFUSED')>=0?1:0),"\n";
    my $again=eval {$original->($original,'strict.pm');1};
    CORE::print "restored-compiler-refused\t",$again?0:1,"\n";
    CORE::print "strict-namespace-absent\t",CORE::exists($main::{'strict::'})?0:1,"\n";
    CORE::exit(0);
}
`});
  assert.equal(result.observations['compiler-refused'],'1');assert.equal(result.observations['restored-compiler-refused'],'1');
  assert.equal(result.observations['strict-namespace-absent'],'1');t.diagnostic(JSON.stringify(result));
});

test('noAMAGIC helper refuses a genuinely overloaded candidate without callback and restores outside hints',(t)=>{
  const result=invoke('overloaded-native-self',{afterUse:String.raw`{
    package Task6aStrictOverload;
    use overload '=='=>sub {$Task6aStrictTie::calls++;return 1;},
        '0+'=>sub {$Task6aStrictTie::calls++;return 1;},
        '""'=>sub {$Task6aStrictTie::calls++;return 'CODE';},
        '&{}'=>sub {$Task6aStrictTie::calls++;return sub {};},fallback=>1;
}
BEGIN {
    my $original=$INC[0];my $foreign=CORE::bless({},'Task6aStrictOverload');
    my $armed=$foreign==$original;
    CORE::print "outside-overload-armed\t",($armed&&$Task6aStrictTie::calls==1)?1:0,"\n";
    CORE::print "outside-noamagic\t",($^H&0x01000000)?1:0,"\n";
    $Task6aStrictTie::calls=0;
    my $ok=eval {$original->($foreign,'strict.pm');1};my $error=$@;
`+emit+'}\n'});
  assert.equal(result.observations['outside-overload-armed'],'1');assert.equal(result.observations['outside-noamagic'],'0');
  assert.equal(result.observations['probe-refused'],'1');assert.equal(result.observations.callbacks,'0');
  assert.equal(result.observations['restored-refused'],'1');t.diagnostic(JSON.stringify(result));
});

for(const failure of ['throw','false'])test(`actual native compiler failure stays separate from selection: MODELED ${failure}`,(t)=>{
  const prefix='CORE::print "modeled-compiler-entered\\t1\\n";\n';
  const ending=failure==='throw'?'CORE::die "MODELED_COMPILER_THROW\\n";\n':'0;\n';
  const candidate=Buffer.from(prefix+'#'+'x'.repeat(4783-Buffer.byteLength(prefix+ending)-2)+'\n'+ending);
  const result=invoke('modeled-compiler-'+failure,{candidate,beforeUse:String.raw`BEGIN {
    my $original=$INC[0];my $ok=eval {require 'strict.pm';1};my $error=$@;
    CORE::print "actual-compiler-failed\t",$ok?0:1,"\n";
    CORE::print "actual-error-matched\t",CORE::index($error,EXPECTED_ERROR)>=0?1:0,"\n";
    my $check=eval {$strict_loader_recheck->();1};my $check_error=$@;
    CORE::print "native-cache-croak\t",CORE::index($check_error,'non-creatable hash value')>=0?1:0,"\n";
    CORE::print "failure-cache-refused\t",$check?0:1,"\n";
    CORE::delete($INC{'strict.pm'});$INC{'strict.pm'}=$original;
    my $again=eval {$strict_loader_recheck->();1};
    CORE::print "restored-failure-refused\t",$again?0:1,"\n";CORE::exit(0);
}
`.replace('EXPECTED_ERROR',quote(failure==='throw'?'MODELED_COMPILER_THROW':'did not return a true value'))});
  for(const key of ['modeled-compiler-entered','actual-compiler-failed','actual-error-matched','failure-cache-refused','restored-failure-refused'])
    assert.equal(result.observations[key],'1',key);
  t.diagnostic(JSON.stringify(result));
});

test('instrumented actual compiler handoff records its bytes separately from post-handoff mutation',(t)=>{
  const result=invoke('compiler-byte-observation',{
    mutate:s=>once(once(s,'my ($strict_completed_readback,$strict_loader_install,$strict_loader_recheck);',
      'my $test_observed_compiler;\nmy ($strict_completed_readback,$strict_loader_install,$strict_loader_recheck);'),
      '        return \\$compiler_bytes;',String.raw`        CORE::print "handoff-sha\t",$preimport_sha256->($compiler_bytes),"\n";
        $test_observed_compiler=\$compiler_bytes; # disclosed observer-only extra reference
        return \$compiler_bytes;`),
    afterUse:String.raw`BEGIN {
    CORE::print "post-compiler-sha\t",$preimport_sha256->($$test_observed_compiler),"\n";
    CORE::print "post-compiler-length\t",CORE::length($$test_observed_compiler),"\n";
}
`});
  assert.equal(result.observations['handoff-sha'],PIN);
  assert.equal(result.observations['post-compiler-sha'],PIN);
  assert.equal(result.observations['post-compiler-length'],'4783');t.diagnostic(JSON.stringify(result));
});

test('call128 may select exactly once and actual strict semantics survive at the bound',(t)=>{
  const result=invoke('call128-selected',{
    beforeUse:String.raw`BEGIN {
    my $original=$INC[0];for(1..127){$original->($original,'not-selected.pm');}
}
`,afterUse:String.raw`BEGIN {
    CORE::print "bound-version\t",$strict::VERSION,"\n";
    CORE::print "bound-hints\t",$^H&0x602,"\n";
    my $ok=eval {$strict_loader_recheck->();1};CORE::print "bound-cache\t",$ok?1:0,"\n";
    CORE::exit(0);
}
`});
  assert.equal(result.observations['bound-version'],'1.12');assert.equal(result.observations['bound-hints'],'1538');
  assert.equal(result.observations['bound-cache'],'1');t.diagnostic(JSON.stringify(result));
});
