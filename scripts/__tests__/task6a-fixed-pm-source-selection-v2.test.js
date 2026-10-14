import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';

const BOOTSTRAP=new URL('../task6a-protected-origin-bootstrap-v2.pl',import.meta.url);
const rows=[
  {
    "key": "Carp.pm",
    "path": "/System/Library/Perl/5.34/Carp.pm",
    "bytes": 35985,
    "sha256": "020bba236b44c482c8a401b5f6676c0b5d27a76caaf7cae41dfb7a63b00488b3"
  },
  {
    "key": "Digest/base.pm",
    "path": "/System/Library/Perl/5.34/Digest/base.pm",
    "bytes": 1984,
    "sha256": "06367faa5fb46a5794d3d7603d52075ab1533ad848184a5309a1cfac1058281a"
  },
  {
    "key": "Exporter.pm",
    "path": "/System/Library/Perl/5.34/Exporter.pm",
    "bytes": 18774,
    "sha256": "073f49928a471678e14ce5c314aef306a93a58870dba423ff2f630d1de782cad"
  },
  {
    "key": "Exporter/Heavy.pm",
    "path": "/System/Library/Perl/5.34/Exporter/Heavy.pm",
    "bytes": 6530,
    "sha256": "e53ad090aaa655b01ad1cff2af2daf6c92020ed349f9d48d55109cd1d142f6a0"
  },
  {
    "key": "File/GlobMapper.pm",
    "path": "/System/Library/Perl/5.34/File/GlobMapper.pm",
    "bytes": 15683,
    "sha256": "1fc0b84c8fa4fc5b3cad7ae0a638a8fd3736efd5416c31afcc8ae58a03d525b3"
  },
  {
    "key": "IO/Compress/Base/Common.pm",
    "path": "/System/Library/Perl/5.34/IO/Compress/Base/Common.pm",
    "bytes": 22774,
    "sha256": "7dbfdfdf0851619f00d98f5958203fd4ea9535ef008a87eec5cd19cd039710e5"
  },
  {
    "key": "IO/Compress/Gzip/Constants.pm",
    "path": "/System/Library/Perl/5.34/IO/Compress/Gzip/Constants.pm",
    "bytes": 3883,
    "sha256": "108fdebbb31a16c6ff3ff2e9fb3220e197aa79ba9f7e995073da40da956315b3"
  },
  {
    "key": "IO/Compress/Zlib/Extra.pm",
    "path": "/System/Library/Perl/5.34/IO/Compress/Zlib/Extra.pm",
    "bytes": 5647,
    "sha256": "57934980c670ff320d15164647da794882b9d3edee4d1586495f91dca4c9ed01"
  },
  {
    "key": "IO/Uncompress/Adapter/Inflate.pm",
    "path": "/System/Library/Perl/5.34/IO/Uncompress/Adapter/Inflate.pm",
    "bytes": 3259,
    "sha256": "e93c905f15ba91ed6ef8cae083ed0cfd860bcbfcb763592e722a2e529ff5989b"
  },
  {
    "key": "IO/Uncompress/Base.pm",
    "path": "/System/Library/Perl/5.34/IO/Uncompress/Base.pm",
    "bytes": 38337,
    "sha256": "adcbe73669c2f03ddce11fe3234b39e26057c9c7b8283ce4bf2e4d21ff64893a"
  },
  {
    "key": "IO/Uncompress/Gunzip.pm",
    "path": "/System/Library/Perl/5.34/IO/Uncompress/Gunzip.pm",
    "bytes": 32152,
    "sha256": "f9cf9da150abe298dc8efa76e4cd385b641c377afb567db1d643e540ea3295ab"
  },
  {
    "key": "IO/Uncompress/RawInflate.pm",
    "path": "/System/Library/Perl/5.34/IO/Uncompress/RawInflate.pm",
    "bytes": 31841,
    "sha256": "efa06d6eca40888d6f1f9bd3487339d9bbb788c823118171655701617bc922b8"
  },
  {
    "key": "JSON/PP.pm",
    "path": "/System/Library/Perl/5.34/JSON/PP.pm",
    "bytes": 100527,
    "sha256": "b256804d959880439ce3e5b82497d01c080228276ae55979d3ababee48293a89"
  },
  {
    "key": "JSON/PP/Boolean.pm",
    "path": "/System/Library/Perl/5.34/JSON/PP/Boolean.pm",
    "bytes": 810,
    "sha256": "264db0a8de27d592dceb964bbaab9a05a65197855a7bfd4f10ed20d14f86f379"
  },
  {
    "key": "PerlIO.pm",
    "path": "/System/Library/Perl/5.34/PerlIO.pm",
    "bytes": 14441,
    "sha256": "183d8cc5992cd8197bd0621f0ac1c2346104327ecc4e7ccb53c26145481822b6"
  },
  {
    "key": "SelectSaver.pm",
    "path": "/System/Library/Perl/5.34/SelectSaver.pm",
    "bytes": 1076,
    "sha256": "b951b99c894f701eac08b79265ff2ccbede0954f97a537d03fb78801ed645861"
  },
  {
    "key": "Symbol.pm",
    "path": "/System/Library/Perl/5.34/Symbol.pm",
    "bytes": 4905,
    "sha256": "bd0e0df0aa0b830f87c2a991b3989abae21c9e9dce4edb2abc7125c3c7693621"
  },
  {
    "key": "Tie/Hash.pm",
    "path": "/System/Library/Perl/5.34/Tie/Hash.pm",
    "bytes": 7639,
    "sha256": "12e565ea59a4a3a332d8fefa40a654f9482014c145f165bef3d065a59daee55a"
  },
  {
    "key": "XSLoader.pm",
    "path": "/System/Library/Perl/5.34/XSLoader.pm",
    "bytes": 11398,
    "sha256": "c6efc1f25e87fb1c2343d471b868af1a755df601985065dbd22e22273d6b2192"
  },
  {
    "key": "bytes.pm",
    "path": "/System/Library/Perl/5.34/bytes.pm",
    "bytes": 3782,
    "sha256": "7e3a78b180565c3caafa7f3dd5913acb91b06fe7c9f802bf948eb5a962df00f0"
  },
  {
    "key": "constant.pm",
    "path": "/System/Library/Perl/5.34/constant.pm",
    "bytes": 14724,
    "sha256": "e67cdfa533d42cbe5265bcf3c270f055620cba38a9295b5d584b7efc37a0c156"
  },
  {
    "key": "B.pm",
    "path": "/System/Library/Perl/5.34/darwin-thread-multi-2level/B.pm",
    "bytes": 30093,
    "sha256": "cf275fdd78b25aa726b0068003aee6e08cd380f2aea1378efbb8fe268d6bc95a"
  },
  {
    "key": "Compress/Raw/Zlib.pm",
    "path": "/System/Library/Perl/5.34/darwin-thread-multi-2level/Compress/Raw/Zlib.pm",
    "bytes": 47387,
    "sha256": "7b9321c1d13ab20c19e2bd0deafc09a0c3fa30f526c68078145d9409f2ab2bc6"
  },
  {
    "key": "Config.pm",
    "path": "/System/Library/Perl/5.34/darwin-thread-multi-2level/Config.pm",
    "bytes": 3886,
    "sha256": "e85c38637cedf6a9e29e6946201fbefeceba184e07b720b976c068ecab4d7283"
  },
  {
    "key": "Digest/SHA.pm",
    "path": "/System/Library/Perl/5.34/darwin-thread-multi-2level/Digest/SHA.pm",
    "bytes": 22174,
    "sha256": "15efed6020da9028a7a5b2d41d7e6d8e6b1719aeae365bc592ffb4025f76d33d"
  },
  {
    "key": "DynaLoader.pm",
    "path": "/System/Library/Perl/5.34/darwin-thread-multi-2level/DynaLoader.pm",
    "bytes": 25540,
    "sha256": "dde9744d54a185e1d38d52c98bf9349a83360d5fb31c82904e28d514a87c79fe"
  },
  {
    "key": "Encode.pm",
    "path": "/System/Library/Perl/5.34/darwin-thread-multi-2level/Encode.pm",
    "bytes": 32075,
    "sha256": "134fddc376de04a40dea58e6055f7ce28bc4159487a47c260ac8feaf04201a54"
  },
  {
    "key": "Encode/Alias.pm",
    "path": "/System/Library/Perl/5.34/darwin-thread-multi-2level/Encode/Alias.pm",
    "bytes": 12545,
    "sha256": "9ec57c436578d4c67b269c53dcb70db64bf845b7ba294da2b8fb998bc00a45ea"
  },
  {
    "key": "Encode/Config.pm",
    "path": "/System/Library/Perl/5.34/darwin-thread-multi-2level/Encode/Config.pm",
    "bytes": 6065,
    "sha256": "a15072cf84ac4a431b91b1a893a7c8d4c4dd48adefa077cd3a9b271cf0aba3bf"
  },
  {
    "key": "Encode/Encoding.pm",
    "path": "/System/Library/Perl/5.34/darwin-thread-multi-2level/Encode/Encoding.pm",
    "bytes": 9063,
    "sha256": "1daaf4400c4462c24d785b7eb91fbebc6eb868192aad410df48019fe7af6e39d"
  },
  {
    "key": "Encode/MIME/Name.pm",
    "path": "/System/Library/Perl/5.34/darwin-thread-multi-2level/Encode/MIME/Name.pm",
    "bytes": 3821,
    "sha256": "1cabed37ee26cfd763999649f9ac9a5f1e5a81cbc5125b8d85ff19d60b72f906"
  },
  {
    "key": "Fcntl.pm",
    "path": "/System/Library/Perl/5.34/darwin-thread-multi-2level/Fcntl.pm",
    "bytes": 4044,
    "sha256": "80511e494fc719cb63d252a95987ba24c04557947c1bf1584f5eeb6704786e9b"
  },
  {
    "key": "File/Glob.pm",
    "path": "/System/Library/Perl/5.34/darwin-thread-multi-2level/File/Glob.pm",
    "bytes": 12712,
    "sha256": "ff854e2cccfcd78e6c22278c843ea61fda1d0164704b1aa8941fe05ff9dbbfe8"
  },
  {
    "key": "IO.pm",
    "path": "/System/Library/Perl/5.34/darwin-thread-multi-2level/IO.pm",
    "bytes": 1462,
    "sha256": "d1db057bb61c36632e97e7216733ddf70ccd367f1f32393f9d7a4248cc4ec07e"
  },
  {
    "key": "IO/File.pm",
    "path": "/System/Library/Perl/5.34/darwin-thread-multi-2level/IO/File.pm",
    "bytes": 4872,
    "sha256": "133658ff1c17332f46d01d34f872b71309c715656b47f39e31393e2d10d827e4"
  },
  {
    "key": "IO/Handle.pm",
    "path": "/System/Library/Perl/5.34/darwin-thread-multi-2level/IO/Handle.pm",
    "bytes": 16641,
    "sha256": "af3d3b9f9bc2132644248480d21b2e7e5c1a7e0d7a3c1f121e89888a2153b9f1"
  },
  {
    "key": "IO/Seekable.pm",
    "path": "/System/Library/Perl/5.34/darwin-thread-multi-2level/IO/Seekable.pm",
    "bytes": 2891,
    "sha256": "ce170c83abf1a599320c0f4369c8e6e123310b4603ac3791bee0e733d9e8e533"
  },
  {
    "key": "IO/Select.pm",
    "path": "/System/Library/Perl/5.34/darwin-thread-multi-2level/IO/Select.pm",
    "bytes": 9263,
    "sha256": "a6804f44f8c90c88f8cc60cdd38538f65f3f92ce533fcda6933887c7228ad5d7"
  },
  {
    "key": "List/Util.pm",
    "path": "/System/Library/Perl/5.34/darwin-thread-multi-2level/List/Util.pm",
    "bytes": 24055,
    "sha256": "0d3135c14b4d4156a0de8156f2d33f54c6f0b6233b2f6fe5d4b9122e9fef1a5a"
  },
  {
    "key": "MIME/Base64.pm",
    "path": "/System/Library/Perl/5.34/darwin-thread-multi-2level/MIME/Base64.pm",
    "bytes": 5433,
    "sha256": "dfb1e3876b3e7f3cf9a3f23123c37464617e551802e618e54cabd7890c986cc8"
  },
  {
    "key": "POSIX.pm",
    "path": "/System/Library/Perl/5.34/darwin-thread-multi-2level/POSIX.pm",
    "bytes": 20384,
    "sha256": "d941cf37b6dee5253b859cbb703a5785629a0bcdd86f61d1ec96fa464d69df90"
  },
  {
    "key": "PerlIO/scalar.pm",
    "path": "/System/Library/Perl/5.34/darwin-thread-multi-2level/PerlIO/scalar.pm",
    "bytes": 1069,
    "sha256": "a4205c837c331d7945f0221600ae8b4bf6ea562812c71b535ac06693de26a859"
  },
  {
    "key": "Scalar/Util.pm",
    "path": "/System/Library/Perl/5.34/darwin-thread-multi-2level/Scalar/Util.pm",
    "bytes": 10189,
    "sha256": "9ba58fcbefc535a73d3fc0da949d0fb1e524411dea4e8bee97529700607a98a4"
  },
  {
    "key": "Storable.pm",
    "path": "/System/Library/Perl/5.34/darwin-thread-multi-2level/Storable.pm",
    "bytes": 49923,
    "sha256": "4a9ab42a68de934079da007e8df0ae3c66f33477c3f3218782596a83e3ea508c"
  },
  {
    "key": "Time/HiRes.pm",
    "path": "/System/Library/Perl/5.34/darwin-thread-multi-2level/Time/HiRes.pm",
    "bytes": 25689,
    "sha256": "9bc6ece12a90e5c01d784a4efd672c49b8a7551ce6871b620efbd38cd4960f34"
  },
  {
    "key": "integer.pm",
    "path": "/System/Library/Perl/5.34/integer.pm",
    "bytes": 3254,
    "sha256": "eb62cc3ee22a592bc673e07158927d1a6536075d33258fc67ff91e3f720cf463"
  },
  {
    "key": "overload.pm",
    "path": "/System/Library/Perl/5.34/overload.pm",
    "bytes": 53349,
    "sha256": "3ea7fb212172cb9c01dacee5f7d90aa04da396f5bca442eca84ad2e94a200d99"
  },
  {
    "key": "overloading.pm",
    "path": "/System/Library/Perl/5.34/overloading.pm",
    "bytes": 1808,
    "sha256": "5bba56c0acdcc449ca3b73500862a5750c907d97d652978038dbc7809c4fcd07"
  },
  {
    "key": "parent.pm",
    "path": "/System/Library/Perl/5.34/parent.pm",
    "bytes": 2702,
    "sha256": "046169e129cfb7d4b302567de268409f175652192914abd33245cb9939f16626"
  },
  {
    "key": "strict.pm",
    "path": "/System/Library/Perl/5.34/strict.pm",
    "bytes": 4783,
    "sha256": "f1296224730dceb5dd308ee1e72c452c8b13ced7f3bf742ccd16e1e1c416bcb5"
  },
  {
    "key": "utf8.pm",
    "path": "/System/Library/Perl/5.34/utf8.pm",
    "bytes": 10756,
    "sha256": "9dd05cc86753dc3989926bdc0ed8425ff1ae8946f3298d61440891ee92026691"
  },
  {
    "key": "vars.pm",
    "path": "/System/Library/Perl/5.34/vars.pm",
    "bytes": 2458,
    "sha256": "84de23fb5d39572d2b0dc5d4e1cd6363017fae8f54eff90d4c8121eb1edeeb57"
  },
  {
    "key": "warnings.pm",
    "path": "/System/Library/Perl/5.34/warnings.pm",
    "bytes": 53221,
    "sha256": "7aa17d79aa23ee3635aa145902944e6dad909c0f5d6ca47d27bce7be864e42d2"
  },
  {
    "key": "warnings/register.pm",
    "path": "/System/Library/Perl/5.34/warnings/register.pm",
    "bytes": 759,
    "sha256": "ce25ec34358642703ff05b546b2ac42b4f2081ab7610d8373dd94c6b78040cf4"
  }
];
const sha=b=>createHash('sha256').update(b).digest('hex');
const quote=s=>"'"+s.replaceAll('\\','\\\\').replaceAll("'","\\'")+"'";
const ordinary=process.platform==='darwin'&&process.getuid?.()!==0&&process.getuid?.()===process.geteuid?.();
const GUARD=String.raw`# Cold entry stays closed before any candidate PM/XS import.
BEGIN {
    CORE::print STDERR "TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n";
    CORE::exit(2);
}
`;
// Restrict test mutations to the original selector; the native owner repeats
// the same fixed manifest literals and must remain untouched.
function inPmSelector(source,from,to) {
  const begin='# Inert fixed PM source-selection prerequisite.';
  const end='# End fixed PM source-selection prerequisite.';
  assert.equal(source.split(begin).length,2);assert.equal(source.split(end).length,2);
  const a=source.indexOf(begin),z=source.indexOf(end);assert.ok(z>a);
  return source.slice(0,a)+once(source.slice(a,z),from,to)+source.slice(z);
}
function once(s,a,b) {assert.equal(s.split(a).length,2,'unique memory-only substitution: '+a);return s.replace(a,()=>b);}
const definitions=String.raw`BEGIN {
    package Task6aPMTie;
    our ($fetch,$store,$armed)=(0,0,0);
    sub TIESCALAR {CORE::bless({},$_[0]);}
    sub TIEHASH {CORE::bless({},$_[0]);}
    sub TIEARRAY {CORE::bless({},$_[0]);}
    sub FETCH {$fetch++;return 'FOREIGN';}
    sub FETCHSIZE {$fetch++;return 54;}
    sub EXISTS {$fetch++;return 0;}
    sub STORE {$store++;}
    package Task6aPMForeign;
    our ($overload,$destroy)=(0,0);
    sub DESTROY {$destroy++;}
}
`;
const probe=String.raw`
        $pm_test_probe=sub {
            my ($full)=@_;
            CORE::print "phase\t",$phase,"\n";
            CORE::print "hook-calls\t",$calls,"\n";
            CORE::print "recheck-calls\t",$rechecks,"\n";
            CORE::print "claimed\t",$claimed,"\n";
            CORE::print "detach-started\t",$detach_started,"\n";
            CORE::print "insert-native-error\t",defined($install_error)&&CORE::ref($install_error) eq ''?CORE::unpack('H*',$install_error):'UNDEF',"\n";
            CORE::print "insert-result\t",defined($install_outcome)&&CORE::ref($install_outcome) eq ''?$install_outcome:'UNDEF',"\n";
            CORE::print "insert-post-shape\t",defined($install_post_shape)?$install_post_shape:'UNDEF',"\n";
            CORE::print "owned-revoke-attempted\t",$owned_revoke_attempted,"\n";
            CORE::print "detach-post-shape\t",defined($detach_post_shape)?$detach_post_shape:'UNDEF',"\n";
            CORE::print "detach-error\t",defined($detach_error)&&CORE::ref($detach_error) eq ''?CORE::unpack('H*',$detach_error):'UNDEF',"\n";
            for my $r(@records) {if($r->{publication_attempted}) {
                CORE::print 'publication-result:',$r->{key},"\t",defined($r->{publication_result})&&CORE::ref($r->{publication_result}) eq ''?$r->{publication_result}:'UNDEF',"\n";
                CORE::print 'publication-error:',$r->{key},"\t",defined($r->{publication_error})&&CORE::ref($r->{publication_error}) eq ''?CORE::unpack('H*',$r->{publication_error}):'UNDEF',"\n";
            }}
            CORE::print "detach-outcome\t",!defined($detach_outcome)?'UNDEF':CORE::ref($detach_outcome) ne ''?'REFERENCE':$detach_outcome,"\n";
            CORE::print "selected\t",CORE::scalar(CORE::grep {$_->{selected}} @records),"\n";
            CORE::print "denial-log\t",$policy_denials{'Log/Agent.pm'}||0,"\n";
            CORE::print "denial-encode\t",$policy_denials{'Encode/ConfigLocal.pm'}||0,"\n";
            CORE::print "fetch-calls\t",$Task6aPMTie::fetch,"\n";
            CORE::print "store-calls\t",$Task6aPMTie::store,"\n";
            CORE::print "foreign-overload\t",$Task6aPMForeign::overload,"\n";
            CORE::print "foreign-destroy\t",$Task6aPMForeign::destroy,"\n";
            if($full) {for my $record(@records) {
                next unless $record->{selected};
                CORE::print 'compiler:', $record->{key},"\t",CORE::unpack('H*',${'${'}$record->{compiler_cell}}),"\n";
            }}
        };
        $pm_test_arm=sub {
            my ($mode)=@_;
            $calls=127 if $mode eq 'hook-boundary';
            $rechecks=63 if $mode eq 'recheck-boundary';
            if($mode eq 'compiler-drift') {for my $record(@records) {
                if($record->{selected}) {${'${'}$record->{compiler_cell}}='ALTERED';last;}
            }}
        };
`;
function invoke(mode='healthy',options={}) {
  assert.ok(ordinary,'ordinary Darwin only; no privileged/non-native fallback');
  const originalBytes=fs.readFileSync(BOOTSTRAP);const originalSHA256=sha(originalBytes);let source=originalBytes.toString('utf8');
  for(const name of ['$pm_loader_install','$pm_loader_recheck','$pm_loader_revoke'])assert.ok(source.includes(name),'mechanical private support: '+name);
  const home=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'task6a-pm-selection.'));
  const inputs=rows.map((row,i)=>{
    const genuine=fs.readFileSync(row.path);assert.equal(genuine.length,row.bytes);assert.equal(sha(genuine),row.sha256);
    let bytes=genuine;
    if(options.candidateKey===row.key)bytes=options.candidate;
    assert.equal(bytes.length,row.bytes);
    const file=home+'/'+i+'.input';fs.writeFileSync(file,bytes,{flag:'wx',mode:0o600});
    return {...row,file,genuineSHA256:sha(genuine),candidateSHA256:sha(bytes)};
  });
  source=once(source,GUARD,String.raw`BEGIN {CORE::die "TEST_ORDINARY_ONLY\n" unless $^O eq 'darwin'&&$<!=0&&$<==$>&&@ARGV==0;}
`);
  source=once(source,'\ntask6a_origin_main();\n','\n');
  source=once(source,'# Inert fixed PM source-selection prerequisite.', 'my ($pm_test_probe,$pm_test_arm);\n# Inert fixed PM source-selection prerequisite.');
  source=once(source,'        # Private PM lifecycle closures end here.',probe+'        # Private PM lifecycle closures end here.');
  if(mode==='buffer-window')source=inPmSelector(source,"['strict.pm','/System/Library/Perl/5.34/strict.pm',","['strict.pm',"+quote(home+'/strict.pm')+",");
  if(options.candidateKey) {
    const row=rows.find(r=>r.key===options.candidateKey);
    source=inPmSelector(source,"'"+row.sha256+"'],","'"+sha(options.candidate)+"'],");
  }
  const read=inputs.map((row,i)=>String.raw`
    {
        my ($fh,$opened,$bytes,$count,$eof,$closed,$failure);
        my $ok=eval {
            $opened=CORE::sysopen($fh,FILE,0x01000100);CORE::die "TEST_OPEN\n" unless $opened;
            $count=CORE::sysread($fh,$bytes,LIMIT);CORE::die "TEST_READ\n" unless defined($count)&&$count==SIZE;
            my $tail='';$eof=CORE::sysread($fh,$tail,1);CORE::die "TEST_EOF\n" unless defined($eof)&&$eof==0&&$tail eq '';1;
        };$failure=$@;
        my $close_ok=eval {$closed=CORE::close($fh);1;} if $opened;
        my $live=$opened?CORE::fileno($fh):undef;
        CORE::print "input:INDEX\t",defined($count)?$count:'UNDEF',',',defined($eof)?$eof:'UNDEF',',',defined($closed)?$closed:'UNDEF',',',defined($live)?$live:'UNDEF',"\n";
        CORE::die $failure unless $ok;
        CORE::die "TEST_CLOSE\n" unless $close_ok&&$closed&&!defined($live);
        $pm_completed_readbacks[INDEX]=$bytes;
    }
`.replace('FILE',quote(row.file)).replace('LIMIT',row.bytes+1).replace('SIZE',row.bytes).replaceAll('INDEX',String(i))).join('');
  const before=mode==='prior-genuine-realm'?"$strict_completed_readback=$pm_completed_readbacks[49];$strict_loader_install->();require 'strict.pm';CORE::print \"prior-check-before\\t\",$strict_loader_recheck->()?1:0,\"\\n\";":mode==='missing-input'?'CORE::pop(@pm_completed_readbacks);'
    :mode==='extra-input'?"CORE::push(@pm_completed_readbacks,'EXTRA');"
    :mode==='corrupt-input'?"$pm_completed_readbacks[0]=CORE::substr($pm_completed_readbacks[0],0,-1).'!';"
    :mode==='utf8-input'?'utf8::upgrade($pm_completed_readbacks[0]);'
    :mode==='ref-input'?"$pm_completed_readbacks[0]=CORE::bless({},'Task6aPMForeign');"
    :mode==='zero-class-input'?"$pm_completed_readbacks[0]=CORE::bless({},'0');"
    :mode==='undef-input'?'$pm_completed_readbacks[0]=undef;'
    :mode==='tied-input'?"CORE::tie($pm_completed_readbacks[0],'Task6aPMTie');"
    :mode==='tied-input-array'?"CORE::tie(@pm_completed_readbacks,'Task6aPMTie');"
    :mode==='tied-inc'?"CORE::tie(%INC,'Task6aPMTie');"
    :mode==='tied-inc-array'?"CORE::tie(@INC,'Task6aPMTie');"
    :mode==='tied-main'?"CORE::tie(%main::,'Task6aPMTie');"
    :mode==='pre-cache'?"$INC{'strict.pm'}='FOREIGN';"
    :mode==='pre-strict'?"$main::{'strict::'}=\*STDOUT;"
    :mode==='pre-warnings'?"$main::{'warnings::'}=\*STDOUT;"
    :mode==='pre-hook'?"CORE::unshift(@INC,sub {CORE::die 'FOREIGN_HOOK';});":'';
  const early=['missing-input','extra-input','corrupt-input','utf8-input','ref-input','zero-class-input','undef-input','tied-input','tied-input-array','tied-inc','tied-inc-array','tied-main','pre-cache','pre-strict','pre-warnings','pre-hook','install-arity','insert-after-throw','insert-reentrant','hash-tied-input','hash-reentrant','prior-genuine-realm','preclaim-reentrant'].includes(mode);
  let setup=definitions+'BEGIN {\n'+read+before+String.raw`
    my $installed=eval {INSTALL;1;};my $install_error=$@;
    CORE::print "install\t",$installed?1:0,"\n";
`.replace('INSTALL',mode==='install-arity'?'$pm_loader_install->(undef)':'$pm_loader_install->()');
  if(early) setup+=String.raw`
    my $again=eval {$pm_loader_install->();1;};CORE::print "repeat-install\t",$again?1:0,"\n";
    PRIOR
    $pm_test_probe->(0);CORE::exit(0);
`.replace('PRIOR',mode==='prior-genuine-realm'?String.raw`my $released=eval {$pm_loader_revoke->();1;};CORE::print "unclaimed-revoke\t",$released?1:0,"\n";CORE::print "prior-check-after\t",$strict_loader_recheck->()?1:0,"\n";`:'');
  else setup+='CORE::die $install_error unless $installed;my $installed_hook=$INC[0];\n';
  const postInstall={
    'late-input':"$pm_completed_readbacks[0]='ALTERED';",
    'late-tied-input':"CORE::tie($pm_completed_readbacks[0],'Task6aPMTie');",
    'late-tied-inc':"CORE::tie(%INC,'Task6aPMTie');",
    'late-tied-inc-array':"CORE::tie(@INC,'Task6aPMTie');",
    'late-roots':"$INC[1]='/FOREIGN';",
    'late-foreign-hook':"$INC[0]=CORE::bless({},'Task6aPMForeign');",
    'late-forged-cache':"$INC{'strict.pm'}='FOREIGN';",
    'late-tied-root':"CORE::tie($INC[1],'Task6aPMTie');",
    'late-tied-cache':"CORE::tie($INC{'strict.pm'},'Task6aPMTie');"
  }[mode];
  if(postInstall) setup+=postInstall+String.raw`
    my $hook=$installed_hook;
    my $selected=eval {$hook->($hook,'strict.pm');1;};CORE::print "late-selection\t",$selected?1:0,"\n";
    my $check=eval {$pm_loader_recheck->();1;};CORE::print "late-recheck\t",$check?1:0,"\n";
    $pm_test_probe->(0);CORE::exit(0);
`;
  if(mode==='unknown-caught')setup+=String.raw`
    my $hook=$INC[0];my $denied=eval {$hook->($hook,'Unlisted/Example.pm');1;};
    CORE::print "unknown-selection\t",$denied?1:0,"\n";
    my $again=eval {$hook->($hook,'strict.pm');1;};CORE::print "after-caught-selection\t",$again?1:0,"\n";
    CORE::print "hook-retained\t",$strict_same_reference->($INC[0],$hook)?1:0,"\n";
    $pm_test_probe->(0);CORE::exit(0);
`;
  if(mode==='optional-denials')setup+=String.raw`
    my $hook=$INC[0];for my $name('Log/Agent.pm','Encode/ConfigLocal.pm') {
        my $ok=eval {$hook->($hook,$name);1;};CORE::print 'optional:',$name,"\t",$ok?1:0,"\n";
    }
    my $ok=eval {$pm_loader_recheck->();1;};CORE::print "optional-check\t",$ok?1:0,"\n";
    $pm_test_probe->(0);CORE::exit(0);
`;
  if(mode.startsWith('argument-'))setup+=String.raw`
    my $hook=$installed_hook;my $self=$hook;my $key='strict.pm';
    ALTER
    my $ok=eval {CALL;1;};CORE::print "argument-selection\t",$ok?1:0,"\n";
    $pm_test_probe->(0);CORE::exit(0);
`.replace('ALTER',mode==='argument-tied-self'?"CORE::tie($self,'Task6aPMTie');":mode==='argument-tied-key'?"CORE::tie($key,'Task6aPMTie');":mode==='argument-reference-key'?"$key=CORE::bless({},'Task6aPMForeign');":mode==='argument-zero-class-key'?"$key=CORE::bless({},'0');":mode==='argument-utf8-key'?"utf8::upgrade($key);":mode==='argument-empty-key'?"$key='';":mode==='argument-long-key'?"$key='x' x 4097;":mode==='argument-foreign-self'?"$self=CORE::bless({},'Task6aPMForeign');":'').replace('CALL',mode==='argument-arity'?'$hook->($self)':'$hook->($self,$key)');
  if(mode==='publication-after-throw'||mode==='publication-reentrant')setup+=String.raw`
    my $hook=$installed_hook;my $ok=eval {$hook->($hook,'strict.pm');1;};CORE::print "publication-call\t",$ok?1:0,"\n";
    $pm_test_probe->(0);CORE::exit(0);
`;
  if(mode==='hook-boundary')setup+=String.raw`
    $pm_test_arm->('hook-boundary');my $hook=$INC[0];
    my $one=eval {$hook->($hook,'Log/Agent.pm');1;};
    my $two=eval {$hook->($hook,'Encode/ConfigLocal.pm');1;};
    CORE::print "boundary-first\t",$one?1:0,"\n";CORE::print "boundary-second\t",$two?1:0,"\n";
    $pm_test_probe->(0);CORE::exit(0);
`;
  if(mode==='buffer-window')setup+=String.raw`
    for my $path(@@PM@@,@@PMC@@) {
        CORE::open(my $changed,'>',$path) or CORE::die "TEST_WINDOW_OPEN\n";
        CORE::print {$changed} ($path eq @@PM@@?@@PM_BYTES@@:@@PMC_BYTES@@) or CORE::die "TEST_WINDOW_WRITE\n";
        CORE::close($changed) or CORE::die "TEST_WINDOW_CLOSE\n";
    }
`.replaceAll('@@PMC_BYTES@@',quote("package strict; $strict::VERSION='MODELED_PMC';sub import {} 1;\n")).replaceAll('@@PM_BYTES@@',quote("package strict; $strict::VERSION='MODELED_PM';sub import {} 1;\n")).replaceAll('@@PMC@@',quote(home+'/strict.pmc')).replaceAll('@@PM@@',quote(home+'/strict.pm'));
  setup+='}\n';
  source=once(source,'use strict;\n',setup+'use strict;\n');
  if(options.beforeUse)source=once(source,'use strict;\n',options.beforeUse+'use strict;\n');
  const payload=Buffer.from('Task6a fixed PM bytes survive runtime pad entry.\n');
  const gzip=gzipSync(payload).toString('hex');
  let runtime=String.raw`
CORE::print "strict-version\t",$strict::VERSION,"\n";
CORE::print "strict-cache\t",$INC{'strict.pm'},"\n";
my $runtime_check=eval {$pm_loader_recheck->();1;};CORE::print "runtime-check\t",$runtime_check?1:0,"\n";
CORE::die "TEST_RUNTIME_STATE\n" unless $runtime_check;
require IO::Uncompress::Gunzip;
my $compressed=CORE::pack('H*',GZIP);
CORE::open(my $input,'<',\$compressed) or CORE::die "TEST_INPUT_OPEN\n";
my $gzip=IO::Uncompress::Gunzip->new($input) or CORE::die "TEST_GUNZIP_NEW\n";
my $decoded='';my $reads=0;while(1) {my $part='';my $count=$gzip->read($part,128);$reads++;
    CORE::die "TEST_GUNZIP_READ\n" unless defined($count)&&$count>=0&&$reads<=4;
    last if $count==0;$decoded.=$part;
}
CORE::print "decoded\t",CORE::unpack('H*',$decoded),"\n";
CORE::print "gzip-reads\t",$reads,"\n";
CORE::print "gzip-tell\t",$gzip->tell(),"\n";
CORE::print "gzip-close\t",$gzip->close()?1:0,"\n";
CORE::print "input-close\t",CORE::close($input)?1:0,"\n";
CORE::print "input-fileno\t",defined(CORE::fileno($input))?'LIVE':'UNDEF',"\n";
CORE::print "natural-selected\t",CORE::scalar(CORE::keys(%INC)),"\n";
CORE::print "cvfile-xsloader\t",B::svref_2object(\&XSLoader::load)->FILE(),"\n";
CORE::print "cvfile-json\t",B::svref_2object(\&JSON::PP::new)->FILE(),"\n";
CORE::print "native-paths\t",CORE::join('|',@DynaLoader::dl_shared_objects),"\n";
# Explicit full54-table exercise only; natural bootstrap/Gunzip consumed52.
require Config;
require DynaLoader;
my $after=eval {$pm_loader_recheck->();1;};CORE::print "after-gzip-check\t",$after?1:0,"\n";
`.replace('GZIP',quote(gzip));
  if(mode==='compiler-drift')runtime+=String.raw`
$pm_test_arm->('compiler-drift');my $ok=eval {$pm_loader_recheck->();1;};CORE::print "drift-check\t",$ok?1:0,"\n";
`;
  if(mode==='cache-replace'||mode==='cache-clear'||mode==='cache-undef'||mode==='cache-tied')runtime+=String.raw`
my $original_cache=$INC{'strict.pm'};
CHANGE
my $ok=eval {$pm_loader_recheck->();1;};CORE::print "changed-cache-check\t",$ok?1:0,"\n";
CORE::untie($INC{'strict.pm'}) if defined(CORE::tied($INC{'strict.pm'}));
$INC{'strict.pm'}=$original_cache;
my $restored=eval {$pm_loader_recheck->();1;};CORE::print "restored-cache-check\t",$restored?1:0,"\n";
`.replace('CHANGE',mode==='cache-replace'?"$INC{'strict.pm'}='FOREIGN';":mode==='cache-clear'?"CORE::delete($INC{'strict.pm'});":mode==='cache-undef'?"$INC{'strict.pm'}=undef;":"CORE::tie($INC{'strict.pm'},'Task6aPMTie');");
  if(mode==='reselection')runtime+=String.raw`
my $hook=$INC[0];my $ok=eval {$hook->($hook,'strict.pm');1;};CORE::print "reselection\t",$ok?1:0,"\n";
`;
  if(mode==='recheck-boundary')runtime+=String.raw`
$pm_test_arm->('recheck-boundary');my $one=eval {$pm_loader_recheck->();1;};my $two=eval {$pm_loader_recheck->();1;};
CORE::print "boundary-first\t",$one?1:0,"\n";CORE::print "boundary-second\t",$two?1:0,"\n";
`;
  if(['revoke','revoke-unknown','revoke-arity','revoke-restore','revoke-reentrant','detach-after-throw','detach-before-throw'].includes(mode))runtime+=String.raw`
my $hook=$INC[0];my $original_root=$INC[1];
ALTER
my $ok=eval {REVOKE;1;};CORE::print "revoke\t",$ok?1:0,"\n";
RESTORE
my $again=eval {$pm_loader_revoke->();1;};CORE::print "repeat-revoke\t",$again?1:0,"\n";
CORE::print "inc-count\t",CORE::scalar(@INC),"\n";
CORE::print "cache-preserved\t",$INC{'strict.pm'} eq '/System/Library/Perl/5.34/strict.pm'?1:0,"\n";
$INC[1]=$original_root if @INC==3;
my $check=eval {$pm_loader_recheck->();1;};CORE::print "after-revoke-check\t",$check?1:0,"\n";
`.replace('ALTER',['revoke-unknown','revoke-restore'].includes(mode)?"$INC[1]='/FOREIGN';":'').replace('REVOKE',mode==='revoke-arity'?'$pm_loader_revoke->(undef)':'$pm_loader_revoke->()').replace('RESTORE',mode==='revoke-restore'?'$INC[1]=$original_root;':'');
  if(mode==='cached-require')runtime+=String.raw`
my $before=CORE::scalar(CORE::keys(%INC));require strict;require JSON::PP;require IO::Uncompress::Gunzip;
CORE::print "cached-check\t",$pm_loader_recheck->()?1:0,"\n";
CORE::print "cached-count\t",CORE::scalar(CORE::keys(%INC)),"\n";
`;
  if(mode==='overloaded-self') {
    source+=String.raw`
{package Task6aPMArmed;use overload '=='=>sub {$Task6aPMForeign::overload++;return 1;},
'0+'=>sub {$Task6aPMForeign::overload++;return 1;},'""'=>sub {$Task6aPMForeign::overload++;return 'FOREIGN';},
'&{}'=>sub {$Task6aPMForeign::overload++;return sub {};},fallback=>1;
sub DESTROY {$Task6aPMForeign::destroy++;}}
`;
    runtime+=String.raw`
my $hook=$INC[0];my $foreign=CORE::bless({},'Task6aPMArmed');my $armed=$foreign==$hook;
CORE::print "outside-overload-armed\t",($armed&&$Task6aPMForeign::overload==1)?1:0,"\n";
CORE::print "outside-noamagic\t",($^H&0x01000000)?1:0,"\n";
$Task6aPMForeign::overload=0;my $ok=eval {$hook->($foreign,'Unlisted/Unused.pm');1;};
CORE::print "overloaded-self-selection\t",$ok?1:0,"\n";
`;
  }
  runtime+='$pm_test_probe->('+(mode==='healthy'?1:0)+');\nCORE::exit(0);\n';
  source+='\n'+runtime;
  if(mode==='preclaim-reentrant')source=once(source,'&&$pm_completed_readbacks[$index] eq $records[$index]{snapshot};',String.raw`&&$pm_completed_readbacks[$index] eq $records[$index]{snapshot};if($index==53) {my $nested=eval {$pm_loader_recheck->();1;};CORE::print "preclaim-nested\t",$nested?1:0,"\n";}`);
  if(mode==='hash-tied-input')source=once(source,'my $digest=$checker_original->($bytes);',String.raw`my $digest=$checker_original->($bytes);if($phase eq 'new'&&!$Task6aPMTie::armed++) {CORE::tie($pm_completed_readbacks[0],'Task6aPMTie');CORE::print "hash-delegate-armed\t1\n";}`);
  if(mode==='hash-reentrant')source=once(source,'my $digest=$checker_original->($bytes);',String.raw`my $digest=$checker_original->($bytes);if($phase eq 'new'&&!$Task6aPMTie::armed++) {my $nested=eval {$pm_loader_recheck->();1;};CORE::print "hash-nested\t",$nested?1:0,"\n";}`);
  if(mode==='publication-after-throw')source=once(source,'$published=($INC{$key}=$record->{path});1;',String.raw`$published=($INC{$key}=$record->{path});CORE::print "publication-native-path\t",$INC{$key},"\n";CORE::die "MODEL_PUBLICATION_AFTER_EFFECT\n";1;`);
  if(mode==='publication-reentrant')source=once(source,'$published=($INC{$key}=$record->{path});1;',String.raw`$published=($INC{$key}=$record->{path});my $nested=eval {$original_hook->($original_hook,'Unlisted/Burn.pm');1;};CORE::print "publication-nested\t",$nested?1:0,"\n";1;`);
  if(mode==='insert-reentrant')source=once(source,'$inserted=CORE::unshift(@INC,$original_hook);1;',String.raw`$inserted=CORE::unshift(@INC,$original_hook);my $nested=eval {$pm_loader_recheck->();1;};CORE::print "insert-nested\t",$nested?1:0,"\n";1;`);
  if(mode==='detach-after-throw')source=once(source,'$removed=CORE::shift(@INC);1;',String.raw`$removed=CORE::shift(@INC);CORE::print "detach-native-count\t",CORE::scalar(@INC),"\n";CORE::die "MODEL_DETACH_AFTER_EFFECT\n";1;`);
  if(mode==='detach-before-throw')source=once(source,'$removed=CORE::shift(@INC);1;',String.raw`CORE::die "MODEL_DETACH_BEFORE_EFFECT\n";$removed=CORE::shift(@INC);1;`);
  if(mode==='insert-after-throw')source=once(source,'$inserted=CORE::unshift(@INC,$original_hook);1;',String.raw`$inserted=CORE::unshift(@INC,$original_hook);CORE::print "insert-delegate-count\t",CORE::scalar(@INC),"\n";CORE::die "MODEL_INSERT_AFTER_EFFECT\n";1;`);
  if(mode==='revoke-reentrant')source=once(source,'$removed=CORE::shift(@INC);1;',String.raw`my $reentrant=eval {$pm_loader_recheck->();1;};CORE::print "during-revoke-check\t",$reentrant?1:0,"\n";$removed=CORE::shift(@INC);1;`);
  if(options.mutate)source=options.mutate(source);
  fs.writeFileSync(home+'/program.pl',source,{flag:'wx',mode:0o600});
  const creation={mode,scope:'ordinary compiler/runtime; modeled readback ACL/native initial trust; no production or native image authority',
    sourceSHA256:originalSHA256,programSHA256:sha(source),inputs,
    modeledAlternatePin:!!options.candidateKey,modeledStrictFilename:mode==='buffer-window'?home+'/strict.pm':null,argv:['/usr/bin/perl','-f',home+'/program.pl'],cwd:'/',
    env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'},stdoutBound:3145728,timeoutMs:90000};
  fs.writeFileSync(home+'/creation.json',JSON.stringify(creation,null,2)+'\n',{flag:'wx',mode:0o600});
  const child=spawnSync('/usr/bin/perl',['-f',home+'/program.pl'],{cwd:'/',env:creation.env,encoding:'utf8',maxBuffer:creation.stdoutBound,timeout:creation.timeoutMs});
  fs.writeFileSync(home+'/stdout.log',child.stdout??'',{flag:'wx',mode:0o600});
  fs.writeFileSync(home+'/stderr.log',child.stderr??'',{flag:'wx',mode:0o600});
  fs.writeFileSync(home+'/terminal.json',JSON.stringify({pid:child.pid,status:child.status,signal:child.signal,error:child.error?.code??null})+'\n',{flag:'wx',mode:0o600});
  assert.equal(child.error,undefined);assert.equal(child.signal,null);assert.equal(child.status,0,child.stdout+child.stderr);assert.equal(child.stderr,'');
  const entries=child.stdout.trim().split('\n').map(s=>s.split('\t'));assert.ok(entries.every(r=>r.length===2));assert.equal(new Set(entries.map(r=>r[0])).size,entries.length);
  const o=Object.fromEntries(entries);fs.writeFileSync(home+'/witness.json',JSON.stringify({mode,pid:child.pid,observations:o,scope:creation.scope})+'\n',{flag:'wx',mode:0o600});
  return {o,home,pid:child.pid,payload};
}
function quiet(o) {assert.equal(o['fetch-calls'],'0');assert.equal(o['store-calls'],'0');assert.equal(o['foreign-overload'],'0');assert.equal(o['foreign-destroy'],'0');}
function announce(t,r) {t.diagnostic(JSON.stringify({home:r.home,pid:r.pid,phase:r.o.phase}));}

test('fixed PM private support is mechanical, not source or native admission',()=>{
  const s=fs.readFileSync(BOOTSTRAP,'utf8');for(const n of ['$pm_loader_install','$pm_loader_recheck','$pm_loader_revoke'])assert.ok(s.includes(n));
});
test('genuine54 PM buffers survive compile-to-runtime and actual Gunzip',(t)=>{
  const r=invoke(),o=r.o;assert.equal(o.install,'1');assert.equal(o['runtime-check'],'1');assert.equal(o['after-gzip-check'],'1');
  assert.equal(o.decoded,r.payload.toString('hex'));assert.equal(o['gzip-reads'],'2');assert.equal(o['gzip-tell'],String(r.payload.length));assert.equal(o['gzip-close'],'1');assert.equal(o['input-close'],'1');assert.equal(o['input-fileno'],'UNDEF');
  assert.equal(o['natural-selected'],'52');assert.equal(o.selected,'54');assert.equal(o.phase,'installed');
  assert.equal(o['cvfile-xsloader'],'/System/Library/Perl/5.34/XSLoader.pm');assert.equal(o['cvfile-json'],'/System/Library/Perl/5.34/JSON/PP.pm');
  for(const row of rows){const bytes=Buffer.from(o['compiler:'+row.key],'hex');assert.equal(bytes.length,row.bytes);assert.equal(sha(bytes),row.sha256);}
  for(let i=0;i<rows.length;i++)assert.equal(o['input:'+i],rows[i].bytes+',0,1,UNDEF');quiet(o);announce(t,r);
});
for(const mode of ['missing-input','extra-input','corrupt-input','utf8-input','ref-input','zero-class-input','undef-input','tied-input','tied-input-array','tied-inc','tied-inc-array','tied-main','pre-cache','pre-strict','pre-warnings','pre-hook','install-arity'])test('preclaim refuses monotonically without callbacks: '+mode,(t)=>{
  const r=invoke(mode);assert.equal(r.o.install,'0');assert.equal(r.o['repeat-install'],'0');assert.equal(r.o.phase,'burned');assert.equal(r.o.claimed,'0');assert.equal(r.o['detach-started'],'0');quiet(r.o);announce(t,r);
});
for(const mode of ['late-input','late-tied-input','late-tied-inc','late-tied-inc-array','late-roots','late-foreign-hook','late-forged-cache'])test('each callback rechecks current full admission before handoff: '+mode,(t)=>{
  const r=invoke(mode);assert.equal(r.o['late-selection'],'0');assert.equal(r.o['late-recheck'],'0');assert.equal(r.o.selected,'0');assert.equal(r.o.phase,'burned');assert.equal(r.o['detach-started'],'0');quiet(r.o);announce(t,r);
});
test('caught unrelated request leaves sticky refusing original hook',(t)=>{const r=invoke('unknown-caught');assert.equal(r.o['unknown-selection'],'0');assert.equal(r.o['after-caught-selection'],'0');assert.equal(r.o['hook-retained'],'1');assert.equal(r.o.phase,'burned');quiet(r.o);announce(t,r);});
test('two literal optional policy denials do not select files or burn',(t)=>{const r=invoke('optional-denials');assert.equal(r.o['optional:Log/Agent.pm'],'0');assert.equal(r.o['optional:Encode/ConfigLocal.pm'],'0');assert.equal(r.o['optional-check'],'1');assert.equal(r.o.phase,'installed');assert.equal(r.o.selected,'0');assert.equal(r.o['denial-log'],'1');assert.equal(r.o['denial-encode'],'1');quiet(r.o);announce(t,r);});
for(const mode of ['compiler-drift','cache-replace','cache-clear','cache-undef','cache-tied','reselection'])test('observed selected history violation burns permanently: '+mode,(t)=>{const r=invoke(mode);const key=mode==='compiler-drift'?'drift-check':mode==='reselection'?'reselection':'changed-cache-check';assert.equal(r.o[key],'0');if(mode.startsWith('cache-'))assert.equal(r.o['restored-cache-check'],'0');assert.equal(r.o.phase,'burned');quiet(r.o);announce(t,r);});
test('64th recheck allowed,65th burns under disclosed counter-boundary model',(t)=>{const r=invoke('recheck-boundary');assert.equal(r.o['boundary-first'],'1');assert.equal(r.o['boundary-second'],'0');assert.equal(r.o['recheck-calls'],'65');assert.equal(r.o.phase,'burned');announce(t,r);});
test('128th optional denial counted,129th request burns under disclosed counter-boundary model',(t)=>{const r=invoke('hook-boundary');assert.equal(r.o['boundary-first'],'0');assert.equal(r.o['boundary-second'],'0');assert.equal(r.o['hook-calls'],'129');assert.equal(r.o['denial-log'],'1');assert.equal(r.o['denial-encode'],'0');assert.equal(r.o.phase,'burned');announce(t,r);});
for(const mode of ['revoke','revoke-unknown','revoke-arity'])test('explicit revoke only settles exact own shape once: '+mode,(t)=>{const r=invoke(mode);assert.equal(r.o.revoke,mode==='revoke'?'1':'0');assert.equal(r.o['repeat-revoke'],'0');assert.equal(r.o['cache-preserved'],'1');assert.equal(r.o['after-revoke-check'],'0');assert.equal(r.o['inc-count'],mode==='revoke'?'2':'3');quiet(r.o);announce(t,r);});

test('owned revoke consumes once intent before unknown-root restoration',(t)=>{const r=invoke('revoke-restore');assert.equal(r.o.revoke,'0');assert.equal(r.o['repeat-revoke'],'0');assert.equal(r.o['inc-count'],'3');assert.equal(r.o['detach-started'],'0');quiet(r.o);announce(t,r);});
test('owned revoke blocks genuine recheck before actual original shift',(t)=>{const r=invoke('revoke-reentrant');assert.equal(r.o.revoke,'1');assert.equal(r.o['during-revoke-check'],'0');assert.equal(r.o['inc-count'],'2');quiet(r.o);announce(t,r);});

test('genuine insert then modeled throw retains native error and postshape across repeat',(t)=>{const r=invoke('insert-after-throw');assert.equal(r.o.install,'0');assert.equal(r.o['insert-delegate-count'],'3');assert.equal(r.o['repeat-install'],'0');assert.equal(r.o['insert-result'],'3');assert.equal(Buffer.from(r.o['insert-native-error'],'hex').toString(),'MODEL_INSERT_AFTER_EFFECT\n');assert.equal(r.o['insert-post-shape'],'1');quiet(r.o);announce(t,r);});

test('same-original insert cannot revive a caught reentrant burn',(t)=>{const r=invoke('insert-reentrant');assert.equal(r.o['insert-nested'],'0');assert.equal(r.o.install,'0');assert.equal(r.o.phase,'burned');quiet(r.o);announce(t,r);});
test('same-original publication cannot hand bytes after caught reentrant burn',(t)=>{const r=invoke('publication-reentrant');assert.equal(r.o['publication-nested'],'0');assert.equal(r.o['publication-call'],'0');assert.equal(r.o.phase,'burned');quiet(r.o);announce(t,r);});

test('genuine checker then modeled input tie never FETCHes unauthenticated slot',(t)=>{const r=invoke('hash-tied-input');assert.equal(r.o['hash-delegate-armed'],'1');assert.equal(r.o.install,'0');assert.equal(r.o['fetch-calls'],'0');quiet(r.o);announce(t,r);});
test('snapshot authentication cannot revive caught reentrant burn before claim',(t)=>{const r=invoke('hash-reentrant');assert.equal(r.o['hash-nested'],'0');assert.equal(r.o.install,'0');assert.equal(r.o.claimed,'0');assert.equal(r.o.phase,'burned');quiet(r.o);announce(t,r);});

test('genuine cached require uses no new source selections',(t)=>{const r=invoke('cached-require');assert.equal(r.o['cached-check'],'1');assert.equal(r.o['cached-count'],'54');assert.equal(r.o.selected,'54');assert.equal(r.o.phase,'installed');quiet(r.o);announce(t,r);});
test('genuine outside overload arms before raw original-self refusal',(t)=>{const r=invoke('overloaded-self');assert.equal(r.o['outside-overload-armed'],'1');assert.equal(r.o['outside-noamagic'],'0');assert.equal(r.o['overloaded-self-selection'],'0');assert.equal(r.o.phase,'burned');quiet(r.o);announce(t,r);});
test('genuine INC publication then modeled throw retains result and error',(t)=>{const r=invoke('publication-after-throw');assert.equal(r.o['publication-call'],'0');assert.equal(r.o['publication-native-path'],'/System/Library/Perl/5.34/strict.pm');assert.equal(r.o['publication-result:strict.pm'],r.o['publication-native-path']);assert.equal(Buffer.from(r.o['publication-error:strict.pm'],'hex').toString(),'MODEL_PUBLICATION_AFTER_EFFECT\n');assert.equal(r.o.selected,'1');assert.equal(r.o.phase,'burned');quiet(r.o);announce(t,r);});
for(const mode of ['detach-after-throw','detach-before-throw'])test('once detach retains independent postshape after modeled error: '+mode,(t)=>{const r=invoke(mode);assert.equal(r.o.revoke,'0');assert.equal(r.o['repeat-revoke'],'0');assert.equal(r.o['detach-started'],'1');assert.equal(r.o['owned-revoke-attempted'],'1');assert.equal(r.o['detach-post-shape'],mode==='detach-after-throw'?'1':'0');assert.equal(r.o['inc-count'],mode==='detach-after-throw'?'2':'3');assert.equal(Buffer.from(r.o['detach-error'],'hex').toString(),mode==='detach-after-throw'?'MODEL_DETACH_AFTER_EFFECT\n':'MODEL_DETACH_BEFORE_EFFECT\n');quiet(r.o);announce(t,r);});

test('buffered strict bytes survive actual owned PM/PMC replacement window',(t)=>{const r=invoke('buffer-window');const armed=pathnameControl(r.home);assert.equal(armed.version,'MODELED_PMC');assert.equal(armed.cache,r.home+'/strict.pm');assert.equal(r.o['strict-version'],'1.12');assert.equal(r.o['strict-cache'],r.home+'/strict.pm');assert.equal(r.o['runtime-check'],'1');assert.equal(r.o['after-gzip-check'],'1');assert.equal(r.o.phase,'installed');quiet(r.o);announce(t,r);});
test('failed new preclaim and unclaimed revoke preserve earlier genuine one-key realm',(t)=>{const r=invoke('prior-genuine-realm');assert.equal(r.o['prior-check-before'],'1');assert.equal(r.o.install,'0');assert.equal(r.o.claimed,'0');assert.equal(r.o['unclaimed-revoke'],'1');assert.equal(r.o['prior-check-after'],'1');assert.equal(r.o['detach-started'],'0');quiet(r.o);announce(t,r);});
for(const failure of ['throw','false','restore-before-observation'])test('actual compiler outcome remains separately owned: modeled '+failure,(t)=>{
  const strict=rows.find(r=>r.key==='strict.pm');const prefix='CORE::print "compiler-entered\\t1\\n";\n';
  const ending=failure==='false'?'0;\n':'CORE::die "MODEL_NATIVE_COMPILER_THROW\\n";\n';
  const candidate=Buffer.from(prefix+'#'+'x'.repeat(strict.bytes-Buffer.byteLength(prefix+ending)-2)+'\n'+ending);
  const beforeUse=String.raw`BEGIN {
    my $compiled=eval {require 'strict.pm';1;};my $error=$@;
    CORE::print "compiler-failed\t",$compiled?0:1,"\n";
    CORE::print "compiler-error-matched\t",CORE::index($error,EXPECTED)>=0?1:0,"\n";
    BEFORE
    my $checked=eval {$pm_loader_recheck->();1;};CORE::print "compiler-observed-check\t",$checked?1:0,"\n";
    CORE::delete($INC{'strict.pm'});$INC{'strict.pm'}='/System/Library/Perl/5.34/strict.pm';
    my $restored=eval {$pm_loader_recheck->();1;};CORE::print "compiler-restored-check\t",$restored?1:0,"\n";
    $pm_test_probe->(0);CORE::exit(0);
}
`.replace('EXPECTED',quote(failure==='false'?'did not return a true value':'MODEL_NATIVE_COMPILER_THROW')).replace('BEFORE',failure==='restore-before-observation'?"CORE::delete($INC{'strict.pm'});$INC{'strict.pm'}='/System/Library/Perl/5.34/strict.pm';":'');
  const r=invoke('compiler-'+failure,{candidateKey:'strict.pm',candidate,beforeUse});
  assert.equal(r.o['compiler-entered'],'1');assert.equal(r.o['compiler-failed'],'1');assert.equal(r.o['compiler-error-matched'],'1');
  assert.equal(r.o['compiler-observed-check'],failure==='restore-before-observation'?'1':'0');assert.equal(r.o['compiler-restored-check'],failure==='restore-before-observation'?'1':'0');
  assert.equal(r.o.phase,failure==='restore-before-observation'?'installed':'burned');quiet(r.o);announce(t,r);
});

for(const mode of ['argument-arity','argument-tied-self','argument-tied-key','argument-reference-key','argument-zero-class-key','argument-utf8-key','argument-empty-key','argument-long-key','argument-foreign-self','late-tied-root','late-tied-cache'])test('original callback refuses guarded arguments/current cells before handoff: '+mode,(t)=>{const r=invoke(mode);assert.equal(r.o[mode.startsWith('argument-')?'argument-selection':'late-selection'],'0');assert.equal(r.o.selected,'0');assert.equal(r.o.phase,'burned');quiet(r.o);announce(t,r);});

function pathnameControl(home) {
  const program=String.raw`BEGIN {
    CORE::die "TEST_ORDINARY_ONLY\n" unless $^O eq 'darwin'&&$<!=0&&$<==$>&&@ARGV==0;
    @INC=(HOME,'/System/Library/Perl/5.34/darwin-thread-multi-2level','/System/Library/Perl/5.34');
}
require 'strict.pm';
CORE::print "version\t",$strict::VERSION,"\n";
CORE::print "cache\t",$INC{'strict.pm'},"\n";
CORE::exit(0);
`.replace('HOME',quote(home));
  const fixtures=Object.fromEntries(['strict.pm','strict.pmc'].map(file=>[file,sha(fs.readFileSync(home+'/'+file))]));
  fs.writeFileSync(home+'/pathname-control.pl',program,{flag:'wx',mode:0o600});
  const argv=['/usr/bin/perl','-f',home+'/pathname-control.pl'];const env={PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'};
  fs.writeFileSync(home+'/pathname-creation.json',JSON.stringify({argv,cwd:'/',env,programSHA256:sha(program),fixtures,scope:'ordinary owned pathname selection arming only; no bootstrap/Root/native authority'})+'\n',{flag:'wx',mode:0o600});
  const child=spawnSync(argv[0],argv.slice(1),{cwd:'/',env,encoding:'utf8',maxBuffer:65536,timeout:30000});
  fs.writeFileSync(home+'/pathname-stdout.log',child.stdout??'',{flag:'wx',mode:0o600});fs.writeFileSync(home+'/pathname-stderr.log',child.stderr??'',{flag:'wx',mode:0o600});
  fs.writeFileSync(home+'/pathname-terminal.json',JSON.stringify({pid:child.pid,status:child.status,signal:child.signal,error:child.error?.code??null})+'\n',{flag:'wx',mode:0o600});
  assert.equal(child.error,undefined);assert.equal(child.signal,null);assert.equal(child.status,0,child.stderr);assert.equal(child.stderr,'');
  for(const file of Object.keys(fixtures))assert.equal(sha(fs.readFileSync(home+'/'+file)),fixtures[file]);
  const entries=child.stdout.trim().split('\n').map(line=>line.split('\t'));assert.ok(entries.every(e=>e.length===2));assert.equal(new Set(entries.map(e=>e[0])).size,entries.length);
  const result=Object.fromEntries(entries);fs.writeFileSync(home+'/pathname-witness.json',JSON.stringify({pid:child.pid,observations:result,fixtures})+'\n',{flag:'wx',mode:0o600});return result;
}

test('final genuine input predicate cannot revive caught burn immediately before claim',(t)=>{const r=invoke('preclaim-reentrant');assert.equal(r.o['preclaim-nested'],'0');assert.equal(r.o.install,'0');assert.equal(r.o.claimed,'0');assert.equal(r.o.phase,'burned');quiet(r.o);announce(t,r);});
