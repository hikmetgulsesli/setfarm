import assert from 'node:assert/strict';
import {readFileSync,lstatSync,readdirSync,unlinkSync,rmdirSync,existsSync,chmodSync} from 'node:fs';
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
const ordinary=process.platform==='darwin'&&typeof process.getuid==='function'
  &&process.getuid()!==0&&process.getuid()===process.geteuid();
const ROLES=['archive-helper','native-helper','map-helper','entry'];
const NAMES=['task6a-origin-archive-v2.pm','task6a-origin-native-v2.pm',
  'task6a-origin-map-v2.pm','task6a-protected-origin-entry-v2.mjs'];
function once(source,from,to) {
  assert.equal(source.split(from).length,2,`unique in-memory port: ${from}`);
  return source.replace(from,()=>to);
}
function cleanupTree({path,dev,ino}) {
  assert.match(path,/^\/private\/tmp\/task6a-source-v2-[a-f0-9]{64}(?:\.original)?$/);
  if(!existsSync(path))return;
  const root=lstatSync(path);
  assert.ok(root.isDirectory()&&!root.isSymbolicLink());
  assert.equal(root.uid,process.getuid());assert.equal(root.dev,dev);assert.equal(root.ino,ino);
  const entries=readdirSync(path);assert.ok(entries.every(x=>x==='source'));
  if(entries.includes('source')) {
    const source=path+'/source',s=lstatSync(source);
    assert.ok(s.isDirectory()&&!s.isSymbolicLink());assert.equal(s.uid,process.getuid());
    const names=readdirSync(source);
    for(const name of names)assert.ok(NAMES.some(n=>name===n||name===n+'.original'));
    // The original child has naturally terminated. Only this ordinary-owned
    // tree is removed; production never performs pathname cleanup.
    chmodSync(source,0o700);
    for(const name of names) {
      const file=source+'/'+name,s=lstatSync(file);
      assert.ok(s.isFile()&&!s.isSymbolicLink());assert.equal(s.uid,process.getuid());assert.equal(s.nlink,1);
      unlinkSync(file);
    }
    rmdirSync(source);
  }
  rmdirSync(path);
}
function snapshotTree({path,dev,ino}) {
  const root=lstatSync(path);assert.equal(root.dev,dev);assert.equal(root.ino,ino);
  assert.equal(root.uid,process.getuid());assert.equal(root.gid,0);
  assert.equal(root.mode&0o7777,0o700);
  const files=[];let sourceMode;
  if(existsSync(path+'/source')) {
    const directory=lstatSync(path+'/source');assert.ok(directory.isDirectory());
    assert.equal(directory.uid,process.getuid());assert.equal(directory.gid,0);sourceMode=directory.mode&0o7777;
    for(const name of readdirSync(path+'/source')) {
      assert.ok(NAMES.some(n=>name===n||name===n+'.original'));
      const file=path+'/source/'+name,s=lstatSync(file);assert.ok(s.isFile()&&!s.isSymbolicLink());
      assert.equal(s.uid,process.getuid());assert.equal(s.gid,0);assert.equal(s.nlink,1);
      const bytes=readFileSync(file);const expected=readFileSync(new URL('../'+name.replace(/\.original$/,''),import.meta.url));
      files.push({name,size:s.size,mode:s.mode&0o7777,
        exact:bytes.equals(expected),prefix:bytes.equals(expected.subarray(0,bytes.length)),
        sha256:createHash('sha256').update(bytes).digest('hex')});
    }
  }
  return {path,sourceMode,files};
}
function invoke(mode='healthy',{modelOwner=true,mutant}={}) {
  assert.ok(ordinary,'no privileged or non-macOS Perl fallback');
  let source=readFileSync(BOOTSTRAP,'utf8');
  assert.ok(source.startsWith(GUARD));
  assert.ok(/sub task6a_origin_create_source_root \{/.test(source),'creator interface is not implemented');
  source=once(source,GUARD,'');source=once(source,'\ntask6a_origin_main();\n','\n');
  if(modelOwner) {
    // Darwin mkdir/file creation inherits the actual parent group0. Model only
    // the ordinary process predicate; do not chown or invent fixture metadata.
    source=once(source,'my ($creator_uid,$creator_gid)=(0,0);',
      `my ($creator_uid,$creator_gid)=(${process.getuid()},0);`);
    source=once(source,String.raw`&&$( =~ /\A$creator_gid(?: |\z)/&&$) =~ /\A$creator_gid(?: |\z)/;`,
      String.raw`&&$( =~ /\A${process.getgid()}(?: |\z)/&&$) =~ /\A${process.getgid()}(?: |\z)/;`);
  }
  source=once(source,'CORE::sysopen($pending,$path,$flags,$mode)',
    'test_creator_open(\\$pending,$path,$flags,$mode)');
  source=once(source,'CORE::syswrite($fh,$bytes,length($bytes))',
    'test_creator_write($fh,$bytes,length($bytes))');
  source=once(source,'CORE::sysread($fh,$buffer,$request)',
    'test_creator_read($fh,\\$buffer,$request)');
  source=once(source,'CORE::close($fh)','test_creator_close($fh)');
  source=once(source,'CORE::mkdir($path,0700)','test_creator_mkdir($path,0700)');
  if(mutant)source=mutant(source);
  const prefix=String.raw`
BEGIN { @INC=('/System/Library/Perl/5.34/darwin-thread-multi-2level','/System/Library/Perl/5.34'); }
use strict; use warnings; use MIME::Base64 (); use JSON::PP (); use Fcntl ();
my $test_mode=$ARGV[0];my @test_events;my @test_roots;my %test_paths;my @test_handles;
my ($test_file_opens,$test_writes,$test_reads,$test_armed)=(0,0,0,0);
my $test_borrowed;my $test_fault_fd;my $test_invalidate;my $test_magic_fetches=0;
{ package TestCreatorMagic;
  sub TIESCALAR {bless {fh=>$_[1]},$_[0]}
  sub FETCH {++$test_magic_fetches;return $_[0]{fh};}
}
sub test_creator_open {
    my ($cell,$path,$flags,$mode)=@_;
    if($path=~m{/source/}) {
        ++$test_file_opens;
        if($test_mode eq 'alias-open'&&!$test_armed) {
            $$cell=$test_borrowed;$test_armed=1;
            push @test_events,['alias',fileno($$cell)];return 1;
        }
    }
    my $result=CORE::sysopen($$cell,$path,$flags,$mode);
    if(defined($$cell)&&defined(fileno($$cell))) {
        my $fd=fileno($$cell);$test_paths{$fd}=$path;
        push @test_events,['open',$fd,$path];push @test_handles,$$cell;
        $test_borrowed=$$cell if $path=~m{/source\z};
        if($path=~m{/source/}&&!$test_armed&&$test_mode eq 'unknown-output') {
            my $native=$$cell;tie $$cell,'TestCreatorMagic',$native;
            $test_armed=1;$test_fault_fd=$fd;push @test_events,['armed','unknown-output',$fd];return 1;
        }
        if($path=~m{/source/}&&!$test_armed&&$test_mode=~/\Aopen-(false|throw)\z/) {
            $test_armed=1;$test_fault_fd=$fd;push @test_events,['armed',$test_mode,$fd];
            die "TEST_EXPOSED_OPEN\n" if $test_mode eq 'open-throw';return 0;
        }
    }
    return $result;
}
sub test_creator_write {
    my ($fh,$bytes,$count)=@_;++$test_writes;
    if($test_mode eq 'partial-write'&&!$test_armed) {
        $test_armed=1;my $n=CORE::syswrite($fh,$bytes,$count-1);
        push @test_events,['armed','partial-write',fileno($fh),$n];return $n;
    }
    my $n=CORE::syswrite($fh,$bytes,$count);
    if(!$test_armed&&$test_mode=~/\A(?:expired-write|unsettled-write|foreign-write)\z/) {
        $test_invalidate->();$test_armed=1;push @test_events,['armed',$test_mode,fileno($fh),$n];
    }
    return $n;
}
sub test_creator_read {
    my ($fh,$cell,$request)=@_;++$test_reads;
    my $n=CORE::sysread($fh,$$cell,$request);
    if($test_mode eq 'readback-drift'&&!$test_armed&&defined($n)&&$n>0
        &&($test_paths{fileno($fh)}//'')=~m{/source/}) {
        substr($$cell,0,1)=chr(ord(substr($$cell,0,1))^1);$test_armed=1;
        push @test_events,['armed','readback-drift',fileno($fh),$n];
    }
    return $n;
}
sub test_creator_close {
    my ($fh)=@_;my $fd=fileno($fh);my $path=$test_paths{$fd}//'';
    push @test_events,['close',$fd,$path];
    if($path=~m{/source/}&&!$test_armed&&$test_mode=~/\Aclose-(false|throw-after)\z/) {
        $test_armed=1;$test_fault_fd=$fd;push @test_events,['armed',$test_mode,$fd];
        return 0 if $test_mode eq 'close-false';
        CORE::close($fh) or die "TEST_REAL_CLOSE_FAILED\n";die "TEST_LOST_CLOSE_RESPONSE\n";
    }
    if($path=~m{/source/}&&!$test_armed&&$test_mode eq 'inode-replacement') {
        CORE::seek($fh,0,0) or die "TEST_SEEK\n";my $bytes='';
        while(1) {my $part='';my $n=CORE::sysread($fh,$part,65536);die "TEST_READ\n" unless defined($n);last unless $n;$bytes.=$part;}
        CORE::rename($path,$path.'.original') or die "TEST_RENAME\n";
        CORE::sysopen(my $new,$path,Fcntl::O_RDWR()|Fcntl::O_CREAT()|Fcntl::O_EXCL(),0600) or die "TEST_NEW\n";
        CORE::syswrite($new,$bytes,length($bytes))==length($bytes) or die "TEST_WRITE\n";
        CORE::chmod(0400,$new)==1 or die "TEST_MODE\n";CORE::close($new) or die "TEST_CLOSE\n";
        $test_armed=1;push @test_events,['armed','inode-replacement',$fd];
    }
    return CORE::close($fh);
}
sub test_creator_mkdir {
    my ($path,$mode)=@_;my $result=CORE::mkdir($path,$mode);push @test_events,['mkdir',$path,$result?1:0];
    if($result&&$test_mode eq 'mkdir-throw-after'&&!$test_armed) {
        $test_armed=1;push @test_events,['armed','mkdir-throw-after'];die "TEST_LOST_MKDIR\n";
    }
    return $result;
}
`;
  const bodies=NAMES.map(name=>readFileSync(new URL('../'+name,import.meta.url)).toString('base64'));
  const suffix=String.raw`
$test_invalidate=sub {
    $bootstrap_deadline=0 if $test_mode eq 'expired-write';
    push @helper_ledger,{settled=>0} if $test_mode eq 'unsettled-write';
    $staged_phase='active' if $test_mode eq 'foreign-write';
};
my @test_bodies=map {MIME::Base64::decode_base64($_)} @ARGV[1..4];
my @test_roles=('archive-helper','native-helper','map-helper','entry');
my ($test_ok,$test_error,$test_diagnostic);
$test_ok=eval {
    task6a_origin_create_source_root();
    if($test_mode eq 'root-replacement') {
        CORE::rename($creator_root,$creator_root.'.original') or die "TEST_ROOT_RENAME\n";
        my @old=CORE::lstat($creator_root.'.original');
        push @test_roots,{path=>$creator_root.'.original',dev=>$old[0],ino=>$old[1]};
        CORE::mkdir($creator_root,0700) or die "TEST_ROOT_NEW\n";
        CORE::mkdir($creator_root.'/source',0700) or die "TEST_SOURCE_NEW\n";
        $test_armed=1;push @test_events,['armed','root-replacement'];
    }
    task6a_origin_create_source_root() if $test_mode eq 'duplicate-create';
    $test_roles[0]='entry' if $test_mode eq 'wrong-order';
    $test_bodies[0].='changed' if $test_mode eq 'wrong-blob';
    for my $index(0..3) {task6a_origin_write_source_member($test_roles[$index],$test_bodies[$index]);}
    $test_diagnostic=task6a_origin_finish_source_writes();
    task6a_origin_finish_source_writes() if $test_mode eq 'duplicate-finish';
    $test_diagnostic=task6a_origin_release_source_creator();
    task6a_origin_release_source_creator() if $test_mode eq 'duplicate-release';
    1;
};$test_error=$@;my $test_terminal_phase=$creator_phase;
my $retry=eval {task6a_origin_create_source_root();1;};my $retry_error=$@;
if(defined($creator_root)) {
    my @now=CORE::lstat($creator_root);
    push @test_roots,{path=>$creator_root,dev=>$now[0],ino=>$now[1]} if @now==13;
}
my @live;my @test_actual_live=map {CORE::fileno($_)} grep {defined(CORE::fileno($_))} @test_handles;
for my $original(@creator_originals) {my ($fh,$fd,$attempted,$closed)=$original->('binding');push @live,$fd if defined(CORE::fileno($fh));}
print JSON::PP->new->canonical->encode({ok=>$test_ok?JSON::PP::true:JSON::PP::false,
    error=>$test_error,retry=>$retry?JSON::PP::true:JSON::PP::false,retryError=>$retry_error,
    phase=>$test_terminal_phase,postRetryPhase=>$creator_phase,uncertain=>$creator_uncertain?JSON::PP::true:JSON::PP::false,
    count=>$creator_source_count,admission=>defined($staged_admission)?JSON::PP::true:JSON::PP::false,
    diagnostic=>$test_diagnostic,events=>\@test_events,roots=>\@test_roots,live=>\@live,actualLive=>\@test_actual_live,
    magicFetches=>$test_magic_fetches,
    armed=>$test_armed?JSON::PP::true:JSON::PP::false,faultFD=>$test_fault_fd,
    fileOpens=>$test_file_opens,writes=>$test_writes,reads=>$test_reads});
`;
  const r=spawnSync('/usr/bin/perl',['-f','-e',prefix+source+suffix,mode,...bodies],{
    cwd:'/',env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'},timeout:10000,maxBuffer:1048576,encoding:'utf8',
  });
  // Do not clean uncertain original termination or unparsable evidence.
  assert.equal(r.error,undefined);assert.equal(r.signal,null);assert.equal(r.status,0,r.stderr);
  assert.equal(r.stderr,'');const out=JSON.parse(r.stdout);
  try {
    assert.equal(out.admission,false);assert.equal(out.retry,false);assert.match(out.retryError,/TASK6A_ORIGIN_BOOTSTRAP_REFUSED/);
    out.artifacts=out.roots.map(snapshotTree);
  }
  finally {for(const root of out.roots)cleanupTree(root);}
  return out;
}
function refused(out) {
  assert.equal(out.ok,false);assert.match(out.error,/TASK6A_ORIGIN_BOOTSTRAP_REFUSED/);
  assert.equal(out.phase,'burned');
  const attempts=out.events.filter(x=>x[0]==='close').map(x=>x[1]);
  // FD numbers can be reused only after a previous genuine close. Match each
  // open interval rather than treating a reused integer as a new alias.
  const live=new Set();
  for(const event of out.events) {
    if(event[0]==='open') {assert.ok(!live.has(event[1]));live.add(event[1]);}
    if(event[0]==='close') {assert.ok(live.has(event[1]),'close retried or borrowed');live.delete(event[1]);}
  }
  if(out.uncertain&&out.armed&&out.events.some(x=>x[0]==='armed'&&x[1]==='unknown-output')) {
    assert.deepEqual([...live],[out.faultFD],'only the unclassifiable original may remain without a close attempt');
  } else assert.equal(live.size,0,'unclosed original acquisition omitted from owned ledger');
  assert.ok(attempts.length>0||out.events.length===0);
}

test('source creator ordinary actual IO and modeled owner controls',{skip:!ordinary},async t=>{
  await t.test('ordinary unmodified owner predicate refuses before any acquisition',()=>{
    const out=invoke('healthy',{modelOwner:false});refused(out);assert.deepEqual(out.events,[]);assert.deepEqual(out.roots,[]);
  });
  await t.test('writes exact fixed sources, seals and closes originals without admission',()=>{
    const out=invoke();assert.equal(out.ok,true,JSON.stringify(out));assert.equal(out.count,4);assert.equal(out.phase,'released');
    assert.equal(out.uncertain,false);assert.deepEqual(out.live,[]);assert.deepEqual(out.actualLive,[]);assert.equal(out.fileOpens,4);assert.equal(out.writes,4);
    assert.deepEqual(out.diagnostic,{scope:'source-creator-write-custody-diagnostic-only',productionAuthority:false,sourceCount:4,handlesClosed:10});
    assert.equal(out.events.filter(x=>x[0]==='mkdir').length,2);assert.equal(out.events.filter(x=>x[0]==='close').length,10);
    assert.equal(out.artifacts.length,1);assert.equal(out.artifacts[0].sourceMode,0o555);
    assert.equal(out.artifacts[0].files.length,4);
    for(const file of out.artifacts[0].files) {assert.equal(file.exact,true);assert.equal(file.mode,file.name===NAMES[3]?0o444:0o400);}
  });
  for(const mode of ['wrong-order','wrong-blob','duplicate-create'])await t.test(`${mode} burns before file write`,()=>{
    const out=invoke(mode);refused(out);assert.equal(out.fileOpens,0);assert.equal(out.writes,0);assert.deepEqual(out.live,[]);
  });
  for(const mode of ['open-false','open-throw','partial-write','readback-drift','inode-replacement','root-replacement','alias-open','mkdir-throw-after',
    'expired-write','unsettled-write','foreign-write'])
    await t.test(`${mode} reaches real effect and closes known originals once`,()=>{
      const out=invoke(mode);refused(out);assert.equal(out.armed,true);assert.deepEqual(out.live,[]);
      assert.equal(out.count,0);assert.ok(out.fileOpens<=1);assert.ok(out.writes<=1);assert.equal(out.uncertain,false);
      assert.deepEqual(out.actualLive,[]);
      if(mode==='open-false'||mode==='open-throw') {
        assert.equal(out.events.filter(x=>x[0]==='close'&&x[1]===out.faultFD&&x[2].includes('/source/')).length,1);
      }
      if(mode==='partial-write'||['expired-write','unsettled-write','foreign-write'].includes(mode)) {
        assert.equal(out.fileOpens,1);assert.equal(out.writes,1);
        const event=out.events.find(x=>x[0]==='armed'&&x[1]===mode);assert.ok(event);
        const expected=readFileSync(new URL('../'+NAMES[0],import.meta.url)).length;
        assert.equal(event[3],mode==='partial-write'?expected-1:expected);assert.ok(event[3]>0);
        const file=out.artifacts[0].files[0];assert.equal(file.name,NAMES[0]);assert.equal(file.size,event[3]);
        assert.equal(file.prefix,true);assert.equal(file.exact,mode!=='partial-write');assert.equal(file.mode,0o600);
        assert.equal(out.artifacts[0].sourceMode,0o700);
      }
    });
  await t.test('unclassifiable exposed original is retained without magic fetch or guessed close',()=>{
    const out=invoke('unknown-output');refused(out);assert.equal(out.armed,true);assert.equal(out.uncertain,true);
    assert.equal(out.magicFetches,0);assert.deepEqual(out.actualLive,[out.faultFD]);assert.deepEqual(out.live,[]);
    assert.equal(out.events.filter(x=>x[0]==='close'&&x[1]===out.faultFD&&x[2].includes('/source/')).length,0);
  });
  for(const mode of ['close-false','close-throw-after'])await t.test(`${mode} is sticky and never retried`,()=>{
    const out=invoke(mode);refused(out);assert.equal(out.armed,true);assert.equal(out.uncertain,true);assert.equal(out.count,0);
    assert.equal(out.events.filter(x=>x[0]==='close'&&x[1]===out.faultFD&&x[2].includes('/source/')).length,1);
    assert.equal(out.live.length,mode==='close-false'?1:0);
    assert.deepEqual(out.actualLive,out.live);
  });
  for(const mode of ['duplicate-finish','duplicate-release'])await t.test(`${mode} refuses re-entry`,()=>{
    const out=invoke(mode);refused(out);assert.equal(out.count,4);assert.deepEqual(out.live,[]);
  });
  for(const [name,mode,from,to] of [
    ['readback comparison','readback-drift',String.raw`task6a_origin_refuse() unless $observed eq $bytes
            &&Digest::SHA::sha256_hex($observed) eq Digest::SHA::sha256_hex($bytes);`,'# TEST omitted byte/readback agreement'],
    ['original inode comparison','inode-replacement','for my $field(0,1,4,5) {task6a_origin_refuse() unless $before->[$field]==$now->[$field];}',
      'for my $field(4,5) {task6a_origin_refuse() unless $before->[$field]==$now->[$field];}'],
    ['close response certainty','close-throw-after','$closed=1 if $result&&!length($close_error)&&$inspected',
      '$closed=1 if $inspected'],
    ['fixed deadline','expired-write',String.raw`task6a_origin_refuse() unless task6a_origin_helpers_settled()
        &&task6a_origin_now()<$bootstrap_deadline;`,String.raw`task6a_origin_refuse() unless task6a_origin_helpers_settled();`],
    ['helper settlement','unsettled-write',String.raw`task6a_origin_refuse() unless task6a_origin_helpers_settled()
        &&task6a_origin_now()<$bootstrap_deadline;`,String.raw`task6a_origin_refuse() unless task6a_origin_now()<$bootstrap_deadline;`],
  ])await t.test(`${name} omission accepts armed fault in memory only`,()=>{
    const out=invoke(mode,{mutant:source=>once(source,from,to)});
    assert.equal(out.armed,true);assert.equal(out.ok,true,JSON.stringify(out));assert.equal(out.count,4);assert.deepEqual(out.live,[]);
  });
  await t.test('independent original oracle detects omitted exposed-output enrollment',()=>{
    const out=invoke('open-throw',{mutant:source=>once(source,'push @creator_originals,$sealed;',
      'push @creator_originals,$sealed unless Fcntl::S_ISREG((CORE::stat($fh))[2]);')});
    assert.equal(out.armed,true);assert.equal(out.ok,false);assert.deepEqual(out.live,[]);
    assert.deepEqual(out.actualLive,[out.faultFD]);
    assert.throws(()=>refused(out),/unclosed original acquisition omitted from owned ledger/);
  });
});
