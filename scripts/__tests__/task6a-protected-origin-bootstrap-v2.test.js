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
  // Memory-copy Perl is literal bytes: JS replacement tokens such as $$ must
  // not silently turn scalar-reference dereferences into truthy references.
  return source.replace(from,()=>to);
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
const PARENT_PORT_PROGRAM=String.raw`
    if($q->{kind} eq 'parent-ports'||$q->{kind} eq 'parent-protocol') {
      require Fcntl; require IO::Select; require POSIX; require Time::HiRes; require B;
      require Digest::SHA; require Encode; require Errno;
      my $fault='';my @owned;my %roles;my @events;my @queue;my $out;
      my $protocol=$q->{kind} eq 'parent-protocol';my %queues;
      my $fcntl_calls=0;my (%read_ordinals,%stat_ordinals);my $lstat_ordinal=0;
      my $fail=sub {$fault='TEST_PARENT_PORT_HARNESS_FAULT';die "$fault\n";};
      my $check=sub {die "$fault\n" if length($fault);};
      my $event=sub {
        if(@events>=($protocol?512:64)) {$fault='TEST_PARENT_PORT_HARNESS_FAULT';return 0;}
        push @events,{seq=>1+@events,@_};return 1;
      };
      my $register_pair=sub {
        my ($a,$an,$b,$bn)=@_;
        my $ra={fh=>$a,role=>$an,attempted=>0,closed=>0};
        my $rb={fh=>$b,role=>$bn,attempted=>0,closed=>0};
        # Own BOTH successful acquisitions before any fallible inspection.
        push @owned,$ra,$rb;$roles{$an}=$ra;$roles{$bn}=$rb;
        for my $r($ra,$rb) {
          $fail->() unless defined($r->{fh})&&defined(fileno($r->{fh}));
          $r->{fd}=fileno($r->{fh});
          for my $other(@owned) {
            next if $other==$r;
            $fail->() if $other->{fh}==$r->{fh};
          }
        }
      };
      my $identify=sub {
        my ($fh)=@_;$fail->() unless defined($fh)&&ref($fh);
        for my $r(@owned) {
          if($fh==$r->{fh}) {$fail->() if $r->{closed}||!defined(fileno($fh))||fileno($fh)!=$r->{fd};return $r;}
        }
        $fail->();
      };
      my $core_close=sub {
        my ($r)=@_;$fail->() if $r->{attempted}||$r->{closed};
        $r->{attempted}=1;$event->(op=>'close-attempt',role=>$r->{role});
        $!=0;my $ok=CORE::close($r->{fh});my $error=0+$!;
        $r->{closed}=1 if $ok&&!defined(fileno($r->{fh}));
        $event->(op=>'close-result',role=>$r->{role},result=>$ok?1:0,definite=>$r->{closed},errno=>$error);
        return $ok;
      };
      my $next=sub {
        my ($op,$role)=@_;my $selected=$protocol?$queues{$op.':'.$role}:\@queue;
        $fail->() unless ref($selected) eq 'ARRAY'&&@$selected;
        my $e=shift @$selected;$fail->() unless $e->{op} eq $op&&$e->{role} eq $role;
        return $e;
      };
      my $binding;
      my $stable=sub {
        my ($fh)=@_;my @s=CORE::stat($fh);$fail->() unless @s==13;
        for my $field(0..6) {$fail->() unless defined($s[$field])&&!ref($s[$field]);}
        return [@s[0..6]];
      };
      my $same_stable=sub {
        my ($a,$b)=@_;$fail->() unless ref($a) eq 'ARRAY'&&ref($b) eq 'ARRAY'&&@$a==7&&@$b==7;
        for my $field(0..6) {return 0 unless $a->[$field]==$b->[$field];}return 1;
      };
      my $prepare_binding=sub {
        $fail->() if defined($binding);my $original=$roles{input};
        my $old=$stable->($original->{fh});
        CORE::open(my $hold,'>&',$original->{fh}) or $fail->();
        my $h={fh=>$hold,role=>'input-hold',attempted=>0,closed=>0};
        push @owned,$h;$roles{'input-hold'}=$h;
        # The successful duplicate is owned before inspecting it.
        $h->{fd}=fileno($hold);$fail->() unless defined($h->{fd})&&$h->{fd}!=$original->{fd}
          &&$hold!=$original->{fh}&&$same_stable->($old,$stable->($hold));
        CORE::pipe(my $r,my $w) or $fail->();
        $register_pair->($w,'replacement',$r,'replacement-peer');
        my $source=$roles{replacement};my $replacement=$stable->($source->{fh});
        $fail->() if $same_stable->($old,$replacement);
        my $dup='POSIX'->can('dup2');$fail->() unless defined($dup)&&ref($dup) eq 'CODE';
        $binding={original=>$original->{fh},originalFd=>$original->{fd},oldIdentity=>$old,
          source=>$source->{fh},sourceFd=>$source->{fd},sourceIdentity=>$replacement,
          hold=>$hold,holdFd=>$h->{fd},dup=>$dup,prototype=>prototype($dup),attempted=>0};
      };
      my $execute_binding=sub {
        $fail->() unless defined($binding)&&!$binding->{attempted};
        my $original=$identify->($binding->{original});my $source=$identify->($binding->{source});
        $identify->($binding->{hold});
        $fail->() unless $original->{role} eq 'input'&&$source->{role} eq 'replacement'
          &&$same_stable->($binding->{oldIdentity},$stable->($binding->{original}))
          &&$same_stable->($binding->{sourceIdentity},$stable->($binding->{source}));
        $binding->{attempted}=1;$!=0;
        my $returned=$binding->{dup}->($binding->{sourceFd},$binding->{originalFd});my $errno=0+$!;
        $fail->() unless defined($returned)&&$errno==0
          &&fileno($binding->{original})==$binding->{originalFd}
          &&$same_stable->($binding->{sourceIdentity},$stable->($binding->{original}))
          &&$same_stable->($binding->{oldIdentity},$stable->($binding->{hold}));
        $event->(op=>'fd-rebinding-witness',role=>'input',originalFd=>$binding->{originalFd},
          currentFd=>fileno($binding->{original}),sourceFd=>$binding->{sourceFd},holdFd=>$binding->{holdFd},
          actualReturn=>$returned,prototype=>$binding->{prototype},errno=>$errno,
          oldIdentity=>$binding->{oldIdentity},currentIdentity=>$stable->($binding->{original}),
          sourceIdentity=>$stable->($binding->{source}),holdIdentity=>$stable->($binding->{hold}));
      };
      my $surviving_binding=sub {
        $fail->() unless defined($binding)&&$binding->{attempted};
        my $hold=$identify->($binding->{hold});my $source=$identify->($binding->{source});
        $fail->() unless $hold->{fd}==$binding->{holdFd}&&$source->{fd}==$binding->{sourceFd}
          &&!$hold->{attempted}&&!$source->{attempted}
          &&$same_stable->($binding->{oldIdentity},$stable->($binding->{hold}))
          &&$same_stable->($binding->{sourceIdentity},$stable->($binding->{source}));
        $event->(op=>'fd-rebinding-survival',role=>'fixture',holdOpen=>JSON::PP::true,sourceOpen=>JSON::PP::true,
          holdIdentity=>$stable->($binding->{hold}),sourceIdentity=>$stable->($binding->{source}));
      };
      my $shape_tuple=sub {
        my ($tuple,$e,$role)=@_;return unless exists($e->{shape});
        $fail->() unless $protocol&&ref($tuple) eq 'ARRAY'&&@$tuple==13&&($e->{shape}==12||$e->{shape}==14);
        $e->{shape}==12?pop(@$tuple):push(@$tuple,0);
        $event->(op=>'stat-shape-nomination',role=>$role,seam=>$e->{seam},capturedFields=>13,
          returnedFields=>scalar(@$tuple),capturedSynthetic=>$role eq 'entropy'?JSON::PP::true:JSON::PP::false,
          syntheticResponse=>JSON::PP::true);
      };
      my %handlers;
      my @entropy_identity=(11,22,0020666,1,0,0,33,0,0,0,0,4096,0);
      $handlers{stat}=sub {
        $fail->() unless wantarray&&@_==1;
        my $r=$identify->($_[0]);my $e=$next->('stat',$r->{role});my $ordinal=++$stat_ordinals{$r->{role}};
        my @tuple=$r->{role} eq 'entropy'?@entropy_identity:CORE::stat($_[0]);
        $fail->() unless @tuple==13;
        if(exists($e->{drift_field})) {
          my $field=$e->{drift_field};$fail->() unless $protocol&&$r->{role}=~/\A(?:input|stdout|stderr|setup)\z/
            &&$ordinal==2&&$field>=0&&$field<=6&&$field==int($field);
          my $actual=$tuple[$field];$tuple[$field]=$actual+1;
          $event->(op=>'stat-nomination',role=>$r->{role},ordinal=>$ordinal,field=>$field,
            actual=>$actual,returned=>$tuple[$field]);
        }
        if(exists($e->{entropy_field})) {
          my $field=$e->{entropy_field};$fail->() unless $protocol&&$r->{role} eq 'entropy'
            &&$ordinal==$e->{ordinal}&&($ordinal==1||$ordinal==4)&&$field>=0&&$field<=6;
          my $baseline=$tuple[$field];$tuple[$field]=$baseline+1;
          $event->(op=>'entropy-identity-nomination',role=>'entropy',seam=>$e->{seam},ordinal=>$ordinal,
            field=>$field,baseline=>$baseline,returned=>$tuple[$field]);
        }
        $shape_tuple->(\@tuple,$e,$r->{role});
        $event->(op=>'stat',role=>$r->{role},fields=>scalar(@tuple));return @tuple;
      };
      $handlers{lstat}=sub {
        $fail->() unless wantarray&&@_==1&&!ref($_[0])&&$_[0] eq '/dev/urandom';
        my $e=$next->('lstat','entropy');my $ordinal=++$lstat_ordinal;my @tuple=@entropy_identity;
        if(exists($e->{entropy_field})) {
          my $field=$e->{entropy_field};$fail->() unless $protocol&&$ordinal==$e->{ordinal}
            &&($ordinal==1||$ordinal==2)&&$field>=0&&$field<=6;
          my $baseline=$tuple[$field];$tuple[$field]=exists($e->{value})?$e->{value}:$baseline+1;
          $event->(op=>'entropy-identity-nomination',role=>'entropy',seam=>$e->{seam},ordinal=>$ordinal,
            field=>$field,baseline=>$baseline,returned=>$tuple[$field]);
        }
        $shape_tuple->(\@tuple,$e,'entropy');
        $event->(op=>'lstat',role=>'entropy',fields=>scalar(@tuple));return @tuple;
      };
      my $wnohang_fn='POSIX'->can('WNOHANG');$fail->() unless defined($wnohang_fn);
      my $wnohang=$wnohang_fn->();
      $handlers{waitpid}=sub {
        $fail->() unless @_==2&&$_[0]==424242&&$_[1]==$wnohang;
        my $role=$protocol&&$roles{input}{closed}?'closed-input-child':'child';
        my $e=$next->('waitpid',$role);
        my $errno=$e->{errno}//0;$!=$errno;
        $event->(op=>'waitpid',role=>'child',pid=>$_[0],result=>$e->{got},status=>$e->{status},errno=>0+$!);
        # Recording must precede assignment: the caller sees this exact raw status.
        $?=$e->{status};return $e->{got};
      };
      $handlers{kill}=sub {
        $fail->() unless @_==2&&($_[0] eq 'TERM'||$_[0] eq 'KILL')&&$_[1]==424242;
        my $e=$next->('kill','child');$fail->() unless $_[0] eq $e->{signal};
        $event->(op=>'signal-attempt',role=>'child',signal=>$_[0],pid=>$_[1]);return $e->{result};
      };
      $handlers{sysopen}=sub {
        $fail->() unless @_==3&&!defined($_[0])&&$_[1] eq '/dev/urandom'
          &&$_[2]==(Fcntl::O_RDONLY()|Fcntl::O_NOFOLLOW()|Fcntl::O_NONBLOCK());
        my $e=$next->('sysopen','entropy');
        if(exists($e->{failure})) {
          $fail->() unless $protocol&&$e->{failure}=~/\A(?:false|throw|alias)\z/;
          $event->(op=>'entropy-open-nomination',role=>'entropy',outcome=>$e->{failure},actualAcquired=>JSON::PP::false);
          die "TEST_NOMINATED_PARENT_ENTROPY_OPEN_THROW\n" if $e->{failure} eq 'throw';
          if($e->{failure} eq 'alias') {$_[0]=$roles{input}{fh};return 1;}
          return 0;
        }
        CORE::pipe(my $r,my $w) or $fail->();
        $register_pair->($r,'entropy',$w,'entropy-peer');
        $_[0]=$r;
        CORE::binmode($r) or $fail->();CORE::binmode($w) or $fail->();
        if($protocol) {
          my $fl=CORE::fcntl($r,Fcntl::F_GETFL(),0);$fail->() unless defined($fl);
          CORE::fcntl($r,Fcntl::F_SETFL(),$fl|Fcntl::O_NONBLOCK()) or $fail->();
          my $bytes=exists($e->{fixture_bytes})?$e->{fixture_bytes}:("\x11"x32).("\x22"x32).("\x33"x32);
          $fail->() unless length($bytes)==31||length($bytes)==96;
          CORE::syswrite($w,$bytes,length($bytes))==length($bytes) or $fail->();
        }
        $event->(op=>'sysopen',role=>'entropy',fd=>fileno($r));return 1;
      };
      $handlers{sysread}=sub {
        $fail->() unless (@_==3||@_==4)&&ref($_[1]) eq 'SCALAR';
        my $r=$identify->($_[0]);my $e=$next->('sysread',$r->{role});
        $fail->() unless $_[2]==$e->{length}&&(@_==4?$_[3]:0)==($e->{offset}//0);
        my $ordinal=++$read_ordinals{$r->{role}};
        my $buffer_ref=$_[1];$!=0;
        if(exists($e->{entropy_failure})) {
          my $failure=$e->{entropy_failure};
          $fail->() unless $protocol&&$r->{role} eq 'entropy'&&$_[2]==32&&(@_==4?$_[3]:0)==0
            &&$$buffer_ref eq ''&&$ordinal==($failure eq 'duplicate'?2:1);
          if($failure=~/\A(?:undefined|throw|eintr|eagain)\z/) {
            my $errno=0;
            if($failure eq 'eintr'||$failure eq 'eagain') {
              my $fn='Errno'->can($failure eq 'eintr'?'EINTR':'EAGAIN');$fail->() unless defined($fn);$errno=$fn->();
            }
            $event->(op=>'entropy-read-nomination',role=>'entropy',ordinal=>$ordinal,outcome=>$failure,
              requestLength=>32,actualRead=>JSON::PP::false,errno=>$errno,bufferLength=>0);
            die "TEST_NOMINATED_PARENT_ENTROPY_READ_THROW\n" if $failure eq 'throw';
            $!=$errno;return undef;
          }
          $fail->() unless $failure=~/\A(?:31|33|duplicate|utf8|length)\z/;
        }
        if(exists($e->{failure})) {
          $fail->() unless $protocol&&$r->{role} eq 'stdout'&&$ordinal==2&&$_[2]==71
            &&(@_==4?$_[3]:0)==0&&$$buffer_ref eq ''&&$e->{bytes} eq 'PONG '.('1'x64)."\n";
          my $failure=$e->{failure};
          if($failure=~/\A(?:undefined|throw|eintr|eagain|error)\z/) {
            my $errno=0;
            if($failure ne 'undefined'&&$failure ne 'throw') {
              my %names=(eintr=>'EINTR',eagain=>'EAGAIN',error=>'EIO');
              my $fn='Errno'->can($names{$failure});$fail->() unless defined($fn);$errno=$fn->();
            }
            $event->(op=>'read-nomination',role=>'stdout',ordinal=>$ordinal,requestLength=>71,
              outcome=>$failure,actualRead=>JSON::PP::false,errno=>$errno,buffer=>$$buffer_ref);
            die "TEST_NOMINATED_PARENT_READ_THROW\n" if $failure eq 'throw';
            $!=$errno;return undef;
          }
          $fail->() unless $failure=~/\A(?:mismatch|over|negative|fraction|utf8)\z/;
        }
        my $n=@_==3?CORE::sysread($_[0],$$buffer_ref,$_[2]):CORE::sysread($_[0],$$buffer_ref,$_[2],$_[3]);
        my $error=0+$!;$fail->() unless defined($n)&&$n==length($e->{bytes})&&$error==0
          &&substr($$buffer_ref,$e->{offset}//0,$n) eq $e->{bytes};
        $event->(op=>'sysread',role=>$r->{role},count=>$n,errno=>$error,buffer=>$$buffer_ref);
        if(exists($e->{entropy_failure})) {
          my $failure=$e->{entropy_failure};my $returned=$failure eq '33'?33:$n;
          $$buffer_ref.="\0" if $failure eq '33';
          chop $$buffer_ref if $failure eq 'length';
          utf8::upgrade($$buffer_ref) if $failure eq 'utf8';
          $event->(op=>'entropy-read-nomination',role=>'entropy',ordinal=>$ordinal,outcome=>$failure,
            requestLength=>32,actualRead=>JSON::PP::true,actualCount=>$n,returnedCount=>$returned,
            bufferLength=>length($$buffer_ref),utf8=>utf8::is_utf8($$buffer_ref)?JSON::PP::true:JSON::PP::false,errno=>0);
          $!=0;return $returned;
        }
        if(exists($e->{failure})) {
          my %counts=(mismatch=>69,over=>72,negative=>-1,fraction=>69.5,utf8=>70);
          utf8::upgrade($$buffer_ref) if $e->{failure} eq 'utf8';
          my $returned=$counts{$e->{failure}};
          $event->(op=>'read-nomination',role=>'stdout',ordinal=>$ordinal,requestLength=>71,
            outcome=>$e->{failure},actualRead=>JSON::PP::true,actualCount=>$n,returnedCount=>$returned,
            utf8=>utf8::is_utf8($$buffer_ref)?JSON::PP::true:JSON::PP::false,errno=>0,buffer=>$$buffer_ref);
          $!=0;return $returned;
        }
        $!=0;return $n;
      };
      $handlers{syswrite}=sub {
        $fail->() unless @_>=2&&@_<=4;
        my $r=$identify->($_[0]);my $e=$next->('syswrite',$r->{role});
        my $length=@_>=3?$_[2]:length($_[1]);my $offset=@_==4?$_[3]:0;
        $fail->() unless $_[1] eq $e->{payload}&&$length==$e->{length}&&$offset==$e->{offset};
        if(exists($e->{failure})&&$e->{failure} ne 'errno') {
          $fail->() unless $protocol&&$r->{role} eq 'input'&&$length==75&&$offset==0
            &&$e->{payload} eq 'CHALLENGE '.('1'x64)."\n";
          my $failure=$e->{failure};my $errno=0;
          if($failure ne 'undefined'&&$failure ne 'throw') {
            my %names=(eintr=>'EINTR',eagain=>'EAGAIN',error=>'EIO');
            $fail->() unless exists($names{$failure});my $fn='Errno'->can($names{$failure});
            $fail->() unless defined($fn);$errno=$fn->();
          }
          $event->(op=>'write-nomination',role=>'input',requestLength=>$length,offset=>$offset,
            outcome=>$failure,actualWrite=>JSON::PP::false,errno=>$errno);
          die "TEST_NOMINATED_PARENT_WRITE_THROW\n" if $failure eq 'throw';
          $!= $errno;return undef;
        }
        my $short=exists($e->{short_count});my $physical_length=$short?$e->{short_count}:$length;
        $fail->() if $short&&(!$protocol||$r->{role} ne 'input'||$offset!=0
          ||$physical_length<0||$physical_length!=int($physical_length)||$physical_length>=$length);
        $event->(op=>'write-nomination',role=>'input',requestLength=>$length,offset=>$offset,
          outcome=>'short',actualWrite=>JSON::PP::true,physicalLength=>$physical_length) if $short;
        $!=0;
        my $n=$short?CORE::syswrite($_[0],$_[1],$physical_length,$offset)
          :@_==2?CORE::syswrite($_[0],$_[1]):@_==3?CORE::syswrite($_[0],$_[1],$_[2]):CORE::syswrite($_[0],$_[1],$_[2],$_[3]);
        my $error=0+$!;$fail->() unless defined($n)&&$n==$physical_length&&$error==0;
        my $peer=$roles{'input-peer'};my $got='';
        # Read only the actual prefix; waiting for the original75-byte request
        # after a nominated short completion would block this ordinary fixture.
        my $read=$physical_length?CORE::sysread($peer->{fh},$got,$physical_length):0;
        $fail->() unless defined($read)&&$read==$physical_length&&$got eq substr($e->{bytes},0,$physical_length);
        my $return_errno=0;
        if(exists($e->{failure})) {
          $fail->() unless $protocol&&$e->{failure} eq 'errno'&&$r->{role} eq 'input'
            &&$length==75&&$offset==0&&$e->{payload} eq 'CHALLENGE '.('1'x64)."\n";
          my $fn='Errno'->can('EIO');$fail->() unless defined($fn);$return_errno=$fn->();
          $event->(op=>'write-nomination',role=>'input',requestLength=>$length,offset=>$offset,
            outcome=>'errno',actualWrite=>JSON::PP::true,physicalLength=>$n,errno=>$return_errno);
        }
        $event->(op=>'syswrite',role=>$r->{role},requestLength=>$length,count=>$n,errno=>$return_errno,
          coreErrno=>$error,observed=>$got);$!=$return_errno;return $n;
      };
      $handlers{fcntl}=sub {
        $fail->() unless @_==3;my $r=$identify->($_[0]);
        $fail->() if $protocol&&++$fcntl_calls>23;
        $fail->() unless ($_[1]==Fcntl::F_GETFL()&&$_[2]==0)
          ||($_[1]==Fcntl::F_SETFL()&&($_[2]&Fcntl::O_NONBLOCK()))
          ||($_[1]==Fcntl::F_GETFD()&&$_[2]==0)
          ||($_[1]==Fcntl::F_SETFD()&&$_[2]==Fcntl::FD_CLOEXEC());
        $!=0;my $result=CORE::fcntl($_[0],$_[1],$_[2]);my $errno=0+$!;
        $event->(op=>'fcntl',role=>$r->{role},command=>$_[1],argument=>$_[2],result=>$result,errno=>$errno);
        if($protocol) {
          my $e=$next->('fcntl',$r->{role});$fail->() unless $_[1]==$e->{command};
          if(exists($e->{failure})) {
            my $failure=$e->{failure};$fail->() unless defined($result)&&$errno==0
              &&$failure=~/\A(?:false|throw|undefined|access|nonblock|cloexec)\z/;
            my $returned=$result;
            if($failure eq 'false'||$failure eq 'throw') {
              $fail->() unless $_[1]==Fcntl::F_SETFD()||$_[1]==Fcntl::F_SETFL();$returned=0;
            } elsif($failure eq 'undefined') {
              $fail->() unless $_[1]==Fcntl::F_GETFL()||$_[1]==Fcntl::F_GETFD();$returned=undef;
            } elsif($failure eq 'access') {
              $fail->() unless $r->{role} eq 'entropy'&&$_[1]==Fcntl::F_GETFL();
              $returned=($result&~Fcntl::O_ACCMODE())|Fcntl::O_WRONLY();
            } elsif($failure eq 'nonblock') {
              $fail->() unless $_[1]==Fcntl::F_GETFL();$returned=$result&~Fcntl::O_NONBLOCK();
            } else {$fail->() unless $_[1]==Fcntl::F_GETFD();$returned=$result&~Fcntl::FD_CLOEXEC();}
            $event->(op=>'fcntl-nomination',role=>$r->{role},command=>$_[1],outcome=>$failure,
              actualResult=>$result,returned=>$returned,errno=>0);
            die "TEST_NOMINATED_PARENT_FCNTL_THROW\n" if $failure eq 'throw';
            $!=0;return $returned;
          }
        }
        $!=0;
        return $result;
      };
      $handlers{binmode}=sub {
        $fail->() unless @_==1;my $r=$identify->($_[0]);my $e=$next->('binmode',$r->{role});
        $!=0;my $ok=CORE::binmode($_[0]);my $errno=0+$!;$fail->() unless $ok&&$errno==0;
        $event->(op=>'binmode',role=>$r->{role},result=>1,errno=>$errno);
        if(exists($e->{failure})) {
          $fail->() unless $e->{failure}=~/\A(?:false|throw)\z/;
          $event->(op=>'binmode-nomination',role=>$r->{role},outcome=>$e->{failure},actualConfigured=>JSON::PP::true);
          die "TEST_NOMINATED_PARENT_BINMODE_THROW\n" if $e->{failure} eq 'throw';
          return 0;
        }
        return $ok;
      };
      $handlers{close}=sub {
        $fail->() unless @_==1;my $r=$identify->($_[0]);my $e=$next->('close',$r->{role});
        my $ok=$core_close->($r);$fail->() unless $ok&&$r->{closed};
        if(exists($e->{failure})) {
          $fail->() unless $protocol&&$r->{role}=~/\A(?:input|stdout|stderr|setup|entropy)\z/
            &&$e->{failure}=~/\A(?:false|throw)\z/;
          $event->(op=>'close-nomination',role=>$r->{role},outcome=>$e->{failure},physicalClosed=>JSON::PP::true);
          die "TEST_NOMINATED_PARENT_CLOSE_THROW\n" if $e->{failure} eq 'throw';
          return 0;
        }
        if($e->{uncertain}) {$event->(op=>'nominated-close-uncertainty',role=>$r->{role});return 0;}
        return $ok;
      };
      my $body_ok=eval {
        $fail->() unless ref($q->{record}) eq 'HASH'&&join(',',sort keys %{$q->{record}}) eq 'mode'
          &&defined($q->{record}{mode})&&!ref($q->{record}{mode});
        my %expected=(sysopen=>'*$$;$',sysread=>'*\$$;$',syswrite=>'*$;$$',fcntl=>'*$$',binmode=>'*;$',close=>';*',waitpid=>'$$',kill=>'@',stat=>';*',lstat=>';*');
        for my $name(sort keys %expected) {
          my $p=prototype('CORE::'.$name);$fail->() unless defined($p)&&$p eq $expected{$name};
        }
        for my $name('input','stdout','stderr','setup') {
          CORE::pipe(my $r,my $w) or $fail->();
          my ($original,$peer)=$name eq 'input'?($w,$r):($r,$w);
          $register_pair->($original,$name,$peer,$name.'-peer');
          $fail->() if $q->{record}{mode} eq 'allocation-fault';
          CORE::binmode($r) or $fail->();CORE::binmode($w) or $fail->();
        }
        # Package hook names are intentionally referenced again by string eval.
        no warnings 'once';
        local *main::test_parent_port_sysopen=$handlers{sysopen};
        local *main::test_parent_port_sysread=$handlers{sysread};
        local *main::test_parent_port_syswrite=$handlers{syswrite};
        local *main::test_parent_port_fcntl=$handlers{fcntl};
        local *main::test_parent_port_binmode=$handlers{binmode};
        local *main::test_parent_port_close=$handlers{close};
        local *main::test_parent_port_waitpid=$handlers{waitpid};
        local *main::test_parent_port_kill=$handlers{kill};
        local *main::test_parent_port_stat=$handlers{stat};
        local *main::test_parent_port_lstat=$handlers{lstat};
        use warnings 'once';
        my $installed=eval q{BEGIN {
          *CORE::GLOBAL::sysopen=sub (*$$;$) {goto &main::test_parent_port_sysopen;};
          *CORE::GLOBAL::sysread=sub (*\$$;$) {goto &main::test_parent_port_sysread;};
          *CORE::GLOBAL::syswrite=sub (*$;$$) {goto &main::test_parent_port_syswrite;};
          *CORE::GLOBAL::fcntl=sub (*$$) {goto &main::test_parent_port_fcntl;};
          *CORE::GLOBAL::binmode=sub (*;$) {goto &main::test_parent_port_binmode;};
          *CORE::GLOBAL::close=sub (;*) {goto &main::test_parent_port_close;};
          *CORE::GLOBAL::waitpid=sub ($$) {goto &main::test_parent_port_waitpid;};
          *CORE::GLOBAL::kill=sub (@) {goto &main::test_parent_port_kill;};
          *CORE::GLOBAL::stat=sub (;*) {goto &main::test_parent_port_stat;};
          *CORE::GLOBAL::lstat=sub (;*) {goto &main::test_parent_port_lstat;};
        } 1;};my $install_error=$@;$check->();$fail->() unless $installed&&!length($install_error);
        for my $name(sort keys %expected) {
          my $hook='CORE::GLOBAL'->can($name);$fail->() unless defined($hook);
          my $p=prototype($hook);$fail->() unless defined($p)&&$p eq $expected{$name};
        }
        my ($input,$stdout,$setup)=map {$roles{$_}{fh}} ('input','stdout','setup');
        my $mode=$q->{record}{mode};
        my $admission_case=$mode=~/\Aadmission-(?:initial|drift)-(?:alias-(?:input|stdout|stderr|setup)|replacement-(?:input|stdout|stderr|setup)|missing-(?:pid|input|stdout|stderr|setup)|extra|pid-(?:number|zero|negative|fraction|ref|nan|string|infinity|over)|copy|absent)\z/;
        $prepare_binding->() if $mode eq 'fd-rebinding'||$mode eq 'fd-rebinding-input';
        if($protocol) {
          my %bad_pongs=(
            'malformed-uppercase'=>'PONG '.('A'x64)."\n",
            'malformed-short'=>'PONG '.('1'x63)."\n",
            'malformed-long'=>'PONG '.('1'x65)."\n",
            'malformed-crlf'=>'PONG '.('1'x64)."\r\n",
            'malformed-nul'=>'PONG '.('1'x31)."\0".('1'x32)."\n",
            'malformed-foreign'=>"READY\n",
            'malformed-extra'=>'PONG '.('1'x64)."\nX",
            'malformed-successor-prefix'=>'PONG '.('1'x64)."\nP");
          my ($split_frame,$split_at);
          my ($write_ordinal,$short_count,$write_failure);
          my ($read_fault,$ready_fault,$close_role,$close_fault);
          my $frame_case;
          my $finish_case;
          my ($binmode_role,$binmode_fault,$stat_role,$stat_field);
          my $entropy_case;my ($fcntl_role,$fcntl_index,$fcntl_failure);
          my ($shape_seam,$shape_fields);
          if($mode=~/\Afragment-(ready|pong1|pong2|pong3|end)-([1-9][0-9]?)\z/) {
            ($split_frame,$split_at)=($1,0+$2);
            my %sizes=(ready=>6,pong1=>70,pong2=>70,pong3=>70,end=>4);
            $fail->() unless $split_at<$sizes{$split_frame};
          } elsif($mode=~/\Awrite-short-([1-4])-(0|[1-9][0-9]?)\z/) {
            ($write_ordinal,$short_count)=(0+$1,0+$2);
            $fail->() unless $short_count<($write_ordinal==4?4:75);
          } elsif($mode=~/\Awrite-failure-(undefined|throw|eintr|eagain|error|errno)\z/) {
            ($write_ordinal,$write_failure)=(1,$1);
          } elsif($mode=~/\Aread-failure-(undefined|throw|eintr|eagain|error|mismatch|over|negative|fraction|utf8)\z/) {
            $read_fault=$1;
          } elsif($mode=~/\Aready-failure-(eintr|throw|duplicate|foreign|timeout)\z/) {
            $ready_fault=$1;
          } elsif($mode=~/\Aclose-failure-(input|stdout|stderr|setup|entropy)-(false|throw)\z/) {
            ($close_role,$close_fault)=($1,$2);
          } elsif($mode=~/\Aframe-(replay-pong2|future-pong2|ready-pong2|replay-pong3|ready-extra|future-ready|end-extra|after-end|end-malformed|end-eof-[1-3]|ready-eof-[1-5])\z/) {
            $frame_case=$1;
          } elsif($mode=~/\Afinish-(ready-first|stderr-together|stderr-last|reap-last|missing-setup|missing-stdout|missing-stderr|missing-reap|bootstrap-cap)\z/) {
            $finish_case=$1;
          } elsif($mode=~/\Abinmode-failure-(input|stdout|stderr|setup|entropy)-(false|throw)\z/) {
            ($binmode_role,$binmode_fault)=($1,$2);
          } elsif($mode=~/\Astat-drift-(input|stdout|stderr|setup)-([0-6])\z/) {
            ($stat_role,$stat_field)=($1,0+$2);
          } elsif($mode=~/\Ashape-(input|pre|opened|postpath|posthandle)-(12|14)\z/) {
            ($shape_seam,$shape_fields)=($1,0+$2);
          } elsif($mode=~/\Aentropy-(pre-(?:type|nlink|uid|gid)|open-(?:false|throw|alias)|(?:opened|postpath|posthandle)-[0-6]|read-(?:31|33|duplicate|undefined|throw|eintr|eagain|utf8|length))\z/) {
            $entropy_case=$1;
          } elsif($mode=~/\Aflags-(input|entropy)-(setfd-false|setfd-throw|setfl-false|setfl-throw|getfl-undefined|finalfl-undefined|getfd-undefined|access|nonblock|cloexec)\z/) {
            $fcntl_role=$1;my $kind=$2;
            my %indexes=( 'setfd-false'=>0,'setfd-throw'=>0,'setfl-false'=>2,'setfl-throw'=>2,
              'getfl-undefined'=>1,'finalfl-undefined'=>3,'getfd-undefined'=>$fcntl_role eq 'entropy'?2:4,
              access=>1,nonblock=>$fcntl_role eq 'entropy'?1:3,cloexec=>$fcntl_role eq 'entropy'?2:4);
            $fail->() if $fcntl_role eq 'entropy'&&$kind=~/\A(?:setfl-|finalfl-)/;
            $fail->() if $fcntl_role eq 'input'&&$kind eq 'access';
            $fcntl_index=$indexes{$kind};$fcntl_failure=$kind=~/-/?(split /-/,$kind)[1]:$kind;
          } else {
            $fail->() unless $admission_case||exists($bad_pongs{$mode})
              ||$mode=~/\A(?:success|settled-repeat|absent|arity|admission-copy|admission-pid-string|pid-infinity|pid-over|nonzero-reap|post-reap-signal|wrong-nonce|deadline|input-close-scaffold|partial-eof|setup-byte|stderr-byte|early-reap|reap-undefined|reap-echild|reap-foreign|clock-start-throw|fd-rebinding-input)\z/;
          }
          for my $role('setup-peer','stderr-peer') {
            next if defined($finish_case)&&($finish_case eq 'missing-setup'&&$role eq 'setup-peer'
              ||$finish_case eq 'missing-stderr'&&$role eq 'stderr-peer');
            if(($mode eq 'setup-byte'&&$role eq 'setup-peer')||($mode eq 'stderr-byte'&&$role eq 'stderr-peer')) {
              CORE::syswrite($roles{$role}{fh},'Q',1)==1 or $fail->();
            }
            $core_close->($roles{$role}) or $fail->();
          }
          for my $role('input','stdout','stderr','setup','entropy') {
            my %counts=(input=>34,stdout=>45,stderr=>39,setup=>7,entropy=>22);
            $queues{'stat:'.$role}=[map {+{op=>'stat',role=>$role}} 1..$counts{$role}];
          }
          $queues{'stat:'.$stat_role}[1]{drift_field}=$stat_field if defined($stat_role);
          $queues{'lstat:entropy'}=[map {+{op=>'lstat',role=>'entropy'}} 1..4];
          if(defined($shape_seam)) {
            my $e=$shape_seam eq 'input'?$queues{'stat:input'}[1]
              :$shape_seam eq 'pre'?$queues{'lstat:entropy'}[0]
              :$shape_seam eq 'opened'?$queues{'stat:entropy'}[0]
              :$shape_seam eq 'postpath'?$queues{'lstat:entropy'}[1]:$queues{'stat:entropy'}[3];
            @{$e}{'shape','seam'}=($shape_fields,$shape_seam);
          }
          $queues{'sysopen:entropy'}=[{op=>'sysopen',role=>'entropy'}];
          $queues{'sysread:setup'}=[{op=>'sysread',role=>'setup',length=>1,bytes=>''}];
          $queues{'sysread:stderr'}=[{op=>'sysread',role=>'stderr',length=>1,bytes=>''}];
          $queues{'sysread:stdout'}=[map {+{op=>'sysread',role=>'stdout',length=>71,bytes=>$_}}
            ("READY\n",'PONG '.(($mode eq 'wrong-nonce'?'9':'1')x64)."\n",'PONG '.('2'x64)."\n",'PONG '.('3'x64)."\n","END\n",'')];
          $queues{'sysread:stdout'}[1]{bytes}=$bad_pongs{$mode} if exists($bad_pongs{$mode});
          $queues{'sysread:stdout'}[1]{failure}=$read_fault if defined($read_fault);
          if($mode eq 'partial-eof') {
            $queues{'sysread:stdout'}[1]{bytes}='PONG '.('1'x64);
            $queues{'sysread:stdout'}[2]{bytes}='';
          }
          if(defined($frame_case)) {
            my $reads=$queues{'sysread:stdout'};
            $reads->[2]{bytes}='PONG '.('1'x64)."\n" if $frame_case eq 'replay-pong2';
            $reads->[2]{bytes}='PONG '.('3'x64)."\n" if $frame_case eq 'future-pong2';
            $reads->[2]{bytes}="READY\n" if $frame_case eq 'ready-pong2';
            $reads->[3]{bytes}='PONG '.('2'x64)."\n" if $frame_case eq 'replay-pong3';
            $reads->[0]{bytes}="READY\nP" if $frame_case eq 'ready-extra';
            $reads->[0]{bytes}='PONG '.('1'x64)."\n" if $frame_case eq 'future-ready';
            $reads->[4]{bytes}="END\nX" if $frame_case eq 'end-extra';
            $reads->[5]{bytes}='X' if $frame_case eq 'after-end';
            $reads->[4]{bytes}="ENX\n" if $frame_case eq 'end-malformed';
            if($frame_case=~/\Aend-eof-([1-3])\z/) {$reads->[4]{bytes}=substr("END\n",0,0+$1);}
            if($frame_case=~/\Aready-eof-([1-5])\z/) {
              $reads->[0]{bytes}=substr("READY\n",0,0+$1);$reads->[1]{bytes}='';
            }
          }
          $queues{'sysread:setup'}[0]{bytes}='Q' if $mode eq 'setup-byte';
          $queues{'sysread:stderr'}[0]{bytes}='Q' if $mode eq 'stderr-byte';
          $queues{'sysread:entropy'}=[map {+{op=>'sysread',role=>'entropy',length=>32,bytes=>$_}}
            (("\x11"x32),("\x22"x32),("\x33"x32))];
          if(defined($entropy_case)) {
            if($entropy_case=~/\Apre-(type|nlink|uid|gid)\z/) {
              my %fields=(type=>2,nlink=>3,uid=>4,gid=>5);my %values=(type=>0100644,nlink=>2,uid=>501,gid=>20);
              @{$queues{'lstat:entropy'}[0]}{'entropy_field','ordinal','seam','value'}=($fields{$1},1,'pre',$values{$1});
            } elsif($entropy_case=~/\Aopen-(false|throw|alias)\z/) {$queues{'sysopen:entropy'}[0]{failure}=$1;}
            elsif($entropy_case=~/\A(opened|postpath|posthandle)-([0-6])\z/) {
              my ($seam,$field)=($1,0+$2);my $e=$seam eq 'postpath'?$queues{'lstat:entropy'}[1]
                :$queues{'stat:entropy'}[$seam eq 'opened'?0:3];
              @{$e}{'entropy_field','ordinal','seam'}=($field,$seam eq 'opened'?1:$seam eq 'postpath'?2:4,$seam);
            } else {
              $entropy_case=~/\Aread-(.+)\z/ or $fail->();my $failure=$1;
              $queues{'sysread:entropy'}[$failure eq 'duplicate'?1:0]{entropy_failure}=$failure;
              if($failure eq '31') {
                $queues{'sysread:entropy'}[0]{bytes}="\x11"x31;$queues{'sysopen:entropy'}[0]{fixture_bytes}="\x11"x31;
              } elsif($failure eq 'duplicate') {
                $queues{'sysread:entropy'}[1]{bytes}="\x11"x32;
                $queues{'sysopen:entropy'}[0]{fixture_bytes}=("\x11"x64).("\x33"x32);
              }
            }
          }
          $queues{'syswrite:input'}=[map {+{op=>'syswrite',role=>'input',payload=>$_,length=>length($_),offset=>0,bytes=>$_}}
            ('CHALLENGE '.('1'x64)."\n",'CHALLENGE '.('2'x64)."\n",'CHALLENGE '.('3'x64)."\n","END\n")];
          if(defined($write_ordinal)) {
            my $entry=$queues{'syswrite:input'}[$write_ordinal-1];
            $entry->{short_count}=$short_count if defined($short_count);
            $entry->{failure}=$write_failure if defined($write_failure);
          }
          for my $role('input','stdout','stderr','setup','entropy') {
            $queues{'close:'.$role}=[{op=>'close',role=>$role}];
            $queues{'binmode:'.$role}=[{op=>'binmode',role=>$role}];
            my @commands=$role eq 'entropy'?(Fcntl::F_SETFD(),Fcntl::F_GETFL(),Fcntl::F_GETFD())
              :(Fcntl::F_SETFD(),Fcntl::F_GETFL(),Fcntl::F_SETFL(),Fcntl::F_GETFL(),Fcntl::F_GETFD());
            $queues{'fcntl:'.$role}=[map {+{op=>'fcntl',role=>$role,command=>$_}} @commands];
          }
          $queues{'close:'.$close_role}[0]{failure}=$close_fault if defined($close_role);
          $queues{'binmode:'.$binmode_role}[0]{failure}=$binmode_fault if defined($binmode_role);
          $queues{'fcntl:'.$fcntl_role}[$fcntl_index]{failure}=$fcntl_failure if defined($fcntl_role);
          $queues{'waitpid:child'}=[map {+{op=>'waitpid',role=>'child',got=>0,status=>0}} 1..32];
          $queues{'waitpid:closed-input-child'}=[{op=>'waitpid',role=>'closed-input-child',got=>424242,
            status=>$mode eq 'nonzero-reap'||$mode eq 'post-reap-signal'?256:0}];
          $queues{'clock:fixture'}=[map {+{op=>'clock',role=>'fixture',value=>0}} 1..46];
          if($mode eq 'deadline') {
            $queues{'clock:fixture'}=[map {+{op=>'clock',role=>'fixture',value=>$_}} (0,0,(44)x38,(46)x6)];
          }
          if($mode eq 'post-reap-signal') {
            $queues{'clock:fixture'}=[map {+{op=>'clock',role=>'fixture',value=>$_}} ((0)x35,0,6)];
            $queues{'kill:child'}=[{op=>'kill',role=>'child',signal=>'TERM',result=>0}];
          }
          my %first_wait=( 'early-reap'=>424242,'reap-undefined'=>undef,'reap-echild'=>-1,'reap-foreign'=>424243 );
          if(exists($first_wait{$mode})) {
            my $errno=0;
            if($mode eq 'reap-echild') {my $fn='Errno'->can('ECHILD');$fail->() unless defined($fn);$errno=$fn->();}
            $queues{'waitpid:child'}=[{op=>'waitpid',role=>'child',got=>$first_wait{$mode},status=>0,errno=>$errno}];
            $queues{'waitpid:closed-input-child'}=[];
            $queues{'clock:fixture'}=[map {+{op=>'clock',role=>'fixture',value=>0}} 1..3];
          }
          if($mode eq 'clock-start-throw') {
            $queues{'clock:fixture'}=[{op=>'clock',role=>'fixture',value=>0},{op=>'clock',role=>'fixture',nominated_throw=>1}];
            $queues{'waitpid:child'}=[];
          }
          if($admission_case) {
            $queues{'clock:fixture'}=[map {+{op=>'clock',role=>'fixture',value=>0}}
              1..($mode=~/\Aadmission-drift-/?3:1)];
            $queues{'waitpid:child'}=[map {+{op=>'waitpid',role=>'child',got=>0,status=>0}}
              1..($mode=~/\Aadmission-drift-/?1:0)];
            for my $role('input','stdout','stderr','setup') {
              $queues{'stat:'.$role}=[map {+{op=>'stat',role=>$role}}
                1..($mode=~/\Aadmission-drift-/?3:0)];
            }
          }
          if(defined($write_ordinal)) {
            # Literal finite stop capacities independently counted from the
            # four write edges; no queue is sized from consumer state/results.
            my @clock_counts=(12,20,28,34);my @live_counts=(10,18,26,32);
            my @stat_counts=([12,12,12,7,5],[20,20,20,7,14],[28,28,28,7,22],[34,34,34,7,22]);
            $queues{'clock:fixture'}=[map {+{op=>'clock',role=>'fixture',value=>0}} 1..$clock_counts[$write_ordinal-1]];
            $queues{'waitpid:child'}=[map {+{op=>'waitpid',role=>'child',got=>0,status=>0}} 1..$live_counts[$write_ordinal-1]];
            my @names=('input','stdout','stderr','setup','entropy');
            for my $index(0..4) {
              my $role=$names[$index];$queues{'stat:'.$role}=[map {+{op=>'stat',role=>$role}} 1..$stat_counts[$write_ordinal-1][$index]];
            }
          }
          if(defined($read_fault)) {
            $queues{'clock:fixture'}=[map {+{op=>'clock',role=>'fixture',value=>0}} 1..16];
            $queues{'waitpid:child'}=[map {+{op=>'waitpid',role=>'child',got=>0,status=>0}} 1..14];
          }
          if(defined($ready_fault)) {
            my $late=$ready_fault eq 'duplicate'||$ready_fault eq 'foreign'||$ready_fault eq 'timeout';
            $queues{'clock:fixture'}=[map {+{op=>'clock',role=>'fixture',value=>0}} 1..($late?5:4)];
            $queues{'clock:fixture'}[4]{value}=45 if $ready_fault eq 'timeout';
            $queues{'waitpid:child'}=[map {+{op=>'waitpid',role=>'child',got=>0,status=>0}}
              1..($ready_fault eq 'duplicate'||$ready_fault eq 'foreign'?3:2)];
          }
          if(defined($close_role)) {
            my %counts=(setup=>[7,5],entropy=>[27,25],input=>[34,32],stderr=>[39,32],stdout=>[45,32]);
            $queues{'clock:fixture'}=[map {+{op=>'clock',role=>'fixture',value=>0}} 1..$counts{$close_role}[0]];
            $queues{'waitpid:child'}=[map {+{op=>'waitpid',role=>'child',got=>0,status=>0}} 1..$counts{$close_role}[1]];
          }
          if(defined($frame_case)) {
            my ($clocks,$live)=(46,32);
            ($clocks,$live)=(25,23) if $frame_case=~/\A(?:replay-pong2|future-pong2|ready-pong2)\z/;
            ($clocks,$live)=(33,31) if $frame_case eq 'replay-pong3';
            ($clocks,$live)=(9,7) if $frame_case eq 'ready-extra'||$frame_case eq 'future-ready';
            ($clocks,$live)=(13,11) if $frame_case=~/\Aready-eof-/;
            ($clocks,$live)=(41,32) if $frame_case eq 'end-extra'||$frame_case eq 'end-malformed';
            ($clocks,$live)=(45,32) if $frame_case eq 'after-end'||$frame_case=~/\Aend-eof-/;
            $queues{'clock:fixture'}=[map {+{op=>'clock',role=>'fixture',value=>0}} 1..$clocks];
            $queues{'waitpid:child'}=[map {+{op=>'waitpid',role=>'child',got=>0,status=>0}} 1..$live];
          }
          if(defined($finish_case)) {
            if($finish_case=~/\A(?:ready-first|stderr-together|stderr-last|reap-last)\z/) {
              my %stat_counts=( 'ready-first'=>[36,47,41,11,22],
                'stderr-together'=>[34,45,43,7,22], 'stderr-last'=>[34,43,47,7,22],
                'reap-last'=>[34,45,39,7,22]);
              my @names=('input','stdout','stderr','setup','entropy');
              for my $index(0..4) {
                my $role=$names[$index];$queues{'stat:'.$role}=[map {+{op=>'stat',role=>$role}} 1..$stat_counts{$finish_case}[$index]];
              }
              my $clocks=$finish_case eq 'stderr-together'||$finish_case eq 'reap-last'?46:48;
              $queues{'clock:fixture'}=[map {+{op=>'clock',role=>'fixture',value=>0}} 1..$clocks];
              $queues{'waitpid:child'}=[map {+{op=>'waitpid',role=>'child',got=>0,status=>0}}
                1..($finish_case eq 'ready-first'?34:32)];
              if($finish_case eq 'reap-last') {
                $queues{'waitpid:closed-input-child'}=[
                  (map {+{op=>'waitpid',role=>'closed-input-child',got=>0,status=>0}} 1..7),
                  {op=>'waitpid',role=>'closed-input-child',got=>424242,status=>0}];
              }
            } elsif($finish_case eq 'missing-reap') {
              $queues{'clock:fixture'}=[map {+{op=>'clock',role=>'fixture',value=>$_}} ((0)x45,45,45,45)];
              $queues{'waitpid:closed-input-child'}=[
                (map {+{op=>'waitpid',role=>'closed-input-child',got=>0,status=>0}} 1..13),
                {op=>'waitpid',role=>'closed-input-child',got=>424242,status=>0}];
              $queues{'sleep:fixture'}=[{op=>'sleep',role=>'fixture',value=>0.01}];
            } elsif($finish_case eq 'bootstrap-cap') {
              $queues{'clock:fixture'}=[map {+{op=>'clock',role=>'fixture',value=>$_}} (0,179,179,180)];
              $queues{'waitpid:child'}=[{op=>'waitpid',role=>'child',got=>0,status=>0}];
            } else {
              my %zero_counts=('missing-setup'=>7,'missing-stdout'=>41,'missing-stderr'=>43);
              $queues{'clock:fixture'}=[map {+{op=>'clock',role=>'fixture',value=>$_}} ((0)x$zero_counts{$finish_case},45)];
              $queues{'waitpid:child'}=[map {+{op=>'waitpid',role=>'child',got=>0,status=>0}}
                1..($finish_case eq 'missing-setup'?5:32)];
              if($finish_case eq 'missing-stderr') {
                $queues{'stat:stderr'}=[map {+{op=>'stat',role=>'stderr'}} 1..43];
              }
            }
          }
          if(defined($binmode_role)||defined($stat_role)) {
            my $entropy=defined($binmode_role)&&$binmode_role eq 'entropy';
            $queues{'clock:fixture'}=[map {+{op=>'clock',role=>'fixture',value=>0}} 1..($entropy?9:3)];
            $queues{'waitpid:child'}=[map {+{op=>'waitpid',role=>'child',got=>0,status=>0}} 1..($entropy?7:1)];
          }
          if(defined($entropy_case)||defined($fcntl_role)) {
            my $clocks=9;
            if(defined($entropy_case)) {
              $clocks=11 if $entropy_case=~/\A(?:postpath|posthandle)-/;
              $clocks=$entropy_case eq 'read-duplicate'?19:10 if $entropy_case=~/\Aread-/;
            } elsif($fcntl_role eq 'input') {$clocks=3;}
            $queues{'clock:fixture'}=[map {+{op=>'clock',role=>'fixture',value=>0}} 1..$clocks];
            $queues{'waitpid:child'}=[map {+{op=>'waitpid',role=>'child',got=>0,status=>0}} 1..($clocks-2)];
          }
          if(defined($shape_seam)||$mode eq 'fd-rebinding-input') {
            my $clocks=!defined($shape_seam)||$shape_seam eq 'input'?3
              :$shape_seam eq 'postpath'||$shape_seam eq 'posthandle'?11:9;
            $queues{'clock:fixture'}=[map {+{op=>'clock',role=>'fixture',value=>0}} 1..$clocks];
            $queues{'waitpid:child'}=[map {+{op=>'waitpid',role=>'child',got=>0,status=>0}} 1..($clocks-2)];
          }
          $queues{'ready:fixture'}=[map {+{op=>'ready',role=>'fixture',roles=>$_}}
            (['setup','stdout'],['stdout'],['stdout'],['stdout'],['stderr','stdout'],['stdout'])];
          $queues{'ready:fixture'}[0]{failure}=$ready_fault if defined($ready_fault);
          if(defined($finish_case)) {
            my $ready=$queues{'ready:fixture'};
            if($finish_case eq 'ready-first') {
              $ready->[0]{roles}=['stdout'];splice @$ready,1,0,{op=>'ready',role=>'fixture',roles=>['setup']};
            } elsif($finish_case eq 'stderr-together') {
              $ready->[4]{roles}=['stdout'];$ready->[5]{roles}=['stderr','stdout'];
            } elsif($finish_case eq 'stderr-last') {
              $ready->[4]{roles}=['stdout'];push @$ready,{op=>'ready',role=>'fixture',roles=>['stderr']};
            } elsif($finish_case eq 'missing-setup') {$ready->[0]{roles}=['stdout'];}
            elsif($finish_case eq 'missing-stderr') {$ready->[4]{roles}=['stdout'];}
          }
          $queues{'ready:fixture'}[0]{roles}=['setup','stderr','stdout'] if $mode eq 'stderr-byte';
          if($mode eq 'input-close-scaffold') {
            $queues{'stat:input'}=[map {+{op=>'stat',role=>'input'}} 1..41];
            $queues{'stat:stdout'}=[map {+{op=>'stat',role=>'stdout'}} 1..41];
            $queues{'waitpid:child'}=[map {+{op=>'waitpid',role=>'child',got=>0,status=>0}} 1..39];
            $queues{'clock:fixture'}=[map {+{op=>'clock',role=>'fixture',value=>$_}} ((0)x41,45)];
            pop @{$queues{'ready:fixture'}};pop @{$queues{'sysread:stdout'}};
          }
          if(defined($split_frame)) {
            my %indexes=(ready=>0,pong1=>1,pong2=>2,pong3=>3,end=>4);
            my $index=$indexes{$split_frame};my $read=$queues{'sysread:stdout'}[$index];
            my $bytes=$read->{bytes};
            splice @{$queues{'sysread:stdout'}},$index,1,
              {op=>'sysread',role=>'stdout',length=>71,bytes=>substr($bytes,0,$split_at)},
              {op=>'sysread',role=>'stdout',length=>71,bytes=>substr($bytes,$split_at)};
            splice @{$queues{'ready:fixture'}},$index+1,0,{op=>'ready',role=>'fixture',roles=>['stdout']};
            # Hand-derived from four additional epochs per extra read batch;
            # these are fixture capacities, not expectations computed by FSM.
            my %counts=(ready=>[38,49,43,7,22],pong1=>[38,49,43,7,26],
              pong2=>[38,49,43,7,26],pong3=>[38,49,43,7,22],end=>[34,49,39,7,22]);
            my @names=('input','stdout','stderr','setup','entropy');
            for my $slot(0..4) {
              my $role=$names[$slot];$queues{'stat:'.$role}=[map {+{op=>'stat',role=>$role}} 1..$counts{$split_frame}[$slot]];
            }
            $queues{'clock:fixture'}=[map {+{op=>'clock',role=>'fixture',value=>0}} 1..50];
            $queues{'waitpid:child'}=[map {+{op=>'waitpid',role=>'child',got=>0,status=>0}}
              1..($split_frame eq 'end'?32:36)];
          }
          $fail->() unless prototype(Time::HiRes->can('clock_gettime')) eq ';$'
            &&prototype(Time::HiRes->can('sleep')) eq ';@'
            &&!defined(prototype(IO::Select->can('can_read')))&&!defined(prototype(IO::Select->can('can_write')));
          no warnings qw(once redefine);
          my $clock_ordinal=0;
          local *Time::HiRes::clock_gettime=sub (;$) {
            $fail->() unless @_==1&&$_[0]==Time::HiRes::CLOCK_MONOTONIC();
            ++$clock_ordinal;
            my $e=$next->('clock','fixture');
            if($e->{nominated_throw}) {
              $event->(op=>'clock',role=>'fixture',nominatedThrow=>JSON::PP::true);
              die "TEST_NOMINATED_PARENT_CLOCK_THROW\n";
            }
            my $v=$e->{value};my $flags=B::svref_2object(\$v)->FLAGS;
            $fail->() unless ($flags&(B::SVf_IOK()|B::SVf_NOK()))&&!($flags&B::SVf_POK());
            $event->(op=>'clock',role=>'fixture',value=>$v);
            test_change_parent_admission() if $admission_case&&$mode=~/\Aadmission-drift-/&&$clock_ordinal==3;
            if($mode eq 'fd-rebinding-input'&&$clock_ordinal==3) {
              test_verify_parent_custody();$execute_binding->();test_verify_parent_custody();
            }
            return $v;
          };
          local *Time::HiRes::sleep=sub (;@) {
            $fail->() unless defined($finish_case)&&$finish_case eq 'missing-reap'&&@_==1&&$_[0]==0.01;
            my $e=$next->('sleep','fixture');$fail->() unless $e->{value}==$_[0];
            $event->(op=>'sleep-nomination',role=>'fixture',value=>$_[0]);return 0;
          };
          local *IO::Select::can_write=sub {$fail->();};
          local *IO::Select::can_read=sub {
            my $entry_errno=0+$!;$fail->() unless wantarray&&@_==2&&ref($_[0]) eq 'IO::Select'&&$_[1]==0.01;
            my ($selector,$timeout)=@_;my $e=$next->('ready','fixture');my @ready;
            for my $fh($selector->handles()) {$identify->($fh);}
            if(exists($e->{failure})) {
              $fail->() unless $entry_errno==0&&$e->{failure}=~/\A(?:eintr|throw|duplicate|foreign|timeout)\z/;
              my $errno=0;
              if($e->{failure} eq 'eintr') {my $fn='Errno'->can('EINTR');$fail->() unless defined($fn);$errno=$fn->();}
              $event->(op=>'ready-nomination',role=>'fixture',outcome=>$e->{failure},entryErrno=>$entry_errno,errno=>$errno);
              die "TEST_NOMINATED_PARENT_READY_THROW\n" if $e->{failure} eq 'throw';
              if($e->{failure} ne 'duplicate') {
                $event->(op=>'ready',role=>'fixture',timeout=>$timeout);$!=$errno;
                return ($roles{input}{fh}) if $e->{failure} eq 'foreign';
                return ();
              }
            }
            for my $role(@{$e->{roles}}) {
              my $r=$roles{$role};$fail->() unless defined($r)&&!$r->{closed}&&$selector->exists($r->{fh});push @ready,$r->{fh};
              if($role eq 'stdout') {
                my $frame=$queues{'sysread:stdout'}[0];$fail->() unless ref($frame) eq 'HASH';
                my $bytes=$frame->{bytes};
                if(length($bytes)) {
                  CORE::syswrite($roles{'stdout-peer'}{fh},$bytes,length($bytes))==length($bytes) or $fail->();
                } else {$core_close->($roles{'stdout-peer'}) or $fail->();}
              }
            }
            push @ready,$roles{stdout}{fh} if exists($e->{failure})&&$e->{failure} eq 'duplicate';
            $event->(op=>'ready',role=>'fixture',timeout=>$timeout);$!=$entry_errno;return @ready;
          };
          use warnings qw(once redefine);
          my $source=MIME::Base64::decode_base64($ARGV[0]);
          my $loaded=eval($source."\n1;\n");my $startup_error=$@;$check->();
          $fail->() unless $loaded&&!length($startup_error);
          my $initialized=eval {test_initialize_parent(map {$roles{$_}{fh}} ('input','stdout','stderr','setup')) unless $mode eq 'absent';1;};
          my $initialize_error=$@;$check->();$fail->() unless $initialized&&!length($initialize_error);
          my $fresh=eval {task6a_origin_parent_require_unburned();1;};my $fresh_error=$@;$check->();
          $fail->() unless $fresh&&!length($fresh_error);
          my $before_consumer=scalar(@events);
          my $consumer=eval {$mode eq 'arity'?task6a_origin_consume_entry_protocol(1):task6a_origin_consume_entry_protocol()};
          my $primary=$@;$check->();
          if(ref($consumer) eq 'HASH'&&!length($primary)) {
            for my $list(values %queues) {$fail->() if @$list;}
            $fail->() unless $fcntl_calls==23;
            $out={accepted=>JSON::PP::true,consumer=>$consumer,writes=>[map {$_->{observed}} grep {$_->{op} eq 'syswrite'} @events]};
            if($mode eq 'settled-repeat') {
              # Repeat the real settled consumer, without initializer/queue reset.
              # Preserve the first diagnostic before the second call burns.
              my $before_repeat=scalar(@events);
              my $again=eval {task6a_origin_consume_entry_protocol();1;};my $again_error=$@;$check->();
              my $guard=eval {task6a_origin_parent_require_unburned();1;};my $guard_error=$@;$check->();
              $fail->() unless !$again&&$again_error eq "TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n"
                &&!$guard&&$guard_error eq "TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n";
              $out->{settledRepeatRefused}=JSON::PP::true;$out->{guardBurnedAfterSettledRepeat}=JSON::PP::true;
              $out->{effectsAfterSettledRepeat}=scalar(@events)-$before_repeat;
            }
          } else {
            $fail->() if $mode eq 'success';
            $fail->() unless !defined($consumer)&&$primary eq "TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n";
            my @consumer_events=map {+{%$_}} @events[$before_consumer..$#events];
            if($mode eq 'fd-rebinding-input') {test_verify_parent_custody();$surviving_binding->();}
            my $restored=0;
            if($admission_case) {
              my $ok=eval {test_restore_parent_admission();1;};my $error=$@;$check->();
              $fail->() unless $ok&&!length($error);$restored=1;
            }
            my $before_repeat=scalar(@events);
            my $repeat=eval {task6a_origin_consume_entry_protocol();1;};my $repeat_error=$@;$check->();
            my $guard=eval {task6a_origin_parent_require_unburned();1;};my $guard_error=$@;$check->();
            $fail->() unless !$repeat&&$repeat_error eq "TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n"
              &&($guard&&!length($guard_error)||!$guard&&$guard_error eq "TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n");
            my $repeat_effects=scalar(@events)-$before_repeat;
            if($mode eq 'fd-rebinding-input') {test_verify_parent_custody();$surviving_binding->();}
            $out={accepted=>JSON::PP::false,refused=>JSON::PP::true,repeatRefused=>JSON::PP::true,
              guardBurned=>$guard?JSON::PP::false:JSON::PP::true,guardAccepted=>$guard?JSON::PP::true:JSON::PP::false,
              admissionRestored=>$restored?JSON::PP::true:JSON::PP::false,
              effectsAfterRepeat=>$repeat_effects,consumerEvents=>\@consumer_events};
          }
        } elsif($mode eq 'fd-rebinding') {
          $execute_binding->();$surviving_binding->();$out={ownedBindingOnly=>JSON::PP::true};
        } elsif($mode=~/\Abinmode(?:-false|-throw)?\z/) {
          my $e={op=>'binmode',role=>'input'};
          $e->{failure}=$mode eq 'binmode-false'?'false':'throw' unless $mode eq 'binmode';
          @queue=($e);
          my $returned;my $ok=eval {$returned=eval q{binmode($input)};my $error=$@;$check->();
            die $error if length($error);1;};my $error=$@;$check->();
          $fail->() unless $mode eq 'binmode-throw'?!$ok&&$error eq "TEST_NOMINATED_PARENT_BINMODE_THROW\n"
            :$ok&&!length($error)&&defined($returned)&&($mode eq 'binmode'?$returned:!$returned);
          $fail->() if $roles{input}{closed};
          $out={configured=>JSON::PP::true,returned=>$returned?JSON::PP::true:JSON::PP::false,
            thrown=>$ok?JSON::PP::false:JSON::PP::true};
        } elsif($mode eq 'stat-pipe') {
          my @before=CORE::stat($stdout);$fail->() unless @before==13;
          CORE::syswrite($roles{'stdout-peer'}{fh},'Q',1)==1 or $fail->();
          @queue=({op=>'stat',role=>'stdout'});
          my $tuple=eval q{my @s=stat($stdout);\@s};my $error=$@;$check->();
          $fail->() unless ref($tuple) eq 'ARRAY'&&@$tuple==13&&!length($error);
          for my $field(0..6) {$fail->() unless $before[$field]==$tuple->[$field];}
          $fail->() unless Fcntl::S_ISFIFO($tuple->[2]);
          $out={fields=>scalar(@$tuple),stablePipeIdentity=>JSON::PP::true};
        } elsif($mode eq 'stat-entropy') {
          $core_close->($roles{setup}) or $fail->();
          @queue=({op=>'lstat',role=>'entropy'},{op=>'sysopen',role=>'entropy'},
            {op=>'stat',role=>'entropy'},{op=>'lstat',role=>'entropy'});
          my $entropy;
          my $tuple=eval q{
            my @before=lstat('/dev/urandom');
            sysopen($entropy,'/dev/urandom',Fcntl::O_RDONLY()|Fcntl::O_NOFOLLOW()|Fcntl::O_NONBLOCK()) or die "test entropy open failed\n";
            my @opened=stat($entropy);my @after=lstat('/dev/urandom');
            [\@before,\@opened,\@after];
          };my $error=$@;$check->();$fail->() unless ref($tuple) eq 'ARRAY'&&!length($error);
          for my $row(@$tuple) {
            $fail->() unless @$row==13&&Fcntl::S_ISCHR($row->[2])&&$row->[4]==0&&$row->[5]==0;
            for my $field(0..12) {$fail->() unless $row->[$field]==$entropy_identity[$field];}
          }
          $out={syntheticEntropy=>JSON::PP::true,tuples=>$tuple};
        } elsif($mode eq 'stat-foreign') {
          my $ignored=eval q{my @s=lstat('/tmp');\@s};my $error=$@;$check->();$fail->();
        } elsif($mode eq 'sysopen') {
          my $old_fd=fileno($setup);$core_close->($roles{setup}) or $fail->();
          @queue=({op=>'sysopen',role=>'entropy'});
          my $new;my $ok=eval q{sysopen($new,'/dev/urandom',Fcntl::O_RDONLY()|Fcntl::O_NOFOLLOW()|Fcntl::O_NONBLOCK())};
          my $error=$@;$check->();$fail->() unless $ok&&!length($error)&&defined($new)
            &&$new==$roles{entropy}{fh}&&$new!=$setup&&fileno($new)==$old_fd;
          $out={callerAssigned=>JSON::PP::true,newReference=>JSON::PP::true,reusedClosedFd=>JSON::PP::true};
        } elsif($mode eq 'sysread'||$mode eq 'sysread-default'||$mode eq 'sysread-eof') {
          if($mode eq 'sysread-eof') {
            $core_close->($roles{'stdout-peer'}) or $fail->();
            @queue=({op=>'sysread',role=>'stdout',length=>3,offset=>0,bytes=>''});
            my $buffer='prior';my $n=eval q{sysread($stdout,$buffer,3)};my $error=$@;
            $check->();$fail->() unless defined($n)&&$n==0&&!length($error)&&$buffer eq '';
            $out={count=>$n,buffer=>$buffer};
          } else {
          CORE::syswrite($roles{'stdout-peer'}{fh},'XYZ',3)==3 or $fail->();
          my $offset=$mode eq 'sysread'?2:0;
          @queue=({op=>'sysread',role=>'stdout',length=>3,offset=>$offset,bytes=>'XYZ'});
          my $buffer='AB';my $n=eval($offset?q{sysread($stdout,$buffer,3,2)}:q{sysread($stdout,$buffer,3)});my $error=$@;
          $check->();$fail->() unless defined($n)&&$n==3&&!length($error)&&$buffer eq ($offset?'ABXYZ':'XYZ');
          $out={count=>$n,buffer=>$buffer};
          }
        } elsif($mode eq 'syswrite') {
          @queue=({op=>'syswrite',role=>'input',payload=>'ABC',length=>3,offset=>0,bytes=>'ABC'},
            {op=>'syswrite',role=>'input',payload=>'DEFG',length=>2,offset=>0,bytes=>'DE'},
            {op=>'syswrite',role=>'input',payload=>'HIJK',length=>2,offset=>1,bytes=>'IJ'});
          my $ok=eval q{syswrite($input,'ABC')==3&&syswrite($input,'DEFG',2)==2&&syswrite($input,'HIJK',2,1)==2};
          my $error=$@;$check->();$fail->() unless $ok&&!length($error);
          $out={observed=>[map {$_->{observed}} grep {$_->{op} eq 'syswrite'} @events]};
        } elsif($mode eq 'fcntl') {
          my $ok=eval q{my $fl=fcntl($input,Fcntl::F_GETFL(),0);
            defined($fl)&&fcntl($input,Fcntl::F_SETFL(),$fl|Fcntl::O_NONBLOCK())
              &&fcntl($input,Fcntl::F_SETFD(),Fcntl::FD_CLOEXEC())};my $error=$@;
          $check->();$fail->() unless $ok&&!length($error);
          my $fl=CORE::fcntl($input,Fcntl::F_GETFL(),0);my $fd=CORE::fcntl($input,Fcntl::F_GETFD(),0);
          $fail->() unless defined($fl)&&($fl&Fcntl::O_NONBLOCK())&&defined($fd)&&($fd&Fcntl::FD_CLOEXEC());
          $out={nonblocking=>JSON::PP::true,cloexec=>JSON::PP::true,zeroSuccess=>"$ok"};
        } elsif($mode eq 'close'||$mode eq 'close-uncertain') {
          @queue=({op=>'close',role=>'setup',uncertain=>$mode eq 'close-uncertain'});
          my $ok=eval q{close($setup)};my $error=$@;$check->();
          $fail->() if length($error)||!$roles{setup}{closed};
          $out={returned=>$ok?1:0,attempted=>$roles{setup}{attempted},definite=>$roles{setup}{closed}};
        } elsif($mode=~/\Await-(?:live|zero|nonzero|undefined|negative|foreign|badpid)\z/) {
          my %returns=('wait-live'=>0,'wait-zero'=>424242,'wait-nonzero'=>424242,
            'wait-undefined'=>undef,'wait-negative'=>-1,'wait-foreign'=>424243,'wait-badpid'=>0);
          my $status=$mode eq 'wait-nonzero'?256:0;
          @queue=({op=>'waitpid',role=>'child',got=>$returns{$mode},status=>$status});
          my $got;my $raw;
          my $ok=eval {$got=eval($mode eq 'wait-badpid'?q{waitpid(424243,$wnohang)}:q{waitpid(424242,$wnohang)});
            my $error=$@;$raw=$?;$check->();$fail->() if length($error);1;};
          my $error=$@;$check->();$fail->() unless $ok&&!length($error)&&$raw==$status;
          $out={got=>$got,rawStatus=>$raw};
        } elsif($mode eq 'signal'||$mode eq 'signal-badpid') {
          @queue=({op=>'kill',role=>'child',signal=>'TERM',result=>1},
            {op=>'kill',role=>'child',signal=>'KILL',result=>0});
          my @results;my $ok=eval {
            push @results,eval($mode eq 'signal-badpid'?q{kill('TERM',424243)}:q{kill('TERM',424242)});
            my $error=$@;$check->();$fail->() if length($error);
            push @results,eval q{kill('KILL',424242)};my $last=$@;$check->();$fail->() if length($last);1;
          };my $error=$@;$check->();$fail->() unless $ok&&!length($error);
          $out={results=>\@results};
        } elsif($mode=~/\Areadiness-(?:timeout|stale|error|throw|membership|foreign)\z/) {
          require Errno;
          my $eintr_fn='Errno'->can('EINTR');$fail->() unless defined($eintr_fn);
          my $eintr=$eintr_fn->();
          my $selector=IO::Select->new($stdout,$setup);
          $fail->() unless $selector->count()==2&&$selector->exists($stdout)&&$selector->exists($setup);
          if($mode eq 'readiness-membership') {
            $selector->remove($setup);$core_close->($roles{setup}) or $fail->();
            $fail->() unless $selector->count()==1&&$selector->exists($stdout);
          }
          @queue=({op=>'ready',role=>'fixture',mode=>$mode});
          no warnings qw(once redefine);
          local *IO::Select::can_read=sub {
            my $entry_errno=0+$!;
            $fail->() unless wantarray&&@_==2&&$_[0]==$selector&&defined($_[1])&&!ref($_[1])&&$_[1]==0.01;
            my $e=$next->('ready','fixture');
            for my $fh($selector->handles()) {$identify->($fh);}
            $event->(op=>'ready',role=>'fixture',timeout=>$_[1]);
            if($e->{mode} eq 'readiness-throw') {die "TEST_NOMINATED_READY_THROW\n";}
            $!=($e->{mode} eq 'readiness-error'?$eintr:$entry_errno);
            return $e->{mode} eq 'readiness-membership'?($stdout):();
          };
          use warnings qw(once redefine);
          $!=13;my @ready;my $errno;
          my $ok=eval {$!=0 unless $mode eq 'readiness-stale';
            @ready=($mode eq 'readiness-foreign'?IO::Select->new():$selector)->can_read(0.01);$errno=0+$!;1;};
          my $error=$@;$check->();
          if($mode eq 'readiness-throw') {
            $fail->() unless !$ok&&$error eq "TEST_NOMINATED_READY_THROW\n";
            $out={thrown=>JSON::PP::true,ready=>[],errno=>undef};
          } else {
            $fail->() unless $ok&&!length($error)&&@ready==($mode eq 'readiness-membership'?1:0)
              &&$errno==($mode eq 'readiness-error'?$eintr:$mode eq 'readiness-stale'?13:0);
            $out={thrown=>JSON::PP::false,ready=>[map {$identify->($_)->{role}} @ready],errno=>$errno};
          }
        } elsif($mode eq 'trace-overflow') {
          $event->(op=>'fixture-trace',role=>'fixture') for 1..65;
          $check->();$fail->();
        } elsif($mode eq 'sticky-fault') {
          my $ignored=eval q{syswrite($input,'unexpected')};my $error=$@;
          $check->();$fail->();
        } else {$fail->();}
        $check->();$fail->() if @queue;1;
      };my $primary=$@;
      $fault='TEST_PARENT_PORT_HARNESS_FAULT' unless $body_ok||length($fault);
      my @cleanup_errors;
      for my $r(@owned) {
        next if $r->{closed};
        if($r->{attempted}) {push @cleanup_errors,$r->{role};next;}
        my $ok=eval {$core_close->($r)};my $error=$@;
        push @cleanup_errors,$r->{role} unless $ok&&!length($error)&&$r->{closed};
      }
      if(length($fault)||!$body_ok||@cleanup_errors) {
        if($q->{record}{mode} eq 'allocation-fault'||$q->{record}{mode} eq 'trace-overflow') {
          my $closed=grep {$_->{closed}} @owned;
          die "TEST_PARENT_PORT_HARNESS_FAULT\nTEST_PARENT_PORT_CLEANUP=$closed/".scalar(@owned)."\n";
        }
        die "TEST_PARENT_PORT_HARNESS_FAULT\nTEST_PARENT_PORT_PRIMARY=".substr($primary,0,512)
          if length($primary)&&$primary ne "TEST_PARENT_PORT_HARNESS_FAULT\n";
        die "TEST_PARENT_PORT_HARNESS_FAULT\n";
      }
      $out->{scope}=$protocol?'ordinary-parent-consumer-harness-only':'parent-external-ports-harness-only';
      $out->{consumerInvoked}=$protocol?JSON::PP::true:JSON::PP::false;
      $out->{fixtureClosed}=scalar(@owned);$out->{events}=\@events;$out->{harnessFault}=undef;
      print JSON::PP->new->canonical->utf8->encode($out);exit 0;
    }
`;
function systemObject(kind,record,expected,{sourceOverride}={}) {
  assert.ok(ordinaryHost(),'mutable test declarations require an ordinary macOS real/effective UID');
  assert.ok(existsSync(BOOTSTRAP),'system supervisor implementation missing');
  // Load only declarations in the ordinary test process. No production test
  // options/entry points: remove the sole final main call in memory, not on disk.
  let source=replaceOnce(sourceOverride??readFileSync(BOOTSTRAP,'utf8'),'\ntask6a_origin_main();\n','\n');
  if(kind==='parent-protocol') {
    source=replaceOnce(source,'sub task6a_origin_parent_require_unburned {',String.raw`
my ($test_saved_admission,%test_saved_fields,@test_saved_custody);
my ($test_admission_mutated,$test_admission_restored)=(0,0);
sub test_verify_parent_custody {
    $fail->() unless @_==0&&@parent_originals==4&&@test_saved_custody==4&&$parent_original_pid==424242;
    for my $index(0..3) {
        my $now=$parent_originals[$index];my $saved=$test_saved_custody[$index];
        $fail->() unless $now==$saved->{record}&&$now->{fh}==$saved->{fh}&&$now->{fd}==$saved->{fd}
            &&$now->{fh}==$roles{('input','stdout','stderr','setup')[$index]}{fh}
            &&@{$now->{identity}}==13;
        for my $field(0..12) {$fail->() unless $now->{identity}[$field]==$saved->{identity}[$field];}
    }
}
sub test_change_parent_admission {
    $fail->() unless @_==0&&$admission_case&&!$test_admission_mutated&&!$test_admission_restored
        &&ref($test_saved_admission) eq 'HASH'&&$parent_admission==$test_saved_admission;
    test_verify_parent_custody();
    $mode=~/\Aadmission-(?:initial|drift)-(.+)\z/ or $fail->();my $case=$1;
    if($case=~/\Aalias-(input|stdout|stderr|setup)\z/) {
        my %next=(input=>'stdout',stdout=>'stderr',stderr=>'setup',setup=>'input');
        $parent_admission->{$1}=$test_saved_fields{$next{$1}};
    } elsif($case=~/\Areplacement-(input|stdout|stderr|setup)\z/) {
        $parent_admission->{$1}=$roles{$1.'-peer'}{fh};
    } elsif($case=~/\Amissing-(pid|input|stdout|stderr|setup)\z/) {delete $parent_admission->{$1};}
    elsif($case eq 'extra') {$parent_admission->{unexpected}=1;}
    elsif($case eq 'copy') {$parent_admission={%test_saved_fields};}
    elsif($case eq 'absent') {$parent_admission=undef;}
    elsif($case eq 'pid-number') {$parent_admission->{pid}=424243;}
    elsif($case eq 'pid-zero') {$parent_admission->{pid}=0;}
    elsif($case eq 'pid-negative') {$parent_admission->{pid}=-1;}
    elsif($case eq 'pid-fraction') {$parent_admission->{pid}=424242.5;}
    elsif($case eq 'pid-ref') {$parent_admission->{pid}=\424242;}
    elsif($case eq 'pid-string') {$parent_admission->{pid}='424242';}
    elsif($case eq 'pid-over') {$parent_admission->{pid}=2147483648;}
    elsif($case eq 'pid-nan'||$case eq 'pid-infinity') {
        my $v=$case eq 'pid-nan'?POSIX::nan():POSIX::HUGE_VAL();my $flags=B::svref_2object(\$v)->FLAGS;
        $fail->() unless ($flags&(B::SVf_IOK()|B::SVf_NOK()))&&!($flags&B::SVf_POK())
            &&($case eq 'pid-nan'?POSIX::isnan($v):POSIX::isinf($v));
        $parent_admission->{pid}=$v;
    } else {$fail->();}
    $test_admission_mutated=1;test_verify_parent_custody();
    $event->(op=>'admission-mutation',role=>'fixture',mode=>$mode);
}
sub test_restore_parent_admission {
    $fail->() unless @_==0&&$admission_case&&$test_admission_mutated&&!$test_admission_restored;
    test_verify_parent_custody();
    %$test_saved_admission=%test_saved_fields;$parent_admission=$test_saved_admission;
    $test_admission_restored=1;test_verify_parent_custody();
    $event->(op=>'admission-restored',role=>'fixture',mode=>$mode);
}
sub test_initialize_parent {
    my ($input,$stdout,$stderr,$setup)=@_;
    @parent_originals=map {+{fh=>$_}} ($input,$stdout,$stderr,$setup);
    my %fds;
    for my $record(@parent_originals) {
        $record->{fd}=fileno($record->{fh});$record->{identity}=[CORE::stat($record->{fh})];
        $fail->() unless defined($record->{fd})&&!$fds{$record->{fd}}++
            &&@{$record->{identity}}==13&&Fcntl::S_ISFIFO($record->{identity}[2]);
    }
    $parent_original_pid=424242;
    $parent_original_admission={pid=>424242,input=>$input,stdout=>$stdout,stderr=>$stderr,setup=>$setup};
    $parent_admission=$parent_original_admission;
    if($admission_case||$mode eq 'fd-rebinding-input') {
        $test_saved_admission=$parent_admission;%test_saved_fields=%$parent_admission;
        @test_saved_custody=map {+{record=>$_,fh=>$_->{fh},fd=>$_->{fd},identity=>[@{$_->{identity}}]}} @parent_originals;
        test_change_parent_admission() if $mode=~/\Aadmission-initial-/;
    }
    if($mode eq 'admission-copy') {$parent_admission={%$parent_original_admission};}
    if($mode eq 'admission-pid-string') {$parent_admission->{pid}='424242';}
    if($mode eq 'pid-over') {$parent_original_pid=2147483648;$parent_admission->{pid}=2147483648;}
    if($mode eq 'pid-infinity') {
        my $v=POSIX::HUGE_VAL();my $flags=B::svref_2object(\$v)->FLAGS;
        $fail->() unless ($flags&(B::SVf_IOK()|B::SVf_NOK()))&&!($flags&B::SVf_POK())&&POSIX::isinf($v);
        $parent_original_pid=$v;$parent_admission->{pid}=$v;
    }
}
sub task6a_origin_parent_require_unburned {`);
    if(record.mode==='input-close-scaffold') {
      // Identical test-copy scaffold in baseline and mutant. No delivered code
      // changes: omit the compound input close, but retain ending/lifetime gates.
      source=replaceOnce(source,'$parent_close->(0);','');
      source=replaceOnce(source,'$parent_final_end=1;','$parent_final_end=1;test_observe_parent_final_end();');
      source=replaceOnce(source,'sub task6a_origin_parent_require_unburned {',String.raw`
sub test_observe_parent_final_end {
    $fail->() unless @_==0;
    my $r=$roles{input};my $fd=fileno($r->{fh});
    $fail->() unless defined($fd)&&$fd==$r->{fd}&&!$r->{closed};
    $!=0;my $flags=CORE::fcntl($r->{fh},Fcntl::F_GETFD(),0);my $errno=0+$!;
    $fail->() unless defined($flags)&&$errno==0;
    $event->(op=>'final-END-accepted',role=>'input',physicalInputOpen=>JSON::PP::true,fd=>$fd);
}
sub task6a_origin_parent_require_unburned {`);
    }
  }
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
    ${PARENT_PORT_PROGRAM}
    if($q->{kind} eq 'parent-clock') {
      require Time::HiRes; require B; require POSIX;
      my $fault='';my $calls=0;my @witnesses;my @queue;
      my $fault_check=sub {die "$fault\n" if length($fault);};
      my $fail=sub {$fault='TEST_PARENT_CLOCK_HARNESS_FAULT';die "$fault\n";};
      $fail->() unless ref($q->{record}) eq 'HASH'
        &&join(',',sort keys %{$q->{record}}) eq 'arity,iterations,samples'
        &&ref($q->{record}{samples}) eq 'ARRAY'&&@{$q->{record}{samples}}<=32;
      for my $key('iterations','arity') {
        my $v=$q->{record}{$key};$fail->() unless defined($v)&&!ref($v);
        my $flags=B::svref_2object(\$v)->FLAGS;
        $fail->() if $flags&B::SVf_POK();
        $fail->() unless $flags&(B::SVf_IOK()|B::SVf_NOK());
        $fail->() unless $v>=0&&$v==int($v)&&$v<=($key eq 'arity'?1:8);
      }
      @queue=@{$q->{record}{samples}};
      my $factory=sub {
        my ($name)=@_;my ($v,$kind);
        if(!defined($name)||ref($name)) {$fail->();}
        if($name eq 'zero') {$v=0;$kind='numeric';}
        elsif($name eq 'half') {$v=0.5;$kind='numeric';}
        elsif($name eq 'one') {$v=1;$kind='numeric';}
        elsif($name eq 'limit') {$v=1e12;$kind='numeric';}
        elsif($name eq 'over') {$v=1e12+1;$kind='numeric';}
        elsif($name eq 'negative') {$v=-1;$kind='numeric';}
        elsif($name eq 'string') {$v='1';$kind='string';}
        elsif($name eq 'dual') {$v=1;my $text="$v";$kind='dual';}
        elsif($name eq 'undefined') {$v=undef;$kind='undefined';}
        elsif($name eq 'reference') {$v=[];$kind='reference';}
        elsif($name eq 'nan'||$name eq 'infinity') {
          my $ok=eval {$v=$name eq 'nan'?POSIX::nan():POSIX::HUGE_VAL();1;};my $error=$@;
          $fail->() unless $ok&&!length($error)&&defined($v)&&!ref($v);
          $kind=$name;
        } else {$fail->();}
        my $flags=B::svref_2object(\$v)->FLAGS;
        my $public_numeric=$flags&(B::SVf_IOK()|B::SVf_NOK());
        my $public_string=$flags&B::SVf_POK();
        if($kind eq 'numeric'||$kind eq 'nan'||$kind eq 'infinity') {
          $fail->() unless defined($v)&&!ref($v)&&$public_numeric&&!$public_string;
        } elsif($kind eq 'string') {$fail->() unless $public_string&&!$public_numeric;}
        elsif($kind eq 'dual') {$fail->() unless $public_string&&$public_numeric;}
        elsif($kind eq 'undefined') {$fail->() if defined($v)||$public_numeric||$public_string;}
        elsif($kind eq 'reference') {$fail->() unless ref($v) eq 'ARRAY';}
        if($kind eq 'nan') {$fail->() unless POSIX::isnan($v);}
        if($kind eq 'infinity') {$fail->() unless POSIX::isinf($v)&&!POSIX::isfinite($v);}
        my $after=B::svref_2object(\$v)->FLAGS;
        $fail->() unless ($after&(B::SVf_IOK()|B::SVf_NOK()|B::SVf_POK()))
          ==($flags&(B::SVf_IOK()|B::SVf_NOK()|B::SVf_POK()));
        push @witnesses,{kind=>$kind,numeric=>$public_numeric?JSON::PP::true:JSON::PP::false,
          string=>$public_string?JSON::PP::true:JSON::PP::false};
        return $v;
      };
      {
        no warnings 'redefine';
        local *Time::HiRes::clock_gettime=sub (;$) {
          ++$calls;
          $fail->() unless @_==1&&$_[0]==Time::HiRes::CLOCK_MONOTONIC()&&@queue;
          my $name=shift @queue;
          $fail->() unless defined($name)&&!ref($name);
          if($name eq 'throw') {
            $fail->() unless $calls==2;
            die "TEST_NOMINATED_CLOCK_THROW\n";
          }
          my $v;my $ok=eval {$v=$factory->($name);1;};my $error=$@;
          $fail->() unless $ok&&!length($error);
          my $flags=B::svref_2object(\$v)->FLAGS;my $last=$witnesses[-1];
          $fail->() unless !!($flags&(B::SVf_IOK()|B::SVf_NOK()))==!!$last->{numeric}
            &&!!($flags&B::SVf_POK())==!!$last->{string};
          return $v;
        };
        my $source=MIME::Base64::decode_base64($ARGV[0]);
        my $loaded=eval($source."\n1;\n");my $startup_error=$@;
        $fault_check->();
        $fail->() unless $loaded&&!length($startup_error);
        my @values;
        my $ok=eval {
          for(1..$q->{record}{iterations}) {
            my $v=$q->{record}{arity}?task6a_origin_now(1):task6a_origin_now();
            push @values,$v;
          }
          1;
        };my $primary=$@;
        $fault_check->();
        my $refused=!$ok&&$primary eq "TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n";
        my $escaped=!$ok&&$primary eq "TEST_NOMINATED_CLOCK_THROW\n"&&$calls==2;
        $fail->() unless $ok||$refused||$escaped;
        $out={accepted=>$ok?JSON::PP::true:JSON::PP::false,
          refused=>$refused?JSON::PP::true:JSON::PP::false,
          escapedNominatedThrow=>$escaped?JSON::PP::true:JSON::PP::false,
          values=>\@values,clockCalls=>$calls,witnesses=>\@witnesses,harnessFault=>undef};
      }
      $fault_check->();
      print JSON::PP->new->canonical->utf8->encode($out);exit 0;
    }
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
function parentClock(samples,{iterations=samples.length-1,arity=0}={}) {
  return systemObject('parent-clock',{samples,iterations,arity},'');
}
function clockDiagnostic(samples,options) {
  const r=parentClock(samples,options);
  assert.equal(r.status,0,r.stderr.toString());assert.equal(r.stderr.length,0);
  const out=JSON.parse(r.stdout);assert.equal(out.harnessFault,null);return out;
}
test('Perl parent clock preserves zero, equality, fractions and inclusive bound',()=>{
  const out=clockDiagnostic(['zero','zero','half','half','one','limit']);
  assert.equal(out.accepted,true);assert.equal(out.refused,false);
  assert.equal(out.escapedNominatedThrow,false);
  assert.deepEqual(out.values,[0,0.5,0.5,1,1000000000000]);
  assert.equal(out.clockCalls,6);
  assert.deepEqual(out.witnesses,Array.from({length:6},()=>({kind:'numeric',numeric:true,string:false})));
});
for(const [name,kind,numeric,string] of [
  ['string','string',false,true],['dual','dual',true,true],
  ['undefined','undefined',false,false],['reference','reference',false,false],
  ['nan','nan',true,false],['infinity','infinity',true,false],
  ['negative','numeric',true,false],['over','numeric',true,false],
]) test(`Perl parent clock refuses ${name} scalar without coercion`,()=>{
  const out=clockDiagnostic(['zero',name]);
  assert.equal(out.accepted,false,'actual clock validator accepted invalid scalar');
  assert.equal(out.refused,true);assert.equal(out.escapedNominatedThrow,false);
  assert.deepEqual(out.values,[]);assert.equal(out.clockCalls,2);
  assert.deepEqual(out.witnesses,[{kind:'numeric',numeric:true,string:false},{kind,numeric,string}]);
});
test('Perl parent clock refuses backward samples',()=>{
  const out=clockDiagnostic(['zero','one','half']);
  assert.equal(out.accepted,false);assert.equal(out.refused,true);
  assert.deepEqual(out.values,[1]);assert.equal(out.clockCalls,3);
});
test('Perl parent clock normalizes the nominated external throw to exact refusal',()=>{
  const out=clockDiagnostic(['zero','throw']);
  assert.equal(out.accepted,false);assert.equal(out.refused,true);
  assert.equal(out.escapedNominatedThrow,false);assert.equal(out.clockCalls,2);
});
test('Perl parent clock rejects nonzero arity before another external sample',()=>{
  const out=clockDiagnostic(['zero','one'],{arity:1});
  assert.equal(out.accepted,false);assert.equal(out.refused,true);
  assert.deepEqual(out.values,[]);assert.equal(out.clockCalls,1);
});
for(const [name,samples,options] of [
  ['exhausted queue',['zero'],{iterations:1}],
  ['unknown factory',['zero','unknown'],{}],
  ['invalid iterations',['zero'],{iterations:'1'}],
  ['throw at startup',['throw','one'],{}],
]) test(`Perl parent clock harness exposes ${name} instead of semantic refusal`,()=>{
  const r=parentClock(samples,options);
  assert.notEqual(r.status,0);assert.equal(r.stdout.length,0);
  assert.match(r.stderr.toString(),/TEST_PARENT_CLOCK_HARNESS_FAULT/);
  assert.doesNotMatch(r.stderr.toString(),/TASK6A_ORIGIN_BOOTSTRAP_REFUSED/);
});
function parentPortDiagnostic(mode,fixtureClosed=8) {
  const r=systemObject('parent-ports',{mode},'');
  assert.equal(r.status,0,r.stderr.toString());assert.equal(r.stderr.length,0);
  const out=JSON.parse(r.stdout);
  assert.equal(out.scope,'parent-external-ports-harness-only');
  assert.equal(out.consumerInvoked,false);assert.equal(out.harnessFault,null);
  assert.equal(out.fixtureClosed,fixtureClosed);
  assert.deepEqual(out.events.map(e=>e.seq),Array.from({length:out.events.length},(_,i)=>i+1));
  const attempts=out.events.filter(e=>e.op==='close-attempt');
  const closed=out.events.filter(e=>e.op==='close-result');
  assert.equal(attempts.length,fixtureClosed);assert.equal(closed.length,fixtureClosed);
  assert.equal(new Set(attempts.map(e=>e.role)).size,fixtureClosed);
  assert.ok(closed.every(e=>e.result===1&&e.definite===1&&e.errno===0));
  return out;
}
test('Perl parent protocol harness assigns the caller handle and reuses only closed setup FD',()=>{
  const out=parentPortDiagnostic('sysopen',10);
  assert.equal(out.callerAssigned,true);assert.equal(out.newReference,true);
  assert.equal(out.reusedClosedFd,true);
  const close=out.events.find(e=>e.op==='close-result'&&e.role==='setup');
  const open=out.events.find(e=>e.op==='sysopen');
  assert.ok(close.seq<open.seq,'entropy acquired before definite setup closure');
});
test('Perl parent protocol harness witnesses owned live input FD rebinding while preserving old endpoint',t=>{
  const out=parentPortDiagnostic('fd-rebinding',11);
  const bindings=out.events.filter(e=>e.op==='fd-rebinding-witness');assert.equal(bindings.length,1);
  const b=bindings[0];assert.equal(b.role,'input');assert.equal(b.errno,0);
  assert.equal(b.originalFd,b.currentFd);assert.notEqual(b.sourceFd,b.currentFd);
  assert.notEqual(b.holdFd,b.currentFd);assert.notEqual(b.holdFd,b.sourceFd);
  assert.notEqual(b.actualReturn,null);assert.equal(b.oldIdentity.length,7);
  assert.deepEqual(b.holdIdentity,b.oldIdentity);assert.deepEqual(b.currentIdentity,b.sourceIdentity);
  assert.notDeepEqual(b.currentIdentity,b.oldIdentity);
  const survival=out.events.filter(e=>e.op==='fd-rebinding-survival');assert.equal(survival.length,1);
  assert.deepEqual([survival[0].holdOpen,survival[0].sourceOpen],[true,true]);
  assert.deepEqual(survival[0].holdIdentity,b.oldIdentity);assert.deepEqual(survival[0].sourceIdentity,b.sourceIdentity);
  assert.ok(b.seq<survival[0].seq);
  for(const role of ['input-hold','replacement','replacement-peer']) {
    assert.ok(survival[0].seq<out.events.find(e=>e.op==='close-attempt'&&e.role===role).seq);
  }
  t.diagnostic(JSON.stringify({actualReturn:b.actualReturn,prototype:b.prototype,identityDifferent:true,
    originalFd:b.originalFd,sourceFd:b.sourceFd,holdFd:b.holdFd}));
});
test('Perl parent protocol harness configures actual owned input binary mode',()=>{
  const out=parentPortDiagnostic('binmode');
  assert.equal(out.configured,true);assert.equal(out.returned,true);assert.equal(out.thrown,false);
  assert.equal(out.events.filter(e=>e.op==='binmode'&&e.role==='input').length,1);
});
for(const failure of ['false','throw'])
  test(`Perl parent protocol harness nominates binmode ${failure} only after actual configuration`,()=>{
    const out=parentPortDiagnostic(`binmode-${failure}`);
    assert.equal(out.configured,true);assert.equal(out.returned,false);assert.equal(out.thrown,failure==='throw');
    const actual=out.events.filter(e=>e.op==='binmode'),nom=out.events.filter(e=>e.op==='binmode-nomination');
    assert.equal(actual.length,1);assert.equal(nom.length,1);
    assert.deepEqual([actual[0].role,actual[0].result,actual[0].errno],['input',1,0]);
    assert.deepEqual([nom[0].outcome,nom[0].actualConfigured],[failure,true]);
    assert.ok(actual[0].seq<nom[0].seq);
  });
test('Perl parent protocol harness mutates the actual sysread caller buffer at offset',()=>{
  const out=parentPortDiagnostic('sysread');
  assert.equal(out.count,3);assert.equal(out.buffer,'ABXYZ');
  const reads=out.events.filter(e=>e.op==='sysread');
  assert.equal(reads.length,1);assert.equal(reads[0].buffer,'ABXYZ');
  assert.equal(reads[0].count,3);assert.equal(reads[0].errno,0);
});
test('Perl parent protocol harness independently receives exact syswrite requests and offsets',()=>{
  const out=parentPortDiagnostic('syswrite');
  assert.deepEqual(out.observed,['ABC','DE','IJ']);
  const writes=out.events.filter(e=>e.op==='syswrite');
  assert.deepEqual(writes.map(e=>e.count),[3,2,2]);
  assert.deepEqual(writes.map(e=>e.observed),['ABC','DE','IJ']);
  assert.ok(writes.every(e=>e.errno===0));
});
for(const [mode,count,buffer] of [['sysread-default',3,'XYZ'],['sysread-eof',0,'']])
  test(`Perl parent protocol harness witnesses ${mode} on the actual caller buffer`,()=>{
    const out=parentPortDiagnostic(mode);
    assert.equal(out.count,count);assert.equal(out.buffer,buffer);
    const reads=out.events.filter(e=>e.op==='sysread');
    assert.equal(reads.length,1);assert.equal(reads[0].count,count);
    assert.equal(reads[0].buffer,buffer);assert.equal(reads[0].errno,0);
    if(mode==='sysread-eof') {
      assert.ok(out.events.find(e=>e.op==='close-result'&&e.role==='stdout-peer').seq<reads[0].seq);
    }
  });
for(const [mode,ready,errno,thrown] of [
  ['readiness-timeout',[],0,false],['readiness-stale',[],13,false],['readiness-error',[],4,false],
  ['readiness-throw',[],null,true],['readiness-membership',['stdout'],0,false],
]) test(`Perl parent protocol harness distinguishes ${mode} with retained selector membership`,()=>{
  const out=parentPortDiagnostic(mode);
  assert.deepEqual(out.ready,ready);assert.equal(out.errno,errno);assert.equal(out.thrown,thrown);
  const events=out.events.filter(e=>e.op==='ready');
  assert.equal(events.length,1);assert.equal(events[0].timeout,0.01);
  if(mode==='readiness-membership') {
    assert.ok(out.events.find(e=>e.op==='close-result'&&e.role==='setup').seq<events[0].seq);
  }
});
test('Perl parent protocol harness preserves native-zero fcntl success and actual flags',()=>{
  const out=parentPortDiagnostic('fcntl');
  assert.equal(out.nonblocking,true);assert.equal(out.cloexec,true);
  assert.equal(out.zeroSuccess,'0 but true');
});
for(const [mode,got,rawStatus] of [
  ['wait-live',0,0],['wait-zero',424242,0],['wait-nonzero',424242,256],
  ['wait-undefined',null,0],['wait-negative',-1,0],['wait-foreign',424243,0],
]) test(`Perl parent protocol harness returns ${mode} with immediate raw wait status`,()=>{
  const out=parentPortDiagnostic(mode);
  assert.equal(out.got,got);assert.equal(out.rawStatus,rawStatus);
  const waits=out.events.filter(e=>e.op==='waitpid');
  assert.equal(waits.length,1);assert.equal(waits[0].pid,424242);
  assert.equal(waits[0].result,got);assert.equal(waits[0].status,rawStatus);
  assert.equal(out.events.filter(e=>e.op==='signal-attempt').length,0);
});
test('Perl parent protocol harness records nominated signals without CORE delegation',()=>{
  const out=parentPortDiagnostic('signal');
  assert.deepEqual(out.results,[1,0]);
  const signals=out.events.filter(e=>e.op==='signal-attempt');
  assert.deepEqual(signals.map(e=>e.signal),['TERM','KILL']);
  assert.deepEqual(signals.map(e=>e.pid),[424242,424242]);
});
test('Perl parent protocol harness retains stable real FIFO stat fields across I/O',()=>{
  const out=parentPortDiagnostic('stat-pipe');
  assert.equal(out.fields,13);assert.equal(out.stablePipeIdentity,true);
  assert.equal(out.events.filter(e=>e.op==='stat').length,1);
});
test('Perl parent protocol harness limits synthetic entropy metadata to nominated path and handle',()=>{
  const out=parentPortDiagnostic('stat-entropy',10);
  assert.equal(out.syntheticEntropy,true);
  assert.deepEqual(out.tuples,[
    [11,22,8630,1,0,0,33,0,0,0,0,4096,0],
    [11,22,8630,1,0,0,33,0,0,0,0,4096,0],
    [11,22,8630,1,0,0,33,0,0,0,0,4096,0],
  ]);
  assert.deepEqual(out.events.filter(e=>e.op==='stat'||e.op==='lstat').map(e=>e.op),['lstat','stat','lstat']);
});
for(const [mode,returned] of [['close',1],['close-uncertain',0]])
  test(`Perl parent protocol harness distinguishes ${mode} return from definite physical closure`,()=>{
    const out=parentPortDiagnostic(mode);
    assert.equal(out.returned,returned);assert.equal(out.attempted,1);assert.equal(out.definite,1);
    assert.equal(out.events.filter(e=>e.op==='nominated-close-uncertainty').length,mode==='close-uncertain'?1:0);
  });
for(const [mode,closed] of [['allocation-fault',2],['trace-overflow',8]])
  test(`Perl parent protocol harness closes every acquired end despite ${mode}`,()=>{
    const r=systemObject('parent-ports',{mode},'');
    assert.notEqual(r.status,0);assert.equal(r.stdout.length,0);
    assert.equal(r.stderr.toString(),`TEST_PARENT_PORT_HARNESS_FAULT\nTEST_PARENT_PORT_CLEANUP=${closed}/${closed}\n`);
  });
for(const mode of ['sticky-fault','unknown','readiness-foreign','wait-badpid','signal-badpid','stat-foreign'])
  test(`Perl parent protocol harness exposes ${mode} without refusal translation`,()=>{
    const r=systemObject('parent-ports',{mode},'');
    assert.notEqual(r.status,0);assert.equal(r.stdout.length,0);
    assert.equal(r.stderr.toString(),'TEST_PARENT_PORT_HARNESS_FAULT\n');
  });
test('Perl parent protocol completes exact bounded transcript',()=>{
  const source=readFileSync(BOOTSTRAP,'utf8');
  assert.match(source,/^sub task6a_origin_consume_entry_protocol\s*\{/m,
    'ordinary parent consumer declaration missing');
  const r=systemObject('parent-protocol',{mode:'success'},'');
  assert.equal(r.status,0,r.stderr.toString());
  assert.equal(r.stderr.length,0);
  const out=JSON.parse(r.stdout);
  assert.deepEqual(out.consumer,{scope:'parent-entry-protocol-diagnostic-only',
    productionAuthority:false,challengeCount:3,inputBytes:229,outputBytes:220,
    handlesClosed:5,reaped:true});
  assert.deepEqual(out.writes,[`CHALLENGE ${'1'.repeat(64)}\n`,
    `CHALLENGE ${'2'.repeat(64)}\n`,`CHALLENGE ${'3'.repeat(64)}\n`,'END\n']);
  assert.equal(out.harnessFault,null);
  assert.equal(out.consumerInvoked,true);assert.equal(out.fixtureClosed,10);
  const roles=new Set(['input','stdout','stderr','setup','entropy']);
  assert.deepEqual(out.events.filter(e=>e.op==='close-result'&&roles.has(e.role)).map(e=>e.role),
    ['setup','entropy','input','stderr','stdout']);
  assert.equal(out.events.filter(e=>e.op==='fcntl').length,23);
  assert.equal(out.events.filter(e=>e.op==='signal-attempt').length,0);
  assert.equal(out.events.filter(e=>e.op==='sysread'&&e.role==='stdout').reduce((n,e)=>n+e.count,0),220);
  assert.deepEqual(out.events.filter(e=>e.op==='sysread'&&e.role==='entropy').map(e=>e.count),[32,32,32]);
});
for(const mode of ['absent','arity','admission-copy','admission-pid-string','pid-infinity','pid-over'])
  test(`Perl parent protocol refuses ${mode} without protocol or PID effects and stays burned`,()=>{
    const r=systemObject('parent-protocol',{mode},'');
    assert.equal(r.status,0,r.stderr.toString());assert.equal(r.stderr.length,0);
    const out=JSON.parse(r.stdout);
    assert.equal(out.refused,true);assert.equal(out.repeatRefused,true);assert.equal(out.guardBurned,true);
    assert.equal(out.effectsAfterRepeat,0);assert.equal(out.harnessFault,null);assert.equal(out.fixtureClosed,8);
    assert.equal(out.consumer,undefined);
    assert.ok(out.consumerEvents.every(e=>e.op==='close-attempt'||e.op==='close-result'));
    assert.deepEqual(out.consumerEvents.filter(e=>e.op==='close-result').map(e=>e.role),
      mode==='absent'?[]:['input','stdout','stderr','setup']);
    assert.ok(out.consumerEvents.filter(e=>e.op==='close-result').every(e=>e.result===1&&e.definite===1));
  });
test('Perl parent protocol refuses settled repetition without new effects or handle revival',()=>{
  const out=parentProtocolTrace('settled-repeat');
  assert.equal(out.accepted,true);assert.equal(out.fixtureClosed,10);
  assert.deepEqual(out.consumer,{scope:'parent-entry-protocol-diagnostic-only',productionAuthority:false,
    challengeCount:3,inputBytes:229,outputBytes:220,handlesClosed:5,reaped:true});
  assert.equal(out.settledRepeatRefused,true);assert.equal(out.effectsAfterSettledRepeat,0);
  assert.equal(out.guardBurnedAfterSettledRepeat,true);
  assert.deepEqual(out.writes,[`CHALLENGE ${'1'.repeat(64)}\n`,`CHALLENGE ${'2'.repeat(64)}\n`,
    `CHALLENGE ${'3'.repeat(64)}\n`,'END\n']);
  const originals=new Set(['input','stdout','stderr','setup','entropy']);
  const attempts=out.events.filter(e=>e.op==='close-attempt'&&originals.has(e.role));
  assert.deepEqual(attempts.map(e=>e.role),['setup','entropy','input','stderr','stdout']);
  assert.equal(out.events.filter(e=>e.op==='clock').length,46);
  assert.equal(out.events.filter(e=>e.op==='waitpid').length,33);
  assert.equal(out.events.filter(e=>e.op==='fcntl').length,23);
  assert.equal(out.events.filter(e=>e.op==='signal-attempt').length,0);
});
function parentProtocolTrace(mode,options={}) {
  const r=systemObject('parent-protocol',{mode},'',options);
  assert.equal(r.status,0,r.stderr.toString());assert.equal(r.stderr.length,0);
  const out=JSON.parse(r.stdout);assert.equal(out.harnessFault,null);return out;
}
function assertParentDeniedDisposal(out,{roles,fixtureClosed,waitCount,reapedBeforeRoles=[]}) {
  assert.equal(out.accepted,false);assert.equal(out.refused,true);assert.equal(out.guardBurned,true);
  assert.equal(out.repeatRefused,true);assert.equal(out.effectsAfterRepeat,0);assert.equal(out.fixtureClosed,fixtureClosed);
  const events=out.consumerEvents,originals=new Set(['input','stdout','stderr','setup','entropy']);
  const attempts=events.filter(e=>e.op==='close-attempt'&&originals.has(e.role));
  const closes=events.filter(e=>e.op==='close-result'&&originals.has(e.role));
  assert.deepEqual(attempts.map(e=>e.role),roles);assert.deepEqual(closes.map(e=>e.role),roles);
  assert.ok(closes.every((e,i)=>e.result===1&&e.definite===1&&attempts[i].seq<e.seq));
  const waits=events.filter(e=>e.op==='waitpid');assert.equal(waits.length,waitCount);
  assert.ok(waits.slice(0,-1).every(e=>e.pid===424242&&e.result===0&&e.status===0));
  const last=waits.at(-1);assert.deepEqual([last.pid,last.result,last.status],[424242,424242,0]);
  const afterReap=new Set(reapedBeforeRoles);
  assert.ok(closes.every(e=>afterReap.has(e.role)?e.seq>last.seq:e.seq<last.seq));
  assert.equal(events.filter(e=>e.op==='signal-attempt').length,0);
  return events;
}
// Break caught: initial-only admission checking or disposal through mutable
// selected handles. These fixtures mutate admission, never retained custody.
const ADMISSION_CASES=[...['input','stdout','stderr','setup'].map(role=>`alias-${role}`),
  ...['input','stdout','stderr','setup'].map(role=>`replacement-${role}`),
  ...['pid','input','stdout','stderr','setup'].map(role=>`missing-${role}`),
  'extra','pid-number','pid-zero','pid-negative','pid-fraction','pid-ref','pid-nan',
  'pid-string','pid-infinity','pid-over','copy','absent'];
for(const phase of ['initial','drift']) for(const problem of ADMISSION_CASES)
  test(`Perl parent protocol refuses admission ${phase} ${problem} and restored admission cannot revive it`,()=>{
    const mode=`admission-${phase}-${problem}`,out=parentProtocolTrace(mode);
    assert.equal(out.accepted,false);assert.equal(out.refused,true);assert.equal(out.guardBurned,true);
    assert.equal(out.repeatRefused,true);assert.equal(out.effectsAfterRepeat,0);assert.equal(out.fixtureClosed,8);
    assert.equal(out.admissionRestored,true);
    const mutations=out.events.filter(e=>e.op==='admission-mutation');
    const restored=out.events.filter(e=>e.op==='admission-restored');
    assert.equal(mutations.length,1);assert.equal(mutations[0].mode,mode);
    assert.equal(restored.length,1);assert.equal(restored[0].mode,mode);
    const events=out.consumerEvents,roles=['input','stdout','stderr','setup'];
    const closes=events.filter(e=>e.op==='close-result');
    assert.deepEqual(closes.map(e=>e.role),roles);
    assert.ok(closes.every(e=>e.seq<restored[0].seq));
    assert.equal(events.filter(e=>e.op==='ready'||e.op==='sysread'||e.op==='syswrite'||e.op==='sysopen'
      ||e.op==='lstat'||e.op==='signal-attempt').length,0);
    if(phase==='initial') {
      assert.ok(events.every(e=>e.op==='close-attempt'||e.op==='close-result'));
      assert.deepEqual(events.filter(e=>e.op==='close-attempt').map(e=>e.role),roles);
      assert.ok(closes.every((e,i)=>e.result===1&&e.definite===1
        &&events.filter(e=>e.op==='close-attempt')[i].seq<e.seq));
      assert.ok(mutations[0].seq<events[0].seq);
      assert.equal(out.events.filter(e=>e.op==='clock').length,1);
    } else {
      assertParentDeniedDisposal(out,{roles,fixtureClosed:8,waitCount:2});
      assert.equal(events.filter(e=>e.op==='clock').length,2);
      assert.equal(out.events.filter(e=>e.op==='clock').length,3);
      assert.deepEqual(roles.map(role=>events.filter(e=>e.op==='stat'&&e.role===role).length),[3,3,3,3]);
      assert.equal(events.filter(e=>e.op==='fcntl').length,20);
      assert.deepEqual(events.filter(e=>e.op==='admission-mutation').map(e=>e.mode),[mode]);
      const firstWait=events.find(e=>e.op==='waitpid');
      assert.ok(mutations[0].seq<firstWait.seq&&firstWait.seq<closes[0].seq);
    }
  });
// Break caught: accepting any partial/zero write, retrying it, accepting an
// undefined/throwing result, or accepting nonzero fresh errno after completion.
for(const [ordinal,size,clockCount,waitCount,statCounts,lstatCount,readCount,roles] of [
  [1,75,11,11,[12,12,12,7,5],2,3,['setup','input','stdout','stderr','entropy']],
  [2,75,19,19,[20,20,20,7,14],3,5,['setup','input','stdout','stderr','entropy']],
  [3,75,27,27,[28,28,28,7,22],4,7,['setup','entropy','input','stdout','stderr']],
  [4,4,33,33,[34,34,34,7,22],4,8,['setup','entropy','input','stdout','stderr']],
]) for(let completion=0;completion<size;completion++)
  test(`Perl parent protocol refuses write ${ordinal} short completion ${completion} without retry`,()=>{
    const out=parentProtocolTrace(`write-short-${ordinal}-${completion}`);
    const events=assertParentDeniedDisposal(out,{roles,fixtureClosed:10,waitCount});
    const nominations=events.filter(e=>e.op==='write-nomination');assert.equal(nominations.length,1);
    assert.deepEqual([nominations[0].requestLength,nominations[0].offset,nominations[0].outcome,
      nominations[0].actualWrite,nominations[0].physicalLength],[size,0,'short',true,completion]);
    const writes=events.filter(e=>e.op==='syswrite');assert.equal(writes.length,ordinal);
    const payloads=[`CHALLENGE ${'1'.repeat(64)}\n`,`CHALLENGE ${'2'.repeat(64)}\n`,
      `CHALLENGE ${'3'.repeat(64)}\n`,'END\n'];
    assert.deepEqual(writes.slice(0,-1).map(e=>e.observed),payloads.slice(0,ordinal-1));
    const last=writes.at(-1);
    assert.deepEqual([last.requestLength,last.count,last.errno,last.coreErrno,last.observed],
      [size,completion,0,0,payloads[ordinal-1].slice(0,completion)]);
    assert.ok(nominations[0].seq<last.seq);
    assert.equal(events.filter(e=>e.op==='clock').length,clockCount);
    assert.deepEqual(['input','stdout','stderr','setup','entropy'].map(role=>events.filter(e=>e.op==='stat'&&e.role===role).length),statCounts);
    assert.equal(events.filter(e=>e.op==='lstat').length,lstatCount);
    assert.equal(events.filter(e=>e.op==='sysopen').length,1);
    assert.equal(events.filter(e=>e.op==='fcntl').length,23);
    assert.equal(events.filter(e=>e.op==='ready').length,ordinal);
    assert.equal(events.filter(e=>e.op==='sysread').length,readCount);
  });
for(const [failure,errno,actualWrite] of [
  ['undefined',0,false],['throw',0,false],['eintr',4,false],['eagain',35,false],['error',5,false],['errno',5,true],
]) test(`Perl parent protocol refuses first write ${failure} without retry`,()=>{
  const events=assertParentDeniedDisposal(parentProtocolTrace(`write-failure-${failure}`),{
    roles:['setup','input','stdout','stderr','entropy'],fixtureClosed:10,waitCount:11});
  const nominations=events.filter(e=>e.op==='write-nomination');assert.equal(nominations.length,1);
  assert.deepEqual([nominations[0].requestLength,nominations[0].offset,nominations[0].outcome,
    nominations[0].errno,nominations[0].actualWrite],[75,0,failure,errno,actualWrite]);
  const writes=events.filter(e=>e.op==='syswrite');assert.equal(writes.length,actualWrite?1:0);
  if(actualWrite) assert.deepEqual([writes[0].count,writes[0].coreErrno,writes[0].errno,writes[0].observed],
    [75,0,5,`CHALLENGE ${'1'.repeat(64)}\n`]);
  assert.equal(events.filter(e=>e.op==='clock').length,11);
  assert.equal(events.filter(e=>e.op==='stat').length,48);
  assert.equal(events.filter(e=>e.op==='lstat').length,2);
  assert.equal(events.filter(e=>e.op==='fcntl').length,23);
  assert.equal(events.filter(e=>e.op==='ready').length,1);
  assert.equal(events.filter(e=>e.op==='sysread').length,3);
});
// Break caught: treating failed/invalid pipe reads as data, healthy readiness,
// or success; retrying uncertain closes or stopping other-original disposal.
for(const [failure,errno,actualRead,returned] of [
  ['undefined',0,false,null],['throw',0,false,null],['eintr',4,false,null],
  ['eagain',35,false,null],['error',5,false,null],['mismatch',0,true,69],
  ['over',0,true,72],['negative',0,true,-1],['fraction',0,true,69.5],['utf8',0,true,70],
]) test(`Perl parent protocol refuses first PONG read ${failure} without retry`,()=>{
  const events=assertParentDeniedDisposal(parentProtocolTrace(`read-failure-${failure}`),{
    roles:['setup','input','stdout','stderr','entropy'],fixtureClosed:10,waitCount:15});
  const nom=events.filter(e=>e.op==='read-nomination');assert.equal(nom.length,1);
  assert.deepEqual([nom[0].role,nom[0].ordinal,nom[0].requestLength,nom[0].outcome,nom[0].actualRead,nom[0].errno],
    ['stdout',2,71,failure,actualRead,errno]);
  if(actualRead) {
    assert.deepEqual([nom[0].actualCount,nom[0].returnedCount,nom[0].utf8,nom[0].buffer],
      [70,returned,failure==='utf8',`PONG ${'1'.repeat(64)}\n`]);
  } else assert.equal(nom[0].buffer,'');
  assert.equal(events.filter(e=>e.op==='sysread').length,actualRead?4:3);
  assert.equal(events.filter(e=>e.op==='clock').length,15);
  assert.equal(events.filter(e=>e.op==='stat').length,64);
  assert.equal(events.filter(e=>e.op==='ready').length,2);
  assert.deepEqual(events.filter(e=>e.op==='syswrite').map(e=>e.observed),[`CHALLENGE ${'1'.repeat(64)}\n`]);
});
for(const [failure,clockCount,waitCount,statCount,readyCount,errno] of [
  ['eintr',3,3,16,1,4],['throw',3,3,16,0,0],['duplicate',4,4,20,1,0],
  ['foreign',4,4,20,1,0],['timeout',4,3,16,1,0],
]) test(failure==='timeout'?'Perl parent protocol refuses deadline expiry after healthy readiness timeout'
  :`Perl parent protocol refuses readiness ${failure} with original-only disposal`,()=>{
  const out=parentProtocolTrace(`ready-failure-${failure}`);
  const events=assertParentDeniedDisposal(out,{roles:['input','stdout','stderr','setup'],fixtureClosed:8,waitCount});
  const nom=events.filter(e=>e.op==='ready-nomination');assert.equal(nom.length,1);
  assert.deepEqual([nom[0].outcome,nom[0].entryErrno,nom[0].errno],[failure,0,errno]);
  assert.equal(events.filter(e=>e.op==='clock').length,clockCount);
  assert.equal(events.filter(e=>e.op==='stat').length,statCount);
  assert.equal(events.filter(e=>e.op==='ready').length,readyCount);
  assert.equal(events.filter(e=>e.op==='sysread'||e.op==='syswrite'||e.op==='sysopen').length,0);
  if(failure==='timeout') assert.deepEqual(out.events.filter(e=>e.op==='clock').map(e=>e.value),[0,0,0,0,45]);
});
for(const [role,clockCount,waitCount,statCount,readCount,readyCount,fcntlCount,fixtureClosed,roles,afterReap] of [
  ['setup',6,6,28,1,1,20,8,['setup','input','stdout','stderr'],[]],
  ['entropy',26,26,110,7,3,23,10,['setup','entropy','input','stdout','stderr'],[]],
  ['input',33,33,131,8,4,23,10,['setup','entropy','input','stdout','stderr'],[]],
  ['stderr',38,33,141,9,5,23,10,['setup','entropy','input','stderr','stdout'],['stderr','stdout']],
  ['stdout',44,33,147,11,6,23,10,['setup','entropy','input','stderr','stdout'],['stderr','stdout']],
]) for(const failure of ['false','throw'])
  test(`Perl parent protocol refuses ${role} close ${failure} after physical close without retry`,()=>{
    const events=assertParentDeniedDisposal(parentProtocolTrace(`close-failure-${role}-${failure}`),{
      roles,fixtureClosed,waitCount,reapedBeforeRoles:afterReap});
    const nom=events.filter(e=>e.op==='close-nomination');assert.equal(nom.length,1);
    assert.deepEqual([nom[0].role,nom[0].outcome,nom[0].physicalClosed],[role,failure,true]);
    const close=events.find(e=>e.op==='close-result'&&e.role===role);
    assert.ok(close.seq<nom[0].seq);
    assert.equal(events.filter(e=>e.op==='clock').length,clockCount);
    assert.equal(events.filter(e=>e.op==='stat').length,statCount);
    assert.equal(events.filter(e=>e.op==='sysread').length,readCount);
    assert.equal(events.filter(e=>e.op==='ready').length,readyCount);
    assert.equal(events.filter(e=>e.op==='fcntl').length,fcntlCount);
    // Physical close is known to this ordinary test owner, but the consumer
    // observes false/throw and must never claim successful settlement or retry.
  });
for(const [problem,clockCount,waitCount,statCount,readyCount,readCount,writeCount,roles,afterReap,lastBytes] of [
  ['replay-pong2',24,24,101,3,6,2,['setup','input','stdout','stderr','entropy'],[],`PONG ${'1'.repeat(64)}\n`],
  ['future-pong2',24,24,101,3,6,2,['setup','input','stdout','stderr','entropy'],[],`PONG ${'3'.repeat(64)}\n`],
  ['ready-pong2',24,24,101,3,6,2,['setup','input','stdout','stderr','entropy'],[],'READY\n'],
  ['replay-pong3',32,32,128,4,8,3,['setup','entropy','input','stdout','stderr'],[],`PONG ${'2'.repeat(64)}\n`],
  ['ready-extra',8,8,34,1,2,0,['setup','input','stdout','stderr'],[],'READY\nP'],
  ['future-ready',8,8,34,1,2,0,['setup','input','stdout','stderr'],[],`PONG ${'1'.repeat(64)}\n`],
  ['end-extra',40,33,143,5,10,4,['setup','entropy','input','stderr','stdout'],['stderr','stdout'],'END\nX'],
  ['after-end',44,33,147,6,11,4,['setup','entropy','input','stderr','stdout'],['stderr','stdout'],'X'],
  ['end-malformed',40,33,143,5,10,4,['setup','entropy','input','stderr','stdout'],['stderr','stdout'],'ENX\n'],
]) test(`Perl parent protocol refuses frame ${problem} without successor or settlement`,()=>{
  const events=assertParentDeniedDisposal(parentProtocolTrace(`frame-${problem}`),{
    roles,fixtureClosed:writeCount?10:8,waitCount,reapedBeforeRoles:afterReap});
  assert.equal(events.filter(e=>e.op==='clock').length,clockCount);
  assert.equal(events.filter(e=>e.op==='stat').length,statCount);
  assert.equal(events.filter(e=>e.op==='ready').length,readyCount);
  assert.equal(events.filter(e=>e.op==='sysread').length,readCount);
  const writes=events.filter(e=>e.op==='syswrite');assert.equal(writes.length,writeCount);
  assert.deepEqual(writes.map(e=>e.observed),
    [`CHALLENGE ${'1'.repeat(64)}\n`,`CHALLENGE ${'2'.repeat(64)}\n`,`CHALLENGE ${'3'.repeat(64)}\n`,'END\n'].slice(0,writeCount));
  const stdout=events.filter(e=>e.op==='sysread'&&e.role==='stdout');
  assert.equal(stdout.at(-1).buffer,lastBytes);
  if(problem==='end-extra'||problem==='after-end') assert.equal(stdout.reduce((n,e)=>n+e.count,0),221);
});
for(const [frame,full,size,clockCount,waitCount,statCount,readyCount,readCount,writeCount,roles,afterReap] of [
  ['ready','READY\n',6,12,12,46,2,3,0,['setup','input','stdout','stderr'],[]],
  ['end','END\n',4,44,33,147,6,11,4,['setup','entropy','input','stderr','stdout'],['stderr','stdout']],
]) for(let length=1;length<size;length++)
  test(`Perl parent protocol refuses ${frame} prefix ${length} followed by actual EOF`,()=>{
    const events=assertParentDeniedDisposal(parentProtocolTrace(`frame-${frame}-eof-${length}`),{
      roles,fixtureClosed:writeCount?10:8,waitCount,reapedBeforeRoles:afterReap});
    const reads=events.filter(e=>e.op==='sysread'&&e.role==='stdout');
    assert.deepEqual(reads.slice(-2).map(e=>e.buffer),[full.slice(0,length),'']);
    assert.deepEqual(reads.slice(-2).map(e=>e.count),[length,0]);
    const peer=events.find(e=>e.op==='close-result'&&e.role==='stdout-peer');
    assert.ok(peer&&peer.result===1&&peer.definite===1&&peer.seq<reads.at(-1).seq);
    assert.equal(events.filter(e=>e.op==='clock').length,clockCount);
    assert.equal(events.filter(e=>e.op==='stat').length,statCount);
    assert.equal(events.filter(e=>e.op==='ready').length,readyCount);
    assert.equal(events.filter(e=>e.op==='sysread').length,readCount);
    assert.equal(events.filter(e=>e.op==='syswrite').length,writeCount);
  });
for(const [schedule,clockCount,waitCount,readyCount,statCounts,roles] of [
  ['ready-first',48,35,7,[36,47,41,11,22],['setup','entropy','input','stderr','stdout']],
  ['stderr-together',46,33,6,[34,45,43,7,22],['setup','entropy','input','stderr','stdout']],
  ['stderr-last',48,33,7,[34,43,47,7,22],['setup','entropy','input','stdout','stderr']],
  ['reap-last',46,40,6,[34,45,39,7,22],['setup','entropy','input','stderr','stdout']],
]) test(`Perl parent protocol completes independently scheduled ${schedule}`,()=>{
  const out=parentProtocolTrace(`finish-${schedule}`),events=out.events;
  assert.equal(out.accepted,true);assert.equal(out.fixtureClosed,10);
  assert.deepEqual(out.consumer,{scope:'parent-entry-protocol-diagnostic-only',productionAuthority:false,
    challengeCount:3,inputBytes:229,outputBytes:220,handlesClosed:5,reaped:true});
  assert.deepEqual(out.writes,[`CHALLENGE ${'1'.repeat(64)}\n`,`CHALLENGE ${'2'.repeat(64)}\n`,
    `CHALLENGE ${'3'.repeat(64)}\n`,'END\n']);
  assert.equal(events.filter(e=>e.op==='clock').length,clockCount);
  assert.equal(events.filter(e=>e.op==='waitpid').length,waitCount);
  assert.equal(events.filter(e=>e.op==='ready').length,readyCount);
  assert.equal(events.filter(e=>e.op==='sysread').length,11);
  assert.equal(events.filter(e=>e.op==='fcntl').length,23);
  assert.deepEqual(['input','stdout','stderr','setup','entropy'].map(role=>events.filter(e=>e.op==='stat'&&e.role===role).length),statCounts);
  const originals=new Set(roles),closes=events.filter(e=>e.op==='close-result'&&originals.has(e.role));
  const attempts=events.filter(e=>e.op==='close-attempt'&&originals.has(e.role));
  assert.deepEqual(closes.map(e=>e.role),roles);assert.deepEqual(attempts.map(e=>e.role),roles);
  assert.ok(closes.every((e,i)=>e.result===1&&e.definite===1&&attempts[i].seq<e.seq));
  const stdout=events.filter(e=>e.op==='sysread'&&e.role==='stdout');
  assert.equal(stdout.reduce((n,e)=>n+e.count,0),220);
  assert.equal(events.filter(e=>e.op==='signal-attempt'||e.op==='sleep-nomination').length,0);
  const setup=closes.find(e=>e.role==='setup'),firstWrite=events.find(e=>e.op==='syswrite');
  assert.ok(setup.seq<firstWrite.seq);
  if(schedule==='ready-first') assert.ok(stdout[0].seq<setup.seq);
  if(schedule==='reap-last') {
    const reap=events.find(e=>e.op==='waitpid'&&e.result===424242);
    assert.ok(stdout[4].seq<reap.seq&&reap.seq<stdout[5].seq);
  }
});
for(const [missing,clockCount,waitCount,statCount,readyCount,readCount,writeCount,roles,afterReap,eofRoles] of [
  ['setup',7,6,28,1,1,0,['input','stdout','stderr','setup'],[],[]],
  ['stdout',41,33,143,5,10,4,['setup','entropy','input','stderr','stdout'],['stderr','stdout'],['setup','stderr']],
  ['stderr',43,33,149,6,10,4,['setup','entropy','input','stdout','stderr'],['stdout','stderr'],['setup','stdout']],
]) test(`Perl parent protocol refuses missing ${missing} EOF at the original deadline`,()=>{
  const out=parentProtocolTrace(`finish-missing-${missing}`);
  const events=assertParentDeniedDisposal(out,{roles,fixtureClosed:writeCount?10:8,waitCount,reapedBeforeRoles:afterReap});
  assert.equal(events.filter(e=>e.op==='clock').length,clockCount);
  assert.equal(out.events.filter(e=>e.op==='clock').at(-1).value,45);
  assert.equal(events.filter(e=>e.op==='stat').length,statCount);
  assert.equal(events.filter(e=>e.op==='ready').length,readyCount);
  assert.equal(events.filter(e=>e.op==='sysread').length,readCount);
  assert.equal(events.filter(e=>e.op==='syswrite').length,writeCount);
  assert.deepEqual(events.filter(e=>e.op==='sysread'&&e.count===0).map(e=>e.role),eofRoles);
  assert.equal(events.filter(e=>e.op==='sleep-nomination').length,0);
});
test('Perl parent protocol refuses missing reap at protocol expiry then settles only its original cleanup PID',()=>{
  const out=parentProtocolTrace('finish-missing-reap');
  const events=assertParentDeniedDisposal(out,{roles:['setup','entropy','input','stderr','stdout'],fixtureClosed:10,waitCount:46});
  assert.deepEqual(out.events.filter(e=>e.op==='clock').map(e=>e.value),[...Array(45).fill(0),45,45,45]);
  assert.equal(events.filter(e=>e.op==='clock').length,47);
  assert.equal(events.filter(e=>e.op==='stat').length,147);
  assert.equal(events.filter(e=>e.op==='ready').length,6);
  assert.equal(events.filter(e=>e.op==='sysread').length,11);
  assert.equal(events.filter(e=>e.op==='syswrite').length,4);
  const sleep=events.filter(e=>e.op==='sleep-nomination');assert.equal(sleep.length,1);assert.equal(sleep[0].value,0.01);
  const closes=events.filter(e=>e.op==='close-result'&&['input','stdout','stderr','setup','entropy'].includes(e.role));
  assert.ok(closes.every(e=>e.seq<sleep[0].seq));
});
test('Perl parent protocol clips its parent45 budget to the original bootstrap180 expiry',()=>{
  const out=parentProtocolTrace('finish-bootstrap-cap');
  const events=assertParentDeniedDisposal(out,{roles:['input','stdout','stderr','setup'],fixtureClosed:8,waitCount:2});
  assert.deepEqual(out.events.filter(e=>e.op==='clock').map(e=>e.value),[0,179,179,180]);
  assert.equal(events.filter(e=>e.op==='clock').length,3);
  assert.equal(events.filter(e=>e.op==='stat').length,12);
  assert.equal(events.filter(e=>e.op==='fcntl').length,20);
  assert.equal(events.filter(e=>e.op==='ready'||e.op==='sysread'||e.op==='syswrite'||e.op==='sysopen').length,0);
});
for(const [role,index] of [['input',0],['stdout',1],['stderr',2],['setup',3],['entropy',4]])
  for(const failure of ['false','throw'])
    test(`Perl parent protocol refuses ${role} binary configuration ${failure} with original-only disposal`,()=>{
      const out=parentProtocolTrace(`binmode-failure-${role}-${failure}`),entropy=role==='entropy';
      const events=assertParentDeniedDisposal(out,{
        roles:entropy?['setup','input','stdout','stderr','entropy']:['input','stdout','stderr','setup'],
        fixtureClosed:entropy?10:8,waitCount:entropy?8:2});
      const nom=events.filter(e=>e.op==='binmode-nomination');assert.equal(nom.length,1);
      assert.deepEqual([nom[0].role,nom[0].outcome,nom[0].actualConfigured],[role,failure,true]);
      const calls=events.filter(e=>e.op==='binmode');assert.equal(calls.length,index+1);
      assert.ok(calls.every(e=>e.result===1&&e.errno===0));assert.ok(calls.at(-1).seq<nom[0].seq);
      assert.equal(events.filter(e=>e.op==='clock').length,entropy?8:2);
      assert.equal(events.filter(e=>e.op==='stat').length,entropy?35:8);
      assert.equal(events.filter(e=>e.op==='fcntl').length,5*index);
      assert.equal(events.filter(e=>e.op==='ready').length,entropy?1:0);
      assert.equal(events.filter(e=>e.op==='sysread').length,entropy?2:0);
      assert.equal(events.filter(e=>e.op==='syswrite').length,0);
    });
for(const [role,index] of [['input',0],['stdout',1],['stderr',2],['setup',3]]) for(let field=0;field<=6;field++)
  test(`Perl parent protocol refuses original ${role} observed stat drift field ${field} before configuration`,()=>{
    const events=assertParentDeniedDisposal(parentProtocolTrace(`stat-drift-${role}-${field}`),{
      roles:['input','stdout','stderr','setup'],fixtureClosed:8,waitCount:2});
    const nom=events.filter(e=>e.op==='stat-nomination');assert.equal(nom.length,1);
    assert.deepEqual([nom[0].role,nom[0].ordinal,nom[0].field],[role,2,field]);
    assert.equal(nom[0].returned,nom[0].actual+1);
    assert.equal(events.filter(e=>e.op==='stat').length,5+index);
    assert.equal(events.filter(e=>e.op==='clock').length,2);
    assert.equal(events.filter(e=>e.op==='binmode'||e.op==='fcntl'||e.op==='ready'||e.op==='sysread'
      ||e.op==='syswrite'||e.op==='sysopen').length,0);
    // Nomination corrupts only a copied observed tuple. Real original metadata,
    // custody records and descriptors remain intact; this is not native drift.
  });
// Break caught: accepting actual rebinding through an unchanged original FH/FD,
// closing fixture preservation/source handles or reviving a burned consumer.
test('Perl parent protocol refuses actual owned input FD rebinding before configuration and preserves fixture endpoints',()=>{
  const out=parentProtocolTrace('fd-rebinding-input');
  const events=assertParentDeniedDisposal(out,{roles:['input','stdout','stderr','setup'],fixtureClosed:11,waitCount:2});
  const bindings=events.filter(e=>e.op==='fd-rebinding-witness');assert.equal(bindings.length,1);
  const b=bindings[0];assert.equal(b.errno,0);assert.equal(b.currentFd,b.originalFd);
  assert.deepEqual(b.currentIdentity,b.sourceIdentity);assert.deepEqual(b.holdIdentity,b.oldIdentity);
  assert.notDeepEqual(b.currentIdentity,b.oldIdentity);
  assert.equal(events.filter(e=>e.op==='clock').length,2);assert.equal(events.filter(e=>e.op==='stat').length,5);
  assert.equal(events.filter(e=>e.op==='binmode'||e.op==='fcntl'||e.op==='ready'||e.op==='lstat'
    ||e.op==='sysopen'||e.op==='sysread'||e.op==='syswrite').length,0);
  const live=events.find(e=>e.op==='waitpid'&&e.result===0);assert.ok(b.seq<live.seq);
  const close=events.find(e=>e.op==='close-attempt'&&e.role==='input');assert.ok(live.seq<close.seq);
  const survives=out.events.filter(e=>e.op==='fd-rebinding-survival');assert.equal(survives.length,2);
  for(const s of survives) {
    assert.deepEqual([s.holdOpen,s.sourceOpen],[true,true]);
    assert.deepEqual(s.holdIdentity,b.oldIdentity);assert.deepEqual(s.sourceIdentity,b.sourceIdentity);
    assert.ok(events.at(-1).seq<s.seq);
  }
  for(const role of ['input-hold','replacement','replacement-peer']) {
    assert.equal(events.filter(e=>e.role===role&&e.op==='close-attempt').length,0);
    assert.ok(survives.at(-1).seq<out.events.find(e=>e.role===role&&e.op==='close-attempt').seq);
  }
});
// Break caught: accepting incomplete/overlong stat tuples before identity checks.
for(const [seam,statCount,lstatCount,clockCount,readCount,fcntlCount,fixtureClosed,roles] of [
  ['input',5,0,2,0,0,8,['input','stdout','stderr','setup']],
  ['pre',34,1,8,2,20,8,['setup','input','stdout','stderr']],
  ['opened',35,1,8,2,20,10,['setup','input','stdout','stderr','entropy']],
  ['postpath',43,2,10,3,23,10,['setup','input','stdout','stderr','entropy']],
  ['posthandle',44,2,10,3,23,10,['setup','input','stdout','stderr','entropy']],
]) for(const fields of [12,14])
  test(`Perl parent protocol refuses ${seam} observed tuple shape ${fields} before protocol progress`,()=>{
    const events=assertParentDeniedDisposal(parentProtocolTrace(`shape-${seam}-${fields}`),{
      roles,fixtureClosed,waitCount:clockCount});
    const nom=events.filter(e=>e.op==='stat-shape-nomination');assert.equal(nom.length,1);
    assert.deepEqual([nom[0].seam,nom[0].capturedFields,nom[0].returnedFields],[seam,13,fields]);
    assert.equal(nom[0].capturedSynthetic,seam!=='input');assert.equal(nom[0].syntheticResponse,true);
    assert.equal(events.filter(e=>e.op==='stat').length,statCount);
    assert.equal(events.filter(e=>e.op==='lstat').length,lstatCount);
    assert.equal(events.filter(e=>e.op==='clock').length,clockCount);
    assert.equal(events.filter(e=>e.op==='fcntl').length,fcntlCount);
    assert.equal(events.filter(e=>e.op==='sysread').length,readCount);
    assert.equal(events.filter(e=>e.op==='ready').length,seam==='input'?0:1);
    assert.equal(events.filter(e=>e.op==='sysopen').length,fixtureClosed===10?1:0);
    assert.equal(events.filter(e=>e.op==='syswrite').length,0);
  });
// Break caught: continuing after an inadmissible entropy identity/acquisition,
// incorrect raw response, duplicate nonce or unverified descriptor flags.
// These exercise the actual consumer; nominated tuples/flags are not native
// origin evidence. A reported33 response is corruption after a real32 read.
for(const [problem,field,baseline,returned] of [
  ['type',2,8630,33188],['nlink',3,1,2],['uid',4,0,501],['gid',5,0,20],
]) test(`Perl parent protocol refuses entropy pre-open ${problem} without acquisition`,()=>{
  const events=assertParentDeniedDisposal(parentProtocolTrace(`entropy-pre-${problem}`),{
    roles:['setup','input','stdout','stderr'],fixtureClosed:8,waitCount:8});
  const nom=events.filter(e=>e.op==='entropy-identity-nomination');assert.equal(nom.length,1);
  assert.deepEqual([nom[0].seam,nom[0].ordinal,nom[0].field,nom[0].baseline,nom[0].returned],
    ['pre',1,field,baseline,returned]);
  assert.equal(events.filter(e=>e.op==='stat').length,34);
  assert.equal(events.filter(e=>e.op==='lstat').length,1);
  assert.equal(events.filter(e=>e.op==='clock').length,8);
  assert.equal(events.filter(e=>e.op==='fcntl').length,20);
  assert.equal(events.filter(e=>e.op==='ready').length,1);
  assert.equal(events.filter(e=>e.op==='sysread').length,2);
  assert.equal(events.filter(e=>e.op==='sysopen'||e.op==='syswrite'||e.op==='entropy-open-nomination').length,0);
});
for(const failure of ['false','throw','alias'])
  test(`Perl parent protocol refuses entropy open ${failure} without borrowed-handle close`,()=>{
    const events=assertParentDeniedDisposal(parentProtocolTrace(`entropy-open-${failure}`),{
      roles:['setup','input','stdout','stderr'],fixtureClosed:8,waitCount:8});
    const nom=events.filter(e=>e.op==='entropy-open-nomination');assert.equal(nom.length,1);
    assert.deepEqual([nom[0].role,nom[0].outcome,nom[0].actualAcquired],['entropy',failure,false]);
    assert.equal(events.filter(e=>e.op==='stat').length,34);
    assert.equal(events.filter(e=>e.op==='lstat').length,1);
    assert.equal(events.filter(e=>e.op==='clock').length,8);
    assert.equal(events.filter(e=>e.op==='fcntl').length,20);
    assert.equal(events.filter(e=>e.op==='ready').length,1);
    assert.equal(events.filter(e=>e.op==='sysread').length,2);
    assert.equal(events.filter(e=>e.op==='sysopen'||e.op==='syswrite'||e.role==='entropy-peer').length,0);
  });
for(const [seam,ordinal,statCount,lstatCount,clockCount,readCount,fcntlCount] of [
  ['opened',1,35,1,8,2,20],['postpath',2,43,2,10,3,23],['posthandle',4,44,2,10,3,23],
]) for(const [field,baseline] of [[0,11],[1,22],[2,8630],[3,1],[4,0],[5,0],[6,33]])
  test(`Perl parent protocol refuses entropy ${seam} observed identity drift field ${field}`,()=>{
    const events=assertParentDeniedDisposal(parentProtocolTrace(`entropy-${seam}-${field}`),{
      roles:['setup','input','stdout','stderr','entropy'],fixtureClosed:10,waitCount:clockCount});
    const nom=events.filter(e=>e.op==='entropy-identity-nomination');assert.equal(nom.length,1);
    assert.deepEqual([nom[0].seam,nom[0].ordinal,nom[0].field,nom[0].baseline,nom[0].returned],
      [seam,ordinal,field,baseline,baseline+1]);
    assert.equal(events.filter(e=>e.op==='stat').length,statCount);
    assert.equal(events.filter(e=>e.op==='lstat').length,lstatCount);
    assert.equal(events.filter(e=>e.op==='clock').length,clockCount);
    assert.equal(events.filter(e=>e.op==='fcntl').length,fcntlCount);
    assert.equal(events.filter(e=>e.op==='ready').length,1);
    assert.equal(events.filter(e=>e.op==='sysread').length,readCount);
    assert.equal(events.filter(e=>e.op==='sysopen').length,1);
    assert.equal(events.filter(e=>e.op==='syswrite').length,0);
  });
for(const [failure,ordinal,actualRead,actualCount,returnedCount,bufferLength,utf8,errno,
  clockCount,statCount,lstatCount,readyCount,readCount,writeCount] of [
  ['31',1,true,31,31,31,false,0,9,39,1,1,3,0],
  ['33',1,true,32,33,33,false,0,9,39,1,1,3,0],
  ['length',1,true,32,32,31,false,0,9,39,1,1,3,0],
  ['utf8',1,true,32,32,32,true,0,9,39,1,1,3,0],
  ['undefined',1,false,null,null,0,null,0,9,39,1,1,2,0],
  ['throw',1,false,null,null,0,null,0,9,39,1,1,2,0],
  ['eintr',1,false,null,null,0,null,4,9,39,1,1,2,0],
  ['eagain',1,false,null,null,0,null,35,9,39,1,1,2,0],
  ['duplicate',2,true,32,32,32,false,0,18,77,3,2,5,1],
]) test(`Perl parent protocol refuses entropy read ${failure} without retry or successor challenge`,()=>{
  const events=assertParentDeniedDisposal(parentProtocolTrace(`entropy-read-${failure}`),{
    roles:['setup','input','stdout','stderr','entropy'],fixtureClosed:10,waitCount:clockCount});
  const nom=events.filter(e=>e.op==='entropy-read-nomination');assert.equal(nom.length,1);
  assert.deepEqual([nom[0].role,nom[0].ordinal,nom[0].outcome,nom[0].requestLength,nom[0].actualRead,
    nom[0].bufferLength,nom[0].errno],['entropy',ordinal,failure,32,actualRead,bufferLength,errno]);
  if(actualRead) assert.deepEqual([nom[0].actualCount,nom[0].returnedCount,nom[0].utf8],
    [actualCount,returnedCount,utf8]);
  const reads=events.filter(e=>e.op==='sysread'&&e.role==='entropy');
  assert.equal(reads.length,actualRead?ordinal:0);
  if(actualRead) assert.deepEqual([reads.at(-1).count,reads.at(-1).buffer],
    [actualCount,'\x11'.repeat(actualCount)]);
  assert.equal(events.filter(e=>e.op==='clock').length,clockCount);
  assert.equal(events.filter(e=>e.op==='stat').length,statCount);
  assert.equal(events.filter(e=>e.op==='lstat').length,lstatCount);
  assert.equal(events.filter(e=>e.op==='fcntl').length,23);
  assert.equal(events.filter(e=>e.op==='ready').length,readyCount);
  assert.equal(events.filter(e=>e.op==='sysread').length,readCount);
  const writes=events.filter(e=>e.op==='syswrite');assert.equal(writes.length,writeCount);
  if(writeCount) assert.deepEqual(writes.map(e=>e.observed),[`CHALLENGE ${'1'.repeat(64)}\n`]);
});
for(const [role,kind,command,outcome,fcntlCount] of [
  ['input','setfd-false',2,'false',1],['input','setfd-throw',2,'throw',1],
  ['input','getfl-undefined',3,'undefined',2],
  ['input','setfl-false',4,'false',3],['input','setfl-throw',4,'throw',3],
  ['input','finalfl-undefined',3,'undefined',5],['input','getfd-undefined',1,'undefined',5],
  ['input','nonblock',3,'nonblock',5],['input','cloexec',1,'cloexec',5],
  ['entropy','setfd-false',2,'false',21],['entropy','setfd-throw',2,'throw',21],
  ['entropy','getfl-undefined',3,'undefined',23],['entropy','getfd-undefined',1,'undefined',23],
  ['entropy','access',3,'access',23],['entropy','nonblock',3,'nonblock',23],
  ['entropy','cloexec',1,'cloexec',23],
]) test(`Perl parent protocol refuses ${role} descriptor flags ${kind} after witnessed CORE operation`,()=>{
  const entropy=role==='entropy';
  const events=assertParentDeniedDisposal(parentProtocolTrace(`flags-${role}-${kind}`),{
    roles:entropy?['setup','input','stdout','stderr','entropy']:['input','stdout','stderr','setup'],
    fixtureClosed:entropy?10:8,waitCount:entropy?8:2});
  const nom=events.filter(e=>e.op==='fcntl-nomination');assert.equal(nom.length,1);
  assert.deepEqual([nom[0].role,nom[0].command,nom[0].outcome,nom[0].errno],[role,command,outcome,0]);
  assert.notEqual(nom[0].actualResult,null);
  if(outcome==='undefined') assert.equal(nom[0].returned,null);
  if(outcome==='false'||outcome==='throw') assert.equal(nom[0].returned,0);
  if(outcome==='nonblock') {
    assert.equal(Number(nom[0].actualResult)&4,4);assert.equal(Number(nom[0].returned)&4,0);
  }
  if(outcome==='cloexec') {
    assert.equal(Number(nom[0].actualResult)&1,1);assert.equal(Number(nom[0].returned)&1,0);
  }
  if(outcome==='access') {
    assert.equal(Number(nom[0].actualResult)&3,0);assert.equal(Number(nom[0].returned)&3,1);
  }
  const calls=events.filter(e=>e.op==='fcntl');assert.equal(calls.length,fcntlCount);
  const actual=calls.filter(e=>e.role===role&&e.command===command&&e.seq<nom[0].seq).at(-1);
  assert.ok(actual);assert.equal(actual.errno,0);assert.equal(actual.result,nom[0].actualResult);
  assert.equal(events.filter(e=>e.op==='clock').length,entropy?8:2);
  assert.equal(events.filter(e=>e.op==='stat').length,entropy?35:8);
  assert.equal(events.filter(e=>e.op==='binmode').length,entropy?5:1);
  assert.equal(events.filter(e=>e.op==='ready').length,entropy?1:0);
  assert.equal(events.filter(e=>e.op==='sysread').length,entropy?2:0);
  assert.equal(events.filter(e=>e.op==='syswrite').length,0);
});
test('Perl parent protocol refuses raw nonzero reap without post-reap signals',()=>{
  const out=parentProtocolTrace('nonzero-reap');
  assert.equal(out.accepted,false);assert.equal(out.refused,true);assert.equal(out.guardBurned,true);
  assert.equal(out.repeatRefused,true);assert.equal(out.effectsAfterRepeat,0);assert.equal(out.fixtureClosed,10);
  const reaps=out.consumerEvents.filter(e=>e.op==='waitpid'&&e.result===424242);
  assert.equal(reaps.length,1);assert.equal(reaps[0].status,256);
  assert.equal(out.events.filter(e=>e.op==='signal-attempt').length,0);
  const originals=new Set(['input','stdout','stderr','setup','entropy']);
  const attempts=out.consumerEvents.filter(e=>e.op==='close-attempt'&&originals.has(e.role));
  const closes=out.consumerEvents.filter(e=>e.op==='close-result'&&originals.has(e.role));
  assert.deepEqual(attempts.map(e=>e.role),['setup','entropy','input','stdout','stderr']);
  assert.deepEqual(closes.map(e=>e.role),['setup','entropy','input','stdout','stderr']);
  assert.ok(closes.every(e=>e.result===1&&e.definite===1));
  assert.ok(closes.every((e,i)=>attempts[i].seq<e.seq));
});
test('Perl parent protocol mutation control witnesses forbidden nonzero-reap diagnostic',()=>{
  const baseline=parentProtocolTrace('nonzero-reap');assert.equal(baseline.accepted,false);
  const source=readFileSync(BOOTSTRAP,'utf8');
  const anchor='&&$parent_raw_status==0';
  assert.equal(source.split(anchor).length-1,2,'raw-zero mutation must cover both actual predicates');
  const mutant=parentProtocolTrace('nonzero-reap',{sourceOverride:source.replaceAll(anchor,'')});
  assert.equal(mutant.accepted,true);
  assert.deepEqual(mutant.consumer,{scope:'parent-entry-protocol-diagnostic-only',productionAuthority:false,
    challengeCount:3,inputBytes:229,outputBytes:220,handlesClosed:5,reaped:true});
  assert.equal(mutant.fixtureClosed,10);
  const reaps=mutant.events.filter(e=>e.op==='waitpid'&&e.result===424242);
  assert.equal(reaps.length,1);assert.equal(reaps[0].status,256);
});
test('Perl parent protocol mutation control witnesses guard acceptance after actual refusal and disposal',()=>{
  const baseline=parentProtocolTrace('admission-copy');
  assert.equal(baseline.refused,true);assert.equal(baseline.guardAccepted,false);assert.equal(baseline.effectsAfterRepeat,0);
  const source=readFileSync(BOOTSTRAP,'utf8');
  const anchor='if(!$ok) {$parent_invalid=1;$parent_dispose->();task6a_origin_refuse();}';
  const mutant=parentProtocolTrace('admission-copy',{sourceOverride:replaceOnce(source,anchor,
    'if(!$ok) {$parent_dispose->();task6a_origin_refuse();}')});
  assert.equal(mutant.refused,true);assert.equal(mutant.guardAccepted,true);assert.equal(mutant.guardBurned,false);
  assert.equal(mutant.effectsAfterRepeat,0);assert.equal(mutant.fixtureClosed,8);
  assert.deepEqual(mutant.consumerEvents.filter(e=>e.op==='close-result').map(e=>e.role),['input','stdout','stderr','setup']);
  assert.ok(mutant.consumerEvents.every(e=>e.op==='close-attempt'||e.op==='close-result'));
});
test('Perl parent protocol refuses a wrong current nonce before successor effects',()=>{
  const out=parentProtocolTrace('wrong-nonce');
  assert.equal(out.accepted,false);assert.equal(out.refused,true);assert.equal(out.guardBurned,true);
  assert.equal(out.repeatRefused,true);assert.equal(out.effectsAfterRepeat,0);assert.equal(out.fixtureClosed,10);
  const events=out.consumerEvents;
  assert.deepEqual(events.filter(e=>e.op==='syswrite').map(e=>e.observed),[`CHALLENGE ${'1'.repeat(64)}\n`]);
  assert.deepEqual(events.filter(e=>e.op==='sysread'&&e.role==='stdout').map(e=>e.buffer),
    ['READY\n',`PONG ${'9'.repeat(64)}\n`]);
  const waits=events.filter(e=>e.op==='waitpid');
  assert.equal(waits.length,16);
  assert.ok(waits.slice(0,15).every(e=>e.pid===424242&&e.result===0&&e.status===0));
  assert.deepEqual([waits[15].pid,waits[15].result,waits[15].status],[424242,424242,0]);
  const roles=['setup','input','stdout','stderr','entropy'];
  const attempts=events.filter(e=>e.op==='close-attempt'),closes=events.filter(e=>e.op==='close-result');
  assert.deepEqual(attempts.map(e=>e.role),roles);assert.deepEqual(closes.map(e=>e.role),roles);
  assert.ok(closes.every((e,i)=>e.result===1&&e.definite===1&&attempts[i].seq<e.seq&&e.seq<waits[15].seq));
  assert.equal(events.filter(e=>e.op==='signal-attempt').length,0);
  assert.equal(events.filter(e=>e.op==='clock').length,16); // Startup clock is outside consumerEvents.
  assert.equal(events.filter(e=>e.op==='ready').length,2);
  assert.equal(events.filter(e=>e.op==='stat').length,68);
  assert.equal(events.filter(e=>e.op==='lstat').length,2);
});
test('Perl parent protocol mutation control witnesses forbidden wrong-nonce diagnostic',()=>{
  const baseline=parentProtocolTrace('wrong-nonce');assert.equal(baseline.accepted,false);
  const source=readFileSync(BOOTSTRAP,'utf8');
  const anchor='task6a_origin_refuse() unless length($parent_pending)<=length($expected)&&index($expected,$parent_pending)==0;';
  const mutant=parentProtocolTrace('wrong-nonce',{sourceOverride:replaceOnce(source,anchor,
    "task6a_origin_refuse() unless length($parent_pending)<=length($expected)&&($parent_ready&&$parent_phase eq 'active'||index($expected,$parent_pending)==0);")});
  assert.equal(mutant.accepted,true);assert.equal(mutant.fixtureClosed,10);
  assert.deepEqual(mutant.consumer,{scope:'parent-entry-protocol-diagnostic-only',productionAuthority:false,
    challengeCount:3,inputBytes:229,outputBytes:220,handlesClosed:5,reaped:true});
  assert.deepEqual(mutant.writes,[`CHALLENGE ${'1'.repeat(64)}\n`,`CHALLENGE ${'2'.repeat(64)}\n`,
    `CHALLENGE ${'3'.repeat(64)}\n`,'END\n']);
  assert.ok(mutant.events.some(e=>e.op==='sysread'&&e.role==='stdout'&&e.buffer===`PONG ${'9'.repeat(64)}\n`));
  assert.equal(mutant.events.filter(e=>e.op==='stat').length,147);
  assert.equal(mutant.events.filter(e=>e.op==='clock').length,46);
  assert.equal(mutant.events.filter(e=>e.op==='waitpid').length,33);
});
test('Perl parent protocol refuses original deadline expiry after otherwise valid final bytes',()=>{
  const out=parentProtocolTrace('deadline');
  assert.equal(out.accepted,false);assert.equal(out.refused,true);assert.equal(out.guardBurned,true);
  assert.equal(out.repeatRefused,true);assert.equal(out.effectsAfterRepeat,0);assert.equal(out.fixtureClosed,10);
  const events=out.consumerEvents,clocks=events.filter(e=>e.op==='clock');
  assert.deepEqual(clocks.map(e=>e.value),[0,...Array(38).fill(44),46]);
  assert.equal(events.filter(e=>e.op==='waitpid').length,33);
  assert.equal(events.filter(e=>e.op==='ready').length,5);
  assert.equal(events.filter(e=>e.op==='sysread').length,10);
  assert.deepEqual(events.filter(e=>e.op==='sysread'&&e.role==='stdout').map(e=>e.buffer),
    ['READY\n',`PONG ${'1'.repeat(64)}\n`,`PONG ${'2'.repeat(64)}\n`,`PONG ${'3'.repeat(64)}\n`,'END\n']);
  assert.equal(events.filter(e=>e.op==='stat').length,142);
  assert.equal(events.filter(e=>e.op==='syswrite').length,4);
  const attempts=events.filter(e=>e.op==='close-attempt'),closes=events.filter(e=>e.op==='close-result');
  const roles=['setup','entropy','input','stderr','stdout'];
  assert.deepEqual(attempts.map(e=>e.role),roles);assert.deepEqual(closes.map(e=>e.role),roles);
  assert.ok(closes.every((e,i)=>e.result===1&&e.definite===1&&attempts[i].seq<e.seq));
  assert.equal(events.filter(e=>e.op==='signal-attempt').length,0);
});
test('Perl parent protocol mutation control witnesses forbidden renewed-deadline diagnostic',()=>{
  const baseline=parentProtocolTrace('deadline');assert.equal(baseline.accepted,false);
  const source=readFileSync(BOOTSTRAP,'utf8');
  const anchor='my $now=task6a_origin_now();task6a_origin_refuse() unless defined($parent_deadline)&&$now<$parent_deadline;';
  const mutant=parentProtocolTrace('deadline',{sourceOverride:replaceOnce(source,anchor,
    'my $now=task6a_origin_now();$parent_deadline=$now+45;$parent_deadline=$bootstrap_deadline if $bootstrap_deadline<$parent_deadline;task6a_origin_refuse() unless defined($parent_deadline)&&$now<$parent_deadline;')});
  assert.equal(mutant.accepted,true);assert.equal(mutant.fixtureClosed,10);
  assert.deepEqual(mutant.consumer,{scope:'parent-entry-protocol-diagnostic-only',productionAuthority:false,
    challengeCount:3,inputBytes:229,outputBytes:220,handlesClosed:5,reaped:true});
  assert.deepEqual(mutant.events.filter(e=>e.op==='clock').map(e=>e.value),[0,0,...Array(38).fill(44),...Array(6).fill(46)]);
  assert.equal(mutant.events.filter(e=>e.op==='stat').length,147);
  assert.equal(mutant.events.filter(e=>e.op==='waitpid').length,33);
  assert.equal(mutant.events.filter(e=>e.op==='sysread').length,11);
  assert.equal(mutant.events.filter(e=>e.op==='ready').length,6);
});
test('Perl parent protocol mutation control witnesses forbidden signal after exact reap',()=>{
  const source=readFileSync(BOOTSTRAP,'utf8');
  const baseline=parentProtocolTrace('post-reap-signal');
  assert.equal(baseline.refused,true);assert.equal(baseline.guardBurned,true);
  assert.equal(baseline.events.filter(e=>e.op==='signal-attempt').length,0);
  assert.equal(baseline.events.filter(e=>e.op==='clock').length,35);
  let mutantSource=replaceOnce(source,'if($parent_authenticated&&!$parent_reaped&&!$parent_uncertain)',
    'if($parent_authenticated&&!$parent_uncertain)');
  mutantSource=replaceOnce(mutantSource,'$parent_known_live=!$parent_reaped&&!$parent_uncertain;',
    '$parent_known_live=!$parent_uncertain;');
  mutantSource=replaceOnce(mutantSource,'if($parent_authenticated&&$parent_known_live&&!$parent_reaped&&!$parent_uncertain)',
    'if($parent_authenticated&&$parent_known_live&&!$parent_uncertain)');
  const startAnchor='sub task6a_origin_shutdown_helper {',endAnchor='sub task6a_origin_capture {';
  assert.equal(mutantSource.split(startAnchor).length-1,1);
  assert.equal(mutantSource.split(endAnchor).length-1,1);
  const start=mutantSource.indexOf(startAnchor);
  const end=mutantSource.indexOf(endAnchor,start);
  assert.ok(start>=0&&end>start);
  const shutdown=mutantSource.slice(start,end),anchor='return if $$reaped||$$uncertain;';
  assert.equal(shutdown.split(anchor).length-1,2,'only the two bounded shutdown reap exclusions may change');
  const changedShutdown=shutdown.replaceAll(anchor,()=> 'return if $$uncertain;');
  mutantSource=replaceOnce(mutantSource,shutdown,changedShutdown);
  assert.equal(mutantSource.slice(start,mutantSource.indexOf(endAnchor,start)),changedShutdown);
  const pollAnchor='sub task6a_origin_poll {';
  assert.equal(source.split(pollAnchor).length-1,1);
  const originalPoll=source.slice(source.indexOf(pollAnchor),source.indexOf(startAnchor));
  const mutantPoll=mutantSource.slice(mutantSource.indexOf(pollAnchor),mutantSource.indexOf(startAnchor));
  assert.equal(mutantPoll,originalPoll,'actual poll early-return and status semantics must remain unchanged');
  const mutant=parentProtocolTrace('post-reap-signal',{sourceOverride:mutantSource});
  for(const out of [baseline,mutant]) {
    assert.equal(out.accepted,false);assert.equal(out.refused,true);assert.equal(out.guardBurned,true);
    assert.equal(out.repeatRefused,true);assert.equal(out.effectsAfterRepeat,0);assert.equal(out.fixtureClosed,10);
    const events=out.consumerEvents,attempts=events.filter(e=>e.op==='close-attempt'),closes=events.filter(e=>e.op==='close-result');
    const roles=['setup','entropy','input','stdout','stderr'];
    assert.deepEqual(attempts.map(e=>e.role),roles);assert.deepEqual(closes.map(e=>e.role),roles);
    assert.ok(closes.every((e,i)=>e.result===1&&e.definite===1&&attempts[i].seq<e.seq));
    const waits=events.filter(e=>e.op==='waitpid');assert.equal(waits.length,33);
    assert.deepEqual([waits[32].pid,waits[32].result,waits[32].status],[424242,424242,256]);
    assert.equal(events.filter(e=>e.op==='stat').length,131);
    assert.equal(events.filter(e=>e.op==='ready').length,4);
    assert.equal(events.filter(e=>e.op==='sysread').length,8);
    assert.equal(events.filter(e=>e.op==='syswrite').length,4);
  }
  const signals=mutant.consumerEvents.filter(e=>e.op==='signal-attempt');
  assert.equal(signals.length,1,JSON.stringify({last:mutant.consumerEvents.slice(-12),
    clocks:mutant.events.filter(e=>e.op==='clock').map(e=>e.value)}));
  assert.equal(signals[0].signal,'TERM');assert.equal(signals[0].pid,424242);
  const reap=mutant.consumerEvents.find(e=>e.op==='waitpid'&&e.result===424242);
  assert.ok(reap.seq<signals[0].seq);
  assert.ok(mutant.consumerEvents.filter(e=>e.op==='close-result').every(e=>e.seq<signals[0].seq));
  assert.deepEqual(mutant.events.filter(e=>e.op==='clock').map(e=>e.value),[...Array(36).fill(0),6]);
});
test('Perl parent protocol mutation control witnesses final END acceptance while input is physically open',()=>{
  const source=readFileSync(BOOTSTRAP,'utf8');
  const baseline=parentProtocolTrace('input-close-scaffold');
  assert.equal(baseline.consumerEvents.filter(e=>e.op==='final-END-accepted').length,0);
  assert.equal(baseline.events.filter(e=>e.op==='clock').length,41);
  const anchor='task6a_origin_refuse() unless $parent_end_written&&$parent_definitely_closed[0];$expected="END\\n";';
  const mutant=parentProtocolTrace('input-close-scaffold',{sourceOverride:replaceOnce(source,anchor,
    'task6a_origin_refuse() unless $parent_end_written;$expected="END\\n";')});
  for(const out of [baseline,mutant]) {
    assert.equal(out.accepted,false);assert.equal(out.refused,true);assert.equal(out.guardBurned,true);
    assert.equal(out.repeatRefused,true);assert.equal(out.effectsAfterRepeat,0);assert.equal(out.fixtureClosed,10);
    const events=out.consumerEvents,attempts=events.filter(e=>e.op==='close-attempt'),closes=events.filter(e=>e.op==='close-result');
    const roles=['setup','entropy','stderr','input','stdout'];
    assert.deepEqual(attempts.map(e=>e.role),roles);assert.deepEqual(closes.map(e=>e.role),roles);
    assert.ok(closes.every((e,i)=>e.result===1&&e.definite===1&&attempts[i].seq<e.seq));
    const waits=events.filter(e=>e.op==='waitpid');assert.equal(waits.length,40);
    assert.ok(waits.slice(0,39).every(e=>e.pid===424242&&e.result===0&&e.status===0));
    assert.deepEqual([waits[39].pid,waits[39].result,waits[39].status],[424242,424242,0]);
    assert.ok(closes.every(e=>e.seq<waits[39].seq));
    assert.equal(events.filter(e=>e.op==='signal-attempt').length,0);
    assert.equal(events.filter(e=>e.op==='stat').length,150);
    assert.equal(events.filter(e=>e.op==='ready').length,5);
    assert.equal(events.filter(e=>e.op==='sysread').length,10);
    assert.equal(events.filter(e=>e.op==='syswrite').length,4);
    assert.ok(events.some(e=>e.op==='sysread'&&e.role==='stdout'&&e.buffer==='END\n'));
  }
  const acceptance=mutant.consumerEvents.filter(e=>e.op==='final-END-accepted');
  assert.equal(acceptance.length,1);assert.equal(acceptance[0].physicalInputOpen,true);
  const inputClose=mutant.consumerEvents.find(e=>e.op==='close-attempt'&&e.role==='input');
  assert.ok(acceptance[0].seq<inputClose.seq);
  assert.deepEqual(mutant.events.filter(e=>e.op==='clock').map(e=>e.value),[...Array(41).fill(0),45]);
});
for(const [frame,size,statCounts,waitCount] of [
  ['ready',6,[38,49,43,7,22],37],['pong1',70,[38,49,43,7,26],37],
  ['pong2',70,[38,49,43,7,26],37],['pong3',70,[38,49,43,7,22],37],
  ['end',4,[34,49,39,7,22],33],
]) for(let boundary=1;boundary<size;boundary++)
  test(`Perl parent protocol completes ${frame} two-chunk boundary ${boundary}`,()=>{
    const out=parentProtocolTrace(`fragment-${frame}-${boundary}`);
    assert.equal(out.accepted,true);assert.equal(out.fixtureClosed,10);
    assert.deepEqual(out.consumer,{scope:'parent-entry-protocol-diagnostic-only',productionAuthority:false,
      challengeCount:3,inputBytes:229,outputBytes:220,handlesClosed:5,reaped:true});
    const events=out.events;
    assert.deepEqual(out.writes,[`CHALLENGE ${'1'.repeat(64)}\n`,`CHALLENGE ${'2'.repeat(64)}\n`,
      `CHALLENGE ${'3'.repeat(64)}\n`,'END\n']);
    const reads=events.filter(e=>e.op==='sysread'&&e.role==='stdout');
    assert.equal(reads.length,7);
    assert.equal(reads.map(e=>e.buffer).join(''),`READY\nPONG ${'1'.repeat(64)}\nPONG ${'2'.repeat(64)}\nPONG ${'3'.repeat(64)}\nEND\n`);
    assert.equal(reads.reduce((n,e)=>n+e.count,0),220);
    const index={ready:0,pong1:1,pong2:2,pong3:3,end:4}[frame];
    assert.deepEqual([reads[index].count,reads[index+1].count],[boundary,size-boundary]);
    assert.equal(events.filter(e=>e.op==='clock').length,50);
    assert.equal(events.filter(e=>e.op==='ready').length,7);
    assert.equal(events.filter(e=>e.op==='sysread').length,12);
    assert.equal(events.filter(e=>e.op==='waitpid').length,waitCount);
    assert.equal(events.filter(e=>e.op==='fcntl').length,23);
    assert.deepEqual(['input','stdout','stderr','setup','entropy'].map(role=>events.filter(e=>e.op==='stat'&&e.role===role).length),statCounts);
    assert.equal(events.filter(e=>e.op==='signal-attempt').length,0);
    const originals=new Set(['input','stdout','stderr','setup','entropy']);
    const attempts=events.filter(e=>e.op==='close-attempt'&&originals.has(e.role));
    const closes=events.filter(e=>e.op==='close-result'&&originals.has(e.role));
    assert.deepEqual(attempts.map(e=>e.role),['setup','entropy','input','stderr','stdout']);
    assert.deepEqual(closes.map(e=>e.role),['setup','entropy','input','stderr','stdout']);
    assert.ok(closes.every((e,i)=>e.result===1&&e.definite===1&&attempts[i].seq<e.seq));
  });
for(const [mode,bytes] of [
  ['malformed-uppercase',`PONG ${'A'.repeat(64)}\n`],['malformed-short',`PONG ${'1'.repeat(63)}\n`],
  ['malformed-long',`PONG ${'1'.repeat(65)}\n`],['malformed-crlf',`PONG ${'1'.repeat(64)}\r\n`],
  ['malformed-nul',`PONG ${'1'.repeat(31)}\0${'1'.repeat(32)}\n`],['malformed-foreign','READY\n'],
  ['malformed-extra',`PONG ${'1'.repeat(64)}\nX`],['malformed-successor-prefix',`PONG ${'1'.repeat(64)}\nP`],
]) test(`Perl parent protocol refuses ${mode} before any successor effect`,()=>{
  const events=assertParentDeniedDisposal(parentProtocolTrace(mode),{
    roles:['setup','input','stdout','stderr','entropy'],fixtureClosed:10,waitCount:16});
  assert.deepEqual(events.filter(e=>e.op==='sysread'&&e.role==='stdout').map(e=>e.buffer),['READY\n',bytes]);
  assert.deepEqual(events.filter(e=>e.op==='syswrite').map(e=>e.observed),[`CHALLENGE ${'1'.repeat(64)}\n`]);
  assert.equal(events.filter(e=>e.op==='stat').length,68);
  assert.equal(events.filter(e=>e.op==='clock').length,16);
  assert.equal(events.filter(e=>e.op==='ready').length,2);
});
test('Perl parent protocol refuses actual EOF after an incomplete valid PONG prefix',()=>{
  const events=assertParentDeniedDisposal(parentProtocolTrace('partial-eof'),{
    roles:['setup','input','stdout','stderr','entropy'],fixtureClosed:10,waitCount:20});
  const reads=events.filter(e=>e.op==='sysread'&&e.role==='stdout');
  assert.deepEqual(reads.map(e=>e.buffer),['READY\n',`PONG ${'1'.repeat(64)}`,'']);
  assert.deepEqual(reads.map(e=>e.count),[6,69,0]);
  const peerClose=events.find(e=>e.op==='close-result'&&e.role==='stdout-peer');
  assert.ok(peerClose&&peerClose.result===1&&peerClose.definite===1&&peerClose.seq<reads[2].seq);
  assert.deepEqual(events.filter(e=>e.op==='syswrite').map(e=>e.observed),[`CHALLENGE ${'1'.repeat(64)}\n`]);
  assert.equal(events.filter(e=>e.op==='clock').length,20);
  assert.equal(events.filter(e=>e.op==='stat').length,84);
  assert.equal(events.filter(e=>e.op==='ready').length,3);
  assert.equal(events.filter(e=>e.op==='sysread').length,5);
});
for(const [mode,roles,waitCount,statCount,clockCount,readRoles] of [
  ['setup-byte',['input','stdout','stderr','setup'],6,28,6,['setup']],
  ['stderr-byte',['setup','input','stdout','stderr'],8,34,8,['setup','stderr']],
]) test(`Perl parent protocol refuses ${mode} before stdout or entropy effects`,()=>{
  const events=assertParentDeniedDisposal(parentProtocolTrace(mode),{roles,fixtureClosed:8,waitCount});
  assert.deepEqual(events.filter(e=>e.op==='sysread').map(e=>e.role),readRoles);
  assert.equal(events.filter(e=>e.op==='sysread').at(-1).buffer,'Q');
  assert.equal(events.filter(e=>e.op==='syswrite'||e.op==='sysopen').length,0);
  assert.equal(events.filter(e=>e.op==='stat').length,statCount);
  assert.equal(events.filter(e=>e.op==='clock').length,clockCount);
});
for(const [mode,result,errno] of [
  ['early-reap',424242,0],['reap-undefined',null,0],['reap-echild',-1,10],['reap-foreign',424243,0],
]) test(`Perl parent protocol refuses ${mode} before configuration without another PID effect`,()=>{
  const out=parentProtocolTrace(mode);
  assert.equal(out.accepted,false);assert.equal(out.refused,true);assert.equal(out.guardBurned,true);
  assert.equal(out.repeatRefused,true);assert.equal(out.effectsAfterRepeat,0);assert.equal(out.fixtureClosed,8);
  const events=out.consumerEvents,waits=events.filter(e=>e.op==='waitpid');
  assert.equal(waits.length,1);
  assert.deepEqual([waits[0].pid,waits[0].result,waits[0].status,waits[0].errno],[424242,result,0,errno]);
  const roles=['input','stdout','stderr','setup'];
  const attempts=events.filter(e=>e.op==='close-attempt'),closes=events.filter(e=>e.op==='close-result');
  assert.deepEqual(attempts.map(e=>e.role),roles);assert.deepEqual(closes.map(e=>e.role),roles);
  assert.ok(closes.every((e,i)=>e.result===1&&e.definite===1&&waits[0].seq<attempts[i].seq&&attempts[i].seq<e.seq));
  assert.equal(events.filter(e=>e.op==='stat').length,4);
  assert.equal(events.filter(e=>e.op==='clock').length,2);
  assert.ok(events.every(e=>['stat','clock','waitpid','close-attempt','close-result'].includes(e.op)));
});
test('Perl parent protocol burns a nominated pre-first-poll clock throw and settles only the original PID',()=>{
  const out=parentProtocolTrace('clock-start-throw');
  const events=assertParentDeniedDisposal(out,{roles:['input','stdout','stderr','setup'],fixtureClosed:8,waitCount:1});
  const clocks=out.events.filter(e=>e.op==='clock');
  assert.equal(clocks.length,2);assert.equal(clocks[0].value,0);assert.equal(clocks[1].nominatedThrow,true);
  assert.equal(events.filter(e=>e.op==='stat').length,4);
  assert.ok(events.every(e=>['stat','clock','waitpid','close-attempt','close-result'].includes(e.op)));
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
