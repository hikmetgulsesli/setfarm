import assert from 'node:assert/strict';
import {readFileSync,lstatSync,readdirSync,unlinkSync,rmdirSync,existsSync,chmodSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
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
const ARCHIVE_DECOY='task6a-origin-archive-v2.pmc';
function allowedArtifact(name) {return name===ARCHIVE_DECOY||NAMES.some(n=>name===n||name===n+'.original');}
function once(source,from,to) {
  assert.equal(source.split(from).length,2,`unique in-memory port: ${from}`);
  return source.replace(from,()=>to);
}
function archiveFixture() {
  const payload=Buffer.from('fixture-node-bytes'),header=Buffer.alloc(512);
  header.write('node-v22.23.1-darwin-arm64/bin/node');
  header.write('0000700\0',100);header.write('0000000\0',108);header.write('0000000\0',116);
  header.write(payload.length.toString(8).padStart(11,'0')+'\0',124);
  header.write('00000000000\0',136);header.fill(32,148,156);header.write('0',156);header.write('ustar\0'+'00',257);
  const sum=header.reduce((n,b)=>n+b,0);header.write(sum.toString(8).padStart(6,'0')+'\0 ',148);
  return gzipSync(Buffer.concat([header,payload,Buffer.alloc(512-payload.length),Buffer.alloc(1024)])).toString('base64');
}
function nativeFixture() {
  const commands=[[0xe,12,'/usr/lib/dyld'],[0xc,24,'/usr/lib/libSystem.B.dylib']].map(([kind,offset,name])=>{
    const bytes=Buffer.alloc(Math.ceil((offset+name.length+1)/8)*8);
    bytes.writeUInt32LE(kind,0);bytes.writeUInt32LE(bytes.length,4);bytes.writeUInt32LE(offset,8);bytes.write(name,offset);return bytes;
  });
  const table=Buffer.concat(commands),header=Buffer.alloc(32);
  [0xfeedfacf,0x0100000c,0,2,commands.length,table.length,0x200000,0].forEach((n,i)=>header.writeUInt32LE(n,4*i));
  return Buffer.concat([header,table]).toString('base64');
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
    for(const name of names)assert.ok(allowedArtifact(name));
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
      assert.ok(allowedArtifact(name));
      const file=path+'/source/'+name,s=lstatSync(file);assert.ok(s.isFile()&&!s.isSymbolicLink());
      assert.equal(s.uid,process.getuid());assert.equal(s.gid,0);assert.equal(s.nlink,1);
      const bytes=readFileSync(file);const expected=name===ARCHIVE_DECOY?Buffer.from('die "TEST_PMC_SELECTED\\n";\n')
        :readFileSync(new URL('../'+name.replace(/\.original$/,''),import.meta.url));
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
  const policy=mode.startsWith('policy-');
  const initialize=mode.startsWith('initialize-')||policy;
  if(policy)assert.ok(/sub task6a_origin_initialize_created_policy_helpers \{/.test(source),
    'created policy helpers interface is not implemented');
  if(initialize)assert.ok(/sub task6a_origin_initialize_created_archive_helper \{/.test(source),
    'created archive initializer interface is not implemented');
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
  if(initialize) {
    source=once(source,'$creator_epoch->();\n        my $result=eval $bytes;',
      '$creator_epoch->();$test_late_mutate->();\n        my $result=eval $bytes;');
    source=once(source,'my $result=eval $bytes;',
      'my $result=eval {test_creator_eval($bytes)};');
  }
  if(policy) {
    source=once(source,'my $native_result=eval $native_bytes;',
      "$test_policy_late_mutate->('native');my $native_result=eval {test_creator_policy_eval('native',$native_bytes)};");
    source=once(source,'my $map_result=eval $map_bytes;',
      "$test_policy_late_mutate->('map');my $map_result=eval {test_creator_policy_eval('map',$map_bytes)};");
  }
  if(mutant)source=mutant(source);
  const prefix=String.raw`
BEGIN { @INC=('/System/Library/Perl/5.34/darwin-thread-multi-2level','/System/Library/Perl/5.34'); }
use strict; use warnings; use MIME::Base64 (); use JSON::PP (); use Fcntl ();
my $test_mode=$ARGV[0];my @test_events;my @test_roots;my %test_paths;my @test_handles;
my ($test_file_opens,$test_writes,$test_reads,$test_armed)=(0,0,0,0);
my $test_borrowed;my $test_fault_fd;my $test_invalidate;my $test_magic_fetches=0;
my $test_evals=0;
my $test_late_mutate;
my $test_initializer_callbacks=0;
my %test_policy_evals=(native=>0,map=>0);my ($test_policy_drift,$test_policy_late_mutate);
{ package TestCreatorMagic;
  sub TIESCALAR {bless {fh=>$_[1]},$_[0]}
  sub FETCH {++$test_magic_fetches;return $_[0]{fh};}
}
{ package TestInitializerHash;
  sub TIEHASH {bless {original=>$_[1]},$_[0]}
  sub FETCH {++$test_initializer_callbacks;die "TEST_INITIALIZER_CALLBACK_REACHED\n" if $test_mode eq 'policy-post-native-cache-tied';return $_[0]{original}{$_[1]};}
  sub EXISTS {++$test_initializer_callbacks;die "TEST_INITIALIZER_CALLBACK_REACHED\n";}
  sub FIRSTKEY {++$test_initializer_callbacks;my $x=keys %{$_[0]{original}};each %{$_[0]{original}};}
  sub NEXTKEY {++$test_initializer_callbacks;each %{$_[0]{original}};}
  sub STORE {++$test_initializer_callbacks;$_[0]{original}{$_[1]}=$_[2];}
}
{ package TestInitializerScalar;
  sub TIESCALAR {bless {},$_[0]}
  sub FETCH {++$test_initializer_callbacks;die "TEST_INITIALIZER_CALLBACK_REACHED\n" if $test_mode=~/\Apolicy-/;return 'TEST_CALLBACK_VALUE';}
  sub STORE {++$test_initializer_callbacks;}
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
sub test_creator_eval {
    my ($bytes)=@_;++$test_evals;
    my $result=eval $bytes;my $error=$@;
    die $error if length($error);
    if($test_mode=~/\Ainitialize-(?:false|throw|expired|unsettled|foreign)\z/) {
        $test_armed=1;push @test_events,['armed',$test_mode,$test_evals];
        die "TEST_LOST_EVAL_RESPONSE\n" if $test_mode eq 'initialize-throw';
        return 0 if $test_mode eq 'initialize-false';
        $test_invalidate->();
    }
    return $result;
}
sub test_creator_policy_eval {
    my ($kind,$bytes)=@_;++$test_policy_evals{$kind};
    my $result=eval $bytes;my $error=$@;die $error if length($error);
    if($test_mode eq 'policy-'.$kind.'-false'||$test_mode eq 'policy-'.$kind.'-throw') {
        $test_armed=1;push @test_events,['armed',$test_mode,$kind];
        die "TEST_LOST_POLICY_EVAL_RESPONSE\n" if $test_mode eq 'policy-'.$kind.'-throw';return 0;
    }
    if($test_mode=~/\Apolicy-(native|map)-(expired|unsettled|foreign)\z/&&$kind eq $1) {
        $test_invalidate->();$test_armed=1;push @test_events,['armed',$test_mode,$kind];
    }
    $test_policy_drift->() if $kind eq 'native'&&$test_mode=~/\Apolicy-post-native-/;
    return $result;
}
`;
  const bodies=NAMES.map(name=>readFileSync(new URL('../'+name,import.meta.url)).toString('base64'));
  const suffix=String.raw`
$test_invalidate=sub {
    $bootstrap_deadline=0 if $test_mode eq 'expired-write'||$test_mode eq 'initialize-expired'||$test_mode=~/\Apolicy-(native|map)-expired\z/;
    push @helper_ledger,{settled=>0} if $test_mode eq 'unsettled-write'||$test_mode eq 'initialize-unsettled'||$test_mode=~/\Apolicy-(native|map)-unsettled\z/;
    $staged_phase='active' if $test_mode eq 'foreign-write'||$test_mode eq 'initialize-foreign'||$test_mode=~/\Apolicy-(native|map)-foreign\z/;
};
$test_policy_drift=sub {
    eval 'package Task6aOriginMapV2;sub decoy {1};1;' or die $@ if $test_mode eq 'policy-post-native-namespace';
    delete $INC{'JSON/PP.pm'} if $test_mode eq 'policy-post-native-cache-missing';
    $INC{'JSON/PP.pm'}='/System/Library/Perl/5.34/darwin-thread-multi-2level/JSON/PP.pm' if $test_mode eq 'policy-post-native-cache-replaced';
    tie $INC{'JSON/PP.pm'},'TestInitializerScalar' if $test_mode eq 'policy-post-native-cache-magic';
    if($test_mode eq 'policy-post-native-cache-tied') {my %saved=%INC;tie %INC,'TestInitializerHash',\%saved;}
    $test_armed=1;push @test_events,['armed',$test_mode,'native'];
};
$test_policy_late_mutate=sub {
    my ($kind)=@_;
    if($test_mode eq 'policy-late-'.$kind) {
        if($kind eq 'native') {$creator_native_readback='die "TEST_LATE_NATIVE\n";';}
        else {$creator_map_readback='die "TEST_LATE_MAP\n";';}
        $test_armed=1;push @test_events,['armed',$test_mode,$kind];
    }
};
my $test_map_fixture;{local $/;$test_map_fixture=<STDIN>;}
$test_late_mutate=sub {
    if($test_mode eq 'initialize-late-drift') {
        $creator_archive_readback='package Task6aOriginArchiveV2;sub extract_node_v2 {"TEST_UNCHECKED_BYTES"};1;';
        $test_armed=1;push @test_events,['armed','initialize-late-drift'];
    }
};
my @test_bodies=map {MIME::Base64::decode_base64($_)} @ARGV[1..4];
my @test_roles=('archive-helper','native-helper','map-helper','entry');
my ($test_ok,$test_error,$test_diagnostic);
my ($test_init_diagnostic,$test_init_phase,$test_private_code,$test_cv_class,$test_cv_file,$test_fixture_result);
my $test_archive_uses=0;
my ($test_policy_diagnostic,$test_native_result,$test_map_result);my $test_policy_uses=0;
$test_ok=eval {
    task6a_origin_create_source_root();
    task6a_origin_initialize_created_archive_helper() if $test_mode eq 'initialize-premature';
    task6a_origin_initialize_created_policy_helpers() if $test_mode eq 'policy-premature';
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
    if($test_mode=~/\Ainitialize-/) {
        if($test_mode eq 'initialize-corrupt-readback') {substr($creator_archive_readback,0,1)='!';$test_armed=1;}
        if($test_mode eq 'initialize-corrupt-commitment') {$creator_archive_commitment='0'x64;$test_armed=1;}
        if($test_mode eq 'initialize-substituted-readback') {
            $creator_archive_readback='package Task6aOriginArchiveV2;sub extract_node_v2 {"fixture-node-bytes"};1;';
            $creator_archive_commitment=Digest::SHA::sha256_hex($creator_archive_readback);$test_armed=1;
        }
        if($test_mode eq 'initialize-namespace') {eval 'package Task6aOriginArchiveV2; sub decoy {1};1;' or die $@;$test_armed=1;}
        if($test_mode eq 'initialize-gunzip-namespace') {eval 'package IO::Uncompress::Gunzip; sub decoy {1};1;' or die $@;$test_armed=1;}
        if($test_mode eq 'initialize-cache') {$INC{'IO/Uncompress/Gunzip.pm'}='TEST_ALREADY_LOADED';$test_armed=1;}
        if($test_mode eq 'initialize-tied-cache') {my %saved=%INC;tie %INC,'TestInitializerHash',\%saved;$test_armed=1;}
        if($test_mode eq 'initialize-magical-namespace-value') {
            tie $main::{'Task6aOriginArchiveV2::'},'TestInitializerScalar';$test_armed=1;
        }
        if($test_mode eq 'initialize-tied-namespace') {
            eval 'package IO::Uncompress;sub decoy{1};1;' or die $@;
            my $table;{no strict 'refs';$table=*{'IO::Uncompress::'}{HASH};}
            my %saved=%$table;tie %$table,'TestInitializerHash',\%saved;$test_armed=1;
        }
        if($test_mode eq 'initialize-root') {
            CORE::rename($creator_root,$creator_root.'.original') or die "TEST_ROOT_RENAME\n";
            my @old=CORE::lstat($creator_root.'.original');
            push @test_roots,{path=>$creator_root.'.original',dev=>$old[0],ino=>$old[1]};
            CORE::mkdir($creator_root,0700) or die "TEST_ROOT_NEW\n";
            CORE::mkdir($creator_root.'/source',0555) or die "TEST_SOURCE_NEW\n";$test_armed=1;
        }
        my $archive_path=$creator_root.'/source/task6a-origin-archive-v2.pm';
        if($test_mode eq 'initialize-inode') {
            CORE::chmod(0700,$creator_root.'/source')==1 or die "TEST_DIR_MODE\n";
            CORE::rename($archive_path,$archive_path.'.original') or die "TEST_INIT_RENAME\n";
            CORE::sysopen(my $new,$archive_path,Fcntl::O_RDWR()|Fcntl::O_CREAT()|Fcntl::O_EXCL(),0600) or die "TEST_INIT_OPEN\n";
            CORE::syswrite($new,$test_bodies[0],length($test_bodies[0]))==length($test_bodies[0]) or die "TEST_INIT_WRITE\n";
            CORE::chmod(0400,$new)==1 or die "TEST_INIT_MODE\n";CORE::close($new) or die "TEST_INIT_CLOSE\n";
            CORE::chmod(0555,$creator_root.'/source')==1 or die "TEST_DIR_MODE\n";$test_armed=1;
        }
        if($test_mode eq 'initialize-disk-drift') {
            CORE::chmod(0600,$archive_path)==1 or die "TEST_INIT_MODE\n";
            CORE::sysopen(my $disk,$archive_path,Fcntl::O_WRONLY()|Fcntl::O_NOFOLLOW(),0) or die "TEST_INIT_OPEN\n";
            my $bad='!'x length($test_bodies[0]);
            CORE::syswrite($disk,$bad,length($bad))==length($bad) or die "TEST_INIT_WRITE\n";
            CORE::chmod(0400,$disk)==1 or die "TEST_INIT_MODE\n";CORE::close($disk) or die "TEST_INIT_CLOSE\n";$test_armed=1;
        }
        if($test_mode eq 'initialize-pmc') {
            CORE::chmod(0700,$creator_root.'/source')==1 or die "TEST_DIR_MODE\n";
            CORE::sysopen(my $decoy,$creator_root.'/source/task6a-origin-archive-v2.pmc',Fcntl::O_WRONLY()|Fcntl::O_CREAT()|Fcntl::O_EXCL(),0600) or die "TEST_PMC_OPEN\n";
            my $bytes='die "TEST_PMC_SELECTED\n";' . "\n";
            CORE::syswrite($decoy,$bytes,length($bytes))==length($bytes) or die "TEST_PMC_WRITE\n";
            CORE::chmod(0400,$decoy)==1 or die "TEST_PMC_MODE\n";CORE::close($decoy) or die "TEST_PMC_CLOSE\n";
            CORE::chmod(0555,$creator_root.'/source')==1 or die "TEST_DIR_MODE\n";$test_armed=1;
        }
        $test_init_diagnostic=task6a_origin_initialize_created_archive_helper();
        $test_init_phase=$creator_archive_phase;$test_private_code=ref($creator_archive_original);
        my $cv=B::svref_2object($creator_archive_original);$test_cv_class=ref($cv);$test_cv_file=$cv->FILE;
        task6a_origin_initialize_created_archive_helper() if $test_mode eq 'initialize-duplicate';
        task6a_origin_initialize_created_archive_helper('unexpected') if $test_mode eq 'initialize-arity';
        ++$test_archive_uses;$test_fixture_result=$creator_archive_original->(MIME::Base64::decode_base64($ARGV[5]));
    }
    if($test_mode=~/\Apolicy-/) {
        task6a_origin_initialize_created_archive_helper() unless $test_mode eq 'policy-missing-archive';
        $creator_native_readback.='changed' if $test_mode eq 'policy-native-corrupt';
        $creator_map_readback.='changed' if $test_mode eq 'policy-map-corrupt';
        $creator_native_commitment='0'x64 if $test_mode eq 'policy-native-commitment';
        $creator_map_commitment='0'x64 if $test_mode eq 'policy-map-commitment';
        if($test_mode eq 'policy-native-substituted') {$creator_native_readback.="\n# TEST_UNREVIEWED\n";$creator_native_commitment=Digest::SHA::sha256_hex($creator_native_readback);}
        if($test_mode eq 'policy-map-substituted') {$creator_map_readback.="\n# TEST_UNREVIEWED\n";$creator_map_commitment=Digest::SHA::sha256_hex($creator_map_readback);}
        eval 'package Task6aOriginNativeV2;sub decoy {1};1;' or die $@ if $test_mode eq 'policy-native-namespace';
        eval 'package Task6aOriginMapV2;sub decoy {1};1;' or die $@ if $test_mode eq 'policy-map-namespace';
        delete $INC{'JSON/PP.pm'} if $test_mode eq 'policy-cache-missing';
        $INC{'JSON/PP.pm'}='/System/Library/Perl/5.34/JSON/../JSON/PP.pm' if $test_mode eq 'policy-cache-escape';
        $INC{'JSON/PP.pm'}='/System/Library/Perl/5.34-extra/JSON/PP.pm' if $test_mode eq 'policy-cache-prefix';
        $INC{'JSON/PP.pm'}=[] if $test_mode eq 'policy-cache-reference';
        $INC{'JSON/PP.pm'}='' if $test_mode eq 'policy-cache-empty';
        $INC{'JSON/PP.pm'}='a'x4097 if $test_mode eq 'policy-cache-oversized';
        $INC{'JSON/PP.pm'}="\x{100}" if $test_mode eq 'policy-cache-utf8';
        tie $INC{'JSON/PP.pm'},'TestInitializerScalar' if $test_mode eq 'policy-cache-magic';
        if($test_mode eq 'policy-cache-tied') {my %saved=%INC;tie %INC,'TestInitializerHash',\%saved;}
        if($test_mode eq 'policy-disk-drift') {
            my $path=$creator_root.'/source/task6a-origin-native-v2.pm';
            CORE::chmod(0600,$path)==1 or die "TEST_POLICY_MODE\n";
            CORE::sysopen(my $disk,$path,Fcntl::O_WRONLY()|Fcntl::O_NOFOLLOW(),0) or die "TEST_POLICY_OPEN\n";
            my $bad='!'x length($test_bodies[1]);CORE::syswrite($disk,$bad,length($bad))==length($bad) or die "TEST_POLICY_WRITE\n";
            CORE::chmod(0400,$disk)==1 or die "TEST_POLICY_MODE\n";CORE::close($disk) or die "TEST_POLICY_CLOSE\n";
        }
        if($test_mode=~/\Apolicy-(native|map)-inode\z/) {
            my $index=$1 eq 'native'?1:2;
            my $path=$creator_root.'/source/'.($index==1?'task6a-origin-native-v2.pm':'task6a-origin-map-v2.pm');
            CORE::chmod(0700,$creator_root.'/source')==1 or die "TEST_POLICY_DIR_MODE\n";
            CORE::rename($path,$path.'.original') or die "TEST_POLICY_RENAME\n";
            CORE::sysopen(my $replacement,$path,Fcntl::O_WRONLY()|Fcntl::O_CREAT()|Fcntl::O_EXCL(),0600) or die "TEST_POLICY_OPEN\n";
            CORE::syswrite($replacement,$test_bodies[$index],length($test_bodies[$index]))==length($test_bodies[$index]) or die "TEST_POLICY_WRITE\n";
            CORE::chmod(0400,$replacement)==1 or die "TEST_POLICY_MODE\n";CORE::close($replacement) or die "TEST_POLICY_CLOSE\n";
            CORE::chmod(0555,$creator_root.'/source')==1 or die "TEST_POLICY_DIR_MODE\n";
        }
        if($test_mode eq 'policy-root') {
            CORE::rename($creator_root,$creator_root.'.original') or die "TEST_POLICY_ROOT_RENAME\n";
            my @old=CORE::lstat($creator_root.'.original');push @test_roots,{path=>$creator_root.'.original',dev=>$old[0],ino=>$old[1]};
            CORE::mkdir($creator_root,0700) or die "TEST_POLICY_ROOT_NEW\n";
            CORE::mkdir($creator_root.'/source',0555) or die "TEST_POLICY_SOURCE_NEW\n";
        }
        $test_armed=1 if $test_mode=~/\Apolicy-(?:native-(?:corrupt|commitment|namespace|substituted|inode)|map-(?:corrupt|commitment|namespace|substituted|inode)|cache-|disk-drift|root)/;
        $test_policy_diagnostic=task6a_origin_initialize_created_policy_helpers();
        task6a_origin_initialize_created_policy_helpers() if $test_mode eq 'policy-duplicate';
        task6a_origin_initialize_created_policy_helpers('unexpected') if $test_mode eq 'policy-arity';
        ++$test_policy_uses;$test_native_result=$creator_native_original->(MIME::Base64::decode_base64($ARGV[6]));
        ++$test_policy_uses;$test_map_result=$creator_map_original->($test_map_fixture,77777);
    }
    $test_diagnostic=task6a_origin_release_source_creator();
    task6a_origin_release_source_creator() if $test_mode eq 'duplicate-release';
    1;
};$test_error=$@;my $test_terminal_phase=$creator_phase;
my ($test_init_retry,$test_init_retry_error);
if($test_mode=~/\Ainitialize-/&&!$test_ok) {
    $test_init_retry=eval {task6a_origin_initialize_created_archive_helper();1;};$test_init_retry_error=$@;
}
my ($test_policy_retry,$test_policy_retry_error);
if($test_mode=~/\Apolicy-/&&!$test_ok) {
    $test_policy_retry=eval {task6a_origin_initialize_created_policy_helpers();1;};$test_policy_retry_error=$@;
}
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
    magicFetches=>$test_magic_fetches,evals=>$test_evals,initDiagnostic=>$test_init_diagnostic,
    initPhase=>$test_init_phase,privateCode=>$test_private_code,cvClass=>$test_cv_class,cvFile=>$test_cv_file,
    finalInitPhase=>$creator_archive_phase,finalPrivateCode=>ref($creator_archive_original),fixtureResult=>$test_fixture_result,
    archiveUses=>$test_archive_uses,initRetry=>$test_init_retry?JSON::PP::true:JSON::PP::false,initRetryError=>$test_init_retry_error,
    # Do not navigate the deliberately magical namespace for a diagnostic.
    archiveDefined=>$test_mode eq 'initialize-magical-namespace-value'?undef:
      UNIVERSAL::can('Task6aOriginArchiveV2','extract_node_v2')?JSON::PP::true:JSON::PP::false,
    initializerCallbacks=>$test_initializer_callbacks,
    policyEvals=>\%test_policy_evals,policyUses=>$test_policy_uses,policyDiagnostic=>$test_policy_diagnostic,
    policyPhase=>$creator_policy_phase,privateNative=>ref($creator_native_original),privateMap=>ref($creator_map_original),
    nativeDefined=>UNIVERSAL::can('Task6aOriginNativeV2','assert_node_native_v2')?JSON::PP::true:JSON::PP::false,
    mapDefined=>UNIVERSAL::can('Task6aOriginMapV2','parse_map_v2')?JSON::PP::true:JSON::PP::false,
    nativeResult=>$test_native_result,mapResult=>$test_map_result,policyRetry=>$test_policy_retry?JSON::PP::true:JSON::PP::false,policyRetryError=>$test_policy_retry_error,
    armed=>$test_armed?JSON::PP::true:JSON::PP::false,faultFD=>$test_fault_fd,
    fileOpens=>$test_file_opens,writes=>$test_writes,reads=>$test_reads});
`;
  const r=spawnSync('/usr/bin/perl',['-f','-e',prefix+source+suffix,mode,...bodies,archiveFixture(),nativeFixture()],{
    cwd:'/',env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'},timeout:10000,maxBuffer:1048576,encoding:'utf8',
    input:policy?readFileSync(new URL('./fixtures/task6a-origin-vmmap-interleaved-v2.txt',import.meta.url)):Buffer.alloc(0),
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

test('created archive initializer actual completed-readback controls',{skip:!ordinary},async t=>{
  for(const mode of ['initialize-healthy','initialize-disk-drift','initialize-pmc','initialize-late-drift'])await t.test(`${mode} initializes original bytes once before fixture extraction`,()=>{
    const out=invoke(mode);assert.equal(out.ok,true,JSON.stringify(out));assert.equal(out.evals,1);
    assert.equal(out.initPhase,'initialized');assert.equal(out.privateCode,'CODE');assert.equal(out.cvClass,'B::CV');
    assert.match(out.cvFile,/^\(eval \d+\)$/);assert.equal(out.archiveDefined,true);
    assert.equal(out.fixtureResult,'fixture-node-bytes');
    assert.deepEqual(out.initDiagnostic,{scope:'created-archive-helper-initializer-diagnostic-only',productionAuthority:false,initialized:true});
    assert.equal(out.phase,'released');assert.deepEqual(out.live,[]);assert.deepEqual(out.actualLive,[]);
    assert.equal(out.events.filter(x=>x[0]==='close').length,10);
    if(mode==='initialize-disk-drift') {assert.equal(out.armed,true);assert.equal(out.artifacts[0].files.find(x=>x.name===NAMES[0]).exact,false);}
    if(mode==='initialize-pmc') {assert.equal(out.armed,true);assert.equal(out.artifacts[0].files.find(x=>x.name===ARCHIVE_DECOY).exact,true);}
    if(mode==='initialize-late-drift') {assert.equal(out.armed,true);assert.ok(out.events.some(x=>x[0]==='armed'&&x[1]===mode));}
  });
  for(const mode of ['initialize-premature','initialize-corrupt-readback','initialize-corrupt-commitment','initialize-substituted-readback',
    'initialize-namespace','initialize-gunzip-namespace','initialize-cache','initialize-inode','initialize-root',
    'initialize-tied-cache','initialize-magical-namespace-value','initialize-tied-namespace'])await t.test(`${mode} refuses before actual evaluation`,()=>{
    const out=invoke(mode);refused(out);assert.equal(out.evals,0);assert.equal(out.finalInitPhase,'burned');
    assert.equal(out.finalPrivateCode,'');assert.equal(out.archiveDefined,mode==='initialize-magical-namespace-value'?null:false);assert.equal(out.initDiagnostic,null);
    assert.equal(out.fixtureResult,null);assert.equal(out.archiveUses,0);assert.deepEqual(out.actualLive,[]);
    assert.equal(out.initRetry,false);assert.match(out.initRetryError,/TASK6A_ORIGIN_BOOTSTRAP_REFUSED/);
    assert.equal(out.initializerCallbacks,0);
    if(mode!=='initialize-premature') {assert.equal(out.armed,true);assert.equal(out.count,4);assert.equal(out.events.filter(x=>x[0]==='close').length,10);}
  });
  for(const mode of ['initialize-false','initialize-throw','initialize-expired','initialize-unsettled','initialize-foreign'])await t.test(`${mode} preserves actual partial initialization and closes originals once`,()=>{
    const out=invoke(mode);refused(out);assert.equal(out.armed,true);assert.equal(out.evals,1);assert.equal(out.archiveDefined,true);
    assert.equal(out.finalInitPhase,'burned');assert.equal(out.finalPrivateCode,'');assert.equal(out.initDiagnostic,null);
    assert.equal(out.fixtureResult,null);assert.equal(out.archiveUses,0);assert.equal(out.events.filter(x=>x[0]==='close').length,10);assert.deepEqual(out.actualLive,[]);
    assert.equal(out.initRetry,false);assert.match(out.initRetryError,/TASK6A_ORIGIN_BOOTSTRAP_REFUSED/);
    assert.ok(out.events.some(x=>x[0]==='armed'&&x[1]===mode&&x[2]===1));
  });
  for(const mode of ['initialize-duplicate','initialize-arity'])await t.test(`${mode} burns without repeated eval or archive use`,()=>{
    const out=invoke(mode);refused(out);assert.equal(out.evals,1);assert.equal(out.archiveDefined,true);
    assert.equal(out.finalInitPhase,'burned');assert.equal(out.fixtureResult,null);assert.deepEqual(out.actualLive,[]);
    assert.equal(out.archiveUses,0);assert.equal(out.initRetry,false);assert.match(out.initRetryError,/TASK6A_ORIGIN_BOOTSTRAP_REFUSED/);
    assert.equal(out.events.filter(x=>x[0]==='close').length,10);
  });
  for(const [name,mode,from,to] of [
    ['fixed framed blob','initialize-substituted-readback',String.raw`task6a_origin_refuse() unless Digest::SHA::sha1_hex('blob '.length($bytes)."\0".$bytes)
            eq $staged_policy[0][2]&&$commitment =~ /\A[a-f0-9]{64}\z/
            &&Digest::SHA::sha256_hex($bytes) eq $commitment;`,String.raw`task6a_origin_refuse() unless $commitment =~ /\A[a-f0-9]{64}\z/
            &&Digest::SHA::sha256_hex($bytes) eq $commitment;`],
    ['private commitment','initialize-corrupt-commitment',String.raw`&&Digest::SHA::sha256_hex($bytes) eq $commitment;`,';'],
    ['archive namespace','initialize-namespace',"task6a_origin_refuse() if $creator_namespace_exists->(['Task6aOriginArchiveV2']);",'# TEST omitted existing namespace guard'],
    ['post-load deadline','initialize-expired',String.raw`task6a_origin_refuse() unless task6a_origin_helpers_settled()
        &&task6a_origin_now()<$bootstrap_deadline;`,String.raw`task6a_origin_refuse() unless task6a_origin_helpers_settled();`],
    ['post-load helper settlement','initialize-unsettled',String.raw`task6a_origin_refuse() unless task6a_origin_helpers_settled()
        &&task6a_origin_now()<$bootstrap_deadline;`,String.raw`task6a_origin_refuse() unless task6a_origin_now()<$bootstrap_deadline;`],
  ])await t.test(`${name} omission accepts independently armed fault in memory only`,()=>{
    const out=invoke(mode,{mutant:source=>once(source,from,to)});assert.equal(out.armed,true);assert.equal(out.ok,true,JSON.stringify(out));
    assert.equal(out.evals,1);assert.equal(out.fixtureResult,'fixture-node-bytes');assert.equal(out.archiveUses,1);
    assert.deepEqual(out.actualLive,[]);assert.equal(out.events.filter(x=>x[0]==='close').length,10);
  });
  for(const [name,mode,mutant] of [
    ['cache container','initialize-tied-cache',source=>once(source,String.raw`my $cache=\%INC;$staged_container->(\$cache,'B::HV');
        task6a_origin_refuse() if exists($INC{'IO/Uncompress/Gunzip.pm'});`,String.raw`my $cache=\%INC;
        task6a_origin_refuse() if exists($INC{'IO/Uncompress/Gunzip.pm'});`)],
    ['traversed stash containers','initialize-tied-namespace',source=>{
      source=once(source,String.raw`$creator_epoch->();$staged_container->(\$table,'B::HV');`,'$creator_epoch->();');
      return once(source,String.raw`$staged_container->(\$table,'B::HV');$creator_epoch->();`,'$creator_epoch->();');
    }],
  ])await t.test(`${name} guard omission reaches independently counted callback in memory only`,()=>{
    const out=invoke(mode,{mutant});refused(out);assert.equal(out.armed,true);assert.equal(out.initializerCallbacks,1);
    assert.equal(out.evals,0);assert.equal(out.archiveUses,0);assert.deepEqual(out.actualLive,[]);
    assert.equal(out.events.filter(x=>x[0]==='close').length,10);
  });
});

test('created policy helpers actual completed-readback controls',{skip:!ordinary},async t=>{
  for(const mode of ['policy-healthy','policy-disk-drift','policy-late-native','policy-late-map'])await t.test(`${mode} initializes both fixed parsers before pure fixture use`,()=>{
    const out=invoke(mode);assert.equal(out.ok,true,JSON.stringify(out));assert.equal(out.evals,1);
    assert.deepEqual(out.policyEvals,{native:1,map:1});assert.equal(out.policyUses,2);assert.equal(out.policyPhase,'initialized');
    assert.equal(out.privateNative,'CODE');assert.equal(out.privateMap,'CODE');assert.equal(out.nativeDefined,true);assert.equal(out.mapDefined,true);
    assert.deepEqual(out.policyDiagnostic,{scope:'created-policy-helper-initializer-diagnostic-only',productionAuthority:false,initialized:true,helperCount:2});
    assert.deepEqual(out.nativeResult,{fileType:2,dynamicLinker:'/usr/lib/dyld',systemDependencies:['/usr/lib/libSystem.B.dylib'],productionAuthority:false});
    assert.equal(out.mapResult.scope,'complete-map-format-diagnostic-only');assert.equal(out.mapResult.productionAuthority,false);
    assert.equal(out.mapResult.regionCount,265);assert.equal(out.mapResult.currentExecutableCount,47);
    assert.equal(out.mapResult.potentialExecutableCount,63);assert.equal(out.mapResult.anonymousPotentialExecutableCount,13);
    assert.equal(out.phase,'released');assert.deepEqual(out.actualLive,[]);assert.equal(out.events.filter(x=>x[0]==='close').length,10);
    if(mode!=='policy-healthy')assert.equal(out.armed,true);
    if(mode==='policy-disk-drift')assert.equal(out.artifacts[0].files.find(x=>x.name===NAMES[1]).exact,false);
  });
  for(const mode of ['policy-premature','policy-missing-archive','policy-native-corrupt','policy-map-corrupt',
    'policy-native-commitment','policy-map-commitment','policy-native-namespace','policy-map-namespace','policy-native-substituted','policy-map-substituted',
    'policy-cache-missing','policy-cache-prefix','policy-cache-escape','policy-cache-reference','policy-cache-magic','policy-cache-tied',
    'policy-cache-empty','policy-cache-oversized','policy-cache-utf8','policy-native-inode','policy-map-inode','policy-root'])
    await t.test(`${mode} refuses without either policy eval or callback`,()=>{
      const out=invoke(mode);refused(out);assert.deepEqual(out.policyEvals,{native:0,map:0});assert.equal(out.policyUses,0);
      assert.equal(out.initializerCallbacks,0);assert.equal(out.policyPhase,'burned');assert.equal(out.privateNative,'');assert.equal(out.privateMap,'');
      assert.equal(out.policyDiagnostic,null);assert.equal(out.policyRetry,false);assert.match(out.policyRetryError,/TASK6A_ORIGIN_BOOTSTRAP_REFUSED/);
      assert.deepEqual(out.actualLive,[]);
      if(mode!=='policy-premature')assert.equal(out.events.filter(x=>x[0]==='close').length,10);
      if(!['policy-premature','policy-missing-archive'].includes(mode))assert.equal(out.armed,true);
    });
  for(const mode of ['policy-post-native-namespace','policy-post-native-cache-missing','policy-post-native-cache-replaced',
    'policy-post-native-cache-magic','policy-post-native-cache-tied'])await t.test(`${mode} preserves native effect and refuses before map`,()=>{
    const out=invoke(mode);refused(out);assert.equal(out.armed,true);assert.deepEqual(out.policyEvals,{native:1,map:0});
    assert.equal(out.nativeDefined,true);assert.equal(out.mapDefined,false);assert.equal(out.privateNative,'CODE');assert.equal(out.privateMap,'');
    assert.equal(out.initializerCallbacks,0);assert.equal(out.policyUses,0);assert.equal(out.policyDiagnostic,null);assert.deepEqual(out.actualLive,[]);
    assert.equal(out.events.filter(x=>x[0]==='close').length,10);assert.equal(out.policyRetry,false);
    assert.ok(out.events.some(x=>x[0]==='armed'&&x[1]===mode&&x[2]==='native'));
  });
  for(const kind of ['native','map'])for(const fault of ['false','throw','expired','unsettled','foreign'])await t.test(`policy-${kind}-${fault} runs actual eval before permanent failure`,()=>{
    const mode=`policy-${kind}-${fault}`,out=invoke(mode);refused(out);assert.equal(out.armed,true);
    assert.deepEqual(out.policyEvals,{native:1,map:kind==='map'?1:0});assert.equal(out.nativeDefined,true);assert.equal(out.mapDefined,kind==='map');
    assert.equal(out.policyPhase,'burned');assert.equal(out.policyUses,0);assert.equal(out.policyDiagnostic,null);
    assert.deepEqual(out.actualLive,[]);assert.equal(out.events.filter(x=>x[0]==='close').length,10);assert.equal(out.policyRetry,false);
    assert.ok(out.events.some(x=>x[0]==='armed'&&x[1]===mode&&x[2]===kind));
  });
  for(const mode of ['policy-duplicate','policy-arity'])await t.test(`${mode} burns with no repeated eval or parser use`,()=>{
    const out=invoke(mode);refused(out);assert.deepEqual(out.policyEvals,{native:1,map:1});assert.equal(out.policyUses,0);
    assert.equal(out.policyPhase,'burned');assert.equal(out.policyRetry,false);assert.deepEqual(out.actualLive,[]);
    assert.equal(out.events.filter(x=>x[0]==='close').length,10);
  });
  for(const [name,mode,from,to] of [
    ['native fixed blob','policy-native-substituted',String.raw`task6a_origin_refuse() unless Digest::SHA::sha1_hex('blob '.length($native_bytes)."\0".$native_bytes)
            eq $staged_policy[1][2]&&$native_commitment =~ /\A[a-f0-9]{64}\z/`,String.raw`task6a_origin_refuse() unless $native_commitment =~ /\A[a-f0-9]{64}\z/`],
    ['map fixed blob','policy-map-substituted',String.raw`task6a_origin_refuse() unless Digest::SHA::sha1_hex('blob '.length($map_bytes)."\0".$map_bytes)
            eq $staged_policy[2][2]&&$map_commitment =~ /\A[a-f0-9]{64}\z/`,String.raw`task6a_origin_refuse() unless $map_commitment =~ /\A[a-f0-9]{64}\z/`],
    ['native commitment','policy-native-commitment','&&Digest::SHA::sha256_hex($native_bytes) eq $native_commitment;',';'],
    ['map commitment','policy-map-commitment','&&Digest::SHA::sha256_hex($map_bytes) eq $map_commitment;',';'],
    ['native deadline','policy-native-expired',String.raw`task6a_origin_refuse() unless task6a_origin_helpers_settled()
        &&task6a_origin_now()<$bootstrap_deadline;`,String.raw`task6a_origin_refuse() unless task6a_origin_helpers_settled();`],
    ['map helper settlement','policy-map-unsettled',String.raw`task6a_origin_refuse() unless task6a_origin_helpers_settled()
        &&task6a_origin_now()<$bootstrap_deadline;`,String.raw`task6a_origin_refuse() unless task6a_origin_now()<$bootstrap_deadline;`],
  ])await t.test(`${name} omission accepts independently armed fault in memory only`,()=>{
    const out=invoke(mode,{mutant:source=>once(source,from,to)});assert.equal(out.armed,true);assert.equal(out.ok,true,JSON.stringify(out));
    assert.deepEqual(out.policyEvals,{native:1,map:1});assert.equal(out.policyUses,2);assert.deepEqual(out.actualLive,[]);
    assert.equal(out.events.filter(x=>x[0]==='close').length,10);
  });
  const mapBoundary=String.raw`$creator_native_original=$creator_policy_code->(\$native);$creator_epoch->();
        task6a_origin_refuse() if $creator_namespace_exists->(['Task6aOriginMapV2']);
        task6a_origin_refuse() unless $creator_policy_cache->() eq $cache_path;`;
  for(const [name,mode,omitted] of [
    ['map namespace','policy-post-native-namespace',"task6a_origin_refuse() if $creator_namespace_exists->(['Task6aOriginMapV2']);"],
    ['cache equality','policy-post-native-cache-replaced','task6a_origin_refuse() unless $creator_policy_cache->() eq $cache_path;'],
  ])await t.test(`second ${name} boundary omission accepts actual post-native drift in memory only`,()=>{
    const out=invoke(mode,{mutant:source=>once(source,mapBoundary,mapBoundary.replace(omitted,'# TEST omitted second boundary'))});
    assert.equal(out.armed,true);assert.equal(out.ok,true,JSON.stringify(out));assert.deepEqual(out.policyEvals,{native:1,map:1});
    assert.equal(out.policyUses,2);assert.equal(out.initializerCallbacks,0);assert.deepEqual(out.actualLive,[]);
  });
  for(const mode of ['policy-post-native-cache-magic','policy-post-native-cache-tied'])await t.test(`second cache guard omission reaches one ${mode} callback`,()=>{
    const out=invoke(mode,{mutant:source=>once(source,mapBoundary,mapBoundary.replace('task6a_origin_refuse() unless $creator_policy_cache->() eq $cache_path;','# TEST omitted second cache guard'))});
    refused(out);assert.equal(out.armed,true);assert.deepEqual(out.policyEvals,{native:1,map:1});assert.equal(out.initializerCallbacks,1);
    assert.equal(out.policyUses,0);assert.deepEqual(out.actualLive,[]);assert.equal(out.events.filter(x=>x[0]==='close').length,10);
  });
  await t.test('initial cache container omission reaches one callback before either eval',()=>{
    const from=String.raw`my $creator_policy_cache=sub {
    $creator_epoch->();my $cache=\%INC;$staged_container->(\$cache,'B::HV');`;
    const out=invoke('policy-cache-tied',{mutant:source=>once(source,from,String.raw`my $creator_policy_cache=sub {
    $creator_epoch->();my $cache=\%INC;`)});
    refused(out);assert.equal(out.armed,true);assert.deepEqual(out.policyEvals,{native:0,map:0});assert.equal(out.initializerCallbacks,1);
    assert.equal(out.policyUses,0);assert.deepEqual(out.actualLive,[]);assert.equal(out.events.filter(x=>x[0]==='close').length,10);
  });
});
