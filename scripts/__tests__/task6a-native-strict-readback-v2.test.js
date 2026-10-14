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
const sha=b=>createHash('sha256').update(b).digest('hex');
const names=['$strict_native_readback_issue','$strict_native_readback_recheck','$strict_native_readback_release'];
// Mutate only the original six-handle native block, never the later PM owner.
function inStrictNative(source,from,to) {
  const begin='# Inert fixed native readback prerequisite.';
  const end='# Inert fixed PM source-selection prerequisite.';
  assert.equal(source.split(begin).length,2);assert.equal(source.split(end).length,2);
  const a=source.indexOf(begin),z=source.indexOf(end);assert.ok(z>a);
  return source.slice(0,a)+once(source.slice(a,z),from,to)+source.slice(z);
}
function once(source,from,to) {
  assert.equal(source.split(from).length,2,'unique disclosed memory substitution');
  return source.replace(from,()=>to);
}
const ordinary=process.platform==='darwin'&&process.getuid?.()!==0&&process.getuid?.()===process.geteuid?.();
function invoke(mode='healthy',options={}) {
  assert.ok(ordinary,'ordinary Darwin only; no privileged/non-native fallback');
  const original=fs.readFileSync(BOOTSTRAP,'utf8');
  for(const name of names)assert.ok(original.includes(name),`missing private support ${name}`);
  const native=fs.readFileSync(STRICT);assert.equal(native.length,4783);assert.equal(sha(native),PIN);
  const home=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'task6a-native-strict-readback.'));
  fs.writeFileSync(home+'/genuine-strict.input',native,{flag:'wx',mode:0o600});
  let source=once(original,GUARD,String.raw`BEGIN {
    CORE::die "TEST_ORDINARY_ONLY\n" unless $^O eq 'darwin'&&$<!=0&&$<==$>&&@ARGV==0;
}
`);
  source=once(source,'\ntask6a_origin_main();\n','\n');
  const prior=mode.startsWith('prior-');
  const prelude='my $test_good_readback;\nBEGIN {\n'+(prior?String.raw`
    my ($fh,$bytes);CORE::sysopen($fh,'/System/Library/Perl/5.34/strict.pm',0x01000100) or CORE::die "TEST_PRIOR_OPEN\n";
    my $read=CORE::sysread($fh,$bytes,4784);my $closed=CORE::close($fh);
    CORE::die "TEST_PRIOR_READ\n" unless defined($read)&&$read==4783&&$closed;
    $strict_completed_readback=$bytes;
`+(mode==='prior-readback'?'':String.raw`
    $strict_loader_install->();
`)+(mode==='prior-installed-cleared'?'$strict_completed_readback=undef;\n':''):'')
    +String.raw`
    my $ok=eval {ISSUE;1};my $error=$@;CORE::print "issue\t",$ok?1:0,"\n";
`.replace('ISSUE',mode==='issue-arity'?'$strict_native_readback_issue->(undef)':'$strict_native_readback_issue->()')
    +(prior?String.raw`
    CORE::die "TEST_PRIOR_ADOPTED\n" if $ok;
    my $released=eval {$strict_native_readback_release->();1};
    CORE::print "unclaimed-release-returned\t",$released?1:0,"\n";
`+(mode==='prior-readback'?'$strict_loader_install->();\n':''):'CORE::die $error unless $ok;\n')
    +(!prior?'$test_good_readback=$strict_completed_readback;\n':'')+(options.afterIssue??'')
    +(!prior?String.raw`
    CORE::print "native-bytes\t",CORE::length($strict_completed_readback),"\n";
    CORE::print "native-sha\t",$preimport_sha256->($strict_completed_readback),"\n";
`:'')
    +(mode==='release-before-install'?String.raw`
    my $closed=eval {$strict_native_readback_release->();1};CORE::print "release\t",$closed?1:0,"\n";
    $strict_completed_readback=$test_good_readback;
    my $again=eval {$strict_loader_install->();1};CORE::print "restored-install\t",$again?1:0,"\n";CORE::exit(0);
`:'')
    +(mode==='issue-repeat'||mode==='recheck-arity'||mode==='release-arity'?String.raw`
    my $bad=eval {BAD_CALL;1};CORE::print "owned-fault\t",$bad?1:0,"\n";
    $strict_completed_readback=$test_good_readback;
    my $immediate=eval {$strict_loader_install->();1};CORE::print "immediate-restored-install\t",$immediate?1:0,"\n";
    my $closed=eval {$strict_native_readback_release->();1};
    CORE::print "owned-cleanup\t",$closed?1:0,"\n";
    $strict_completed_readback=$test_good_readback;
    my $again=eval {$strict_loader_install->();1};CORE::print "restored-install\t",$again?1:0,"\n";CORE::exit(0);
`.replace('BAD_CALL',mode==='issue-repeat'?'$strict_native_readback_issue->()':mode==='recheck-arity'?'$strict_native_readback_recheck->(undef)':'$strict_native_readback_release->(undef)'):'')
    +(!prior?'$strict_loader_install->();\n':'')+'}\n';
  const after=String.raw`BEGIN {
    CORE::print "version\t",$strict::VERSION,"\n";
    CORE::print "hints\t",$^H&0x602,"\n";
    my $cache=eval {$strict_loader_recheck->();1};CORE::print "cache\t",$cache?1:0,"\n";
`+(prior?'CORE::exit(0);\n':String.raw`
    my $checked=eval {$strict_native_readback_recheck->();1};CORE::print "native-recheck\t",$checked?1:0,"\n";
    my $closed=eval {$strict_native_readback_release->();1};CORE::print "release\t",$closed?1:0,"\n";
    my $repeated=eval {$strict_native_readback_release->();1};CORE::print "release-repeat\t",$repeated?1:0,"\n";
    $strict_completed_readback=$test_good_readback;
    my $again=eval {$strict_loader_recheck->();1};CORE::print "restored-cache\t",$again?1:0,"\n";
    CORE::exit(0);
`)+ '}\n';
  source=once(source,'use strict;\n',(options.definitions??'')+prelude+'use strict;\n'+(options.afterUse??'')+after);
  if(options.mutate)source=options.mutate(source,home);
  const program=home+'/program.pl';fs.writeFileSync(program,source,{flag:'wx',mode:0o600});
  const creation={mode,scope:'ordinary native fixed-file DATA; native/kernel/MAC/initial-runtime TCB assumption, no Root admission',
    originalSHA256:sha(original),programSHA256:sha(source),nativeInputSHA256:sha(native),executable:'/usr/bin/perl',
    args:['-f',program],cwd:'/',env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'}};
  fs.writeFileSync(home+'/creation.json',JSON.stringify(creation)+'\n',{flag:'wx',mode:0o600});
  const child=spawnSync(creation.executable,creation.args,{cwd:creation.cwd,env:creation.env,encoding:'utf8',maxBuffer:1048576});
  fs.writeFileSync(home+'/stdout.log',child.stdout??'',{flag:'wx',mode:0o600});
  fs.writeFileSync(home+'/stderr.log',child.stderr??'',{flag:'wx',mode:0o600});
  fs.writeFileSync(home+'/terminal.json',JSON.stringify({pid:child.pid,status:child.status,signal:child.signal,error:child.error?.code??null})+'\n',{flag:'wx',mode:0o600});
  assert.equal(child.error,undefined);assert.equal(child.signal,null);assert.equal(child.status,0,child.stdout+child.stderr);assert.equal(child.stderr,'');
  const rows=child.stdout.trim().split('\n').map(x=>x.split('\t'));assert.ok(rows.every(x=>x.length===2));
  assert.equal(new Set(rows.map(x=>x[0])).size,rows.length);const observations=Object.fromEntries(rows);
  fs.writeFileSync(home+'/witness.json',JSON.stringify({mode,pid:child.pid,observations,scope:creation.scope})+'\n',{flag:'wx',mode:0o600});
  return {home,pid:child.pid,observations};
}

test('native readback private support is mechanical, without production authority',()=>{
  const source=fs.readFileSync(BOOTSTRAP,'utf8');for(const name of names)assert.ok(source.includes(name),`missing private support ${name}`);
});

test('actual fixed native readback supplies real strict compiler bytes and releases its originals',(t)=>{
  const result=invoke(),o=result.observations;assert.equal(o.issue,'1');assert.equal(o['native-bytes'],'4783');assert.equal(o['native-sha'],PIN);
  assert.equal(o.version,'1.12');assert.equal(o.hints,'1538');assert.equal(o.cache,'1');assert.equal(o['native-recheck'],'1');
  assert.equal(o.release,'1');assert.equal(o['release-repeat'],'1');assert.equal(o['restored-cache'],'0');t.diagnostic(JSON.stringify(result));
});
for(const mode of ['prior-readback','prior-installed','prior-installed-cleared'])test(`preclaim refusal preserves genuine prior loader: ${mode}`,(t)=>{
  const result=invoke(mode),o=result.observations;assert.equal(o.issue,'0');assert.equal(o.version,'1.12');assert.equal(o.hints,'1538');assert.equal(o.cache,'1');t.diagnostic(JSON.stringify(result));
});
test('owned release revokes loader before restoring real completed bytes',(t)=>{
  const result=invoke('release-before-install');assert.equal(result.observations.issue,'1');assert.equal(result.observations.release,'1');
  assert.equal(result.observations['restored-install'],'0');t.diagnostic(JSON.stringify(result));
});
for(const mode of ['issue-repeat','recheck-arity','release-arity'])test(`owned invalid call revokes before real readback restoration: ${mode}`,(t)=>{
  const result=invoke(mode);assert.equal(result.observations.issue,'1');assert.equal(result.observations['owned-fault'],'0');assert.equal(result.observations['immediate-restored-install'],'0');
  assert.equal(result.observations['restored-install'],'0');t.diagnostic(JSON.stringify(result));
});

for(const kind of ['foreign-object','changed-plain'])test(`owned release preserves an unknown late handoff: ${kind}`,(t)=>{
  const result=invoke(kind,{afterIssue:String.raw`
    {package Task6aNativeForeign;our $destroyed=0;sub DESTROY {$destroyed++;}}
    $strict_completed_readback=HANDOFF;
    my $released=eval {$strict_native_readback_release->();1};
    CORE::print "unknown-preserved\t",PRESERVED?1:0,"\n";
    CORE::print "foreign-destroyed\t",$Task6aNativeForeign::destroyed,"\n";
    $strict_completed_readback=$test_good_readback;
    my $again=eval {$strict_loader_install->();1};CORE::print "unknown-restored-install\t",$again?1:0,"\n";
    CORE::exit(0);
`.replace('HANDOFF',kind==='foreign-object'?"CORE::bless({},'Task6aNativeForeign')":"'FOREIGN_PLAIN_HANDOFF'")
    .replace('PRESERVED',kind==='foreign-object'?"CORE::ref($strict_completed_readback) eq 'Task6aNativeForeign'":"defined($strict_completed_readback)&&$strict_completed_readback eq 'FOREIGN_PLAIN_HANDOFF'")});
  assert.equal(result.observations['unknown-preserved'],'1');assert.equal(result.observations['foreign-destroyed'],'0');
  assert.equal(result.observations['unknown-restored-install'],'0');t.diagnostic(JSON.stringify(result));
});

for(const kind of ['returned-true','wrong-literal','throw-after-effect'])test(`failed one-shot revocation cannot become successful after restoration: ${kind}`,(t)=>{
  const replacement=String.raw`my $test_revoke_original=$strict_loader_install;
        my $installer_original;
        $installer_original=sub {
            CORE::print "revocation-original-call\t1\n";
            $installer_original=$test_revoke_original;
            FAILURE
        };`.replace('FAILURE',kind==='returned-true'?'return 1;':kind==='wrong-literal'?'CORE::die "MODELED_WRONG_REFUSAL\\n";'
      :'eval {$test_revoke_original->(undef);1;};CORE::die "MODELED_AFTER_EFFECT\\n";');
  const result=invoke('revocation-'+kind,{mutate:s=>once(s,'my $installer_original=$strict_loader_install;',replacement),afterIssue:String.raw`
    my $first=eval {$strict_native_readback_release->();1};CORE::print "first-release\t",$first?1:0,"\n";
    my $again=eval {$strict_native_readback_release->();1};CORE::print "restored-same-release\t",$again?1:0,"\n";
    CORE::exit(0);
`});
  assert.equal(result.observations['revocation-original-call'],'1');assert.equal(result.observations['first-release'],'0');
  assert.equal(result.observations['restored-same-release'],'0');t.diagnostic(JSON.stringify(result));
});

const resultMutations={
  'open-numeric-prefix':["$opened=CORE::sysopen($fh,$path,0x01000100);","$opened=CORE::sysopen($fh,$path,0x01000100);$opened='1junk';"],
  'syscall-nonnumeric':["$result=CORE::syscall(228,$fd,$attributes,$buffer,8192,4);","$result=CORE::syscall(228,$fd,$attributes,$buffer,8192,4);$result='garbage';"],
  'read-numeric-prefix':["$count=CORE::sysread($handle,$bytes,4784);","$count=CORE::sysread($handle,$bytes,4784);$count='4783junk';"],
  'eof-nonnumeric':["$eof=CORE::sysread($handle,$extra,1);","$eof=CORE::sysread($handle,$extra,1);$eof='garbage';"],
  'seek-nonnumeric':["$offset=CORE::sysseek($handle,0,0);","$offset=CORE::sysseek($handle,0,0);$offset='garbage';"],
};
for(const [kind,[from,to]] of Object.entries(resultMutations))test(`malformed native return refuses before publication: ${kind}`,(t)=>{
  const isOpen=kind.startsWith('open'),count=kind.startsWith('open')||kind.startsWith('syscall')?1:6;
  const value=isOpen?'$opened':kind.startsWith('syscall')?'$result':kind.startsWith('read')?'$count':kind.startsWith('eof')?'$eof':'$offset';
  const result=invoke('return-'+kind,{mutate:dispatchFaultMutation(from,to,value)}),o=result.observations;
  assert.equal(o.issue,'0');assert.equal(o['native-fault-refused'],'1');
  if(kind.startsWith('seek'))assert.ok(['0','0 but true'].includes(o['native-fault-boundary']));
  else assert.equal(o['native-fault-boundary'],isOpen?'1':kind.startsWith('read')?'4783':'0');
  assert.equal(o['native-fault-original-count'],String(count));assert.equal(o['native-fault-known-closed'],String(isOpen?0:count));
  assert.equal(o['native-fault-independent-live'],isOpen?'1':'0');t.diagnostic(JSON.stringify(result));
});

const foreignDefinition=String.raw`BEGIN {
    package Task6aNativeResultForeign;
    our $destroyed=0;sub DESTROY {$destroyed++;}
}
`;
for(const kind of ['ACL','seek'])test(`foreign ${kind} result remains strongly retained without destruction`,(t)=>{
  const call=kind==='ACL'?'$result=CORE::syscall(228,$fd,$attributes,$buffer,8192,4);':'$offset=CORE::sysseek($handle,0,0);';
  const target=kind==='ACL'?'$result':'$offset';
  const result=invoke('foreign-'+kind,{definitions:foreignDefinition,mutate:s=>once(once(observeOriginals(s),call,
    call+target+"=CORE::bless({},'Task6aNativeResultForeign');"),'CORE::die $error unless $ok;\n',String.raw`
    my $record=$test_native_records->[INDEX];my $result=$record->{RECORDS}[0]{result};
    CORE::print "foreign-retained\t",CORE::ref($result),"\n";
    CORE::print "foreign-result-destroyed\t",$Task6aNativeResultForeign::destroyed,"\n";
    CORE::print "foreign-known-closed\t",scalar(CORE::grep {$_->{close_ok}} @$test_native_records),"\n";CORE::exit(0);
`.replace('INDEX',kind==='ACL'?'0':'5').replace('RECORDS',kind==='ACL'?'acl_reads':'seeks'))});
  assert.equal(result.observations.issue,'0');assert.equal(result.observations['foreign-retained'],'Task6aNativeResultForeign');
  assert.equal(result.observations['foreign-result-destroyed'],'0');assert.equal(result.observations['foreign-known-closed'],kind==='ACL'?'1':'6');t.diagnostic(JSON.stringify(result));
});

test('MODELED nonempty effective ACL refuses after actual native dispatch',(t)=>{
  const call='$result=CORE::syscall(228,$fd,$attributes,$buffer,8192,4);';
  const result=invoke('modeled-nonempty-acl',{mutate:dispatchFaultMutation(call,
    call+"if($kind eq 'security'){CORE::substr($buffer,0,12)=CORE::pack('LLL',16,8,4);CORE::substr($buffer,12,4)='ACL!';}",
    "CORE::join(',', $kind,$result,CORE::unpack('L',CORE::substr($buffer,0,4)))","$kind eq 'security'")}),o=result.observations;
  assert.equal(o.issue,'0');assert.equal(o['native-fault-boundary'],'security,0,12');
  assert.equal(o['native-fault-original-count'],'1');assert.equal(o['native-fault-known-closed'],'1');assert.equal(o['native-fault-independent-live'],'0');t.diagnostic(JSON.stringify(result));
});
function observeOriginals(source) {
  const observed=once(once(source,'# Inert fixed native readback prerequisite.',
    'my $test_native_records;\nmy $test_actual_native_handles=[];\n# Inert fixed native readback prerequisite.'),
    'my $validated;my @originals;',String.raw`my $validated;my @originals;$test_native_records=\@originals;`);
  return once(observed,'$opened=CORE::sysopen($fh,$path,0x01000100);',String.raw`$opened=CORE::sysopen($fh,$path,0x01000100);
                    CORE::push(@$test_actual_native_handles,{handle=>$fh,native_return=>$opened});`);
}

function dispatchFaultMutation(from,to,nativeValue,condition='1') {
  return source=>{
    source=once(observeOriginals(source),'# Inert fixed native readback prerequisite.','my $test_fault_boundary;\n# Inert fixed native readback prerequisite.');
    const actual=from.startsWith('$opened=')?from+'\n                    CORE::push(@$test_actual_native_handles,{handle=>$fh,native_return=>$opened});':from;
    source=once(source,actual,actual+'$test_fault_boundary='+nativeValue+' if '+condition+';'+to.slice(from.length));
    return once(source,'CORE::die $error unless $ok;\n',String.raw`
    CORE::print "native-fault-refused\t",$ok?0:1,"\n";
    CORE::print "native-fault-boundary\t",defined($test_fault_boundary)?$test_fault_boundary:'MISSING',"\n";
    CORE::print "native-fault-original-count\t",scalar(@$test_actual_native_handles),"\n";
    CORE::print "native-fault-known-closed\t",scalar(CORE::grep {$_->{close_ok}} @$test_native_records),"\n";
    CORE::print "native-fault-independent-live\t",scalar(CORE::grep {defined(CORE::fileno($_->{handle}))} @$test_actual_native_handles),"\n";
    CORE::exit(0);
`);
  };
}

test('retained raw native tuples, ACL packets and independent originals qualify only ordinary DATA',(t)=>{
  const result=invoke('raw-native-evidence',{mutate:observeOriginals,afterUse:String.raw`BEGIN {
    $strict_loader_recheck->();$strict_native_readback_recheck->();$strict_loader_recheck->();
    my $distinct=1;
    for my $i(0..5) {
        my $actual=$test_actual_native_handles->[$i];my $record=$test_native_records->[$i];
        $distinct=0 unless $strict_same_reference->($actual->{handle},$record->{handle});
        for my $j(0..$i-1) {$distinct=0 if $strict_same_reference->($actual->{handle},$test_actual_native_handles->[$j]{handle});}
        CORE::print "original-$i-open\t",$actual->{native_return},"\n";
        CORE::print "original-$i-path\t",$record->{path},"\n";
        for my $kind('before','held_initial','tuple') {CORE::print "original-$i-$kind\t",CORE::join(',',@{$record->{$kind}}),"\n";}
        my $j=0;for my $metadata(@{$record->{metadata}}) {
            for my $kind('held','named') {CORE::print "original-$i-metadata-$j-$kind\t",CORE::join(',',@{$metadata->{$kind}}),"\n";}$j++;
        }
        $j=0;for my $packet(@{$record->{acl_reads}}) {
            CORE::print "original-$i-acl-$j\t",CORE::join(',', $packet->{kind},CORE::unpack('H*',$packet->{attributes}),
                $packet->{result},$packet->{errno},CORE::unpack('H*',do {my $cell=$packet->{buffer_cell};$$cell}),CORE::unpack('H*',$packet->{error})),"\n";$j++;
        }
    }
    CORE::print "independent-originals\t",scalar(@$test_actual_native_handles),"\n";
    CORE::print "independent-distinct-membership\t",$distinct,"\n";
    my $j=0;for my $read(@{$test_native_records->[5]{reads}}) {
        CORE::print "leaf-read-$j\t",CORE::join(',', $read->{count},$read->{eof},CORE::length(do {my $cell=$read->{bytes_cell};$$cell}),
            CORE::length(do {my $cell=$read->{extra_cell};$$cell}),$preimport_sha256->(do {my $cell=$read->{bytes_cell};$$cell})),"\n";$j++;
    }
    $j=0;for my $seek(@{$test_native_records->[5]{seeks}}) {CORE::print "leaf-seek-$j\t",CORE::join(',', $seek->{result},CORE::unpack('H*',$seek->{error})),"\n";$j++;}
    $strict_native_readback_release->();
    for my $i(0..5) {
        my $record=$test_native_records->[$i];my $live=CORE::fileno($test_actual_native_handles->[$i]{handle});
        CORE::print "original-$i-close\t",CORE::join(',', $record->{close_attempted},$record->{close_return},
            $record->{close_ok},$record->{live_ok},defined($record->{live_return})?1:0,defined($live)?1:0,
            CORE::unpack('H*',$record->{close_error}),CORE::unpack('H*',$record->{live_error})),"\n";
    }
    CORE::exit(0);
}
`});
  const o=result.observations,expected=['/','/System','/System/Library','/System/Library/Perl','/System/Library/Perl/5.34',STRICT];
  assert.equal(o['independent-originals'],'6');assert.equal(o['independent-distinct-membership'],'1');
  for(let i=0;i<6;i++) {
    assert.equal(o[`original-${i}-open`],'1');assert.equal(o[`original-${i}-path`],expected[i]);
    const base=o[`original-${i}-before`].split(',');assert.equal(base.length,13);assert.equal(base[4],'0');assert.equal(base[5],'0');
    for(const key of ['held_initial','tuple',...Array.from({length:3},(_,j)=>[`metadata-${j}-held`,`metadata-${j}-named`]).flat()]) {
      const tuple=o[`original-${i}-${key}`].split(',');assert.equal(tuple.length,13);
      for(const k of [0,1,2,3,4,5,6,7,9,10,11,12])assert.equal(tuple[k],base[k]);
    }
    for(let j=0;j<8;j++) {
      const [kind,attrs,status,errno,hex,error]=o[`original-${i}-acl-${j}`].split(',');
      assert.equal(kind,j%2?'security':'capabilities');
      const expectedAttributes=Buffer.alloc(24);expectedAttributes.writeUInt16LE(5);
      expectedAttributes.writeUInt32LE(kind==='security'?0x00400000:0,4);
      expectedAttributes.writeUInt32LE(kind==='capabilities'?0x80020000:0,8);
      assert.equal(attrs,expectedAttributes.toString('hex'));assert.equal(status,'0');assert.equal(errno,'0');assert.equal(error,'');
      const packet=Buffer.from(hex,'hex');assert.equal(packet.length,8192);
      const used=kind==='security'?12:36;assert.equal(packet.readUInt32LE(),used);assert.ok(packet.subarray(used).every(b=>b===204));
      if(kind==='security'){assert.equal(packet.readUInt32LE(4),8);assert.equal(packet.readUInt32LE(8),0);}
      else {assert.equal(kind,'capabilities');assert.ok(packet.readUInt32LE(8)&0x400);assert.ok(packet.readUInt32LE(24)&0x400);}
    }
    assert.equal(o[`original-${i}-close`],'1,1,1,1,0,0,,');
  }
  for(let j=0;j<2;j++){assert.equal(o[`leaf-read-${j}`],`4783,0,4783,0,${PIN}`);assert.ok(['0,','0 but true,'].includes(o[`leaf-seek-${j}`]));}
  t.diagnostic(JSON.stringify({home:result.home,pid:result.pid,scope:'ordinary DATA; full raw packets retained in stdout.log, no initial native/Root admission'}));
});

test('uncertain native open result remains retained without foreign destruction or guessed close',(t)=>{
  const result=invoke('foreign-open-result',{definitions:foreignDefinition,mutate:s=>{
    s=observeOriginals(s);s=once(s,'CORE::push(@$test_actual_native_handles,{handle=>$fh,native_return=>$opened});',
      "CORE::push(@$test_actual_native_handles,{handle=>$fh,native_return=>$opened});$opened=CORE::bless({},'Task6aNativeResultForeign');");
    return once(s,'CORE::die $error unless $ok;\n',String.raw`
    CORE::print "open-refused\t",$ok?0:1,"\n";
    CORE::print "pending-count\t",scalar(@$test_native_records),"\n";
    CORE::print "retained-open-ref\t",CORE::ref($test_native_records->[0]{open_return}),"\n";
    CORE::print "open-destroyed\t",$Task6aNativeResultForeign::destroyed,"\n";
    CORE::print "unknown-close-attempted\t",$test_native_records->[0]{close_attempted},"\n";CORE::exit(0);
`);
  }});
  assert.equal(result.observations['open-refused'],'1');assert.equal(result.observations['pending-count'],'1');
  assert.equal(result.observations['retained-open-ref'],'Task6aNativeResultForeign');assert.equal(result.observations['open-destroyed'],'0');
  assert.equal(result.observations['unknown-close-attempted'],'0');t.diagnostic(JSON.stringify(result));
});

for(const kind of ['foreign-return','throw-after-effect'])test(`all known closes retain their own outcomes and independent liveness: ${kind}`,(t)=>{
  const result=invoke('close-'+kind,{definitions:foreignDefinition,mutate:s=>{
    s=observeOriginals(s);return once(s,'$closed=CORE::close($handle);',
      '$closed=CORE::close($handle);'+(kind==='foreign-return'?"$closed=CORE::bless({},'Task6aNativeResultForeign');":'CORE::die "MODELED_CLOSE_AFTER_EFFECT\\n";')+'');
  },afterIssue:String.raw`
    my $first=eval {$strict_native_readback_release->();1};
    my ($attempts,$live,$known_live,$returns,$errors)=(0,0,0,0,0);
    for my $actual(@$test_actual_native_handles) {
        CORE::die "TEST_NATIVE_CAPTURE_INVALID\n" unless $actual->{native_return} eq '1';
        $live++ if defined(CORE::fileno($actual->{handle}));
    }
    CORE::print "independent-native-originals\t",scalar(@$test_actual_native_handles),"\n";
    for my $record(@$test_native_records) {
        $attempts+=$record->{close_attempted};
        $known_live++ if $record->{live_ok}&&!defined($record->{live_return});
        $returns++ if CORE::ref($record->{close_return}) eq 'Task6aNativeResultForeign';
        $errors++ if defined($record->{close_error})&&CORE::index($record->{close_error},'MODELED_CLOSE_AFTER_EFFECT')>=0;
    }
    CORE::print "close-release-refused\t",$first?0:1,"\n";
    CORE::print "close-attempts\t",$attempts,"\n";
    CORE::print "actual-live\t",$live,"\n";
    CORE::print "recorded-independent-live\t",$known_live,"\n";
    CORE::print "retained-close-returns\t",$returns,"\n";
    CORE::print "retained-close-errors\t",$errors,"\n";
    CORE::print "close-destroyed\t",$Task6aNativeResultForeign::destroyed,"\n";
    my $again=eval {$strict_native_readback_release->();1};CORE::print "close-repeat-refused\t",$again?0:1,"\n";CORE::exit(0);
`});
  const o=result.observations;assert.equal(o['close-release-refused'],'1');assert.equal(o['close-attempts'],'6');assert.equal(o['actual-live'],'0');assert.equal(o['independent-native-originals'],'6');
  assert.equal(o['recorded-independent-live'],'6');assert.equal(o['close-repeat-refused'],'1');assert.equal(o['close-destroyed'],'0');
  assert.equal(o[kind==='foreign-return'?'retained-close-returns':'retained-close-errors'],'6');t.diagnostic(JSON.stringify(result));
});

test('tied original output cell is rejected before FETCH and loader cannot be rearmed',(t)=>{
  const result=invoke('tied-original-cell',{mutate:observeOriginals,afterIssue:String.raw`
    {package Task6aNativeCellTie;our $fetches=0;
        sub TIESCALAR {CORE::bless({original=>$_[1]},$_[0]);}
        sub FETCH {$fetches++;return $_[0]{original};}
    }
    my $record=$test_native_records->[5];my $cell=$record->{cell};CORE::tie($$cell,'Task6aNativeCellTie',$record->{handle});
    my $checked=eval {$strict_native_readback_recheck->();1};
    CORE::print "tied-cell-refused\t",$checked?0:1,"\n";
    CORE::print "tied-cell-fetches\t",$Task6aNativeCellTie::fetches,"\n";
    CORE::untie($$cell);$$cell=$record->{handle};
    $strict_completed_readback=$test_good_readback;
    my $again=eval {$strict_loader_install->();1};CORE::print "tied-restored-install\t",$again?1:0,"\n";CORE::exit(0);
`});
  assert.equal(result.observations['tied-cell-refused'],'1');assert.equal(result.observations['tied-cell-fetches'],'0');
  assert.equal(result.observations['tied-restored-install'],'0');t.diagnostic(JSON.stringify(result));
});

const handleChanges={
  'blessed-HASH-GLOB':"$$cell=CORE::bless({},'GLOB');",
  'native-IO-alias':"$$cell=$record->{io};",
  'same-IO-different-GV':"my $different=\\*Task6aNativeAlias::HANDLE;*{$different}=$record->{io};CORE::print \"alias-same-IO\\t\",$strict_same_reference->(*{$different}{IO},$record->{io})?1:0,\"\\n\";CORE::print \"alias-different-handle\\t\",$strict_same_reference->($different,$record->{handle})?0:1,\"\\n\";$$cell=$different;",
  'foreign-code':"$$cell=sub {$Task6aNativeCellTie::fetches++;};",
  'empty-native-GV':"my $empty=\\*Task6aNativeEmpty::HANDLE;CORE::print \"empty-GV-no-IO\\t\",defined(*{$empty}{IO})?0:1,\"\\n\";$$cell=$empty;",
};
for(const [kind,change] of Object.entries(handleChanges))test(`same-original handle and IO guards refuse: ${kind}`,(t)=>{
  const result=invoke('handle-'+kind,{mutate:observeOriginals,afterIssue:String.raw`
    {package Task6aNativeCellTie;our $fetches=0;}
    my $record=$test_native_records->[5];my $cell=$record->{cell};CHANGE
    my $checked=eval {$strict_native_readback_recheck->();1};
    CORE::print "changed-handle-refused\t",$checked?0:1,"\n";
    CORE::print "changed-handle-callbacks\t",$Task6aNativeCellTie::fetches,"\n";
    $$cell=$record->{handle};$strict_completed_readback=$test_good_readback;
    my $again=eval {$strict_loader_install->();1};CORE::print "handle-restored-install\t",$again?1:0,"\n";CORE::exit(0);
`.replace('CHANGE',()=>change)});
  assert.equal(result.observations['changed-handle-refused'],'1');assert.equal(result.observations['changed-handle-callbacks'],'0');
  assert.equal(result.observations['handle-restored-install'],'0');if(kind==='same-IO-different-GV'){assert.equal(result.observations['alias-same-IO'],'1');assert.equal(result.observations['alias-different-handle'],'1');}t.diagnostic(JSON.stringify(result));
  if(kind==='empty-native-GV')assert.equal(result.observations['empty-GV-no-IO'],'1');
});

test('genuine overloaded GV dereference is armed outside and refused without callback inside native owner',(t)=>{
  const result=invoke('overloaded-GV',{mutate:observeOriginals,afterUse:String.raw`{
    package Task6aNativeGVOverload;
    use overload '*{}'=>sub {++$Task6aNativeGVOverload::calls;return $_[0]{real};},fallback=>1;
    our $calls;
}
BEGIN {
    my $record=$test_native_records->[5];my $cell=$record->{cell};
    my $foreign=CORE::bless({real=>$record->{handle}},'Task6aNativeGVOverload');
    my $outside=*{$foreign}{IO};
    CORE::print "outside-GV-armed\t",$Task6aNativeGVOverload::calls==1?1:0,"\n";
    CORE::print "outside-GV-noamagic\t",($^H&0x01000000)?1:0,"\n";
    $Task6aNativeGVOverload::calls=0;$$cell=$foreign;
    my $checked=eval {$strict_native_readback_recheck->();1};
    CORE::print "inside-GV-refused\t",$checked?0:1,"\n";
    CORE::print "inside-GV-callbacks\t",$Task6aNativeGVOverload::calls,"\n";
    $$cell=$record->{handle};$strict_completed_readback=$test_good_readback;
    my $again=eval {$strict_loader_recheck->();1};CORE::print "GV-restored-cache\t",$again?1:0,"\n";CORE::exit(0);
}
`});
  const o=result.observations;assert.equal(o['outside-GV-armed'],'1');assert.equal(o['outside-GV-noamagic'],'0');
  assert.equal(o['inside-GV-refused'],'1');assert.equal(o['inside-GV-callbacks'],'0');assert.equal(o['GV-restored-cache'],'0');t.diagnostic(JSON.stringify(result));
});

function fixtureSource(source,home,kind='healthy') {
  const paths=[];let current=home;
  for(let i=0;i<5;i++){current+='/ancestor'+i;fs.mkdirSync(current,{mode:0o700});paths.push(current);}
  const leaf=current+'/strict.pm';paths.push(leaf);const native=fs.readFileSync(STRICT);
  fs.writeFileSync(leaf,kind==='corrupt'?Buffer.concat([native.subarray(0,-1),Buffer.from('!')]):kind==='extra'?Buffer.concat([native,Buffer.from('!')]):native,{flag:'wx',mode:0o600});
  const initialMetadata=paths.map(p=>{const s=fs.lstatSync(p);return {path:p,uid:s.uid,gid:s.gid,mode:s.mode,dev:s.dev,ino:s.ino,size:s.size};});
  const modeledUID=initialMetadata[0].uid,modeledGID=initialMetadata[0].gid;
  assert.equal(modeledUID,process.getuid());
  assert.ok(initialMetadata.every(s=>s.uid===modeledUID&&s.gid===modeledGID),'actual six-path inherited fixture ownership');
  if(kind==='missing')fs.renameSync(leaf,leaf+'.retained');
  if(kind==='symlink'){fs.renameSync(leaf,leaf+'.retained');fs.symlinkSync(leaf+'.retained',leaf);}
  if(kind==='writable')fs.chmodSync(leaf,0o666);
  const quote=v=>"'"+v.replaceAll('\\','\\\\').replaceAll("'","\\'")+"'";
  source=once(source,String.raw`my @paths=('/','/System','/System/Library','/System/Library/Perl',
            '/System/Library/Perl/5.34','/System/Library/Perl/5.34/strict.pm');`,
    'my @paths=('+paths.map(quote).join(',')+'); # MODEL fixed owned fixture paths');
  source=inStrictNative(source,'&&($values->[2]&0022)==0&&$values->[4]==0&&$values->[5]==0;',
    `&&($values->[2]&0022)==0&&$values->[4]==${modeledUID}&&$values->[5]==${modeledGID}; # MODEL owner policy`);
  fs.writeFileSync(home+'/fixture-policy-model.json',JSON.stringify({paths,initialMetadata,modeledUID,modeledGID,kind,
    scope:'owned negative filesystem fixtures; no genuine SIP/ACL/account/service mutations'})+'\n',{flag:'wx',mode:0o600});
  return source;
}

test('owned fixture positive arms the disclosed path/owner model and genuine native readback',(t)=>{
  const result=invoke('fixture-healthy',{mutate:(s,h)=>fixtureSource(s,h)});assert.equal(result.observations.issue,'1');
  assert.equal(result.observations['native-sha'],PIN);assert.equal(result.observations['native-recheck'],'1');assert.equal(result.observations.release,'1');t.diagnostic(JSON.stringify(result));
});
for(const kind of ['missing','symlink','writable','corrupt','extra'])test(`actual owned filesystem refuses before publication: MODEL ${kind}`,(t)=>{
  const result=invoke('fixture-'+kind,{mutate:(s,h)=>once(fixtureSource(s,h,kind),'CORE::die $error unless $ok;\n',String.raw`
    CORE::print "fixture-refused\t",$ok?0:1,"\n";CORE::exit(0);
`)});
  assert.equal(result.observations.issue,'0');assert.equal(result.observations['fixture-refused'],'1');t.diagnostic(JSON.stringify(result));
});

test('same-byte owned pathname replacement loses actual native custody and restoration cannot rearm',(t)=>{
  const result=invoke('fixture-same-byte-replacement',{mutate:(s,h)=>fixtureSource(observeOriginals(s),h),afterIssue:String.raw`
    my $record=$test_native_records->[5];my $path=$record->{path};
    CORE::rename($path,$path.'.retained-original') or CORE::die "TEST_RENAME\n";
    CORE::open(my $new,'>',$path) or CORE::die "TEST_NEW_OPEN\n";
    CORE::print {$new} $test_good_readback or CORE::die "TEST_NEW_WRITE\n";
    CORE::close($new) or CORE::die "TEST_NEW_CLOSE\n";
    my @held=CORE::stat($record->{handle});my @named=CORE::lstat($path);
    CORE::print "replacement-inode-different\t",$held[1]!=$named[1]?1:0,"\n";
    my $checked=eval {$strict_native_readback_recheck->();1};CORE::print "replacement-refused\t",$checked?0:1,"\n";
    CORE::rename($path,$path.'.retained-replacement') or CORE::die "TEST_KEEP_REPLACEMENT\n";
    CORE::rename($path.'.retained-original',$path) or CORE::die "TEST_RESTORE_ORIGINAL\n";
    $strict_completed_readback=$test_good_readback;
    my $again=eval {$strict_loader_install->();1};CORE::print "replacement-restored-install\t",$again?1:0,"\n";CORE::exit(0);
`});
  assert.equal(result.observations['replacement-inode-different'],'1');assert.equal(result.observations['replacement-refused'],'1');
  assert.equal(result.observations['replacement-restored-install'],'0');t.diagnostic(JSON.stringify(result));
});

for(const count of [64,65])test(`literal native recheck attempt bound is enforced: ${count}`,(t)=>{
  const result=invoke('recheck-bound-'+count,{afterIssue:String.raw`
    my $success=0;for(1..COUNT){my $ok=eval {$strict_native_readback_recheck->();1};$success++ if $ok;}
    CORE::print "bounded-successes\t",$success,"\n";
    CORE::print "attempted-rechecks\t",COUNT,"\n";
    my $closed=eval {$strict_native_readback_release->();1};CORE::print "bounded-release\t",$closed?1:0,"\n";
    $strict_completed_readback=$test_good_readback;
    my $again=eval {$strict_loader_install->();1};CORE::print "bounded-restored-install\t",$again?1:0,"\n";CORE::exit(0);
`.replaceAll('COUNT',String(count))});
  assert.equal(result.observations['bounded-successes'],'64');assert.equal(result.observations['attempted-rechecks'],String(count));
  assert.equal(result.observations['bounded-release'],'1');assert.equal(result.observations['bounded-restored-install'],'0');t.diagnostic(JSON.stringify(result));
});

test('positive-operation exhaustion charges before dispatch and never consumes reserved close attempts',(t)=>{
  const result=invoke('operation-exhaustion',{mutate:s=>once(once(observeOriginals(s),'my $operations=0;','my $operations=8180;'),
    'CORE::die $error unless $ok;\n',String.raw`
    my ($actual,$live,$closed)=(0,0,0);
    for my $captured(@$test_actual_native_handles) {$actual++;$live++ if defined(CORE::fileno($captured->{handle}));}
    for my $record(@$test_native_records) {$closed++ if $record->{close_attempted};}
    CORE::print "exhaustion-refused\t",$ok?0:1,"\n";CORE::print "exhaustion-actual-opens\t",$actual,"\n";
    CORE::print "exhaustion-live\t",$live,"\n";CORE::print "exhaustion-close-attempts\t",$closed,"\n";CORE::exit(0);
`)});
  assert.equal(result.observations['exhaustion-refused'],'1');assert.ok(Number(result.observations['exhaustion-actual-opens'])>0);
  assert.equal(result.observations['exhaustion-live'],'0');assert.equal(result.observations['exhaustion-close-attempts'],result.observations['exhaustion-actual-opens']);t.diagnostic(JSON.stringify(result));
});

test('tied known FH is quarantined before FILENO or CLOSE callback while other originals settle',(t)=>{
  const result=invoke('tied-known-FH',{mutate:observeOriginals,afterIssue:String.raw`
    {package Task6aNativeHandleTie;our $calls=0;
        sub TIEHANDLE {CORE::bless({},$_[0]);}
        sub FILENO {$calls++;return 0;}
        sub CLOSE {$calls++;return 1;}
    }
    my $record=$test_native_records->[5];my $handle=$record->{handle};
    CORE::tie(*{$handle},'Task6aNativeHandleTie');
    my $checked=eval {$strict_native_readback_recheck->();1};
    CORE::print "tied-FH-refused\t",$checked?0:1,"\n";
    CORE::print "tied-FH-callbacks\t",$Task6aNativeHandleTie::calls,"\n";
    CORE::print "tied-FH-close-attempted\t",$record->{close_attempted},"\n";
    my $other_closed=0;for my $other(@$test_native_records){$other_closed++ if $other->{close_ok};}
    CORE::print "tied-FH-other-closes\t",$other_closed,"\n";
    CORE::untie(*{$handle});
    my $again=eval {$strict_native_readback_release->();1};CORE::print "tied-FH-no-retry\t",$again?0:1,"\n";
    # Test-owned genuine native original is settled independently after undoing
    # only its own tie. This does not qualify production quarantine cleanup.
    CORE::close($handle) or CORE::die "TEST_NATIVE_ORIGINAL_CLOSE\n";CORE::exit(0);
`});
  const o=result.observations;assert.equal(o['tied-FH-refused'],'1');assert.equal(o['tied-FH-callbacks'],'0');
  assert.equal(o['tied-FH-close-attempted'],'0');assert.equal(o['tied-FH-other-closes'],'5');assert.equal(o['tied-FH-no-retry'],'1');t.diagnostic(JSON.stringify(result));
});

test('actual IO-returning overload is armed outside and cannot redirect the retained original inside',(t)=>{
  const result=invoke('overloaded-IO',{mutate:observeOriginals,afterUse:String.raw`{
    package Task6aNativeIOOverload;
    use overload '*{}'=>sub {++$Task6aNativeIOOverload::calls;return $_[0]{io};},fallback=>1;
    our $calls;
}
BEGIN {
    my $record=$test_native_records->[5];my $cell=$record->{cell};
    my $foreign=CORE::bless({io=>$record->{io}},'Task6aNativeIOOverload');
    my $outside=*{$foreign}{IO};
    CORE::print "outside-IO-armed\t",($Task6aNativeIOOverload::calls==1&&$strict_same_reference->($outside,$record->{io}))?1:0,"\n";
    $Task6aNativeIOOverload::calls=0;$$cell=$foreign;
    my $checked=eval {$strict_native_readback_recheck->();1};CORE::print "inside-IO-refused\t",$checked?0:1,"\n";
    CORE::print "inside-IO-callbacks\t",$Task6aNativeIOOverload::calls,"\n";CORE::exit(0);
}
`});
  const o=result.observations;assert.equal(o['outside-IO-armed'],'1');assert.equal(o['inside-IO-refused'],'1');assert.equal(o['inside-IO-callbacks'],'0');t.diagnostic(JSON.stringify(result));
});

const nativeFaults={
  'acl-error': ["$result=CORE::syscall(228,$fd,$attributes,$buffer,8192,4);", "$result=CORE::syscall(228,$fd,$attributes,$buffer,8192,4);$result=-1;"],
  'acl-short': ["$result=CORE::syscall(228,$fd,$attributes,$buffer,8192,4);", "$result=CORE::syscall(228,$fd,$attributes,$buffer,8192,4);CORE::substr($buffer,0,4)=CORE::pack('L',8193);"],
  'cap-unsupported': ["my @cap=CORE::unpack('L8',CORE::substr($buffer,4,32));", "my @cap=CORE::unpack('L8',CORE::substr($buffer,4,32));$cap[1]&=~0x400;"],
  'cap-invalid': ["my @cap=CORE::unpack('L8',CORE::substr($buffer,4,32));", "my @cap=CORE::unpack('L8',CORE::substr($buffer,4,32));$cap[5]&=~0x400;"],
  'read-short': ["$count=CORE::sysread($handle,$bytes,4784);", "$count=CORE::sysread($handle,$bytes,4784);$count=4782;"],
  'read-throw-after-effect': ["$count=CORE::sysread($handle,$bytes,4784);", "$count=CORE::sysread($handle,$bytes,4784);CORE::die 'MODELED_READ_AFTER_EFFECT';"],
  'read-UTF8': ["$count=CORE::sysread($handle,$bytes,4784);", "$count=CORE::sysread($handle,$bytes,4784);utf8::upgrade($bytes);"],
  'EOF-extra': ["$eof=CORE::sysread($handle,$extra,1);", "$eof=CORE::sysread($handle,$extra,1);$eof=1;$extra='!';"],
  'seek-error': ["$offset=CORE::sysseek($handle,0,0);", "$offset=CORE::sysseek($handle,0,0);$offset=undef;"],
  'seek-throw-after-effect': ["$offset=CORE::sysseek($handle,0,0);", "$offset=CORE::sysseek($handle,0,0);CORE::die 'MODELED_SEEK_AFTER_EFFECT';"],
  'open-false-after-effect': ["$opened=CORE::sysopen($fh,$path,0x01000100);", "$opened=CORE::sysopen($fh,$path,0x01000100);$opened=0;"],
  'open-throw-after-effect': ["$opened=CORE::sysopen($fh,$path,0x01000100);", "$opened=CORE::sysopen($fh,$path,0x01000100);CORE::die 'MODELED_OPEN_AFTER_EFFECT';"],
};

for(const kind of ['read','EOF'])test(`MODELED ${kind} throw after native effect retains return and exception before refusal`,(t)=>{
  const call=kind==='read'?'$count=CORE::sysread($handle,$bytes,4784);':'$eof=CORE::sysread($handle,$extra,1);';
  const result=invoke('retained-'+kind+'-throw',{mutate:s=>once(once(observeOriginals(s),call,call+"CORE::die 'MODELED_RETAINED_AFTER_EFFECT';"),
    'CORE::die $error unless $ok;\n',String.raw`
    my $read=$test_native_records->[5]{reads}[0];
    CORE::print "retained-native-return\t",defined($read->{FIELD})?$read->{FIELD}:'MISSING',"\n";
    CORE::print "retained-native-error\t",defined($read->{ERROR})&&$read->{ERROR}=~/MODELED_RETAINED_AFTER_EFFECT/?1:0,"\n";
    CORE::print "retained-originals-settled\t",scalar(CORE::grep {$_->{close_ok}} @$test_native_records),"\n";CORE::exit(0);
`.replaceAll('FIELD',kind==='read'?'count':'eof').replaceAll('ERROR',kind==='read'?'count_error':'eof_error'))});
  assert.equal(result.observations.issue,'0');assert.equal(result.observations['retained-native-return'],kind==='read'?'4783':'0');
  assert.equal(result.observations['retained-native-error'],'1');assert.equal(result.observations['retained-originals-settled'],'6');t.diagnostic(JSON.stringify(result));
});

test('MODELED invalid first held tuple remains retained before its predicate refuses',(t)=>{
  const result=invoke('retained-initial-held',{mutate:s=>once(once(observeOriginals(s),
    'my @held=CORE::stat($handle);\n                    $record->{held_initial}',
    'my @held=CORE::stat($handle);$held[4]=501;\n                    $record->{held_initial}'),
    'CORE::die $error unless $ok;\n',String.raw`
    CORE::print "retained-initial-tuple\t",defined($test_native_records->[0]{held_initial})?CORE::join(',',@{$test_native_records->[0]{held_initial}}):'MISSING',"\n";
    CORE::print "initial-original-settled\t",$test_native_records->[0]{close_ok},"\n";CORE::exit(0);
`)});
  assert.equal(result.observations.issue,'0');assert.equal(result.observations['retained-initial-tuple'].split(',').length,13);
  assert.equal(result.observations['retained-initial-tuple'].split(',')[4],'501');assert.equal(result.observations['initial-original-settled'],'1');t.diagnostic(JSON.stringify(result));
});
for(const [kind,[from,to]] of Object.entries(nativeFaults))test(`retained actual native dispatch refuses MODELED uncertainty: ${kind}`,(t)=>{
  const isOpen=kind.startsWith('open-'),expectedOriginals=/^(read|EOF|seek)/.test(kind)?6:1;
  const actual=isOpen?from+'\n                    CORE::push(@$test_actual_native_handles,{handle=>$fh,native_return=>$opened});':from;
  const nativeValue=kind.startsWith('cap-')?"CORE::join(',', $cap[1]&0x400,$cap[5]&0x400)"
    :kind.startsWith('acl-')?'$result':kind.startsWith('read-')?'$count':kind.startsWith('EOF')?'$eof':kind.startsWith('seek-')?'$offset':'$opened';
  const result=invoke('native-fault-'+kind,{mutate:s=>{
    s=once(observeOriginals(s),'# Inert fixed native readback prerequisite.','my $test_fault_boundary;\n# Inert fixed native readback prerequisite.');
    s=inStrictNative(s,actual,actual+'$test_fault_boundary='+nativeValue+';'+to.slice(from.length));
    return once(s,'CORE::die $error unless $ok;\n',String.raw`
    CORE::print "native-fault-refused\t",$ok?0:1,"\n";
    CORE::print "native-fault-boundary\t",defined($test_fault_boundary)?$test_fault_boundary:'MISSING',"\n";
    CORE::print "native-fault-original-count\t",scalar(@$test_actual_native_handles),"\n";
    CORE::print "native-fault-known-closed\t",scalar(CORE::grep {$_->{close_ok}} @$test_native_records),"\n";
    CORE::print "native-fault-independent-live\t",scalar(CORE::grep {defined(CORE::fileno($_->{handle}))} @$test_actual_native_handles),"\n";
    CORE::exit(0);
`);
  }});
  const o=result.observations;assert.equal(o.issue,'0');assert.equal(o['native-fault-refused'],'1');
  const boundary=o['native-fault-boundary'];
  if(kind.startsWith('seek-'))assert.ok(['0','0 but true'].includes(boundary));
  else assert.equal(boundary,kind.startsWith('cap-')?'1024,1024':kind.startsWith('read-')?'4783':isOpen?'1':'0');
  assert.equal(o['native-fault-original-count'],String(expectedOriginals));assert.equal(o['native-fault-known-closed'],String(isOpen?0:expectedOriginals));
  assert.equal(o['native-fault-independent-live'],isOpen?'1':'0');t.diagnostic(JSON.stringify(result));
});

for(const kind of ['close-false','close-numeric-prefix','close-before-effect-throw'])test(`known cleanup remains once-only after MODELED ${kind}`,(t)=>{
  const to=kind==='close-before-effect-throw'?"CORE::die 'MODELED_CLOSE_BEFORE_EFFECT';$closed=CORE::close($handle);"
    :"$closed=CORE::close($handle);$closed="+(kind==='close-false'?"0;":"'1junk';");
  const result=invoke(kind,{mutate:s=>once(observeOriginals(s),'$closed=CORE::close($handle);',to),afterIssue:String.raw`
    my $released=eval {$strict_native_readback_release->();1};my ($attempts,$live)=(0,0);
    for my $actual(@$test_actual_native_handles){$live++ if defined(CORE::fileno($actual->{handle}));}
    for my $record(@$test_native_records){$attempts+=$record->{close_attempted};}
    CORE::print "close-fault-refused\t",$released?0:1,"\n";CORE::print "close-fault-attempts\t",$attempts,"\n";
    CORE::print "close-fault-live\t",$live,"\n";
    my $again=eval {$strict_native_readback_release->();1};CORE::print "close-fault-no-retry\t",$again?0:1,"\n";
    # Independent test ownership settles only known genuine originals still live
    # after the modeled pre-effect throw. Production never retries its close.
    for my $actual(@$test_actual_native_handles){CORE::close($actual->{handle}) if defined(CORE::fileno($actual->{handle}));}
    CORE::exit(0);
`});
  const o=result.observations;assert.equal(o['close-fault-refused'],'1');assert.equal(o['close-fault-attempts'],'6');
  assert.equal(o['close-fault-live'],kind==='close-before-effect-throw'?'6':'0');assert.equal(o['close-fault-no-retry'],'1');t.diagnostic(JSON.stringify(result));
});
