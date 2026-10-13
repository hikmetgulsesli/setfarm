import assert from 'node:assert/strict';
import {readFileSync,lstatSync,readdirSync,unlinkSync,rmdirSync,existsSync,chmodSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {userInfo} from 'node:os';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import test from 'node:test';
import {sourceGraph} from './fixtures/task6a-origin-transport-fixtures-v2.js';

const BOOTSTRAP=new URL('../task6a-protected-origin-bootstrap-v2.pl',import.meta.url);
const GUARD=String.raw`# Cold entry stays closed before any candidate PM/XS import.
BEGIN {
    CORE::print STDERR "TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n";
    CORE::exit(2);
}
`;
const ordinary=process.platform==='darwin'&&typeof process.getuid==='function'
  &&process.getuid()!==0&&process.getuid()===process.geteuid();
const NAMES=['task6a-origin-archive-v2.pm','task6a-origin-native-v2.pm',
  'task6a-origin-map-v2.pm','task6a-protected-origin-entry-v2.mjs'];
const FILENAME='node-v22.23.1-darwin-arm64.tar.gz';
const MEMBER='node-v22.23.1-darwin-arm64/bin/node';
const PIN='ef28d8fab2c0e4314522d4bb1b7173270aa3937e93b92cb7de79c112ac1fa953';
const hash=b=>createHash('sha256').update(b).digest('hex');
function once(s,a,b) {assert.equal(s.split(a).length,2,`unique memory port: ${a}`);return s.replace(a,()=>b);}
function nativeBytes() {
  const commands=[[0xe,12,'/usr/lib/dyld'],[0xc,24,'/usr/lib/libSystem.B.dylib']].map(([kind,offset,name])=>{
    const b=Buffer.alloc(Math.ceil((offset+name.length+1)/8)*8);
    b.writeUInt32LE(kind);b.writeUInt32LE(b.length,4);b.writeUInt32LE(offset,8);b.write(name,offset);return b;
  });
  const table=Buffer.concat(commands),header=Buffer.alloc(32);
  [0xfeedfacf,0x0100000c,0,2,commands.length,table.length,0x200000,0].forEach((n,i)=>header.writeUInt32LE(n,4*i));
  return Buffer.concat([header,table]);
}
function archiveBytes(payload,{member=MEMBER,duplicate=false}={}) {
  const h=Buffer.alloc(512);h.write(member);h.write('0000700\0',100);
  h.write('0000000\0',108);h.write('0000000\0',116);
  h.write(payload.length.toString(8).padStart(11,'0')+'\0',124);
  h.write('00000000000\0',136);h.fill(32,148,156);h.write('0',156);h.write('ustar\0'+'00',257);
  h.write(h.reduce((s,b)=>s+b,0).toString(8).padStart(6,'0')+'\0 ',148);
  const item=Buffer.concat([h,payload,Buffer.alloc((512-payload.length%512)%512)]);
  return gzipSync(Buffer.concat([item,...(duplicate?[item]:[]),Buffer.alloc(1024)]));
}
function cleanup({path,dev,ino}) {
  assert.match(path,/^\/private\/tmp\/task6a-source-v2-[a-f0-9]{64}$/);
  const root=lstatSync(path);assert.ok(root.isDirectory()&&!root.isSymbolicLink());
  assert.equal(root.uid,process.getuid());assert.equal(root.dev,dev);assert.equal(root.ino,ino);
  const dirs=readdirSync(path);assert.ok(dirs.every(n=>['source','vendor'].includes(n)));
  // Original child has naturally terminated; strict ordinary-owned allowlist.
  chmodSync(path,0o700);
  for(const dir of dirs) {
    const p=path+'/'+dir,s=lstatSync(p);assert.ok(s.isDirectory()&&!s.isSymbolicLink());assert.equal(s.uid,process.getuid());
    const names=readdirSync(p);assert.ok(names.every(n=>dir==='source'?NAMES.includes(n):[FILENAME,'node'].includes(n)));
    chmodSync(p,0o700);
    for(const n of names) {const f=p+'/'+n,s=lstatSync(f);assert.ok(s.isFile()&&!s.isSymbolicLink());assert.equal(s.uid,process.getuid());assert.equal(s.nlink,1);unlinkSync(f);}
    rmdirSync(p);
  }
  rmdirSync(path);
}
function invoke(mode='healthy',{mutant,modelOwner=true}={}) {
  assert.ok(ordinary,'ordinary macOS only; no root/ambient interpreter fallback');
  let source=readFileSync(BOOTSTRAP,'utf8');assert.ok(source.startsWith(GUARD));
  assert.ok(/sub task6a_origin_produce_source_vendor_staged_custody \{/.test(source),'owned producer interface missing');
  source=once(source,GUARD,'');source=once(source,'\ntask6a_origin_main();\n','\n');
  if(modelOwner) {
    source=once(source,'my ($creator_uid,$creator_gid)=(0,0);',`my ($creator_uid,$creator_gid)=(${process.getuid()},0);`);
    source=source.replaceAll(String.raw`&&$( =~ /\A$creator_gid(?: |\z)/&&$) =~ /\A$creator_gid(?: |\z)/;`,
      String.raw`&&$( =~ /\A$test_group_expect(?: |\z)/&&$) =~ /\A$test_group_expect(?: |\z)/;`);
    source=once(source,'&&$creation[4]==0&&$creation[5]==0;',`&&$creation[4]==${process.getuid()}&&$creation[5]==0;`);
    source=once(source,'&&$before[4]==0&&$before[5]==0;\n            my $mode=',
      `&&$before[4]==($index>=3?${process.getuid()}:0)&&$before[5]==0;\n            my $mode=`);
    source=once(source,'&&$before[4]==0&&$before[5]==0&&$before[7]==$expected->{size};',
      `&&$before[4]==${process.getuid()}&&$before[5]==0&&$before[7]==$expected->{size};`);
    const username=userInfo().username;assert.match(username,/^[A-Za-z][A-Za-z0-9_]*$/);
    source=once(source,'root[ ]+wheel[ ]+',`(?:root|${username})[ ]+wheel[ ]+`);
  }
  let node=nativeBytes();if(mode==='native-invalid')node[0]^=1;
  const archive=archiveBytes(node,{member:mode==='member-missing'?'elsewhere':MEMBER,duplicate:mode==='member-duplicate'});
  assert.equal(source.split(PIN).length,3,'exact two production literal vendor pins');source=source.replaceAll(PIN,hash(archive));
  const graph=sourceGraph();if(mode==='source-blob-invalid')graph[6].data.size++;
  const responses=graph.map(({route,data})=>({url:'https://api.github.com/repos/hikmetgulsesli/setfarm'+route,
    body:Buffer.from(JSON.stringify(data)).toString('base64'),type:'application/json'}));
  const manifest=(mode==='manifest-invalid'?'0'.repeat(64):hash(archive))+'  '+FILENAME+'\n';
  responses.push({url:'https://nodejs.org/dist/v22.23.1/SHASUMS256.txt',body:Buffer.from(manifest).toString('base64'),type:'text/plain'},
    {url:'https://nodejs.org/dist/v22.23.1/'+FILENAME,body:(mode==='archive-invalid'?Buffer.concat([archive,Buffer.from('x')]):archive).toString('base64'),type:'application/gzip'});
  source=once(source,"'/usr/bin/curl'=>1,","'/usr/bin/curl'=>1,'/usr/bin/perl'=>1,");
  source=once(source,'sub task6a_origin_capture {','sub test_original_capture {');
  source=once(source,'sub task6a_origin_refuse {die',
    'sub task6a_origin_refuse {push @test_failures, [caller(0)];die');
  source=once(source,'CORE::sysopen($pending,$path,$flags,$mode)','test_open(\\$pending,$path,$flags,$mode,\'creator\')');
  source=once(source,'sysopen($pending,$path,$flags)','test_open(\\$pending,$path,$flags,0,\'staged\')');
  source=once(source,'CORE::close($fh)','test_close($fh,\'creator\')');
  source=once(source,'my $original_close=sub {close($fh)};','my $original_close=sub {test_close($fh,\'staged\')};');
  source=once(source,'CORE::syswrite($fh,$bytes,length($bytes))','test_write($fh,$bytes,length($bytes))');
  source=once(source,'CORE::sysread($fh,$buffer,$request)','test_read($fh,\\$buffer,$request)');
  source=once(source,'CORE::chmod(0555,$vendor_fh)',"test_chmod(0555,$vendor_fh,'vendor')");
  source=once(source,'CORE::chmod(0711,$root_fh)',"test_chmod(0711,$root_fh,'root')");
  source=once(source,'my $selected=$decoder->($archive);','my $selected=test_decoder($decoder,$archive);');
  source=once(source,"Encode::decode('UTF-8',$body,Encode::FB_CROAK()|Encode::LEAVE_SRC())","test_decode('UTF-8',$body,Encode::FB_CROAK()|Encode::LEAVE_SRC())");
  source=once(source,'my @completed_cells=','test_entry_copy();my @completed_cells=');
  source=once(source,'$native->($node);$creator_epoch->();','test_native($native,$node);$creator_epoch->();');
  source=once(source,String.raw`my $record=$staged_container->(\$observed,'B::HV');`,
    String.raw`test_rows($observed);my $record=$staged_container->(\$observed,'B::HV');`);
  source=once(source,'CORE::mkdir($path,0700)','test_mkdir($path,0700)');
  source=once(source,'CORE::mkdir($vendor_path,0700)','test_mkdir($vendor_path,0700)');
  source=once(source,'my $result=eval $bytes;','++$test_evals;my $result=eval $bytes;');
  source=once(source,'my $native_result=eval $native_bytes;','++$test_evals;my $native_result=eval $native_bytes;');
  source=once(source,'my $map_result=eval $map_bytes;','++$test_evals;my $map_result=eval $map_bytes;');
  for(const boundary of ['before-assignment','before-hold','after-hold','before-recheck','after-recheck','before-held'])
    source=once(source,'# Producer boundary: '+boundary+'.',`test_boundary('${boundary}');\n        # Producer boundary: ${boundary}.`);
  if(mutant)source=mutant(source);
  const prefix=String.raw`
BEGIN { @INC=('/System/Library/Perl/5.34/darwin-thread-multi-2level','/System/Library/Perl/5.34'); }
use strict;use warnings;use JSON::PP ();use MIME::Base64 ();use Fcntl ();
my $test_mode=$ARGV[0];my $test_group_expect=$ARGV[2];my (@test_events,@test_roots,@test_handles,@test_failures);my (%test_ids,%test_counts);
my ($test_transport,$test_writes,$test_evals,$test_armed,$test_callbacks)=(0,0,0,0,0);
my ($test_invalidate,$test_responses,$test_unknown);
my ($test_decoders,$test_natives,$test_fault_id,$test_json_decodes)=(0,0,undef,0);
my ($test_retained_drift,$test_entry_drift);
{package TestProducerMagic;sub TIESCALAR {bless {},$_[0]}sub FETCH {++$test_callbacks;die "TEST_CALLBACK\n";}}
{package TestProducerOverload;use overload '=='=>sub {++$test_callbacks;return 0;},fallback=>1;}
{package TestProducerHash;sub TIEHASH {bless {},$_[0]}sub FETCH {++$test_callbacks;die "TEST_CALLBACK\n";}sub FIRSTKEY {++$test_callbacks;die "TEST_CALLBACK\n";}}
sub test_boundary {
  my ($where)=@_;push @test_events,['boundary',$where];
  $test_retained_drift->() if $where eq 'before-hold'&&$test_mode=~/\Aretained-/;
  if(!$test_armed&&$where eq 'before-assignment'&&$test_mode eq 'source-disk-drift') {
    my ($root)=@test_roots;my $path=$root->{path}.'/source/task6a-origin-native-v2.pm';
    CORE::chmod(0600,$path)==1 or die "TEST_DISK_MODE\n";
    CORE::sysopen(my $disk,$path,Fcntl::O_RDWR()) or die "TEST_DISK_OPEN\n";
    my @before=CORE::lstat($path);CORE::syswrite($disk,'!',1)==1 or die "TEST_DISK_WRITE\n";
    CORE::chmod(0400,$disk)==1 or die "TEST_DISK_MODE\n";CORE::close($disk) or die "TEST_DISK_CLOSE\n";
    $test_armed=1;my @after=CORE::lstat($path);push @test_events,['disk-drift',$before[0],$after[0],$before[1],$after[1]];
    push @test_events,['armed',$test_mode];
  }
  if(!$test_armed&&$test_mode=~/\A\Q$where\E-(deadline|helper|foreign|owner|group)\z/) {$test_armed=1;$test_invalidate->($1);}
}
sub test_open {
  my ($cell,$path,$flags,$mode,$realm)=@_;
  if($realm eq 'staged'&&!grep {$_->[0] eq 'open'&&$_->[1] eq 'staged'} @test_events) {
    my @creator=grep {$_->{realm} eq 'creator'} @test_handles;
    push @test_events,['creator-at-first-stage',scalar(@creator),scalar(grep {!defined(fileno($_->{fh}))} @creator)];
  }
  my $r=CORE::sysopen($$cell,$path,$flags,$mode);
  push @test_events,['open-failed',$realm,$path,0+$!] unless $r;
  if(defined($$cell)&&defined(fileno($$cell))) {
    my $fh=$$cell;my $id=1+@test_handles;$test_ids{"$fh"}=$id;
    push @test_handles,{fh=>$fh,id=>$id,realm=>$realm,path=>$path,fd=>fileno($fh)};
    push @test_events,['open',$realm,$id,fileno($fh),$path];
    if(!$test_armed&&$path=~m{/vendor/}&&$test_mode=~/\Avendor-open-(false|throw|unknown)\z/) {
      $test_armed=1;$test_fault_id=$id;push @test_events,['armed',$test_mode,$id];
      if($1 eq 'unknown') {$test_unknown=$fh;tie $$cell,'TestProducerMagic';return 1;}
      die "TEST_EXPOSED_OPEN\n" if $1 eq 'throw';return 0;
    }
    if(!$test_armed&&$realm eq 'staged'&&$test_mode eq 'staged-open-throw') {$test_armed=1;$test_fault_id=$id;push @test_events,['armed',$test_mode,$id];die "TEST_EXPOSED_STAGE\n";}
  }
  return $r;
}
sub test_close {
  my ($fh,$realm)=@_;my $id=$test_ids{"$fh"};++$test_counts{$id};push @test_events,['close',$realm,$id,fileno($fh)];
  my ($record)=grep {$_->{id}==$id} @test_handles;
  if(!$test_armed&&$record->{path}=~m{/vendor/}&&$test_mode=~/\Avendor-close-(false|throw)\z/) {
    $test_armed=1;$test_fault_id=$id;push @test_events,['armed',$test_mode,$id];return 0 if $1 eq 'false';CORE::close($fh) or die "TEST_REAL_CLOSE\n";die "TEST_LOST_CLOSE\n";
  }
  return CORE::close($fh);
}
sub test_write {
  my ($fh,$bytes,$count)=@_;++$test_writes;my $id=$test_ids{"$fh"};my ($r)=grep {$_->{id}==$id} @test_handles;
  if(!$test_armed&&$r->{path}=~m{/vendor/}&&$test_mode eq 'vendor-partial-write') {$test_armed=1;$test_fault_id=$id;push @test_events,['armed',$test_mode,$id];return CORE::syswrite($fh,$bytes,$count-1);}
  return CORE::syswrite($fh,$bytes,$count);
}
sub test_read {
  my ($fh,$cell,$request)=@_;my $n=CORE::sysread($fh,$$cell,$request);my $id=$test_ids{"$fh"};
  my ($r)=grep {$_->{id}==$id} @test_handles;
  if(!$test_armed&&$test_mode eq 'vendor-readback-drift'&&$r->{path}=~m{/vendor/}&&$n>0) {
    $test_armed=1;$test_fault_id=$id;substr($$cell,0,1)='!';push @test_events,['armed',$test_mode,$id];
  }
  return $n;
}
sub test_chmod {
  my ($mode,$fh,$kind)=@_;my $r=CORE::chmod($mode,$fh);push @test_events,['chmod',$kind,$mode,$r];
  if(!$test_armed&&$test_mode=~/\A\Q$kind\E-seal-(false|throw)\z/) {
    $test_armed=1;push @test_events,['armed',$test_mode];die "TEST_LOST_CHMOD\n" if $1 eq 'throw';return 0;
  }
  return $r;
}
sub test_decoder {
  my ($code,$bytes)=@_;++$test_decoders;my $out=$code->($bytes);
  if(!$test_armed&&$test_mode=~/\Adecoder-(deadline|helper|foreign)\z/) {$test_armed=1;$test_invalidate->($1);}
  return $out;
}
sub test_native {
  my ($code,$bytes)=@_;++$test_natives;my $out=$code->($bytes);
  if(!$test_armed&&$test_mode=~/\Anative-(deadline|helper|foreign)\z/) {$test_armed=1;$test_invalidate->($1);}
  return $out;
}
sub test_decode {++$test_json_decodes;return Encode::decode($_[0],$_[1],$_[2]);}
sub test_entry_copy {$test_entry_drift->() if $test_mode=~/\Aentry-/;}
sub test_rows {
  my ($record)=@_;return unless $test_mode=~/\Arow-/;my $row=$record->{sources}[0];$test_armed=1;
  $row->{path}='source/task6a-origin-archive-v2.pm' if $test_mode eq 'row-path';
  $row->{gitBlobSha}='0'x40 if $test_mode eq 'row-blob';$row->{contentSha256}='0'x64 if $test_mode eq 'row-hash';
  ++$row->{byteLength} if $test_mode eq 'row-size';$row->{bytes}.='!' if $test_mode eq 'row-bytes';
  tie $row->{bytes},'TestProducerMagic' if $test_mode eq 'row-magic';tie %$row,'TestProducerHash' if $test_mode eq 'row-tied';
  push @test_events,['armed',$test_mode];
}
sub test_mkdir {
  my ($path,$mode)=@_;my $r=CORE::mkdir($path,$mode);
  if($r&&$path=~m{/task6a-source-v2-[a-f0-9]{64}\z}) {my @s=CORE::lstat($path);push @test_roots,{path=>$path,dev=>$s[0],ino=>$s[1]};}
  return $r;
}
sub task6a_origin_capture {
  my ($tool,$args,$seconds,$limit)=@_;
  return test_original_capture(@_) unless $tool eq '/usr/bin/curl';
  my $i=$test_transport++;my $row=$test_responses->[$i];die "TEST_ROUTE_MISSING\n" unless defined($row)&&$args->[-1] eq $row->{url};
  push @test_events,['transport',$i,$args->[-1]];
  my $bytes=MIME::Base64::decode_base64($row->{body})."\n200\n".$row->{type}."\n".$row->{url};
  $bytes=~s/\n200\n/\n503\n/ if $test_mode eq 'transport-http-invalid'&&$i==0;
  my $encoded=MIME::Base64::encode_base64($bytes,'');my @parts=($encoded=~/.{1,4096}/g);
  my $program=q{BEGIN {@INC=('/System/Library/Perl/5.34/darwin-thread-multi-2level','/System/Library/Perl/5.34');}use MIME::Base64 ();binmode STDOUT;print MIME::Base64::decode_base64(join('',@ARGV)) or die "TEST_OUTPUT\n";};
  my $r=test_original_capture('/usr/bin/perl',['-f','-e',$program,@parts],$seconds,$limit);
  if(!$test_armed&&$test_mode=~/\Atransport-(deadline|helper|foreign)-([0-9]+)\z/&&$i==$2) {$test_armed=1;$test_invalidate->($1);}
  return $r;
}
`;
  const suffix=String.raw`
$test_invalidate=sub {
  my ($kind)=@_;push @test_events,['invalidate',$kind];
  $bootstrap_deadline=0 if $kind eq 'deadline';$helper_lifecycle_burned=1 if $kind eq 'helper';
  $physical_state='TEST_FOREIGN' if $kind eq 'foreign';$creator_uid=0 if $kind eq 'owner';
  $test_group_expect=0 if $kind eq 'group';
};
$test_retained_drift=sub {
  $test_armed=1;
  if($test_mode eq 'retained-row-overload'||$test_mode eq 'retained-row-tied') {
    my $old=$staged_admission->{sources}[0];my $copy={%$old};$staged_admission->{sources}[0]=$copy;
    if($test_mode eq 'retained-row-overload') {bless $old,'TestProducerOverload';}
    else {tie %$old,'TestProducerHash';}
  }
  tie $producer_handoff_snapshot->{values}[30],'TestProducerMagic' if $test_mode eq 'retained-value-magic';
  tie %$producer_handoff_snapshot,'TestProducerHash' if $test_mode eq 'retained-snapshot-tied';
  push @test_events,['armed',$test_mode];
};
$test_entry_drift=sub {
  $test_armed=1;$creator_entry_readback.='!' if $test_mode eq 'entry-readback-drift';
  $creator_entry_commitment='0'x64 if $test_mode eq 'entry-commitment-drift';
  push @test_events,['armed',$test_mode];
};
$test_responses=JSON::PP->new->decode(MIME::Base64::decode_base64($ARGV[1]));
my ($result,$hold_release,$prior_owner,$prior_release,$prior_error);
if($test_mode eq 'prior-creator') {task6a_origin_create_source_root();}
my $ok=eval {
  $result=$test_mode eq 'arity'?task6a_origin_produce_source_vendor_staged_custody('borrowed')
    :task6a_origin_produce_source_vendor_staged_custody();1;
};my $error=$@;
my ($repeat_error,$before_repeat);$before_repeat=scalar(@test_events);
my ($retry_error,$retry_delta,$prior_live);
if(!$ok&&$producer_staged_started) {
  $bootstrap_deadline=task6a_origin_now()+180;$helper_lifecycle_burned=0;$physical_state='new';$creator_uid=$<;
  my $before=scalar(@test_events);eval {task6a_origin_hold_staged_custody()};$retry_error=$@;
  $retry_delta=scalar(@test_events)-$before;
}
if($test_mode eq 'prior-creator') {
  $prior_live=scalar(grep {defined(fileno($_->{fh}))} @test_handles);
  $prior_owner=[map {0+($test_counts{$_->{id}}//0)} @test_handles];
  eval {
    for my $index(0..3) {
      my $blob=JSON::PP->new->decode(MIME::Base64::decode_base64($test_responses->[$index+6]{body}));
      my $bytes=MIME::Base64::decode_base64($blob->{content});
      task6a_origin_write_source_member($staged_policy[$index][0],$bytes);
    }
    task6a_origin_finish_source_writes();$prior_release=task6a_origin_release_source_creator();
  };$prior_error=$@;
}
if($ok&&$test_mode eq 'reentry') {eval {task6a_origin_produce_source_vendor_staged_custody()};$repeat_error=$@;}
my $repeat_delta=scalar(@test_events)-$before_repeat;
if($ok) {$hold_release=task6a_origin_release_staged_custody();}
my @handles=map {{id=>$_->{id},realm=>$_->{realm},path=>$_->{path},fd=>$_->{fd},
  closeAttempts=>0+($test_counts{$_->{id}}//0),live=>defined(fileno($_->{fh}))?JSON::PP::true:JSON::PP::false}} @test_handles;
my @helpers=map {{pid=>$_->{pid},settled=>$_->{settled}?JSON::PP::true:JSON::PP::false}} @helper_ledger;
print JSON::PP->new->canonical->encode({ok=>$ok?JSON::PP::true:JSON::PP::false,error=>$error,
  result=>$result,release=>$hold_release,events=>\@test_events,roots=>\@test_roots,handles=>\@handles,
  transport=>$test_transport,writes=>$test_writes,evals=>$test_evals,armed=>$test_armed,failures=>\@test_failures,
  callbacks=>$test_callbacks,helpers=>\@helpers,producerPhase=>$producer_phase,
  decoderUses=>$test_decoders,nativeUses=>$test_natives,faultID=>$test_fault_id,jsonDecodes=>$test_json_decodes,
  retryError=>$retry_error,retryDelta=>$retry_delta,priorLive=>$prior_live,priorCloseCounts=>$prior_owner,priorRelease=>$prior_release,priorError=>$prior_error,
  creatorPhase=>$creator_phase,stagedPhase=>$staged_phase,creatorUncertain=>$creator_uncertain,
  repeatError=>$repeat_error,repeatDelta=>$repeat_delta,admissionDefined=>defined($staged_admission)?JSON::PP::true:JSON::PP::false});
`;
  const program=prefix+source+suffix;
  const r=spawnSync('/usr/bin/perl',['-f','-e',program,mode,
    Buffer.from(JSON.stringify(responses)).toString('base64'),String(process.getgid())],{
    cwd:'/',env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'},timeout:20000,maxBuffer:2097152,
  });
  assert.equal(r.error,undefined);assert.equal(r.signal,null);assert.equal(r.status,0,r.stderr.toString());
  assert.equal(r.stderr.length,0);const out=JSON.parse(r.stdout.toString());
  const snapshots=[];
  for(const root of out.roots) {
    const s=lstatSync(root.path);assert.equal(s.dev,root.dev);assert.equal(s.ino,root.ino);
    const files=[];for(const d of readdirSync(root.path)) {
      assert.ok(['source','vendor'].includes(d));const ds=lstatSync(root.path+'/'+d);
      assert.equal(ds.uid,process.getuid());assert.equal(ds.gid,0);
      for(const name of readdirSync(root.path+'/'+d)) {
        const p=root.path+'/'+d+'/'+name,s=lstatSync(p);assert.equal(s.uid,process.getuid());assert.equal(s.gid,0);assert.equal(s.nlink,1);
        const expected=d==='source'?readFileSync(new URL('../'+name,import.meta.url)):name==='node'?node:archive;
        files.push({path:d+'/'+name,mode:s.mode&0o7777,size:s.size,exact:readFileSync(p).equals(expected),prefix:readFileSync(p).equals(expected.subarray(0,s.size))});
      }
    }
    snapshots.push({rootMode:s.mode&0o7777,sourceMode:lstatSync(root.path+'/source').mode&0o7777,
      vendorMode:existsSync(root.path+'/vendor')?lstatSync(root.path+'/vendor').mode&0o7777:null,files});
  }
  // Child is natural terminal0/null. Unknown owner remains unclosed until that
  // terminal; no guessed close or signal in the program or this parent.
  for(const root of out.roots)cleanup(root);
  out.snapshots=snapshots;out.fixtureArchiveLength=archive.length;out.failureLines=out.failures.map(f=>program.split('\n').slice(f[2]-2,f[2]+1));return out;
}
if(!ordinary)test('source/vendor producer requires ordinary macOS UID',{skip:'no root or unsupported host fallback'},()=>{});
else {
  test('owned source/vendor producer hands thirteen closed creator originals to twelve staged originals',()=>{
    const r=invoke();assert.equal(r.ok,true,JSON.stringify(r));assert.equal(r.transport,13);assert.equal(r.evals,3);assert.equal(r.writes,6);assert.equal(r.decoderUses,1);assert.equal(r.nativeUses,1);
    assert.deepEqual(r.result,{scope:'source-vendor-producer-custody-diagnostic-only',productionAuthority:false,
      sourceCount:4,vendorCount:2,creatorHandlesClosed:13,fileCount:6,directoryCount:6});
    assert.equal(r.release.handlesClosed,12);assert.equal(r.producerPhase,'held');
    assert.deepEqual(r.events.find(e=>e[0]==='creator-at-first-stage'),['creator-at-first-stage',13,13]);
    assert.equal(r.handles.length,25);for(const h of r.handles){assert.equal(h.closeAttempts,1);assert.equal(h.live,false);}
    assert.ok(r.helpers.length>13);assert.ok(r.helpers.every(h=>h.settled));
    const [s]=r.snapshots;assert.equal(s.rootMode,0o711);assert.equal(s.sourceMode,0o555);assert.equal(s.vendorMode,0o555);
    assert.equal(s.files.length,6);assert.ok(s.files.every(f=>f.exact));
    assert.deepEqual(s.files.map(f=>[f.path,f.mode]).sort(),[
      ...NAMES.map((n,i)=>['source/'+n,i===3?0o444:0o400]),['vendor/'+FILENAME,0o400],['vendor/node',0o555]].sort());
  });
  for(const mode of ['arity','source-blob-invalid','transport-http-invalid','manifest-invalid','archive-invalid',
    'member-missing','member-duplicate','native-invalid','vendor-open-false','vendor-open-throw','vendor-partial-write',
    'vendor-close-false','vendor-close-throw','staged-open-throw','vendor-readback-drift',
    'vendor-seal-false','vendor-seal-throw','root-seal-false','root-seal-throw','source-disk-drift'])test('owned producer refuses '+mode,()=>{
      const r=invoke(mode);assert.equal(r.ok,false);assert.match(r.error,/TASK6A_ORIGIN_(?:BOOTSTRAP|ARCHIVE|NATIVE)_REFUSED/);
      assert.equal(r.producerPhase,'burned');assert.equal(r.result,null);assert.equal(r.callbacks,0);
      for(const h of r.handles){assert.equal(h.closeAttempts,1);assert.equal(h.live,mode==='vendor-close-false'&&h.id===r.faultID);}
      if(mode.startsWith('vendor-')||mode.startsWith('root-seal-')||mode==='staged-open-throw'||mode==='source-disk-drift') {
        assert.equal(r.armed,1);assert.equal(r.transport,13);assert.equal(r.evals,3);
        assert.equal(r.decoderUses,1);assert.equal(r.nativeUses,1);
      }
      if(mode.startsWith('vendor-open-')) {
        assert.equal(r.writes,4);assert.equal(r.handles.length,12);assert.equal(r.faultID,12);
        const f=r.snapshots[0].files.find(f=>f.path==='vendor/'+FILENAME);assert.equal(f.size,0);assert.equal(f.mode,0o600);
      }
      if(['vendor-close-false','vendor-close-throw','vendor-partial-write','vendor-readback-drift'].includes(mode)) {
        assert.equal(r.writes,5);assert.equal(r.handles.length,12);assert.equal(r.faultID,12);
        const f=r.snapshots[0].files.find(f=>f.path==='vendor/'+FILENAME);
        if(mode==='vendor-partial-write'){assert.equal(f.size,r.fixtureArchiveLength-1);assert.ok(f.size>0);assert.equal(f.prefix,true);assert.equal(f.exact,false);assert.equal(f.mode,0o600);}
        else {assert.equal(f.exact,true);assert.equal(f.mode,mode==='vendor-readback-drift'?0o600:0o400);}
        if(mode.startsWith('vendor-close-'))assert.equal(r.creatorUncertain,1);
      }
      if(!['staged-open-throw','source-disk-drift'].includes(mode))assert.equal(r.handles.filter(h=>h.realm==='staged').length,0);
      if(mode==='arity')assert.equal(r.transport,0);
      if(mode==='source-blob-invalid')assert.equal(r.roots.length,0);
      if(mode==='staged-open-throw')assert.deepEqual(r.events.find(e=>e[0]==='creator-at-first-stage'),['creator-at-first-stage',13,13]);
      if(mode==='source-disk-drift') {
        const f=r.snapshots[0].files.find(f=>f.path==='source/task6a-origin-native-v2.pm');assert.equal(f.exact,false);
        const e=r.events.find(e=>e[0]==='disk-drift');assert.equal(e[1],e[2]);assert.equal(e[3],e[4]);
      }
    });
  for(const boundary of ['before-assignment','before-hold','after-hold','before-recheck','after-recheck','before-held'])
    for(const kind of ['deadline','helper','foreign','owner'])test(`owned handoff refuses ${kind} at ${boundary}`,()=>{
      const r=invoke(boundary+'-'+kind);assert.equal(r.ok,false);assert.equal(r.armed,1);assert.equal(r.producerPhase,'burned');
      assert.equal(r.handles.filter(h=>h.realm==='creator').length,13);
      for(const h of r.handles){assert.equal(h.closeAttempts,1);assert.equal(h.live,false);}
      if(boundary==='before-assignment')assert.equal(r.admissionDefined,false);
      else {assert.match(r.retryError,/TASK6A_ORIGIN_BOOTSTRAP_REFUSED/);assert.equal(r.retryDelta,0);}
    });
  for(const boundary of ['before-assignment','before-held'])test('owned handoff refuses modeled group mismatch at '+boundary,()=>{
    const r=invoke(boundary+'-group');assert.equal(r.ok,false);assert.equal(r.armed,1);assert.equal(r.producerPhase,'burned');
    assert.equal(r.handles.filter(h=>h.realm==='creator').length,13);
    assert.ok(r.handles.every(h=>h.closeAttempts===1&&!h.live));
    if(boundary==='before-assignment')assert.equal(r.admissionDefined,false);
    else {assert.match(r.retryError,/TASK6A_ORIGIN_BOOTSTRAP_REFUSED/);assert.equal(r.retryDelta,0);}
  });
  for(const ordinal of [0,5,10,11,12])for(const kind of ['deadline','helper','foreign'])
    test(`owned producer rechecks ${kind} after settled transport${ordinal}`,()=>{
      const r=invoke(`transport-${kind}-${ordinal}`);assert.equal(r.ok,false);assert.equal(r.armed,1);assert.equal(r.transport,ordinal+1);
      for(const h of r.handles){assert.equal(h.closeAttempts,1);assert.equal(h.live,false);}
      if(ordinal<=10)assert.equal(r.roots.length,0);
      assert.equal(r.jsonDecodes,Math.min(ordinal,11));
    });
  for(const mode of ['row-path','row-blob','row-hash','row-size','row-bytes','row-magic','row-tied'])test('owned source rows refuse '+mode,()=>{
    const r=invoke(mode);assert.equal(r.ok,false);assert.equal(r.armed,1);assert.equal(r.transport,11);
    assert.equal(r.callbacks,0);assert.equal(r.roots.length,0);assert.equal(r.handles.length,0);
  });
  for(const parser of ['decoder','native'])for(const kind of ['deadline','helper','foreign'])test(`owned parser rechecks ${kind} after ${parser}`,()=>{
    const r=invoke(parser+'-'+kind);assert.equal(r.ok,false);assert.equal(r.armed,1);assert.equal(r.transport,13);
    assert.equal(r.decoderUses,1);assert.equal(r.nativeUses,parser==='native'?1:0);assert.equal(r.writes,4);
    assert.equal(r.handles.length,10);assert.ok(r.handles.every(h=>h.closeAttempts===1&&!h.live));
  });
  test('producer refuses genuine prior creator without closing borrowed originals',()=>{
    const r=invoke('prior-creator');assert.equal(r.ok,false);assert.equal(r.transport,0);
    assert.equal(r.priorLive,5);assert.deepEqual(r.priorCloseCounts,[0,0,0,1,0,0]);
    assert.equal(r.priorError,'');assert.equal(r.handles.length,10);assert.equal(r.creatorPhase,'released');assert.equal(r.priorRelease.handlesClosed,10);
    assert.equal(r.writes,4);assert.ok(r.handles.every(h=>h.closeAttempts===1&&!h.live));
  });
  for(const mode of ['retained-row-overload','retained-row-tied','retained-value-magic','retained-snapshot-tied'])test('handoff rejects '+mode+' before any callback',()=>{
    const r=invoke(mode);assert.equal(r.ok,false);assert.equal(r.armed,1);assert.equal(r.callbacks,0);
    assert.equal(r.handles.length,13);assert.ok(r.handles.every(h=>h.closeAttempts===1&&!h.live));
    assert.equal(r.admissionDefined,true);assert.match(r.retryError,/TASK6A_ORIGIN_BOOTSTRAP_REFUSED/);assert.equal(r.retryDelta,0);
  });
  for(const mode of ['entry-readback-drift','entry-commitment-drift'])test('producer validates genuine '+mode+' before vendor effects',()=>{
    const r=invoke(mode);assert.equal(r.ok,false);assert.equal(r.armed,1);assert.equal(r.evals,3);
    assert.equal(r.transport,11);assert.equal(r.writes,4);assert.equal(r.decoderUses,0);assert.equal(r.nativeUses,0);
    assert.equal(r.handles.length,10);assert.ok(r.handles.every(h=>h.closeAttempts===1&&!h.live));
  });
  test('post-capture epoch omission exposes actual JSON decode after foreign change',()=>{
    const r=invoke('transport-foreign-0',{mutant:s=>once(s,String.raw`],$seconds,4195328)};
    task6a_origin_refuse() if $@;
    $producer_transport_epoch->();`,String.raw`],$seconds,4195328)};
    task6a_origin_refuse() if $@;`)});
    assert.equal(r.ok,false);assert.equal(r.armed,1);assert.equal(r.transport,1);assert.equal(r.jsonDecodes,1);
    assert.equal(r.handles.length,0);
  });
  test('last handoff guard omission publishes held custody after owner mismatch in memory only',()=>{
    const r=invoke('before-held-owner',{mutant:s=>once(s,String.raw`# Producer boundary: before-held.
        $producer_handoff_guard->(1,'active');$producer_phase='held';1;`,String.raw`# Producer boundary: before-held.
        $producer_phase='held';1;`)});
    assert.equal(r.ok,true);assert.equal(r.armed,1);assert.equal(r.producerPhase,'held');assert.equal(r.handles.length,25);
    assert.ok(r.handles.every(h=>h.closeAttempts===1&&!h.live));
  });
  test('retained row guard omission reaches the actual overloaded original comparison',()=>{
    const r=invoke('retained-row-overload',{mutant:s=>once(s,String.raw`$staged_container->(\($retained_refs->[$index]),$kind);`,'# TEST omitted retained original native guard')});
    assert.equal(r.ok,false);assert.equal(r.armed,1);assert.equal(r.callbacks,1);assert.equal(r.handles.length,13);
    assert.ok(r.handles.every(h=>h.closeAttempts===1&&!h.live));
  });
  test('retained scalar guard omission reaches the actual original FETCH',()=>{
    const r=invoke('retained-value-magic',{mutant:s=>once(s,String.raw`$staged_scalar->(\($retained_values->[$index]));`,'# TEST omitted retained value native guard')});
    assert.equal(r.ok,false);assert.equal(r.armed,1);assert.equal(r.callbacks,1);assert.equal(r.handles.length,13);
  });
  test('private entry commitment omission accepts the actual changed commitment in memory only',()=>{
    const r=invoke('entry-commitment-drift',{mutant:s=>once(s,'Digest::SHA::sha256_hex($bytes) eq $commitment\n                &&Digest::SHA::sha1_hex', 'Digest::SHA::sha1_hex')});
    assert.equal(r.ok,true);assert.equal(r.armed,1);assert.equal(r.transport,13);assert.equal(r.handles.length,25);
    assert.ok(r.handles.every(h=>h.closeAttempts===1&&!h.live));
  });
  test('independent original oracle exposes omitted vendor directory enrollment',()=>{
    const r=invoke('healthy',{mutant:s=>once(s,'push @creator_originals,$sealed;',String.raw`push @creator_originals,$sealed unless $producer_phase eq 'writing'&&Fcntl::S_ISDIR((CORE::stat($fh))[2]);`)});
    assert.equal(r.ok,false);assert.equal(r.handles.length,13);const missing=r.handles.find(h=>h.realm==='creator'&&h.path.endsWith('/vendor'));
    assert.equal(missing.closeAttempts,0);assert.equal(missing.live,true);
    assert.ok(r.handles.filter(h=>h!==missing).every(h=>h.closeAttempts===1&&!h.live));
  });
  test('owned producer rejects real ordinary owner without creating effects',()=>{
    const r=invoke('healthy',{modelOwner:false});assert.equal(r.ok,false);assert.equal(r.transport,0);assert.equal(r.roots.length,0);
  });
  test('owned producer cannot repeat after successful held custody',()=>{
    const r=invoke('reentry');assert.equal(r.ok,true);assert.match(r.repeatError,/TASK6A_ORIGIN_BOOTSTRAP_REFUSED/);
    assert.equal(r.repeatDelta,0);assert.equal(r.handles.length,25);assert.ok(r.handles.every(h=>h.closeAttempts===1&&!h.live));
  });
  test('unknown vendor output is retained without magic callbacks or guessed close',()=>{
    const r=invoke('vendor-open-unknown');assert.equal(r.ok,false);assert.equal(r.callbacks,0);assert.equal(r.creatorUncertain,1);
    const unknown=r.handles.find(h=>h.realm==='creator'&&h.path.includes('/vendor/'));
    assert.equal(unknown.closeAttempts,0);assert.equal(unknown.live,true);
    assert.ok(r.handles.filter(h=>h!==unknown).every(h=>h.closeAttempts===1&&!h.live));
  });
}
