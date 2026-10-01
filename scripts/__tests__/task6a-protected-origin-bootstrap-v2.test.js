import assert from 'node:assert/strict';
import {existsSync,readFileSync,mkdtempSync,unlinkSync,rmdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {spawn,spawnSync} from 'node:child_process';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import test from 'node:test';

const MEMBER='node-v22.23.1-darwin-arm64/bin/node';
const HELPER=new URL('../task6a-origin-archive-v2.pm',import.meta.url);
const NATIVE=new URL('../task6a-origin-native-v2.pm',import.meta.url);
const MAP=new URL('../task6a-origin-map-v2.pm',import.meta.url);
const MAP_FIXTURE=new URL('./fixtures/task6a-origin-vmmap-interleaved-v2.txt',import.meta.url);
const ENTRY=new URL('../task6a-protected-origin-entry-v2.mjs',import.meta.url);
const BOOTSTRAP=new URL('../task6a-protected-origin-bootstrap-v2.pl',import.meta.url);
const RECON=new URL('../task6a-origin-observer-recon-v2.mjs',import.meta.url);
const BODY=Buffer.from('literal selected bytes');
function ordinaryHost() {
  return process.platform==='darwin'&&typeof process.getuid==='function'&&typeof process.geteuid==='function'
    &&process.getuid()!==0&&process.geteuid()!==0&&process.getuid()===process.geteuid();
}
if(ordinaryHost()&&process.env.TASK6A_TEST_HOST_PROBE!=='1') {
  for(const [name,platform,ruid,euid] of [['non-macOS','linux',501,501],['root real UID','darwin',0,501],['root effective UID','darwin',501,0]])
    test(`default protected-bootstrap graph refuses ${name} before any external child`,()=>{
      const program=`import childProcess from 'node:child_process';import {syncBuiltinESMExports} from 'node:module';
        Object.defineProperty(process,'platform',{value:${JSON.stringify(platform)}});
        process.getuid=()=>${ruid};process.geteuid=()=>${euid};
        const denied=()=>{process.stdout.write('TEST_FORBIDDEN_SPAWN\\n');throw Error('unexpected external child');};
        childProcess.spawn=denied;childProcess.spawnSync=denied;syncBuiltinESMExports();
        await import(${JSON.stringify(import.meta.url)});`;
      const r=spawnSync(process.execPath,['--input-type=module','-e',program],{
        cwd:'/',env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C',TASK6A_TEST_HOST_PROBE:'1'},timeout:5000,maxBuffer:2097152,encoding:'utf8',
      });
      assert.equal(r.error,undefined);assert.equal(r.signal,null);
      assert.doesNotMatch(r.stdout,/TEST_FORBIDDEN_SPAWN/,'unsupported default graph attempted an external child');
      assert.equal(r.status,0,(r.stdout+r.stderr).slice(0,1000));assert.match(r.stdout,/(?:ℹ|#) skipped 1\b/);
    });
}
function octal(buffer,start,length,value) {
  buffer.write(value.toString(8).padStart(length-1,'0')+'\0',start,length,'ascii');
}
function header(name,size,{type='0',prefix='',link=''}={}) {
  const b=Buffer.alloc(512);b.write(name,0,100,'ascii');octal(b,100,8,0o755);
  octal(b,108,8,0);octal(b,116,8,0);octal(b,124,12,size);octal(b,136,12,0);
  b.fill(32,148,156);b.write(type,156,1,'ascii');b.write(link,157,100,'ascii');
  b.write('ustar\0',257,6,'ascii');b.write('00',263,2,'ascii');b.write(prefix,345,155,'ascii');
  const checksum=[...b].reduce((sum,x)=>sum+x,0);b.write(checksum.toString(8).padStart(6,'0')+'\0 ',148,8,'ascii');return b;
}
function item(name,body=BODY,options={}) {
  return Buffer.concat([header(name,body.length,options),body,Buffer.alloc((512-body.length%512)%512)]);
}
function archive(parts,{end=true,tail=Buffer.alloc(0)}={}) {
  return gzipSync(Buffer.concat([...parts,...(end?[Buffer.alloc(1024)]:[]),tail]));
}
function pax(key,value) {
  const suffix=` ${key}=${value}\n`;let length=suffix.length+1;
  while(String(length).length+suffix.length!==length)length=String(length).length+suffix.length;
  return Buffer.from(String(length)+suffix);
}
function invoke(input,{source,trackReads=false}={}) {
  assert.equal(process.platform,'darwin','no ambient Perl fallback on unsupported hosts');
  assert.notEqual(process.getuid(),0,'default tests must never run local Perl helpers as root');
  assert.ok(existsSync(HELPER),'archive implementation missing');
  // Test-only in-memory mutants never change files or add production knobs.
  const load=source===undefined?'require $ARGV[0];':'use MIME::Base64 (); eval MIME::Base64::decode_base64($ARGV[0]); die $@ if $@;';
  const observation=trackReads?'my @requests; my $depth=0; my $read=IO::Uncompress::Gunzip->can("read"); no warnings qw(redefine once); local *IO::Uncompress::Gunzip::read=sub { push @requests,defined($_[2])?$_[2]:"undefined" if ++$depth==1; my $n=$read->(@_); --$depth; return $n; }; my $out=eval { Task6aOriginArchiveV2::extract_node_v2($raw) }; my $err=$@; warn "TEST_READ_REQUESTS=".join(",",@requests)."\\n"; die $err if $err; print $out;':'my $out=Task6aOriginArchiveV2::extract_node_v2($raw); print $out or die "test output failed\\n";';
  const program='BEGIN { @INC=("/System/Library/Perl/5.34/darwin-thread-multi-2level","/System/Library/Perl/5.34"); } use strict; use warnings; '+load+' binmode STDIN; binmode STDOUT; local $/; my $raw=<STDIN>; '+observation;
  const r=spawnSync('/usr/bin/perl',['-f','-e',program,source===undefined?fileURLToPath(HELPER):Buffer.from(source).toString('base64')],{
    input,cwd:'/',env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'},timeout:5000,maxBuffer:1048576,
  });
  assert.equal(r.error,undefined);assert.equal(r.signal,null);return r;
}
function refuses(input,options) {
  const r=invoke(input,options);assert.notEqual(r.status,0,'unsafe archive unexpectedly accepted');
  assert.match(r.stderr.toString(),/TASK6A_ORIGIN_ARCHIVE_REFUSED/);assert.equal(r.stdout.length,0);
  return r;
}
function replaceOnce(source,from,to) {
  assert.equal(source.split(from).length,2,'test mutant must affect exactly one branch');
  return source.replace(from,to);
}
function command(kind,name,{offset=kind===0xe?12:24}={}) {
  const size=Math.ceil((offset+Buffer.byteLength(name)+1)/8)*8;
  const b=Buffer.alloc(size);b.writeUInt32LE(kind,0);b.writeUInt32LE(size,4);
  b.writeUInt32LE(offset,8);b.write(name,offset,'ascii');return b;
}
function macho(commands=[command(0xe,'/usr/lib/dyld'),command(0xc,'/usr/lib/libSystem.B.dylib')]) {
  const table=Buffer.concat(commands),h=Buffer.alloc(32);
  [0xfeedfacf,0x0100000c,0,2,commands.length,table.length,0x200000,0].forEach((x,i)=>h.writeUInt32LE(x,i*4));
  return Buffer.concat([h,table]);
}
function fixedCommand(kind,size) {
  const b=Buffer.alloc(size);b.writeUInt32LE(kind);b.writeUInt32LE(size,4);return b;
}
function native(bytes) {
  assert.ok(existsSync(NATIVE),'native implementation missing');
  const program='BEGIN { @INC=("/System/Library/Perl/5.34/darwin-thread-multi-2level","/System/Library/Perl/5.34"); } use strict; use warnings; use JSON::PP (); require $ARGV[0]; binmode STDIN; local $/; my $raw=<STDIN>; my $out=Task6aOriginNativeV2::assert_node_native_v2($raw); print JSON::PP->new->canonical->encode($out);';
  const r=spawnSync('/usr/bin/perl',['-f','-e',program,fileURLToPath(NATIVE)],{input:bytes,cwd:'/',env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'},timeout:5000,maxBuffer:65536});
  assert.equal(r.error,undefined);assert.equal(r.signal,null);return r;
}
function nativeRefuses(bytes) {
  const r=native(bytes);assert.notEqual(r.status,0,'unsafe native policy unexpectedly accepted');
  assert.match(r.stderr.toString(),/TASK6A_ORIGIN_NATIVE_REFUSED/);assert.equal(r.stdout.length,0);
}
function parseMap(raw,pid=77777,{sourceOverride}={}) {
  assert.ok(ordinaryHost(),'map tests require ordinary macOS UID');
  assert.ok(existsSync(MAP),'complete map implementation missing');
  const load=sourceOverride===undefined?'require $ARGV[0];':'use MIME::Base64 (); eval MIME::Base64::decode_base64($ARGV[0]); die $@ if $@;';
  const program='BEGIN { @INC=("/System/Library/Perl/5.34/darwin-thread-multi-2level","/System/Library/Perl/5.34"); } use strict; use warnings; use JSON::PP (); '+load+' binmode STDIN; local $/; my $raw=<STDIN>; print JSON::PP->new->canonical->encode(Task6aOriginMapV2::parse_map_v2($raw,0+$ARGV[1]));';
  const r=spawnSync('/usr/bin/perl',['-f','-e',program,sourceOverride===undefined?fileURLToPath(MAP):Buffer.from(sourceOverride).toString('base64'),String(pid)],{
    input:raw,cwd:'/',env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'},timeout:3000,maxBuffer:4194304,
  });
  assert.equal(r.error,undefined);assert.equal(r.signal,null);return r;
}
function mapRefuses(raw,pid) {
  const r=parseMap(raw,pid);assert.notEqual(r.status,0,'incomplete or malformed map accepted');
  assert.equal(r.stdout.length,0);assert.equal(r.stderr.toString(),'TASK6A_ORIGIN_MAP_REFUSED\n');
}
async function entrySession(t,{args=[],options={}}={}) {
  assert.ok(existsSync(ENTRY),'private entry implementation missing');
  // Ordinary local Node proves ONLY protocol behavior, never vendor/origin.
  const child=spawn(process.execPath,[fileURLToPath(ENTRY),...args],{
    cwd:'/',env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C',...options},stdio:['pipe','pipe','pipe'],
  });
  const state={out:'',err:''};
  child.stdout.on('data',b=>{state.out+=b.toString('latin1');});
  child.stderr.on('data',b=>{state.err+=b.toString('latin1');});
  child.stdin.on('error',()=>{});
  const closed=new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>resolve({code,signal,...state}));});
  t.after(async()=>{
    if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');
    await closed;
  });
  async function output(want) {
    if(state.out===want)return;
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>done(new Error('private protocol output deadline')),3000);
      function done(err) {clearTimeout(timer);child.stdout.off('data',check);child.off('close',ended);err?reject(err):resolve();}
      function check() {if(state.out===want)done();else if(!want.startsWith(state.out))done(new Error('unexpected private protocol output'));}
      function ended() {done(new Error('private entry closed before expected output'));}
      child.stdout.on('data',check);child.once('close',ended);check();
    });
  }
  return {child,closed,output,state};
}
const NONCES=['1'.repeat(64),'2'.repeat(64),'3'.repeat(64)];
function exchange(nonces=NONCES) {return nonces.map(n=>`CHALLENGE ${n}\n`).join('');}
function systemObject(kind,record,expected,{sourceOverride}={}) {
  assert.ok(ordinaryHost(),'mutable test declarations require an ordinary macOS real/effective UID');
  assert.ok(existsSync(BOOTSTRAP),'system supervisor implementation missing');
  // Load only declarations in the ordinary test process. No production test
  // options/entry points: remove the sole final main call in memory, not on disk.
  let source=replaceOnce(sourceOverride??readFileSync(BOOTSTRAP,'utf8'),'\ntask6a_origin_main();\n','\n');
  if(kind==='composed-physical'&&record.mode.startsWith('ledger-')) {
    source=replaceOnce(source,'sub task6a_origin_record {',String.raw`
sub test_contaminate_physical_ledger {
    my ($replace)=@_;
    if($replace) {
        sysopen(my $other,'/usr/bin/perl',Fcntl::O_RDONLY()) or die "test replacement open failed\n";
        {no warnings 'once';$main::test_replacement_fh=$other;}
        $file_ledger[0]={%{$file_ledger[0]},fh=>$other};
    } else {shift @file_ledger;}
}
sub task6a_origin_record {`);
  }
  if(kind==='composed-physical'&&record.mode==='unknown-helper') {
    source=replaceOnce(source,'$pid=fork();',"$pid=fork(); {no warnings 'once'; $main::capture_test_pid=$pid if defined($pid)&&$pid>0;}");
    source=replaceOnce(source,"'/usr/bin/curl'=>1,","'/usr/bin/perl'=>1,'/usr/bin/curl'=>1,");
  }
  const program=String.raw`
    BEGIN { @INC=("/System/Library/Perl/5.34/darwin-thread-multi-2level","/System/Library/Perl/5.34"); }
    use strict; use warnings; use MIME::Base64 (); use JSON::PP ();
    binmode STDIN; local $/; my $q=JSON::PP->new->utf8->decode(<STDIN>); my $out;
    if($q->{kind} eq 'fd-proof'&&$q->{record}{readdirFailure}) {
      eval q{BEGIN { *CORE::GLOBAL::readdir=sub (*) {
        my $v=CORE::readdir($_[0]);if(defined($v)&&$v eq '200') {$!=5;return undef;}return $v;
      }; }};die $@ if $@;
    }
    if($q->{kind} eq 'poll-error') {
      eval q{BEGIN { *CORE::GLOBAL::waitpid=sub ($$) {$!=5;return undef;}; }};die $@ if $@;
    }
    if($q->{kind} eq 'held-file'||$q->{kind} eq 'ancestry'||$q->{kind} eq 'held-lifecycle'||$q->{kind} eq 'composed-physical') {
      {no warnings 'once';$main::test_fifo_path=$q->{record}{path} if $q->{record}{fifoRace};}
      eval q{BEGIN { *CORE::GLOBAL::lstat=sub (_) {
        if(defined($main::test_fifo_path)&&$_[0] eq $main::test_fifo_path) {return CORE::lstat('/usr/bin/perl');}
        my @value=CORE::lstat($_[0]);
        $value[1]+=1 if $main::test_composed_ancestry_drift&&$_[0] eq '/usr/bin';
        if($main::test_file_drift) {$value[$main::test_file_drift_index]+=1;}
        return @value;
      }; }};die $@ if $@;
    }
    if($q->{kind} eq 'composed-physical'&&$q->{record}{mode} eq 'partial-capture') {
      eval q{BEGIN { *CORE::GLOBAL::sysseek=sub (*$$) {
        no warnings 'once';
        if($main::test_composed_seek_fault) {
          my @actual=CORE::stat($_[0]);my @expected=CORE::stat('/usr/bin/perl');
          if(@actual&&$actual[0]==$expected[0]&&$actual[1]==$expected[1]) {
            my %before=map {$_=>1} @main::test_composed_before;
            @main::test_composed_owned=grep {!$before{$_}} @{main::task6a_origin_fds()};
            $!=5;return undef;
          }
        }
        return CORE::sysseek($_[0],$_[1],$_[2]);
      }; }};die $@ if $@;
    }
    if($q->{kind} eq 'held-lifecycle'||$q->{kind} eq 'composed-physical') {
      eval q{BEGIN { *CORE::GLOBAL::close=sub (*) {
        no warnings 'once';
        my $fd=fileno($_[0]);
        push @main::test_composed_close_attempts,$fd
          if defined($fd)&&grep {$_==$fd} @main::test_composed_owned;
        my $result=CORE::close($_[0]);
        if($main::test_file_close_fault&&(!$main::test_composed_close_only
          ||grep {$_==$fd} @main::test_composed_owned)) {
          $main::test_file_close_fault=0;
          die "test close uncertainty\n" if $main::test_file_close_throw;
          return 0;
        }
        return $result;
      }; }};die $@ if $@;
    }
    if(($q->{kind} eq 'metadata'||$q->{kind} eq 'source-wire'||$q->{kind} eq 'vendor')&&$q->{record}{clock}) {
      require Time::HiRes;my @clock=@{$q->{record}{clock}};no warnings qw(redefine once);
      *Time::HiRes::clock_gettime=sub (;$) {die "test clock exhausted" unless @clock;return shift @clock;};
    }
    eval MIME::Base64::decode_base64($ARGV[0]); die $@ if $@;
    if($q->{kind} eq "commit") { $out=task6a_origin_verify_merge($q->{record},$q->{expected}); }
    elsif($q->{kind} eq "tree") { $out=task6a_origin_verify_tree($q->{record},$q->{expected}); }
    elsif($q->{kind} eq "blob") {
      $out=task6a_origin_verify_blob($q->{record},$q->{expected}); delete $out->{bytes};
    } elsif($q->{kind} eq "source") {
      my @queue=@{$q->{record}}; my @routes; no warnings qw(redefine once);
      local *main::task6a_origin_get_metadata=sub {
        my ($route)=@_; my $item=shift @queue;
        task6a_origin_refuse() unless $item && $item->{route} eq $route;
        push @routes,$route; return $item->{data};
      };
      $out=task6a_origin_observe_sources(); task6a_origin_refuse() if @queue;
      delete $_->{bytes} for @{$out->{sources}}; $out->{testRoutes}=\@routes;
    } elsif($q->{kind} eq 'metadata'||$q->{kind} eq 'source-wire'||$q->{kind} eq 'vendor') {
      my $r=$q->{record};my @queue=@{$r->{responses}};my $calls=0;no warnings qw(redefine once);
      local *main::task6a_origin_capture=sub {
        my ($tool,$args,$seconds,$limit)=@_;my $response=shift @queue;
        unless($response) {syswrite(STDOUT,"TEST_UNEXPECTED_CAPTURE\n");die "unexpected external capture";}
        my $vendor=$q->{kind} eq 'vendor';
        my $url=($vendor?'https://nodejs.org/dist/v22.23.1':'https://api.github.com/repos/hikmetgulsesli/setfarm').$response->{route};
        my $want=['-q','--silent','--show-error','--proto','=https','--tlsv1.2',
          '--cacert','/private/etc/ssl/cert.pem','--proxy','','--noproxy','*','--max-redirs','0',
          '--connect-timeout','5','--max-time',''.($response->{seconds}//10),
          ($vendor?():('-H','Accept: application/vnd.github+json','-H','X-GitHub-Api-Version: 2022-11-28')),
          '--write-out',"\n%{http_code}\n%{content_type}\n%{url_effective}",$url];
        die "unsafe external capture selection" unless $tool eq '/usr/bin/curl'
          &&JSON::PP->new->canonical->encode($args) eq JSON::PP->new->canonical->encode($want)
          &&$seconds==($response->{seconds}//10)&&$limit==($response->{limit}//4195328);
        ++$calls;die "synthetic external capture failure" if $response->{failure};
        my $bytes=MIME::Base64::decode_base64($response->{bytes});
        return {out=>$bytes,err=>$response->{err}//'',status=>$response->{status}//0,
          pid=>999,reaped=>exists($response->{reaped})?$response->{reaped}:JSON::PP::true};
      };
      $out=$q->{kind} eq 'metadata'?task6a_origin_get_metadata($r->{route}):
        $q->{kind} eq 'vendor'?task6a_origin_get_vendor():task6a_origin_observe_sources();
      die "unconsumed external captures" if @queue;
      if($q->{kind} eq 'source-wire') {delete $_->{bytes} for @{$out->{sources}};}
      if($q->{kind} eq 'vendor') {
        $out->{testArchiveBase64}=MIME::Base64::encode_base64($out->{archiveBytes},'');delete $out->{archiveBytes};
      }
    } elsif($q->{kind} eq "capture") {
      my $r=$q->{record};
      if($r->{closeFailure}) {
        no warnings qw(redefine once);local *POSIX::close=sub {return undef;};
        $out=task6a_origin_capture($r->{tool},$r->{args},$r->{seconds},$r->{limit});
      } elsif($r->{dupUncertainty}) {
        no warnings qw(redefine once);my $original=POSIX->can('dup2');
        local *POSIX::dup2=sub {my $value=$original->(@_);return $_[1]==0?undef:$value;};
        $out=task6a_origin_capture($r->{tool},$r->{args},$r->{seconds},$r->{limit});
      } else {$out=task6a_origin_capture($r->{tool},$r->{args},$r->{seconds},$r->{limit});}
    } elsif($q->{kind} eq "fd-proof") {
      die "test descriptor already present" if -e '/dev/fd/200';
      pipe(my $r,my $w) or die "test pipe";
      my $fd=POSIX::dup2(fileno($w),200);die "test dup" unless defined($fd)&&$fd==200;
      my $probe=q{BEGIN { @INC=("/System/Library/Perl/5.34/darwin-thread-multi-2level","/System/Library/Perl/5.34"); } use POSIX (); my $closed=POSIX::close(200); print(!defined($closed)&&$!{EBADF}?"CLOSED":"OPEN");};
      $out=eval {task6a_origin_capture('/usr/bin/perl',['-f','-e',$probe],2,65536)};my $error=$@;
      my $still_owned=-e '/dev/fd/200';my $closed=POSIX::close(200);close($r);close($w);
      die "test owner close failed" unless defined($closed)&&$closed==0;die $error if $error;
      $out->{testParentStillOwnsFD}=$still_owned?JSON::PP::true:JSON::PP::false;
    } elsif($q->{kind} eq "timeout-proof") {
      no warnings 'once';
      my $probe=q{BEGIN { @INC=("/System/Library/Perl/5.34/darwin-thread-multi-2level","/System/Library/Perl/5.34"); } select undef,undef,undef,10; print "late";};
      my $got=eval {task6a_origin_capture('/usr/bin/perl',['-f','-e',$probe],0.05,65536)};
      my $error=$@;my $pid=$main::capture_test_pid;die "missing actual fork PID" unless defined($pid)&&$pid>1;
      my $reaped=waitpid($pid,POSIX::WNOHANG());my $echild=$!{ECHILD};
      $out={refused=>(!defined($got)&&$error eq "TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n")?JSON::PP::true:JSON::PP::false,
        definitelyReaped=>($reaped==-1&&$echild)?JSON::PP::true:JSON::PP::false,pid=>$pid};
    } elsif($q->{kind} eq "lifecycle") {
      no warnings qw(redefine once);
      die "supervisor settlement implementation missing\n" unless defined &task6a_origin_helpers_settled;
      my $r=$q->{record};my ($got,$error);
      if($r->{lostClock}) {
        my $original=Time::HiRes->can('clock_gettime');
        local *Time::HiRes::clock_gettime=sub {die "test clock loss\n" if defined($main::capture_test_pid);return $original->(@_);};
        my $probe=q{BEGIN { @INC=("/System/Library/Perl/5.34/darwin-thread-multi-2level","/System/Library/Perl/5.34"); } select undef,undef,undef,0.15;};
        $got=eval {task6a_origin_capture('/usr/bin/perl',['-f','-e',$probe],2,65536)};$error=$@;
      } else {
        $got=eval {task6a_origin_capture('/usr/bin/curl',['-q',$r->{fail}?'--invalid-setfarm-test-option':'--version'],2,65536)};$error=$@;
      }
      my $first=task6a_origin_helpers_settled();
      if($r->{lostClock}) {
        my $pid=$main::capture_test_pid;die "test fork PID missing" unless defined($pid)&&$pid>1;
        my $reaped=waitpid($pid,0);die "independent test reap failed" unless $reaped==$pid;
      }
      my $after=task6a_origin_helpers_settled();
      my $forged=eval {task6a_origin_helpers_settled({receipt=>JSON::PP::true})};my $forged_error=$@;
      $out={settled=>$first,afterIndependentReap=>$after,
        refused=>(!defined($got)&&$error eq "TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n")?JSON::PP::true:JSON::PP::false,
        forgedRefused=>(!defined($forged)&&$forged_error eq "TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n")?JSON::PP::true:JSON::PP::false};
    } elsif($q->{kind} eq 'composed-physical') {
      die "composed physical implementation missing\n"
        unless defined &task6a_origin_hold_system_perl_physical
          &&defined &task6a_origin_recheck_system_perl_physical
          &&defined &task6a_origin_release_system_perl_physical;
      my $r=$q->{record};no warnings qw(redefine once);
      $main::test_composed_close_only=1;
      my %before=map {$_=>1} @{task6a_origin_fds()};
      @main::test_composed_before=keys %before;
      my $refused=sub {my ($call)=@_;my $got=eval {$call->();1;};
        die $@ if !$got&&$@ ne "TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n";
        return $got?JSON::PP::false:JSON::PP::true;};
      my ($first,$restored)=(JSON::PP::false,JSON::PP::false);my $diagnostic;
      my $leaf_fault=0;my $leaf_samples=0;my $real_capture=\&task6a_origin_capture;
      local *main::task6a_origin_capture=sub {
        my ($tool,$args,$seconds,$limit)=@_;my $result=$real_capture->(@_);
        if($tool eq '/bin/ls'&&JSON::PP->new->encode($args) eq '["-lde","/usr/bin/perl"]') {
          die "incorrect leaf ACL external contract\n" unless $seconds==2&&$limit==4096;
          ++$leaf_samples;
          if($r->{mode} eq 'post-ancestry'&&$leaf_samples==2) {
            @main::test_composed_owned=grep {!$before{$_}} @{task6a_origin_fds()};
            $main::test_composed_ancestry_drift=1;
          }
          if($leaf_fault) {
            if($r->{mode} eq 'acl-row') {$result->{out}.=" 0: user:someone allow write\n";}
            elsif($r->{mode} eq 'acl-marker') {$result->{out}=~s/\A(-[rwxStTs-]{9})\@? /$1+ /;}
            elsif($r->{mode} eq 'acl-stderr') {$result->{err}='test warning';}
            elsif($r->{mode} eq 'acl-nonzero') {$result->{status}=1;}
            elsif($r->{mode} eq 'acl-unknown-reap') {$result->{reaped}=JSON::PP::false;}
            else {die "unknown leaf fault\n";}
          }
        }
        return $result;
      };
      my $prior_alive=0;my $unknown_stays_burned=0;
      if($r->{mode} eq 'prior-contamination') {
        task6a_origin_hold_file('/usr/bin/perl','abda2bfd23a6c9a8e57adf2291f0aea4abd8faf440558ee49fe4ced55e8d9ad0',0755,1048576);
        @main::test_composed_owned=grep {!$before{$_}} @{task6a_origin_fds()};
        $first=$refused->(sub {task6a_origin_hold_system_perl_physical();});
        $restored=$refused->(sub {task6a_origin_hold_system_perl_physical();});
      } elsif($r->{mode} eq 'partial-capture'||$r->{mode} eq 'post-ancestry') {
        $main::test_composed_seek_fault=1 if $r->{mode} eq 'partial-capture';
        $first=$refused->(sub {task6a_origin_hold_system_perl_physical();});
        $main::test_composed_seek_fault=0;$main::test_composed_ancestry_drift=0;
        $restored=$refused->(sub {task6a_origin_hold_system_perl_physical();});
      } elsif($r->{mode} eq 'before-start'||$r->{mode} eq 'hold-arity') {
        $first=$refused->(sub {$r->{mode} eq 'before-start'
          ?task6a_origin_recheck_system_perl_physical()
          :task6a_origin_hold_system_perl_physical({receipt=>JSON::PP::true});});
        $restored=$refused->(sub {task6a_origin_hold_system_perl_physical();});
      } else {
        $diagnostic=task6a_origin_hold_system_perl_physical();
        @main::test_composed_owned=grep {!$before{$_}} @{task6a_origin_fds()};
        task6a_origin_recheck_system_perl_physical();
        if($r->{mode} eq 'unknown-helper') {
          # Discard earlier, definitely reaped ACL child breadcrumbs. Lose the
          # actual clock only after this new helper's real fork, not a receipt.
          undef $main::capture_test_pid;
          my $clock=Time::HiRes->can('clock_gettime');
          {
            local *Time::HiRes::clock_gettime=sub {die "test clock loss\n" if defined($main::capture_test_pid);return $clock->(@_);};
            my $probe=q{BEGIN { @INC=("/System/Library/Perl/5.34/darwin-thread-multi-2level","/System/Library/Perl/5.34"); } select undef,undef,undef,0.15;};
            $first=$refused->(sub {task6a_origin_capture('/usr/bin/perl',['-f','-e',$probe],2,65536);});
          }
          my $pid=$main::capture_test_pid;die "test fork PID missing\n" unless defined($pid)&&$pid>1;
          die "independent test reap failed\n" unless waitpid($pid,0)==$pid;
          $unknown_stays_burned=!task6a_origin_helpers_settled();
          $restored=$refused->(sub {task6a_origin_recheck_system_perl_physical();});
        } elsif($r->{mode} eq 'deadline') {
          my $clock=Time::HiRes->can('clock_gettime');
          {
            local *Time::HiRes::clock_gettime=sub {return $clock->(@_)+181;};
            $first=$refused->(sub {task6a_origin_recheck_system_perl_physical();});
          }
          $restored=$refused->(sub {task6a_origin_recheck_system_perl_physical();});
        } elsif($r->{mode} eq 'recheck-arity') {
          $first=$refused->(sub {task6a_origin_recheck_system_perl_physical({receipt=>JSON::PP::true});});
          $restored=$refused->(sub {task6a_origin_recheck_system_perl_physical();});
        } elsif($r->{mode}=~/\Aacl-/) {
          $leaf_fault=1;$first=$refused->(sub {task6a_origin_recheck_system_perl_physical();});
          $leaf_fault=0;$restored=$refused->(sub {task6a_origin_recheck_system_perl_physical();});
        } elsif($r->{mode} eq 'helper-nonzero') {
          $first=$refused->(sub {task6a_origin_capture('/usr/bin/curl',['-q','--invalid-setfarm-test-option'],2,65536);});
          $restored=$refused->(sub {task6a_origin_recheck_system_perl_physical();});
        } elsif($r->{mode}=~/\Aledger-/) {
          test_contaminate_physical_ledger($r->{mode} eq 'ledger-replace');
          $first=$refused->(sub {task6a_origin_recheck_system_perl_physical();});
          $restored=$refused->(sub {task6a_origin_recheck_system_perl_physical();});
        } elsif($r->{mode} eq 'duplicate'||$r->{mode} eq 'raw-append') {
          $first=$refused->(sub {$r->{mode} eq 'duplicate'
            ?task6a_origin_hold_system_perl_physical()
            :task6a_origin_hold_file('/usr/bin/perl','abda2bfd23a6c9a8e57adf2291f0aea4abd8faf440558ee49fe4ced55e8d9ad0',0755,1048576);});
          $restored=$refused->(sub {task6a_origin_recheck_system_perl_physical();});
        }
      }
      $main::test_file_close_fault=1 if $r->{mode} eq 'close-failure'||$r->{mode} eq 'close-throw';
      $main::test_file_close_throw=1 if $r->{mode} eq 'close-throw';
      my $close_refused=$refused->(sub {$r->{mode} eq 'release-arity'
        ?task6a_origin_release_system_perl_physical({receipt=>JSON::PP::true})
        :task6a_origin_release_system_perl_physical();});
      if($r->{mode} eq 'prior-contamination') {
        my %still=map {$_=>1} @{task6a_origin_fds()};
        $prior_alive=@main::test_composed_owned==1&&$still{$main::test_composed_owned[0]}
          &&@main::test_composed_close_attempts==0;
        task6a_origin_close_files();
      }
      my %after=map {$_=>1} @{task6a_origin_fds()};
      my @leaked=grep {$after{$_}} @main::test_composed_owned;
      my %attempts; ++$attempts{$_} for @main::test_composed_close_attempts;
      my $replacement_alive=defined($main::test_replacement_fh)&&defined(fileno($main::test_replacement_fh));
      CORE::close($main::test_replacement_fh) or die "test replacement cleanup failed\n" if $replacement_alive;
      $out={%{$diagnostic||{}},replacementAlive=>$replacement_alive?JSON::PP::true:JSON::PP::false,
        priorAlive=>$prior_alive?JSON::PP::true:JSON::PP::false,
        unknownStaysBurned=>$unknown_stays_burned?JSON::PP::true:JSON::PP::false,
        ownedCount=>scalar(@main::test_composed_owned),leakedCount=>scalar(@leaked),
        exactCloseOnce=>(scalar(keys %attempts)==scalar(@main::test_composed_owned)
          &&!grep {($attempts{$_}//0)!=1} @main::test_composed_owned)?JSON::PP::true:JSON::PP::false,
        leafSamples=>$leaf_samples,firstRefused=>$first,restoredRefused=>$restored,closeRefused=>$close_refused,
        releasedRefused=>$refused->(sub {task6a_origin_recheck_system_perl_physical();}),
        reopenRefused=>$refused->(sub {task6a_origin_hold_system_perl_physical();}),
        repeatCloseRefused=>$refused->(sub {task6a_origin_release_system_perl_physical();})};
    } elsif($q->{kind} eq 'held-lifecycle') {
      my $r=$q->{record};no warnings 'once';my %before=map {$_=>1} @{task6a_origin_fds()};
      task6a_origin_hold_file('/usr/bin/perl','abda2bfd23a6c9a8e57adf2291f0aea4abd8faf440558ee49fe4ced55e8d9ad0',0755,1048576);
      task6a_origin_hold_ancestry('/usr/bin/perl');
      my @owned=grep {!$before{$_}} @{task6a_origin_fds()};
      my $refused=sub {my ($call)=@_;my $got=eval {$call->();1;};return !$got&&$@ eq "TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n"?JSON::PP::true:JSON::PP::false;};
      my ($first,$restored)=(JSON::PP::false,JSON::PP::false);
      if($r->{mode} eq 'drift-restore') {
        $main::test_file_drift_index=1;$main::test_file_drift=1;
        $first=$refused->(sub {task6a_origin_recheck_files();});$main::test_file_drift=0;
        $restored=$refused->(sub {task6a_origin_recheck_files();});
      } elsif($r->{mode} eq 'failed-hold-restore') {
        $first=$refused->(sub {task6a_origin_hold_file('/usr/bin/perl','0'x64,0755,1048576);});
        $restored=$refused->(sub {task6a_origin_hold_file('/usr/bin/perl','abda2bfd23a6c9a8e57adf2291f0aea4abd8faf440558ee49fe4ced55e8d9ad0',0755,1048576);});
        @owned=grep {!$before{$_}} @{task6a_origin_fds()};
      }
      $main::test_file_close_fault=1 if $r->{mode} eq 'close-failure'||$r->{mode} eq 'close-throw';
      $main::test_file_close_throw=1 if $r->{mode} eq 'close-throw';
      my $close_refused=$refused->(sub {task6a_origin_close_files();});
      my %after=map {$_=>1} @{task6a_origin_fds()};my @leaked=grep {$after{$_}} @owned;
      $out={ownedCount=>scalar(@owned),leakedCount=>scalar(@leaked),firstRefused=>$first,restoredRefused=>$restored,
        closeRefused=>$close_refused,releasedRefused=>$refused->(sub {task6a_origin_recheck_files();}),
        reopenRefused=>$refused->(sub {task6a_origin_hold_file('/usr/bin/perl','abda2bfd23a6c9a8e57adf2291f0aea4abd8faf440558ee49fe4ced55e8d9ad0',0755,1048576);}),
        repeatCloseRefused=>$refused->(sub {task6a_origin_close_files();})};
    } elsif($q->{kind} eq 'ancestry') {
      die "retained ancestry implementation missing\n" unless defined &task6a_origin_hold_ancestry;
      my $r=$q->{record};$out=task6a_origin_hold_ancestry($r->{path});
      if(exists($r->{driftIndex})) {
        no warnings 'once';$main::test_file_drift_index=$r->{driftIndex};$main::test_file_drift=1;
      }
      $out->{recheck}=task6a_origin_recheck_ancestry();task6a_origin_close_files();
    } elsif($q->{kind} eq 'acl') {
      die "ACL sample implementation missing\n" unless defined &task6a_origin_acl_free;
      my $r=$q->{record};
      if(exists($r->{output})) {
        no warnings qw(redefine once);
        local *main::task6a_origin_capture=sub {
          my ($tool,$args,$seconds,$limit)=@_;
          die "wrong ACL external selection" unless $tool eq '/bin/ls'
            &&JSON::PP->new->encode($args) eq JSON::PP->new->encode(['-lde',$r->{path}])
            &&$seconds==2&&$limit==4096;
          return {out=>$r->{output},err=>$r->{err}//'',status=>$r->{status}//0,
            reaped=>exists($r->{reaped})?$r->{reaped}:JSON::PP::true};
        };
        $out=task6a_origin_acl_free($r->{path});
      } else {$out=task6a_origin_acl_free($r->{path});}
    } elsif($q->{kind} eq 'held-file') {
      die "retained file implementation missing\n" unless defined &task6a_origin_hold_file;
      my $r=$q->{record};
      $out=task6a_origin_hold_file($r->{path},$r->{sha256},$r->{mode},$r->{limit});
      if(exists($r->{driftIndex})) {
        no warnings 'once';$main::test_file_drift_index=$r->{driftIndex};$main::test_file_drift=1;
      }
      $out->{recheck}=task6a_origin_recheck_files();
      my $forged=eval {task6a_origin_recheck_files({receipt=>JSON::PP::true})};my $error=$@;
      $out->{forgedRefused}=(!defined($forged)&&$error eq "TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n")?JSON::PP::true:JSON::PP::false;
      task6a_origin_close_files();
    } elsif($q->{kind} eq 'poll-error') {
      my ($reaped,$uncertain,$status)=(0,0,undef);
      task6a_origin_poll($$,\$reaped,\$uncertain,\$status);
      $out={reaped=>$reaped,uncertain=>$uncertain,status=>$status};
    } else {die "unknown test kind";}
    print JSON::PP->new->canonical->utf8->encode($out);
  `;
  const r=spawnSync('/usr/bin/perl',['-f','-e',program,Buffer.from(source).toString('base64')],{
    input:JSON.stringify({kind,record,expected}),cwd:'/',env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'},timeout:record?.fifoRace?500:10000,maxBuffer:65536,
  });
  assert.equal(r.error,undefined);assert.equal(r.signal,null);return r;
}
const COMMIT='8aa0d2c6f44815339da3d6ecf8eac8ff1cc49d2c',TREE='5166646e62fa6f8c95f083c1d01ae81dd35a23fe',BLOB='ce013625030ba8dba906f756967f9e9ca394464a';
const ZERO='0'.repeat(40),ONE='1'.repeat(40),TWO='2'.repeat(40);
function literalCommit() {
  return {sha:COMMIT,tree:{sha:ZERO},parents:[{sha:ONE},{sha:TWO}],verification:{verified:true,reason:'valid',
    payload:`tree ${ZERO}\nparent ${ONE}\nparent ${TWO}\nauthor Example <dev@example.test> 1700000000 +0000\ncommitter Example <dev@example.test> 1700000000 +0000\n\nreviewed merge\n`,
    signature:'-----BEGIN PGP SIGNATURE-----\n\nYWJj\n=AAAA\n-----END PGP SIGNATURE-----\n',
  }};
}
function literalTree() {
  return {sha:TREE,truncated:false,tree:[{path:'foo',mode:'040000',type:'tree',sha:ONE},
    {path:'z',mode:'100644',type:'blob',sha:BLOB,size:6},{path:'foo.bar',mode:'100644',type:'blob',sha:BLOB,size:6}]};
}
function literalBlob() {return {sha:BLOB,size:6,encoding:'base64',content:'aGVsbG8K\n'};}
function framedHash(kind,bytes) {return createHash('sha1').update(`${kind} ${bytes.length}\0`).update(bytes).digest('hex');}
function coherentCommit(r) {
  const p=r.verification.payload,s=r.verification.signature,i=p.indexOf('\n\n');
  r.sha=framedHash('commit',Buffer.from(p.slice(0,i)+'\ngpgsig '+s.split('\n').join('\n ')+p.slice(i)));return r;
}
function coherentTree(r) {
  const entries=[...r.tree].sort((a,b)=>Buffer.compare(Buffer.from(a.path+(a.type==='tree'?'/':'')),Buffer.from(b.path+(b.type==='tree'?'/':''))));
  r.sha=framedHash('tree',Buffer.concat(entries.flatMap(e=>[Buffer.from(`${e.mode==='040000'?'40000':e.mode} ${e.path}\0`),Buffer.from(e.sha,'hex')])));return r;
}
function objectRefuses(kind,r,expected=r.sha,options) {
  const result=systemObject(kind,r,expected,options);assert.notEqual(result.status,0,'unsafe system object accepted');
  assert.match(result.stderr.toString(),/TASK6A_ORIGIN_BOOTSTRAP_REFUSED/);assert.equal(result.stdout.length,0);
}
if(!ordinaryHost()) {
  test('protected archive tests require ordinary macOS UID and fixed Apple Perl',
    {skip:'unsupported host or root test UID; no ambient Perl/root execution fallback'},()=>{});
} else {
test('complete map parser consumes actual interleaved grammar without admitting potential code',()=>{
  const r=parseMap(readFileSync(MAP_FIXTURE));assert.equal(r.status,0,r.stderr.toString());assert.equal(r.stderr.length,0);const out=JSON.parse(r.stdout);
  assert.equal(out.scope,'complete-map-format-diagnostic-only');assert.equal(out.productionAuthority,false);
  assert.equal(out.regionCount,265);assert.equal(out.currentExecutableCount,47);
  assert.equal(out.potentialExecutableCount,63);assert.equal(out.anonymousPotentialExecutableCount,13);
  assert.equal(out.regions.length,265);assert.equal(out.regions[0].start,4309483520);
  assert.equal(out.regions[0].path,'/usr/bin/perl');assert.equal(out.regions.at(-1).kernel,true);
  assert.equal(out.regions.find(x=>x.type==='Kernel Alloc Once').maximumProtection,'rwx');
});
for(const [name,change] of [
  ['crossed process header',s=>s.replace('perl [77777]','perl [88888]')],
  ['duplicate process header',s=>'Process: perl [77777]\n'+s],
  ['crossed region section',s=>s.replace('==== regions for process 77777','==== regions for process 88888')],
  ['crossed summary',s=>s.replace('==== Summary for process 77777','==== Summary for process 88888')],
  ['missing legend',s=>s.replace('==== Legend','==== Missing')],
  ['missing current/max column',s=>s.replace('PRT/MAX','PRT')],
  ['missing report version',s=>s.replace('Report Version:  7\n','')],
  ['unknown row label',s=>s.replaceAll('Kernel Alloc Once','Unexpected region')],
  ['reversed range',s=>s.replace('100dd8000-100ddc000','100ddc000-100dd8000')],
  ['zero range',s=>s.replace('100dd8000-100ddc000','100dd8000-100dd8000')],
  ['overflowing range',s=>s.replace('100dd8000-100ddc000','100dd8000-fffffffffffffffff')],
  ['overlapping range',s=>s.replace('100ddc000-100de0000','100dd8001-100de0000')],
  ['invalid current permission',s=>s.replace('r-x/r-x','rrx/r-x')],
  ['current exceeds maximum',s=>s.replace('r-x/r-x','r-x/r--')],
  ['missing metric column',s=>s.replace('[   16K    16K     0K     0K]','[   16K    16K     0K]')],
  ['invalid size unit',s=>s.replace('[   16K    16K','[   16Z    16K')],
  ['unknown sharing mode',s=>s.replace('SM=COW','SM=UNKNOWN')],
  ['path traversal',s=>s.replace('SM=COW          /usr/bin/perl','SM=COW          /usr/bin/../bin/perl')],
  ['truncated final zone row',s=>s.slice(0,s.lastIndexOf('DefaultMallocZone_0x'))],
  ['suffix diagnostic',s=>s+'warning: unable to collect\n'],
  ['missing terminal LF',s=>s.trimEnd()],['NUL',s=>s.replace('Idle exit:','\0Idle exit:')],
  ['coherent malformed PID',s=>s.replaceAll('77777','077777')],
  ['summary count drift',s=>s.replace(/(TOTAL[^\n]+?)265(?=\n)/,(_,prefix)=>prefix+'264')],
  ['removed complete region',s=>s.replace(/^__TEXT[^\n]+\n/m,'')],
]) test(`complete map parser refuses ${name}`,()=>{
  const raw=readFileSync(MAP_FIXTURE,'utf8'),changed=change(raw);assert.notEqual(changed,raw,'denial fixture must change real input');mapRefuses(changed);
});
test('complete map parser rejects wrong retained PID even with coherent complete map',()=>mapRefuses(readFileSync(MAP_FIXTURE),88888));
test('complete map parser enforces exact byte bound before complete coherent grammar can be consumed',()=>{
  const raw=readFileSync(MAP_FIXTURE,'utf8');
  const padded=n=>raw.slice(0,-1)+' '.repeat(n-raw.length)+'\n';
  const exact=parseMap(padded(1048576));assert.equal(exact.status,0,exact.stderr.toString());assert.equal(JSON.parse(exact.stdout).regionCount,265);
  mapRefuses(padded(1048577));
  const mutant=replaceOnce(readFileSync(MAP,'utf8'),'length($raw)>1048576||','');
  const accepted=parseMap(padded(1048577),77777,{sourceOverride:mutant});
  assert.equal(accepted.status,0,accepted.stderr.toString());assert.equal(JSON.parse(accepted.stdout).regionCount,265);
});
test('complete map parser bounds real sorted region census at 4096 including kernel accounting',()=>{
  function expanded(count) {
    let raw=readFileSync(MAP_FIXTURE,'utf8');const extra=count-265,rows=[];
    for(let i=0;i<extra;i++) {
      const start=0xa00000000+i*0x4000,end=start+0x4000;
      rows.push(`__TEXT ${start.toString(16)}-${end.toString(16)} [16K 0K 0K 0K] r--/r-- SM=COW /usr/bin/perl\n`);
    }
    raw=raw.replace('page table in kernel           kernel-kernel',rows.join('')+'page table in kernel           kernel-kernel');
    raw=raw.replace(/^(__TEXT +8928K[^\n]+?)47(?=\n)/m,(_,prefix)=>prefix+(47+extra));
    return raw.replace(/(TOTAL[^\n]+?)265(?=\n)/,(_,prefix)=>prefix+count);
  }
  const exact=parseMap(expanded(4096));assert.equal(exact.status,0,exact.stderr.toString());assert.equal(JSON.parse(exact.stdout).regionCount,4096);
  mapRefuses(expanded(4097));
});
test('complete map parser bounds complete category census at 64 unique summaries',()=>{
  function expanded(extra) {
    let raw=readFileSync(MAP_FIXTURE,'utf8');const rows=[],summaries=[];
    for(let i=0;i<extra;i++) {
      const tag=i<21?i+1:i+2,start=0xa00000000+i*0x4000;
      rows.push(`Memory Tag ${tag} ${start.toString(16)}-${(start+0x4000).toString(16)} [16K 0K 0K 0K] rw-/rw- SM=PRV\n`);
      summaries.push(`Memory Tag ${tag} 16K 0K 0K 0K 0K 0K 0K 1\n`);
    }
    raw=raw.replace('page table in kernel           kernel-kernel',rows.join('')+'page table in kernel           kernel-kernel');
    raw=raw.replace('Kernel Alloc Once                   32K',summaries.join('')+'Kernel Alloc Once                   32K');
    return raw.replace(/(TOTAL[^\n]+?)265(?=\n)/,(_,prefix)=>prefix+(265+extra));
  }
  const exact=parseMap(expanded(42));assert.equal(exact.status,0,exact.stderr.toString());assert.equal(JSON.parse(exact.stdout).regionCount,307);
  mapRefuses(expanded(43));
});
test('complete map parser bounds complete matching malloc zone census at 32',()=>{
  function expanded(extra) {
    let raw=readFileSync(MAP_FIXTURE,'utf8');const rows=[],zones=[];
    for(let i=0;i<extra;i++) {
      const start=0xa00000000+i*0x4000,zone=`DefaultMallocZone_0x${start.toString(16)}`;
      rows.push(`MALLOC metadata ${start.toString(16)}-${(start+0x4000).toString(16)} [16K 0K 0K 0K] rw-/rw- SM=PRV ${zone}\n`);
      zones.push(`${zone} 16K 0K 0K 0K 0 0K 0K 0% 1\n`);
    }
    raw=raw.replace('page table in kernel           kernel-kernel',rows.join('')+'page table in kernel           kernel-kernel');
    raw=raw.replace(/^(MALLOC metadata +784K[^\n]+?)4(?=\n)/m,(_,prefix)=>prefix+(4+extra));
    raw=raw.replace(/(TOTAL[^\n]+?)265(?=\n)/,(_,prefix)=>prefix+(265+extra));
    return raw+zones.join('');
  }
  const exact=parseMap(expanded(31));assert.equal(exact.status,0,exact.stderr.toString());assert.equal(JSON.parse(exact.stdout).regionCount,296);
  mapRefuses(expanded(32));
});
test('complete map parser line cap refuses coherent input through scaled in-memory boundary',()=>{
  const raw=readFileSync(MAP_FIXTURE,'utf8'),source=readFileSync(MAP,'utf8');
  // Real 8192 is redundant under 4096 rows/64 summaries/32 zones. Exercise
  // its actual branch on a lower test-only limit, not invented production lines.
  assert.equal(raw.split('\n').length-1,337);
  const scaled=replaceOnce(source,'@lines>8192','@lines>337');
  const exact=parseMap(raw,77777,{sourceOverride:scaled});assert.equal(exact.status,0,exact.stderr.toString());
  const denied=parseMap(raw+'\n',77777,{sourceOverride:scaled});assert.notEqual(denied.status,0);
  assert.equal(denied.stderr.toString(),'TASK6A_ORIGIN_MAP_REFUSED\n');
  const mutant=replaceOnce(scaled,'refuse() if @lines>337;','');
  const accepted=parseMap(raw+'\n',77777,{sourceOverride:mutant});assert.equal(accepted.status,0,accepted.stderr.toString());
});
for(const [name,pattern,current,maximum,wantCurrent,wantPotential,wantAnonymous] of [
  ['guard',/^MALLOC guard page[^\n]+---\/---/m,'--x','--x',48,64,14],
  ['unused image detail',/^unused __DATA[^\n]+rw-\/rw-/m,'rw-','rwx',47,64,14],
  ['shared cache detail',/^__LINKEDIT[^\n]+r--\/r--(?=[^\n]+dyld shared cache combined)/m,'r--','r-x',47,64,14],
  ['kernel accounting',/^page table in kernel[^\n]+rw-\/rw-/m,'rw-','rwx',47,64,14],
  ['maximum-only stack',/^STACK GUARD[^\n]+---\/rwx/m,'--x','rwx',48,63,13],
]) test(`complete map parser never exempts potential executable ${name} by label`,()=>{
  const raw=readFileSync(MAP_FIXTURE,'utf8'),changed=raw.replace(pattern,row=>row.replace(/[r-][w-][x-]\/[r-][w-][x-]$/,current+'/'+maximum));
  assert.notEqual(changed,raw);const r=parseMap(changed);assert.equal(r.status,0,r.stderr.toString());assert.equal(r.stderr.length,0);
  const out=JSON.parse(r.stdout);assert.equal(out.productionAuthority,false);assert.equal(out.currentExecutableCount,wantCurrent);
  assert.equal(out.potentialExecutableCount,wantPotential);assert.equal(out.anonymousPotentialExecutableCount,wantAnonymous);
  assert.equal(out.regions.filter(x=>x.unusedPath).length,9,'unused framework paths remain separate from loaded image paths');
});
for(const [name,change] of [
  ['unused row becoming apparent loaded image',s=>s.replace('on dirty page  unused system shared lib __DATA','/usr/lib/libSystem.B.dylib')],
  ['image row with allocator detail',s=>s.replace('SM=COW          /usr/bin/perl','SM=COW          DefaultMallocZone_0x101130000')],
  ['image row with thread detail',s=>s.replace('SM=COW          /usr/bin/perl','SM=COW          thread 0')],
  ['image row with cache detail',s=>s.replace('SM=COW          /usr/bin/perl','SM=COW          dyld shared cache combined __LINKEDIT')],
  ['zone region count drift',s=>s.replace(/(DefaultMallocZone_0x[^\n]+59% +)6(?=\n)/,'$11')],
  ['unmapped image load address',s=>s.replace('Load Address:    0x100dd8000','Load Address:    0x100dd8001')],
  ['header image path with no matching image row',s=>s.replace('Path:            /usr/bin/perl','Path:            /usr/bin/other')],
]) test(`complete map parser refuses incompatible ${name}`,()=>{
  const raw=readFileSync(MAP_FIXTURE,'utf8'),changed=change(raw);assert.notEqual(changed,raw);mapRefuses(changed);
});
const PERL_FILE={path:'/usr/bin/perl',sha256:'abda2bfd23a6c9a8e57adf2291f0aea4abd8faf440558ee49fe4ced55e8d9ad0',mode:0o755,limit:1048576};
test('retained file holder reads an actual one-link root-owned file and rechecks its own descriptor',()=>{
  const r=systemObject('held-file',PERL_FILE,'');assert.equal(r.status,0,r.stderr.toString());
  const out=JSON.parse(r.stdout);assert.equal(out.scope,'retained-file-diagnostic-only');
  assert.equal(out.productionAuthority,false);assert.equal(out.path,'/usr/bin/perl');
  assert.equal(out.contentSha256,PERL_FILE.sha256);assert.equal(out.byteLength,101840);
  assert.equal(out.recheck.fileCount,1);assert.equal(out.forgedRefused,true);
});
for(const [name,change] of [
  ['hash mismatch',{sha256:'0'.repeat(64)}],['mode mismatch',{mode:0o555}],
  ['size exceeds admitted read bound',{limit:101839}],['not a regular file',{path:'/private/tmp'}],
  ['final symlink',{path:'/var'}],['ordinary-user source',{path:fileURLToPath(BOOTSTRAP)}],
  ['relative path',{path:'usr/bin/perl'}],['traversal',{path:'/usr/bin/../bin/perl'}],
  ['double slash',{path:'/usr//bin/perl'}],['zero bound',{limit:0}],
]) test(`retained file holder refuses ${name}`,()=>objectRefuses('held-file',{...PERL_FILE,...change},''));
for(const [name,driftIndex] of [['device',0],['inode',1],['mode',2],['link count',3],['owner',4],['group',5],['size',7],['mtime',9],['ctime',10]])
  test(`retained file holder refuses ${name} drift after capture`,()=>objectRefuses('held-file',{...PERL_FILE,driftIndex},''));
test('retained file holder does not block on an actual FIFO replacing a pre-open regular snapshot',t=>{
  const directory=mkdtempSync('/private/tmp/setfarm-task6a-file-open-test.');const fifo=directory+'/member';
  // Exact ordinary-owned test fixture only; no recursive or old-tree deletion.
  t.after(()=>{if(existsSync(fifo))unlinkSync(fifo);rmdirSync(directory);});
  const created=spawnSync('/usr/bin/mkfifo',[fifo],{cwd:'/',env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'},timeout:1000});
  assert.equal(created.error,undefined);assert.equal(created.status,0,created.stderr.toString());
  objectRefuses('held-file',{...PERL_FILE,path:fifo,fifoRace:true},'');
});
const ACL_LINE='-rwxr-xr-x    1 root  wheel  101840 Jun 25 05:29 /usr/bin/perl\n';
test('ACL sample uses an actual fixed ls child and rejects caller authority',()=>{
  const r=systemObject('acl',{path:'/usr/bin/perl'},'');assert.equal(r.status,0,r.stderr.toString());
  assert.deepEqual(JSON.parse(r.stdout),{scope:'acl-sample-diagnostic-only',productionAuthority:false});
});
test('ACL sample accepts one complete metadata line with xattrs but no ACL entries',()=>{
  const r=systemObject('acl',{path:'/usr/bin/perl',output:ACL_LINE.replace('-rwxr-xr-x ','-rwxr-xr-x@ ')},'');
  assert.equal(r.status,0,r.stderr.toString());assert.equal(JSON.parse(r.stdout).productionAuthority,false);
});
for(const [name,change] of [
  ['ACL marker',{output:ACL_LINE.replace('-rwxr-xr-x ','-rwxr-xr-x+ ')}],
  ['ACL extra row',{output:ACL_LINE+' 0: user:someone allow write\n'}],
  ['missing terminal LF',{output:ACL_LINE.trimEnd()}],['extra blank line',{output:ACL_LINE+'\n'}],
  ['wrong path',{output:ACL_LINE.replace('/usr/bin/perl','/usr/bin/curl')}],
  ['symlink mode',{output:ACL_LINE.replace('-rwx','lrwx')}],
  ['unknown owner',{output:ACL_LINE.replace('root  wheel','setrox  wheel')}],
  ['unknown group',{output:ACL_LINE.replace('root  wheel','root  admin')}],
  ['diagnostic text',{output:ACL_LINE+'ls: permission denied\n'}],
  ['NUL',{output:ACL_LINE.replace('Jun','\0Jun')}],
  ['stderr',{output:ACL_LINE,err:'warning'}],['nonzero exit',{output:ACL_LINE,status:1}],
  ['unknown definite reap',{output:ACL_LINE,reaped:false}],
  ['relative requested path',{path:'usr/bin/perl',output:ACL_LINE}],
]) test(`ACL sample refuses ${name}`,()=>objectRefuses('acl',{path:'/usr/bin/perl',output:ACL_LINE,...change},''));
test('retained ancestry holder owns exact protected system-directory descriptors and ACL samples',()=>{
  const r=systemObject('ancestry',{path:'/usr/bin/perl'},'');assert.equal(r.status,0,r.stderr.toString());
  const out=JSON.parse(r.stdout);assert.equal(out.scope,'retained-ancestry-diagnostic-only');
  assert.equal(out.productionAuthority,false);assert.equal(out.directoryCount,3);assert.equal(out.recheck.directoryCount,3);
});
test('retained ancestry holder permits only the exact root-owned sticky temporary parent',()=>{
  const r=systemObject('ancestry',{path:'/private/tmp/not-created-test-member'},'');assert.equal(r.status,0,r.stderr.toString());
  assert.equal(JSON.parse(r.stdout).directoryCount,3);
});
for(const [name,path] of [
  ['ordinary writable directory',fileURLToPath(BOOTSTRAP)],['symlink ancestor','/var/tmp/member'],
  ['missing ancestor','/private/task6a-nonexistent-ancestry/member'],
  ['relative path','usr/bin/perl'],['traversal','/usr/bin/../bin/perl'],['double slash','/usr//bin/perl'],
]) test(`retained ancestry holder refuses ${name}`,()=>objectRefuses('ancestry',{path},''));
for(const [name,driftIndex] of [['device',0],['inode',1],['mode',2],['owner',4],['group',5]])
  test(`retained ancestry holder refuses ${name} drift`,()=>objectRefuses('ancestry',{path:'/usr/bin/perl',driftIndex},''));
for(const mode of ['success','drift-restore','failed-hold-restore','close-failure','close-throw'])
  test(`retained holder lifecycle closes actual owned FDs and remains irreversible after ${mode}`,()=>{
    const r=systemObject('held-lifecycle',{mode},'');assert.equal(r.status,0,r.stderr.toString());const out=JSON.parse(r.stdout);
    assert.equal(out.ownedCount,mode==='failed-hold-restore'?5:4);assert.equal(out.leakedCount,0,'owned descriptor leaked');
    assert.equal(out.releasedRefused,true);assert.equal(out.reopenRefused,true);assert.equal(out.repeatCloseRefused,true);
    assert.equal(out.firstRefused,mode.endsWith('-restore'));assert.equal(out.restoredRefused,mode.endsWith('-restore'));
    assert.equal(out.closeRefused,mode!=='success');
  });
test('retained holder lifecycle consumers detect missing burn and release enforcement',()=>{
  let source=readFileSync(BOOTSTRAP,'utf8');source=source.replaceAll('!$file_lifecycle_burned','1').replaceAll('!$file_lifecycle_released','1');
  const r=systemObject('held-lifecycle',{mode:'drift-restore'},'',{sourceOverride:source});assert.equal(r.status,0,r.stderr.toString());
  const out=JSON.parse(r.stdout);assert.equal(out.restoredRefused,false,'mutant did not reach restored real-file consumer');
});
for(const mode of ['success','acl-row','acl-marker','acl-stderr','acl-nonzero','acl-unknown-reap',
  'duplicate','raw-append','close-failure','close-throw','release-arity','before-start','hold-arity',
  'ledger-remove','ledger-replace','helper-nonzero','partial-capture','post-ancestry',
  'prior-contamination','unknown-helper','recheck-arity','deadline'])
  test(`composed physical holder has one irreversible owned epoch after ${mode}`,()=>{
    const r=systemObject('composed-physical',{mode},'');assert.equal(r.status,0,r.stderr.toString());
    assert.equal(r.stderr.length,0);const out=JSON.parse(r.stdout);
    const noCapture=['before-start','hold-arity','prior-contamination'].includes(mode);
    const failedCapture=['partial-capture','post-ancestry'].includes(mode);
    const burnsBeforeRelease=mode.startsWith('acl-')||mode.startsWith('ledger-')||['duplicate','raw-append','before-start','hold-arity','helper-nonzero',
      'partial-capture','post-ancestry','prior-contamination','unknown-helper','recheck-arity','deadline'].includes(mode);
    if(!noCapture&&!failedCapture){
      assert.equal(out.scope,'composed-system-perl-physical-candidate-diagnostic-only');
      assert.equal(out.productionAuthority,false);assert.ok(out.leafSamples>=2,'leaf ACL never composed');
    }else if(noCapture) assert.equal(out.leafSamples,0,'invalid initial state started helpers');
    else assert.equal(out.leafSamples,mode==='partial-capture'?1:2);
    assert.equal(out.ownedCount,mode==='prior-contamination'?1:noCapture?0:4);assert.equal(out.leakedCount,0);
    assert.equal(out.replacementAlive,mode==='ledger-replace','cleanup adopted a descriptor it did not own');
    assert.equal(out.priorAlive,mode==='prior-contamination','composition closed a preexisting raw-owner descriptor');
    assert.equal(out.unknownStaysBurned,mode==='unknown-helper');
    assert.equal(out.exactCloseOnce,true,'not every owned descriptor received exactly one closure attempt');
    assert.equal(out.firstRefused,burnsBeforeRelease);assert.equal(out.restoredRefused,burnsBeforeRelease);
    assert.equal(out.closeRefused,mode!=='success');
    assert.equal(out.releasedRefused,true);assert.equal(out.reopenRefused,true);assert.equal(out.repeatCloseRefused,true);
  });
test('composed physical consumers expose omitted leaf ACL and final ancestry checks',()=>{
  const source=readFileSync(BOOTSTRAP,'utf8');
  const cases=[
    ['acl-row',replaceOnce(source,"        task6a_origin_acl_free('/usr/bin/perl');\n        task6a_origin_recheck_files();",
      '        task6a_origin_recheck_files();')],
    ['post-ancestry',replaceOnce(source,'        task6a_origin_recheck_ancestry();\n        task6a_origin_refuse() unless task6a_origin_physical_records()',
      '        task6a_origin_refuse() unless task6a_origin_physical_records()')],
  ];
  for(const [mode,sourceOverride] of cases) {
    const r=systemObject('composed-physical',{mode},'',{sourceOverride});assert.equal(r.status,0,r.stderr.toString());
    assert.equal(JSON.parse(r.stdout).firstRefused,false,`${mode} mutant never reached forbidden acceptance`);
  }
});
test('composed physical consumers expose missing sticky burn and partial-handle ownership',()=>{
  const source=readFileSync(BOOTSTRAP,'utf8');
  const noBurn=replaceOnce(source,String.raw`    $physical_state='burned' unless $physical_state eq 'released';
    $file_lifecycle_burned=1 if $physical_owns_ledgers;
    task6a_origin_physical_cleanup();`, '    # Test-only removal of lifecycle effects.');
  const burn=systemObject('composed-physical',{mode:'acl-row'},'',{sourceOverride:noBurn});assert.equal(burn.status,0,burn.stderr.toString());
  assert.equal(JSON.parse(burn.stdout).restoredRefused,false,'missing burn did not revive the actual held-file consumer');
  const noOwnership=source.replaceAll('push(@physical_owned_handles,$fh) if $physical_owns_ledgers&&$physical_internal;',
    '# Test-only omission of partial-start handle ownership.');
  const partial=systemObject('composed-physical',{mode:'partial-capture'},'',{sourceOverride:noOwnership});
  assert.equal(partial.status,0,partial.stderr.toString());const out=JSON.parse(partial.stdout);
  assert.equal(out.ownedCount,4);assert.equal(out.leakedCount,4);assert.equal(out.exactCloseOnce,false);
});
function sourceGraph({sourceBytes={}}={}) {
  const sources=[['task6a-origin-archive-v2.pm',HELPER],['task6a-origin-native-v2.pm',NATIVE],['task6a-origin-map-v2.pm',MAP],['task6a-protected-origin-entry-v2.mjs',ENTRY]];
  const blobs=sources.map(([path,url])=>{
    const bytes=sourceBytes[path]??readFileSync(url);return {path,sha:framedHash('blob',bytes),size:bytes.length,bytes};
  });
  const scripts=coherentTree({truncated:false,tree:blobs.map(({path,sha,size})=>({path,sha,size,mode:'100644',type:'blob'}))});
  const root=coherentTree({truncated:false,tree:[{path:'scripts',sha:scripts.sha,mode:'040000',type:'tree'}]});
  const merge=literalCommit();merge.tree.sha=root.sha;merge.verification.payload=merge.verification.payload.replace(`tree ${ZERO}`,`tree ${root.sha}`);coherentCommit(merge);
  const main={ref:'refs/heads/main',object:{type:'commit',sha:merge.sha}};
  const pr={number:253,state:'closed',merged:true,merged_at:'2026-09-30T13:00:00Z',merge_commit_sha:merge.sha,
    base:{ref:'main',repo:{full_name:'hikmetgulsesli/setfarm'}},head:{sha:TWO,repo:{full_name:'hikmetgulsesli/setfarm'}}};
  return [
    {route:'/git/ref/heads/main',data:main},{route:`/git/commits/${merge.sha}`,data:merge},
    {route:`/commits/${merge.sha}/pulls?per_page=100&page=1`,data:[{number:253,merge_commit_sha:merge.sha}]},
    {route:'/pulls/253',data:pr},{route:`/git/trees/${root.sha}`,data:root},{route:`/git/trees/${scripts.sha}`,data:scripts},
    ...blobs.map(b=>({route:`/git/blobs/${b.sha}`,data:{sha:b.sha,size:b.size,encoding:'base64',content:b.bytes.toString('base64')}})),
    {route:'/git/ref/heads/main',data:structuredClone(main)},
  ];
}
test('archive selects only one exact regular Node member without installing unrelated paths',()=>{
  const r=invoke(archive([item('elsewhere',Buffer.alloc(0),{type:'2',link:'../../escape'}),item(MEMBER),item('npm/package.json',Buffer.from('{}'))]));
  assert.equal(r.status,0,r.stderr.toString());assert.deepEqual(r.stdout,BODY);
});
test('archive joins ustar prefix and member name before selecting Node',()=>{
  const r=invoke(archive([item('node',BODY,{prefix:'node-v22.23.1-darwin-arm64/bin'})]));assert.equal(r.status,0,r.stderr.toString());assert.deepEqual(r.stdout,BODY);
});
test('archive applies local PAX effective path before selecting Node',()=>{
  const r=invoke(archive([item('PaxHeader',pax('path',MEMBER),{type:'x'}),item('placeholder')]));assert.equal(r.status,0,r.stderr.toString());assert.deepEqual(r.stdout,BODY);
});
test('archive applies GNU longname before selecting Node',()=>{
  const r=invoke(archive([item('././@LongLink',Buffer.from(MEMBER+'\0'),{type:'L'}),item('placeholder')]));assert.equal(r.status,0,r.stderr.toString());assert.deepEqual(r.stdout,BODY);
});
for(const [name,parts] of [
  ['duplicate selected member',[item(MEMBER),item(MEMBER)]],
  ['selected symlink',[item(MEMBER,Buffer.alloc(0),{type:'2',link:'elsewhere'})]],
  ['selected hardlink',[item(MEMBER,Buffer.alloc(0),{type:'1',link:'elsewhere'})]],
  ['missing member',[item('node-v22.23.1-darwin-arm64/bin/elsewhere')]],
  ['PAX path substitution',[item('PaxHeader',pax('path','elsewhere'),{type:'x'}),item(MEMBER)]],
  ['GNU path substitution',[item('././@LongLink',Buffer.from('elsewhere\0'),{type:'L'}),item(MEMBER)]],
  ['duplicate PAX path',[item('PaxHeader',Buffer.concat([pax('path',MEMBER),pax('path',MEMBER)]),{type:'x'}),item('placeholder')]],
  ['global path override',[item('Global',pax('path',MEMBER),{type:'g'}),item('placeholder')]],
  ['unsupported sparse extension',[item('PaxHeader',pax('GNU.sparse.size','22'),{type:'x'}),item(MEMBER)]],
  ['malformed PAX record',[item('PaxHeader',Buffer.from('99 path=x\n'),{type:'x'}),item(MEMBER)]],
  ['dangling extension',[item(MEMBER),item('PaxHeader',pax('path',MEMBER),{type:'x'})]],
  ['dangling empty local PAX',[item(MEMBER),item('PaxHeader',Buffer.alloc(0),{type:'x'})]],
]) test(`archive refuses ${name}`,()=>refuses(archive(parts)));
test('archive refuses incorrect header checksum',()=>{
  const h=header(MEMBER,BODY.length);h[0]^=1;refuses(archive([h,BODY,Buffer.alloc(512-BODY.length)]));
});
test('archive refuses malformed octal size even with a coherent header checksum',()=>{
  const h=header(MEMBER,BODY.length);h.write('000000000x0\0',124,12,'ascii');h.fill(32,148,156);
  h.write([...h].reduce((s,b)=>s+b,0).toString(8).padStart(6,'0')+'\0 ',148,8,'ascii');refuses(archive([h]));
});
test('archive refuses overbound declared selected bytes before reading body',()=>refuses(archive([header(MEMBER,134217729)])));
test('archive refuses overbound effective PAX size before reading body',()=>refuses(archive([item('PaxHeader',pax('size','134217729'),{type:'x'}),header(MEMBER,0)])));
test('selected-size guards refuse before any member body read rather than accidental truncation',()=>{
  const direct=refuses(archive([header(MEMBER,134217729)]),{trackReads:true});
  // SIP Gunzip probes the input with an undefined-length read at construction.
  // Only the explicit header request follows; no selected-body request occurs.
  assert.match(direct.stderr.toString(),/TEST_READ_REQUESTS=undefined,512\n/);
  const effective=refuses(archive([item('PaxHeader',pax('size','134217729'),{type:'x'}),header(MEMBER,0)]),{trackReads:true});
  assert.match(effective.stderr.toString(),/TEST_READ_REQUESTS=undefined,512,18,494,512\n/);
  const mutant=replaceOnce(readFileSync(HELPER,'utf8'),'$size>134217728','0');
  const attempted=refuses(archive([header(MEMBER,134217729)]),{source:mutant,trackReads:true});
  assert.match(attempted.stderr.toString(),/TEST_READ_REQUESTS=undefined,512,65536/);
});
test('archive member-count cap rejects a coherent complete next member',()=>{
  const zero=header('unused',0),parts=Array(19999).fill(zero);
  const permitted=invoke(archive([item(MEMBER),...parts]));assert.equal(permitted.status,0,permitted.stderr.toString());
  assert.deepEqual(permitted.stdout,BODY);
  refuses(archive([item(MEMBER),...parts,zero]));
});
test('archive limit branches have coherent bounded in-memory consumers and missing-guard mutants',()=>{
  const real=readFileSync(HELPER,'utf8'),input=archive([item(MEMBER)]);
  for(const [guard,scaled,removed] of [
    ['length($compressed)>134217728',`length($compressed)>${input.length-1}`,'0'],
    ['$total>536870912','$total>1024','0'],
    ['$size>134217728',`$size>${BODY.length-1}`,'0'],
  ]) {
    refuses(input,{source:replaceOnce(real,guard,scaled)});
    const permitted=invoke(input,{source:replaceOnce(real,guard,removed)});
    assert.equal(permitted.status,0,permitted.stderr.toString());assert.deepEqual(permitted.stdout,BODY);
  }
});
test('archive uniqueness consumer catches the in-memory missing-duplicate guard',()=>{
  const input=archive([item(MEMBER),item(MEMBER)]);refuses(input);
  const mutated=replaceOnce(readFileSync(HELPER,'utf8'),'++$selected>1','($selected=1)>1');
  const r=invoke(input,{source:mutated});assert.equal(r.status,0,r.stderr.toString());assert.deepEqual(r.stdout,BODY);
});
test('empty local PAX pending state clears only on an actual following member',()=>{
  const r=invoke(archive([item('PaxHeader',Buffer.alloc(0),{type:'x'}),item(MEMBER)]));
  assert.equal(r.status,0,r.stderr.toString());assert.deepEqual(r.stdout,BODY);
});
test('archive refuses truncated member body',()=>refuses(archive([header(MEMBER,2048),BODY])));
test('archive refuses truncated header',()=>refuses(gzipSync(Buffer.alloc(511))));
test('archive refuses missing double-zero EOF',()=>refuses(archive([item(MEMBER)],{end:false})));
test('archive refuses nonzero data beyond tar EOF',()=>refuses(archive([item(MEMBER)],{tail:Buffer.from('x')})));
test('archive refuses nonzero member padding',()=>{
  const node=item(MEMBER);node[node.length-1]=1;refuses(archive([node]));
});
test('archive refuses trailing compressed bytes',()=>refuses(Buffer.concat([archive([item(MEMBER)]),Buffer.from('trailing')])));
test('archive refuses concatenated gzip streams',()=>refuses(Buffer.concat([archive([item(MEMBER)]),archive([item('second')])])));
test('archive refuses gzip CRC corruption',()=>{
  const bytes=archive([item(MEMBER)]);bytes[bytes.length-8]^=1;refuses(bytes);
});
test('native policy joins thin arm64 executable and exact system-only load commands',()=>{
  const r=native(macho());assert.equal(r.status,0,r.stderr.toString());
  const result=JSON.parse(r.stdout);assert.equal(result.fileType,2);
  assert.equal(result.dynamicLinker,'/usr/lib/dyld');
  assert.deepEqual(result.systemDependencies,['/usr/lib/libSystem.B.dylib']);
  assert.equal(result.productionAuthority,false);
});
for(const [name,change] of [
  ['wrong magic',b=>b.writeUInt32LE(0,0)],['wrong CPU',b=>b.writeUInt32LE(0x01000007,4)],
  ['unsupported CPU subtype',b=>b.writeUInt32LE(999,8)],
  ['non-executable type',b=>b.writeUInt32LE(6,12)],['reserved header',b=>b.writeUInt32LE(1,28)],
  ['excess command count',b=>b.writeUInt32LE(4097,16)],['crossed table',b=>b.writeUInt32LE(1000000,20)],
  ['crossed command size',b=>b.writeUInt32LE(10000,36)],['unaligned command',b=>b.writeUInt32LE(13,36)],
  ['crossed string offset',b=>b.writeUInt32LE(10000,40)],['string inside command fields',b=>b.writeUInt32LE(4,40)],
  ['command count mismatch',b=>b.writeUInt32LE(1,16)],
]) test(`native policy refuses ${name}`,()=>{const b=macho();change(b);nativeRefuses(b);});
for(const [name,commands] of [
  ['missing dynamic linker',[command(0xc,'/usr/lib/libSystem.B.dylib')]],
  ['duplicate dynamic linker',[command(0xe,'/usr/lib/dyld'),command(0xe,'/usr/lib/dyld')]],
  ['wrong dynamic linker',[command(0xe,'/tmp/dyld')]],
  ['external dylib',[command(0xe,'/usr/lib/dyld'),command(0xc,'/opt/homebrew/lib/evil.dylib')]],
  ['system path dotdot',[command(0xe,'/usr/lib/dyld'),command(0xc,'/usr/lib/../../tmp/evil.dylib')]],
  ['relative dylib',[command(0xe,'/usr/lib/dyld'),command(0xc,'@loader_path/evil.dylib')]],
  ['RPATH search',[command(0xe,'/usr/lib/dyld'),command(0x8000001c,'/usr/lib',{offset:12})]],
  ['dynamic environment',[command(0xe,'/usr/lib/dyld'),command(0x27,'DYLD_INSERT_LIBRARIES=evil',{offset:12})]],
  ['unknown command',[command(0xe,'/usr/lib/dyld'),command(0x80000040,'x',{offset:12})]],
]) test(`native policy refuses ${name}`,()=>nativeRefuses(macho(commands)));
test('native policy refuses a loader string without an in-command terminator',()=>{
  const c=command(0xe,'/usr/lib/dyld');c.fill(97,12);nativeRefuses(macho([c]));
});
test('native policy refuses a segment command missing its required fixed structure',()=>{
  const short=Buffer.alloc(8);short.writeUInt32LE(0x19);short.writeUInt32LE(8,4);
  nativeRefuses(macho([command(0xe,'/usr/lib/dyld'),short]));
});
for(const [kind,size] of [[0x2,24],[0xb,80],[0x16,16],[0x1a,72],[0x1b,24],
  [0x1d,16],[0x1e,16],[0x22,48],[0x80000022,48],[0x24,16],[0x26,16],
  [0x80000028,24],[0x29,16],[0x2a,16],[0x2b,16],[0x2e,16],[0x31,40],
  [0x80000033,16],[0x80000034,16],[0x36,16],[0x37,16],[0x38,16]]) {
  test(`native policy refuses structurally short command ${kind.toString(16)}`,()=>
    nativeRefuses(macho([command(0xe,'/usr/lib/dyld'),fixedCommand(kind,8)])));
  test(`native policy accepts complete fixed command ${kind.toString(16)}`,()=>{
    const r=native(macho([command(0xe,'/usr/lib/dyld'),fixedCommand(kind,size)]));
    assert.equal(r.status,0,r.stderr.toString());
  });
}
test('native policy refuses incomplete section tail in segment command',()=>{
  const c=fixedCommand(0x19,72);c.writeUInt32LE(1,64);nativeRefuses(macho([command(0xe,'/usr/lib/dyld'),c]));
});
test('native policy accepts a complete bounded section tail',()=>{
  const c=fixedCommand(0x19,152);c.writeUInt32LE(1,64);
  const r=native(macho([command(0xe,'/usr/lib/dyld'),c]));assert.equal(r.status,0,r.stderr.toString());
});
test('native policy refuses incomplete build tools tail',()=>{
  const c=fixedCommand(0x32,24);c.writeUInt32LE(1,8);c.writeUInt32LE(1,20);
  nativeRefuses(macho([command(0xe,'/usr/lib/dyld'),c]));
});
test('native policy accepts complete macOS build tools tail',()=>{
  const c=fixedCommand(0x32,32);c.writeUInt32LE(1,8);c.writeUInt32LE(1,20);
  const r=native(macho([command(0xe,'/usr/lib/dyld'),c]));assert.equal(r.status,0,r.stderr.toString());
});
test('native policy refuses foreign build platform',()=>{
  const c=fixedCommand(0x32,24);c.writeUInt32LE(2,8);nativeRefuses(macho([command(0xe,'/usr/lib/dyld'),c]));
});
test('native policy refuses structurally short target triple',()=>
  nativeRefuses(macho([command(0xe,'/usr/lib/dyld'),fixedCommand(0x39,8)])));
test('native policy accepts complete target triple string',()=>{
  const r=native(macho([command(0xe,'/usr/lib/dyld'),command(0x39,'arm64-apple-macosx',{offset:12})]));
  assert.equal(r.status,0,r.stderr.toString());
});
test('native command-count cap rejects an otherwise coherent complete command table',()=>{
  const linker=command(0xe,'/usr/lib/dyld'),uuid=fixedCommand(0x1b,24);
  const permitted=native(macho([linker,...Array(4095).fill(uuid)]));assert.equal(permitted.status,0,permitted.stderr.toString());
  nativeRefuses(macho([linker,...Array(4096).fill(uuid)]));
});
test('private entry completes exactly three fresh challenges and END only after input EOF',async t=>{
  const s=await entrySession(t);await s.output('READY\n');
  let expected='READY\n';
  for(const n of NONCES) {s.child.stdin.write(`CHALLENGE ${n}\n`);expected+=`PONG ${n}\n`;await s.output(expected);}
  s.child.stdin.write('END\n');
  await new Promise(resolve=>setTimeout(resolve,50));assert.equal(s.state.out,expected,'END does not acknowledge before definite input EOF');
  s.child.stdin.end();
  const r=await s.closed;assert.deepEqual(r,{code:0,signal:null,out:expected+'END\n',err:''});
});
test('private entry buffers bounded partial challenge bytes without premature response',async t=>{
  const s=await entrySession(t);await s.output('READY\n');
  s.child.stdin.write('CHALLENGE '+NONCES[0].slice(0,31));
  await new Promise(resolve=>setTimeout(resolve,30));assert.equal(s.state.out,'READY\n');
  s.child.stdin.end(NONCES[0].slice(31)+'\n'+exchange(NONCES.slice(1))+'END\n');
  const r=await s.closed;assert.equal(r.code,0);assert.equal(r.out,'READY\n'+NONCES.map(n=>`PONG ${n}\n`).join('')+'END\n');
});
for(const [name,input] of [
  ['missing nonce','CHALLENGE\n'],['bad nonce','CHALLENGE '+ 'A'.repeat(64)+'\n'],
  ['foreign message','READY\n'],['partial EOF','CHALLENGE '+NONCES[0]],
  ['premature END','END\n'],['overbound input','x'.repeat(230)],
  ['replayed nonce',exchange([NONCES[0],NONCES[0]])],
  ['fourth challenge',exchange([...NONCES,'4'.repeat(64)])],
  ['bytes after END',exchange()+'END\nx'],
]) test(`private entry refuses ${name}`,async t=>{
  const s=await entrySession(t);await s.output('READY\n');s.child.stdin.end(input);
  const r=await s.closed;assert.equal(r.code,2);assert.equal(r.signal,null);
  assert.equal(r.err,'TASK6A_ORIGIN_ENTRY_REFUSED\n');assert.ok(!r.out.endsWith('END\n'));
});
test('private entry refuses extra caller arguments before READY',async t=>{
  const s=await entrySession(t,{args:['caller-selector']});const r=await s.closed;
  assert.deepEqual(r,{code:2,signal:null,out:'',err:'TASK6A_ORIGIN_ENTRY_REFUSED\n'});
});
test('private entry refuses NODE_OPTIONS selection before READY',async t=>{
  const s=await entrySession(t,{options:{NODE_OPTIONS:'--no-warnings'}});const r=await s.closed;
  assert.deepEqual(r,{code:2,signal:null,out:'',err:'TASK6A_ORIGIN_ENTRY_REFUSED\n'});
});
test('private entry burns on parent EOF without successful continuation',async t=>{
  const s=await entrySession(t);await s.output('READY\n');s.child.stdin.end();
  const r=await s.closed;assert.equal(r.code,2);assert.equal(r.signal,null);assert.equal(r.out,'READY\n');
});
test('private entry exits on broken parent output pipe',async t=>{
  const s=await entrySession(t);await s.output('READY\n');s.child.stdout.destroy();
  s.child.stdin.write(`CHALLENGE ${NONCES[0]}\n`);const r=await s.closed;
  assert.equal(r.code,2);assert.equal(r.signal,null);
});
test('private entry refuses a failed final END write instead of reporting successful close',async t=>{
  const s=await entrySession(t);await s.output('READY\n');
  s.child.stdin.write(exchange());await s.output('READY\n'+NONCES.map(n=>`PONG ${n}\n`).join(''));
  s.child.stdout.destroy();await new Promise(resolve=>setTimeout(resolve,20));
  s.child.stdin.end('END\n');const r=await s.closed;
  assert.equal(r.code,2);assert.equal(r.signal,null);assert.equal(r.err,'TASK6A_ORIGIN_ENTRY_REFUSED\n');
});
test('private entry burns on replay before parent EOF or another response',async t=>{
  const s=await entrySession(t);await s.output('READY\n');
  const line=`CHALLENGE ${NONCES[0]}\n`,want=`READY\nPONG ${NONCES[0]}\n`;
  s.child.stdin.write(line);await s.output(want);s.child.stdin.write(line);
  let timer;
  try {
    const r=await Promise.race([s.closed,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('replay did not burn before EOF')),1500);})]);
    assert.deepEqual(r,{code:2,signal:null,out:want,err:'TASK6A_ORIGIN_ENTRY_REFUSED\n'});
  } finally {clearTimeout(timer);}
});
test('private entry lifetime deadline does not renew after a valid challenge',{timeout:26000},async t=>{
  const start=performance.now(),s=await entrySession(t);await s.output('READY\n');
  // A renewal bug would close at ~25s, outside the original ~20s budget.
  await new Promise(resolve=>setTimeout(resolve,5000));
  s.child.stdin.write(`CHALLENGE ${NONCES[0]}\n`);await s.output(`READY\nPONG ${NONCES[0]}\n`);
  const r=await s.closed,elapsed=performance.now()-start;
  assert.equal(r.code,2);assert.equal(r.signal,null);assert.ok(elapsed>=19500&&elapsed<24000,`fixed deadline elapsed ${elapsed}`);
  assert.equal(r.err,'TASK6A_ORIGIN_ENTRY_REFUSED\n');
});
test('ordinary system supervisor refuses before source acquisition or private staging',()=>{
  assert.ok(existsSync(BOOTSTRAP),'system supervisor implementation missing');
  const r=spawnSync('/usr/bin/perl',['-f',fileURLToPath(BOOTSTRAP)],{cwd:'/',env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'},timeout:3000,maxBuffer:65536});
  assert.equal(r.error,undefined);assert.equal(r.signal,null);assert.notEqual(r.status,0);
  assert.equal(r.stdout.length,0);assert.equal(r.stderr.toString(),'TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n');
});
test('ordinary observer exploration refuses caller PID selection before any child effects',()=>{
  assert.ok(existsSync(RECON),'owned observer exploration implementation missing');
  const r=spawnSync(process.execPath,[fileURLToPath(RECON),'123'],{
    cwd:'/',env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'},timeout:3000,maxBuffer:65536,
  });
  assert.equal(r.error,undefined);assert.equal(r.signal,null);assert.equal(r.status,2);
  assert.equal(r.stdout.length,0);assert.equal(r.stderr.toString(),'TASK6A_ORIGIN_OBSERVER_RECON_REFUSED\n');
});
function reconWithSyntheticObserver({program,uidZero=false,euidZero=false,wrongPin=false,noSpawn=false,observeTargetClose=false,targetIgnoresTerm=false,targetCancelsBeforeReady=false,observeObserverSpawn=false,observerPipeFault,targetEndThrows=false}={}) {
  assert.ok(existsSync(RECON),'owned observer exploration implementation missing');
  let source=readFileSync(RECON,'utf8');
  const external="import {spawn} from 'node:child_process';";
  if(source.includes(external)) {
    source=replaceOnce(source,external,`import {spawn as actualSpawn} from 'node:child_process';
      const spawn=(tool,args,opts)=>{
        ${noSpawn?'process.stdout.write("TEST_EXEC_EDGE\\n");throw Error("unexpected spawn");':''}
        if(tool==='/usr/bin/vmmap') {
          ${observeObserverSpawn?'process.stdout.write("TEST_OBSERVER_SPAWN\\n");':''}
          const want=['-w','-noCoalesce','-interleaved',args[3]];
          if(JSON.stringify(args)!==JSON.stringify(want)||!/^[1-9][0-9]*$/.test(args[3])
            ||JSON.stringify(opts.env)!==JSON.stringify({PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C',DT_NO_RESPAWN:'1'})
            ||opts.cwd!=='/') {process.stdout.write('TEST_UNSAFE_OBSERVER_SELECTION\\n');throw Error('unsafe observer selection');}
          const child=actualSpawn('/usr/bin/perl',['-f','-e',${JSON.stringify(program??'print "Process: perl [$ARGV[0]]\\n__TEXT 100-200 [4K] r-x/rwx SM=COW /usr/bin/perl\\n";')},args[3]],opts);
          ${observerPipeFault?`setImmediate(()=>child.${observerPipeFault}.emit('error',Error('synthetic pipe fault')));`:''}
          return child;
        }
        const child=actualSpawn(tool,args,opts);
        ${targetEndThrows?'child.stdin.end=()=>{throw Error("synthetic end failure");};':''}
        ${observeTargetClose?'child.once("close",(code,signal)=>process.stderr.write("TEST_TARGET_CLOSE="+JSON.stringify({pid:child.pid,code,signal})+"\\n"));':''}
        return child;
      };`);
  }
  if(wrongPin)source=replaceOnce(source,'9e2b3e0653ca8c4bdde2ea17c01f6f8e1eecab3658aa470b5e6f511c55f59928','0'.repeat(64));
  if(targetIgnoresTerm)source=replaceOnce(source,'use strict; use warnings; $|=1;', 'use strict; use warnings; $SIG{TERM}=sub {}; $|=1;');
  if(targetCancelsBeforeReady)source=replaceOnce(source,'alarm 20; print "READY\\\\n";', 'alarm 20; kill "TERM",getppid(); select undef,undef,undef,0.1; print "READY\\\\n";');
  if(uidZero)source='globalThis.process.getuid=()=>0;\n'+source;
  if(euidZero)source='globalThis.process.geteuid=()=>0;\n'+source;
  const r=spawnSync(process.execPath,['--input-type=module','--eval',source,'test-recon.mjs'],{
    cwd:'/',env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'},timeout:30000,maxBuffer:65536,
  });
  assert.equal(r.error,undefined);assert.equal(r.signal,null);return r;
}
test('ordinary observer parent settles owned target and helper using only synthetic observer output',()=>{
  const r=reconWithSyntheticObserver();assert.equal(r.status,0,r.stderr.toString());const out=JSON.parse(r.stdout);
  assert.equal(out.productionAuthority,false);assert.equal(out.scope,'ordinary-owned-child-map-diagnostic-only');
  assert.equal(out.targetDefinitelyClosed,true);assert.equal(out.observerDefinitelyClosed,true);
  assert.equal(out.regionCount,1);assert.deepEqual(out.nativePaths,['/usr/bin/perl']);
});
test('ordinary observer diagnostic preserves complete own-child map bytes after definite both-close',()=>{
  const r=reconWithSyntheticObserver();assert.equal(r.status,0,r.stderr.toString());const out=JSON.parse(r.stdout);
  assert.equal(out.mapText,`Process: perl [${out.targetPid}]\n__TEXT 100-200 [4K] r-x/rwx SM=COW /usr/bin/perl\n`);
  assert.equal(out.targetDefinitelyClosed,true);assert.equal(out.observerDefinitelyClosed,true);
  assert.equal(out.productionAuthority,false);
});
test('ordinary observer parent refuses mismatched analysis PID and still settles its actual child',()=>{
  const r=reconWithSyntheticObserver({program:'print "Process: perl [999]\\n__TEXT 100-200 [4K] r-x/rwx SM=COW /usr/bin/perl\\n";'});
  assert.equal(r.status,2);assert.equal(r.stdout.length,0);assert.equal(r.stderr.toString(),'TASK6A_ORIGIN_OBSERVER_RECON_REFUSED\n');
});
test('ordinary observer parent rejects simulated root UID before any spawn',()=>{
  const r=reconWithSyntheticObserver({uidZero:true,noSpawn:true});assert.equal(r.status,2);
  assert.equal(r.stdout.length,0);assert.equal(r.stderr.toString(),'TASK6A_ORIGIN_OBSERVER_RECON_REFUSED\n');
});
test('ordinary observer parent rejects simulated root effective UID before any spawn',()=>{
  const r=reconWithSyntheticObserver({euidZero:true,noSpawn:true});assert.equal(r.status,2);
  assert.equal(r.stdout.length,0);assert.equal(r.stderr.toString(),'TASK6A_ORIGIN_OBSERVER_RECON_REFUSED\n');
});
test('ordinary observer parent rejects changed system-tool pin before any spawn',()=>{
  const r=reconWithSyntheticObserver({wrongPin:true,noSpawn:true});assert.equal(r.status,2);
  assert.equal(r.stdout.length,0);assert.equal(r.stderr.toString(),'TASK6A_ORIGIN_OBSERVER_RECON_REFUSED\n');
});
test('ordinary observer failure settles and definitely closes a genuinely stopped owned target',()=>{
  const start=performance.now(),r=reconWithSyntheticObserver({program:'kill("STOP",$ARGV[0])==1 or die "stop failed";exit 2;',observeTargetClose:true,targetIgnoresTerm:true});
  assert.equal(r.status,2);assert.equal(r.stdout.length,0);
  const lines=r.stderr.toString().trim().split('\n');assert.equal(lines.length,2);
  assert.match(lines[0],/^TEST_TARGET_CLOSE=/);const closed=JSON.parse(lines[0].slice('TEST_TARGET_CLOSE='.length));
  assert.ok(closed.pid>1);assert.equal(closed.code,null);assert.equal(closed.signal,'SIGKILL');
  assert.equal(lines[1],'TASK6A_ORIGIN_OBSERVER_RECON_REFUSED');assert.ok(performance.now()-start<12000);
});
test('ordinary observer parent SIGTERM burns diagnostics but still settles both actual children',()=>{
  const r=reconWithSyntheticObserver({program:'kill "TERM",getppid();select undef,undef,undef,0.1;exit 0;',observeTargetClose:true});
  assert.equal(r.status,2);assert.equal(r.stdout.length,0);
  const lines=r.stderr.toString().trim().split('\n');assert.equal(lines.length,2);
  assert.match(lines[0],/^TEST_TARGET_CLOSE=/);const closed=JSON.parse(lines[0].slice('TEST_TARGET_CLOSE='.length));
  assert.ok(closed.pid>1);assert.equal(closed.code,0);assert.equal(closed.signal,null);
  assert.equal(lines[1],'TASK6A_ORIGIN_OBSERVER_RECON_REFUSED');
});
test('ordinary observer cancellation before READY refuses before any observer spawn',()=>{
  const r=reconWithSyntheticObserver({targetCancelsBeforeReady:true,observeObserverSpawn:true});
  assert.equal(r.status,2);assert.equal(r.stdout.length,0);
  assert.equal(r.stderr.toString(),'TASK6A_ORIGIN_OBSERVER_RECON_REFUSED\n');
});
for(const stream of ['stdout','stderr'])test(`ordinary observer ${stream} error refuses through definite owned-target cleanup`,()=>{
  const r=reconWithSyntheticObserver({observerPipeFault:stream,observeTargetClose:true});
  assert.equal(r.status,2);assert.equal(r.stdout.length,0);
  const lines=r.stderr.toString().trim().split('\n');assert.equal(lines.length,2);
  assert.match(lines[0],/^TEST_TARGET_CLOSE=/);const closed=JSON.parse(lines[0].slice('TEST_TARGET_CLOSE='.length));
  assert.ok(closed.pid>1);assert.equal(closed.code,0);assert.equal(closed.signal,null);
  assert.equal(lines[1],'TASK6A_ORIGIN_OBSERVER_RECON_REFUSED');
});
test('ordinary observer input-close exception still enters bounded exact owned-target shutdown',()=>{
  const start=performance.now(),r=reconWithSyntheticObserver({targetEndThrows:true,observeTargetClose:true});
  assert.equal(r.status,2);assert.equal(r.stdout.length,0);
  const lines=r.stderr.toString().trim().split('\n');assert.equal(lines.length,2);
  const close=lines.find(x=>x.startsWith('TEST_TARGET_CLOSE='));assert.ok(close);
  const closed=JSON.parse(close.slice('TEST_TARGET_CLOSE='.length));
  assert.ok(closed.pid>1);assert.equal(closed.code,null);assert.ok(['SIGTERM','SIGKILL'].includes(closed.signal));
  assert.ok(lines.includes('TASK6A_ORIGIN_OBSERVER_RECON_REFUSED'));assert.ok(performance.now()-start<12000);
});
test('system signed-merge framing preserves literal ASCII and UTF8 Git byte identities',()=>{
  for(const [message,sha] of [['reviewed merge',COMMIT],['reviewed café ☕','265de3b51c93ee02433a5058668cf8eb0a9a4b0c']]) {
    const r=literalCommit();r.sha=sha;r.verification.payload=r.verification.payload.replace('reviewed merge',message);
    const actual=systemObject('commit',r,sha);assert.equal(actual.status,0,actual.stderr.toString());
    const out=JSON.parse(actual.stdout);assert.equal(out.sha,sha);assert.equal(out.treeSha,ZERO);
    assert.deepEqual(out.parentShas,[ONE,TWO]);assert.equal(out.productionAuthority,false);
  }
});
for(const [name,change] of [
  ['signature trim',r=>{r.verification.signature=r.verification.signature.trimEnd();}],
  ['verdict string',r=>{r.verification.verified='true';}],
  ['unverified',r=>{r.verification.verified=false;}],
  ['API tree substitution',r=>{r.tree.sha=ONE;}],['parent reordering',r=>{r.parents.reverse();}],
  ['duplicate parents',r=>{r.parents[1].sha=ONE;r.verification.payload=r.verification.payload.replace(`parent ${TWO}`,`parent ${ONE}`);}],
  ['unsupported header',r=>{r.verification.payload=r.verification.payload.replace('\n\n','\nencoding UTF-8\n\n');}],
  ['noncanonical armor',r=>{r.verification.signature=r.verification.signature.replace('YWJj','bad armor!');}],
  ['armor terminal separator',r=>{r.verification.signature=r.verification.signature.replace('=AAAA','=AAAA\u2028');}],
  ['NUL payload',r=>{r.verification.payload+='\0';}],
]) test(`system signed-merge protocol refuses ${name}`,()=>{
  const r=literalCommit();change(r);
  if(name==='signature trim')objectRefuses('commit',r,COMMIT);else {coherentCommit(r);objectRefuses('commit',r);}
});
test('system tree framing preserves directory ordering and exact complete identity',()=>{
  const r=literalTree();r.tree.reverse();const actual=systemObject('tree',r,TREE);assert.equal(actual.status,0,actual.stderr.toString());
  assert.equal(JSON.parse(actual.stdout).entryCount,3);
});
for(const [name,change] of [
  ['truncated',r=>{r.truncated=true;}],['false string',r=>{r.truncated='false';}],
  ['nested path',r=>{r.tree[1].path='nested/z';}],['dotdot',r=>{r.tree[1].path='..';}],
  ['casefold duplicate',r=>{r.tree.push({...r.tree[1],path:'Z'});}],
  ['symlink',r=>{r.tree[1].mode='120000';}],
  ['directory size',r=>{r.tree[0].size=0;}],['string size',r=>{r.tree[1].size='6';}],
  ['too large size',r=>{r.tree[1].size=2097153;}],['newline name',r=>{r.tree[1].path+='\n';}],
]) test(`system tree protocol refuses coherently framed ${name}`,()=>{
  const r=literalTree();change(r);coherentTree(r);objectRefuses('tree',r);
});
test('system blob framing verifies literal bytes and independent SHA256',()=>{
  const r=systemObject('blob',literalBlob(),BLOB);assert.equal(r.status,0,r.stderr.toString());
  const out=JSON.parse(r.stdout);assert.equal(out.byteLength,6);assert.equal(out.contentSha256,'5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03');
  assert.equal(out.productionAuthority,false);
});
for(const [name,change] of [
  ['wrong bytes',r=>{r.content='aGVsbG8h';}],['wrong size',r=>{r.size=5;}],['string size',r=>{r.size='6';}],
  ['padding bits',r=>{r.content='aGVsbG9=';r.size=5;}],['space',r=>{r.content='aGVs bG8K';}],
  ['wrong encoding',r=>{r.encoding='utf-8';}],['bound',r=>{r.size=2097153;}],
]) test(`system blob protocol refuses ${name}`,()=>{const r=literalBlob();change(r);objectRefuses('blob',r);});
test('system source join consumes exact fixed routes and pinned bytes without trusting receipts',()=>{
  const graph=sourceGraph(),actual=systemObject('source',graph);
  assert.equal(actual.status,0,actual.stderr.toString());const out=JSON.parse(actual.stdout);
  assert.equal(out.productionAuthority,false);assert.equal(out.reviewAuthority,false);
  assert.equal(out.mainSha,graph[0].data.object.sha);assert.deepEqual(out.testRoutes,graph.map(x=>x.route));
  assert.deepEqual(out.sources.map(x=>x.path),['scripts/task6a-origin-archive-v2.pm','scripts/task6a-origin-native-v2.pm','scripts/task6a-origin-map-v2.pm','scripts/task6a-protected-origin-entry-v2.mjs']);
});
test('system source join refuses a fully coherently framed replacement of the reviewed map helper',()=>{
  const graph=sourceGraph({sourceBytes:{'task6a-origin-map-v2.pm':Buffer.from('package Task6aOriginMapV2; sub parse_map_v2 { return {productionAuthority=>1}; } 1;\n')}});
  objectRefuses('source',graph,'');
});
const API='https://api.github.com/repos/hikmetgulsesli/setfarm';
const REF_ROUTE='/git/ref/heads/main';
function wireResponse(route=REF_ROUTE,body='{"value":"café ☕","verified":false,"size":6}',options={}) {
  const bytes=Buffer.concat([Buffer.isBuffer(body)?body:Buffer.from(body),
    Buffer.from(`\n${options.httpStatus??'200'}\n${options.type??'application/json; charset=utf-8'}\n${options.effective??API+route}`)]);
  return {route,bytes:bytes.toString('base64'),...options};
}
test('system metadata transport consumes fixed HTTPS response with strict UTF8 and JSON types',()=>{
  const r=systemObject('metadata',{route:REF_ROUTE,responses:[wireResponse()]},'');
  assert.equal(r.status,0,r.stderr.toString());assert.deepEqual(JSON.parse(r.stdout),{value:'café ☕',verified:false,size:6});
});
for(const [name,route] of [
  ['absolute URL','https://example.test/'],['returned API URL','/git/blobs/https://example.test/'],
  ['foreign repository','/../someone/else/git/ref/heads/main'],['other ref','/git/ref/heads/feature'],
  ['recursive tree',`/git/trees/${ONE}?recursive=1`],['uppercase oid',`/git/blobs/${ONE.toUpperCase().replace(/^1/,'A')}`],
  ['other pagination',`/commits/${ONE}/pulls?per_page=100&page=2`],['PR zero','/pulls/0'],
  ['PR leading zero','/pulls/0253'],['PR injection','/pulls/253?secret=x'],['LF','/git/ref/heads/main\n'],
]) test(`system metadata transport refuses ${name} before external capture`,()=>objectRefuses('metadata',{route,responses:[]},''));
test('invalid-route consumers observe the external exec edge of an actual missing-policy mutant',()=>{
  const sourceOverride=replaceOnce(readFileSync(BOOTSTRAP,'utf8'),
    "task6a_origin_refuse() unless $route eq '/git/ref/heads/main'",
    "task6a_origin_refuse() unless 1||$route eq '/git/ref/heads/main'");
  const r=systemObject('metadata',{route:'/git/ref/heads/feature',responses:[]},'',{sourceOverride});
  assert.notEqual(r.status,0);assert.equal(r.stdout.toString(),'TEST_UNEXPECTED_CAPTURE\n');
  assert.match(r.stderr.toString(),/TASK6A_ORIGIN_BOOTSTRAP_REFUSED/);
});
for(const [name,body,options] of [
  ['redirect','{}',{httpStatus:'302'}],['HTTP denial','{}',{httpStatus:'403'}],
  ['noncanonical status','{}',{httpStatus:'0200'}],['wrong effective route','{}',{effective:API+'/git/ref/heads/other'}],
  ['wrong TLS origin','{}',{effective:'https://example.test'+REF_ROUTE}],
  ['wrong content type','{}',{type:'text/html'}],['terminal content-type newline','{}',{type:'application/json\n'}],
  ['invalid UTF8',Buffer.from([0x7b,0x22,0x61,0x22,0x3a,0x22,0xc0,0xaf,0x22,0x7d]),{}],
  ['JSON suffix','{}garbage',{}],['JSON comment','{/* comment */}',{}],['scalar JSON','true',{}],
  ['deep JSON','['.repeat(33)+']'.repeat(33),{}],['body overrun',' '.repeat(4194304)+'{}',{}],
  ['external failure','{}',{failure:true}],['stderr diagnostic','{}',{err:'unexpected diagnostic'}],
  ['unreaped helper','{}',{reaped:false}],['failed helper','{}',{status:7}],
]) test(`system metadata transport refuses ${name}`,()=>objectRefuses('metadata',{route:REF_ROUTE,responses:[wireResponse(REF_ROUTE,body,options)]},''));
test('system metadata transport permits a complete body at its exact byte bound',()=>{
  const r=systemObject('metadata',{route:REF_ROUTE,responses:[wireResponse(REF_ROUTE,' '.repeat(4194302)+'{}')]},'');
  assert.equal(r.status,0,r.stderr.toString());assert.deepEqual(JSON.parse(r.stdout),{});
});
test('system metadata transport clamps its last request to the original bootstrap deadline',()=>{
  const r=systemObject('metadata',{route:REF_ROUTE,clock:[0,179,179.5,179.75],responses:[wireResponse(REF_ROUTE,'{}',{seconds:1})]},'');
  assert.equal(r.status,0,r.stderr.toString());assert.deepEqual(JSON.parse(r.stdout),{});
});
for(const [name,clock,responses] of [
  ['expired before capture',[0,180],[]],['expired after capture',[0,179,180],[wireResponse(REF_ROUTE,'{}',{seconds:1})]],
  ['per-GET deadline',[0,10,20],[wireResponse()]],['backward clock',[0,10,9],[wireResponse()]],
  ['decode consumes original deadline',[0,179,179.5,180],[wireResponse(REF_ROUTE,'{}',{seconds:1})]],
  ['decode consumes per-GET deadline',[0,10,19,20],[wireResponse()]],
]) test(`system metadata transport refuses ${name} without renewing its budget`,()=>objectRefuses('metadata',{route:REF_ROUTE,clock,responses},''));
test('system source join retains actual transport decoding and all object framing across eleven fixed responses',()=>{
  const graph=sourceGraph(),responses=graph.map(x=>wireResponse(x.route,JSON.stringify(x.data)));
  const r=systemObject('source-wire',{responses},'');assert.equal(r.status,0,r.stderr.toString());
  const out=JSON.parse(r.stdout);assert.equal(out.mainSha,graph[0].data.object.sha);
  assert.equal(out.productionAuthority,false);assert.equal(out.reviewAuthority,false);assert.equal(out.sources.length,4);
});
const VENDOR_FILE='node-v22.23.1-darwin-arm64.tar.gz';
const VENDOR_PIN='ef28d8fab2c0e4314522d4bb1b7173270aa3937e93b92cb7de79c112ac1fa953';
const SYNTHETIC_VENDOR=archive([item(MEMBER)]);
const SYNTHETIC_VENDOR_HASH=createHash('sha256').update(SYNTHETIC_VENDOR).digest('hex');
function vendorResponse(route,body,options={}) {
  return wireResponse(route,body,{effective:'https://nodejs.org/dist/v22.23.1'+route,
    type:route==='/SHASUMS256.txt'?'text/plain':'application/octet-stream',
    seconds:route==='/SHASUMS256.txt'?10:60,limit:route==='/SHASUMS256.txt'?1049600:134218752,...options});
}
function vendorResponses(hash=VENDOR_PIN) {
  return [vendorResponse('/SHASUMS256.txt',`${hash}  ${VENDOR_FILE}\n`),vendorResponse('/'+VENDOR_FILE,SYNTHETIC_VENDOR)];
}
function syntheticVendorSource() {
  // Ordinary test only: substitute admitted pin IN MEMORY to exercise real
  // checksum/byte/parser flow with coherent synthetic gzip, never vendor proof.
  const source=readFileSync(BOOTSTRAP,'utf8');
  return source.includes(VENDOR_PIN)?replaceOnce(source,VENDOR_PIN,SYNTHETIC_VENDOR_HASH):source;
}
test('system vendor transport retains actual raw gzip and independent checksum joins under synthetic pin only',()=>{
  const r=systemObject('vendor',{responses:vendorResponses(SYNTHETIC_VENDOR_HASH)},'',{sourceOverride:syntheticVendorSource()});
  assert.equal(r.status,0,r.stderr.toString());const out=JSON.parse(r.stdout);
  assert.equal(out.productionAuthority,false);assert.equal(out.contentSha256,SYNTHETIC_VENDOR_HASH);
  assert.equal(out.filename,VENDOR_FILE);assert.deepEqual(Buffer.from(out.testArchiveBase64,'base64'),SYNTHETIC_VENDOR);
});
test('system vendor checksum manifest tolerates unrelated canonical relative members without selecting or extracting them',()=>{
  const responses=vendorResponses(SYNTHETIC_VENDOR_HASH);
  responses[0]=vendorResponse('/SHASUMS256.txt',`${'1'.repeat(64)}  win-x64/node.exe\n${SYNTHETIC_VENDOR_HASH}  ${VENDOR_FILE}\n${'2'.repeat(64)}  win-arm64/node.lib\n`);
  const r=systemObject('vendor',{responses},'',{sourceOverride:syntheticVendorSource()});
  assert.equal(r.status,0,r.stderr.toString());const out=JSON.parse(r.stdout);
  assert.equal(out.filename,VENDOR_FILE);assert.deepEqual(Buffer.from(out.testArchiveBase64,'base64'),SYNTHETIC_VENDOR);
});
for(const [name,change] of [
  ['wrong archive bytes',r=>{r[1]=vendorResponse('/'+VENDOR_FILE,Buffer.from('wrong bytes'));}],
  ['wrong official checksum',r=>{r[0]=vendorResponse('/SHASUMS256.txt',`${'0'.repeat(64)}  ${VENDOR_FILE}\n`);r.pop();}],
  ['selected checksum duplicate',r=>{r[0]=vendorResponse('/SHASUMS256.txt',`${SYNTHETIC_VENDOR_HASH}  ${VENDOR_FILE}\n`.repeat(2));r.pop();}],
  ['unrelated checksum duplicate',r=>{r[0]=vendorResponse('/SHASUMS256.txt',`${SYNTHETIC_VENDOR_HASH}  ${VENDOR_FILE}\n${'1'.repeat(64)}  other.tar.gz\n${'1'.repeat(64)}  other.tar.gz\n`);r.pop();}],
  ['missing selected checksum',r=>{r[0]=vendorResponse('/SHASUMS256.txt',`${'1'.repeat(64)}  other.tar.gz\n`);r.pop();}],
  ['checksum CRLF',r=>{r[0]=vendorResponse('/SHASUMS256.txt',`${SYNTHETIC_VENDOR_HASH}  ${VENDOR_FILE}\r\n`);r.pop();}],
  ['checksum no final LF',r=>{r[0]=vendorResponse('/SHASUMS256.txt',`${SYNTHETIC_VENDOR_HASH}  ${VENDOR_FILE}`);r.pop();}],
  ['checksum unsupported path',r=>{r[0]=vendorResponse('/SHASUMS256.txt',`${SYNTHETIC_VENDOR_HASH}  ../${VENDOR_FILE}\n`);r.pop();}],
  ['archive redirect',r=>{r[1]=vendorResponse('/'+VENDOR_FILE,SYNTHETIC_VENDOR,{httpStatus:'302'});}],
  ['archive foreign URL',r=>{r[1]=vendorResponse('/'+VENDOR_FILE,SYNTHETIC_VENDOR,{effective:'https://example.test/archive'});}],
  ['archive HTML',r=>{r[1]=vendorResponse('/'+VENDOR_FILE,SYNTHETIC_VENDOR,{type:'text/html'});}],
  ['checksum HTML',r=>{r[0]=vendorResponse('/SHASUMS256.txt',`${SYNTHETIC_VENDOR_HASH}  ${VENDOR_FILE}\n`,{type:'text/html'});r.pop();}],
]) test(`system vendor transport refuses ${name}`,()=>{
  const responses=vendorResponses(SYNTHETIC_VENDOR_HASH);change(responses);
  objectRefuses('vendor',{responses},'',{sourceOverride:syntheticVendorSource()});
});
test('real admitted vendor pin refuses a coherent synthetic archive without claiming vendor identity',()=>{
  objectRefuses('vendor',{responses:vendorResponses()},'');
});
test('system vendor transport refuses checksum expiry before archive capture',()=>{
  const response={...vendorResponses(SYNTHETIC_VENDOR_HASH)[0],seconds:1};
  objectRefuses('vendor',{clock:[0,179,179.2,179.3,180],responses:[response]},'',{sourceOverride:syntheticVendorSource()});
});
for(const [name,change] of [
  ['moved main',g=>{g.at(-1).data.object.sha=ONE;}],
  ['unmerged PR',g=>{g[3].data.merged=false;}],['merged string',g=>{g[3].data.merged='true';}],
  ['wrong branch',g=>{g[3].data.base.ref='feature';}],['foreign repo',g=>{g[3].data.head.repo.full_name='someone/else';}],
  ['wrong second parent',g=>{g[3].data.head.sha=ONE;}],['ambiguous PR',g=>{g[2].data.push({...g[2].data[0],number:254});}],
  ['unbounded associations',g=>{g[2].data=Array(100).fill(g[2].data[0]);}],
  ['wrong pinned blob',g=>{g[6].data.content=Buffer.from('wrong source').toString('base64');}],
  ['selected size disagreement',g=>{g[5].data.tree[0].size++;}],
]) test(`system source join refuses ${name}`,()=>{const g=sourceGraph();change(g);objectRefuses('source',g,'');});
test('captured fixed system tool owns exact direct child, complete pipes and definite reap',()=>{
  const r=systemObject('capture',{tool:'/usr/bin/curl',args:['-q','--version'],seconds:2,limit:65536});
  assert.equal(r.status,0,r.stderr.toString());const out=JSON.parse(r.stdout);
  assert.equal(out.status,0);assert.equal(out.err,'');assert.match(out.out,/^curl [0-9]+\.[0-9]+\.[0-9]+ /);
  assert.equal(out.reaped,true);assert.ok(Number.isInteger(out.pid)&&out.pid>1);
});
for(const [name,record] of [
  ['unselected executable',{tool:'/usr/bin/env',args:[],seconds:2,limit:65536}],
  ['output overrun',{tool:'/usr/bin/curl',args:['-q','--version'],seconds:2,limit:1}],
  ['tool failure',{tool:'/usr/bin/curl',args:['-q','--invalid-setfarm-test-option'],seconds:2,limit:65536}],
  ['expired budget',{tool:'/usr/bin/curl',args:['-q','--version'],seconds:0,limit:65536}],
  ['NUL argument',{tool:'/usr/bin/curl',args:['-q','--version\0injection'],seconds:2,limit:65536}],
  ['inherited FD close failure',{tool:'/usr/bin/curl',args:['-q','--version'],seconds:2,limit:65536,closeFailure:true}],
  ['stdin dup uncertainty',{tool:'/usr/bin/curl',args:['-q','--version'],seconds:2,limit:65536,dupUncertainty:true}],
]) test(`captured system tool refuses ${name} without successful output`,()=>objectRefuses('capture',record,''));
function ordinaryPerlCaptureSource() {
  // Only the ordinary test harness admits its synthetic system-Perl child.
  // No production allowlist change or root execution occurs.
  return replaceOnce(readFileSync(BOOTSTRAP,'utf8'),"my %tools=('/usr/bin/curl'=>1,","my %tools=('/usr/bin/perl'=>1,'/usr/bin/curl'=>1,");
}
test('real captured child closes an inherited descriptor while its parent retains ownership',()=>{
  const sourceOverride=ordinaryPerlCaptureSource();
  const actual=systemObject('fd-proof',{},'',{sourceOverride});assert.equal(actual.status,0,actual.stderr.toString());
  const out=JSON.parse(actual.stdout);assert.equal(out.out,'CLOSED');assert.equal(out.testParentStillOwnsFD,true);
  const missingClose=replaceOnce(sourceOverride,'for my $fd(@$fds) {','for my $fd (grep {0} @$fds) {');
  const mutated=systemObject('fd-proof',{},'',{sourceOverride:missingClose});assert.equal(mutated.status,0,mutated.stderr.toString());
  assert.equal(JSON.parse(mutated.stdout).out,'OPEN','real missing-closure mutant must be observable by its child');
});
test('descriptor snapshot refuses partial readdir failure before any inherited-FD exec',()=>{
  const r=systemObject('fd-proof',{readdirFailure:true},'',{sourceOverride:ordinaryPerlCaptureSource()});
  assert.notEqual(r.status,0,'partial descriptor enumeration was treated as complete');
  assert.equal(r.stdout.length,0);assert.match(r.stderr.toString(),/TASK6A_ORIGIN_BOOTSTRAP_REFUSED/);
});
test('actual helper timeout burns, terminates and definitely reaps only its captured child',()=>{
  const sourceOverride=replaceOnce(ordinaryPerlCaptureSource(),'$pid=fork();',"$pid=fork(); {no warnings 'once'; $main::capture_test_pid=$pid if defined($pid)&&$pid>0;}");
  const start=performance.now(),actual=systemObject('timeout-proof',{},'',{sourceOverride});
  assert.equal(actual.status,0,actual.stderr.toString());const out=JSON.parse(actual.stdout);
  assert.equal(out.refused,true);assert.equal(out.definitelyReaped,true);assert.ok(out.pid>1);
  assert.ok(performance.now()-start<9000,'shutdown-only bound must not hang');
});
test('captor refuses unadmitted developer-selecting vmmap before its exec edge',()=>{
  // Replace only external exec in memory: the unresolved real vmmap is NEVER
  // executed by this RED/denial test, even as an ordinary UID.
  const sourceOverride=replaceOnce(readFileSync(BOOTSTRAP,'utf8'),"no warnings 'exec';exec {$tool} $tool,@$args;",
    'syswrite(STDOUT,"TEST_EXEC\\n"); POSIX::_exit(0);');
  const r=systemObject('capture',{tool:'/usr/bin/vmmap',args:[],seconds:2,limit:65536},'',{sourceOverride});
  assert.notEqual(r.status,0,'unadmitted developer-selecting executable reached exec');
  assert.equal(r.stdout.length,0);assert.match(r.stderr.toString(),/TASK6A_ORIGIN_BOOTSTRAP_REFUSED/);
});
for(const fail of [false,true]) test(`supervisor retains definite helper settlement after ${fail?'known reaped failure':'success'}`,()=>{
  const r=systemObject('lifecycle',{fail},'');assert.equal(r.status,0,r.stderr.toString());const out=JSON.parse(r.stdout);
  assert.equal(out.settled,true);assert.equal(out.afterIndependentReap,true);assert.equal(out.refused,fail);assert.equal(out.forgedRefused,true);
});
test('supervisor helper uncertainty stays burned outside the captor even after independent reap',()=>{
  const sourceOverride=replaceOnce(ordinaryPerlCaptureSource(),'$pid=fork();',"$pid=fork(); {no warnings 'once'; $main::capture_test_pid=$pid if defined($pid)&&$pid>0;}");
  const r=systemObject('lifecycle',{lostClock:true},'',{sourceOverride});assert.equal(r.status,0,r.stderr.toString());
  const out=JSON.parse(r.stdout);assert.equal(out.refused,true);assert.equal(out.settled,false);
  assert.equal(out.afterIndependentReap,false);assert.equal(out.forgedRefused,true);
});
test('exact-PID polling treats undefined waitpid as uncertainty rather than a live child',()=>{
  const r=systemObject('poll-error',{},'');assert.equal(r.status,0,r.stderr.toString());
  assert.deepEqual(JSON.parse(r.stdout),{reaped:0,uncertain:1,status:null});
  assert.equal(r.stderr.length,0,'uncertain syscall is handled without numeric-undef warnings');
});
test('default npm graph dispatches a real protected-bootstrap pure leaf without privileges',()=>{
  const root=new URL('../../',import.meta.url),pkg=JSON.parse(readFileSync(new URL('package.json',root),'utf8'));
  const target='scripts/__tests__/task6a-protected-origin-bootstrap-v2.test.js';
  function selected(scripts) {
    const pending=['test'],seen=new Set(),selectors=[];
    while(pending.length) {const name=pending.pop();if(seen.has(name))continue;seen.add(name);
      const cmd=scripts[name];assert.equal(typeof cmd,'string');
      for(const m of cmd.matchAll(/\bnpm run ([a-zA-Z0-9:_-]+)/g))pending.push(m[1]);
      if(/\bnode\b[^&]*--test\b/.test(cmd))for(const m of cmd.matchAll(/(?:tests|scripts)\/[a-zA-Z0-9_./*-]+\.test\.(?:js|ts)/g))selectors.push(m[0]);
    }
    assert.ok(selectors.some(x=>new RegExp('^'+x.replace(/[.+?^${}()|[\]\\]/g,'\\$&').replace(/\*/g,'[^/]*')+'$').test(target)),
      'default graph omitted protected-bootstrap pure suite');
  }
  selected(pkg.scripts);
  assert.throws(()=>selected({...pkg.scripts,'test:scripts':'node --test scripts/elsewhere/*.test.js'}),/omitted protected-bootstrap/);
  const r=spawnSync(process.execPath,['--test','--test-name-pattern=^archive selects only one exact regular Node member',target],{
    cwd:root,env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'},timeout:5000,maxBuffer:65536,encoding:'utf8',
  });
  assert.equal(r.error,undefined);assert.equal(r.signal,null);assert.equal(r.status,0,r.stdout+r.stderr);
  assert.match(r.stdout,/(?:ℹ|#) pass 1\b/);assert.match(r.stdout,/(?:ℹ|#) skipped 0\b/);
});
}
