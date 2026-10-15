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
const names=['task6a_origin_create_backend_namespace','task6a_origin_recheck_backend_namespace',
  'task6a_origin_release_backend_namespace'];
function once(source,from,to) {
  assert.equal(source.split(from).length,2,`unique memory-only substitution: ${from}`);
  return source.replace(from,()=>to);
}

test('namespace private interface support is mechanical and cannot grant Root origin',()=>{
  const source=fs.readFileSync(BOOTSTRAP,'utf8');
  for(const name of names)assert.ok(source.includes(`sub ${name} {`),`missing namespace support ${name}`);
});

test('ordinary maintained bootstrap entry stays closed before namespace effects',()=>{
  assert.ok(ordinary,'no privileged/non-Darwin fallback');
  const child=spawnSync('/usr/bin/perl',[BOOTSTRAP.pathname],{
    env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'},encoding:'utf8',maxBuffer:65536,
  });
  assert.equal(child.error,undefined);assert.equal(child.signal,null);assert.equal(child.status,2);
  assert.equal(child.stdout,'');assert.equal(child.stderr,'TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n');
});

function invoke(mode='healthy',omission=null) {
  assert.ok(ordinary,'no privileged/non-Darwin fallback');
  const original=fs.readFileSync(BOOTSTRAP,'utf8');
  for(const name of names)assert.ok(original.includes(`sub ${name} {`),`missing namespace support ${name}`);
  // Only fixed path/UID/GID policy values are MODELED. Real native stat tuples,
  // directory FDs, mkdir/chmod/close and physical inodes are never rewritten.
  const home=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'task6a-namespace-custody.'));
  const root=home+'/root',library=root+'/Library',support=library+'/Application Support';
  for(const directory of [root,library,support])fs.mkdirSync(directory,{mode:0o755});
  const group=fs.lstatSync(support).gid;
  const directories=[root,library,support,support+'/Setfarm',support+'/Setfarm/authority',support+'/Setfarm/PostgreSQL'];
  let source=once(original,GUARD,'');source=once(source,'\ntask6a_origin_main();\n','\n');
  source=once(source,'my ($namespace_uid,$namespace_process_gid,$namespace_directory_gid)=(0,0,80);',
    `my ($namespace_uid,$namespace_process_gid,$namespace_directory_gid)=(${mode==='uid-policy'?0:process.getuid()},${process.getgid()},${group});`);
  source=once(source,'my @namespace_existing_gids=(0,0,80);',`my @namespace_existing_gids=(${group},${group},${group});`);
  const production=['/','/Library','/Library/Application Support','/Library/Application Support/Setfarm',
    '/Library/Application Support/Setfarm/authority','/Library/Application Support/Setfarm/PostgreSQL'];
  const policy=production.map(value=>`'${value}'`).join(',');
  source=once(source,`my @namespace_paths=(${policy});`,
    `my @namespace_paths=(${directories.map(value=>`'${value}'`).join(',')});`);
  source=once(source,'CORE::sysopen($pending,$path,$namespace_open_flags,$mode); # namespace original',
    'test_namespace_open(\\$pending,$path,$namespace_open_flags,$mode); # namespace original');
  source=once(source,'CORE::mkdir($path, 0700); # namespace exclusive',
    'test_namespace_mkdir($path,0700); # namespace exclusive');
  source=once(source,'my $namespace_original_close=sub {CORE::close( $fh )};',
    'my $namespace_original_close=sub {test_namespace_close($fh)};');
  source=once(source,'CORE::chmod(0755,$fh);1;', 'test_namespace_seal($fh);1;');
  if(omission==='named-inode')source=once(source,
    '$namespace_same->($record->{identity},\\@named,$record->{mode},$record->{gid});',
    '# OMIT named inode binding for causal companion only');
  if(omission==='positive-budget')source=once(source,
    'task6a_origin_refuse() if $namespace_positive>=8192;', '# OMIT positive budget for causal companion only');
  source=once(source,"task6a_origin_capture('/bin/ls',['-ldne',$record->{path}],2,4096)",
    "test_namespace_acl('/bin/ls',['-ldne',$record->{path}],2,4096)");
  const prefix=String.raw`
BEGIN {@INC=('/System/Library/Perl/5.34/darwin-thread-multi-2level','/System/Library/Perl/5.34');}
use strict;use warnings;use JSON::PP ();use Fcntl ();
my $test_mode=$ARGV[0];my @test_handles;my @test_events;my ($test_mkdirs,$test_armed,$test_fetches)=(0,0,0);
my $test_invalidate;my $test_closing=0;
{package TestNamespaceMagic;sub TIESCALAR {bless {fh=>$_[1]},$_[0]}
 sub FETCH {++$test_fetches;return $_[0]{fh};}}
{package TestNamespaceCloseForeign;use overload 'bool'=>sub {++$test_fetches;1},fallback=>1;}
sub test_namespace_acl {
    if($test_mode eq 'post-mkdir-helper'&&$test_mkdirs==1&&!$test_armed) {
        $test_armed=1;push @test_events,['armed',$test_mode,scalar(@test_handles)];
        $test_invalidate->();return {status=>1,reaped=>JSON::PP::false,err=>'',out=>''};
    }
    return task6a_origin_capture(@_);
}
sub test_namespace_open {
    my ($cell,$path,$flags,$mode)=@_;
    if($test_mode eq 'alias-open'&&@test_handles==3&&!$test_armed) {
        $$cell=$test_handles[0];$test_armed=1;push @test_events,['armed','alias'];return 1;
    }
    if(@test_handles==3&&!$test_armed&&($test_mode eq 'open-before-false'||$test_mode eq 'open-before-throw')) {
        $test_armed=1;push @test_events,['armed',$test_mode];
        die "TEST_NAMESPACE_OPEN_BEFORE\n" if $test_mode eq 'open-before-throw';return 0;
    }
    my $returned=CORE::sysopen($$cell,$path,$flags,$mode);
    if(defined($$cell)&&defined(CORE::fileno($$cell))) {
        push @test_handles,$$cell;push @test_events,['open',CORE::fileno($$cell),$path];
    }
    if(@test_handles==4&&!$test_armed) {
        if($test_mode eq 'unknown-open') {
            my $native=$$cell;tie $$cell,'TestNamespaceMagic',$native;$test_armed=1;
            push @test_events,['armed','unknown-open'];return 1;
        }
        if($test_mode eq 'open-false'||$test_mode eq 'open-throw'||$test_mode eq 'open-foreign') {
            $test_armed=1;push @test_events,['armed',$test_mode];
            die "TEST_NAMESPACE_EXPOSED_OPEN\n" if $test_mode eq 'open-throw';
            return bless {},'TestNamespaceForeign' if $test_mode eq 'open-foreign';return 0;
        }
        if($test_mode eq 'expired-open'||$test_mode eq 'unsettled-open') {
            $test_armed=1;$test_invalidate->();push @test_events,['armed',$test_mode];
        }
    }
    return $returned;
}
sub test_namespace_mkdir {
    my ($path,$mode)=@_;++$test_mkdirs;
    if(!$test_armed&&($test_mode eq 'mkdir-before-false'||$test_mode eq 'mkdir-before-throw')) {
        $test_armed=1;push @test_events,['armed',$test_mode];
        die "TEST_NAMESPACE_MKDIR_BEFORE\n" if $test_mode eq 'mkdir-before-throw';return 0;
    }
    my $returned=CORE::mkdir($path,$mode);push @test_events,['mkdir',$path,$returned?1:0];
    if(!$test_armed&&($test_mode eq 'mkdir-after-false'||$test_mode eq 'mkdir-after-throw')) {
        $test_armed=1;push @test_events,['armed',$test_mode];
        die "TEST_NAMESPACE_MKDIR_AFTER\n" if $test_mode eq 'mkdir-after-throw';return 0;
    }
    return $returned;
}
sub test_namespace_seal {
    my ($fh)=@_;
    if(!$test_armed&&($test_mode eq 'seal-before-false'||$test_mode eq 'seal-before-throw')) {
        $test_armed=1;push @test_events,['armed',$test_mode];
        die "TEST_NAMESPACE_SEAL_BEFORE\n" if $test_mode eq 'seal-before-throw';return 0;
    }
    my $returned=CORE::chmod(0755,$fh);push @test_events,['seal',CORE::fileno($fh),$returned];
    if(!$test_armed&&($test_mode eq 'seal-false'||$test_mode eq 'seal-throw')) {
        $test_armed=1;push @test_events,['armed',$test_mode];
        die "TEST_NAMESPACE_SEAL_AFTER\n" if $test_mode eq 'seal-throw';return 0;
    }
    return $returned;
}
sub test_namespace_close {
    my ($fh)=@_;push @test_events,['close',CORE::fileno($fh)];
    if(!$test_armed&&$test_mode eq 'close-unknown') {
        $test_armed=1;push @test_events,['armed',$test_mode];return 0;
    }
    if($test_mode eq 'close-reentry'&&!$test_closing) {
        $test_closing=1;my $refused=eval {task6a_origin_release_backend_namespace();1};
        push @test_events,['close-reentry',$refused?1:0];
    }
    my $returned=CORE::close($fh);
    if(!$test_armed&&($test_mode eq 'close-after-false'||$test_mode eq 'close-after-throw'||$test_mode eq 'close-after-foreign')) {
        $test_armed=1;push @test_events,['armed',$test_mode];
        die "TEST_NAMESPACE_CLOSE_AFTER\n" if $test_mode eq 'close-after-throw';
        return bless {},'TestNamespaceCloseForeign' if $test_mode eq 'close-after-foreign';return 0;
    }
    return $returned;
}
`;
  const body=String.raw`
if($test_mode eq 'expired-open') {$test_invalidate=sub {$namespace_deadline=0;};}
elsif($test_mode eq 'unsettled-open'||$test_mode eq 'post-mkdir-helper') {$test_invalidate=sub {push @helper_ledger,{settled=>0,pid=>undef};};}
my ($prior,$prior_live,$preclaim_calls);my $altered=$namespace_paths[3];
if($test_mode eq 'old-realm') {
    CORE::sysopen($prior,$namespace_paths[0],Fcntl::O_RDONLY()|Fcntl::O_DIRECTORY()) or die 'TEST_PRIOR_OPEN';
    $parent_phase='held';
}elsif($test_mode eq 'preclaim-helper') {push @helper_ledger,{settled=>0,pid=>undef};}
elsif($test_mode eq 'collision-directory') {CORE::mkdir($altered,0755) or die 'TEST_COLLISION';}
elsif($test_mode eq 'collision-file'||$test_mode eq 'not-directory') {
    my $target=$test_mode eq 'not-directory'?$namespace_paths[2]:$altered;
    CORE::rename($target,$target.'.retained') or die 'TEST_RETAIN' if $test_mode eq 'not-directory';
    CORE::open(my $file,'>',$target) or die 'TEST_COLLISION_FILE';CORE::close($file) or die 'TEST_FILE_CLOSE';
}elsif($test_mode eq 'collision-symlink') {CORE::symlink($namespace_paths[2],$altered) or die 'TEST_COLLISION_LINK';}
if($test_mode eq 'preclaim-then-valid') {my $bad=eval {task6a_origin_create_backend_namespace(undef);1};$preclaim_calls=[$bad?1:0];}
my $created;my $accepted=eval {
    $created=$test_mode eq 'create-arity'?task6a_origin_create_backend_namespace(undef)
        :task6a_origin_create_backend_namespace();1;
};
$prior_live=defined($prior)&&defined(CORE::fileno($prior))?1:0;
if($test_mode eq 'held-arity'&&$accepted) {
    my @attempts=(sub {task6a_origin_create_backend_namespace(undef)},
      sub {task6a_origin_recheck_backend_namespace(undef)},sub {task6a_origin_release_backend_namespace(undef)});
    $preclaim_calls=[map {my $ok=eval {$_->();1};$ok?1:0} @attempts];
}
if($accepted) {
    if($test_mode eq 'mode-drift') {CORE::chmod(0700,$altered)==1 or die 'TEST_MODE_DRIFT';$test_armed=1;}
    elsif($test_mode eq 'group-drift') {
        CORE::chown($namespace_uid,12,$altered)==1 or die 'TEST_GROUP_DRIFT';$test_armed=1;
    }elsif($test_mode eq 'acl-drift') {
        CORE::system('/bin/chmod','+a','everyone deny delete',$altered)==0 or die 'TEST_ACL_DRIFT';$test_armed=1;
    }elsif($test_mode eq 'path-replacement'||$test_mode eq 'parent-replacement'||$test_mode eq 'leaf-replacement') {
        $altered=$namespace_paths[1] if $test_mode eq 'parent-replacement';
        $altered=$namespace_paths[5] if $test_mode eq 'leaf-replacement';
        CORE::rename($altered,$altered.'.retained') or die 'TEST_REPLACE_RETAIN';
        CORE::mkdir($altered,0755) or die 'TEST_REPLACE_MKDIR';$test_armed=1;
    }elsif($test_mode eq 'fd-closed') {CORE::close($test_handles[5]) or die 'TEST_FOREIGN_CLOSE';$test_armed=1;}
    elsif($test_mode eq 'positive-budget') {$namespace_positive=8191;$test_armed=1;}
    elsif($test_mode eq 'recheck-budget') {
        $namespace_rechecks=63;task6a_origin_recheck_backend_namespace();$test_armed=1;
    }elsif($test_mode eq 'deadline') {$namespace_deadline=0;$test_armed=1;}
}

my @live_before=map {defined(CORE::fileno($_))?1:0} @test_handles;
# Independent native test-handle and named-path tuples before recheck/disposal.
# Closed partial-acquisition originals have an explicit empty observation.
my @held_before=map {my @row=defined(CORE::fileno($_))?CORE::stat($_):();[ @row ]} @test_handles;
my @named_before=map {my @row=CORE::lstat($_);[ @row ]} @namespace_paths;
select(undef,undef,undef,0.01);
my ($rechecked,$released,$again);my $checked=eval {$rechecked=task6a_origin_recheck_backend_namespace();1;};
my $after_check_positive=$namespace_positive;
my $restored_refused;
if($test_armed&&($test_mode eq 'path-replacement'||$test_mode eq 'parent-replacement'||$test_mode eq 'leaf-replacement')) {
    CORE::rename($altered,$altered.'.replacement-retained') or die 'TEST_KEEP_REPLACEMENT';
    CORE::rename($altered.'.retained',$altered) or die 'TEST_RESTORE_ORIGINAL';
    my $late=eval {task6a_origin_recheck_backend_namespace();1};$restored_refused=$late?0:1;
}
my $disposed=eval {$released=task6a_origin_release_backend_namespace();1;};
my $original_release_count=defined($released)?$released->{directoryCount}:undef;
my $helpers_restored=0;
if($test_mode eq 'unsettled-open'||$test_mode eq 'post-mkdir-helper') {
    # MODEL later settlement only of this fixture's dummy registry cell; no PID action.
    for my $helper(@helper_ledger) {$helper->{settled}=1;}$helpers_restored=1;
}
$released->{directoryCount}=999 if defined($released)&&$test_mode eq 'diagnostic-mutation';
my $closes=scalar(grep {$_->[0] eq 'close'} @test_events);
my $disposed_again=eval {$again=task6a_origin_release_backend_namespace();1;};
my $refused=eval {task6a_origin_recheck_backend_namespace();1};
my $reacquired=eval {$test_mode eq 'create-arity'?task6a_origin_create_backend_namespace(undef):task6a_origin_create_backend_namespace();1};
my @live_after=map {defined(CORE::fileno($_))?1:0} @test_handles;
CORE::print JSON::PP->new->canonical->encode({created=>$created,rechecked=>$rechecked,
    released=>$released,again=>$again,refused=>$refused?0:1,reacquired=>$reacquired?1:0,
    accepted=>$accepted?1:0,checked=>$checked?1:0,disposed=>$disposed?1:0,disposedAgain=>$disposed_again?1:0,
    closesBeforeRepeat=>$closes,fetches=>$test_fetches,armed=>$test_armed,
    priorLive=>$prior_live,preclaimCalls=>$preclaim_calls,positiveAfterCheck=>$after_check_positive,
    restoredRefused=>$restored_refused,originalReleaseCount=>$original_release_count,helpersRestored=>$helpers_restored,
    liveBefore=>\@live_before,heldBefore=>\@held_before,namedBefore=>\@named_before,liveAfter=>\@live_after,events=>\@test_events,mkdirs=>$test_mkdirs})."\n";
`;
  const program=prefix+source+body;
  // Preserve exact attempted bytes before dispatch and terminal output before
  // fallible assertions, including failed development fixtures.
  fs.writeFileSync(home+'/program.pl',program,{flag:'wx',mode:0o600});
  const child=spawnSync('/usr/bin/perl',['-',mode],{input:program,
    env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'},encoding:'utf8',maxBuffer:1024*1024});
  fs.writeFileSync(home+'/stdout.log',child.stdout??'',{flag:'wx',mode:0o600});
  fs.writeFileSync(home+'/stderr.log',child.stderr??'',{flag:'wx',mode:0o600});
  fs.writeFileSync(home+'/terminal.json',JSON.stringify({pid:child.pid,status:child.status,signal:child.signal,
    error:child.error?.code??null,mode,originalSHA256:createHash('sha256').update(original).digest('hex')})+'\n',
    {flag:'wx',mode:0o600});
  assert.equal(child.error,undefined);assert.equal(child.signal,null);
  assert.equal(child.status,0,child.stdout+child.stderr);assert.equal(child.stderr,'');
  const witness=JSON.parse(child.stdout);const physical=directories.map(directory=>{
    try {const stat=fs.lstatSync(directory);
      return {path:directory,dev:stat.dev,ino:stat.ino,uid:stat.uid,gid:stat.gid,mode:stat.mode&0o7777,type:stat.isDirectory()?'directory':stat.isSymbolicLink()?'symlink':'file'};
    }catch(error){if(error.code==='ENOENT'||error.code==='ENOTDIR')return {path:directory,absent:true,error:error.code};throw error;}
  });
  // No pathname cleanup. Preserve all new ordinary fixtures and exact program.
  fs.writeFileSync(home+'/witness.json',JSON.stringify({scope:'ordinary MODEL Root/path policy, nativeFS/FH only',
    originalSHA256:createHash('sha256').update(original).digest('hex'),pid:child.pid,status:child.status,
    signal:child.signal,physical,witness},null,2)+'\n',{flag:'wx',mode:0o600});
  return {witness,physical,home};
}

test('namespace MODEL Root policy owns six real directories through await and once release',(t)=>{
  const {witness,physical,home}=invoke();
  assert.equal(witness.created.productionAuthority,false);
  assert.equal(witness.created.directoryCount,6);assert.equal(witness.created.createdDirectoryCount,3);
  assert.deepEqual(witness.liveBefore,[1,1,1,1,1,1]);assert.deepEqual(witness.liveAfter,[0,0,0,0,0,0]);
  assert.equal(witness.heldBefore.length,6);assert.equal(witness.namedBefore.length,6);
  for(let i=0;i<6;i++) {
    assert.equal(witness.heldBefore[i].length,13);
    assert.deepEqual(witness.heldBefore[i].slice(0,7),witness.namedBefore[i].slice(0,7));
    const row=witness.heldBefore[i],after=physical[i];
    assert.deepEqual([row[0],row[1],row[2]&0o7777,row[4],row[5]],
      [after.dev,after.ino,after.mode,after.uid,after.gid]);
  }
  assert.equal(witness.mkdirs,3);assert.equal(witness.events.filter(event=>event[0]==='open').length,6);
  assert.equal(witness.events.filter(event=>event[0]==='close').length,6);
  assert.equal(witness.refused,1);assert.equal(witness.reacquired,0);
  assert.deepEqual(witness.released,witness.again);
  assert.ok(physical.every(stat=>stat.uid===process.getuid()&&stat.mode===0o755));
  assert.equal(new Set(physical.map(stat=>stat.dev+'/'+stat.ino)).size,6);
  t.diagnostic(JSON.stringify({scope:'ordinary nativeFS/FH with MODEL Root/path policy',home,physical,witness}));
});

for(const mode of ['mkdir-before-false','mkdir-before-throw','mkdir-after-false','mkdir-after-throw',
  'open-false','open-throw','open-foreign','alias-open','seal-false','seal-throw','seal-before-false','seal-before-throw','expired-open'])
  test(`namespace MODEL armed ${mode} preserves partial paths and closes known originals once`,(t)=>{
    const {witness,physical,home}=invoke(mode);
    assert.equal(witness.armed,1);assert.equal(witness.accepted,0);assert.equal(witness.refused,1);
    assert.equal(witness.reacquired,0);assert.equal(witness.fetches,0);
    assert.ok(witness.liveAfter.every(value=>value===0));
    const opens=witness.events.filter(event=>event[0]==='open');const closes=witness.events.filter(event=>event[0]==='close');
    assert.equal(closes.length,opens.length);assert.equal(new Set(closes.map(event=>event[1])).size,closes.length);
    assert.equal(witness.closesBeforeRepeat,closes.length);
    assert.equal(physical[3].absent??false,mode.startsWith('mkdir-before'));
    t.diagnostic(JSON.stringify({scope:'ordinary MODEL policy/SDK fault, actual exposedFS/FH',home,physical,witness}));
  });

for(const mode of ['unknown-open','unsettled-open','close-unknown','close-reentry'])
  test(`namespace MODEL ${mode} cannot surrender or retry uncertain originals`,(t)=>{
    const {witness,physical,home}=invoke(mode);assert.equal(witness.fetches,0);
    assert.equal(witness.refused,1);assert.equal(witness.reacquired,0);
    assert.equal(witness.closesBeforeRepeat,witness.events.filter(event=>event[0]==='close').length);
    if(mode==='close-reentry') {
      assert.deepEqual(witness.liveAfter,[0,0,0,0,0,0]);
      assert.deepEqual(witness.events.filter(event=>event[0]==='close-reentry'),[['close-reentry',0]]);
    }else {
      assert.equal(witness.disposed,0);assert.equal(witness.disposedAgain,0);
      const closes=witness.events.filter(event=>event[0]==='close');
      const expected={
        'unknown-open':{live:[0,0,0,1],closes:3},
        'unsettled-open':{live:[1,1,1,1],closes:0},
        'close-unknown':{live:[0,0,0,0,0,1],closes:6},
      }[mode];
      assert.deepEqual(witness.liveAfter,expected.live);assert.equal(closes.length,expected.closes);
      assert.equal(new Set(closes.map(event=>event[1])).size,closes.length);
      if(mode==='unsettled-open')assert.equal(witness.helpersRestored,1);
    }
    t.diagnostic(JSON.stringify({scope:'ordinary MODEL uncertainty/reentry, actualFH originals',home,physical,witness}));
  });

for(const mode of ['create-arity','uid-policy','old-realm','preclaim-helper','collision-directory',
  'collision-file','collision-symlink','not-directory'])
  test(`namespace MODEL ${mode} refuses before namespace creation and preserves prior owner`,(t)=>{
    const {witness,physical,home}=invoke(mode);
    assert.equal(witness.accepted,0);assert.equal(witness.mkdirs,0);
    assert.equal(witness.events.filter(event=>event[0]==='open').length,
      mode.startsWith('collision-')?3:mode==='not-directory'?2:0);
    assert.equal(witness.priorLive,mode==='old-realm'?1:0);
    assert.equal(witness.reacquired,0);assert.equal(witness.refused,1);
    assert.ok(witness.liveAfter.every(value=>value===0));
    t.diagnostic(JSON.stringify({scope:'ordinary policy/collision/preclaim MODEL, real FS and prior FH',home,physical,witness}));
  });

for(const mode of ['mode-drift','group-drift','acl-drift','path-replacement','parent-replacement',
  'leaf-replacement','fd-closed','positive-budget','recheck-budget','deadline'])
  test(`namespace MODEL armed ${mode} burns the occurrence without restoration or cleanup retry`,(t)=>{
    const {witness,physical,home}=invoke(mode);
    assert.equal(witness.accepted,1);assert.equal(witness.armed,1);assert.equal(witness.checked,0);
    assert.equal(witness.reacquired,0);assert.equal(witness.refused,1);
    assert.ok(witness.liveAfter.every(value=>value===0));
    assert.equal(witness.closesBeforeRepeat,witness.events.filter(event=>event[0]==='close').length);
    if(mode.endsWith('replacement')) {
      assert.equal(witness.restoredRefused,1);
      const index=mode==='parent-replacement'?1:mode==='leaf-replacement'?5:3;
      assert.notEqual(witness.heldBefore[index][1],witness.namedBefore[index][1]);
    }
    if(mode==='group-drift')assert.equal(witness.heldBefore[3][5],12);
    if(mode==='mode-drift')assert.equal(witness.heldBefore[3][2]&0o7777,0o700);
    if(mode==='positive-budget')assert.equal(witness.positiveAfterCheck,8192);
    if(mode==='fd-closed')assert.equal(witness.disposed,0);
    t.diagnostic(JSON.stringify({scope:'ordinary MODEL budgets, actual directory/ACL/group/inode/FD drift',home,physical,witness}));
  });

for(const mode of ['held-arity','diagnostic-mutation','preclaim-then-valid'])
  test(`namespace ${mode} cannot mutate or dispose another issued occurrence`,(t)=>{
    const {witness,physical,home}=invoke(mode);
    assert.equal(witness.accepted,1);assert.equal(witness.checked,1);assert.equal(witness.disposed,1);
    assert.deepEqual(witness.liveBefore,[1,1,1,1,1,1]);assert.deepEqual(witness.liveAfter,[0,0,0,0,0,0]);
    if(mode==='held-arity')assert.deepEqual(witness.preclaimCalls,[0,0,0]);
    else if(mode==='preclaim-then-valid')assert.deepEqual(witness.preclaimCalls,[0]);
    else {assert.equal(witness.released.directoryCount,999);assert.equal(witness.again.directoryCount,6);}
    t.diagnostic(JSON.stringify({scope:'ordinary MODEL policy, actual six FH and fresh diagnostics',home,physical,witness}));
  });

test('definite before-effect mkdir refusal cannot report a created directory',(t)=>{
  const {witness,physical,home}=invoke('mkdir-before-false');
  assert.equal(witness.released.createdDirectoryCount,0);
  assert.equal(physical[3].absent,true);
  t.diagnostic(JSON.stringify({home,physical,witness}));
});

for(const [mode,omission] of [['leaf-replacement','named-inode'],['positive-budget','positive-budget']])
  test(`namespace narrow omission ${omission} exposes the armed causal guard`,(t)=>{
    const {witness,physical,home}=invoke(mode,omission);
    assert.equal(witness.armed,1);assert.equal(witness.accepted,1);assert.equal(witness.checked,1);
    if(mode==='leaf-replacement')assert.equal(witness.restoredRefused,0);
    else assert.ok(witness.positiveAfterCheck>8192);
    t.diagnostic(JSON.stringify({scope:'intentional memory-only omission; no admission',omission,home,physical,witness}));
  });

for(const mode of ['open-before-false','open-before-throw','close-after-false','close-after-throw','close-after-foreign'])
  test(`namespace MODEL ${mode} preserves uncertainty despite no remaining known live FH`,(t)=>{
    const {witness,physical,home}=invoke(mode);
    assert.equal(witness.armed,1);assert.equal(witness.fetches,0);assert.equal(witness.disposed,0);assert.equal(witness.disposedAgain,0);
    assert.equal(witness.reacquired,0);assert.equal(witness.refused,1);
    assert.ok(witness.liveAfter.every(value=>value===0));
    assert.equal(witness.events.filter(event=>event[0]==='close').length,witness.liveAfter.length);
    assert.equal(witness.closesBeforeRepeat,witness.liveAfter.length);
    t.diagnostic(JSON.stringify({scope:'ordinary SDK result MODEL, actual native FH close, no closure grant',home,physical,witness}));
  });

test('namespace post-mkdir helper uncertainty retains the immediately enrolled created original',(t)=>{
  const {witness,physical,home}=invoke('post-mkdir-helper');
  assert.deepEqual(witness.events.filter(event=>event[0]==='armed'),[['armed','post-mkdir-helper',4]]);
  assert.equal(witness.accepted,0);assert.equal(witness.disposed,0);
  assert.equal(witness.events.filter(event=>event[0]==='close').length,0);
  assert.deepEqual(witness.liveAfter,[1,1,1,1]);assert.equal(witness.helpersRestored,1);
  assert.equal(witness.disposedAgain,0);assert.equal(witness.closesBeforeRepeat,0);
  assert.equal(physical[3].absent??false,false);
  t.diagnostic(JSON.stringify({scope:'ordinary helper uncertainty MODEL after genuine mkdir/open',home,physical,witness}));
});
