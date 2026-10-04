import assert from 'node:assert/strict';
import {existsSync,lstatSync,readFileSync,mkdtempSync,unlinkSync,rmdirSync} from 'node:fs';
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
const COLD_ENTRY_GUARD=String.raw`# Cold entry stays closed before any candidate PM/XS import.
BEGIN {
    CORE::print STDERR "TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n";
    CORE::exit(2);
}
`;
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
function coldEntryProbe(source) {
  assert.ok(ordinaryHost(),'cold entry probe requires ordinary macOS UID');
  const candidate=replaceOnce(source,
    "    @INC=('/System/Library/Perl/5.34/darwin-thread-multi-2level',\n        '/System/Library/Perl/5.34');",
    String.raw`    @INC=(sub {CORE::print STDOUT "TEST_FORBIDDEN_IMPORT\n";
        CORE::die "TEST_FORBIDDEN_IMPORT\n";});`);
  assert.ok(Buffer.byteLength(candidate)<=131072,'cold probe source bound');
  const r=spawnSync('/usr/bin/perl',['-f','-e',
    'binmode STDIN; local $/; my $source=<STDIN>; eval $source; if($@){print STDERR $@;exit 64;}exit 0;'],{
    input:candidate,cwd:'/',env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'},
    timeout:3000,maxBuffer:65536,
  });
  assert.equal(r.error,undefined);assert.equal(r.signal,null);return r;
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
const STAGED_FILE_PORT_PROGRAM=String.raw`

    BEGIN { @INC=("/System/Library/Perl/5.34/darwin-thread-multi-2level","/System/Library/Perl/5.34"); }
    use strict; use warnings; use Fcntl (); use JSON::PP (); use Digest::SHA ();
    my ($file_path,$directory_path,$digest,$mode)=@ARGV;
    my $directory_fh=defined($mode)&&$mode=~s/\Adirectory-fh-//?1:0;
    my %modes=map {$_=>1} qw(healthy partial-acquisition inspection-fault alias forbidden-path forbidden-flags forbidden-exec caught-fault exhausted-read overflow close-false close-throw post-close-inspection-throw);
    die "TEST_STAGED_FILE_PORT_HARNESS_FAULT\n" unless @ARGV==4&&$<!=0&&$<==$>
      &&defined($mode)&&($modes{$mode}||($directory_fh&&$mode eq 'configuration-fault'))&&defined($directory_path)&&$directory_path=~m{\A/[^\r\n\0]+\z}
      &&defined($file_path)&&$file_path eq $directory_path.'/task6a-origin-map-v2.pm'
      &&defined($digest)&&$digest=~/\A[a-f0-9]{64}\z/;
    my ($fault,$nominated)=('','');my $alias_witness=0;my @owned;my %roles;my @events;my @close_order;
    my %calls=map {$_=>0} qw(sysopen opendir binmode fcntl stat lstat sysseek sysread fileno close closedir);
    my %core=(fileOpen=>0,directoryOpen=>0,directoryFhOpen=>0,metadata=>0,fileClose=>0,directoryClose=>0);
    my @fcntl=map {['file',@$_]} ([Fcntl::F_GETFL(),0],[Fcntl::F_GETFD(),0],[Fcntl::F_SETFD(),Fcntl::FD_CLOEXEC()],[Fcntl::F_GETFD(),0]);
    push @fcntl,map {['directory',@$_]} ([Fcntl::F_GETFL(),0],[Fcntl::F_GETFD(),0],[Fcntl::F_SETFD(),Fcntl::FD_CLOEXEC()],[Fcntl::F_GETFD(),0]) if $directory_fh;
    my @stat=qw(file directory file directory);my @lstat=@stat;my @seek=(0,0);my @read=(11684,0,11684);
    my ($first_length,$eof_length,$second_length)=(undef,undef,undef);my $matched=0;
    my $latch=sub {$fault='TEST_STAGED_FILE_PORT_HARNESS_FAULT';};
    my $fail=sub {$latch->();die "$fault\n";};
    my $check=sub {die "$fault\n" if length($fault);};
    my $nominate=sub {
      my ($kind)=@_;$fail->() unless $kind eq $mode&&!length($nominated);
      $nominated=$kind;$fail->();
    };
    my $event=sub {
      return 0 if length($fault);
      if(@events>=96) {$latch->();return 0;}
      my ($op,$role)=@_;my $e={seq=>1+@events,op=>$op,role=>$role};
      unless(defined($op)&&defined($role)&&$op=~/\A[a-z-]{1,32}\z/
        &&$role=~/\A[a-z-]{1,32}\z/&&length(JSON::PP->new->canonical->encode($e))<=512) {$latch->();return 0;}
      push @events,$e;return 1;
    };
    my $register=sub {
      my ($fh,$role,$directory,$disposal)=@_;
      # Raw actual acquisition is owned before metadata or trace can fail.
      for my $r(@owned) {$fail->() if $r->{fh}==$fh;}
      # Original disposal type and FH are private lexical captures, not admission metadata.
      my $r={fh=>$fh,role=>$role,directory=>$directory,attempted=>0,closed=>0,
        originalKind=>sub {$disposal;},originalClose=>sub {
          ++$core{$disposal eq 'dir-stream'?'directoryClose':'fileClose'};
          return $disposal eq 'dir-stream'?CORE::closedir($fh):CORE::close($fh);
        }};
      push @owned,$r;$roles{$role}=$r;$event->('acquire',$role);$check->();
      $nominate->('inspection-fault') if $mode eq 'inspection-fault'&&$role eq ($directory_fh?'directory':'file');
      my $fd=CORE::fileno($fh);my @s=CORE::stat($fh);++$core{metadata};
      $fail->() unless defined($fd)&&$fd>=3&&@s==13&&$s[4]==$<
        &&($directory?Fcntl::S_ISDIR($s[2]):Fcntl::S_ISREG($s[2])&&$s[3]==1);
      for my $other(@owned) {next if $other==$r;$fail->() if defined($other->{fd})&&$other->{fd}==$fd;}
      $r->{fd}=$fd;$r->{identity}=[@s];return $r;
    };
    my $lookup=sub {
      my ($fh,$allow_closed)=@_;$fail->() unless defined($fh)&&ref($fh);
      for my $r(@owned) {
        next unless $r->{fh}==$fh;
        unless($allow_closed) {$fail->() if $r->{attempted}||$r->{closed}
          ||!defined(CORE::fileno($fh))||CORE::fileno($fh)!=$r->{fd};}
        return $r;
      }
      $fail->();
    };
    my $identity=sub {
      my ($r,$s)=@_;$fail->() unless ref($s) eq 'ARRAY'&&@$s==13&&ref($r->{identity}) eq 'ARRAY';
      for my $i($r->{directory}?(0,1,2,4,5):(0,1,2,3,4,5,7,9,10)) {
        $fail->() unless defined($s->[$i])&&$s->[$i]==$r->{identity}[$i];
      }
    };
    my $dispose=sub {
      my ($r)=@_;return 0 if $r->{attempted};
      $r->{attempted}=1;push @close_order,$r->{role};$event->('close-attempt',$r->{role});
      $!=0;my $ok=eval {$r->{originalClose}->()};my $error=$@;my $errno=0+$!;
      my $end;my $inspected=eval {$end=CORE::fileno($r->{fh});1;};my $inspection_error=$@;
      $r->{closed}=1 if $ok&&!length($error)&&!$errno&&$inspected&&!length($inspection_error)&&!defined($end);
      $event->('close-result',$r->{role});$fail->() unless $r->{closed};
      if($r->{role} eq ($directory_fh?'directory':'file')&&$mode=~/\A(?:close-false|close-throw|post-close-inspection-throw)\z/) {
        $nominated=$mode;$latch->();
        return 0 if $mode eq 'close-false';
        die "TEST_STAGED_FILE_PORT_NOMINATED_CLOSE_THROW\n" if $mode eq 'close-throw';
        die "TEST_STAGED_FILE_PORT_NOMINATED_INSPECTION_THROW\n";
      }
      return 1;
    };
    my $deny=sub {
      $event->('denied','external');
      $nominate->('forbidden-exec') if $mode eq 'forbidden-exec';
      $fail->();
    };
    my ($body_ok,$primary);my @cleanup_errors;my $ports_ready=0;
    {
      no warnings qw(redefine once);
      local *CORE::GLOBAL::sysopen=sub (*$$;$) {
        $check->();++$calls{sysopen};
        $fail->() unless @_==3&&!defined($_[0])&&!ref($_[1])&&!ref($_[2]);
        my $role=$_[1] eq $file_path?'file':$directory_fh&&$_[1] eq $directory_path?'directory':'';
        unless(length($role)) {$event->('denied','path');$nominate->('forbidden-path') if $mode eq 'forbidden-path';$fail->();}
        my $flags=Fcntl::O_RDONLY()|Fcntl::O_NOFOLLOW()
          |($role eq 'directory'?Fcntl::O_DIRECTORY():Fcntl::O_NONBLOCK());
        if($_[2]!=$flags) {$event->('denied','flags');$nominate->('forbidden-flags') if $mode eq 'forbidden-flags';$fail->();}
        if(defined($roles{$role})) {
          if($mode eq 'alias') {my $candidate=$roles{$role}{fh};my $r=$lookup->($candidate,0);
            $fail->() unless $role eq ($directory_fh?'directory':'file')
              &&$r==$roles{$role}&&CORE::fileno($candidate)==$r->{fd};
            $alias_witness=1;$event->('alias',$role);$nominate->('alias');}
          $fail->();
        }
        if($role eq 'directory') {
          $fail->() unless defined($roles{file});
          $nominate->('partial-acquisition') if $mode eq 'partial-acquisition';
        } else {$fail->() if @owned;}
        CORE::sysopen(my $fh,$_[1],$flags) or $fail->();
        ++$core{$role eq 'directory'?'directoryFhOpen':'fileOpen'};
        $register->($fh,$role,$role eq 'directory'?1:0,'fh');$_[0]=$fh;return 1;
      };
      local *CORE::GLOBAL::opendir=sub (*$) {
        $check->();++$calls{opendir};$fail->() if $directory_fh;$fail->() unless @_==2&&!defined($_[0])&&!ref($_[1])
          &&$_[1] eq $directory_path&&!defined($roles{directory})&&defined($roles{file});
        $nominate->('partial-acquisition') if $mode eq 'partial-acquisition';
        CORE::opendir(my $fh,$directory_path) or $fail->();++$core{directoryOpen};
        $register->($fh,'directory',1,'dir-stream');$_[0]=$fh;return 1;
      };
      local *CORE::GLOBAL::binmode=sub (*;$) {
        $check->();$fail->() unless @_==1&&$calls{binmode}++==0;
        my $r=$lookup->($_[0],0);$fail->() unless $r->{role} eq 'file';
        CORE::binmode($_[0]) or $fail->();$event->('binmode','file');return 1;
      };
      local *CORE::GLOBAL::fcntl=sub (*$$) {
        $check->();$fail->() unless @_==3&&@fcntl;my $r=$lookup->($_[0],0);
        my $want=shift @fcntl;$fail->() unless $r->{role} eq $want->[0]&&$_[1]==$want->[1]&&$_[2]==$want->[2];
        $!=0;my $v=CORE::fcntl($_[0],$_[1],$_[2]);$fail->() unless defined($v)&&!$!;
        ++$calls{fcntl};$event->('fcntl',$r->{role});
        $nominate->('configuration-fault') if $directory_fh&&$mode eq 'configuration-fault'
          &&$r->{role} eq 'directory'&&$_[1]==Fcntl::F_SETFD();
        return $v;
      };
      local *CORE::GLOBAL::stat=sub (;*) {
        $check->();$fail->() unless @_==1&&wantarray&&@stat;my $r=$lookup->($_[0],0);
        $fail->() unless $r->{role} eq shift(@stat);my @s=CORE::stat($_[0]);$identity->($r,\@s);
        ++$calls{stat};$event->('stat',$r->{role});return @s;
      };
      local *CORE::GLOBAL::lstat=sub (;*) {
        $check->();$fail->() unless @_==1&&wantarray&&@lstat&&!ref($_[0]);
        my $role=shift @lstat;my $r=$roles{$role};$fail->() unless defined($r)
          &&$_[0] eq ($role eq 'file'?$file_path:$directory_path);
        my @s=CORE::lstat($_[0]);$identity->($r,\@s);
        ++$calls{lstat};$event->('lstat',$role);return @s;
      };
      local *CORE::GLOBAL::sysseek=sub (*$$) {
        $check->();$fail->() unless @_==3&&@seek;my $r=$lookup->($_[0],0);
        my $want=shift @seek;$fail->() unless $r->{role} eq 'file'&&$_[1]==$want&&$_[2]==0;
        my $v=CORE::sysseek($_[0],$_[1],$_[2]);$fail->() unless defined($v)&&$v==0;
        ++$calls{sysseek};$event->('seek','file');return $v;
      };
      local *CORE::GLOBAL::sysread=sub (*\$$;$) {
        $check->();$fail->() unless @_==3&&ref($_[1]) eq 'SCALAR'&&$_[2]==65536;
        my $r=$lookup->($_[0],0);$fail->() unless $r->{role} eq 'file';
        unless(@read) {$nominate->('exhausted-read') if $mode eq 'exhausted-read';$fail->();}
        my $want=shift @read;my $buffer=$_[1];$fail->() unless !ref($$buffer)&&$$buffer eq '';
        $!=0;my $n=CORE::sysread($_[0],$$buffer,$_[2]);$fail->() unless defined($n)&&!$!
          &&$n==$want&&length($$buffer)==$n&&!utf8::is_utf8($$buffer);
        ++$calls{sysread};$event->('read','file');return $n;
      };
      local *CORE::GLOBAL::fileno=sub (*) {
        $check->();$fail->() unless @_==1;my $r=$lookup->($_[0],0);
        ++$calls{fileno};$event->('fileno',$r->{role});return CORE::fileno($_[0]);
      };
      local *CORE::GLOBAL::close=sub (;*) {
        $fail->() unless @_==1;my $r=$lookup->($_[0],1);$fail->() unless $r->{originalKind}->() eq 'fh';
        ++$calls{close};return $dispose->($r);
      };
      local *CORE::GLOBAL::closedir=sub (*) {
        $fail->() unless @_==1;my $r=$lookup->($_[0],1);$fail->() unless $r->{originalKind}->() eq 'dir-stream';
        ++$calls{closedir};return $dispose->($r);
      };
      local *CORE::GLOBAL::exec=$deny;local *CORE::GLOBAL::system=$deny;
      local *CORE::GLOBAL::open=sub (*;$@) {$deny->();};local *CORE::GLOBAL::syswrite=sub (*$;$$) {$deny->();};
      local *CORE::GLOBAL::readdir=sub (*) {$deny->();};local *CORE::GLOBAL::pipe=sub (**) {$deny->();};
      local *CORE::GLOBAL::fork=sub () {$deny->();};local *CORE::GLOBAL::waitpid=sub ($$) {$deny->();};
      local *CORE::GLOBAL::kill=sub (@) {$deny->();};local *CORE::GLOBAL::readpipe=sub (_) {$deny->();};
      local *CORE::GLOBAL::unlink=sub (@) {$deny->();};local *CORE::GLOBAL::mkdir=sub (_;$) {$deny->();};
      local *CORE::GLOBAL::rmdir=sub (_) {$deny->();};local *CORE::GLOBAL::rename=sub ($$) {$deny->();};
      local *CORE::GLOBAL::chdir=sub (;$) {$deny->();};local *CORE::GLOBAL::truncate=sub ($$) {$deny->();};
      local *CORE::GLOBAL::socket=sub (*$$$) {$deny->();};local *CORE::GLOBAL::socketpair=sub (**$$$) {$deny->();};
      local *CORE::GLOBAL::connect=sub (*$) {$deny->();};local *CORE::GLOBAL::accept=sub (**) {$deny->();};
      my %prototypes=(sysopen=>'*$$;$',opendir=>'*$',
        binmode=>'*;$',fcntl=>'*$$',stat=>';*',lstat=>';*',sysseek=>'*$$',
        sysread=>'*\$$;$',fileno=>'*',close=>';*',closedir=>'*');
      for my $op(sort keys %prototypes) {
        my $port='CORE::GLOBAL'->can($op);my $actual=prototype('CORE::'.$op);
        $fail->() unless defined($port)&&ref($port) eq 'CODE'&&defined($actual)
          &&$actual eq $prototypes{$op}&&defined(prototype($port))&&prototype($port) eq $actual;
      }
      for my $op(qw(exec system)) {my $port='CORE::GLOBAL'->can($op);
        $fail->() unless defined($port)&&ref($port) eq 'CODE'&&!defined(prototype($port));}
      $ports_ready=1;
      $body_ok=eval q{
        my ($file,$directory);my $flags=Fcntl::O_RDONLY()|Fcntl::O_NOFOLLOW()|Fcntl::O_NONBLOCK();
        sysopen($file,$file_path,$flags) or $fail->();
        my $directory_flags=Fcntl::O_RDONLY()|Fcntl::O_NOFOLLOW()|Fcntl::O_DIRECTORY();
        if($directory_fh) {sysopen($directory,$directory_path,$directory_flags) or $fail->();}
        else {opendir($directory,$directory_path) or $fail->();}
        if($mode eq 'alias') {my $other;sysopen($other,$directory_fh?$directory_path:$file_path,
          $directory_fh?$directory_flags:$flags);$fail->();}
        if($mode eq 'forbidden-path') {my $other;sysopen($other,$file_path.'/unselected',$flags);$fail->();}
        if($mode eq 'forbidden-flags') {my $other;sysopen($other,$file_path,Fcntl::O_WRONLY());$fail->();}
        if($mode eq 'forbidden-exec') {CORE::GLOBAL::exec('/bin/false');$fail->();}
        if($mode eq 'caught-fault') {eval {$nominate->('caught-fault');};$check->();}
        if($mode eq 'overflow') {for(1..97) {$event->('overflow','fixture');}
          $nominated='overflow';$check->();}
        binmode($file) or $fail->();
        my $fl=fcntl($file,Fcntl::F_GETFL(),0);
        $fail->() unless defined($fl)&&($fl&Fcntl::O_ACCMODE())==Fcntl::O_RDONLY()&&($fl&Fcntl::O_NONBLOCK());
        my $fd_flags=fcntl($file,Fcntl::F_GETFD(),0);$fail->() unless defined($fd_flags);
        fcntl($file,Fcntl::F_SETFD(),Fcntl::FD_CLOEXEC()) or $fail->();
        $fd_flags=fcntl($file,Fcntl::F_GETFD(),0);$fail->() unless defined($fd_flags)&&($fd_flags&Fcntl::FD_CLOEXEC());
        if($directory_fh) {
          my $directory_fl=fcntl($directory,Fcntl::F_GETFL(),0);
          $fail->() unless defined($directory_fl)&&($directory_fl&Fcntl::O_ACCMODE())==Fcntl::O_RDONLY();
          my $directory_fd_flags=fcntl($directory,Fcntl::F_GETFD(),0);
          $fail->() unless defined($directory_fd_flags);
          fcntl($directory,Fcntl::F_SETFD(),Fcntl::FD_CLOEXEC()) or $fail->();
          $directory_fd_flags=fcntl($directory,Fcntl::F_GETFD(),0);
          $fail->() unless defined($directory_fd_flags)&&($directory_fd_flags&Fcntl::FD_CLOEXEC());
        }
        my $fd=fileno($file);$fail->() unless defined($fd)&&$fd>=3;
        my @s=stat($file);@s=lstat($file_path);@s=stat($directory);@s=lstat($directory_path);
        my $position=sysseek($file,0,0);$fail->() unless defined($position)&&$position==0;
        my $bytes='';$first_length=sysread($file,$bytes,65536);
        $fail->() unless Digest::SHA::sha256_hex($bytes) eq $digest;
        $bytes='';$eof_length=sysread($file,$bytes,65536);
        $position=sysseek($file,0,0);$fail->() unless defined($position)&&$position==0;
        $bytes='';$second_length=sysread($file,$bytes,65536);
        $fail->() unless Digest::SHA::sha256_hex($bytes) eq $digest;$matched=1;
        @s=stat($file);@s=lstat($file_path);@s=stat($directory);@s=lstat($directory_path);
        if($mode eq 'exhausted-read') {$bytes='';sysread($file,$bytes,65536);$fail->();}
        if($directory_fh) {close($directory) or $check->();close($file) or $check->();}
        else {close($file) or $check->();closedir($directory) or $check->();}
        1;
      };
      $primary=$@;
      # Fixture-only finalizer bypasses sticky faults and operation queues.
      for my $r(@owned) {
        next if $r->{attempted};my $ok=eval {$dispose->($r)};my $error=$@;
        unless($ok&&!length($error)&&$r->{closed}) {
          $latch->();push @cleanup_errors,length($error)?$error:"TEST_STAGED_FILE_PORT_NOMINATED_CLOSE_FALSE\n";
        }
      }
    }
    my $closed=grep {$_->{closed}} @owned;
    my $self=$mode ne 'healthy';
    my $expected_primary=$mode eq 'close-throw'?"TEST_STAGED_FILE_PORT_NOMINATED_CLOSE_THROW\n"
      :$mode eq 'post-close-inspection-throw'?"TEST_STAGED_FILE_PORT_NOMINATED_INSPECTION_THROW\n"
      :"TEST_STAGED_FILE_PORT_HARNESS_FAULT\n";
    die "TEST_STAGED_FILE_PORT_HARNESS_FAULT\n" unless $ports_ready&&$closed==@owned
      &&($self?($nominated eq $mode&&$fault eq 'TEST_STAGED_FILE_PORT_HARNESS_FAULT'
        &&($body_ok||$primary eq $expected_primary))
        :($body_ok&&!length($primary)&&!length($fault)&&!@cleanup_errors
          &&!@fcntl&&!@stat&&!@lstat&&!@seek&&!@read));
    my $out={scope=>'ordinary-staged-file-ports-fixture-only',productionAuthority=>JSON::PP::false,
      consumerInvoked=>JSON::PP::false,consumerClosed=>0,
      directoryFhProfile=>$directory_fh?JSON::PP::true:JSON::PP::false,fixtureClosed=>0+$closed,
      ownedCount=>scalar(@owned),definitelyClosed=>0+$closed,portsReady=>JSON::PP::true,
      harnessFault=>length($fault)?$fault:undef,nominatedFault=>length($nominated)?$nominated:undef,
      containedSelfFault=>$self?JSON::PP::true:JSON::PP::false,
      dataMatched=>$matched?JSON::PP::true:JSON::PP::false,
      firstLength=>$first_length,eofLength=>$eof_length,secondLength=>$second_length,
      aliasWitness=>$alias_witness?JSON::PP::true:JSON::PP::false,primaryError=>$primary,
      calls=>\%calls,core=>\%core,closeOrder=>\@close_order,events=>\@events,
      cleanupErrors=>\@cleanup_errors,remaining=>{fcntl=>scalar(@fcntl),stat=>scalar(@stat),lstat=>scalar(@lstat),seek=>scalar(@seek),read=>scalar(@read)}};
    print JSON::PP->new->canonical->utf8->encode($out);exit 0;
`;
const STAGED_CUSTODY_PROGRAM=String.raw`
    if($q->{kind} eq 'staged-custody') {
      require Fcntl;require B;require IO::Select;require POSIX;require Time::HiRes;
      require Digest::SHA;require Encode;require Errno;
      my $fault='';my (@grammar,@jobs,@owned,@events);my (%roles,%calls);
      my $latch=sub {$fault='TEST_STAGED_CUSTODY_HARNESS_FAULT';return 0;};
      my $fail=sub {$latch->();die "$fault\n";};
      my $check=sub {die "$fault\n" if length($fault);};
      my $r=$q->{record};
      $fail->() unless ref($r) eq 'HASH'
        &&join(',',sort keys %$r) eq 'backings,mode,root,slot';
      my ($mode,$slot,$root)=@$r{qw(mode slot root)};
      my %modes=map {$_=>1} qw(healthy absent arity premature-recheck premature-release open-undefined open-false open-throw unknown-cell unknown-handle unknown-blessed-glob unknown-overloaded unknown-indirect unknown-scalar-ref unknown-array unknown-hash unknown-coderef close-false close-throw admission-undef admission-array admission-extra admission-missing-creator admission-root admission-creation-short admission-creation-string admission-creation-owner admission-creation-type admission-source-count admission-source-order admission-source-numeric admission-source-policy admission-source-bytes-0 admission-source-bytes-1 admission-source-bytes-2 admission-source-bytes-3 admission-vendor-bytes admission-selected-detached admission-selected-member boundary-expiry-hold-entry boundary-expiry-hold-complete boundary-expiry-recheck-entry boundary-expiry-recheck-complete boundary-throw-hold-entry boundary-throw-hold-complete boundary-throw-recheck-entry boundary-throw-recheck-complete metadata-dir-short metadata-file-short metadata-dir-record-copy metadata-file-record-copy metadata-dir-tuple-copy metadata-file-tuple-copy metadata-dir-path metadata-file-path metadata-file-tuple-value metadata-file-hash metadata-dir-fh-empty metadata-file-fh-empty metadata-dir-fh-alias metadata-file-fh-alias partial-tied-dir partial-tied-file h7-acl-plus h7-raw256 config-dir-getfl-undefined config-dir-getfl-throw config-dir-getfl-access config-dir-prefd-undefined config-dir-prefd-throw config-dir-prefd-extra config-dir-setfd-false config-dir-setfd-throw config-dir-postfd-undefined config-dir-postfd-throw config-dir-postfd-missing config-file-getfl-undefined config-file-getfl-throw config-file-getfl-access config-file-getfl-nonblock config-file-prefd-undefined config-file-prefd-throw config-file-prefd-extra config-file-setfd-false config-file-setfd-throw config-file-postfd-undefined config-file-postfd-throw config-file-postfd-missing config-file-binmode-false config-file-binmode-throw file-byte-xor-denied file-byte-xor-mutant magic-dir-array magic-dir-record magic-dir-tuple magic-dir-path magic-dir-fh magic-dir-retained-record magic-dir-retained-tuple magic-file-array magic-file-record magic-file-tuple magic-file-path magic-file-fh magic-file-retained-record magic-file-retained-tuple magic-file-hash magic-file-element drift-copy-admission drift-copy-creator drift-copy-creation drift-copy-sources drift-copy-source-0 drift-copy-source-1 drift-copy-source-2 drift-copy-source-3 drift-copy-vendor drift-copy-selected drift-selected-detached drift-root drift-creation-inode drift-source-bytes-0 drift-source-bytes-1 drift-source-bytes-2 drift-source-bytes-3 drift-vendor-bytes drift-selected-bytes drift-extra amagic-current-admission amagic-current-creator amagic-current-creation amagic-current-sources amagic-current-source-0 amagic-current-source-1 amagic-current-source-2 amagic-current-source-3 amagic-current-vendor amagic-current-selected amagic-retained-admission amagic-retained-creator amagic-retained-creation amagic-retained-sources amagic-retained-source-0 amagic-retained-source-1 amagic-retained-source-2 amagic-retained-source-3 amagic-retained-vendor amagic-retained-selected foreign-parent foreign-physical foreign-file foreign-directory hidden-open-undefined active-hold-again active-recheck-arity active-release-arity foreign-fd-alias staged-reference-alias identity-dir-pre-shape identity-file-pre-type identity-dir-open-owner identity-file-open-inode identity-dir-post-device identity-file-post-size shared-unsettled-baseline shared-unsettled-mutant epoch-acl-baseline epoch-acl-mutant once-primitive-baseline once-primitive-mutant);
      $fail->() unless defined($mode)&&!ref($mode)&&$modes{$mode}
        &&defined($slot)&&!ref($slot)&&$slot>=0&&$slot<=12&&$slot==int($slot)
        &&($mode=~/\A(?:open|close)-/ ? $slot>=1 : $slot==0)
        &&defined($root)&&!ref($root)&&$root=~m{\A/[A-Za-z0-9._/-]+\z};
      my %fixture_modes=map {$_=>1} qw(foreign-parent foreign-physical foreign-file foreign-directory hidden-open-undefined foreign-fd-alias);
      my ($fixture_original,$fixture_record,$fixture_alias);my $raw_acquisitions=0;
      my %identity_profiles=(
        'identity-dir-pre-shape'=>['lstat','d0',1,0,0,'shape'],
        'identity-file-pre-type'=>['lstat','f0',1,6,6,'type'],
        'identity-dir-open-owner'=>['stat','d0',1,0,1,'owner'],
        'identity-file-open-inode'=>['stat','f0',1,6,7,'inode'],
        'identity-dir-post-device'=>['stat','d0',2,1,1,'device'],
        'identity-file-post-size'=>['stat','f0',5,13,12,'size'],
      );
      my $identity_profile=$identity_profiles{$mode};
      my $logical='/private/tmp/task6a-staged-memory-fixture';
      my @directory_paths=('/','/private','/private/tmp',$logical,$logical.'/source',$logical.'/vendor');
      my @actual_dirs=('/','/private','/private/tmp',$root,$root.'/scripts',$root.'/docs');
      my @leaf_rel=qw(source/task6a-origin-archive-v2.pm source/task6a-origin-native-v2.pm source/task6a-origin-map-v2.pm source/task6a-protected-origin-entry-v2.mjs vendor/node-v22.23.1-darwin-arm64.tar.gz vendor/node);
      my @backing_rel=qw(scripts/task6a-origin-archive-v2.pm scripts/task6a-origin-native-v2.pm scripts/task6a-origin-map-v2.pm scripts/task6a-protected-origin-entry-v2.mjs package.json README.md);
      my @sizes=(5864,3347,11684,1933,22734,7454);
      my @permissions=(0400,0400,0400,0444,0400,0555);
      my @blobs=qw(da1fd458fcaba775be5ba09ef88157b5ee48dbda 59e1ae8de38cf2083a0294c55454083840eb47f1 9719bf4f3676b43b7858e3cabe3cee3e679120f8 e53be63cdcdf286dc89adbec9770668b1fdb9cc7);
      my (%paths,@bodies,%physical_seen);
      $fail->() unless ref($r->{backings}) eq 'ARRAY'&&@{$r->{backings}}==6;
      for my $index(0..5) {
        my $path=$directory_paths[$index];my $actual=$actual_dirs[$index];
        my @s=CORE::lstat($actual);$fail->() unless @s==13&&Fcntl::S_ISDIR($s[2]);
        my $permission=$index==2?01777:$index==3?0711:$index>=4?0555:($s[2]&07777);
        $paths{$path}={actual=>$actual,identity=>[@s],directory=>1,permission=>$permission,role=>'d'.$index};
      }
      for my $index(0..5) {
        my $b=$r->{backings}[$index];
        $fail->() unless ref($b) eq 'HASH'
          &&join(',',sort keys %$b) eq 'bytes,dev,ino,logical,path,sha256,size'
          &&$b->{logical} eq $leaf_rel[$index]&&$b->{path} eq $root.'/'.$backing_rel[$index]
          &&$b->{size}==$sizes[$index]&&!ref($b->{bytes})&&!ref($b->{sha256})
          &&$b->{sha256}=~/\A[a-f0-9]{64}\z/;
        my @s=CORE::lstat($b->{path});
        $fail->() unless @s==13&&Fcntl::S_ISREG($s[2])&&$s[3]==1
          &&"$s[0]" eq $b->{dev}&&"$s[1]" eq $b->{ino}&&$s[7]==$sizes[$index]
          &&!$physical_seen{"$s[0]:$s[1]"}++;
        my $body=MIME::Base64::decode_base64($b->{bytes});
        $fail->() unless MIME::Base64::encode_base64($body,'') eq $b->{bytes}
          &&length($body)==$sizes[$index]&&!utf8::is_utf8($body)
          &&Digest::SHA::sha256_hex($body) eq $b->{sha256};
        if($index<4) {$fail->() unless Digest::SHA::sha1_hex('blob '.length($body)."\0".$body) eq $blobs[$index];}
        $paths{$logical.'/'.$leaf_rel[$index]}={actual=>$b->{path},identity=>[@s],
          directory=>0,permission=>$permissions[$index],role=>'f'.$index,body=>$body};
        push @bodies,$body;
      }
      $fail->() unless Digest::SHA::sha256_hex($bodies[4]) eq 'bf6cedd405c26f5f933e45436d8ec84b2780297377bb44f40deb6c44a91f6a6e'
        &&Digest::SHA::sha256_hex($bodies[5]) eq '14a6a8f44d6531560feca82404d64d46ff259585fd74b7ea7d9d2b3ae62efd0e';
      my $project=sub {
        my ($p,$s)=@_;$fail->() unless ref($s) eq 'ARRAY'&&@$s==13;
        my @result=@$s;$result[2]=($result[2]&~07777)|$p->{permission};
        $result[4]=0;$result[5]=0;return \@result;
      };
      my $creation=$project->($paths{$logical},$paths{$logical}{identity});
      $creation->[2]=($creation->[2]&~07777)|0700;
      my @source_roles=qw(archive-helper native-helper map-helper entry);
      my $vendor={filename=>'node-v22.23.1-darwin-arm64.tar.gz',bytes=>$bodies[4]};
      my $fixture_admission={creator=>{rootPath=>$logical,creationIdentity=>$creation},
        sources=>[map {+{role=>$source_roles[$_],relativePath=>$leaf_rel[$_],
          gitBlobSha=>$blobs[$_],bytes=>$bodies[$_]}} (0..3)],
        vendor=>$vendor,selected=>{archiveRef=>$vendor,
          memberName=>'node-v22.23.1-darwin-arm64/bin/node',bytes=>$bodies[5]}};
      if($mode=~/\Aadmission-/) {
        my $a=$fixture_admission;
        if($mode eq 'admission-undef') {$fixture_admission=undef;}
        elsif($mode eq 'admission-array') {$fixture_admission=[];}
        elsif($mode eq 'admission-extra') {$a->{extra}=0;}
        elsif($mode eq 'admission-missing-creator') {delete $a->{creator};}
        elsif($mode eq 'admission-root') {$a->{creator}{rootPath}='/private/tmp//bad';}
        elsif($mode eq 'admission-creation-short') {pop @{$a->{creator}{creationIdentity}};}
        elsif($mode eq 'admission-creation-string') {
          $a->{creator}{creationIdentity}[4]='0';
          my $sv=B::svref_2object(\($a->{creator}{creationIdentity}[4]));
          $fail->() unless ($sv->FLAGS&B::SVf_POK())&&!($sv->FLAGS&B::SVf_IOK());
        }
        elsif($mode eq 'admission-creation-owner') {$a->{creator}{creationIdentity}[4]=1;}
        elsif($mode eq 'admission-creation-type') {
          $a->{creator}{creationIdentity}[2]=($a->{creator}{creationIdentity}[2]&07777)|0100000;
        }
        elsif($mode eq 'admission-source-count') {pop @{$a->{sources}};}
        elsif($mode eq 'admission-source-order') {@{$a->{sources}}[0,1]=@{$a->{sources}}[1,0];}
        elsif($mode eq 'admission-source-numeric') {$a->{sources}[0]{bytes}=1;}
        elsif($mode eq 'admission-source-policy') {$a->{sources}[0]{gitBlobSha}='0'x40;}
        elsif($mode=~/\Aadmission-source-bytes-([0-3])\z/) {
          my $i=0+$1;my $body=\($a->{sources}[$i]{bytes});
          substr($$body,0,1)=chr(ord(substr($$body,0,1))^1);
        }
        elsif($mode eq 'admission-vendor-bytes') {
          my $body=\($a->{vendor}{bytes});substr($$body,0,1)=chr(ord(substr($$body,0,1))^1);
        }
        elsif($mode eq 'admission-selected-detached') {$a->{selected}{archiveRef}={%{$a->{vendor}}};}
        elsif($mode eq 'admission-selected-member') {$a->{selected}{memberName}='node-v22.23.1-darwin-arm64/bin/not-node';}
        else {$fail->();}
      }
      my %configuration=(
        'config-dir-getfl-undefined'=>['d0','getfl',1,'undefined'],
        'config-dir-getfl-throw'=>['d0','getfl',1,'throw'],
        'config-dir-getfl-access'=>['d0','getfl',1,'access'],
        'config-dir-prefd-undefined'=>['d0','prefd',2,'undefined'],
        'config-dir-prefd-throw'=>['d0','prefd',2,'throw'],
        'config-dir-prefd-extra'=>['d0','prefd',2,'extra'],
        'config-dir-setfd-false'=>['d0','setfd',3,'false'],
        'config-dir-setfd-throw'=>['d0','setfd',3,'throw'],
        'config-dir-postfd-undefined'=>['d0','postfd',4,'undefined'],
        'config-dir-postfd-throw'=>['d0','postfd',4,'throw'],
        'config-dir-postfd-missing'=>['d0','postfd',4,'missing'],
        'config-file-getfl-undefined'=>['f0','getfl',1,'undefined'],
        'config-file-getfl-throw'=>['f0','getfl',1,'throw'],
        'config-file-getfl-access'=>['f0','getfl',1,'access'],
        'config-file-getfl-nonblock'=>['f0','getfl',1,'nonblock'],
        'config-file-prefd-undefined'=>['f0','prefd',2,'undefined'],
        'config-file-prefd-throw'=>['f0','prefd',2,'throw'],
        'config-file-prefd-extra'=>['f0','prefd',2,'extra'],
        'config-file-setfd-false'=>['f0','setfd',3,'false'],
        'config-file-setfd-throw'=>['f0','setfd',3,'throw'],
        'config-file-postfd-undefined'=>['f0','postfd',4,'undefined'],
        'config-file-postfd-throw'=>['f0','postfd',4,'throw'],
        'config-file-postfd-missing'=>['f0','postfd',4,'missing'],
        'config-file-binmode-false'=>['f0','binmode',4,'false'],
        'config-file-binmode-throw'=>['f0','binmode',4,'throw'],
      );
      my $configuration_profile=$configuration{$mode};
      my @configuration_queue;
      if(defined($configuration_profile)) {
        my @all=([Fcntl::F_GETFL(),0],[Fcntl::F_GETFD(),0],
          [Fcntl::F_SETFD(),Fcntl::FD_CLOEXEC()],[Fcntl::F_GETFD(),0]);
        @configuration_queue=map {[@$_]} @all[0..$configuration_profile->[2]-1];
      }
      my %boundary=(
        'boundary-expiry-hold-entry'=>[2,0,0],
        'boundary-expiry-hold-complete'=>[237,24,12],
        'boundary-expiry-recheck-entry'=>[238,24,12],
        'boundary-expiry-recheck-complete'=>[407,42,12],
        'boundary-throw-hold-entry'=>[2,0,0],
        'boundary-throw-hold-complete'=>[237,24,12],
        'boundary-throw-recheck-entry'=>[238,24,12],
        'boundary-throw-recheck-complete'=>[407,42,12],
      );
      my $emit=sub {push @grammar,[@_];};
      my $h=0;my $stage_count=0;
      my $helper_grammar=sub {
        my ($path)=@_;my $prefix='h'.(++$h);
        push @jobs,{prefix=>$prefix,path=>$path,stageCount=>$stage_count};
        $emit->('clock',$prefix) for 1..2;
        $emit->('pipe',$prefix.'.'.$_) for qw(in out err setup);
        for my $name(qw(in-r in-w out-r out-w err-r err-w setup-r setup-w)) {
          $emit->('binmode',$prefix.'.'.$name);$emit->('fileno',$prefix.'.'.$name);
        }
        $emit->('fcntl',$prefix.'.setup-w');
        $emit->('opendir',$prefix.'.census');$emit->('fileno',$prefix.'.census');
        $emit->('readdir',$prefix.'.census') for 1..(15+$stage_count);
        $emit->('closedir',$prefix.'.census');$emit->('fileno',$prefix.'.setup-w');
        $emit->('clock',$prefix);$emit->('fork',$prefix);
        $emit->('close',$prefix.'.'.$_) for qw(in-r in-w out-w err-w setup-w);
        $emit->('fileno',$prefix.'.'.$_) for qw(out-r err-r setup-r);
        $emit->('wait',$prefix);$emit->('clock',$prefix);$emit->('ready',$prefix);
        for my $name(qw(out-r err-r setup-r)) {
          $emit->('fileno',$prefix.'.'.$name);$emit->('read',$prefix.'.'.$name);
          $emit->('close',$prefix.'.'.$name) unless $name eq 'out-r';
        }
        $emit->('wait',$prefix);$emit->('wait',$prefix);
        $emit->('clock',$prefix);$emit->('ready',$prefix);
        $emit->('fileno',$prefix.'.out-r');$emit->('read',$prefix.'.out-r');
        $emit->('close',$prefix.'.out-r');$emit->('wait',$prefix);$emit->('clock',$prefix);
        $emit->('fileno',$prefix.'.'.$_) for qw(in-r in-w out-r out-w err-r err-w setup-r setup-w);
      };
      my $unsettled_grammar=sub {
        $fail->() unless $h==24&&$stage_count==12;
        my $prefix='h'.(++$h);
        push @jobs,{prefix=>$prefix,path=>'/',stageCount=>12,cleanup=>1};
        $emit->('clock',$prefix) for 1..2;
        $emit->('pipe',$prefix.'.'.$_) for qw(in out err setup);
        for my $name(qw(in-r in-w out-r out-w err-r err-w setup-r setup-w)) {
          $emit->('binmode',$prefix.'.'.$name);$emit->('fileno',$prefix.'.'.$name);
        }
        $emit->('fcntl',$prefix.'.setup-w');
        $emit->('opendir',$prefix.'.census');$emit->('fileno',$prefix.'.census');
        $emit->('readdir',$prefix.'.census') for 1..27;
        $emit->('closedir',$prefix.'.census');$emit->('fileno',$prefix.'.setup-w');
        $emit->('clock',$prefix);$emit->('fork',$prefix);
        $emit->('close',$prefix.'.in-r');
        for my $name(qw(in-r in-w out-r out-w err-r err-w setup-r setup-w)) {
          $emit->('fileno',$prefix.'.'.$name);
          $emit->('close',$prefix.'.'.$name) unless $name eq 'in-r';
        }
        $emit->('wait',$prefix);
      };
      my $dir_grammar=sub {
        my ($i)=@_;my $role='d'.$i;
        $emit->('fileno',$role);$emit->('clock','stage');$emit->('stat',$role);$emit->('lstat',$role);
        $helper_grammar->($directory_paths[$i]);
        $emit->('stat',$role);$emit->('lstat',$role);$emit->('clock','stage');
      };
      my $file_grammar=sub {
        my ($i)=@_;my $role='f'.$i;
        $emit->('fileno',$role);$emit->('stat',$role);$emit->('lstat',$role);$emit->('seek',$role);
        $emit->('clock','stage');$emit->('read',$role);$emit->('clock','stage');$emit->('read',$role);
        $emit->('stat',$role);$emit->('lstat',$role);$emit->('clock','stage');
      };
      my $epoch_grammar=sub {
        $dir_grammar->($_) for 0..5;
        for my $i(0..5) {$file_grammar->($i);$helper_grammar->($logical.'/'.$leaf_rel[$i]);$file_grammar->($i);}
        $dir_grammar->($_) for 0..5;
      };
      $emit->('clock','startup');
      if($mode eq 'absent'||$mode=~/\Aadmission-/) {$emit->('clock','stage');}
      elsif($mode=~/\Aunknown-/) {
        $emit->('clock','stage');$emit->('lstat','d0');$emit->('sysopen','d0');
      }
      elsif($fixture_modes{$mode}) {
        $emit->('clock','stage');$emit->('lstat','d0');$emit->('sysopen','d0');
      }
      elsif($mode eq 'staged-reference-alias') {
        $emit->('clock','stage');$emit->('lstat','d0');$emit->('sysopen','d0');
        ++$stage_count;$emit->('fcntl','d0') for 1..4;$dir_grammar->(0);
        $emit->('lstat','d1');$emit->('sysopen','d1');$emit->('close','d0');
      }
      elsif(defined($configuration_profile)) {
        my $target=$configuration_profile->[0] eq 'd0'?1:7;
        $emit->('clock','stage');
        for my $n(1..$target) {
          my $role=$n<=6?'d'.($n-1):'f'.($n-7);
          $emit->('lstat',$role);$emit->('sysopen',$role);++$stage_count;
          $emit->('fcntl',$role) for 1..($n==$target?$configuration_profile->[2]:4);
          if($n==$target) {$emit->('binmode',$role) if $configuration_profile->[1] eq 'binmode';last;}
          $dir_grammar->($n-1);
        }
        for my $n(1..$stage_count) {$emit->('close',$n<=6?'d'.($n-1):'f0');}
      }
      elsif($mode eq 'partial-tied-dir'||$mode eq 'partial-tied-file') {
        my $target=$mode eq 'partial-tied-dir'?1:7;
        $emit->('clock','stage');
        for my $n(1..$target) {
          my $role=$n<=6?'d'.($n-1):'f'.($n-7);
          $emit->('lstat',$role);$emit->('sysopen',$role);
          ++$stage_count;$emit->('fcntl',$role) for 1..4;
          if($n==$target) {$emit->('binmode',$role) if $n>6;last;}
          $dir_grammar->($n-1);
        }
        for my $n(1..$stage_count) {$emit->('close','d'.($n-1)) if $n<=6;$emit->('close','f0') if $n==7;}
      }
      elsif($mode eq 'healthy'||$mode=~/\A(?:open|close)-/||exists($boundary{$mode})||$mode=~/\Ametadata-/||$mode eq 'h7-acl-plus'||$mode eq 'h7-raw256'||$mode eq 'file-byte-xor-denied'||$mode eq 'file-byte-xor-mutant'||$mode=~/\Amagic-/||$mode=~/\Adrift-/||$mode=~/\Aamagic-/||$mode=~/\Aactive-/||defined($identity_profile)||$mode=~/\Ashared-unsettled-(?:baseline|mutant)\z/||$mode=~/\Aepoch-acl-(?:baseline|mutant)\z/||$mode=~/\Aonce-primitive-(?:baseline|mutant)\z/) {
        $emit->('clock','stage');
        for my $n(1..12) {
          my $role=$n<=6?'d'.($n-1):'f'.($n-7);
          $emit->('lstat',$role);$emit->('sysopen',$role);
          if($mode=~/\Aopen-/&&$n==$slot) {++$stage_count unless $mode eq 'open-undefined';last;}
          ++$stage_count;$emit->('fcntl',$role) for 1..4;
          if($n<=6) {$dir_grammar->($n-1);}
          else {$emit->('binmode',$role);$file_grammar->($n-7);}
        }
        if($mode eq 'healthy'||$mode=~/\Aclose-/||exists($boundary{$mode})||$mode=~/\Ametadata-/||$mode eq 'h7-acl-plus'||$mode eq 'h7-raw256'||$mode eq 'file-byte-xor-denied'||$mode eq 'file-byte-xor-mutant'||$mode=~/\Amagic-/||$mode=~/\Adrift-/||$mode=~/\Aamagic-/||$mode=~/\Aactive-/||defined($identity_profile)||$mode=~/\Ashared-unsettled-(?:baseline|mutant)\z/||$mode=~/\Aepoch-acl-(?:baseline|mutant)\z/||$mode=~/\Aonce-primitive-(?:baseline|mutant)\z/) {
          $epoch_grammar->();$emit->('clock','stage');
          $unsettled_grammar->() if $mode=~/\Ashared-unsettled-(?:baseline|mutant)\z/;
          $emit->('clock','stage');
          $epoch_grammar->();$emit->('clock','stage');
        }
        for my $n(1..$stage_count) {$emit->('close',$n<=6?'d'.($n-1):'f'.($n-7));}
      }
      if($mode eq 'shared-unsettled-baseline') {
        my @prefix;my $found=0;
        for my $g(@grammar) {
          push @prefix,$g;
          if($g->[0] eq 'wait'&&$g->[1] eq 'h25') {$found=1;last;}
        }
        $fail->() unless $found&&@jobs==43;
        @grammar=@prefix;splice @jobs,25;
        $emit->('close',$_) for qw(d0 d1 d2 d3 d4 d5 f0 f1 f2 f3 f4 f5);
      }
      if($mode eq 'epoch-acl-baseline') {
        my @prefix;my $end=0;
        for my $g(@grammar) {
          push @prefix,$g;
          last if $g->[0] eq 'fileno'&&$g->[1] eq 'h25.setup-w'&&++$end==3;
        }
        $fail->() unless $end==3&&@jobs==42;
        @grammar=@prefix;splice @jobs,25;
        $emit->('close',$_) for qw(d0 d1 d2 d3 d4 d5 f0 f1 f2 f3 f4 f5);
      }
      if($mode eq 'once-primitive-mutant') {
        my @next;my $found=0;
        for my $g(@grammar) {
          push @next,$g;
          if($g->[0] eq 'close'&&$g->[1] eq 'd0') {
            $fail->() if $found++;push @next,['close','d0'];
          }
        }
        $fail->() unless $found==1&&@jobs==42;@grammar=@next;
      }
      if(exists($boundary{$mode})) {
        my ($target,$helpers,$stage)=@{$boundary{$mode}};
        my @prefix;my $clocks=0;
        for my $g(@grammar) {
          push @prefix,$g;++$clocks if $g->[0] eq 'clock';
          last if $clocks==$target;
        }
        $fail->() unless $clocks==$target&&@jobs==42;
        @grammar=@prefix;splice @jobs,$helpers;
        for my $n(1..$stage) {$emit->('close',$n<=6?'d'.($n-1):'f'.($n-7));}
      }
      if($mode=~/\Ametadata-/) {
        my @prefix;my $clocks=0;
        for my $g(@grammar) {
          push @prefix,$g;++$clocks if $g->[0] eq 'clock';last if $clocks==237;
        }
        $fail->() unless $clocks==237&&@jobs==42;
        @grammar=@prefix;splice @jobs,24;
        for my $n(1..12) {$emit->('close',$n<=6?'d'.($n-1):'f'.($n-7));}
      }
      if($mode eq 'h7-acl-plus'||$mode eq 'h7-raw256') {
        my @prefix;my ($end,$success_clock)=(0,0);
        for my $g(@grammar) {
          if($mode eq 'h7-raw256'&&$g->[0] eq 'clock'&&$g->[1] eq 'h7') {
            ++$success_clock;next if $success_clock==6;
          }
          push @prefix,$g;
          if($g->[0] eq 'fileno'&&$g->[1] eq 'h7.setup-w') {last if ++$end==3;}
        }
        $fail->() unless $end==3&&@jobs==42
          &&($mode ne 'h7-raw256'||$success_clock==6);
        @grammar=@prefix;splice @jobs,7;
        for my $n(1..12) {$emit->('close',$n<=6?'d'.($n-1):'f'.($n-7));}
      }
      if($mode eq 'file-byte-xor-denied') {
        my @prefix;my $reads=0;
        for my $g(@grammar) {
          push @prefix,$g;
          last if $g->[0] eq 'read'&&$g->[1] eq 'f0'&&++$reads==2;
        }
        $fail->() unless $reads==2&&@jobs==42;
        @grammar=@prefix;splice @jobs,6;
        for my $n(1..7) {$emit->('close',$n<=6?'d'.($n-1):'f0');}
      }
      if($mode=~/\Amagic-/) {
        my @prefix;my $clocks=0;
        for my $g(@grammar) {
          push @prefix,$g;++$clocks if $g->[0] eq 'clock';last if $clocks==237;
        }
        $fail->() unless $clocks==237&&@jobs==42;
        @grammar=@prefix;splice @jobs,24;
        for my $n(1..12) {$emit->('close',$n<=6?'d'.($n-1):'f'.($n-7));}
      }
      if($mode=~/\Adrift-/) {
        my @prefix;my $clocks=0;
        for my $g(@grammar) {
          push @prefix,$g;++$clocks if $g->[0] eq 'clock';last if $clocks==237;
        }
        $fail->() unless $clocks==237&&@jobs==42;
        @grammar=@prefix;splice @jobs,24;
        for my $n(1..12) {$emit->('close',$n<=6?'d'.($n-1):'f'.($n-7));}
      }
      if($mode=~/\Aamagic-/) {
        my @prefix;my $clocks=0;
        for my $g(@grammar) {
          push @prefix,$g;++$clocks if $g->[0] eq 'clock';last if $clocks==237;
        }
        $fail->() unless $clocks==237&&@jobs==42;
        @grammar=@prefix;splice @jobs,24;
        for my $n(1..12) {$emit->('close',$n<=6?'d'.($n-1):'f'.($n-7));}
      }
      if($mode=~/\Aactive-/) {
        my @prefix;my $clocks=0;
        for my $g(@grammar) {
          push @prefix,$g;++$clocks if $g->[0] eq 'clock';last if $clocks==237;
        }
        $fail->() unless $clocks==237&&@jobs==42;
        @grammar=@prefix;splice @jobs,24;
        for my $n(1..12) {$emit->('close',$n<=6?'d'.($n-1):'f'.($n-7));}
      }
      if(defined($identity_profile)) {
        my @prefix;my $ordinal=0;
        for my $g(@grammar) {
          push @prefix,$g;
          if($g->[0] eq $identity_profile->[0]&&$g->[1] eq $identity_profile->[1]) {
            ++$ordinal;last if $ordinal==$identity_profile->[2];
          }
        }
        $fail->() unless $ordinal==$identity_profile->[2]&&@jobs==42;
        @grammar=@prefix;splice @jobs,$identity_profile->[3];
        for my $n(1..$identity_profile->[4]) {
          $emit->('close',$n<=6?'d'.($n-1):'f'.($n-7));
        }
      }
      my $take=sub {
        my ($op,$role)=@_;$check->();$fail->() unless @grammar;
        my $want=shift @grammar;$fail->() unless $want->[0] eq $op&&$want->[1] eq $role;
        ++$calls{$op};
        $fail->() if @events>=8192;
        my $event={seq=>1+@events,op=>$op,role=>$role};
        $fail->() if length(JSON::PP->new->canonical->utf8->encode($event))>512;
        push @events,$event;
      };
      my $same_physical=sub {
        my ($old,$now,$kind)=@_;$fail->() unless @$old==13&&@$now==13;
        $fail->() unless $kind eq 'file'||$kind eq 'directory'||$kind eq 'pipe';
        my @fields=$kind eq 'pipe'?(0..6):$kind eq 'directory'?(0,1,2,4,5):(0,1,2,3,4,5,7,9,10);
        for my $i(@fields) {$fail->() unless $old->[$i]==$now->[$i];}
      };
      my $register=sub {
        my ($fh,$role,$dir_stream,$path,$fixture_only)=@_;
        $fixture_only=defined($fixture_only)?$fixture_only:0;
        # Retain raw acquisition, immutable attribution and disposer before inspection.
        my $o={fh=>$fh,role=>$role,dirStream=>$dir_stream,path=>$path,attempted=>0,closed=>0,
          fixtureOnly=>sub {$fixture_only},
          originalClose=>sub {$dir_stream?CORE::closedir($fh):CORE::close($fh)}};
        push @owned,$o;
        my $fd=CORE::fileno($fh);$fail->() unless defined($fd)&&$fd>=3;
        for my $other(@owned) {
          next if $other==$o;$fail->() if $other->{fh}==$fh
            ||(!$other->{closed}&&defined($other->{fd})&&$other->{fd}==$fd);
        }
        $o->{fd}=$fd;$o->{identity}=[CORE::stat($fh)];$fail->() unless @{$o->{identity}}==13;
        $roles{$role}=$o;return $o;
      };
      my $lookup=sub {
        my ($cell,$closed_allowed)=@_;
        # Inspect the ORIGINAL operand cell before candidate FETCH/comparison.
        my $sv=B::svref_2object($cell);
        $fail->() if $sv->FLAGS&0x00f00000;
        $fail->() unless ref($sv) eq 'B::IV'&&($sv->FLAGS&B::SVf_ROK());
        my $gv=$sv->RV;$fail->() unless ref($gv) eq 'B::GV';
        $fail->() if $gv->FLAGS&0x00f00000;
        my $gm=$gv->MAGIC;$fail->() if defined($gm);
        my $io=$gv->IO;$fail->() unless ref($io) eq 'B::IO';
        $fail->() if $io->FLAGS&0x00e00000;
        my $im=$io->MAGIC;$fail->() if defined($im);
        my $fh=$$cell;
        for my $o(@owned) {
          next unless $o->{fh}==$fh;my $fd=CORE::fileno($fh);
          if($o->{closed}) {$fail->() unless $closed_allowed&&!defined($fd);return $o;}
          $fail->() if $o->{attempted}||!defined($fd)||$fd!=$o->{fd};
          my $kind=$o->{path}?($o->{path}{directory}?'directory':'file'):($o->{dirStream}?'directory':'pipe');
          $same_physical->($o->{identity},[CORE::stat($fh)],$kind);
          return $o;
        }
        $fail->();
      };
      my $dispose=sub {
        my ($o,$fixture)=@_;
        $fail->() if exists($o->{fixtureOnly})&&$o->{fixtureOnly}->()&&!$fixture;
        return 0 if $o->{attempted};
        $o->{attempted}=1;$o->{fixture}=$fixture;
        $!=0;my $ok=eval {$o->{originalClose}->()};
        my $error=$@;my $errno=0+$!;
        $o->{closed}=1 if $ok&&!length($error)&&!$errno&&!defined(CORE::fileno($o->{fh}));
        $latch->() unless $o->{closed};return $o->{closed};
      };
      my ($job,$selector,$census);my (@pipe_names,@wait,@ready,@census_names);my %reads;
      my $helper_enter=sub {
        my ($path)=@_;$check->();$fail->() unless @jobs&&!defined($job);
        $job=shift @jobs;$fail->() unless $job->{path} eq $path;
        @pipe_names=qw(in out err setup);@wait=([0,0],[0,0],[0,0],[424242,0]);
        @ready=(['out-r','err-r','setup-r'],['out-r']);
        %reads=('out-r'=>[1,0],'err-r'=>[0],'setup-r'=>[0]);
        if($job->{cleanup}) {
          $fail->() unless $mode=~/\Ashared-unsettled-(?:baseline|mutant)\z/
            &&$job->{prefix} eq 'h25'&&$job->{path} eq '/'&&$job->{stageCount}==12;
          @wait=([424242,0]);@ready=();%reads=();
        }
        $selector=undef;$census=undef;@census_names=();
      };
      my $helper_leave=sub {
        $check->();$fail->() if @pipe_names||@wait||@ready||@census_names||grep {@$_} values %reads;
        $fail->() unless defined($job)&&defined($census)&&$census->{closed};
        for my $name(qw(in-r in-w out-r out-w err-r err-w setup-r setup-w)) {
          my $o=$roles{$job->{prefix}.'.'.$name};$fail->() unless defined($o)&&$o->{closed}&&!defined(CORE::fileno($o->{fh}));
        }
        $job=undef;
      };
      my $deny=sub {$latch->();die "$fault\n";};
      my $open_ordinal=0;
      require Symbol;require overload;
      my $partial_counts={factory=>0,untie=>0,destroy=>0,callbacks=>{
        map {$_=>0} qw(FETCHSIZE FETCH STORE STORESIZE EXTEND PUSH POP SHIFT UNSHIFT CLEAR EXISTS DELETE)}};
      my $partial_nominated=0;
      my %callbacks=map {$_=>0} qw(FETCH STORE FILENO CLOSE READ PRINT PRINTF WRITE READLINE GETC SEEK TELL EOF BINMODE CALL string numeric bool compare);
      my %factory=(scalar=>0,handle=>0);
      my %finalization=(untie=>0,destroy=>0);
      my $counts={callbacks=>\%callbacks,factory=>\%factory,finalization=>\%finalization};
      my ($nominee_cell,$nominee_glob,$nominee_shape,$before_callbacks,$after_finalization);
      my $classes=<<'TEST_STAGED_CLASSES';
package TestStagedScalar;
sub TIESCALAR {my ($class,$counts)=@_;++$counts->{factory}{scalar};bless {counts=>$counts},$class;}
sub deny {my ($self,$name)=@_;++$self->{counts}{callbacks}{$name};die "TEST_STAGED_CANDIDATE_CALLBACK\n";}
sub FETCH {$_[0]->deny('FETCH');}
sub STORE {$_[0]->deny('STORE');}
sub UNTIE {++$_[0]{counts}{finalization}{untie};}
sub DESTROY {++$_[0]{counts}{finalization}{destroy};}
package TestStagedHandle;
sub TIEHANDLE {my ($class,$counts)=@_;++$counts->{factory}{handle};bless {counts=>$counts},$class;}
sub deny {my ($self,$name)=@_;++$self->{counts}{callbacks}{$name};die "TEST_STAGED_CANDIDATE_CALLBACK\n";}
sub FILENO {$_[0]->deny('FILENO');}
sub CLOSE {$_[0]->deny('CLOSE');}
sub READ {$_[0]->deny('READ');}
sub PRINT {$_[0]->deny('PRINT');}
sub PRINTF {$_[0]->deny('PRINTF');}
sub WRITE {$_[0]->deny('WRITE');}
sub READLINE {$_[0]->deny('READLINE');}
sub GETC {$_[0]->deny('GETC');}
sub SEEK {$_[0]->deny('SEEK');}
sub TELL {$_[0]->deny('TELL');}
sub EOF {$_[0]->deny('EOF');}
sub BINMODE {$_[0]->deny('BINMODE');}
sub UNTIE {++$_[0]{counts}{finalization}{untie};}
sub DESTROY {++$_[0]{counts}{finalization}{destroy};}
package TestStagedPartialArray;
sub TIEARRAY {my ($class,$counts)=@_;++$counts->{factory};bless {counts=>$counts},$class;}
sub deny {my ($self,$name)=@_;++$self->{counts}{callbacks}{$name};die "TEST_STAGED_PARTIAL_CALLBACK\n";}
sub FETCHSIZE {$_[0]->deny('FETCHSIZE');}
sub FETCH {$_[0]->deny('FETCH');}
sub STORE {$_[0]->deny('STORE');}
sub STORESIZE {$_[0]->deny('STORESIZE');}
sub EXTEND {$_[0]->deny('EXTEND');}
sub PUSH {$_[0]->deny('PUSH');}
sub POP {$_[0]->deny('POP');}
sub SHIFT {$_[0]->deny('SHIFT');}
sub UNSHIFT {$_[0]->deny('UNSHIFT');}
sub CLEAR {$_[0]->deny('CLEAR');}
sub EXISTS {$_[0]->deny('EXISTS');}
sub DELETE {$_[0]->deny('DELETE');}
sub UNTIE {++$_[0]{counts}{untie};}
sub DESTROY {++$_[0]{counts}{destroy};}
package TestStagedMetadataHash;
our @ISA=('TestStagedPartialArray');
sub TIEHASH {my ($class,$counts)=@_;++$counts->{factory};bless {counts=>$counts},$class;}
sub FIRSTKEY {$_[0]->deny('FIRSTKEY');}
sub NEXTKEY {$_[0]->deny('NEXTKEY');}
sub SCALAR {$_[0]->deny('SCALAR');}
package TestStagedMetadataScalar;
our @ISA=('TestStagedPartialArray');
sub TIESCALAR {my ($class,$counts)=@_;++$counts->{factory};bless {counts=>$counts},$class;}
package TestStagedOverloaded;
use overload
    '""'=>sub {++$_[0]{counts}{callbacks}{string};die "TEST_STAGED_CANDIDATE_CALLBACK\n";},
    '0+'=>sub {++$_[0]{counts}{callbacks}{numeric};die "TEST_STAGED_CANDIDATE_CALLBACK\n";},
    'bool'=>sub {++$_[0]{counts}{callbacks}{bool};die "TEST_STAGED_CANDIDATE_CALLBACK\n";},
    '=='=>sub {++$_[0]{counts}{callbacks}{compare};die "TEST_STAGED_CANDIDATE_CALLBACK\n";},
    fallback=>0;
sub DESTROY {++$_[0]{counts}{finalization}{destroy};}
package main;
1;
TEST_STAGED_CLASSES
      my $classes_ok=eval $classes;my $classes_error=$@;
      $fail->() unless $classes_ok&&!length($classes_error);
      my $shape=sub {
        my ($cell)=@_;my $sv=B::svref_2object($cell);
        my $out={cellClass=>ref($sv),cellFlags=>0+$sv->FLAGS};
        if($sv->FLAGS&B::SVf_ROK()) {
          my $rv=$sv->RV;$out->{rvClass}=ref($rv);$out->{rvFlags}=0+$rv->FLAGS;
          if(ref($rv) eq 'B::GV') {
            my $magic=$rv->MAGIC;$out->{gvMagic}=defined($magic)?1:0;
            my $io=$rv->IO;$out->{ioClass}=ref($io);
            if(ref($io) eq 'B::IO') {
              $out->{ioFlags}=0+$io->FLAGS;my $im=$io->MAGIC;$out->{ioMagic}=defined($im)?1:0;
            }
          }
        }
        return $out;
      };
      my $alias_native=sub {
        my ($cell)=@_;my $s=$shape->($cell);
        $fail->() unless $s->{cellClass} eq 'B::IV'&&($s->{cellFlags}&B::SVf_ROK())
          &&!($s->{cellFlags}&0x00f00000)&&$s->{rvClass} eq 'B::GV'
          &&!($s->{rvFlags}&0x00f00000)&&!$s->{gvMagic}
          &&$s->{ioClass} eq 'B::IO'&&!($s->{ioFlags}&0x00e00000)&&!$s->{ioMagic};
        return 1;
      };
      my $nominate=sub {
        my ($cell)=@_;$fail->() unless $open_ordinal==1&&!defined($nominee_cell)&&!@owned;
        $nominee_cell=$cell; # retain ORIGINAL pending cell before nomination
        if($mode eq 'unknown-cell') {
          tie $$cell,'TestStagedScalar',$counts;
          # No candidate VALUE access after tying this original alias.
        } elsif($mode eq 'unknown-handle'||$mode eq 'unknown-blessed-glob') {
          my $g=Symbol::gensym();$nominee_glob=$g;
          if($mode eq 'unknown-handle') {tie *$g,'TestStagedHandle',$counts;}
          else {bless $g,'TestStagedBlessedGlob';}
          $$cell=$g;
        } elsif($mode eq 'unknown-overloaded') {$$cell=bless {counts=>$counts},'TestStagedOverloaded';}
        elsif($mode eq 'unknown-indirect') {$$cell='TEST_STAGED_UNOPENED_HANDLE';}
        elsif($mode eq 'unknown-scalar-ref') {my $value=0;$$cell=\$value;}
        elsif($mode eq 'unknown-array') {$$cell=[];}
        elsif($mode eq 'unknown-hash') {$$cell={};}
        elsif($mode eq 'unknown-coderef') {$$cell=sub {++$callbacks{CALL};die "TEST_STAGED_CANDIDATE_CALLBACK\n";};}
        else {$fail->();}
        $nominee_shape=$shape->($cell);
        $fail->() unless ref($nominee_shape) eq 'HASH';
        $fail->() if grep {$_} values %callbacks;
        if($mode eq 'unknown-cell') {
          $fail->() unless $factory{scalar}==1&&($nominee_shape->{cellFlags}&0x00e00000);
        } elsif($mode eq 'unknown-handle') {
          $fail->() unless $factory{handle}==1&&$nominee_shape->{rvClass} eq 'B::GV'
            &&($nominee_shape->{gvMagic}||($nominee_shape->{ioFlags}//0)&0x00e00000||$nominee_shape->{ioMagic});
        }
        return 1;
      };
      my ($loaded,$setup_error,$body_ok,$primary);my $load_complete=0;my $outcomes={};
      my $helpers=0;my $repeat_delta;
      my %identity_seen;
      my $identity_project=sub {
        my ($op,$p,$physical)=@_;my $copy=$project->($p,$physical);
        return $copy unless defined($identity_profile);
        my $ordinal=++$identity_seen{$op.':'.$p->{role}};
        return $copy unless $op eq $identity_profile->[0]&&$p->{role} eq $identity_profile->[1]
          &&$ordinal==$identity_profile->[2];
        $fail->() if exists($outcomes->{identityNomination});
        $fail->() unless @$physical==13&&@$copy==13;
        if($mode eq 'identity-dir-post-device'||$mode eq 'identity-file-post-size') {
          $fail->() unless !defined($job)&&$helpers==$identity_profile->[3]
            &&task6a_origin_helpers_settled();
        }
        my ($field,$before,$after);
        if($identity_profile->[5] eq 'shape') {
          $field='length';$before=scalar(@$copy);pop @$copy;$after=scalar(@$copy);
        } elsif($identity_profile->[5] eq 'type') {
          $field='type';$before=$copy->[2];
          $fail->() unless Fcntl::S_ISREG($before);
          $copy->[2]=($before&07777)|0040000;$after=$copy->[2];
          $fail->() unless Fcntl::S_ISDIR($after);
        } else {
          my %fields=(owner=>4,inode=>1,device=>0,size=>7);
          my $index=$fields{$identity_profile->[5]};$fail->() unless defined($index);
          $field=$identity_profile->[5];$before=$copy->[$index];
          ++$copy->[$index];$after=$copy->[$index];
        }
        $outcomes->{identityNomination}={op=>''.$op,role=>''.$p->{role},ordinal=>0+$ordinal,
          field=>''.$field,before=>0+$before,after=>0+$after,
          actualTupleLength=>0+scalar(@$physical),returnedTupleLength=>0+scalar(@$copy),
          settledHelpers=>0+$helpers,actualCoreMetadata=>JSON::PP::true};
        return $copy;
      };
      {
        no warnings qw(redefine once);
        local *CORE::GLOBAL::sysopen=sub (*$$;$) {
          $check->();$fail->() unless @_==3&&!defined($_[0])&&!ref($_[1])&&!ref($_[2]);
          my $p=$paths{$_[1]};$fail->() unless defined($p);
          my $flags=Fcntl::O_RDONLY()|Fcntl::O_NOFOLLOW()
            |($p->{directory}?Fcntl::O_DIRECTORY():Fcntl::O_NONBLOCK());
          $fail->() unless $_[2]==$flags&&!exists($roles{$p->{role}});
          $take->('sysopen',$p->{role});++$open_ordinal;
          if($mode=~/\Aunknown-/) {$nominate->(\($_[0]));return 1;}
          if($mode eq 'staged-reference-alias'&&$open_ordinal==2) {
            my $old=$roles{'d0'};$fail->() unless defined($old)&&$p->{role} eq 'd1'
              &&!$old->{attempted}&&!$old->{closed};
            $alias_native->(\($old->{fh}));
            my $live=CORE::fileno($old->{fh});$fail->() unless defined($live)&&$live==$old->{fd};
            $_[0]=$old->{fh};
            $alias_native->(\($_[0]));$fail->() unless $_[0]==$old->{fh};
            $outcomes->{stagedAliasNomination}={sameRef=>JSON::PP::true,sameFd=>JSON::PP::true,
              newRawAcquisition=>JSON::PP::false};
            return 1;
          }
          if($fixture_modes{$mode}) {
            $fail->() unless $open_ordinal==1&&$p->{role} eq 'd0';
            if($mode eq 'hidden-open-undefined') {
              CORE::sysopen(my $raw,$p->{actual},$flags) or $fail->();
              ++$raw_acquisitions;
              $fixture_record=$register->($raw,'fixture-hidden',0,$p,1);
              $fixture_original=$raw;
              $same_physical->($p->{identity},$fixture_record->{identity},'directory');
              $fail->() if defined($_[0]);return 0;
            }
            $fail->() unless defined($fixture_original)&&defined($fixture_record)
              &&$raw_acquisitions==1&&$fixture_record->{fixtureOnly}->();
            $_[0]=$mode eq 'foreign-fd-alias'?$fixture_alias:$fixture_original;
            return 1;
          }
          return 0 if $mode eq 'open-undefined'&&$open_ordinal==$slot;
          CORE::sysopen(my $fh,$p->{actual},$flags) or $fail->();
          my $o=$register->($fh,$p->{role},0,$p);
          $same_physical->($p->{identity},$o->{identity},$p->{directory}?'directory':'file');
          $o->{fcntlQueue}=[[Fcntl::F_GETFL(),0],[Fcntl::F_GETFD(),0],
            [Fcntl::F_SETFD(),Fcntl::FD_CLOEXEC()],[Fcntl::F_GETFD(),0]];
          if(defined($configuration_profile)&&$p->{role} eq $configuration_profile->[0]) {
            $o->{fcntlQueue}=[map {[@$_]} @configuration_queue];
          }
          $_[0]=$fh;$o->{exposed}=1;
          return 0 if $mode eq 'open-false'&&$open_ordinal==$slot;
          die "TEST_STAGED_NOMINATED_OPEN_THROW\n" if $mode eq 'open-throw'&&$open_ordinal==$slot;
          return 1;
        };
        local *CORE::GLOBAL::pipe=sub (**) {
          $check->();$fail->() unless @_==2&&!defined($_[0])&&!defined($_[1])
            &&defined($job)&&@pipe_names;
          my $name=shift @pipe_names;my $prefix=$job->{prefix}.'.'.$name;
          $take->('pipe',$prefix);
          CORE::pipe(my $a,my $b) or $fail->();
          # Both originals survive a failure while registering either member.
          my $oa={fh=>$a,role=>$prefix.'-r',dirStream=>0,attempted=>0,closed=>0,
            originalClose=>sub {CORE::close($a)}};
          my $ob={fh=>$b,role=>$prefix.'-w',dirStream=>0,attempted=>0,closed=>0,
            originalClose=>sub {CORE::close($b)}};
          push @owned,$oa,$ob;
          for my $o($oa,$ob) {
            $o->{fd}=CORE::fileno($o->{fh});$o->{identity}=[CORE::stat($o->{fh})];
            $fail->() unless defined($o->{fd})&&$o->{fd}>=3&&@{$o->{identity}}==13
              &&Fcntl::S_ISFIFO($o->{identity}[2]);
            for my $other(@owned) {
              next if $other==$o;$fail->() if $other->{fh}==$o->{fh}
                ||(!$other->{closed}&&defined($other->{fd})&&$other->{fd}==$o->{fd});
            }
            $roles{$o->{role}}=$o;
          }
          $_[0]=$a;$_[1]=$b;$oa->{exposed}=1;$ob->{exposed}=1;
          if($name eq 'out') {
            my $marker=(($mode eq 'h7-acl-plus'&&$job->{prefix} eq 'h7')
              ||($mode=~/\Aepoch-acl-(?:baseline|mutant)\z/&&$job->{prefix} eq 'h25'))?'+':'';
            my $row="-r--r--r--".$marker." 1 root wheel 16 Jan 1 2026 ".$job->{path}."\n";
            if(($mode eq 'h7-acl-plus'||$mode eq 'h7-raw256')&&$job->{prefix} eq 'h7') {
              $fail->() unless $job->{path} eq '/'&&!exists($outcomes->{h7PipeRow});
              $outcomes->{h7PipeRow}={bytes=>0+length($row),row=>''.$row};
            }
            if($mode=~/\Aepoch-acl-(?:baseline|mutant)\z/&&$job->{prefix} eq 'h25') {
              $fail->() unless $job->{path} eq '/'&&length($row)==41
                &&!exists($outcomes->{epochAclPipeRow});
              $outcomes->{epochAclPipeRow}={bytes=>0+length($row),row=>''.$row};
            }
            $!=0;my $n=CORE::syswrite($b,$row,length($row));
            $fail->() unless defined($n)&&$n==length($row)&&!$!;
          }
          return 1;
        };
        local *CORE::GLOBAL::binmode=sub (*;$) {
          $check->();$fail->() unless @_==1;my $o=$lookup->(\($_[0]),0);
          $take->('binmode',$o->{role});$fail->() if $o->{binary}++;
          CORE::binmode($o->{fh}) or $fail->();
          if(defined($configuration_profile)&&$configuration_profile->[1] eq 'binmode'
              &&$o->{role} eq $configuration_profile->[0]) {
            $fail->() unless !@{$o->{fcntlQueue}}&&!exists($outcomes->{configurationNomination});
            my ($role,$cut,$ordinal,$kind)=@$configuration_profile;
            $outcomes->{configurationNomination}={role=>''.$role,cut=>''.$cut,ordinal=>0+$ordinal,
              kind=>''.$kind,actualCoreCompleted=>JSON::PP::true};
            die "TEST_STAGED_NOMINATED_CONFIGURATION_THROW\n" if $kind eq 'throw';
            $fail->() unless $kind eq 'false';return 0;
          }
          return 1;
        };
        local *CORE::GLOBAL::fcntl=sub (*$$) {
          $check->();$fail->() unless @_==3;my $o=$lookup->(\($_[0]),0);
          $take->('fcntl',$o->{role});
          if($o->{path}) {
            $fail->() unless @{$o->{fcntlQueue}};my $want=shift @{$o->{fcntlQueue}};
            $fail->() unless $_[1]==$want->[0]&&$_[2]==$want->[1];
          } else {
            $fail->() unless defined($job)&&$o->{role} eq $job->{prefix}.'.setup-w'
              &&!$o->{configured}++&&$_[1]==Fcntl::F_SETFD()&&$_[2]==Fcntl::FD_CLOEXEC();
          }
          $!=0;my $v=CORE::fcntl($o->{fh},$_[1],$_[2]);
          $fail->() unless defined($v)&&!$!;
          if(defined($configuration_profile)&&$o->{role} eq $configuration_profile->[0]
              &&!@{$o->{fcntlQueue}}&&$configuration_profile->[1] ne 'binmode') {
            my ($role,$cut,$ordinal,$kind)=@$configuration_profile;
            $fail->() if exists($outcomes->{configurationNomination});
            $outcomes->{configurationNomination}={role=>''.$role,cut=>''.$cut,ordinal=>0+$ordinal,
              kind=>''.$kind,actualCoreCompleted=>JSON::PP::true};
            return undef if $kind eq 'undefined';
            die "TEST_STAGED_NOMINATED_CONFIGURATION_THROW\n" if $kind eq 'throw';
            return 0 if $kind eq 'false'||$kind eq 'missing';
            return ($v&~Fcntl::O_ACCMODE())|Fcntl::O_WRONLY() if $kind eq 'access';
            return $v&~Fcntl::O_NONBLOCK() if $kind eq 'nonblock';
            return $v|(Fcntl::FD_CLOEXEC()<<1) if $kind eq 'extra';
            $fail->();
          }
          if(($mode eq 'partial-tied-dir'&&$o->{role} eq 'd0'
              ||$mode eq 'partial-tied-file'&&$o->{role} eq 'f0')
              &&$o->{path}&&!@{$o->{fcntlQueue}}) {
            $fail->() unless $_[1]==Fcntl::F_GETFD()&&!$partial_nominated++;
            test_tie_staged_partial();
          }
          return $v;
        };
        local *CORE::GLOBAL::stat=sub (;*) {
          $check->();$fail->() unless @_==1&&wantarray;my $o=$lookup->(\($_[0]),0);
          $fail->() unless $o->{path};$take->('stat',$o->{role});
          my @s=CORE::stat($o->{fh});$same_physical->($o->{path}{identity},\@s,$o->{path}{directory}?'directory':'file');
          return @{$identity_project->('stat',$o->{path},\@s)};
        };
        local *CORE::GLOBAL::lstat=sub (;*) {
          $check->();$fail->() unless @_==1&&wantarray&&!ref($_[0]);
          my $p=$paths{$_[0]};$fail->() unless defined($p);$take->('lstat',$p->{role});
          my @s=CORE::lstat($p->{actual});$same_physical->($p->{identity},\@s,$p->{directory}?'directory':'file');
          return @{$identity_project->('lstat',$p,\@s)};
        };
        local *CORE::GLOBAL::sysseek=sub (*$$) {
          $check->();$fail->() unless @_==3;my $o=$lookup->(\($_[0]),0);
          $fail->() unless $o->{path}&&!$o->{path}{directory}&&$_[1]==0&&$_[2]==0;
          $take->('seek',$o->{role});$fail->() if $o->{readQueue}&&@{$o->{readQueue}};
          $o->{readQueue}=[length($o->{path}{body}),0];
          my $v=CORE::sysseek($o->{fh},0,0);$fail->() unless defined($v)&&$v==0;return $v;
        };
        local *CORE::GLOBAL::sysread=sub (*\$$;$) {
          $check->();$fail->() unless @_==3&&ref($_[1]) eq 'SCALAR'&&$_[2]==65536;
          my $buffer=$_[1];$fail->() unless !ref($$buffer)&&$$buffer eq '';
          my $o=$lookup->(\($_[0]),0);$take->('read',$o->{role});
          my ($want,$pipe_read);
          if($o->{path}) {
            $fail->() unless !$o->{path}{directory}&&$o->{readQueue}&&@{$o->{readQueue}};
            $want=shift @{$o->{readQueue}};
          } else {
            $fail->() unless defined($job)&&$o->{role}=~/\A\Q$job->{prefix}\E\.(out-r|err-r|setup-r)\z/;
            my $name=$1;my $queue=$reads{$name};$fail->() unless ref($queue) eq 'ARRAY'&&@$queue;
            $want=shift @$queue;$pipe_read=1;
            my $write=$name=~s/-r\z/-w/r;
            $fail->() unless $roles{$job->{prefix}.'.'.$write}{closed};
          }
          $!=0;my $n=CORE::sysread($o->{fh},$$buffer,65536);
          $fail->() unless defined($n)&&!$!&&!utf8::is_utf8($$buffer)&&$n==length($$buffer);
          $fail->() unless $pipe_read?($want?$n>0:$n==0):$n==$want;
          if(($mode eq 'file-byte-xor-denied'||$mode eq 'file-byte-xor-mutant')
              &&$o->{role} eq 'f0'&&!exists($outcomes->{byteNomination})) {
            $fail->() unless !defined($job)&&!$pipe_read&&$calls{read}==25
              &&$n==5864&&$$buffer eq $bodies[0]&&ord(substr($$buffer,0,1))==112;
            my $before=Digest::SHA::sha256_hex($$buffer);
            substr($$buffer,0,1)=chr(ord(substr($$buffer,0,1))^1);
            $fail->() unless length($$buffer)==$n&&substr($$buffer,1) eq substr($bodies[0],1)
              &&ord(substr($$buffer,0,1))==113;
            $outcomes->{byteNomination}={role=>'f0',readOrdinal=>25,bytes=>0+$n,
              beforeFirstByte=>112,afterFirstByte=>113,beforeSha256=>$before,
              afterSha256=>Digest::SHA::sha256_hex($$buffer),
              actualCoreRead=>JSON::PP::true,remainderUnchanged=>JSON::PP::true};
          }
          if($mode=~/\Aepoch-acl-(?:baseline|mutant)\z/&&defined($job)
              &&$job->{prefix} eq 'h25'&&$o->{role} eq 'h25.out-r') {
            push @{$outcomes->{epochAclActualReads}}, {bytes=>0+$n,body=>''.$$buffer};
          }
          if(($mode eq 'h7-acl-plus'||$mode eq 'h7-raw256')&&defined($job)
              &&$job->{prefix} eq 'h7'&&$o->{role} eq 'h7.out-r') {
            push @{$outcomes->{h7ActualReads}}, {bytes=>0+$n,body=>''.$$buffer};
          }
          return $n;
        };
        local *CORE::GLOBAL::fileno=sub (*) {
          $check->();$fail->() unless @_==1;my $o=$lookup->(\($_[0]),1);
          $take->('fileno',$o->{role});return CORE::fileno($o->{fh});
        };
        local *CORE::GLOBAL::close=sub (;*) {
          $fail->() unless @_==1;
          my $o=$lookup->(\($_[0]),$mode eq 'once-primitive-mutant'?1:0);
          if($mode eq 'once-primitive-mutant'&&$o->{closed}) {
            $fail->() unless $o->{role} eq 'd0'&&$o==$roles{d0}&&!$o->{dirStream}
              &&$o->{attempted}&&!defined(CORE::fileno($o->{fh}))
              &&@owned==390&&$helpers==42&&!defined($job)&&!@jobs
              &&@events&&$events[-1]{op} eq 'close'&&$events[-1]{role} eq 'd0'
              &&!exists($outcomes->{duplicatePrimitive});
            $outcomes->{duplicatePrimitive}={role=>'d0',allowanceConsumed=>JSON::PP::true};
            $take->('close','d0');
            my @warnings;my ($second,$ok,$error,$errno);
            {
              local $SIG{__WARN__}=sub {
                $fail->() unless @_==1&&!ref($_[0])&&!utf8::is_utf8($_[0])
                  &&length($_[0])<=256&&@warnings==0
                  &&$_[0]=~/\Aclose\(\) on unopened filehandle [^\x00-\x1f\x7f]{1,96} at -e line [1-9][0-9]{0,5}\.\n\z/;
                push @warnings,''.$_[0];
              };
              $!=0;$ok=eval {$second=$o->{originalClose}->();1;};
              $error=$@;$errno=0+$!;
            }
            $check->();$fail->() unless $ok&&!length($error)&&!$second
              &&$o->{attempted}&&$o->{closed}&&!defined(CORE::fileno($o->{fh}));
            @{$outcomes->{duplicatePrimitive}}{qw(actualCoreReturnedFalse filenoUndefined
              firstPhysicalClosed warningCount errno)}=(JSON::PP::true,JSON::PP::true,
              JSON::PP::true,0+scalar(@warnings),$errno);
            $outcomes->{duplicatePrimitive}{warnings}=\@warnings;
            return $second;
          }
          $fail->() if $o->{dirStream};$take->('close',$o->{role});
          my $closed=$dispose->($o,0);
          if($mode=~/\Ashared-unsettled-(?:baseline|mutant)\z/
              &&($o->{role} eq 'h25.in-r'||$o->{role} eq 'h25.in-w')) {
            $fail->() unless defined($job)&&$job->{cleanup}&&$closed&&$o->{closed}
              &&$o->{attempted}&&!defined(CORE::fileno($o->{fh}));
            $outcomes->{sharedCloseNominations}//=[];
            push @{$outcomes->{sharedCloseNominations}},{role=>''.$o->{role},
              physicallyClosedBeforeThrow=>JSON::PP::true};
            die "TEST_STAGED_SHARED_CLOSE_THROW\n";
          }
          if($mode=~/\Aclose-/&&defined($o->{path})) {
            my $n=$o->{role}=~/\Ad([0-5])\z/?1+$1:$o->{role}=~/\Af([0-5])\z/?7+$1:0;
            $fail->() unless $n>=1&&$n<=12&&$closed&&$o->{closed}
              &&$o->{attempted}&&!defined(CORE::fileno($o->{fh}));
            if($n==$slot) {
              $fail->() if exists($outcomes->{nominatedClose});
              $outcomes->{nominatedClose}={role=>''.$o->{role},slot=>0+$n,
                kind=>''.$mode,physicallyClosedBeforeResponse=>JSON::PP::true};
              return 0 if $mode eq 'close-false';
              die "TEST_STAGED_NOMINATED_CLOSE_THROW\n";
            }
          }
          return $closed;
        };
        local *CORE::GLOBAL::opendir=sub (*$) {
          $check->();$fail->() unless @_==2&&!defined($_[0])&&!ref($_[1])
            &&$_[1] eq '/dev/fd'&&defined($job)&&!defined($census)&&!@pipe_names;
          my $role=$job->{prefix}.'.census';$take->('opendir',$role);
          CORE::opendir(my $fh,'/dev/fd') or $fail->();
          $census=$register->($fh,$role,1,undef);$_[0]=$fh;$census->{exposed}=1;
          my @live=grep {!$_->{closed}} @owned;
          $fail->() unless @live==$job->{stageCount}+9;
          my %fds;
          for my $o(@live) {$lookup->(\($o->{fh}),0);$fail->() if $fds{$o->{fd}}++;}
          @census_names=('.', '..','0','1','2',map {"$_->{fd}"} @live);
          return 1;
        };
        local *CORE::GLOBAL::readdir=sub (*) {
          $check->();$fail->() unless @_==1&&!wantarray&&defined($census);
          my $o=$lookup->(\($_[0]),0);$fail->() unless $o==$census;
          $take->('readdir',$o->{role});$!=0;return shift @census_names;
        };
        local *CORE::GLOBAL::closedir=sub (*) {
          $fail->() unless @_==1;my $o=$lookup->(\($_[0]),0);
          $fail->() unless $o->{dirStream}&&defined($census)&&$o==$census&&!@census_names;
          $take->('closedir',$o->{role});return $dispose->($o,0);
        };
        local *CORE::GLOBAL::fork=sub () {
          $check->();$fail->() unless @_==0&&defined($job)&&defined($census)&&$census->{closed};
          $take->('fork',$job->{prefix});return 424242;
        };
        local *CORE::GLOBAL::waitpid=sub ($$) {
          $check->();$fail->() unless @_==2&&$_[0]==424242&&$_[1]==POSIX::WNOHANG()
            &&defined($job)&&@wait;
          $take->('wait',$job->{prefix});my $v=shift @wait;
          if($mode eq 'h7-raw256'&&$job->{prefix} eq 'h7'&&!@wait) {
            $fail->() unless $v->[0]==424242&&$v->[1]==0&&!exists($outcomes->{h7StatusNomination});
            $outcomes->{h7StatusNomination}={pid=>424242,rawStatus=>256};
            $v=[424242,256];
          }
          $?=$v->[1];return $v->[0];
        };
        local *IO::Select::can_read=sub {
          $check->();$fail->() unless @_==2&&ref($_[0]) eq 'IO::Select'&&$_[1]==0.01&&defined($job)&&@ready;
          $take->('ready',$job->{prefix});$selector=$_[0] unless defined($selector);
          $fail->() unless $_[0]==$selector;my $want=shift @ready;my @members=$_[0]->handles;
          $fail->() unless @members==@$want&&$_[0]->count==@$want;my %members;
          for my $fh(@members) {my $o=$lookup->(\$fh,0);$fail->() if $members{$o->{role}}++;}
          my @answer;
          for my $name(@$want) {
            my $role=$job->{prefix}.'.'.$name;$fail->() unless $members{$role};push @answer,$roles{$role}{fh};
          }
          return @answer;
        };
        local *Time::HiRes::clock_gettime=sub (;$) {
          $check->();$fail->() unless @_==1&&$_[0]==Time::HiRes::CLOCK_MONOTONIC();
          my $role=defined($job)?$job->{prefix}:!$calls{clock}?'startup':'stage';
          $take->('clock',$role);
          if(exists($boundary{$mode})&&$calls{clock}==$boundary{$mode}[0]) {
            $fail->() unless $role eq 'stage'&&!defined($job)
              &&!exists($outcomes->{boundaryNomination});
            $outcomes->{boundaryNomination}={clock=>0+$calls{clock},mode=>''.$mode};
            die "TEST_STAGED_NOMINATED_CLOCK_THROW\n" if $mode=~/\Aboundary-throw-/;
            return 180;
          }
          return 0;
        };
        local *CORE::GLOBAL::exec=$deny;local *CORE::GLOBAL::system=$deny;
        local *CORE::GLOBAL::open=sub (*;$@) {$deny->();};local *CORE::GLOBAL::syswrite=sub (*$;$$) {$deny->();};
        local *CORE::GLOBAL::readpipe=sub (_) {$deny->();};local *CORE::GLOBAL::kill=sub (@) {$deny->();};
        local *CORE::GLOBAL::chdir=sub (;$) {$deny->();};local *CORE::GLOBAL::unlink=sub (@) {$deny->();};
        local *CORE::GLOBAL::mkdir=sub (_;$) {$deny->();};local *CORE::GLOBAL::rmdir=sub (_) {$deny->();};
        local *CORE::GLOBAL::rename=sub ($$) {$deny->();};local *CORE::GLOBAL::seek=sub (*$$) {$deny->();};
        local *CORE::GLOBAL::truncate=sub ($$) {$deny->();};local *CORE::GLOBAL::socket=sub (*$$$) {$deny->();};
        local *CORE::GLOBAL::socketpair=sub (**$$$) {$deny->();};local *CORE::GLOBAL::connect=sub (*$) {$deny->();};
        local *CORE::GLOBAL::accept=sub (**) {$deny->();};
        local *IO::Select::can_write=$deny;local *IO::Select::has_exception=$deny;
        local *Time::HiRes::sleep=$deny;local *POSIX::dup2=$deny;local *POSIX::close=$deny;local *POSIX::_exit=$deny;
        my %prototypes=(sysopen=>'*$$;$',pipe=>'**',binmode=>'*;$',fcntl=>'*$$',stat=>';*',
          lstat=>';*',sysseek=>'*$$',sysread=>'*\\$$;$',fileno=>'*',close=>';*',
          opendir=>'*$',readdir=>'*',closedir=>'*',fork=>'',waitpid=>'$$');
        for my $op(sort keys %prototypes) {
          my $port='CORE::GLOBAL'->can($op);my $core=prototype('CORE::'.$op);
          $fail->() unless defined($port)&&ref($port) eq 'CODE'&&defined($core)
            &&$core eq $prototypes{$op}&&defined(prototype($port))&&prototype($port) eq $core;
        }
        for my $op(qw(exec system)) {my $port='CORE::GLOBAL'->can($op);
          $fail->() unless defined($port)&&ref($port) eq 'CODE'&&!defined(prototype($port));}
        my $source=MIME::Base64::decode_base64($ARGV[0]);
        $body_ok=eval {
          if($fixture_modes{$mode}&&$mode ne 'hidden-open-undefined') {
            my $p=$paths{$logical.'/'.$leaf_rel[2]};
            $fail->() unless defined($p)&&$p->{role} eq 'f2'&&!@owned&&!$raw_acquisitions;
            my $flags=Fcntl::O_RDONLY()|Fcntl::O_NOFOLLOW()|Fcntl::O_NONBLOCK();
            CORE::sysopen(my $raw,$p->{actual},$flags) or $fail->();
            ++$raw_acquisitions;
            $fixture_record=$register->($raw,'fixture-foreign',0,$p,1);
            $fixture_original=$raw;
            $same_physical->($p->{identity},$fixture_record->{identity},'file');
          }
          if($mode eq 'foreign-fd-alias') {
            $fail->() unless defined($fixture_original)&&defined($fixture_record)&&$raw_acquisitions==1;
            $fixture_alias=Symbol::gensym();
            *{$fixture_alias}=*{$fixture_original}{IO};
            $alias_native->(\$fixture_original);$alias_native->(\$fixture_alias);
            $fail->() if $fixture_alias==$fixture_original;
            my $old_io=B::svref_2object(\$fixture_original)->RV->IO;
            my $new_io=B::svref_2object(\$fixture_alias)->RV->IO;
            $fail->() unless $$old_io==$$new_io;
            my $original_fd=CORE::fileno($fixture_original);my $alias_fd=CORE::fileno($fixture_alias);
            $fail->() unless defined($original_fd)&&$original_fd>=3&&defined($alias_fd)
              &&$alias_fd==$original_fd&&$original_fd==$fixture_record->{fd};
            $same_physical->($fixture_record->{identity},[CORE::stat($fixture_alias)],'file');
            $outcomes->{fdAliasBeforeConsumer}={nativeShapes=>JSON::PP::true,
              distinctGv=>JSON::PP::true,sameIo=>JSON::PP::true,sameFd=>JSON::PP::true,
              sameRef=>JSON::PP::false,rawAcquisitions=>0+$raw_acquisitions};
          }
          $loaded=eval($source."\n1;\n");$setup_error=$@;$check->();
          $fail->() unless $loaded&&!length($setup_error);$load_complete=1;
          my $capture=\&task6a_origin_capture;
          local *main::task6a_origin_capture=sub {
            $check->();$fail->() unless @_==4&&$_[0] eq '/bin/ls'
              &&ref($_[1]) eq 'ARRAY'&&@{$_[1]}==2&&$_[1][0] eq '-lde'
              &&$_[2]==2&&$_[3]==4096;
            $helper_enter->($_[1][1]);++$helpers;
            my $value;my $ok=eval {$value=$capture->(@_);1;};my $error=$@;$check->();
            if($mode=~/\Ashared-unsettled-(?:baseline|mutant)\z/&&$helpers==25) {
              $fail->() unless defined($job)&&$job->{cleanup}&&$job->{prefix} eq 'h25'
                &&!$ok&&!defined($value)&&$error eq "TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n";
              $outcomes->{sharedCaptorOutcome}={returned=>JSON::PP::false,
                canonicalRefusal=>JSON::PP::true};
            } elsif(($mode eq 'h7-acl-plus'||$mode eq 'h7-raw256')&&$helpers==7) {
              $fail->() unless defined($job)&&$job->{prefix} eq 'h7'&&$job->{path} eq '/';
              if($mode eq 'h7-raw256') {
                $fail->() unless !$ok&&!defined($value)&&$error eq "TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n";
              } else {
                $fail->() unless $ok&&!length($error)&&ref($value) eq 'HASH'
                  &&$value->{out} eq "-r--r--r--+ 1 root wheel 16 Jan 1 2026 /\n"
                  &&$value->{err} eq ''&&$value->{status}==0&&$value->{pid}==424242
                  &&JSON::PP::is_bool($value->{reaped})&&$value->{reaped};
              }
              $outcomes->{h7CaptorOutcome}={returned=>$ok?JSON::PP::true:JSON::PP::false,
                canonicalRefusal=>$error eq "TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n"?JSON::PP::true:JSON::PP::false};
            } else {$fail->() unless $ok&&!length($error)&&ref($value) eq 'HASH';}
            if($mode=~/\Aepoch-acl-(?:baseline|mutant)\z/&&$helpers==25) {
              $fail->() unless $ok&&!length($error)&&defined($job)&&$job->{prefix} eq 'h25'
                &&$job->{path} eq '/'&&ref($value) eq 'HASH'
                &&$value->{out} eq "-r--r--r--+ 1 root wheel 16 Jan 1 2026 /\n"
                &&$value->{err} eq ''&&$value->{status}==0&&$value->{pid}==424242
                &&JSON::PP::is_bool($value->{reaped})&&$value->{reaped};
              $outcomes->{epochAclCaptorOutcome}={returned=>JSON::PP::true,
                out=>''.$value->{out},err=>''.$value->{err},status=>0+$value->{status},
                reaped=>$value->{reaped}};
            }
            $helper_leave->();$check->();
            if($mode=~/\Aepoch-acl-(?:baseline|mutant)\z/&&$helpers==25) {
              $outcomes->{epochAclDrain}={jobCleared=>!defined($job)?JSON::PP::true:JSON::PP::false,
                helpersSettled=>task6a_origin_helpers_settled()};
            }
            if(($mode eq 'h7-acl-plus'||$mode eq 'h7-raw256')&&$helpers==7) {
              $outcomes->{h7Drain}={jobCleared=>!defined($job)?JSON::PP::true:JSON::PP::false,
                helpersSettled=>task6a_origin_helpers_settled()};
            }
            die $error unless $ok;return $value;
          };
          my $operation=$mode eq 'premature-recheck'?'recheck':$mode eq 'premature-release'?'release':'hold';
          my %operations=(hold=>\&task6a_origin_hold_staged_custody,
            recheck=>\&task6a_origin_recheck_staged_custody,release=>\&task6a_origin_release_staged_custody);
          my $value=eval {$mode eq 'arity'?$operations{$operation}->(1):$operations{$operation}->()};
          my $error=$@;$check->();
          my $refused=!defined($value)&&$error eq "TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n";
          $fail->() unless $refused||(!length($error)&&ref($value) eq 'HASH');
          $outcomes->{refused}=$refused?JSON::PP::true:JSON::PP::false;
          $outcomes->{$operation}=$value;
          if(defined($identity_profile)) {
            $fail->() unless $refused&&exists($outcomes->{identityNomination});
            $outcomes->{sourceAfterIdentityRefusal}=test_observe_staged_custody();
          }
          if($mode eq 'staged-reference-alias') {
            $fail->() unless $refused&&exists($outcomes->{stagedAliasNomination});
            $outcomes->{sourceAfterStagedAliasRefusal}=test_observe_staged_custody();
          }
          if($fixture_modes{$mode}) {
            $fail->() unless $refused;
            $outcomes->{sourceAfterFixtureRefusal}=test_observe_staged_custody();
          }
          if($mode=~/\Aadmission-/) {$outcomes->{sourceAfterAdmissionRefusal}=test_observe_staged_custody();}
          if(defined($configuration_profile)) {
            $fail->() unless $refused&&exists($outcomes->{configurationNomination});
            $outcomes->{sourceAfterConfigurationRefusal}=test_observe_staged_custody();
            my $o=$roles{$configuration_profile->[0]};
            $fail->() unless defined($o)&&!@{$o->{fcntlQueue}};
            $outcomes->{configurationQueueRemaining}=0+@{$o->{fcntlQueue}};
          }
          if($mode eq 'h7-acl-plus'||$mode eq 'h7-raw256') {
            $fail->() unless $refused&&$helpers==7;
            $outcomes->{sourceAfterH7Refusal}=test_observe_staged_custody();
          }
          if($mode eq 'partial-tied-dir'||$mode eq 'partial-tied-file') {
            $fail->() unless $refused&&$partial_nominated==1&&$partial_counts->{factory}==1;
            $outcomes->{sourceAfterPartialRefusal}=test_observe_staged_custody();
            $outcomes->{partialCallbacksBeforeRepeats}={%{$partial_counts->{callbacks}}};
          }
          if($mode eq 'healthy'||$mode eq 'file-byte-xor-mutant'||$mode=~/\Aonce-primitive-(?:baseline|mutant)\z/) {
            $fail->() if $refused;$outcomes->{recheck}=$operations{recheck}->();
            $outcomes->{release}=$operations{release}->();$check->();
          } elsif($mode=~/\Aclose-/) {
            $fail->() if $refused;$outcomes->{recheck}=$operations{recheck}->();$check->();
            $outcomes->{sourceBeforeRelease}=test_observe_staged_custody();
            my $release=eval {$operations{release}->()};my $release_error=$@;$check->();
            my $release_refused=!defined($release)&&$release_error eq "TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n";
            $fail->() unless $release_refused||(!length($release_error)&&ref($release) eq 'HASH');
            $outcomes->{releaseRefused}=$release_refused?JSON::PP::true:JSON::PP::false;
            $outcomes->{release}=$release;
            $outcomes->{sourceAfterRelease}=test_observe_staged_custody();
          } elsif(exists($boundary{$mode})) {
            if($mode=~/-recheck-/) {
              $fail->() if $refused;
              my $value=eval {$operations{recheck}->()};my $error=$@;$check->();
              $fail->() unless !defined($value)&&$error eq "TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n";
              $outcomes->{recheck}=undef;$outcomes->{recheckRefused}=JSON::PP::true;
            } else {$fail->() unless $refused;}
            $outcomes->{sourceAfterBoundary}=test_observe_staged_custody();
          } elsif($mode=~/\Ametadata-/) {
            $fail->() if $refused;
            $outcomes->{sourceBeforeMetadata}=test_observe_staged_custody();
            $outcomes->{metadataMutation}=test_change_staged_metadata();
            my $value=eval {$operations{recheck}->()};my $error=$@;$check->();
            $fail->() unless !defined($value)&&$error eq "TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n";
            $outcomes->{recheck}=undef;$outcomes->{recheckRefused}=JSON::PP::true;
            $outcomes->{sourceAfterMetadataRefusal}=test_observe_staged_custody();
            $outcomes->{metadataRestoration}=test_restore_staged_metadata();
            $outcomes->{sourceAfterMetadataRestoration}=test_observe_staged_custody();
          } elsif($mode=~/\Amagic-/) {
            $fail->() if $refused;
            $outcomes->{sourceBeforeMagic}=test_observe_staged_custody();
            $outcomes->{magicMutation}=test_change_staged_magic();
            my $value=eval {$operations{recheck}->()};my $error=$@;$check->();
            $fail->() unless !defined($value)&&$error eq "TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n";
            $outcomes->{recheck}=undef;$outcomes->{recheckRefused}=JSON::PP::true;
            $outcomes->{sourceAfterMagicRefusal}=test_observe_staged_custody();
            $outcomes->{magicAfterRefusal}=test_observe_staged_magic();
            my $before=scalar(@events);
            for my $name(qw(hold recheck release)) {
              my $again=eval {$operations{$name}->()};my $error=$@;$check->();
              $fail->() unless !defined($again)&&$error eq "TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n";
            }
            $outcomes->{magicTiedRepeatDelta}=scalar(@events)-$before;
            $fail->() if $outcomes->{magicTiedRepeatDelta};
            $outcomes->{sourceAfterMagicTiedRepeats}=test_observe_staged_custody();
            $outcomes->{magicBeforeUntie}=test_observe_staged_magic();
            $outcomes->{magicRestoration}=test_restore_staged_magic();
            $outcomes->{sourceAfterMagicRestoration}=test_observe_staged_custody();
            $outcomes->{magicAfterUntie}=test_observe_staged_magic();
          } elsif($mode=~/\Adrift-/) {
            $fail->() if $refused;
            $outcomes->{sourceBeforeAdmissionDrift}=test_observe_staged_custody();
            $outcomes->{admissionDriftMutation}=test_change_staged_admission();
            my $value=eval {$operations{recheck}->()};my $error=$@;$check->();
            $fail->() unless !defined($value)&&$error eq "TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n";
            $outcomes->{recheck}=undef;$outcomes->{recheckRefused}=JSON::PP::true;
            $outcomes->{sourceAfterAdmissionDrift}=test_observe_staged_custody();
            $outcomes->{admissionDriftRestoration}=test_restore_staged_admission();
            $outcomes->{sourceAfterAdmissionDriftRestore}=test_observe_staged_custody();
          } elsif($mode=~/\Aamagic-/) {
            $fail->() if $refused;
            $outcomes->{sourceBeforeAdmissionMagic}=test_observe_staged_custody();
            $outcomes->{admissionMagicMutation}=test_change_staged_admission_magic();
            my $value=eval {$operations{recheck}->()};my $error=$@;$check->();
            $fail->() unless !defined($value)&&$error eq "TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n";
            $outcomes->{recheck}=undef;$outcomes->{recheckRefused}=JSON::PP::true;
            $outcomes->{sourceAfterAdmissionMagicRefusal}=test_observe_staged_custody();
            $outcomes->{admissionMagicAfterRefusal}=test_observe_staged_admission_magic();
            my $before=scalar(@events);
            for my $name(qw(hold recheck release)) {
              my $again=eval {$operations{$name}->()};my $error=$@;$check->();
              $fail->() unless !defined($again)&&$error eq "TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n";
            }
            $outcomes->{admissionMagicTiedRepeatDelta}=scalar(@events)-$before;
            $fail->() if $outcomes->{admissionMagicTiedRepeatDelta};
            $outcomes->{sourceAfterAdmissionMagicTiedRepeats}=test_observe_staged_custody();
            $outcomes->{admissionMagicBeforeUntie}=test_observe_staged_admission_magic();
            $outcomes->{admissionMagicRestoration}=test_restore_staged_admission_magic();
            $outcomes->{sourceAfterAdmissionMagicRestoration}=test_observe_staged_custody();
            $outcomes->{admissionMagicAfterUntie}=test_observe_staged_admission_magic();
          } elsif($mode=~/\Ashared-unsettled-(?:baseline|mutant)\z/) {
            $fail->() if $refused;
            $outcomes->{sharedBeforeFailure}=test_observe_staged_helpers();
            my $extra=eval {task6a_origin_capture('/bin/ls',['-lde','/'],2,4096)};
            my $extra_error=$@;$check->();
            $fail->() unless !defined($extra)&&$extra_error eq "TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n"
              &&!defined($job)&&$helpers==25;
            $outcomes->{sharedAfterFailure}=test_observe_staged_helpers();
            $outcomes->{sharedStageAfterFailure}=test_observe_staged_custody();
            my $value=eval {$operations{recheck}->()};my $error=$@;$check->();
            my $denied=!defined($value)&&$error eq "TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n";
            $fail->() unless $denied||(!length($error)&&ref($value) eq 'HASH');
            $outcomes->{recheck}=$value;
            $outcomes->{recheckRefused}=$denied?JSON::PP::true:JSON::PP::false;
            $outcomes->{sharedAfterRecheck}=test_observe_staged_helpers();
            $outcomes->{sharedStageAfterRecheck}=test_observe_staged_custody();
            if(!$denied) {$outcomes->{release}=$operations{release}->();$check->();}
            $outcomes->{sharedAfterCleanup}=test_observe_staged_custody();
          } elsif($mode=~/\Aepoch-acl-(?:baseline|mutant)\z/) {
            $fail->() if $refused;
            $outcomes->{epochAclBeforeRecheck}=test_observe_staged_custody();
            my $value=eval {$operations{recheck}->()};my $error=$@;$check->();
            my $denied=!defined($value)&&$error eq "TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n";
            $fail->() unless $denied||(!length($error)&&ref($value) eq 'HASH');
            $outcomes->{recheck}=$value;
            $outcomes->{recheckRefused}=$denied?JSON::PP::true:JSON::PP::false;
            $outcomes->{epochAclAfterRecheck}=test_observe_staged_custody();
            if(!$denied) {$outcomes->{release}=$operations{release}->();$check->();}
            $outcomes->{epochAclAfterCleanup}=test_observe_staged_custody();
          } elsif($mode=~/\Aactive-/) {
            $fail->() if $refused;
            $outcomes->{sourceBeforeActiveMisuse}=test_observe_staged_custody();
            my %nominees=('active-hold-again'=>['hold',0],
              'active-recheck-arity'=>['recheck',1],'active-release-arity'=>['release',1]);
            my $nominee=$nominees{$mode};$fail->() unless defined($nominee);
            my $value=eval {$nominee->[1]?$operations{$nominee->[0]}->(1):$operations{$nominee->[0]}->()};
            my $error=$@;$check->();
            $fail->() unless !defined($value)&&$error eq "TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n";
            $outcomes->{activeMisuse}={operation=>''.$nominee->[0],arity=>0+$nominee->[1],
              refused=>JSON::PP::true};
            $outcomes->{sourceAfterActiveMisuse}=test_observe_staged_custody();
          } else {$fail->() unless $refused;}
          if($mode=~/\Aonce-primitive-(?:baseline|mutant)\z/) {
            $outcomes->{onceAfterCleanup}=test_observe_staged_custody();
          }
          if($mode eq 'file-byte-xor-denied'||$mode eq 'file-byte-xor-mutant') {
            $fail->() unless exists($outcomes->{byteNomination});
            $outcomes->{sourceAfterByteOperation}=test_observe_staged_custody();
          }
          my $before=scalar(@events);
          for my $name(qw(hold recheck release)) {
            my $again=eval {$operations{$name}->()};my $again_error=$@;$check->();
            $fail->() unless !defined($again)&&$again_error eq "TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n";
          }
          $repeat_delta=scalar(@events)-$before;$fail->() if $repeat_delta;
          if($mode=~/\Aonce-primitive-(?:baseline|mutant)\z/) {
            $outcomes->{onceAfterRepeats}=test_observe_staged_custody();
          }
          if($mode=~/\Aepoch-acl-(?:baseline|mutant)\z/) {
            $outcomes->{epochAclAfterRepeats}=test_observe_staged_custody();
          }
          if($mode=~/\Ashared-unsettled-(?:baseline|mutant)\z/) {
            $outcomes->{sharedAfterRepeats}=test_observe_staged_custody();
          }
          if(defined($identity_profile)) {
            $outcomes->{sourceAfterIdentityRepeats}=test_observe_staged_custody();
          }
          if($mode eq 'staged-reference-alias') {
            $outcomes->{sourceAfterStagedAliasRepeats}=test_observe_staged_custody();
          }
          if($mode=~/\Aactive-/) {
            $outcomes->{sourceAfterActiveMisuseRepeats}=test_observe_staged_custody();
          }
          if($mode=~/\Aamagic-/) {
            $outcomes->{sourceAfterAdmissionMagicRepeats}=test_observe_staged_custody();
            $outcomes->{admissionMagicAfterRestoredRepeats}=test_observe_staged_admission_magic();
          }
          if($mode=~/\Adrift-/) {
            $outcomes->{sourceAfterAdmissionDriftRepeats}=test_observe_staged_custody();
          }
          if($mode=~/\Amagic-/) {
            $outcomes->{sourceAfterMagicRepeats}=test_observe_staged_custody();
            $outcomes->{magicAfterRestoredRepeats}=test_observe_staged_magic();
          }
          if($mode eq 'file-byte-xor-denied'||$mode eq 'file-byte-xor-mutant') {
            $outcomes->{sourceAfterByteRepeats}=test_observe_staged_custody();
          }
          if(defined($configuration_profile)) {
            $outcomes->{sourceAfterConfigurationRepeats}=test_observe_staged_custody();
          }
          if($mode eq 'h7-acl-plus'||$mode eq 'h7-raw256') {
            $outcomes->{sourceAfterH7Repeats}=test_observe_staged_custody();
          }
          if($mode eq 'partial-tied-dir'||$mode eq 'partial-tied-file') {
            $outcomes->{sourceAfterPartialRepeats}=test_observe_staged_custody();
            $outcomes->{partialCallbacksBeforeFinalizer}={%{$partial_counts->{callbacks}}};
            $outcomes->{partialFactoryCount}=0+$partial_counts->{factory};
            test_untie_staged_partial();
            $outcomes->{partialFinalization}={untie=>0+$partial_counts->{untie},destroy=>0+$partial_counts->{destroy}};
            $outcomes->{partialCallbacksAfterFinalizer}={%{$partial_counts->{callbacks}}};
          }
          if($mode=~/\Ametadata-/) {$outcomes->{sourceAfterMetadataRepeats}=test_observe_staged_custody();}
          if(exists($boundary{$mode})) {$outcomes->{sourceAfterBoundaryRepeats}=test_observe_staged_custody();}
          if($mode=~/\Aadmission-/) {$outcomes->{sourceAfterAdmissionRepeats}=test_observe_staged_custody();}
          if($mode=~/\Aclose-/) {$outcomes->{sourceAfterRepeats}=test_observe_staged_custody();}
          $fail->() if @grammar||@jobs||defined($job);
          if($mode=~/\Aunknown-/) {
            $fail->() unless defined($nominee_cell)&&defined($nominee_shape)&&!@owned;
            $before_callbacks={%callbacks};
            if($mode eq 'unknown-cell') {untie $$nominee_cell;}
            elsif($mode eq 'unknown-handle') {untie *$nominee_glob;}
            $after_finalization={%finalization};
            $outcomes->{nomineeShape}={%$nominee_shape};
            $outcomes->{candidateCallbacksBeforeFinalizer}=$before_callbacks;
            $outcomes->{factoryCounts}={%factory};
            $outcomes->{memoryFinalizationCounts}=$after_finalization;
          }
          if($fixture_modes{$mode}) {
            $fail->() unless @owned==1&&$raw_acquisitions==1&&defined($fixture_record)
              &&$owned[0]==$fixture_record&&$fixture_record->{fixtureOnly}->()
              &&!$fixture_record->{attempted}&&!$fixture_record->{closed}
              &&defined($fixture_original)&&$fixture_original==$fixture_record->{fh};
            my $live=CORE::fileno($fixture_original);
            $fail->() unless defined($live)&&$live==$fixture_record->{fd};
            my $kind=$mode eq 'hidden-open-undefined'?'directory':'file';
            $same_physical->($fixture_record->{identity},[CORE::stat($fixture_original)],$kind);
            if($mode eq 'foreign-fd-alias') {
              $alias_native->(\$fixture_original);$alias_native->(\$fixture_alias);
              $fail->() if $fixture_alias==$fixture_original;
              my $other=CORE::fileno($fixture_alias);
              $fail->() unless defined($other)&&$other==$live;
              $same_physical->($fixture_record->{identity},[CORE::stat($fixture_alias)],'file');
              $outcomes->{fdAliasBeforeRescue}={bothLive=>JSON::PP::true,
                distinctGv=>JSON::PP::true,sameFd=>JSON::PP::true};
            }
            $outcomes->{fixtureOwnerBeforeRescue}={live=>JSON::PP::true,sameFd=>JSON::PP::true,
              sameIdentity=>JSON::PP::true,attempted=>0,closed=>0};
            $outcomes->{rawAcquisitions}=0+$raw_acquisitions;
            $outcomes->{sourceAfterFixtureRepeats}=test_observe_staged_custody();
          }
          1;
        };
        $primary=$@;
        # Separate fixture rescue never creates consumer definite-close evidence.
        for my $o(@owned) {next if $o->{attempted};eval {$dispose->($o,1)};$latch->() if $@;}
        die length($setup_error)?$setup_error:"$fault\n" unless $load_complete;
        $check->();die $primary unless $body_ok;
      }
      if($mode eq 'foreign-fd-alias') {
        $alias_native->(\$fixture_original);$alias_native->(\$fixture_alias);
        $fail->() if defined(CORE::fileno($fixture_original))||defined(CORE::fileno($fixture_alias));
        $outcomes->{fdAliasAfterRescue}={bothUndefined=>JSON::PP::true,
          originalAttempts=>0+$fixture_record->{attempted},
          rawAcquisitions=>0+$raw_acquisitions};
      }
      my $definite=grep {$_->{closed}&&!defined(CORE::fileno($_->{fh}))} @owned;
      my $fixture_closed=grep {$_->{closed}&&$_->{fixture}} @owned;
      $fail->() unless $definite==@owned;
      if($fixture_modes{$mode}) {
        $fail->() unless @owned==1&&$raw_acquisitions==1&&$fixture_closed==1
          &&defined($outcomes->{fixtureOwnerBeforeRescue})&&$outcomes->{fixtureOwnerBeforeRescue}{live}
          &&$helpers==0&&defined($repeat_delta)&&$repeat_delta==0&&!@grammar;
      } else {$fail->() if $fixture_closed;}
      my $stage_closed=grep {$_->{closed}&&$_->{path}
        &&!(exists($_->{fixtureOnly})&&$_->{fixtureOnly}->())} @owned;
      if($fixture_modes{$mode}) {
        $fail->() if $stage_closed||$definite-$stage_closed-$fixture_closed;
        $outcomes->{consumerClosed}=0+($definite-$fixture_closed);
      }
      my $out={%$outcomes,harnessFault=>undef,productionAuthority=>JSON::PP::false,
        scope=>'ordinary-staged-custody-consumer-fixture-only',
        syntheticGeometry=>JSON::PP::true,syntheticVendorAndSelected=>JSON::PP::true,
        helpers=>$helpers,ownedCount=>scalar(@owned),definitelyClosed=>0+$definite,
        stageClosed=>0+$stage_closed,helperClosed=>$definite-$stage_closed-$fixture_closed,
        fixtureClosed=>0+$fixture_closed,remainingOperations=>scalar(@grammar),
        repeatEffectDelta=>$repeat_delta,calls=>\%calls,events=>\@events};
      my $metadata=JSON::PP->new->canonical->utf8->encode({map {$_=>$out->{$_}} grep {$_ ne 'events'} keys %$out});
      $fail->() if length($metadata)>16384;
      my $json=JSON::PP->new->canonical->utf8->encode($out);$fail->() if length($json)>8388608;
      print $json;exit 0;
    }
`;

const STAGED_CAPTOR_PORT_PROGRAM=String.raw`
    if($q->{kind} eq 'staged-captor-ports') {
      require Fcntl; require IO::Select; require POSIX; require Time::HiRes;
      require B; require Errno; require Digest::SHA; require Encode;
      my $fault='';my @owned;my %roles;my @events;my %calls;
      my $mode=$q->{record}{mode};
      my %modes=map {$_=>1} qw(healthy malformed extra-row raw256 census-duplicate census-noncanonical census-eio partial-pipe inspection-fault forbidden forbidden-exec caught-fault overflow cleanup-close-throw);
      die "TEST_STAGED_CAPTOR_HARNESS_FAULT\n" unless ref($q->{record}) eq 'HASH'
        &&join(',',sort keys %{$q->{record}}) eq 'mode'&&defined($mode)&&!ref($mode)&&$modes{$mode};
      my $self=$mode=~/\A(?:partial-pipe|inspection-fault|forbidden|forbidden-exec|caught-fault|overflow)\z/;
      my $cleanup_throw=$mode eq 'cleanup-close-throw';
      my $latch=sub {$fault='TEST_STAGED_CAPTOR_HARNESS_FAULT';return 0;};
      my $fail=sub {$latch->();die "$fault\n";};
      my $check=sub {die "$fault\n" if length($fault);};
      my $event=sub {
        return 0 if length($fault);
        my $ok=eval {
          $fail->() if @events>=8192||@_%2;
          my %e=(seq=>1+@events,@_);
          for my $k(keys %e) {
            $fail->() unless $k=~/\A[a-zA-Z][a-zA-Z0-9]{0,31}\z/;
            my $v=$e{$k};$fail->() unless defined($v)&&!ref($v);
            if($k eq 'op'||$k eq 'role') {
              $fail->() unless $v=~/\A[A-Za-z0-9_.-]+\z/&&length($v)<=($k eq 'op'?32:96);
            } else {$fail->() unless $v=~/\A[0-9]+\z/&&$v<=2000000000000;}
          }
          my $encoded=JSON::PP->new->canonical->utf8->encode(\%e);
          $fail->() if length($encoded)>512;push @events,\%e;1;
        };
        $latch->() unless $ok;return $ok?1:0;
      };
      my @pipe_roles=(['in-r','in-w'],['out-r','out-w'],['err-r','err-w'],['setup-r','setup-w']);
      my @clock=(0)x($mode eq 'raw256'?6:$mode=~/\Acensus-/||$mode eq 'partial-pipe'||$mode eq 'inspection-fault'||$mode eq 'overflow'?3:7);
      @clock=(0)x4 if $cleanup_throw;
      my @wait=([0,0],[0,0],[0,0],[424242,$mode eq 'raw256'?256:0]);
      @wait=() if $mode=~/\Acensus-/||$mode eq 'partial-pipe'||$mode eq 'inspection-fault'||$mode eq 'overflow';
      @wait=([424242,0]) if $cleanup_throw;
      my @ready=(['out-r','err-r','setup-r'],['out-r']);
      @ready=() if $mode=~/\Acensus-/||$mode eq 'partial-pipe'||$mode eq 'inspection-fault'||$mode eq 'overflow';
      @ready=() if $cleanup_throw;
      my %read=( 'out-r'=>[1,0], 'err-r'=>[0], 'setup-r'=>[0] );
      $read{$_}=[] for grep {$cleanup_throw} keys %read;
      my @census;my $census;my $census_built=0;my $loaded=0;my $selector;
      my ($captured,$enumerated);my $load_complete=0;my $setup_error='';
      my $capture_error='';
      my $identify=sub {
        my ($fh)=@_;$fail->() unless defined($fh)&&ref($fh);
        for my $r(@owned) {
          next unless $r->{fh}==$fh;
          $fail->() if $r->{attempted}||$r->{closed}||!defined(fileno($fh))
            ||fileno($fh)!=$r->{fd};
          my @s=CORE::stat($fh);$fail->() unless @s==13;
          for my $i(0..6) {$fail->() unless $s[$i]==$r->{identity}[$i];}
          return $r;
        }
        $fail->();
      };
      my $register=sub {
        my @records=@_;
        # Alias rejection precedes registration; all distinct acquisitions are
        # retained together before any fallible fileno/stat/configuration.
        for my $r(@records) {
          for my $other(@owned,@records) {
            next if $r==$other;$fail->() if $r->{fh}==$other->{fh};
          }
        }
        push @owned,@records;
        $fail->() if $mode eq 'inspection-fault'&&@owned==2;
        for my $r(@records) {
          $r->{fd}=fileno($r->{fh});$fail->() unless defined($r->{fd})&&$r->{fd}>=3;
          for my $other(@owned) {
            next if $other==$r;
            $fail->() if !$other->{closed}&&defined($other->{fd})&&$other->{fd}==$r->{fd};
          }
          $r->{identity}=[CORE::stat($r->{fh})];$fail->() unless @{$r->{identity}}==13;
          $r->{metadataReady}=1;
          $roles{$r->{role}}=$r;
          $event->(op=>'acquire',role=>$r->{role},fd=>$r->{fd});
        }
      };
      my $dispose=sub {
        my ($r,$owner)=@_;return 0 if $r->{attempted};
        $r->{attempted}=1;$r->{closer}=$owner;
        # Raw successful CORE acquisitions are private originals before metadata.
        # Never make their cleanup depend on admission or fallible inspection.
        if($r->{metadataReady}) {
          my @s=CORE::stat($r->{fh});
          unless(defined(fileno($r->{fh}))&&fileno($r->{fh})==$r->{fd}&&@s==13) {
            $latch->();return 0;
          }
          for my $i(0..6) {if($s[$i]!=$r->{identity}[$i]) {$latch->();return 0;}}
        } else {
          unless(!$r->{exposed}&&defined($r->{fh})&&ref($r->{fh})&&defined(fileno($r->{fh}))) {
            $latch->();return 0;
          }
        }
        $event->(op=>'close-attempt',role=>$r->{role},owner=>$owner);
        $!=0;my $ok=eval {$r->{directory}?CORE::closedir($r->{fh}):CORE::close($r->{fh})};
        my $error=$@;my $errno=0+$!;
        $r->{closed}=1 if $ok&&!length($error)&&!defined(fileno($r->{fh}));
        $event->(op=>'close-result',role=>$r->{role},owner=>$owner,result=>$ok?1:0,
          definite=>$r->{closed},errno=>$errno);
        $latch->() unless $r->{closed};return $ok;
      };
      my $deny=sub {$event->(op=>'denied',role=>'external');$fail->();};
      {
        no warnings qw(redefine once);
        local *CORE::GLOBAL::pipe=sub (**) {
          $check->();$fail->() unless @_==2&&@pipe_roles&&!defined($_[0])&&!defined($_[1]);
          my $names=shift @pipe_roles;
          CORE::pipe(my $a,my $b) or $fail->();
          $register->({fh=>$a,role=>$names->[0],attempted=>0,closed=>0},
            {fh=>$b,role=>$names->[1],attempted=>0,closed=>0});
          $_[0]=$a;$_[1]=$b;$roles{$names->[0]}{exposed}=1;$roles{$names->[1]}{exposed}=1;
          ++$calls{pipe};
          if($names->[0] eq 'out-r') {
            my $row="-r--r--r-- 1 root wheel 16 Jan 1 2026 /stage/entry.mjs\n";
            $row="invalid ACL row\n" if $mode eq 'malformed';
            $row.=" 0: user:ordinary allow read\n" if $mode eq 'extra-row';
            $!=0;my $n=CORE::syswrite($_[1],$row,length($row));
            $fail->() unless defined($n)&&$n==length($row)&&!$!;
            $event->(op=>'fixture-preload',role=>'out-w',length=>$n);
          }
          if($mode eq 'partial-pipe'&&$calls{pipe}==2) {$fail->();}
          if($mode eq 'overflow'&&$calls{pipe}==3) {
            for(1..8193) {$event->(op=>'overflow',role=>'fixture');}$check->();
          }
          return 1;
        };
        local *CORE::GLOBAL::binmode=sub (*;$) {
          $check->();$fail->() unless @_==1;my $r=$identify->($_[0]);
          $fail->() if $r->{binary}++;++$calls{binmode};
          my $ok=CORE::binmode($_[0]);$fail->() unless $ok;
          $event->(op=>'binmode',role=>$r->{role});return $ok;
        };
        local *CORE::GLOBAL::fcntl=sub (*$$) {
          $check->();$fail->() unless @_==3;my $r=$identify->($_[0]);
          $fail->() unless $r->{role} eq 'setup-w'&&!$calls{fcntl}++
            &&$_[1]==Fcntl::F_SETFD()&&$_[2]==Fcntl::FD_CLOEXEC();
          $!=0;my $v=CORE::fcntl($_[0],$_[1],$_[2]);$fail->() unless defined($v)&&!$!;
          $event->(op=>'fcntl',role=>$r->{role});return $v;
        };
        local *CORE::GLOBAL::opendir=sub (*$) {
          $check->();$fail->() unless @_==2&&!defined($_[0])&&!ref($_[1])&&$_[1] eq '/dev/fd'
            &&!defined($census)&&@owned==8;
          # Read-only opening of the fixed system directory acquires only this
          # directory handle. readdir output below is synthetic, not OS census.
          CORE::opendir(my $directory,'/dev/fd') or $fail->();
          $census={fh=>$directory,role=>'census',directory=>1,attempted=>0,closed=>0};
          $register->($census);$_[0]=$directory;$census->{exposed}=1;++$calls{opendir};return 1;
        };
        local *CORE::GLOBAL::readdir=sub (*) {
          $check->();$fail->() unless @_==1&&!wantarray;
          my $r=$identify->($_[0]);$fail->() unless $r==$census;
          unless($census_built) {
            my %seen;
            for my $original(@owned) {
              $identify->($original->{fh});$fail->() if $seen{$original->{fd}}++;
            }
            @census=('.', '..','0','1','2',map {"$_->{fd}"} @owned);
            $census[6]=$census[5] if $mode eq 'census-duplicate';
            $census[5]='03' if $mode eq 'census-noncanonical';
            $census_built=1;
          }
          my $ordinal=++$calls{readdir};$event->(op=>'readdir',role=>'census',ordinal=>$ordinal);
          if($mode eq 'census-eio'&&$ordinal==6) {$!=Errno::EIO();return undef;}
          $!=0;return shift @census;
        };
        local *CORE::GLOBAL::closedir=sub (*) {
          $fail->() unless @_==1;my $r=$identify->($_[0]);$fail->() unless $r==$census;
          ++$calls{closedir};return $dispose->($r,0);
        };
        local *CORE::GLOBAL::fork=sub () {
          $check->();$fail->() unless @_==0&&!$calls{fork}++&&defined($census)&&$census->{closed};
          $event->(op=>'fork',role=>'synthetic',pid=>424242);return 424242;
        };
        local *CORE::GLOBAL::waitpid=sub ($$) {
          $check->();$fail->() unless @_==2&&$_[0]==424242&&$_[1]==POSIX::WNOHANG()&&@wait;
          my $v=shift @wait;++$calls{wait};
          $event->(op=>'wait',role=>'synthetic',pid=>424242,result=>$v->[0],raw=>$v->[1]);
          $?=$v->[1];return $v->[0];
        };
        local *CORE::GLOBAL::close=sub (;*) {
          $fail->() unless @_==1;my $r=$identify->($_[0]);
          $fail->() if $r->{directory};++$calls{close};my $closed=$dispose->($r,0);
          if($cleanup_throw&&($r->{role} eq 'in-r'||$r->{role} eq 'in-w')) {
            $check->();$fail->() unless $closed&&$r->{closed};
            $event->(op=>$r->{role} eq 'in-r'?'nominated-false':'nominated-throw',role=>$r->{role});
            return 0 if $r->{role} eq 'in-r';
            die "TEST_STAGED_CAPTOR_NOMINATED_CLOSE_THROW\n";
          }
          return $closed;
        };
        local *CORE::GLOBAL::sysread=sub (*\$$;$) {
          $check->();$fail->() unless @_==3&&ref($_[1]) eq 'SCALAR'&&$_[2]==65536;
          my $buffer_ref=$_[1];$fail->() unless !ref($$buffer_ref)&&$$buffer_ref eq '';
          my $r=$identify->($_[0]);my $queue=$read{$r->{role}};
          $fail->() unless ref($queue) eq 'ARRAY'&&@$queue;
          my $nomination=shift @$queue;
          $fail->() unless $roles{$r->{role}=~s/-r\z/-w/r}{closed};
          $!=0;my $n=CORE::sysread($_[0],$$buffer_ref,$_[2]);
          $fail->() unless defined($n)&&!$!&&!utf8::is_utf8($$buffer_ref)&&$n==length($$buffer_ref);
          $fail->() unless $nomination?$n>0:$n==0;
          ++$calls{read};$event->(op=>'read',role=>$r->{role},count=>$n,request=>65536);
          return $n;
        };
        local *IO::Select::can_read=sub {
          $check->();$fail->() unless @_==2&&ref($_[0]) eq 'IO::Select'&&$_[1]==0.01&&@ready;
          $selector=$_[0] unless defined($selector);$fail->() unless $_[0]==$selector;
          my $want=shift @ready;my @members=$_[0]->handles;my %members;
          $fail->() unless @members==@$want&&$_[0]->count==@$want;
          for my $fh(@members) {my $r=$identify->($fh);$fail->() if $members{$r->{role}}++;}
          my @answer;
          for my $role(@$want) {$fail->() unless $members{$role};push @answer,$roles{$role}{fh};}
          ++$calls{ready};$event->(op=>'ready',role=>'selector',count=>scalar(@answer));return @answer;
        };
        local *Time::HiRes::clock_gettime=sub (;$) {
          $check->();$fail->() unless @_==1&&$_[0]==Time::HiRes::CLOCK_MONOTONIC()&&@clock;
          ++$calls{clock};my $v=shift @clock;
          my $flags=B::svref_2object(\$v)->FLAGS;
          $fail->() unless $flags&(B::SVf_IOK()|B::SVf_NOK())&&!($flags&B::SVf_POK());
          $event->(op=>'clock',role=>'monotonic');return $v;
        };
        local *CORE::GLOBAL::exec=sub {$event->(op=>'denied-exec',role=>'external');$fail->();};
        local *CORE::GLOBAL::system=$deny;
        local *CORE::GLOBAL::readpipe=sub (_) {$deny->();};
        local *CORE::GLOBAL::kill=sub (@) {$deny->();};
        local *CORE::GLOBAL::open=sub (*;$@) {$deny->();};
        local *CORE::GLOBAL::sysopen=sub (*$$;$) {$deny->();};
        local *CORE::GLOBAL::syswrite=sub (*$;$$) {$deny->();};
        local *CORE::GLOBAL::chdir=sub (;$) {$deny->();};
        local *CORE::GLOBAL::unlink=sub (@) {$deny->();};
        local *CORE::GLOBAL::mkdir=sub (_;$) {$deny->();};
        local *CORE::GLOBAL::rmdir=sub (_) {$deny->();};
        local *CORE::GLOBAL::rename=sub ($$) {$deny->();};
        local *CORE::GLOBAL::stat=sub (;*) {$deny->();};
        local *CORE::GLOBAL::lstat=sub (;*) {$deny->();};
        local *CORE::GLOBAL::seek=sub (*$$) {$deny->();};
        local *CORE::GLOBAL::sysseek=sub (*$$) {$deny->();};
        local *CORE::GLOBAL::truncate=sub ($$) {$deny->();};
        local *CORE::GLOBAL::socket=sub (*$$$) {$deny->();};
        local *CORE::GLOBAL::socketpair=sub (**$$$) {$deny->();};
        local *CORE::GLOBAL::connect=sub (*$) {$deny->();};
        local *CORE::GLOBAL::accept=sub (**) {$deny->();};
        local *IO::Select::can_write=$deny;local *IO::Select::has_exception=$deny;
        local *Time::HiRes::sleep=$deny;local *POSIX::dup2=$deny;
        local *POSIX::close=$deny;local *POSIX::_exit=$deny;
        my %prototypes=(pipe=>'**',opendir=>'*$',readdir=>'*',closedir=>'*',
          fork=>'',waitpid=>'$$',sysread=>'*\\$$;$',binmode=>'*;$',fcntl=>'*$$',close=>';*');
        for my $op(sort keys %prototypes) {
          my $expected=$prototypes{$op};
          my $installed='CORE::GLOBAL'->can($op);$fail->() unless defined($installed)&&ref($installed) eq 'CODE';
          my $core=prototype('CORE::'.$op);my $hook=prototype($installed);
          $fail->() unless defined($core)&&defined($hook)&&$core eq $expected&&$hook eq $expected;
        }
        for my $op('exec','system') {
          my $installed='CORE::GLOBAL'->can($op);
          $fail->() unless defined($installed)&&ref($installed) eq 'CODE';
          $fail->() if defined(prototype($installed));
        }
        my $source=MIME::Base64::decode_base64($ARGV[0]);
        my $ok=eval {$loaded=eval($source."\n1;\n");$setup_error=$@;
          $check->();$fail->() unless $loaded&&!length($setup_error);$load_complete=1;
          my $capture=\&task6a_origin_capture;my $fds=\&task6a_origin_fds;
          local *main::task6a_origin_fds=sub {
            $check->();$fail->() unless @_==0;
            $enumerated=$fds->();return $enumerated;
          };
          local *main::task6a_origin_capture=sub {
            $check->();$fail->() unless @_==4&&$_[0] eq '/bin/ls'&&ref($_[1]) eq 'ARRAY'
              &&@{$_[1]}==2&&$_[1][0] eq '-lde'&&$_[1][1] eq '/stage/entry.mjs'
              &&$_[2]==2&&$_[3]==4096;
            ++$calls{capture};$event->(op=>'capture',role=>'acl');
            if($cleanup_throw) {
              my $value=eval {$capture->(@_)};my $error=$@;$capture_error=$error;
              die $error if length($error);$captured=$value;return $captured;
            }
            $captured=$capture->(@_);return $captured;
          };
          my $diagnostic=eval {task6a_origin_acl_free('/stage/entry.mjs')};my $primary=$@;
          if($mode eq 'forbidden') {eval {CORE::GLOBAL::system('/bin/false')};}
          if($mode eq 'forbidden-exec') {eval {CORE::GLOBAL::exec('/bin/false','/bin/false')};}
          if($mode eq 'caught-fault') {eval {$fail->()};}
          $check->();
          my $refused=!defined($diagnostic)&&$primary eq "TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n";
          $fail->() unless (!length($primary)&&ref($diagnostic) eq 'HASH')||$refused;
          $out={accepted=>defined($diagnostic)?JSON::PP::true:JSON::PP::false,
            refused=>$refused?JSON::PP::true:JSON::PP::false,diagnostic=>$diagnostic,
            captured=>$captured,enumerated=>$enumerated,
            helpersSettled=>task6a_origin_helpers_settled()};$check->();
          if($cleanup_throw) {
            $out->{helpersObservation}=test_observe_helpers();$check->();
            $out->{helpersObservationRepeat}=test_observe_helpers();$check->();
            $out->{captureError}=$capture_error;
            $out->{remainingWaits}=scalar(@wait);
            $out->{originalsPendingBeforeFinalizer}=scalar(grep {!$_->{attempted}&&!$_->{directory}} @owned);
          }
          1;
        };my $primary=$@;
        # Independent fixture finalizer: never mutable producer ledgers/receipts.
        # Already-attempted uncertain originals are not retried.
        for my $r(@owned) {
          next if $r->{attempted};
          my $closed=eval {$dispose->($r,1)};my $error=$@;
          $latch->() unless $closed&&!length($error)&&$r->{closed};
          ++$calls{fixtureClose};
        }
        my $definite=grep {$_->{closed}&&!defined(fileno($_->{fh}))} @owned;
        $latch->() unless $definite==@owned;
        unless($load_complete) {die length($setup_error)?$setup_error:"$fault\n";}
        if(length($fault)) {
          die "$fault\n" unless $self&&$primary eq "$fault\n";
          $out={accepted=>JSON::PP::false,refused=>JSON::PP::false,diagnostic=>undef,
            harnessFault=>$fault};
        } else {
          die $primary unless $ok;
          $check->();$fail->() if @clock;
          unless($mode=~/\Acensus-/||$cleanup_throw) {$fail->() if @wait||@ready;}
          if($cleanup_throw) {$fail->() if @ready||@wait>1||grep {@$_} values %read;}
          $out->{harnessFault}=undef;
        }
        $out->{calls}=\%calls;$out->{events}=\@events;
        $out->{ownedCount}=scalar(@owned);$out->{definitelyClosed}=$definite;
        $out->{consumerClosed}=scalar(grep {$_->{closed}&&$_->{closer}==0} @owned);
        $out->{fixtureClosed}=scalar(grep {$_->{closed}&&$_->{closer}==1} @owned);
        $out->{syntheticCensus}=JSON::PP::true;
        $out->{productionAuthority}=JSON::PP::false;
        my $metadata=JSON::PP->new->canonical->utf8->encode({map {$_=>$out->{$_}} grep {$_ ne 'events'} keys %$out});
        die "TEST_STAGED_CAPTOR_HARNESS_FAULT\n" if length($metadata)>16384;
        my $json=JSON::PP->new->canonical->utf8->encode($out);
        die "TEST_STAGED_CAPTOR_HARNESS_FAULT\n" if length($json)>8388608;
        print $json;exit 0;
      }
    }

`;
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
  // options/entry points: remove only the unique cold prefix and sole final
  // main call in memory, never on disk.
  const original=sourceOverride??readFileSync(BOOTSTRAP,'utf8');
  assert.ok(original.startsWith(COLD_ENTRY_GUARD),'cold entry must be source prefix');
  let source=replaceOnce(original,COLD_ENTRY_GUARD,'');
  source=replaceOnce(source,'\ntask6a_origin_main();\n','\n');
  if(kind==='staged-custody') {
    source=replaceOnce(source,'exec {$tool} $tool,@$args;',
      'CORE::GLOBAL::exec($tool,$tool,@$args);');
    source=replaceOnce(source,
      "my $staged_vendor_pin='ef28d8fab2c0e4314522d4bb1b7173270aa3937e93b92cb7de79c112ac1fa953';",
      "my $staged_vendor_pin='bf6cedd405c26f5f933e45436d8ec84b2780297377bb44f40deb6c44a91f6a6e';");
    source=replaceOnce(source,'sub task6a_origin_hold_staged_custody {',String.raw`
  if($mode ne 'absent') {$staged_admission=$fixture_admission;}
  if($mode eq 'foreign-parent') {push @parent_originals,{fh=>$fixture_original};}
  elsif($mode eq 'foreign-physical') {push @physical_owned_handles,$fixture_original;}
  elsif($mode eq 'foreign-file') {push @file_ledger,{fh=>$fixture_original};}
  elsif($mode eq 'foreign-directory') {push @directory_ledger,{fh=>$fixture_original};}
  elsif($mode eq 'foreign-fd-alias') {push @physical_owned_handles,$fixture_original;}
  my @test_metadata_saved;my ($test_metadata_changed,$test_metadata_restored)=(0,0);
  sub test_change_staged_metadata {
    $fail->() unless @_==0&&$staged_phase eq 'active'&&!$test_metadata_changed;
    my %allowed=map {$_=>1} qw(metadata-dir-short metadata-file-short metadata-dir-record-copy metadata-file-record-copy metadata-dir-tuple-copy metadata-file-tuple-copy metadata-dir-path metadata-file-path metadata-file-tuple-value metadata-file-hash metadata-dir-fh-empty metadata-file-fh-empty metadata-dir-fh-alias metadata-file-fh-alias);
    $fail->() unless $allowed{$mode}&&@staged_directories==6&&@staged_files==6;
    @test_metadata_saved=map {
      [map {+{record=>$_,fields=>{%$_},tuple=>[@{$_->{identity}}]}} @$_]
    } (\@staged_directories,\@staged_files);
    my $rows=$mode=~/\Ametadata-dir-/ ? \@staged_directories:\@staged_files;
    my $old=$rows->[0];my $change;
    if($mode=~/-short\z/) {pop @$rows;$change=@$rows==5;}
    elsif($mode=~/-record-copy\z/) {
      $rows->[0]={%$old};$change=$rows->[0]!=$old&&$rows->[0]{fh}==$old->{fh};
    }
    elsif($mode=~/-tuple-copy\z/) {
      my $tuple=$old->{identity};$old->{identity}=[@$tuple];
      $change=$old->{identity}!=$tuple&&@{$old->{identity}}==13;
    }
    elsif($mode=~/-path\z/) {$old->{path}='/private/tmp/metadata-wrong';$change=$old->{path} eq '/private/tmp/metadata-wrong';}
    elsif($mode eq 'metadata-file-tuple-value') {
      my $was=$old->{identity}[1];++$old->{identity}[1];$change=$old->{identity}[1]==$was+1;
    }
    elsif($mode eq 'metadata-file-hash') {$old->{sha256}='0'x64;$change=$old->{sha256} eq '0'x64;}
    elsif($mode=~/-fh-empty\z/) {$old->{fh}=undef;$change=!defined($old->{fh});}
    elsif($mode=~/-fh-alias\z/) {$old->{fh}=$rows->[1]{fh};$change=$old->{fh}==$rows->[1]{fh};}
    else {$fail->();}
    $fail->() unless $change;$test_metadata_changed=1;
    return {mode=>''.$mode,changed=>JSON::PP::true};
  }
  sub test_restore_staged_metadata {
    $fail->() unless @_==0&&$test_metadata_changed&&!$test_metadata_restored
      &&$staged_phase eq 'burned'&&@test_metadata_saved==2;
    my @rows=(\@staged_directories,\@staged_files);
    for my $i(0..1) {
      $fail->() unless @{$test_metadata_saved[$i]}==6;
      @{$rows[$i]}=map {$_->{record}} @{$test_metadata_saved[$i]};
      for my $saved(@{$test_metadata_saved[$i]}) {
        %{$saved->{record}}=%{$saved->{fields}};
        @{$saved->{record}{identity}}=@{$saved->{tuple}};
      }
    }
    $test_metadata_restored=1;return {restored=>JSON::PP::true};
  }
  my ($test_magic_target,$test_magic_kind);
  my $test_magic_counts={factory=>0,untie=>0,destroy=>0,callbacks=>{
    map {$_=>0} qw(FETCHSIZE FETCH STORE STORESIZE EXTEND PUSH POP SHIFT UNSHIFT CLEAR EXISTS DELETE FIRSTKEY NEXTKEY SCALAR)}};
  sub test_change_staged_magic {
    $fail->() unless @_==0&&$staged_phase eq 'active'&&!$test_metadata_changed
      &&!defined($test_magic_target)&&!$test_magic_counts->{factory};
    my %allowed=map {$_=>1} qw(magic-dir-array magic-dir-record magic-dir-tuple magic-dir-path magic-dir-fh magic-dir-retained-record magic-dir-retained-tuple magic-file-array magic-file-record magic-file-tuple magic-file-path magic-file-fh magic-file-retained-record magic-file-retained-tuple magic-file-hash magic-file-element);
    $fail->() unless $allowed{$mode}&&@staged_directories==6&&@staged_files==6;
    # Prepare all strong native FH/container/value references before any tie.
    @test_metadata_saved=map {
      [map {+{record=>$_,fields=>{%$_},tuple=>[@{$_->{identity}}]}} @$_]
    } (\@staged_directories,\@staged_files);
    my $rows=$mode=~/\Amagic-dir-/ ? \@staged_directories:\@staged_files;
    my $old=$rows->[0];my $target;my $kind;
    if($mode=~/-array\z/) {$target=$rows;$kind='array';}
    elsif($mode=~/-retained-record\z/) {
      $rows->[0]={%$old};$target=$old;$kind='hash';
    }
    elsif($mode=~/-retained-tuple\z/) {
      $target=$old->{identity};$old->{identity}=[@$target];$kind='array';
    }
    elsif($mode=~/-record\z/) {$target=$old;$kind='hash';}
    elsif($mode=~/-tuple\z/) {$target=$old->{identity};$kind='array';}
    elsif($mode=~/-path\z/) {$target=\($old->{path});$kind='scalar';}
    elsif($mode=~/-fh\z/) {$target=\($old->{fh});$kind='scalar';}
    elsif($mode eq 'magic-file-hash') {$target=\($old->{sha256});$kind='scalar';}
    elsif($mode eq 'magic-file-element') {$target=\($old->{identity}[0]);$kind='scalar';}
    else {$fail->();}
    $test_magic_target=$target;$test_magic_kind=$kind;$test_metadata_changed=1;
    if($kind eq 'array') {tie @$target,'TestStagedPartialArray',$test_magic_counts;}
    elsif($kind eq 'hash') {tie %$target,'TestStagedMetadataHash',$test_magic_counts;}
    else {tie $$target,'TestStagedMetadataScalar',$test_magic_counts;}
    my $sv=B::svref_2object($target);
    $fail->() unless $test_magic_counts->{factory}==1&&($sv->FLAGS&0x00f00000);
    return {mode=>''.$mode,changed=>JSON::PP::true};
  }
  sub test_observe_staged_magic {
    $fail->() unless @_==0;
    return {factory=>0+$test_magic_counts->{factory},untie=>0+$test_magic_counts->{untie},
      destroy=>0+$test_magic_counts->{destroy},callbacks=>{%{$test_magic_counts->{callbacks}}}};
  }
  sub test_restore_staged_magic {
    $fail->() unless @_==0&&$staged_phase eq 'burned'&&defined($test_magic_target)
      &&$test_magic_counts->{factory}==1&&!$test_magic_counts->{untie};
    if($test_magic_kind eq 'array') {untie @$test_magic_target;}
    elsif($test_magic_kind eq 'hash') {untie %$test_magic_target;}
    elsif($test_magic_kind eq 'scalar') {untie $$test_magic_target;}
    else {$fail->();}
    $fail->() unless $test_magic_counts->{untie}==1&&$test_magic_counts->{destroy}==1;
    $test_magic_target=undef;
    return test_restore_staged_metadata();
  }
  my ($test_drift_admission,$test_drift_creation,$test_drift_sources);
  my (@test_drift_hashes,@test_drift_creation_values,@test_drift_source_members);
  my ($test_drift_changed,$test_drift_restored)=(0,0);
  sub test_change_staged_admission {
    $fail->() unless @_==0&&$staged_phase eq 'active'&&!$test_drift_changed;
    my %allowed=map {$_=>1} qw(drift-copy-admission drift-copy-creator drift-copy-creation drift-copy-sources drift-copy-source-0 drift-copy-source-1 drift-copy-source-2 drift-copy-source-3 drift-copy-vendor drift-copy-selected drift-selected-detached drift-root drift-creation-inode drift-source-bytes-0 drift-source-bytes-1 drift-source-bytes-2 drift-source-bytes-3 drift-vendor-bytes drift-selected-bytes drift-extra);
    $fail->() unless $allowed{$mode};
    my $a=$staged_admission;my $creator=$a->{creator};my $sources=$a->{sources};
    $test_drift_admission=$a;$test_drift_creation=$creator->{creationIdentity};
    $test_drift_sources=$sources;
    @test_drift_creation_values=@$test_drift_creation;
    @test_drift_source_members=@$sources;
    @test_drift_hashes=map {+{record=>$_,fields=>{%$_}}}
      ($a,$creator,@$sources,$a->{vendor},$a->{selected});
    my $changed;
    if($mode eq 'drift-copy-admission') {$staged_admission={%$a};$changed=$staged_admission!=$a;}
    elsif($mode eq 'drift-copy-creator') {$a->{creator}={%$creator};$changed=$a->{creator}!=$creator;}
    elsif($mode eq 'drift-copy-creation') {
      $creator->{creationIdentity}=[@$test_drift_creation];
      $changed=$creator->{creationIdentity}!=$test_drift_creation;
    }
    elsif($mode eq 'drift-copy-sources') {$a->{sources}=[@$sources];$changed=$a->{sources}!=$sources;}
    elsif($mode=~/\Adrift-copy-source-([0-3])\z/) {
      my $i=0+$1;my $old=$sources->[$i];$sources->[$i]={%$old};$changed=$sources->[$i]!=$old;
    }
    elsif($mode eq 'drift-copy-vendor') {
      my $old=$a->{vendor};$a->{vendor}={%$old};$a->{selected}{archiveRef}=$a->{vendor};
      $changed=$a->{vendor}!=$old&&$a->{selected}{archiveRef}==$a->{vendor};
    }
    elsif($mode eq 'drift-copy-selected') {
      my $old=$a->{selected};$a->{selected}={%$old};$changed=$a->{selected}!=$old;
    }
    elsif($mode eq 'drift-selected-detached') {
      $a->{selected}{archiveRef}={%{$a->{vendor}}};$changed=$a->{selected}{archiveRef}!=$a->{vendor};
    }
    elsif($mode eq 'drift-root') {
      $creator->{rootPath}='/private/tmp/task6a-staged-other';
      $changed=$creator->{rootPath} ne $logical;
    }
    elsif($mode eq 'drift-creation-inode') {
      ++$test_drift_creation->[1];$changed=$test_drift_creation->[1]==$test_drift_creation_values[1]+1;
    }
    elsif($mode=~/\Adrift-source-bytes-([0-3])\z/) {
      my $cell=\($sources->[0+$1]{bytes});my $before=ord(substr($$cell,0,1));
      substr($$cell,0,1)=chr($before^1);$changed=ord(substr($$cell,0,1))==($before^1);
    }
    elsif($mode eq 'drift-vendor-bytes'||$mode eq 'drift-selected-bytes') {
      my $row=$mode eq 'drift-vendor-bytes'?$a->{vendor}:$a->{selected};
      my $cell=\($row->{bytes});my $before=ord(substr($$cell,0,1));
      substr($$cell,0,1)=chr($before^1);$changed=ord(substr($$cell,0,1))==($before^1);
    }
    elsif($mode eq 'drift-extra') {$a->{extra}=1;$changed=exists($a->{extra});}
    else {$fail->();}
    $fail->() unless $changed;$test_drift_changed=1;
    return {mode=>''.$mode,changed=>JSON::PP::true};
  }
  sub test_restore_staged_admission {
    $fail->() unless @_==0&&$staged_phase eq 'burned'&&$test_drift_changed
      &&!$test_drift_restored&&@test_drift_hashes==8&&@test_drift_source_members==4
      &&@test_drift_creation_values==13;
    $staged_admission=$test_drift_admission;
    for my $saved(@test_drift_hashes) {%{$saved->{record}}=%{$saved->{fields}};}
    @$test_drift_sources=@test_drift_source_members;
    @$test_drift_creation=@test_drift_creation_values;
    $fail->() unless $staged_admission==$test_drift_admission;
    for my $saved(@test_drift_hashes) {
      my $now=$saved->{record};my $old=$saved->{fields};
      $fail->() unless join(',',sort keys %$now) eq join(',',sort keys %$old);
      for my $key(keys %$old) {
        $fail->() unless ref($old->{$key})?$now->{$key}==$old->{$key}:$now->{$key} eq $old->{$key};
      }
    }
    $fail->() unless @$test_drift_sources==4&&@$test_drift_creation==13;
    for my $i(0..3) {$fail->() unless $test_drift_sources->[$i]==$test_drift_source_members[$i];}
    for my $i(0..12) {$fail->() unless $test_drift_creation->[$i]==$test_drift_creation_values[$i];}
    $test_drift_restored=1;return {restored=>JSON::PP::true};
  }
  my ($test_admission_magic_target,$test_admission_magic_kind);
  my $test_admission_magic_counts={factory=>0,untie=>0,destroy=>0,callbacks=>{
    map {$_=>0} qw(FETCHSIZE FETCH STORE STORESIZE EXTEND PUSH POP SHIFT UNSHIFT CLEAR EXISTS DELETE FIRSTKEY NEXTKEY SCALAR)}};
  sub test_change_staged_admission_magic {
    $fail->() unless @_==0&&$staged_phase eq 'active'&&!$test_drift_changed
      &&!defined($test_admission_magic_target)&&!$test_admission_magic_counts->{factory};
    my %allowed=map {$_=>1} qw(amagic-current-admission amagic-current-creator amagic-current-creation amagic-current-sources amagic-current-source-0 amagic-current-source-1 amagic-current-source-2 amagic-current-source-3 amagic-current-vendor amagic-current-selected amagic-retained-admission amagic-retained-creator amagic-retained-creation amagic-retained-sources amagic-retained-source-0 amagic-retained-source-1 amagic-retained-source-2 amagic-retained-source-3 amagic-retained-vendor amagic-retained-selected);
    $fail->() unless $allowed{$mode};
    # Save the entire original public graph before tying any current or retained cell.
    my $a=$staged_admission;my $creator=$a->{creator};my $sources=$a->{sources};
    $test_drift_admission=$a;$test_drift_creation=$creator->{creationIdentity};
    $test_drift_sources=$sources;
    @test_drift_creation_values=@$test_drift_creation;
    @test_drift_source_members=@$sources;
    @test_drift_hashes=map {+{record=>$_,fields=>{%$_}}}
      ($a,$creator,@$sources,$a->{vendor},$a->{selected});
    $fail->() unless $mode=~/\Aamagic-(current|retained)-(.+)\z/;
    my ($which,$part)=($1,$2);my ($target,$kind);
    if($part eq 'admission') {
      $target=$a;$kind='hash';$staged_admission={%$a} if $which eq 'retained';
    } elsif($part eq 'creator') {
      $target=$creator;$kind='hash';$a->{creator}={%$creator} if $which eq 'retained';
    } elsif($part eq 'creation') {
      $target=$test_drift_creation;$kind='array';
      $creator->{creationIdentity}=[@$target] if $which eq 'retained';
    } elsif($part eq 'sources') {
      $target=$sources;$kind='array';$a->{sources}=[@$sources] if $which eq 'retained';
    } elsif($part=~/\Asource-([0-3])\z/) {
      my $i=0+$1;$target=$sources->[$i];$kind='hash';
      $sources->[$i]={%$target} if $which eq 'retained';
    } elsif($part eq 'vendor') {
      $target=$a->{vendor};$kind='hash';
      if($which eq 'retained') {$a->{vendor}={%$target};$a->{selected}{archiveRef}=$a->{vendor};}
    } elsif($part eq 'selected') {
      $target=$a->{selected};$kind='hash';$a->{selected}={%$target} if $which eq 'retained';
    } else {$fail->();}
    $test_admission_magic_target=$target;$test_admission_magic_kind=$kind;
    $test_drift_changed=1;
    if($kind eq 'array') {tie @$target,'TestStagedPartialArray',$test_admission_magic_counts;}
    elsif($kind eq 'hash') {tie %$target,'TestStagedMetadataHash',$test_admission_magic_counts;}
    else {$fail->();}
    my $sv=B::svref_2object($target);
    $fail->() unless $test_admission_magic_counts->{factory}==1&&($sv->FLAGS&0x00f00000);
    return {mode=>''.$mode,changed=>JSON::PP::true};
  }
  sub test_observe_staged_admission_magic {
    $fail->() unless @_==0;
    return {factory=>0+$test_admission_magic_counts->{factory},
      untie=>0+$test_admission_magic_counts->{untie},destroy=>0+$test_admission_magic_counts->{destroy},
      callbacks=>{%{$test_admission_magic_counts->{callbacks}}}};
  }
  sub test_restore_staged_admission_magic {
    $fail->() unless @_==0&&$staged_phase eq 'burned'&&defined($test_admission_magic_target)
      &&$test_admission_magic_counts->{factory}==1&&!$test_admission_magic_counts->{untie};
    if($test_admission_magic_kind eq 'array') {untie @$test_admission_magic_target;}
    elsif($test_admission_magic_kind eq 'hash') {untie %$test_admission_magic_target;}
    else {$fail->();}
    $fail->() unless $test_admission_magic_counts->{untie}==1&&$test_admission_magic_counts->{destroy}==1;
    $test_admission_magic_target=undef;
    return test_restore_staged_admission();
  }
  sub test_observe_staged_helpers {
    task6a_origin_refuse() unless @_==0;
    my $settled=scalar(grep {$_->{settled}} @helper_ledger);
    return {burned=>$helper_lifecycle_burned?JSON::PP::true:JSON::PP::false,
      registered=>0+scalar(@helper_ledger),settled=>0+$settled,
      unsettled=>0+scalar(@helper_ledger)-$settled,
      helpersSettled=>task6a_origin_helpers_settled(),
      physicalOwnsLedgers=>$physical_owns_ledgers?JSON::PP::true:JSON::PP::false};
  }
  sub test_tie_staged_partial {
    $fail->() unless @_==0&&$staged_phase eq 'capturing'&&$partial_nominated==1
      &&!$partial_counts->{factory};
    my $rows;
    if($mode eq 'partial-tied-dir') {$rows=\@staged_directories;}
    elsif($mode eq 'partial-tied-file') {$rows=\@staged_files;}
    else {$fail->();}
    tie @$rows,'TestStagedPartialArray',$partial_counts;
    my $av=B::svref_2object($rows);my $magic=$av->MAGIC;
    $fail->() unless ref($av) eq 'B::AV'&&$partial_counts->{factory}==1
      &&(($av->FLAGS&0x00f00000)||defined($magic));
  }
  sub test_untie_staged_partial {
    $fail->() unless @_==0&&$partial_nominated==1&&$partial_counts->{factory}==1
      &&!$partial_counts->{untie}&&$staged_phase eq 'burned';
    if($mode eq 'partial-tied-dir') {untie @staged_directories;}
    elsif($mode eq 'partial-tied-file') {untie @staged_files;}
    else {$fail->();}
    $fail->() unless $partial_counts->{untie}==1;
  }
  sub test_observe_staged_custody {
    task6a_origin_refuse() unless @_==0;
    $staged_vector->(\@staged_originals);
    my ($attempted,$closed)=(0,0);my @closed_flags;
    for my $sealed(@staged_originals) {
      my @binding=$sealed->('binding');
      $attempted+=($binding[2]?1:0);$closed+=($binding[3]?1:0);
      push @closed_flags,$binding[3]?1:0;
    }
    return {phase=>''.$staged_phase,invalid=>0+$staged_invalid,
      uncertain=>0+$staged_uncertain,disposalStarted=>0+$staged_disposal_started,
      sealedClosureCount=>0+scalar(@staged_originals),
      attemptedCount=>0+$attempted,privateClosedCount=>0+$closed,closedFlags=>\@closed_flags};
  }
  sub task6a_origin_hold_staged_custody {`);
  }
  if(kind==='staged-captor-ports') {
    // Only the denied external exec port changes syntax in this memory copy.
    // Perl's ordinary-sub override cannot parse the original exec block form.
    source=replaceOnce(source,'exec {$tool} $tool,@$args;','CORE::GLOBAL::exec($tool,$tool,@$args);');
    if(record.mode==='cleanup-close-throw') {
      source=replaceOnce(source,'sub task6a_origin_helpers_settled {',[
        'sub test_observe_helpers {',
        '    task6a_origin_refuse() unless @_==0;',
        '    my $settled=scalar(grep {$_->{settled}} @helper_ledger);',
        '    return {burned=>$helper_lifecycle_burned?JSON::PP::true:JSON::PP::false,',
        '        registered=>scalar(@helper_ledger),settled=>$settled,',
        '        unsettled=>scalar(@helper_ledger)-$settled};',
        '}',
        'sub task6a_origin_helpers_settled {',
      ].join('\n'));
    }
  }
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
    ${STAGED_CUSTODY_PROGRAM}
    ${STAGED_CAPTOR_PORT_PROGRAM}
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
  const argv=['-f','-e',program,Buffer.from(source).toString('base64')];
  const env={PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'};
  const input=JSON.stringify({kind,record,expected});
  if(kind==='staged-custody') {
    // Observed host ARG_MAX is 1048576. Reserve 262144 bytes for kernel/pointer
    // overhead; count ACTUAL final UTF8 argv/env strings, not source estimates.
    const byteTotal=Buffer.byteLength('/usr/bin/perl')+1
      +argv.reduce((n,v)=>n+Buffer.byteLength(v)+1,0)
      +Object.entries(env).reduce((n,[k,v])=>n+Buffer.byteLength(k+'='+v)+1,0);
    assert.ok(byteTotal<=786432,'staged custody argv budget exceeded');
    assert.ok(Buffer.byteLength(input)<=262144,'staged custody stdin budget exceeded');
  }
  const r=spawnSync('/usr/bin/perl',argv,{
    input,cwd:'/',env,timeout:record?.fifoRace?500:10000,
    maxBuffer:['staged-captor-ports','staged-custody'].includes(kind)?8388608:65536,
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
const STAGED_EXPOSED_OPEN_PREFIXES=[
  // N,clocks,helpers,stage closes,all originals,total ported operations
  [1,2,0,1,1,5],
  [2,10,1,2,11,100],
  [3,18,2,3,21,196],
  [4,26,3,4,31,293],
  [5,34,4,5,41,391],
  [6,42,5,6,51,490],
  [7,50,6,7,61,590],
  [8,53,6,8,62,609],
  [9,56,6,9,63,628],
  [10,59,6,10,64,647],
  [11,62,6,11,65,666],
  [12,65,6,12,66,685],
];
const STAGED_CUSTODY_BACKINGS=[
  ['source/task6a-origin-archive-v2.pm','scripts/task6a-origin-archive-v2.pm',5864,'da1fd458fcaba775be5ba09ef88157b5ee48dbda'],
  ['source/task6a-origin-native-v2.pm','scripts/task6a-origin-native-v2.pm',3347,'59e1ae8de38cf2083a0294c55454083840eb47f1'],
  ['source/task6a-origin-map-v2.pm','scripts/task6a-origin-map-v2.pm',11684,'9719bf4f3676b43b7858e3cabe3cee3e679120f8'],
  ['source/task6a-protected-origin-entry-v2.mjs','scripts/task6a-protected-origin-entry-v2.mjs',1933,'e53be63cdcdf286dc89adbec9770668b1fdb9cc7'],
  ['vendor/node-v22.23.1-darwin-arm64.tar.gz','package.json',22734,null],
  ['vendor/node','README.md',7454,null],
];
function stagedCustody(mode='healthy',slot=0,{sourceOverride}={}) {
  const source=sourceOverride??readFileSync(BOOTSTRAP,'utf8');
  for(const name of ['hold','recheck','release']) {
    assert.equal(source.split('sub task6a_origin_'+name+'_staged_custody {').length,2,
      'staged custody consumer missing: '+name);
  }
  const root=fileURLToPath(new URL('../../',import.meta.url)).replace(/\/$/,'');
  const backings=STAGED_CUSTODY_BACKINGS.map(([logical,relative,size,blob])=>{
    const path=root+'/'+relative;
    const before=lstatSync(path,{bigint:true});
    assert.ok(before.isFile()&&!before.isSymbolicLink());
    assert.equal(before.nlink,1n);assert.equal(before.size,BigInt(size));
    const bytes=readFileSync(path);const after=lstatSync(path,{bigint:true});
    for(const key of ['dev','ino','mode','nlink','uid','gid','size','mtimeNs','ctimeNs'])
      assert.equal(after[key],before[key]);
    if(blob!==null) assert.equal(createHash('sha1')
      .update(Buffer.concat([Buffer.from('blob '+bytes.length+'\0'),bytes])).digest('hex'),blob);
    return {logical,path,size,dev:String(before.dev),ino:String(before.ino),
      sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.toString('base64')};
  });
  assert.equal(backings[4].sha256,'bf6cedd405c26f5f933e45436d8ec84b2780297377bb44f40deb6c44a91f6a6e');
  const actual=systemObject('staged-custody',{mode,slot,root,backings},undefined,{sourceOverride:source});
  assert.equal(actual.status,0,actual.stderr.toString());
  assert.equal(actual.stderr.length,0);const value=JSON.parse(actual.stdout.toString());
  assert.equal(value.harnessFault,null);assert.equal(value.productionAuthority,false);
  assert.equal(value.remainingOperations,0);
  if(['foreign-parent','foreign-physical','foreign-file','foreign-directory','hidden-open-undefined','foreign-fd-alias'].includes(mode)) {
    assert.equal(slot,0);
    assert.deepEqual([value.rawAcquisitions,value.ownedCount,value.definitelyClosed,value.fixtureClosed,
      value.consumerClosed,value.stageClosed,value.helperClosed],[1,1,1,1,0,0,0]);
    assert.deepEqual(value.fixtureOwnerBeforeRescue,{live:true,sameFd:true,sameIdentity:true,
      attempted:0,closed:0});
  } else assert.equal(value.fixtureClosed,0);
  assert.equal(value.definitelyClosed,value.ownedCount);
  assert.equal(value.repeatEffectDelta,0);return value;
}
test('staged custody actual consumer holds, rechecks and releases twelve originals',()=>{
  const r=stagedCustody();
  const diagnostic={scope:'staged-source-vendor-custody-diagnostic-only',
    productionAuthority:false,fileCount:6,directoryCount:6};
  assert.deepEqual(r.hold,diagnostic);assert.deepEqual(r.recheck,diagnostic);
  assert.deepEqual(r.release,{...diagnostic,handlesClosed:12});
  assert.equal(r.refused,false);assert.equal(r.ownedCount,390);
  assert.equal(r.stageClosed,12);assert.equal(r.helperClosed,378);
  assert.deepEqual(r.calls,{binmode:342,clock:407,close:348,closedir:42,fcntl:90,
    fileno:1110,fork:42,lstat:132,opendir:42,pipe:168,read:228,readdir:1083,
    ready:84,seek:30,stat:120,sysopen:12,wait:168});
});

for(const mode of ['absent','arity','premature-recheck','premature-release'])
  test('staged custody actual consumer refuses '+mode+' without acquisition',()=>{
    const r=stagedCustody(mode);assert.equal(r.refused,true);
    assert.equal(r.ownedCount,0);assert.equal(r.calls.clock,mode==='absent'?2:1);
  });
for(const mode of ['open-undefined','open-false','open-throw'])
  for(const [slot,clocks,helpers,stageCloses,allOriginals,portedTotal] of STAGED_EXPOSED_OPEN_PREFIXES)
    // Independent literal prefix table; not the consumer's trace builder.
    for(const want of [{slot,clocks,helpers,stageCloses,allOriginals,portedTotal}])
    test('staged custody actual consumer disposes '+mode+' slot '+want.slot,()=>{
      const r=stagedCustody(mode,want.slot);assert.equal(r.refused,true);
      assert.equal(r.calls.sysopen,want.slot);assert.equal(r.calls.clock,want.clocks);
      assert.equal(r.helpers,want.helpers);
      const exposed=mode!=='open-undefined';
      assert.equal(r.stageClosed,want.stageCloses-(exposed?0:1));
      assert.equal(r.ownedCount,want.allOriginals-(exposed?0:1));
      if(exposed) assert.equal(Object.values(r.calls).reduce((n,v)=>n+v,0),want.portedTotal);
    });
const STAGED_CALLBACK_ZERO={FETCH:0,STORE:0,FILENO:0,CLOSE:0,READ:0,PRINT:0,PRINTF:0,
  WRITE:0,READLINE:0,GETC:0,SEEK:0,TELL:0,EOF:0,BINMODE:0,CALL:0,string:0,numeric:0,bool:0,compare:0};
for(const mode of ['unknown-cell','unknown-handle','unknown-blessed-glob','unknown-overloaded',
  'unknown-indirect','unknown-scalar-ref','unknown-array','unknown-hash','unknown-coderef'])
  test('staged custody malformed nominee rejects '+mode+' without callback or FD',()=>{
    const r=stagedCustody(mode);
    assert.equal(r.refused,true);assert.equal(r.ownedCount,0);assert.equal(r.stageClosed,0);
    assert.equal(r.helperClosed,0);assert.equal(r.helpers,0);
    assert.deepEqual(r.calls,{clock:2,lstat:1,sysopen:1});
    assert.deepEqual(r.candidateCallbacksBeforeFinalizer,STAGED_CALLBACK_ZERO);
    assert.deepEqual(r.factoryCounts,{scalar:mode==='unknown-cell'?1:0,handle:mode==='unknown-handle'?1:0});
  });
test('staged custody malformed nominee catches removal of pre-value cell magic guard',()=>{
  const source=replaceOnce(readFileSync(BOOTSTRAP,'utf8'),
    '    task6a_origin_refuse() if $sv->FLAGS & 0x00f00000;','');
  const r=stagedCustody('unknown-cell',0,{sourceOverride:source});
  assert.equal(r.refused,true);assert.equal(r.ownedCount,0);assert.equal(r.helpers,0);
  assert.deepEqual(r.calls,{clock:2,lstat:1,sysopen:1});
  assert.deepEqual(r.candidateCallbacksBeforeFinalizer,{...STAGED_CALLBACK_ZERO,FETCH:1});
  assert.throws(()=>assert.deepEqual(r.candidateCallbacksBeforeFinalizer,STAGED_CALLBACK_ZERO),
    {code:'ERR_ASSERTION'});
});
const STAGED_CLOSE_CALLS={binmode:342,clock:407,close:348,closedir:42,fcntl:90,
  fileno:1110,fork:42,lstat:132,opendir:42,pipe:168,read:228,readdir:1083,
  ready:84,seek:30,stat:120,sysopen:12,wait:168};
const STAGED_CLOSE_ROLES=['d0','d1','d2','d3','d4','d5','f0','f1','f2','f3','f4','f5'];
function assertStagedClosePhysical(r,mode,slot) {
  assert.equal(r.refused,false);
  assert.deepEqual(r.calls,STAGED_CLOSE_CALLS);
  assert.deepEqual([r.ownedCount,r.stageClosed,r.helperClosed],[390,12,378]);
  assert.deepEqual(r.events.filter(e=>e.op==='close'&&STAGED_CLOSE_ROLES.includes(e.role)).map(e=>e.role),
    STAGED_CLOSE_ROLES);
  assert.deepEqual(r.nominatedClose,{role:STAGED_CLOSE_ROLES[slot-1],slot,kind:mode,
    physicallyClosedBeforeResponse:true});
  assert.deepEqual(r.sourceBeforeRelease,{phase:'active',invalid:0,uncertain:0,disposalStarted:0,
    sealedClosureCount:12,attemptedCount:0,privateClosedCount:0,closedFlags:[0,0,0,0,0,0,0,0,0,0,0,0]});
}
function assertStagedCloseUncertain(r,slot) {
  assert.equal(r.releaseRefused,true);assert.equal(r.release,null);
  const flags=[1,1,1,1,1,1,1,1,1,1,1,1];flags[slot-1]=0;
  assert.deepEqual(r.sourceAfterRelease,{phase:'burned',invalid:1,uncertain:1,disposalStarted:1,
    sealedClosureCount:12,attemptedCount:12,privateClosedCount:11,closedFlags:flags});
  assert.deepEqual(r.sourceAfterRepeats,r.sourceAfterRelease);
}
for(const mode of ['close-false','close-throw'])
  for(let slot=1;slot<=12;slot++)
    test('staged custody uncertain close attempts all originals for '+mode+' slot '+slot,()=>{
      const r=stagedCustody(mode,slot);
      assertStagedClosePhysical(r,mode,slot);assertStagedCloseUncertain(r,slot);
    });
for(const mode of ['close-false','close-throw'])
  test('staged custody uncertain close catches false definite-closure mutant for '+mode,()=>{
    const source=replaceOnce(readFileSync(BOOTSTRAP,'utf8'),
      '$closed=1 if $ok&&!length($close_error)&&$inspected',
      '$closed=1 if $inspected');
    const r=stagedCustody(mode,1,{sourceOverride:source});
    assertStagedClosePhysical(r,mode,1);
    assert.equal(r.releaseRefused,false);
    assert.deepEqual(r.release,{scope:'staged-source-vendor-custody-diagnostic-only',
      productionAuthority:false,fileCount:6,directoryCount:6,handlesClosed:12});
    assert.deepEqual(r.sourceAfterRelease,{phase:'released',invalid:0,uncertain:0,disposalStarted:1,
      sealedClosureCount:12,attemptedCount:12,privateClosedCount:12,closedFlags:[1,1,1,1,1,1,1,1,1,1,1,1]});
    assert.throws(()=>assertStagedCloseUncertain(r,1),{code:'ERR_ASSERTION'});
  });
for(const mode of ['admission-undef','admission-array','admission-extra','admission-missing-creator',
  'admission-root','admission-creation-short','admission-creation-string','admission-creation-owner',
  'admission-creation-type','admission-source-count','admission-source-order','admission-source-numeric',
  'admission-source-policy','admission-source-bytes-0','admission-source-bytes-1','admission-source-bytes-2',
  'admission-source-bytes-3','admission-vendor-bytes','admission-selected-detached','admission-selected-member'])
  test('staged custody admission negative rejects '+mode+' before any stage open',()=>{
    const r=stagedCustody(mode);
    assert.equal(r.refused,true);assert.equal(r.hold,null);
    assert.deepEqual(r.calls,{clock:2});
    assert.deepEqual([r.ownedCount,r.stageClosed,r.helperClosed,r.helpers],[0,0,0,0]);
    assert.deepEqual(r.sourceAfterAdmissionRefusal,{phase:'burned',invalid:1,uncertain:0,disposalStarted:1,
      sealedClosureCount:0,attemptedCount:0,privateClosedCount:0,closedFlags:[]});
    assert.deepEqual(r.sourceAfterAdmissionRepeats,r.sourceAfterAdmissionRefusal);
  });
const STAGED_HALF_BOUNDARY_CALLS={binmode:198,clock:237,close:204,closedir:24,fcntl:72,
  fileno:636,fork:24,lstat:84,opendir:24,pipe:96,read:132,readdir:597,
  ready:48,seek:18,stat:72,sysopen:12,wait:96};
for(const kind of ['expiry','throw'])
  for(const [part,clock,helpers,stage,originals,total] of [
    ['hold-entry',2,0,0,0,2],['hold-complete',237,24,12,228,2574],
    ['recheck-entry',238,24,12,228,2575],['recheck-complete',407,42,12,390,4448]])
    test('staged custody boundary refuses '+kind+' at '+part,()=>{
      const mode='boundary-'+kind+'-'+part,r=stagedCustody(mode);
      assert.deepEqual(r.boundaryNomination,{clock,mode});
      assert.equal(r.helpers,helpers);
      assert.deepEqual([r.ownedCount,r.stageClosed,r.helperClosed],[originals,stage,originals-stage]);
      const calls=clock===2?{clock:2}:clock===407?STAGED_CLOSE_CALLS:{...STAGED_HALF_BOUNDARY_CALLS,clock};
      assert.deepEqual(r.calls,calls);
      assert.equal(Object.values(r.calls).reduce((n,v)=>n+v,0),total);
      if(part.startsWith('hold-')) {assert.equal(r.refused,true);assert.equal(r.hold,null);}
      else {assert.equal(r.refused,false);assert.equal(r.recheckRefused,true);assert.equal(r.recheck,null);}
      assert.deepEqual(r.sourceAfterBoundary,{phase:'burned',invalid:1,uncertain:0,disposalStarted:1,
        sealedClosureCount:stage,attemptedCount:stage,privateClosedCount:stage,
        closedFlags:stage?[1,1,1,1,1,1,1,1,1,1,1,1]:[]});
      assert.deepEqual(r.sourceAfterBoundaryRepeats,r.sourceAfterBoundary);
    });
for(const mode of ['metadata-dir-short','metadata-file-short','metadata-dir-record-copy','metadata-file-record-copy',
  'metadata-dir-tuple-copy','metadata-file-tuple-copy','metadata-dir-path','metadata-file-path',
  'metadata-file-tuple-value','metadata-file-hash','metadata-dir-fh-empty','metadata-file-fh-empty',
  'metadata-dir-fh-alias','metadata-file-fh-alias'])
  test('staged custody metadata corruption burns irreversibly for '+mode,()=>{
    const r=stagedCustody(mode);
    assert.equal(r.refused,false);assert.equal(r.recheckRefused,true);assert.equal(r.recheck,null);
    assert.deepEqual(r.metadataMutation,{mode,changed:true});assert.deepEqual(r.metadataRestoration,{restored:true});
    assert.deepEqual(r.calls,STAGED_HALF_BOUNDARY_CALLS);
    assert.equal(Object.values(r.calls).reduce((n,v)=>n+v,0),2574);
    assert.equal(r.helpers,24);assert.deepEqual([r.ownedCount,r.stageClosed,r.helperClosed],[228,12,216]);
    assert.deepEqual(r.events.filter(e=>e.op==='close'&&STAGED_CLOSE_ROLES.includes(e.role)).map(e=>e.role),STAGED_CLOSE_ROLES);
    assert.deepEqual(r.sourceBeforeMetadata,{phase:'active',invalid:0,uncertain:0,disposalStarted:0,
      sealedClosureCount:12,attemptedCount:0,privateClosedCount:0,closedFlags:[0,0,0,0,0,0,0,0,0,0,0,0]});
    assert.deepEqual(r.sourceAfterMetadataRefusal,{phase:'burned',invalid:1,uncertain:0,disposalStarted:1,
      sealedClosureCount:12,attemptedCount:12,privateClosedCount:12,closedFlags:[1,1,1,1,1,1,1,1,1,1,1,1]});
    assert.deepEqual(r.sourceAfterMetadataRestoration,r.sourceAfterMetadataRefusal);
    assert.deepEqual(r.sourceAfterMetadataRepeats,r.sourceAfterMetadataRefusal);
  });
const STAGED_PARTIAL_CALLBACK_ZERO={FETCHSIZE:0,FETCH:0,STORE:0,STORESIZE:0,EXTEND:0,
  PUSH:0,POP:0,SHIFT:0,UNSHIFT:0,CLEAR:0,EXISTS:0,DELETE:0};
function assertStagedPartialPhysical(r,part) {
  const stage=part==='dir'?1:7;
  assert.equal(r.refused,true);assert.equal(r.hold,null);
  assert.equal(r.partialFactoryCount,1);
  assert.deepEqual(r.partialFinalization,{untie:1,destroy:1});
  const calls=part==='dir'?{clock:2,lstat:1,sysopen:1,fcntl:4,close:1}:
    {binmode:49,clock:50,close:55,closedir:6,fcntl:34,fileno:156,fork:6,
      lstat:19,opendir:6,pipe:24,read:24,readdir:111,ready:12,stat:12,sysopen:7,wait:24};
  assert.deepEqual(r.calls,calls);
  assert.equal(Object.values(r.calls).reduce((n,v)=>n+v,0),part==='dir'?9:595);
  assert.equal(r.helpers,part==='dir'?0:6);
  assert.deepEqual([r.ownedCount,r.stageClosed,r.helperClosed],part==='dir'?[1,1,0]:[61,7,54]);
  assert.deepEqual(r.events.filter(e=>e.op==='close'&&STAGED_CLOSE_ROLES.includes(e.role)).map(e=>e.role),
    STAGED_CLOSE_ROLES.slice(0,stage));
  assert.deepEqual(r.sourceAfterPartialRefusal,{phase:'burned',invalid:1,uncertain:0,disposalStarted:1,
    sealedClosureCount:stage,attemptedCount:stage,privateClosedCount:stage,closedFlags:Array(stage).fill(1)});
  assert.deepEqual(r.sourceAfterPartialRepeats,r.sourceAfterPartialRefusal);
  assert.deepEqual(r.partialCallbacksBeforeRepeats,r.partialCallbacksBeforeFinalizer);
  assert.deepEqual(r.partialCallbacksAfterFinalizer,r.partialCallbacksBeforeFinalizer);
}
for(const part of ['dir','file']) {
  test('staged custody partial tied array refuses '+part+' before public-vector access',()=>{
    const r=stagedCustody('partial-tied-'+part);assertStagedPartialPhysical(r,part);
    assert.deepEqual(r.partialCallbacksBeforeFinalizer,STAGED_PARTIAL_CALLBACK_ZERO);
  });
  test('staged custody partial tied array detects misplaced '+part+' guard mutant',()=>{
    const configure=part==='dir'?'1':'0',expected=part==='dir'?'undef,1':'$expected->{sha256},0';
    const old='            my ($fh)=$sealed->(\'binding\');$staged_configure->($fh,'+configure+');\n'
      +'            $staged_guard_partial->();\n'
      +'            my $record=$staged_record->($sealed,$path,\\@before,'+expected+');\n'
      +'            $staged_guard_partial->();';
    const next='            my ($fh)=$sealed->(\'binding\');$staged_configure->($fh,'+configure+');\n'
      +'            my $record=$staged_record->($sealed,$path,\\@before,'+expected+');';
    const source=replaceOnce(readFileSync(BOOTSTRAP,'utf8'),old,next);
    const r=stagedCustody('partial-tied-'+part,0,{sourceOverride:source});
    assertStagedPartialPhysical(r,part);
    assert.deepEqual(r.partialCallbacksBeforeFinalizer,{...STAGED_PARTIAL_CALLBACK_ZERO,PUSH:1});
    assert.throws(()=>assert.deepEqual(r.partialCallbacksBeforeFinalizer,STAGED_PARTIAL_CALLBACK_ZERO),
      {code:'ERR_ASSERTION'});
  });
}
const STAGED_H7_CALLS={binmode:62,clock:75,close:68,closedir:7,fcntl:55,fileno:188,
  fork:7,lstat:37,opendir:7,pipe:28,read:40,readdir:138,ready:14,seek:6,stat:25,sysopen:12,wait:28};
for(const mode of ['h7-acl-plus','h7-raw256'])
  test('staged custody h7 refusal drains actual captor for '+mode,()=>{
    const r=stagedCustody(mode),plus=mode==='h7-acl-plus';
    assert.equal(r.refused,true);assert.equal(r.hold,null);
    assert.deepEqual(r.calls,{...STAGED_H7_CALLS,clock:plus?75:74});
    assert.equal(Object.values(r.calls).reduce((n,v)=>n+v,0),plus?797:796);
    assert.deepEqual([r.helpers,r.ownedCount,r.stageClosed,r.helperClosed],[7,75,12,63]);
    const row='-r--r--r--'+(plus?'+':'')+' 1 root wheel 16 Jan 1 2026 /\n';
    assert.deepEqual(r.h7PipeRow,{bytes:plus?41:40,row});
    assert.deepEqual(r.h7ActualReads,[{bytes:plus?41:40,body:row},{bytes:0,body:''}]);
    assert.deepEqual(r.h7CaptorOutcome,{returned:plus,canonicalRefusal:!plus});
    assert.deepEqual(r.h7Drain,{jobCleared:true,helpersSettled:true});
    if(plus) assert.equal(r.h7StatusNomination,undefined);
    else assert.deepEqual(r.h7StatusNomination,{pid:424242,rawStatus:256});
    assert.deepEqual(r.sourceAfterH7Refusal,{phase:'burned',invalid:1,uncertain:0,disposalStarted:1,
      sealedClosureCount:12,attemptedCount:12,privateClosedCount:12,closedFlags:Array(12).fill(1)});
    assert.deepEqual(r.sourceAfterH7Repeats,r.sourceAfterH7Refusal);
    assert.deepEqual(r.events.filter(e=>e.op==='close'&&STAGED_CLOSE_ROLES.includes(e.role)).map(e=>e.role),
      STAGED_CLOSE_ROLES);
  });
const STAGED_CONFIGURATION_CASES=[
  ['config-dir-getfl-undefined','dir','getfl',1,'undefined'],
  ['config-dir-getfl-throw','dir','getfl',1,'throw'],
  ['config-dir-getfl-access','dir','getfl',1,'access'],
  ['config-dir-prefd-undefined','dir','prefd',2,'undefined'],
  ['config-dir-prefd-throw','dir','prefd',2,'throw'],
  ['config-dir-prefd-extra','dir','prefd',2,'extra'],
  ['config-dir-setfd-false','dir','setfd',3,'false'],
  ['config-dir-setfd-throw','dir','setfd',3,'throw'],
  ['config-dir-postfd-undefined','dir','postfd',4,'undefined'],
  ['config-dir-postfd-throw','dir','postfd',4,'throw'],
  ['config-dir-postfd-missing','dir','postfd',4,'missing'],
  ['config-file-getfl-undefined','file','getfl',1,'undefined'],
  ['config-file-getfl-throw','file','getfl',1,'throw'],
  ['config-file-getfl-access','file','getfl',1,'access'],
  ['config-file-getfl-nonblock','file','getfl',1,'nonblock'],
  ['config-file-prefd-undefined','file','prefd',2,'undefined'],
  ['config-file-prefd-throw','file','prefd',2,'throw'],
  ['config-file-prefd-extra','file','prefd',2,'extra'],
  ['config-file-setfd-false','file','setfd',3,'false'],
  ['config-file-setfd-throw','file','setfd',3,'throw'],
  ['config-file-postfd-undefined','file','postfd',4,'undefined'],
  ['config-file-postfd-throw','file','postfd',4,'throw'],
  ['config-file-postfd-missing','file','postfd',4,'missing'],
  ['config-file-binmode-false','file','binmode',4,'false'],
  ['config-file-binmode-throw','file','binmode',4,'throw'],
];
for(const [mode,part,cut,k,kind] of STAGED_CONFIGURATION_CASES)
  test('staged custody configuration denial disposes '+mode,()=>{
    const r=stagedCustody(mode),stage=part==='dir'?1:7,bin=cut==='binmode';
    assert.equal(r.refused,true);assert.equal(r.hold,null);
    assert.deepEqual(r.configurationNomination,{role:part==='dir'?'d0':'f0',cut,ordinal:k,kind,
      actualCoreCompleted:true});
    assert.equal(r.configurationQueueRemaining,0);
    const calls=part==='dir'?{clock:2,lstat:1,sysopen:1,fcntl:k,close:1}:
      {binmode:bin?49:48,clock:50,close:55,closedir:6,fcntl:30+k,fileno:156,fork:6,
        lstat:19,opendir:6,pipe:24,read:24,readdir:111,ready:12,stat:12,sysopen:7,wait:24};
    assert.deepEqual(r.calls,calls);
    assert.equal(Object.values(r.calls).reduce((n,v)=>n+v,0),part==='dir'?5+k:590+k+(bin?1:0));
    assert.equal(r.helpers,part==='dir'?0:6);
    assert.deepEqual([r.ownedCount,r.stageClosed,r.helperClosed],part==='dir'?[1,1,0]:[61,7,54]);
    assert.deepEqual(r.events.filter(e=>e.op==='close'&&STAGED_CLOSE_ROLES.includes(e.role)).map(e=>e.role),
      STAGED_CLOSE_ROLES.slice(0,stage));
    assert.deepEqual(r.sourceAfterConfigurationRefusal,{phase:'burned',invalid:1,uncertain:0,disposalStarted:1,
      sealedClosureCount:stage,attemptedCount:stage,privateClosedCount:stage,closedFlags:Array(stage).fill(1)});
    assert.deepEqual(r.sourceAfterConfigurationRepeats,r.sourceAfterConfigurationRefusal);
  });

function assertStagedByteNomination(r) {
  assert.deepEqual(r.byteNomination,{
    role:'f0',readOrdinal:25,bytes:5864,beforeFirstByte:112,afterFirstByte:113,
    beforeSha256:'85d8949dbcee9687b1d3f554edb6e39003394cb2fb125d64c50964daa1a04ff0',
    afterSha256:'ad8d8e9c43ebc67036de34379ea2e12658bbe2027314bd523fe29e942e633055',actualCoreRead:true,remainderUnchanged:true});
  assert.match(r.byteNomination.afterSha256,/^[a-f0-9]{64}$/);
  assert.notEqual(r.byteNomination.afterSha256,r.byteNomination.beforeSha256);
}
test('staged custody byte hash rejects altered consumer-visible actual read',()=>{
  const r=stagedCustody('file-byte-xor-denied');assertStagedByteNomination(r);
  assert.equal(r.refused,true);assert.equal(r.hold,null);
  assert.deepEqual(r.calls,{binmode:49,clock:52,close:55,closedir:6,fcntl:34,fileno:157,
    fork:6,lstat:20,opendir:6,pipe:24,read:26,readdir:111,ready:12,seek:1,stat:13,sysopen:7,wait:24});
  assert.equal(Object.values(r.calls).reduce((n,v)=>n+v,0),603);
  assert.deepEqual([r.helpers,r.ownedCount,r.stageClosed,r.helperClosed],[6,61,7,54]);
  assert.deepEqual(r.sourceAfterByteOperation,{phase:'burned',invalid:1,uncertain:0,disposalStarted:1,
    sealedClosureCount:7,attemptedCount:7,privateClosedCount:7,closedFlags:Array(7).fill(1)});
  assert.deepEqual(r.sourceAfterByteRepeats,r.sourceAfterByteOperation);
});
test('staged custody byte hash detects coherent digest-comparison removal',()=>{
  const source=replaceOnce(readFileSync(BOOTSTRAP,'utf8'),
    '    task6a_origin_refuse() unless $length==$record->{identity}[7]&&$digest->hexdigest eq $record->{sha256};',
    '    task6a_origin_refuse() unless $length==$record->{identity}[7];');
  const r=stagedCustody('file-byte-xor-mutant',0,{sourceOverride:source});assertStagedByteNomination(r);
  assert.equal(r.refused,false);assert.deepEqual(r.calls,STAGED_CLOSE_CALLS);
  assert.deepEqual([r.helpers,r.ownedCount,r.stageClosed,r.helperClosed],[42,390,12,378]);
  const diagnostic={scope:'staged-source-vendor-custody-diagnostic-only',
    productionAuthority:false,fileCount:6,directoryCount:6};
  assert.deepEqual(r.hold,diagnostic);assert.deepEqual(r.recheck,diagnostic);
  assert.deepEqual(r.release,{...diagnostic,handlesClosed:12});
  assert.deepEqual(r.sourceAfterByteOperation,{phase:'released',invalid:0,uncertain:0,disposalStarted:1,
    sealedClosureCount:12,attemptedCount:12,privateClosedCount:12,closedFlags:Array(12).fill(1)});
  assert.deepEqual(r.sourceAfterByteRepeats,{phase:'burned',invalid:1,uncertain:0,disposalStarted:1,
    sealedClosureCount:12,attemptedCount:12,privateClosedCount:12,closedFlags:Array(12).fill(1)});
  assert.throws(()=>assert.equal(r.refused,true),{code:'ERR_ASSERTION'});
});
const STAGED_METADATA_MAGIC_MODES=[
  'magic-dir-array',
  'magic-dir-record',
  'magic-dir-tuple',
  'magic-dir-path',
  'magic-dir-fh',
  'magic-dir-retained-record',
  'magic-dir-retained-tuple',
  'magic-file-array',
  'magic-file-record',
  'magic-file-tuple',
  'magic-file-path',
  'magic-file-fh',
  'magic-file-retained-record',
  'magic-file-retained-tuple',
  'magic-file-hash',
  'magic-file-element',
];
const STAGED_METADATA_MAGIC_ZERO={FETCHSIZE:0,FETCH:0,STORE:0,STORESIZE:0,EXTEND:0,
  PUSH:0,POP:0,SHIFT:0,UNSHIFT:0,CLEAR:0,EXISTS:0,DELETE:0,FIRSTKEY:0,NEXTKEY:0,SCALAR:0};
for(const mode of STAGED_METADATA_MAGIC_MODES)
  test('staged custody metadata magic rejects original graph for '+mode,()=>{
    const r=stagedCustody(mode);
    assert.equal(r.refused,false);assert.equal(r.recheckRefused,true);assert.equal(r.recheck,null);
    assert.deepEqual(r.magicMutation,{mode,changed:true});assert.deepEqual(r.magicRestoration,{restored:true});
    assert.deepEqual(r.calls,STAGED_HALF_BOUNDARY_CALLS);
    assert.equal(Object.values(r.calls).reduce((n,v)=>n+v,0),2574);
    assert.deepEqual([r.helpers,r.ownedCount,r.stageClosed,r.helperClosed],[24,228,12,216]);
    assert.equal(r.magicTiedRepeatDelta,0);
    assert.deepEqual(r.sourceBeforeMagic,{phase:'active',invalid:0,uncertain:0,disposalStarted:0,
      sealedClosureCount:12,attemptedCount:0,privateClosedCount:0,closedFlags:Array(12).fill(0)});
    const burned={phase:'burned',invalid:1,uncertain:0,disposalStarted:1,
      sealedClosureCount:12,attemptedCount:12,privateClosedCount:12,closedFlags:Array(12).fill(1)};
    for(const state of ['sourceAfterMagicRefusal','sourceAfterMagicTiedRepeats',
      'sourceAfterMagicRestoration','sourceAfterMagicRepeats']) assert.deepEqual(r[state],burned);
    const tied={factory:1,untie:0,destroy:0,callbacks:STAGED_METADATA_MAGIC_ZERO};
    assert.deepEqual(r.magicAfterRefusal,tied);assert.deepEqual(r.magicBeforeUntie,tied);
    const untied={factory:1,untie:1,destroy:1,callbacks:STAGED_METADATA_MAGIC_ZERO};
    assert.deepEqual(r.magicAfterUntie,untied);assert.deepEqual(r.magicAfterRestoredRepeats,untied);
    assert.deepEqual(r.events.filter(e=>e.op==='close'&&STAGED_CLOSE_ROLES.includes(e.role)).map(e=>e.role),
      STAGED_CLOSE_ROLES);
  });

const STAGED_ADMISSION_DRIFT_MODES=[
  'drift-copy-admission',
  'drift-copy-creator',
  'drift-copy-creation',
  'drift-copy-sources',
  'drift-copy-source-0',
  'drift-copy-source-1',
  'drift-copy-source-2',
  'drift-copy-source-3',
  'drift-copy-vendor',
  'drift-copy-selected',
  'drift-selected-detached',
  'drift-root',
  'drift-creation-inode',
  'drift-source-bytes-0',
  'drift-source-bytes-1',
  'drift-source-bytes-2',
  'drift-source-bytes-3',
  'drift-vendor-bytes',
  'drift-selected-bytes',
  'drift-extra',
];
for(const mode of STAGED_ADMISSION_DRIFT_MODES)
  test('staged custody admission drift rejects changed graph for '+mode,()=>{
    const r=stagedCustody(mode);
    assert.equal(r.refused,false);assert.equal(r.recheckRefused,true);assert.equal(r.recheck,null);
    assert.deepEqual(r.admissionDriftMutation,{mode,changed:true});
    assert.deepEqual(r.admissionDriftRestoration,{restored:true});
    assert.deepEqual(r.calls,STAGED_HALF_BOUNDARY_CALLS);
    assert.equal(Object.values(r.calls).reduce((n,v)=>n+v,0),2574);
    assert.deepEqual([r.helpers,r.ownedCount,r.stageClosed,r.helperClosed],[24,228,12,216]);
    assert.deepEqual(r.sourceBeforeAdmissionDrift,{phase:'active',invalid:0,uncertain:0,disposalStarted:0,
      sealedClosureCount:12,attemptedCount:0,privateClosedCount:0,closedFlags:Array(12).fill(0)});
    const burned={phase:'burned',invalid:1,uncertain:0,disposalStarted:1,
      sealedClosureCount:12,attemptedCount:12,privateClosedCount:12,closedFlags:Array(12).fill(1)};
    for(const state of ['sourceAfterAdmissionDrift','sourceAfterAdmissionDriftRestore',
      'sourceAfterAdmissionDriftRepeats']) assert.deepEqual(r[state],burned);
    assert.deepEqual(r.events.filter(e=>e.op==='close'&&STAGED_CLOSE_ROLES.includes(e.role)).map(e=>e.role),
      STAGED_CLOSE_ROLES);
  });

const STAGED_ADMISSION_MAGIC_MODES=[
  'amagic-current-admission',
  'amagic-current-creator',
  'amagic-current-creation',
  'amagic-current-sources',
  'amagic-current-source-0',
  'amagic-current-source-1',
  'amagic-current-source-2',
  'amagic-current-source-3',
  'amagic-current-vendor',
  'amagic-current-selected',
  'amagic-retained-admission',
  'amagic-retained-creator',
  'amagic-retained-creation',
  'amagic-retained-sources',
  'amagic-retained-source-0',
  'amagic-retained-source-1',
  'amagic-retained-source-2',
  'amagic-retained-source-3',
  'amagic-retained-vendor',
  'amagic-retained-selected',
];
for(const mode of STAGED_ADMISSION_MAGIC_MODES)
  test('staged custody admission magic rejects original graph for '+mode,()=>{
    const r=stagedCustody(mode);
    assert.equal(r.refused,false);assert.equal(r.recheckRefused,true);assert.equal(r.recheck,null);
    assert.deepEqual(r.admissionMagicMutation,{mode,changed:true});
    assert.deepEqual(r.admissionMagicRestoration,{restored:true});
    assert.deepEqual(r.calls,STAGED_HALF_BOUNDARY_CALLS);
    assert.equal(Object.values(r.calls).reduce((n,v)=>n+v,0),2574);
    assert.deepEqual([r.helpers,r.ownedCount,r.stageClosed,r.helperClosed],[24,228,12,216]);
    assert.equal(r.admissionMagicTiedRepeatDelta,0);
    assert.deepEqual(r.sourceBeforeAdmissionMagic,{phase:'active',invalid:0,uncertain:0,disposalStarted:0,
      sealedClosureCount:12,attemptedCount:0,privateClosedCount:0,closedFlags:Array(12).fill(0)});
    const burned={phase:'burned',invalid:1,uncertain:0,disposalStarted:1,
      sealedClosureCount:12,attemptedCount:12,privateClosedCount:12,closedFlags:Array(12).fill(1)};
    for(const state of ['sourceAfterAdmissionMagicRefusal','sourceAfterAdmissionMagicTiedRepeats',
      'sourceAfterAdmissionMagicRestoration','sourceAfterAdmissionMagicRepeats'])
      assert.deepEqual(r[state],burned);
    const tied={factory:1,untie:0,destroy:0,callbacks:STAGED_METADATA_MAGIC_ZERO};
    assert.deepEqual(r.admissionMagicAfterRefusal,tied);assert.deepEqual(r.admissionMagicBeforeUntie,tied);
    const untied={factory:1,untie:1,destroy:1,callbacks:STAGED_METADATA_MAGIC_ZERO};
    assert.deepEqual(r.admissionMagicAfterUntie,untied);
    assert.deepEqual(r.admissionMagicAfterRestoredRepeats,untied);
    assert.deepEqual(r.events.filter(e=>e.op==='close'&&STAGED_CLOSE_ROLES.includes(e.role)).map(e=>e.role),
      STAGED_CLOSE_ROLES);
  });
const STAGED_FIXTURE_ONLY_MODES=[
  'foreign-parent','foreign-physical','foreign-file','foreign-directory','hidden-open-undefined',
];
for(const mode of STAGED_FIXTURE_ONLY_MODES)
  test('staged custody fixture ownership rejects borrower or hidden original '+mode,()=>{
    const r=stagedCustody(mode);
    assert.equal(r.refused,true);assert.equal(r.hold,null);
    assert.deepEqual(r.calls,{clock:2,lstat:1,sysopen:1});
    assert.equal(r.events.length,4);
    assert.deepEqual(r.events.map(e=>e.op+':'+e.role),
      ['clock:startup','clock:stage','lstat:d0','sysopen:d0']);
    assert.deepEqual([r.helpers,r.rawAcquisitions,r.ownedCount,r.definitelyClosed,
      r.fixtureClosed,r.consumerClosed,r.stageClosed,r.helperClosed],[0,1,1,1,1,0,0,0]);
    assert.deepEqual(r.fixtureOwnerBeforeRescue,{live:true,sameFd:true,sameIdentity:true,
      attempted:0,closed:0});
    const burned={phase:'burned',invalid:1,uncertain:0,disposalStarted:1,
      sealedClosureCount:0,attemptedCount:0,privateClosedCount:0,closedFlags:[]};
    assert.deepEqual(r.sourceAfterFixtureRefusal,burned);
    assert.deepEqual(r.sourceAfterFixtureRepeats,burned);
    assert.equal(r.repeatEffectDelta,0);assert.equal(r.remainingOperations,0);
  });

for(const [mode,operation,arity] of [
  ['active-hold-again','hold',0],['active-recheck-arity','recheck',1],['active-release-arity','release',1],
])
  test('staged custody active entry refuses '+mode,()=>{
    const r=stagedCustody(mode);
    assert.equal(r.refused,false);
    assert.deepEqual(r.activeMisuse,{operation,arity,refused:true});
    assert.deepEqual(r.calls,STAGED_HALF_BOUNDARY_CALLS);
    assert.equal(Object.values(r.calls).reduce((n,v)=>n+v,0),2574);
    assert.deepEqual([r.helpers,r.ownedCount,r.stageClosed,r.helperClosed],[24,228,12,216]);
    assert.deepEqual(r.sourceBeforeActiveMisuse,{phase:'active',invalid:0,uncertain:0,disposalStarted:0,
      sealedClosureCount:12,attemptedCount:0,privateClosedCount:0,closedFlags:Array(12).fill(0)});
    const burned={phase:'burned',invalid:1,uncertain:0,disposalStarted:1,
      sealedClosureCount:12,attemptedCount:12,privateClosedCount:12,closedFlags:Array(12).fill(1)};
    assert.deepEqual(r.sourceAfterActiveMisuse,burned);
    assert.deepEqual(r.sourceAfterActiveMisuseRepeats,burned);
    assert.deepEqual(r.events.filter(e=>e.op==='close'&&STAGED_CLOSE_ROLES.includes(e.role)).map(e=>e.role),
      STAGED_CLOSE_ROLES);
    assert.equal(r.repeatEffectDelta,0);
  });

test('staged custody live fd alias rejects distinct GV without a second owner',()=>{
  const r=stagedCustody('foreign-fd-alias');
  assert.equal(r.refused,true);assert.equal(r.hold,null);
  assert.deepEqual(r.fdAliasBeforeConsumer,{nativeShapes:true,distinctGv:true,sameIo:true,
    sameFd:true,sameRef:false,rawAcquisitions:1});
  assert.deepEqual(r.fdAliasBeforeRescue,{bothLive:true,distinctGv:true,sameFd:true});
  assert.deepEqual(r.fdAliasAfterRescue,{bothUndefined:true,originalAttempts:1,rawAcquisitions:1});
  assert.deepEqual(r.calls,{clock:2,lstat:1,sysopen:1});assert.equal(r.events.length,4);
  assert.deepEqual([r.helpers,r.rawAcquisitions,r.ownedCount,r.definitelyClosed,
    r.fixtureClosed,r.consumerClosed,r.stageClosed,r.helperClosed],[0,1,1,1,1,0,0,0]);
  const burned={phase:'burned',invalid:1,uncertain:0,disposalStarted:1,
    sealedClosureCount:0,attemptedCount:0,privateClosedCount:0,closedFlags:[]};
  assert.deepEqual(r.sourceAfterFixtureRefusal,burned);
  assert.deepEqual(r.sourceAfterFixtureRepeats,burned);
  assert.equal(r.repeatEffectDelta,0);
});
test('staged custody live fd alias rejects an already sealed original reference',()=>{
  const r=stagedCustody('staged-reference-alias');
  assert.equal(r.refused,true);assert.equal(r.hold,null);
  assert.deepEqual(r.stagedAliasNomination,{sameRef:true,sameFd:true,newRawAcquisition:false});
  assert.deepEqual(r.calls,{binmode:8,clock:10,close:9,closedir:1,fcntl:5,fileno:26,
    fork:1,lstat:4,opendir:1,pipe:4,read:4,readdir:16,ready:2,stat:2,sysopen:2,wait:4});
  assert.equal(Object.values(r.calls).reduce((n,v)=>n+v,0),99);
  assert.deepEqual([r.helpers,r.ownedCount,r.stageClosed,r.helperClosed,r.fixtureClosed],[1,10,1,9,0]);
  const burned={phase:'burned',invalid:1,uncertain:0,disposalStarted:1,
    sealedClosureCount:1,attemptedCount:1,privateClosedCount:1,closedFlags:[1]};
  assert.deepEqual(r.sourceAfterStagedAliasRefusal,burned);
  assert.deepEqual(r.sourceAfterStagedAliasRepeats,burned);
  assert.deepEqual(r.events.filter(e=>e.op==='close'&&STAGED_CLOSE_ROLES.includes(e.role))
    .map(e=>e.role),['d0']);
  assert.equal(r.repeatEffectDelta,0);
});

const STAGED_IDENTITY_DENIALS=[
  ['identity-dir-pre-shape','lstat','d0',1,'length',2,0,0,0,3],
  ['identity-file-pre-type','lstat','f0',1,'type',50,6,6,60,588],
  ['identity-dir-open-owner','stat','d0',1,'owner',3,0,1,1,12],
  ['identity-file-open-inode','stat','f0',1,'inode',50,6,7,61,597],
  ['identity-dir-post-device','stat','d0',2,'device',9,1,1,10,95],
  ['identity-file-post-size','stat','f0',5,'size',125,13,12,129,1400],
];
for(const [mode,op,role,ordinal,field,clock,helpers,stage,owned,ports] of STAGED_IDENTITY_DENIALS)
  test('staged custody identity refuses projected drift '+mode,()=>{
    const r=stagedCustody(mode);assert.equal(r.refused,true);assert.equal(r.hold,null);
    const n=r.identityNomination;
    assert.deepEqual(Object.keys(n).sort(),['op','role','ordinal','field','before','after',
      'actualTupleLength','returnedTupleLength','settledHelpers','actualCoreMetadata'].sort());
    assert.deepEqual([n.op,n.role,n.ordinal,n.field,n.actualTupleLength,n.settledHelpers,
      n.actualCoreMetadata],[op,role,ordinal,field,13,helpers,true]);
    assert.equal(n.returnedTupleLength,field==='length'?12:13);
    if(field==='length') assert.deepEqual([n.before,n.after],[13,12]);
    else if(field==='type') assert.deepEqual([n.before&0o170000,n.after&0o170000],[0o100000,0o40000]);
    else {
      assert.ok(Number.isSafeInteger(n.before)&&Number.isSafeInteger(n.after));
      assert.equal(n.after,n.before+1);if(field==='owner') assert.deepEqual([n.before,n.after],[0,1]);
    }
    assert.equal(r.calls.clock,clock);
    assert.equal(Object.values(r.calls).reduce((v,n)=>v+n,0),ports);
    assert.deepEqual([r.helpers,r.ownedCount,r.stageClosed,r.helperClosed,r.fixtureClosed],
      [helpers,owned,stage,helpers*9,0]);
    const burned={phase:'burned',invalid:1,uncertain:0,disposalStarted:1,
      sealedClosureCount:stage,attemptedCount:stage,privateClosedCount:stage,
      closedFlags:Array(stage).fill(1)};
    assert.deepEqual(r.sourceAfterIdentityRefusal,burned);
    assert.deepEqual(r.sourceAfterIdentityRepeats,burned);
    assert.deepEqual(r.events.filter(e=>e.op==='close'&&STAGED_CLOSE_ROLES.includes(e.role))
      .map(e=>e.role),STAGED_CLOSE_ROLES.slice(0,stage));
    assert.equal(r.repeatEffectDelta,0);
    if(field==='size') assert.deepEqual(r.calls,{binmode:110,clock:125,close:116,closedir:13,
      fcntl:61,fileno:345,fork:13,lstat:50,opendir:13,pipe:52,read:66,readdir:300,ready:26,
      seek:7,stat:39,sysopen:12,wait:52});
  });

function stagedSharedRegistry(registered,settled,burned) {
  return {burned,registered,settled,unsettled:registered-settled,
    helpersSettled:!burned&&registered===settled,physicalOwnsLedgers:false};
}
function stagedSharedState(phase,invalid,closed) {
  return {phase,invalid,uncertain:0,disposalStarted:closed?1:0,sealedClosureCount:12,
    attemptedCount:closed?12:0,privateClosedCount:closed?12:0,closedFlags:Array(12).fill(closed?1:0)};
}
function assertStagedSharedEvidence(r,mutant) {
  assert.equal(r.refused,false);
  assert.deepEqual(r.sharedBeforeFailure,stagedSharedRegistry(24,24,false));
  assert.deepEqual(r.sharedAfterFailure,stagedSharedRegistry(25,24,true));
  assert.deepEqual(r.sharedCaptorOutcome,{returned:false,canonicalRefusal:true});
  assert.deepEqual(r.sharedCloseNominations,[
    {role:'h25.in-r',physicallyClosedBeforeThrow:true},
    {role:'h25.in-w',physicallyClosedBeforeThrow:true}]);
  assert.deepEqual(r.sharedStageAfterFailure,stagedSharedState('active',0,false));
  assert.deepEqual(r.sharedAfterRecheck,stagedSharedRegistry(mutant?43:25,mutant?42:24,true));
  assert.deepEqual(r.sharedStageAfterRecheck,stagedSharedState(mutant?'active':'burned',mutant?0:1,!mutant));
  assert.deepEqual(r.sharedAfterCleanup,stagedSharedState(mutant?'released':'burned',mutant?0:1,true));
  assert.deepEqual(r.sharedAfterRepeats,stagedSharedState('burned',1,true));
  assert.deepEqual([r.helpers,r.ownedCount,r.stageClosed,r.helperClosed,r.fixtureClosed],
    mutant?[43,399,12,387,0]:[25,237,12,225,0]);
  assert.deepEqual(r.calls,mutant?
    {binmode:350,clock:410,close:356,closedir:43,fcntl:91,fileno:1128,fork:43,lstat:132,
      opendir:43,pipe:172,read:228,readdir:1110,ready:84,seek:30,stat:120,sysopen:12,wait:169}:
    {binmode:206,clock:240,close:212,closedir:25,fcntl:73,fileno:654,fork:25,lstat:84,
      opendir:25,pipe:100,read:132,readdir:624,ready:48,seek:18,stat:72,sysopen:12,wait:97});
  assert.equal(Object.values(r.calls).reduce((n,v)=>n+v,0),mutant?4521:2647);
}
test('staged custody shared unsettled refuses a physically drained burned helper',()=>{
  const r=stagedCustody('shared-unsettled-baseline');assertStagedSharedEvidence(r,false);
  assert.equal(r.recheckRefused,true);assert.equal(r.recheck,null);
});
test('staged custody shared unsettled detects coherent settlement-guard removal',()=>{
  const old=String.raw`my $staged_require_live=sub {
    task6a_origin_refuse() if $staged_invalid||$staged_uncertain||$staged_disposal_started;
    $staged_vector->(\@staged_directories);$staged_vector->(\@staged_files);
    $staged_vector->(\@staged_originals);$staged_vector->(\@staged_record_checks);
    task6a_origin_refuse() unless task6a_origin_helpers_settled();
    $staged_check_admission->();`;
  const source=replaceOnce(readFileSync(BOOTSTRAP,'utf8'),old,
    old.replace('    task6a_origin_refuse() unless task6a_origin_helpers_settled();\n',''));
  const r=stagedCustody('shared-unsettled-mutant',0,{sourceOverride:source});
  assertStagedSharedEvidence(r,true);
  const diagnostic={scope:'staged-source-vendor-custody-diagnostic-only',
    productionAuthority:false,fileCount:6,directoryCount:6};
  assert.deepEqual(r.recheck,diagnostic);
  assert.deepEqual(r.release,{...diagnostic,handlesClosed:12});
  assert.throws(()=>assert.equal(r.recheckRefused,true),{code:'ERR_ASSERTION'});
});

function assertStagedEpochAclEvidence(r,mutant) {
  const row="-r--r--r--+ 1 root wheel 16 Jan 1 2026 /\n";
  assert.equal(r.refused,false);
  assert.deepEqual(r.epochAclPipeRow,{bytes:41,row});
  assert.deepEqual(r.epochAclActualReads,[{bytes:41,body:row},{bytes:0,body:''}]);
  assert.deepEqual(r.epochAclCaptorOutcome,{returned:true,out:row,err:'',status:0,reaped:true});
  assert.deepEqual(r.epochAclDrain,{jobCleared:true,helpersSettled:true});
  assert.deepEqual(r.epochAclBeforeRecheck,stagedSharedState('active',0,false));
  assert.deepEqual(r.epochAclAfterRecheck,stagedSharedState(mutant?'active':'burned',mutant?0:1,!mutant));
  assert.deepEqual(r.epochAclAfterCleanup,stagedSharedState(mutant?'released':'burned',mutant?0:1,true));
  assert.deepEqual(r.epochAclAfterRepeats,stagedSharedState('burned',1,true));
  assert.deepEqual([r.helpers,r.ownedCount,r.stageClosed,r.helperClosed,r.fixtureClosed],
    mutant?[42,390,12,378,0]:[25,237,12,225,0]);
  assert.deepEqual(r.calls,mutant?STAGED_CLOSE_CALLS:
    {binmode:206,clock:245,close:212,closedir:25,fcntl:73,fileno:662,fork:25,lstat:85,
      opendir:25,pipe:100,read:136,readdir:624,ready:50,seek:18,stat:73,sysopen:12,wait:100});
  assert.equal(Object.values(r.calls).reduce((n,v)=>n+v,0),mutant?4448:2671);
}
test('staged custody epoch ACL rejects actual captured plus row during recheck',()=>{
  const r=stagedCustody('epoch-acl-baseline');assertStagedEpochAclEvidence(r,false);
  assert.equal(r.recheckRefused,true);assert.equal(r.recheck,null);
});
test('staged custody epoch ACL detects coherent plus-accepting predicate mutant',()=>{
  const old=String.raw`    task6a_origin_refuse() unless $r->{out} =~ /\A[d-][rwxStTs-]{9}\@?[ ]+`;
  const source=replaceOnce(readFileSync(BOOTSTRAP,'utf8'),old,
    old.replace(String.raw`\@?`,String.raw`[\@+]?`));
  const r=stagedCustody('epoch-acl-mutant',0,{sourceOverride:source});
  assertStagedEpochAclEvidence(r,true);
  const diagnostic={scope:'staged-source-vendor-custody-diagnostic-only',
    productionAuthority:false,fileCount:6,directoryCount:6};
  assert.deepEqual(r.recheck,diagnostic);
  assert.deepEqual(r.release,{...diagnostic,handlesClosed:12});
  assert.throws(()=>assert.equal(r.recheckRefused,true),{code:'ERR_ASSERTION'});
});

function assertStagedPrimitivePhysical(r,mutant) {
  const diagnostic={scope:'staged-source-vendor-custody-diagnostic-only',
    productionAuthority:false,fileCount:6,directoryCount:6};
  assert.equal(r.refused,false);assert.deepEqual(r.hold,diagnostic);assert.deepEqual(r.recheck,diagnostic);
  assert.deepEqual(r.release,{...diagnostic,handlesClosed:12});
  assert.deepEqual(r.calls,{...STAGED_CLOSE_CALLS,close:mutant?349:348});
  assert.equal(Object.values(r.calls).reduce((n,v)=>n+v,0),mutant?4449:4448);
  assert.deepEqual([r.helpers,r.ownedCount,r.stageClosed,r.helperClosed,r.fixtureClosed],[42,390,12,378,0]);
  assert.deepEqual(r.onceAfterCleanup,stagedSharedState('released',0,true));
  assert.deepEqual(r.onceAfterRepeats,stagedSharedState('burned',1,true));
  const roles=r.events.filter(e=>e.op==='close'&&STAGED_CLOSE_ROLES.includes(e.role)).map(e=>e.role);
  assert.deepEqual(roles,mutant?['d0',...STAGED_CLOSE_ROLES]:STAGED_CLOSE_ROLES);
  return roles.length;
}
test('staged custody primitive once closes each captured original exactly once',()=>{
  const r=stagedCustody('once-primitive-baseline');
  assert.equal(assertStagedPrimitivePhysical(r,false),12);
  assert.equal(Object.hasOwn(r,'duplicatePrimitive'),false);
});
test('staged custody primitive once detects coherent double-call captured primitive',()=>{
  const source=replaceOnce(readFileSync(BOOTSTRAP,'utf8'),
    '    my $original_close=sub {close($fh)};',
    String.raw`    my $test_double_close=!@staged_originals;
    my $original_close=sub {
        my $first=close($fh);close($fh) if $test_double_close;return $first;
    };`);
  const r=stagedCustody('once-primitive-mutant',0,{sourceOverride:source});
  const actual=assertStagedPrimitivePhysical(r,true);
  const n=r.duplicatePrimitive;
  assert.deepEqual(Object.keys(n).sort(),['role','allowanceConsumed','actualCoreReturnedFalse',
    'filenoUndefined','firstPhysicalClosed','warningCount','errno','warnings'].sort());
  assert.deepEqual([n.role,n.allowanceConsumed,n.actualCoreReturnedFalse,n.filenoUndefined,n.firstPhysicalClosed],
    ['d0',true,true,true,true]);
  assert.ok(Number.isSafeInteger(n.errno)&&n.errno>=0);
  assert.ok(n.warningCount===0||n.warningCount===1);assert.equal(n.warnings.length,n.warningCount);
  for(const w of n.warnings) {
    assert.ok(Buffer.byteLength(w)<=256);
    assert.match(w,/^close\(\) on unopened filehandle [^\x00-\x1f\x7f]{1,96} at -e line [1-9][0-9]{0,5}\.\n$/);
  }
  assert.equal(actual,13);
  assert.throws(()=>assert.equal(actual,12),{code:'ERR_ASSERTION'});
});

const STAGED_DIRECTORY_FH_CORE_KEYS=['fileOpen','directoryOpen','directoryFhOpen','metadata','fileClose','directoryClose'];
const STAGED_DIRECTORY_FH_HEALTHY_TRACE=[
  'acquire:file','acquire:directory','binmode:file',
  'fcntl:file','fcntl:file','fcntl:file','fcntl:file',
  'fcntl:directory','fcntl:directory','fcntl:directory','fcntl:directory','fileno:file',
  'stat:file','lstat:file','stat:directory','lstat:directory',
  'seek:file','read:file','read:file','seek:file','read:file',
  'stat:file','lstat:file','stat:directory','lstat:directory',
  'close-attempt:directory','close-result:directory','close-attempt:file','close-result:file',
];
function assertDirectoryFhTrace(out,want) {
  assert.deepEqual(out.events.map(e=>e.op+':'+e.role),want);
  assert.deepEqual(out.events.map(e=>e.seq),want.map((_,i)=>i+1));
  for(const e of out.events) {
    assert.deepEqual(Object.keys(e).sort(),['op','role','seq']);
    assert.ok(Buffer.byteLength(JSON.stringify(e))<=512);
  }
}
test('staged directory FH ports retain actual directory handles and close original FH types',()=>{
  assert.equal(typeof stagedDirectoryFhPorts,'function','staged directory FH adapter missing');
  const out=stagedDirectoryFhPorts();
  assert.equal(out.directoryFhProfile,true);assert.equal(out.harnessFault,null);assert.equal(out.nominatedFault,null);
  assert.equal(out.containedSelfFault,false);assert.equal(out.dataMatched,true);assert.equal(out.aliasWitness,false);
  assert.equal(out.primaryError,'');assert.deepEqual(out.cleanupErrors,[]);
  assert.deepEqual([out.firstLength,out.eofLength,out.secondLength],[11684,0,11684]);
  assert.deepEqual(STAGED_FILE_CALL_KEYS.map(k=>out.calls[k]),[2,0,1,8,4,4,2,3,1,2,0]);
  assert.deepEqual(STAGED_DIRECTORY_FH_CORE_KEYS.map(k=>out.core[k]),[1,0,1,2,2,0]);
  assert.deepEqual([out.ownedCount,out.definitelyClosed,out.fixtureClosed],[2,2,2]);
  assert.deepEqual(out.closeOrder,['directory','file']);
  assert.deepEqual(out.remaining,{fcntl:0,stat:0,lstat:0,seek:0,read:0});
  assertDirectoryFhTrace(out,STAGED_DIRECTORY_FH_HEALTHY_TRACE);
});
for(const [mode,owned,core,calls,trace,matched,alias,primary,closeOrder,remainingFcntl] of [
  ['partial-acquisition',1,[1,0,0,1,1,0],[2,0,0,0,0,0,0,0,0,0,0],['acquire:file'],false,false,'fault',['file'],8],
  ['inspection-fault',2,[1,0,1,1,2,0],[2,0,0,0,0,0,0,0,0,0,0],['acquire:file','acquire:directory'],false,false,'fault',['file','directory'],8],
  ['alias',2,[1,0,1,2,2,0],[3,0,0,0,0,0,0,0,0,0,0],['acquire:file','acquire:directory','alias:directory'],false,true,'fault',['file','directory'],8],
  ['forbidden-path',2,[1,0,1,2,2,0],[3,0,0,0,0,0,0,0,0,0,0],['acquire:file','acquire:directory','denied:path'],false,false,'fault',['file','directory'],8],
  ['forbidden-flags',2,[1,0,1,2,2,0],[3,0,0,0,0,0,0,0,0,0,0],['acquire:file','acquire:directory','denied:flags'],false,false,'fault',['file','directory'],8],
  ['forbidden-exec',2,[1,0,1,2,2,0],[2,0,0,0,0,0,0,0,0,0,0],['acquire:file','acquire:directory','denied:external'],false,false,'fault',['file','directory'],8],
  ['caught-fault',2,[1,0,1,2,2,0],[2,0,0,0,0,0,0,0,0,0,0],['acquire:file','acquire:directory'],false,false,'fault',['file','directory'],8],
  ['configuration-fault',2,[1,0,1,2,2,0],[2,0,1,7,0,0,0,0,0,0,0],STAGED_DIRECTORY_FH_HEALTHY_TRACE.slice(0,10),false,false,'fault',['file','directory'],1],
  ['exhausted-read',2,[1,0,1,2,2,0],[2,0,1,8,4,4,2,3,1,0,0],STAGED_DIRECTORY_FH_HEALTHY_TRACE.slice(0,25),true,false,'fault',['file','directory'],0],
  ['overflow',2,[1,0,1,2,2,0],[2,0,0,0,0,0,0,0,0,0,0],['acquire:file','acquire:directory',...Array(94).fill('overflow:fixture')],false,false,'fault',['file','directory'],8],
  ['close-false',2,[1,0,1,2,2,0],[2,0,1,8,4,4,2,3,1,1,0],STAGED_DIRECTORY_FH_HEALTHY_TRACE.slice(0,27),true,false,'fault',['directory','file'],0],
  ['close-throw',2,[1,0,1,2,2,0],[2,0,1,8,4,4,2,3,1,1,0],STAGED_DIRECTORY_FH_HEALTHY_TRACE.slice(0,27),true,false,'close',['directory','file'],0],
  ['post-close-inspection-throw',2,[1,0,1,2,2,0],[2,0,1,8,4,4,2,3,1,1,0],STAGED_DIRECTORY_FH_HEALTHY_TRACE.slice(0,27),true,false,'inspection',['directory','file'],0],
]) test('staged directory FH ports contain '+mode+' without borrowing or leaking original handles',()=>{
  assert.equal(typeof stagedDirectoryFhPorts,'function','staged directory FH adapter missing');
  const out=stagedDirectoryFhPorts(mode);
  assert.equal(out.directoryFhProfile,true);assert.equal(out.containedSelfFault,true);
  assert.equal(out.harnessFault,'TEST_STAGED_FILE_PORT_HARNESS_FAULT');assert.equal(out.nominatedFault,mode);
  assert.equal(out.dataMatched,matched);assert.equal(out.aliasWitness,alias);
  assert.deepEqual([out.ownedCount,out.definitelyClosed,out.fixtureClosed],[owned,owned,owned]);
  assert.deepEqual(STAGED_DIRECTORY_FH_CORE_KEYS.map(k=>out.core[k]),core);
  assert.deepEqual(STAGED_FILE_CALL_KEYS.map(k=>out.calls[k]),calls);
  assert.deepEqual(out.closeOrder,closeOrder);assert.deepEqual(out.cleanupErrors,[]);
  assert.equal(out.primaryError,primary==='close'?'TEST_STAGED_FILE_PORT_NOMINATED_CLOSE_THROW\n'
    :primary==='inspection'?'TEST_STAGED_FILE_PORT_NOMINATED_INSPECTION_THROW\n':'TEST_STAGED_FILE_PORT_HARNESS_FAULT\n');
  assert.deepEqual(out.remaining,{fcntl:remainingFcntl,stat:matched?0:4,lstat:matched?0:4,seek:matched?0:2,read:matched?0:3});
  assert.deepEqual([out.firstLength,out.eofLength,out.secondLength],matched?[11684,0,11684]:[null,null,null]);
  assertDirectoryFhTrace(out,trace);
});
function stagedDirectoryFhPorts(mode='healthy') {
  const out=stagedFilePorts('directory-fh-'+mode);
  assert.equal(out.directoryFhProfile,true);return out;
}
function stagedFilePorts(mode='healthy') {
  assert.equal(typeof STAGED_FILE_PORT_PROGRAM,'string','staged readonly file adapter missing');
  const bytes=readFileSync(MAP);assert.equal(bytes.length,11684,'fixed ordinary map-data fixture changed');
  const directory=fileURLToPath(new URL('../',import.meta.url)).replace(/\/$/,'');
  const digest=createHash('sha256').update(bytes).digest('hex');
  const r=spawnSync('/usr/bin/perl',['-f','-e',STAGED_FILE_PORT_PROGRAM,fileURLToPath(MAP),directory,digest,mode],{
    cwd:'/',env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'},timeout:10000,maxBuffer:131072,
  });
  assert.equal(r.error,undefined);assert.equal(r.signal,null);
  assert.equal(r.status,0,r.stderr.toString());assert.equal(r.stderr.length,0);
  const out=JSON.parse(r.stdout);assert.equal(out.scope,'ordinary-staged-file-ports-fixture-only');
  assert.equal(out.productionAuthority,false);assert.equal(out.consumerInvoked,false);
  assert.equal(out.consumerClosed,0);assert.equal(out.portsReady,true);
  if(!mode.startsWith('directory-fh-')) {
    assert.equal(out.directoryFhProfile,false);assert.equal(out.core.directoryFhOpen,0);
  }
  return out;
}
const STAGED_FILE_CALL_KEYS=['sysopen','opendir','binmode','fcntl','stat','lstat','sysseek','sysread','fileno','close','closedir'];
const STAGED_FILE_CORE_KEYS=['fileOpen','directoryOpen','metadata','fileClose','directoryClose'];
test('staged readonly file ports retain seekable data and definite original closure',()=>{
  const out=stagedFilePorts();
  assert.equal(out.harnessFault,null);assert.equal(out.nominatedFault,null);
  assert.equal(out.containedSelfFault,false);assert.equal(out.dataMatched,true);assert.equal(out.aliasWitness,false);
  assert.equal(out.primaryError,'');assert.deepEqual(out.cleanupErrors,[]);
  assert.deepEqual([out.firstLength,out.eofLength,out.secondLength],[11684,0,11684]);
  assert.deepEqual(STAGED_FILE_CALL_KEYS.map(k=>out.calls[k]),[1,1,1,4,4,4,2,3,1,1,1]);
  assert.deepEqual(STAGED_FILE_CORE_KEYS.map(k=>out.core[k]),[1,1,2,1,1]);
  assert.deepEqual([out.ownedCount,out.definitelyClosed,out.fixtureClosed],[2,2,2]);
  assert.deepEqual(out.closeOrder,['file','directory']);
  assert.deepEqual(out.remaining,{fcntl:0,stat:0,lstat:0,seek:0,read:0});
  assert.equal(out.events.length,25);
  assert.deepEqual(out.events.filter(e=>e.op==='close-attempt').map(e=>e.role),['file','directory']);
});
for(const [mode,owned,core,calls,events,matched,alias,primary] of [
  ['partial-acquisition',1,[1,0,1,1,0],[1,1,0,0,0,0,0,0,0,0,0],1,false,false,'fault'],
  ['inspection-fault',1,[1,0,0,1,0],[1,0,0,0,0,0,0,0,0,0,0],1,false,false,'fault'],
  ['alias',2,[1,1,2,1,1],[2,1,0,0,0,0,0,0,0,0,0],3,false,true,'fault'],
  ['forbidden-path',2,[1,1,2,1,1],[2,1,0,0,0,0,0,0,0,0,0],3,false,false,'fault'],
  ['forbidden-flags',2,[1,1,2,1,1],[2,1,0,0,0,0,0,0,0,0,0],3,false,false,'fault'],
  ['forbidden-exec',2,[1,1,2,1,1],[1,1,0,0,0,0,0,0,0,0,0],3,false,false,'fault'],
  ['caught-fault',2,[1,1,2,1,1],[1,1,0,0,0,0,0,0,0,0,0],2,false,false,'fault'],
  ['exhausted-read',2,[1,1,2,1,1],[1,1,1,4,4,4,2,3,1,0,0],21,true,false,'fault'],
  ['overflow',2,[1,1,2,1,1],[1,1,0,0,0,0,0,0,0,0,0],96,false,false,'fault'],
  ['close-false',2,[1,1,2,1,1],[1,1,1,4,4,4,2,3,1,1,0],23,true,false,'fault'],
  ['close-throw',2,[1,1,2,1,1],[1,1,1,4,4,4,2,3,1,1,0],23,true,false,'close'],
  ['post-close-inspection-throw',2,[1,1,2,1,1],[1,1,1,4,4,4,2,3,1,1,0],23,true,false,'inspection'],
]) test('staged readonly file ports contain '+mode+' as fixture-only evidence',()=>{
  const out=stagedFilePorts(mode);
  assert.equal(out.containedSelfFault,true);assert.equal(out.harnessFault,'TEST_STAGED_FILE_PORT_HARNESS_FAULT');
  assert.equal(out.nominatedFault,mode);assert.equal(out.dataMatched,matched);assert.equal(out.aliasWitness,alias);
  assert.deepEqual([out.ownedCount,out.definitelyClosed,out.fixtureClosed],[owned,owned,owned]);
  assert.deepEqual(STAGED_FILE_CORE_KEYS.map(k=>out.core[k]),core);
  assert.deepEqual(STAGED_FILE_CALL_KEYS.map(k=>out.calls[k]),calls);
  assert.deepEqual(out.closeOrder,owned===1?['file']:['file','directory']);
  assert.equal(out.events.length,events);assert.deepEqual(out.cleanupErrors,[]);
  assert.equal(out.primaryError,primary==='close'?'TEST_STAGED_FILE_PORT_NOMINATED_CLOSE_THROW\n'
    :primary==='inspection'?'TEST_STAGED_FILE_PORT_NOMINATED_INSPECTION_THROW\n':'TEST_STAGED_FILE_PORT_HARNESS_FAULT\n');
  assert.deepEqual(out.remaining,matched?{fcntl:0,stat:0,lstat:0,seek:0,read:0}:{fcntl:4,stat:4,lstat:4,seek:2,read:3});
  assert.deepEqual([out.firstLength,out.eofLength,out.secondLength],matched?[11684,0,11684]:[null,null,null]);
});
function stagedCaptorPorts(mode='healthy') {
  assert.equal(typeof STAGED_CAPTOR_PORT_PROGRAM,'string','staged captor adapter missing');
  const r=systemObject('staged-captor-ports',{mode},'');
  assert.equal(r.status,0,r.stderr.toString());assert.equal(r.stderr.length,0);
  const out=JSON.parse(r.stdout);assert.equal(out.productionAuthority,false);
  assert.equal(out.syntheticCensus,true);return out;
}
test('staged captor cleanup throw closes remaining originals and burns helper',()=>{
  const out=stagedCaptorPorts('cleanup-close-throw');
  assert.equal(out.harnessFault,null);assert.equal(out.accepted,false);assert.equal(out.refused,true);
  assert.equal(out.consumerClosed,9);assert.equal(out.fixtureClosed,0);
  assert.equal(out.ownedCount,9);assert.equal(out.definitelyClosed,9);
  assert.equal(out.originalsPendingBeforeFinalizer,0);assert.equal(out.remainingWaits,0);
  assert.equal(out.captureError,'TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n');
  assert.equal(out.helpersSettled,false);
  assert.deepEqual(out.helpersObservation,{burned:true,registered:1,settled:0,unsettled:1});
  assert.deepEqual(out.helpersObservationRepeat,out.helpersObservation);
  assert.deepEqual(out.calls,{capture:1,pipe:4,binmode:8,fcntl:1,opendir:1,
    readdir:15,closedir:1,clock:4,fork:1,close:8,wait:1});
  assert.deepEqual(out.events.filter(e=>e.op==='nominated-false'||e.op==='nominated-throw')
    .map(e=>[e.op,e.role]),[['nominated-false','in-r'],['nominated-throw','in-w']]);
  assert.deepEqual(out.events.filter(e=>e.op==='wait')
    .map(e=>[e.pid,e.result,e.raw]),[[424242,424242,0]]);
  assert.deepEqual(out.events.filter(e=>e.op==='close-attempt')
    .map(e=>[e.role,e.owner]),[['census',0],['in-r',0],['in-w',0],['out-r',0],
      ['out-w',0],['err-r',0],['err-w',0],['setup-r',0],['setup-w',0]]);
});
test('staged captor foundation retains actual ACL capture and original closure',()=>{
  const out=stagedCaptorPorts();
  assert.equal(out.harnessFault,null);assert.equal(out.accepted,true);assert.equal(out.refused,false);
  assert.deepEqual(out.diagnostic,{scope:'acl-sample-diagnostic-only',productionAuthority:false});
  assert.deepEqual(out.captured,{out:'-r--r--r-- 1 root wheel 16 Jan 1 2026 /stage/entry.mjs\n',
    err:'',status:0,pid:424242,reaped:true});
  assert.equal(out.helpersSettled,true);
  assert.equal(out.ownedCount,9);assert.equal(out.definitelyClosed,9);
  assert.equal(out.consumerClosed,9);assert.equal(out.fixtureClosed,0);
  assert.deepEqual(out.calls,{capture:1,pipe:4,binmode:8,fcntl:1,opendir:1,
    readdir:15,closedir:1,clock:7,fork:1,close:8,ready:2,read:4,wait:4});
  const waits=out.events.filter(e=>e.op==='wait');
  assert.deepEqual(waits.map(e=>[e.pid,e.result,e.raw]),[[424242,0,0],[424242,0,0],
    [424242,0,0],[424242,424242,0]]);
  const acquired=out.events.filter(e=>e.op==='acquire');
  assert.deepEqual(acquired.map(e=>e.role),['in-r','in-w','out-r','out-w','err-r','err-w','setup-r','setup-w','census']);
  const own=acquired.find(e=>e.role==='census').fd;
  assert.equal(out.enumerated.includes(own),false);
  const pipes=acquired.filter(e=>e.role!=='census').map(e=>e.fd);
  assert.deepEqual(out.enumerated,[0,1,2,...pipes].sort((a,b)=>a-b));
  assert.deepEqual(out.events.filter(e=>e.op==='read').map(e=>[e.role,e.count,e.request]),
    [['out-r',55,65536],['err-r',0,65536],['setup-r',0,65536],['out-r',0,65536]]);
  assert.deepEqual(out.events.filter(e=>e.op==='close-attempt').map(e=>[e.role,e.owner]),
    [['census',0],['in-r',0],['in-w',0],['out-w',0],['err-w',0],['setup-w',0],
      ['err-r',0],['setup-r',0],['out-r',0]]);
});

for(const mode of ['malformed','extra-row','raw256']) {
  test('staged captor foundation refuses '+mode+' through actual consumer',()=>{
    const out=stagedCaptorPorts(mode);
    assert.equal(out.harnessFault,null);assert.equal(out.accepted,false);assert.equal(out.refused,true);
    assert.equal(out.diagnostic,null);assert.equal(out.helpersSettled,true);
    assert.equal(out.ownedCount,9);assert.equal(out.definitelyClosed,9);
    assert.equal(out.consumerClosed,9);assert.equal(out.fixtureClosed,0);
    assert.equal(out.calls.clock,mode==='raw256'?6:7);assert.equal(out.calls.wait,4);
    assert.equal(out.calls.close,8);assert.equal(out.calls.closedir,1);
    if(mode==='raw256') {
      assert.equal(out.captured,null);
      const last=out.events.filter(e=>e.op==='wait').at(-1);
      assert.deepEqual([last.pid,last.result,last.raw],[424242,424242,256]);
    } else {assert.equal(out.captured.reaped,true);assert.equal(out.captured.status,0);}
  });
}
for(const [mode,count] of [['census-duplicate',7],['census-noncanonical',6],['census-eio',6]]) {
  test('staged captor foundation refuses '+mode+' before synthetic fork',()=>{
    const out=stagedCaptorPorts(mode);
    assert.equal(out.harnessFault,null);assert.equal(out.accepted,false);assert.equal(out.refused,true);
    assert.equal(out.captured,null);assert.equal(out.enumerated,null);assert.equal(out.helpersSettled,false);
    assert.equal(out.calls.readdir,count);assert.equal(out.calls.clock,3);
    assert.equal(out.calls.fork,undefined);assert.equal(out.calls.wait,undefined);
    assert.equal(out.calls.read,undefined);assert.equal(out.calls.ready,undefined);
    assert.equal(out.ownedCount,9);assert.equal(out.consumerClosed,9);assert.equal(out.fixtureClosed,0);
    assert.equal(out.definitelyClosed,9);
  });
}
for(const [mode,owned,consumer,fixture] of [['inspection-fault',2,0,2],['partial-pipe',4,2,2],['overflow',6,4,2],
    ['forbidden',9,9,0],['forbidden-exec',9,9,0],['caught-fault',9,9,0]]) {
  test('staged captor foundation classifies '+mode+' as harness fault with original containment',()=>{
    const out=stagedCaptorPorts(mode);
    assert.equal(out.harnessFault,'TEST_STAGED_CAPTOR_HARNESS_FAULT');
    assert.equal(out.accepted,false);assert.equal(out.refused,false);assert.equal(out.diagnostic,null);
    assert.equal(out.ownedCount,owned);assert.equal(out.definitelyClosed,owned);
    assert.equal(out.consumerClosed,consumer);assert.equal(out.fixtureClosed,fixture);
    if(mode==='overflow') {assert.equal(out.events.length,8192);}
    if(mode==='forbidden') {assert.equal(out.events.filter(e=>e.op==='denied').length,1);}
    if(mode==='forbidden-exec') {assert.equal(out.events.filter(e=>e.op==='denied-exec').length,1);}
  });
}

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
test('cold bootstrap refuses before first module resolution',()=>{
  const r=coldEntryProbe(readFileSync(BOOTSTRAP,'utf8'));
  assert.equal(r.status,2,'entry reached candidate imports before refusal: '+r.stdout+r.stderr);
  assert.equal(r.stdout.length,0);
  assert.equal(r.stderr.toString(),'TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n');
});
for(const mode of ['omitted','after-first-import'])
  test('cold bootstrap exposes '+mode+' guard mutant',()=>{
    let source=replaceOnce(readFileSync(BOOTSTRAP,'utf8'),COLD_ENTRY_GUARD,'');
    if(mode==='after-first-import')
      source=replaceOnce(source,'use strict;\n','use strict;\n'+COLD_ENTRY_GUARD);
    const r=coldEntryProbe(source);
    assert.equal(r.status,64);
    assert.equal(r.stdout.toString(),'TEST_FORBIDDEN_IMPORT\n');
    assert.match(r.stderr.toString(),/^TEST_FORBIDDEN_IMPORT\n/);
    assert.doesNotMatch(r.stderr.toString(),/TASK6A_ORIGIN_BOOTSTRAP_REFUSED/);
  });
test('cold bootstrap declarations retain separate syntax verification',()=>{
  const original=readFileSync(BOOTSTRAP,'utf8');
  assert.ok(original.startsWith(COLD_ENTRY_GUARD));
  const source=replaceOnce(original,COLD_ENTRY_GUARD,'');
  const r=spawnSync('/usr/bin/perl',['-f','-c'],{
    input:source,cwd:'/',env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'},
    timeout:3000,maxBuffer:65536,
  });
  assert.equal(r.error,undefined);assert.equal(r.signal,null);assert.equal(r.status,0);
  assert.equal(r.stdout.length,0);assert.equal(r.stderr.toString(),'- syntax OK\n');
});
test('ordinary system supervisor refuses before source acquisition or private staging',()=>{
  assert.ok(existsSync(BOOTSTRAP),'system supervisor implementation missing');
  for(const flags of [[],['-c']]) {
    const r=spawnSync('/usr/bin/perl',['-f',...flags,fileURLToPath(BOOTSTRAP)],{cwd:'/',env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'},timeout:3000,maxBuffer:65536});
    assert.equal(r.error,undefined);assert.equal(r.signal,null);assert.equal(r.status,2);
    assert.equal(r.stdout.length,0);assert.equal(r.stderr.toString(),'TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n');
  }
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
  // Ordinary test only: replace the existing transport's exact policy site.
  // A distinct staged-owner policy occurrence must retain its official pin.
  const source=readFileSync(BOOTSTRAP,'utf8');
  const site=`my $pin='${VENDOR_PIN}';`;
  return replaceOnce(source,site,`my $pin='${SYNTHETIC_VENDOR_HASH}';`);
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
