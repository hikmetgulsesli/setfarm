# Cold entry stays closed before any candidate PM/XS import.
BEGIN {
    CORE::print STDERR "TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n";
    CORE::exit(2);
}
BEGIN {
    @INC=('/System/Library/Perl/5.34/darwin-thread-multi-2level',
        '/System/Library/Perl/5.34');
}
# Private mathematical prerequisite only. No production invocation or material
# admission. Installed at compile time; ordinary tests call it in memory BEGIN.
my $preimport_sha256;
BEGIN {
    my $preimport_utf8_original=\&utf8::is_utf8;
    $preimport_sha256=sub {
        CORE::die "TASK6A_PREIMPORT_BYTES_REFUSED\n" unless @_==1
            &&!defined(CORE::tied($_[0]));
        my $plain=$_[0];
        CORE::die "TASK6A_PREIMPORT_BYTES_REFUSED\n" unless defined($plain)
            &&CORE::ref($plain) eq ''&&!$preimport_utf8_original->($plain);
        my $length=CORE::length($plain);
        CORE::die "TASK6A_PREIMPORT_BYTES_REFUSED\n" if $length>524288;
        # FIPS180-4 4.2.2,5.1.1,5.3.3,6.2: fixed32-bit words and64-byte blocks.
        # The literal ceiling keeps the encoded bit length below2^32.
        my $bytes=$plain."\x80".("\0" x ((55-$length%64+64)%64))
            .CORE::pack('NN',0,$length*8);
        my @hash=(0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,
            0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19);
        my @constant=(
            0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
            0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
            0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
            0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
            0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
            0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
            0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
            0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2);
        for(my $offset=0;$offset<CORE::length($bytes);$offset+=64) {
            my @word=CORE::unpack('N16',CORE::substr($bytes,$offset,64));
            for my $index(16..63) {
                my ($x,$y)=($word[$index-15],$word[$index-2]);
                my $s0=(($x>>7)|($x<<25))^(($x>>18)|($x<<14))^($x>>3);
                my $s1=(($y>>17)|($y<<15))^(($y>>19)|($y<<13))^($y>>10);
                $word[$index]=($word[$index-16]+($s0&0xffffffff)
                    +$word[$index-7]+($s1&0xffffffff))&0xffffffff;
            }
            my ($a,$b,$c,$d,$e,$f,$g,$h)=@hash;
            for my $index(0..63) {
                my $s1=(($e>>6)|($e<<26))^(($e>>11)|($e<<21))^(($e>>25)|($e<<7));
                my $choose=($e&$f)^((~$e)&$g);
                my $t1=($h+($s1&0xffffffff)+$choose+$constant[$index]+$word[$index])&0xffffffff;
                my $s0=(($a>>2)|($a<<30))^(($a>>13)|($a<<19))^(($a>>22)|($a<<10));
                my $majority=($a&$b)^($a&$c)^($b&$c);
                my $t2=(($s0&0xffffffff)+$majority)&0xffffffff;
                ($a,$b,$c,$d,$e,$f,$g,$h)=(($t1+$t2)&0xffffffff,$a,$b,$c,
                    ($d+$t1)&0xffffffff,$e,$f,$g);
            }
            my @working=($a,$b,$c,$d,$e,$f,$g,$h);
            for my $index(0..7) {$hash[$index]=($hash[$index]+$working[$index])&0xffffffff;}
        }
        return CORE::unpack('H*',CORE::pack('N8',@hash));
    };
}
# Inert one-key compiler-byte prerequisite. No production readback issuer or
# invocation exists. Ordinary controls initialize private state only in memory.
my ($strict_completed_readback,$strict_loader_install,$strict_loader_recheck);
my $strict_same_reference;
{
    # Perl5.34 HINT_NO_AMAGIC; lexical scope restores the outside hints.
    BEGIN {$^H|=0x01000000;CORE::delete($^H{'overloading'});}
    BEGIN {
        $strict_same_reference=sub {
            return 0 unless @_==2&&!defined(CORE::tied($_[0]))
                &&!defined(CORE::tied($_[1]));
            my ($candidate,$original)=@_;
            return 0 unless CORE::ref($candidate) ne ''
                &&CORE::ref($original) ne '';
            return $candidate==$original?1:0;
        };
    }
}
BEGIN {
    my $utf8_original=\&utf8::is_utf8;
    my $phase='new';my $calls=0;my ($authenticated,$original_hook);
    my $refuse=sub {$phase='burned';CORE::die "TASK6A_STRICT_BYTES_REFUSED\n";};
    my $containers=sub {
        $refuse->() if defined(CORE::tied(%INC))||defined(CORE::tied(@INC));
    };
    my $validate=sub {
        $refuse->() unless @_==1&&!defined(CORE::tied($_[0]));
        my $bytes=$_[0];
        $refuse->() unless defined($bytes)&&CORE::ref($bytes) eq ''
            &&!$utf8_original->($bytes)&&CORE::length($bytes)==4783;
        my $digest;my $ok=eval {$digest=$preimport_sha256->($bytes);1;};
        $refuse->() unless $ok&&$digest eq
            'f1296224730dceb5dd308ee1e72c452c8b13ced7f3bf742ccd16e1e1c416bcb5';
        return 1;
    };
    $original_hook=sub {
        $refuse->() unless $phase eq 'installed'||$phase eq 'selected';
        $containers->();
        $refuse->() unless @_==2&&!defined(CORE::tied($_[0]))
            &&!defined(CORE::tied($_[1]))
            &&$strict_same_reference->($_[0],$original_hook);
        my $filename=$_[1];
        $refuse->() unless defined($filename)&&CORE::ref($filename) eq ''
            &&!$utf8_original->($filename)&&CORE::length($filename)>0
            &&CORE::length($filename)<=4096;
        $refuse->() if ++$calls>128;
        return () unless $filename eq 'strict.pm';
        $refuse->() unless $phase eq 'installed';
        # Fresh selection-local SV; authenticate this exact SV at handoff.
        my $compiler_bytes=CORE::substr($authenticated,0);
        $validate->($compiler_bytes);
        $phase='selected';
        return \$compiler_bytes;
    };
    $strict_loader_install=sub {
        $refuse->() unless @_==0&&$phase eq 'new';
        $containers->();
        $refuse->() if defined(CORE::tied(%main::));
        $refuse->() if CORE::exists($INC{'strict.pm'})
            ||CORE::exists($main::{'strict::'});
        $refuse->() if defined(CORE::tied($strict_completed_readback));
        my $plain=$strict_completed_readback;
        $validate->($plain);
        $authenticated=CORE::substr($plain,0);
        my $ok=eval {CORE::unshift(@INC,$original_hook);1;};
        $refuse->() unless $ok;
        $phase='installed';return 1;
    };
    $strict_loader_recheck=sub {
        $refuse->() unless @_==0&&$phase eq 'selected';
        # A failed native require can leave a non-creatable cache entry. Even
        # its tied-lvalue inspection may croak; every such failure must burn.
        my $ok=eval {
            $containers->();
            $refuse->() unless CORE::exists($INC{'strict.pm'})
                &&!defined(CORE::tied($INC{'strict.pm'}))
                &&$strict_same_reference->($INC{'strict.pm'},$original_hook);
            1;
        };
        $refuse->() unless $ok;
        return 1;
    };
}
# Inert fixed native readback prerequisite. No production invocation or Root
# admission. Initial native/kernel/MAC trust is a separately qualified premise.
my ($strict_native_readback_issue,$strict_native_readback_recheck,$strict_native_readback_release);
{
    BEGIN {$^H|=0x01000000;CORE::delete($^H{'overloading'});}
    BEGIN {
        my $utf8_original=\&utf8::is_utf8;
        my $installer_original=$strict_loader_install;
        my $phase='new';my $claimed=0;my $revoked=0;
        my ($revocation_outcome,$revocation_error);
        my ($issue_error,$recheck_error,$release_error,$burn_revoke_error);
        my $operations=0;my $rechecks=0;my $close_started=0;my $close_outcome;
        my $validated;my @originals;
        my @paths=('/','/System','/System/Library','/System/Library/Perl',
            '/System/Library/Perl/5.34','/System/Library/Perl/5.34/strict.pm');
        my $literal_refusal="TASK6A_NATIVE_READBACK_REFUSED\n";
        my $charge=sub {
            CORE::die $literal_refusal unless @_==0&&++$operations<=8192;
        };
        my $plain=sub {
            return 0 unless @_==1&&!defined(CORE::tied($_[0]));
            my $value=$_[0];return defined($value)&&CORE::ref($value) eq ''
                &&!$utf8_original->($value)?1:0;
        };
        my $shape=sub {
            CORE::die $literal_refusal unless @_==1&&!defined(CORE::tied($_[0]));
            my $handle=$_[0];CORE::die $literal_refusal unless CORE::ref($handle) ne '';
            # Native PVGV/PVIO shape, no overloaded dereference or class-name proof.
            my $io=*{$handle}{IO};
            CORE::die $literal_refusal unless defined($io)&&CORE::ref($io) ne ''
                &&!defined(CORE::tied(*{$handle}));
            return ($handle,$io);
        };
        my $same=sub {
            CORE::die $literal_refusal unless @_==1;
            my $record=$_[0];
            my ($handle,$io)=$shape->(${ $record->{cell} });
            CORE::die $literal_refusal unless $strict_same_reference->($handle,$record->{handle})
                &&$strict_same_reference->($io,$record->{io});
            return $handle;
        };
        my $tuple=sub {
            CORE::die $literal_refusal unless @_==2;
            my ($values,$file)=@_;
            CORE::die $literal_refusal unless @$values==13;
            for my $value(@$values) {
                CORE::die $literal_refusal unless $plain->($value)
                    &&$value=~/\A(?:0|[1-9][0-9]{0,19}|-[1-9][0-9]{0,18})\z/;
            }
            CORE::die $literal_refusal unless ($values->[2]&0170000)==($file?0100000:0040000)
                &&($values->[2]&0022)==0&&$values->[4]==0&&$values->[5]==0;
            CORE::die $literal_refusal if $file&&$values->[7]!=4783;
        };
        my $equal_tuple=sub {
            CORE::die $literal_refusal unless @_==2;
            my ($a,$b)=@_;
            for my $index(0..7,9..12) {CORE::die $literal_refusal unless $a->[$index]==$b->[$index];}
        };
        my $acl=sub {
            CORE::die $literal_refusal unless @_==2;
            my ($handle,$record)=@_;my $fd=CORE::fileno($handle);
            CORE::die $literal_refusal unless $plain->($fd)
                &&$fd=~/\A(?:0|[1-9][0-9]{0,9})\z/&&$fd<=2147483647;
            for my $kind('capabilities','security') {
                my $attributes=CORE::pack('SSLLLLL',5,0,$kind eq 'security'?0x00400000:0,
                    $kind eq 'capabilities'?0x80020000:0,0,0,0);
                my $buffer="\xcc" x 8192;
                my $packet={kind=>$kind,attributes=>$attributes,buffer_cell=>\$buffer};
                CORE::push(@{$record->{acl_reads}},$packet);$!=0;$charge->();
                my ($result,$errno);my $native_ok=eval {
                    $result=CORE::syscall(228,$fd,$attributes,$buffer,8192,4);$errno=0+$!;1;
                };
                $packet->{error}=$@;$packet->{result}=$result;$packet->{errno}=$errno;
                CORE::die $literal_refusal unless $native_ok&&$plain->($result)&&$result eq '0'&&$errno==0
                    &&$plain->($buffer)&&CORE::length($buffer)==8192;
                if($kind eq 'security') {
                    CORE::die $literal_refusal unless CORE::substr($buffer,0,12) eq CORE::pack('LLL',12,8,0)
                        &&CORE::substr($buffer,12) eq "\xcc" x 8180;
                } else {
                    CORE::die $literal_refusal unless CORE::unpack('L',CORE::substr($buffer,0,4))==36
                        &&CORE::substr($buffer,36) eq "\xcc" x 8156;
                    my @cap=CORE::unpack('L8',CORE::substr($buffer,4,32));
                    CORE::die $literal_refusal unless ($cap[1]&0x400)&&($cap[5]&0x400);
                }
            }
        };
        my $check_originals=sub {
            CORE::die $literal_refusal unless @_==0&&@originals==6;
            for my $record(@originals) {
                CORE::die $literal_refusal unless $record->{known}&&!$record->{close_attempted};
                my $handle=$same->($record);$charge->();my @held=CORE::stat($handle);
                $charge->();my @named=CORE::lstat($record->{path});
                CORE::push(@{$record->{metadata}}, {held=>[@held],named=>[@named]});
                $tuple->(\@held,$record->{file});$tuple->(\@named,$record->{file});
                $equal_tuple->(\@held,$record->{tuple});$equal_tuple->(\@held,\@named);
                $acl->($handle,$record);
            }
        };
        my $read=sub {
            CORE::die $literal_refusal unless @_==1;
            my $record=$_[0];my $handle=$same->($record);
            my $seek_record={};CORE::push(@{$record->{seeks}},$seek_record);$charge->();
            my $offset;my $seek_ok=eval {$offset=CORE::sysseek($handle,0,0);1;};
            $seek_record->{error}=$@;$seek_record->{result}=$offset;
            CORE::die $literal_refusal unless $seek_ok&&$plain->($offset)
                &&($offset eq '0'||$offset eq '0 but true');
            my ($bytes,$extra);my $read_record={bytes_cell=>\$bytes,extra_cell=>\$extra};
            CORE::push(@{$record->{reads}},$read_record);
            my ($count,$eof);$charge->();
            my $count_ok=eval {$count=CORE::sysread($handle,$bytes,4784);1;};
            $read_record->{count_error}=$@;$read_record->{count}=$count;
            CORE::die $literal_refusal unless $count_ok&&$plain->($count)&&$count eq '4783'&&$plain->($bytes)
                &&CORE::length($bytes)==4783;
            $charge->();my $eof_ok=eval {$eof=CORE::sysread($handle,$extra,1);1;};
            $read_record->{eof_error}=$@;$read_record->{eof}=$eof;
            CORE::die $literal_refusal unless $eof_ok&&$plain->($eof)&&$eof eq '0'&&$plain->($extra)
                &&CORE::length($extra)==0;
            CORE::die $literal_refusal unless $preimport_sha256->($bytes) eq
                'f1296224730dceb5dd308ee1e72c452c8b13ced7f3bf742ccd16e1e1c416bcb5';
            return CORE::substr($bytes,0);
        };
        my $revoke=sub {
            return unless $claimed;
            unless($revoked) {
                $revoked=1;
                my $ok=eval {$installer_original->(undef);1;};$revocation_error=$@;
                $revocation_outcome=(!$ok&&$plain->($revocation_error)
                    &&$revocation_error eq "TASK6A_STRICT_BYTES_REFUSED\n")?1:0;
            }
            CORE::die $literal_refusal unless $revocation_outcome;
            # Unknown late values stay retained; never destroy or STORE through
            # a foreign handoff while settling this issuer's known originals.
            $strict_completed_readback=undef if $plain->($strict_completed_readback)
                &&defined($validated)&&$strict_completed_readback eq $validated;
        };
        my $settle=sub {
            return $close_outcome if $close_started;
            $close_started=1;my $all=1;
            for my $record(CORE::reverse(@originals)) {
                unless($record->{known}) {$all=0;next;}
                $record->{close_started}=1;
                my ($handle,$io);my $admitted=eval {
                    # Known original, not a changed output cell or IO alias.
                    ($handle,$io)=$shape->($record->{handle});
                    CORE::die $literal_refusal unless $strict_same_reference->($handle,$record->{handle})
                        &&$strict_same_reference->($io,$record->{io});
                    1;
                };
                $record->{close_admission_error}=$@;
                unless($admitted) {$record->{close_ok}=0;$record->{live_ok}=0;$all=0;next;}
                $record->{close_attempted}=1;
                my $closed;my $close_ok=eval {$closed=CORE::close($handle);1;};
                $record->{close_error}=$@;$record->{close_return}=$closed;
                # Independently inspect this known original after a close throw;
                # changed/tied shape stays unknown without fileno callbacks.
                my $live;my $live_ok=eval {
                    my ($after_handle,$after_io)=$shape->($record->{handle});
                    CORE::die $literal_refusal unless $strict_same_reference->($after_handle,$record->{handle})
                        &&$strict_same_reference->($after_io,$record->{io});
                    $live=CORE::fileno($after_handle);1;
                };
                $record->{live_error}=$@;$record->{live_return}=$live;$record->{live_ok}=$live_ok?1:0;
                my $ok=$close_ok&&$plain->($closed)&&$closed eq '1'&&$live_ok&&!defined($live);
                $record->{close_ok}=$ok?1:0;$all=0 unless $ok;
            }
            $close_outcome=$all?1:0;return $close_outcome;
        };
        my $burn=sub {
            $phase='burned';
            my $revoke_ok=eval {$revoke->();1;};$burn_revoke_error=$@;
            $settle->() if $claimed;
            CORE::die $literal_refusal;
        };
        $strict_native_readback_issue=sub {
            $burn->() unless @_==0&&$phase eq 'new';
            my $ok=eval {
                CORE::die $literal_refusal if defined(CORE::tied(%INC))||defined(CORE::tied(@INC))
                    ||defined(CORE::tied(%main::))||defined(CORE::tied($strict_completed_readback));
                CORE::die $literal_refusal unless CORE::keys(%INC)==0&&@INC==2
                    &&!defined(CORE::tied($INC[0]))&&!defined(CORE::tied($INC[1]))
                    &&$plain->($INC[0])&&$plain->($INC[1])
                    &&$INC[0] eq '/System/Library/Perl/5.34/darwin-thread-multi-2level'
                    &&$INC[1] eq '/System/Library/Perl/5.34'
                    &&!defined($strict_completed_readback)&&!CORE::exists($main::{'strict::'});
                $claimed=1;$phase='acquiring';
                CORE::die $literal_refusal unless $^O eq 'darwin'
                    &&CORE::unpack('H*',CORE::pack('L',1)) eq '01000000'
                    &&CORE::length(CORE::pack('J',1))==8;
                for my $index(0..5) {
                    my $path=$paths[$index];
                    my $fh;my $record={path=>$path,cell=>\$fh,file=>$index==5?1:0,known=>0,
                        close_attempted=>0,open_started=>0,reads=>[],seeks=>[],acl_reads=>[],metadata=>[]};
                    CORE::push(@originals,$record);$charge->();my @before=CORE::lstat($path);
                    $record->{before}=[@before];$tuple->(\@before,$record->{file});$charge->();
                    $record->{open_started}=1;
                    my $opened;my $open_ok=eval {$opened=CORE::sysopen($fh,$path,0x01000100);1;};
                    $record->{open_error}=$@;$record->{open_return}=$opened;
                    CORE::die $literal_refusal unless $open_ok&&$plain->($opened)&&$opened eq '1';
                    my ($handle,$io)=$shape->($fh);
                    $record->{handle}=$handle;$record->{io}=$io;$record->{known}=1;
                    $charge->();my @held=CORE::stat($handle);
                    $record->{held_initial}=[@held];
                    $tuple->(\@held,$record->{file});
                    $equal_tuple->(\@before,\@held);$record->{tuple}=[@held];$acl->($handle,$record);
                }
                $validated=$read->($originals[5]);$check_originals->();
                $strict_completed_readback=CORE::substr($validated,0);$phase='held';1;
            };
            $issue_error=$@;$burn->() unless $ok;return 1;
        };
        $strict_native_readback_recheck=sub {
            $burn->() unless @_==0&&$phase eq 'held'&&++$rechecks<=64;
            my $ok=eval {
                $check_originals->();my $bytes=$read->($originals[5]);
                CORE::die $literal_refusal unless $bytes eq $validated;
                $check_originals->();1;
            };
            $recheck_error=$@;$burn->() unless $ok;return 1;
        };
        $strict_native_readback_release=sub {
            $burn->() unless @_==0;
            return $close_outcome if $phase eq 'released';
            unless($claimed) {$phase='released';$close_outcome=1;return 1;}
            my $ok=eval {$revoke->();1;};$release_error=$@;my $closed=$settle->();
            $burn->() unless $ok&&$closed;
            $phase='released';return 1;
        };
    }
}
# Inert fixed PM source-selection prerequisite. No production invocation,
# native issuer, compiler-result owner or initial-runtime admission exists.
my $pm_loader_native_state;
my @pm_completed_readbacks;
my ($pm_loader_install,$pm_loader_recheck,$pm_loader_revoke);
{
    BEGIN {$^H|=0x01000000;CORE::delete($^H{'overloading'});}
    BEGIN {
        my $utf8_original=\&utf8::is_utf8;
        my $checker_original=$preimport_sha256;
        my $same_original=$strict_same_reference;
        my @material=(
            ['Carp.pm','/System/Library/Perl/5.34/Carp.pm',35985,'020bba236b44c482c8a401b5f6676c0b5d27a76caaf7cae41dfb7a63b00488b3'],
            ['Digest/base.pm','/System/Library/Perl/5.34/Digest/base.pm',1984,'06367faa5fb46a5794d3d7603d52075ab1533ad848184a5309a1cfac1058281a'],
            ['Exporter.pm','/System/Library/Perl/5.34/Exporter.pm',18774,'073f49928a471678e14ce5c314aef306a93a58870dba423ff2f630d1de782cad'],
            ['Exporter/Heavy.pm','/System/Library/Perl/5.34/Exporter/Heavy.pm',6530,'e53ad090aaa655b01ad1cff2af2daf6c92020ed349f9d48d55109cd1d142f6a0'],
            ['File/GlobMapper.pm','/System/Library/Perl/5.34/File/GlobMapper.pm',15683,'1fc0b84c8fa4fc5b3cad7ae0a638a8fd3736efd5416c31afcc8ae58a03d525b3'],
            ['IO/Compress/Base/Common.pm','/System/Library/Perl/5.34/IO/Compress/Base/Common.pm',22774,'7dbfdfdf0851619f00d98f5958203fd4ea9535ef008a87eec5cd19cd039710e5'],
            ['IO/Compress/Gzip/Constants.pm','/System/Library/Perl/5.34/IO/Compress/Gzip/Constants.pm',3883,'108fdebbb31a16c6ff3ff2e9fb3220e197aa79ba9f7e995073da40da956315b3'],
            ['IO/Compress/Zlib/Extra.pm','/System/Library/Perl/5.34/IO/Compress/Zlib/Extra.pm',5647,'57934980c670ff320d15164647da794882b9d3edee4d1586495f91dca4c9ed01'],
            ['IO/Uncompress/Adapter/Inflate.pm','/System/Library/Perl/5.34/IO/Uncompress/Adapter/Inflate.pm',3259,'e93c905f15ba91ed6ef8cae083ed0cfd860bcbfcb763592e722a2e529ff5989b'],
            ['IO/Uncompress/Base.pm','/System/Library/Perl/5.34/IO/Uncompress/Base.pm',38337,'adcbe73669c2f03ddce11fe3234b39e26057c9c7b8283ce4bf2e4d21ff64893a'],
            ['IO/Uncompress/Gunzip.pm','/System/Library/Perl/5.34/IO/Uncompress/Gunzip.pm',32152,'f9cf9da150abe298dc8efa76e4cd385b641c377afb567db1d643e540ea3295ab'],
            ['IO/Uncompress/RawInflate.pm','/System/Library/Perl/5.34/IO/Uncompress/RawInflate.pm',31841,'efa06d6eca40888d6f1f9bd3487339d9bbb788c823118171655701617bc922b8'],
            ['JSON/PP.pm','/System/Library/Perl/5.34/JSON/PP.pm',100527,'b256804d959880439ce3e5b82497d01c080228276ae55979d3ababee48293a89'],
            ['JSON/PP/Boolean.pm','/System/Library/Perl/5.34/JSON/PP/Boolean.pm',810,'264db0a8de27d592dceb964bbaab9a05a65197855a7bfd4f10ed20d14f86f379'],
            ['PerlIO.pm','/System/Library/Perl/5.34/PerlIO.pm',14441,'183d8cc5992cd8197bd0621f0ac1c2346104327ecc4e7ccb53c26145481822b6'],
            ['SelectSaver.pm','/System/Library/Perl/5.34/SelectSaver.pm',1076,'b951b99c894f701eac08b79265ff2ccbede0954f97a537d03fb78801ed645861'],
            ['Symbol.pm','/System/Library/Perl/5.34/Symbol.pm',4905,'bd0e0df0aa0b830f87c2a991b3989abae21c9e9dce4edb2abc7125c3c7693621'],
            ['Tie/Hash.pm','/System/Library/Perl/5.34/Tie/Hash.pm',7639,'12e565ea59a4a3a332d8fefa40a654f9482014c145f165bef3d065a59daee55a'],
            ['XSLoader.pm','/System/Library/Perl/5.34/XSLoader.pm',11398,'c6efc1f25e87fb1c2343d471b868af1a755df601985065dbd22e22273d6b2192'],
            ['bytes.pm','/System/Library/Perl/5.34/bytes.pm',3782,'7e3a78b180565c3caafa7f3dd5913acb91b06fe7c9f802bf948eb5a962df00f0'],
            ['constant.pm','/System/Library/Perl/5.34/constant.pm',14724,'e67cdfa533d42cbe5265bcf3c270f055620cba38a9295b5d584b7efc37a0c156'],
            ['B.pm','/System/Library/Perl/5.34/darwin-thread-multi-2level/B.pm',30093,'cf275fdd78b25aa726b0068003aee6e08cd380f2aea1378efbb8fe268d6bc95a'],
            ['Compress/Raw/Zlib.pm','/System/Library/Perl/5.34/darwin-thread-multi-2level/Compress/Raw/Zlib.pm',47387,'7b9321c1d13ab20c19e2bd0deafc09a0c3fa30f526c68078145d9409f2ab2bc6'],
            ['Config.pm','/System/Library/Perl/5.34/darwin-thread-multi-2level/Config.pm',3886,'e85c38637cedf6a9e29e6946201fbefeceba184e07b720b976c068ecab4d7283'],
            ['Digest/SHA.pm','/System/Library/Perl/5.34/darwin-thread-multi-2level/Digest/SHA.pm',22174,'15efed6020da9028a7a5b2d41d7e6d8e6b1719aeae365bc592ffb4025f76d33d'],
            ['DynaLoader.pm','/System/Library/Perl/5.34/darwin-thread-multi-2level/DynaLoader.pm',25540,'dde9744d54a185e1d38d52c98bf9349a83360d5fb31c82904e28d514a87c79fe'],
            ['Encode.pm','/System/Library/Perl/5.34/darwin-thread-multi-2level/Encode.pm',32075,'134fddc376de04a40dea58e6055f7ce28bc4159487a47c260ac8feaf04201a54'],
            ['Encode/Alias.pm','/System/Library/Perl/5.34/darwin-thread-multi-2level/Encode/Alias.pm',12545,'9ec57c436578d4c67b269c53dcb70db64bf845b7ba294da2b8fb998bc00a45ea'],
            ['Encode/Config.pm','/System/Library/Perl/5.34/darwin-thread-multi-2level/Encode/Config.pm',6065,'a15072cf84ac4a431b91b1a893a7c8d4c4dd48adefa077cd3a9b271cf0aba3bf'],
            ['Encode/Encoding.pm','/System/Library/Perl/5.34/darwin-thread-multi-2level/Encode/Encoding.pm',9063,'1daaf4400c4462c24d785b7eb91fbebc6eb868192aad410df48019fe7af6e39d'],
            ['Encode/MIME/Name.pm','/System/Library/Perl/5.34/darwin-thread-multi-2level/Encode/MIME/Name.pm',3821,'1cabed37ee26cfd763999649f9ac9a5f1e5a81cbc5125b8d85ff19d60b72f906'],
            ['Fcntl.pm','/System/Library/Perl/5.34/darwin-thread-multi-2level/Fcntl.pm',4044,'80511e494fc719cb63d252a95987ba24c04557947c1bf1584f5eeb6704786e9b'],
            ['File/Glob.pm','/System/Library/Perl/5.34/darwin-thread-multi-2level/File/Glob.pm',12712,'ff854e2cccfcd78e6c22278c843ea61fda1d0164704b1aa8941fe05ff9dbbfe8'],
            ['IO.pm','/System/Library/Perl/5.34/darwin-thread-multi-2level/IO.pm',1462,'d1db057bb61c36632e97e7216733ddf70ccd367f1f32393f9d7a4248cc4ec07e'],
            ['IO/File.pm','/System/Library/Perl/5.34/darwin-thread-multi-2level/IO/File.pm',4872,'133658ff1c17332f46d01d34f872b71309c715656b47f39e31393e2d10d827e4'],
            ['IO/Handle.pm','/System/Library/Perl/5.34/darwin-thread-multi-2level/IO/Handle.pm',16641,'af3d3b9f9bc2132644248480d21b2e7e5c1a7e0d7a3c1f121e89888a2153b9f1'],
            ['IO/Seekable.pm','/System/Library/Perl/5.34/darwin-thread-multi-2level/IO/Seekable.pm',2891,'ce170c83abf1a599320c0f4369c8e6e123310b4603ac3791bee0e733d9e8e533'],
            ['IO/Select.pm','/System/Library/Perl/5.34/darwin-thread-multi-2level/IO/Select.pm',9263,'a6804f44f8c90c88f8cc60cdd38538f65f3f92ce533fcda6933887c7228ad5d7'],
            ['List/Util.pm','/System/Library/Perl/5.34/darwin-thread-multi-2level/List/Util.pm',24055,'0d3135c14b4d4156a0de8156f2d33f54c6f0b6233b2f6fe5d4b9122e9fef1a5a'],
            ['MIME/Base64.pm','/System/Library/Perl/5.34/darwin-thread-multi-2level/MIME/Base64.pm',5433,'dfb1e3876b3e7f3cf9a3f23123c37464617e551802e618e54cabd7890c986cc8'],
            ['POSIX.pm','/System/Library/Perl/5.34/darwin-thread-multi-2level/POSIX.pm',20384,'d941cf37b6dee5253b859cbb703a5785629a0bcdd86f61d1ec96fa464d69df90'],
            ['PerlIO/scalar.pm','/System/Library/Perl/5.34/darwin-thread-multi-2level/PerlIO/scalar.pm',1069,'a4205c837c331d7945f0221600ae8b4bf6ea562812c71b535ac06693de26a859'],
            ['Scalar/Util.pm','/System/Library/Perl/5.34/darwin-thread-multi-2level/Scalar/Util.pm',10189,'9ba58fcbefc535a73d3fc0da949d0fb1e524411dea4e8bee97529700607a98a4'],
            ['Storable.pm','/System/Library/Perl/5.34/darwin-thread-multi-2level/Storable.pm',49923,'4a9ab42a68de934079da007e8df0ae3c66f33477c3f3218782596a83e3ea508c'],
            ['Time/HiRes.pm','/System/Library/Perl/5.34/darwin-thread-multi-2level/Time/HiRes.pm',25689,'9bc6ece12a90e5c01d784a4efd672c49b8a7551ce6871b620efbd38cd4960f34'],
            ['integer.pm','/System/Library/Perl/5.34/integer.pm',3254,'eb62cc3ee22a592bc673e07158927d1a6536075d33258fc67ff91e3f720cf463'],
            ['overload.pm','/System/Library/Perl/5.34/overload.pm',53349,'3ea7fb212172cb9c01dacee5f7d90aa04da396f5bca442eca84ad2e94a200d99'],
            ['overloading.pm','/System/Library/Perl/5.34/overloading.pm',1808,'5bba56c0acdcc449ca3b73500862a5750c907d97d652978038dbc7809c4fcd07'],
            ['parent.pm','/System/Library/Perl/5.34/parent.pm',2702,'046169e129cfb7d4b302567de268409f175652192914abd33245cb9939f16626'],
            ['strict.pm','/System/Library/Perl/5.34/strict.pm',4783,'f1296224730dceb5dd308ee1e72c452c8b13ced7f3bf742ccd16e1e1c416bcb5'],
            ['utf8.pm','/System/Library/Perl/5.34/utf8.pm',10756,'9dd05cc86753dc3989926bdc0ed8425ff1ae8946f3298d61440891ee92026691'],
            ['vars.pm','/System/Library/Perl/5.34/vars.pm',2458,'84de23fb5d39572d2b0dc5d4e1cd6363017fae8f54eff90d4c8121eb1edeeb57'],
            ['warnings.pm','/System/Library/Perl/5.34/warnings.pm',53221,'7aa17d79aa23ee3635aa145902944e6dad909c0f5d6ca47d27bce7be864e42d2'],
            ['warnings/register.pm','/System/Library/Perl/5.34/warnings/register.pm',759,'ce25ec34358642703ff05b546b2ac42b4f2081ab7610d8373dd94c6b78040cf4'],
        );
        my @records=CORE::map {{key=>$_->[0],path=>$_->[1],size=>$_->[2],sha=>$_->[3],selected=>0}} @material;
        my %by_key=CORE::map {$_->{key}=>$_} @records;
        my $phase='new';my ($calls,$rechecks,$claimed)=(0,0,0);
        my ($detach_started,$detach_outcome,$detach_error)=(0,undef,undef);
        my ($install_error,$hook_error,$recheck_error,$revoke_error);
        my ($install_failure,$install_failure_recorded,$install_post_error)=(undef,0,undef);
        my ($owned_revoke_attempted,$revoke_event)=(0,undef);
        my ($detach_post_shape,$detach_post_error);
        my ($install_attempted,$install_outcome,$install_post_shape)=(0,undef,undef);
        my @hook_history;my @recheck_history;my %policy_denials;
        my $original_hook;
        my $literal_refusal="TASK6A_PM_SOURCE_REFUSED\n";
        my $refuse=sub {
            $phase='burned' unless $phase eq 'revoked';CORE::die $literal_refusal;
        };
        my $plain=sub {
            return 0 unless @_==1&&!defined(CORE::tied($_[0]));
            my $value=$_[0];return defined($value)&&CORE::ref($value) eq ''
                &&!$utf8_original->($value)?1:0;
        };
        my $containers=sub {
            CORE::die $literal_refusal if defined(CORE::tied(%INC))
                ||defined(CORE::tied(@INC))||defined(CORE::tied(%main::))
                ||defined(CORE::tied(@pm_completed_readbacks));
        };
        my $roots=sub {
            CORE::die $literal_refusal unless @INC==3
                &&!defined(CORE::tied($INC[0]))&&$same_original->($INC[0],$original_hook)
                &&$plain->($INC[1])&&$INC[1] eq '/System/Library/Perl/5.34/darwin-thread-multi-2level'
                &&$plain->($INC[2])&&$INC[2] eq '/System/Library/Perl/5.34';
        };
        my $validate=sub {
            CORE::die $literal_refusal unless @_==2;
            my $record=$_[0];CORE::die $literal_refusal unless $plain->($_[1]);
            my $bytes=$_[1];CORE::die $literal_refusal unless CORE::length($bytes)==$record->{size};
            my $digest=$checker_original->($bytes);
            CORE::die $literal_refusal unless $plain->($digest)&&$digest eq $record->{sha};
            return $bytes;
        };
        my $admission=sub {
            $containers->();$roots->();
            CORE::die $literal_refusal unless @pm_completed_readbacks==54;
            my $selected=0;
            CORE::die $literal_refusal if CORE::scalar(CORE::keys(%INC))>54;
            for my $index(0..53) {
                my $record=$records[$index];
                CORE::die $literal_refusal unless $plain->($pm_completed_readbacks[$index])
                    &&CORE::length($pm_completed_readbacks[$index])==$record->{size}
                    &&$pm_completed_readbacks[$index] eq $record->{snapshot};
                if($record->{selected}) {
                    $selected++;
                    CORE::die $literal_refusal unless defined($record->{compiler_cell})
                        &&$plain->(${$record->{compiler_cell}})
                        &&${$record->{compiler_cell}} eq $record->{snapshot}
                        &&CORE::exists($INC{$record->{key}})
                        &&$plain->($INC{$record->{key}})&&$INC{$record->{key}} eq $record->{path};
                } else {
                    CORE::die $literal_refusal if CORE::exists($INC{$record->{key}});
                }
            }
            CORE::die $literal_refusal unless CORE::scalar(CORE::keys(%INC))==$selected;
        };
        $original_hook=sub {
            # Charge before guards/classification; history storage stays <=128.
            my $attempt=++$calls;my $event;
            if($attempt<=128) {$event={attempt=>$attempt};CORE::push(@hook_history,$event);}
            my $result;my $ok=eval {
                CORE::die $literal_refusal unless $attempt<=128&&$phase eq 'installed'
                    &&@_==2&&!defined(CORE::tied($_[0]))&&!defined(CORE::tied($_[1]))
                    &&$same_original->($_[0],$original_hook)&&$plain->($_[1])
                    &&CORE::length($_[1])>0&&CORE::length($_[1])<=4096;
                my $key=$_[1];$event->{key}=$key;$admission->();
                if($key eq 'Log/Agent.pm'||$key eq 'Encode/ConfigLocal.pm') {
                    $policy_denials{$key}++;$event->{policy_denied}=1;
                    CORE::die "TASK6A_PM_OPTIONAL_POLICY_DENIED\n";
                }
                CORE::die $literal_refusal unless CORE::exists($by_key{$key});
                my $record=$by_key{$key};CORE::die $literal_refusal if $record->{selected};
                # Enroll exact fresh compiler SV before fallible pin/cache handoff.
                my $compiler=CORE::substr($record->{snapshot},0);
                $record->{compiler_cell}=\$compiler;$record->{selection_attempted}=1;
                $validate->($record,$compiler);
                CORE::die $literal_refusal unless $phase eq 'installed'&&$plain->($compiler)
                    &&$compiler eq $record->{snapshot};
                $admission->();
                CORE::die $literal_refusal unless $phase eq 'installed';
                $record->{selected}=1;$record->{publication_attempted}=1;
                my $published;my $publish_ok=eval {$published=($INC{$key}=$record->{path});1;};
                $record->{publication_error}=$@;$record->{publication_result}=$published;
                CORE::die $literal_refusal unless $publish_ok&&$plain->($published)
                    &&$published eq $record->{path};
                $admission->();CORE::die $literal_refusal unless $phase eq 'installed';
                $record->{handed}=1;$result=$record->{compiler_cell};1;
            };
            my $error=$@;$event->{error}=$error if defined($event);
            if(!$ok) {
                if(defined($event)&&$event->{policy_denied}) {CORE::die "TASK6A_PM_OPTIONAL_POLICY_DENIED\n";}
                $hook_error=$error;$refuse->();
            }
            return $result;
        };
        $pm_loader_install=sub {
            my $ok=eval {
                CORE::die $literal_refusal unless @_==0&&$phase eq 'new';
                $containers->();
                CORE::die $literal_refusal unless @INC==2&&CORE::scalar(CORE::keys(%INC))==0
                    &&$plain->($INC[0])&&$INC[0] eq '/System/Library/Perl/5.34/darwin-thread-multi-2level'
                    &&$plain->($INC[1])&&$INC[1] eq '/System/Library/Perl/5.34'
                    &&!CORE::exists($main::{'strict::'})&&!CORE::exists($main::{'warnings::'})
                    &&@pm_completed_readbacks==54;
                for my $index(0..53) {
                    CORE::die $literal_refusal unless $phase eq 'new';
                    my $record=$records[$index];my $validated=$validate->($record,$pm_completed_readbacks[$index]);
                    CORE::die $literal_refusal unless $phase eq 'new';
                    $record->{snapshot}=CORE::substr($validated,0);
                }
                # Revalidate original preclaim state after authentication, without
                # rereading an unguarded input slot for authenticated snapshots.
                $containers->();
                CORE::die $literal_refusal unless $phase eq 'new'&&@INC==2&&CORE::scalar(CORE::keys(%INC))==0
                    &&$plain->($INC[0])&&$INC[0] eq '/System/Library/Perl/5.34/darwin-thread-multi-2level'
                    &&$plain->($INC[1])&&$INC[1] eq '/System/Library/Perl/5.34'
                    &&!CORE::exists($main::{'strict::'})&&!CORE::exists($main::{'warnings::'})
                    &&@pm_completed_readbacks==54;
                for my $index(0..53) {
                    CORE::die $literal_refusal unless $plain->($pm_completed_readbacks[$index])
                        &&$pm_completed_readbacks[$index] eq $records[$index]{snapshot};
                }
                # This source-only claim does not authenticate another issuer's
                # private native phase or prove initial namespace/native trust.
                CORE::die $literal_refusal unless $phase eq 'new';
                $claimed=1;$phase='installing';$install_attempted=1;
                my $inserted;my $insert_ok=eval {$inserted=CORE::unshift(@INC,$original_hook);1;};
                $install_outcome=$inserted;$install_error=$@;
                my $shape_ok=eval {$admission->();1;};
                $install_post_shape=$shape_ok?1:0;$install_post_error=$@;
                CORE::die $literal_refusal unless $insert_ok&&$plain->($inserted)&&$inserted eq '3'&&$shape_ok;
                CORE::die $literal_refusal unless $phase eq 'installing';
                $phase='installed';1;
            };
            if(!$ok) {
                if(!$install_failure_recorded) {$install_failure=$@;$install_failure_recorded=1;}
                $refuse->();
            }return 1;
        };
        $pm_loader_recheck=sub {
            my $attempt=++$rechecks;my $event;
            if($attempt<=64) {$event={attempt=>$attempt};CORE::push(@recheck_history,$event);}
            my $ok=eval {
                CORE::die $literal_refusal unless @_==0&&$phase eq 'installed'&&$attempt<=64;
                $admission->();CORE::die $literal_refusal unless $phase eq 'installed';1;
            };
            my $error=$@;$event->{error}=$error if defined($event);
            if(!$ok) {$recheck_error=$error;$refuse->();}return 1;
        };
        $pm_loader_revoke=sub {
            my $prior=$owned_revoke_attempted;my $this_owned=0;
            if($claimed&&!$prior&&$phase ne 'revoked') {
                $owned_revoke_attempted=1;$this_owned=1;
                $revoke_event={entry_phase=>$phase};$phase='burned';
            }
            my $ok=eval {
                CORE::die $literal_refusal unless @_==0&&$phase ne 'revoked'&&!$prior&&!$detach_started;
                if(!$claimed) {$phase='revoked';return 1;}
                # Once-owned intent and burned phase precede all fallible work.
                # Unknown arrays stay retained; restoration never grants retry.
                CORE::die $literal_refusal if defined(CORE::tied(@INC));
                $roots->();$detach_started=1;
                my $removed;my $detach_ok=eval {$removed=CORE::shift(@INC);1;};
                $detach_error=$@;$detach_outcome=$removed;
                my $shape_ok=eval {
                    CORE::die $literal_refusal if defined(CORE::tied(@INC));
                    CORE::die $literal_refusal unless @INC==2
                        &&$plain->($INC[0])&&$INC[0] eq '/System/Library/Perl/5.34/darwin-thread-multi-2level'
                        &&$plain->($INC[1])&&$INC[1] eq '/System/Library/Perl/5.34';1;
                };
                $detach_post_shape=$shape_ok?1:0;$detach_post_error=$@;
                CORE::die $literal_refusal unless $detach_ok&&!defined(CORE::tied($removed))
                    &&$same_original->($removed,$original_hook)&&$shape_ok;
                $phase='revoked';1;
            };
            my $error=$@;
            if($this_owned) {$revoke_event->{error}=$error;$revoke_event->{outcome}=$ok?1:0;}
            if(!$ok) {$revoke_error=$error;$refuse->();}return 1;
        };
        # Read-only native-owner bridge; construction captures this created hook.
        my $native_bridge_hook_original=$original_hook;
        $pm_loader_native_state=sub {
            CORE::die $literal_refusal unless @_==0
                &&!defined(CORE::tied($phase))&&!defined(CORE::tied($calls))
                &&!defined(CORE::tied($rechecks))&&!defined(CORE::tied($original_hook))
                &&!defined(CORE::tied($native_bridge_hook_original));
            CORE::die $literal_refusal unless $plain->($phase)
                &&$phase=~/\A(?:new|installing|installed|burned|revoked)\z/
                &&$plain->($calls)&&$calls=~/\A(?:0|[1-9][0-9]{0,19})\z/
                &&$plain->($rechecks)&&$rechecks=~/\A(?:0|[1-9][0-9]{0,19})\z/
                &&$same_original->($original_hook,$native_bridge_hook_original);
            return [CORE::substr($phase,0),CORE::substr($calls,0),
                CORE::substr($rechecks,0),$native_bridge_hook_original];
        };
        # Private PM lifecycle closures end here.
    }
}
# End fixed PM source-selection prerequisite.
# Inert fixed native PM readback prerequisite. No production invocation.
# This supplies the preceding selector conditionally; initial native trust is separate.
my ($pm_native_readback_issue,$pm_native_readback_recheck,$pm_native_readback_release);
{
    BEGIN {$^H|=0x01000000;CORE::delete($^H{'overloading'});}
    BEGIN {
        my $utf8_original=\&utf8::is_utf8;
        my $bridge_original=$pm_loader_native_state;
        my $installer_original=$pm_loader_install;
        my $rechecker_original=$pm_loader_recheck;
        my $sha_original=$preimport_sha256;
        my $literal_refusal="TASK6A_NATIVE_PM_READBACK_REFUSED\n";
        my $phase='new';my $claimed=0;my $rechecks=0;
        my ($operations,$raw_reserved,$text_reserved)=(0,0,0);
        my (@originals,@native_events,@target_events,@validated,@publications);
        my ($issue_error,$recheck_error,$release_error,$burn_error);
        my ($install_attempted,$install_succeeded,$hook_captured)=(0,0,0);
        my ($revoked,$revocation_outcome,$revocation_error)=(0,undef,undef);
        my ($settle_started,$settle_outcome)=(0,undef);
        my @directories=(
            '/',
            '/System',
            '/System/Library',
            '/System/Library/Perl',
            '/System/Library/Perl/5.34',
            '/System/Library/Perl/5.34/Digest',
            '/System/Library/Perl/5.34/Exporter',
            '/System/Library/Perl/5.34/File',
            '/System/Library/Perl/5.34/IO',
            '/System/Library/Perl/5.34/JSON',
            '/System/Library/Perl/5.34/Tie',
            '/System/Library/Perl/5.34/darwin-thread-multi-2level',
            '/System/Library/Perl/5.34/warnings',
            '/System/Library/Perl/5.34/IO/Compress',
            '/System/Library/Perl/5.34/IO/Uncompress',
            '/System/Library/Perl/5.34/JSON/PP',
            '/System/Library/Perl/5.34/darwin-thread-multi-2level/Compress',
            '/System/Library/Perl/5.34/darwin-thread-multi-2level/Digest',
            '/System/Library/Perl/5.34/darwin-thread-multi-2level/Encode',
            '/System/Library/Perl/5.34/darwin-thread-multi-2level/File',
            '/System/Library/Perl/5.34/darwin-thread-multi-2level/IO',
            '/System/Library/Perl/5.34/darwin-thread-multi-2level/List',
            '/System/Library/Perl/5.34/darwin-thread-multi-2level/MIME',
            '/System/Library/Perl/5.34/darwin-thread-multi-2level/PerlIO',
            '/System/Library/Perl/5.34/darwin-thread-multi-2level/Scalar',
            '/System/Library/Perl/5.34/darwin-thread-multi-2level/Time',
            '/System/Library/Perl/5.34/IO/Compress/Base',
            '/System/Library/Perl/5.34/IO/Compress/Gzip',
            '/System/Library/Perl/5.34/IO/Compress/Zlib',
            '/System/Library/Perl/5.34/IO/Uncompress/Adapter',
            '/System/Library/Perl/5.34/darwin-thread-multi-2level/Compress/Raw',
            '/System/Library/Perl/5.34/darwin-thread-multi-2level/Encode/MIME',
        );
        my @leaves=(
            ['Carp.pm','/System/Library/Perl/5.34/Carp.pm',35985,'020bba236b44c482c8a401b5f6676c0b5d27a76caaf7cae41dfb7a63b00488b3'],
            ['Digest/base.pm','/System/Library/Perl/5.34/Digest/base.pm',1984,'06367faa5fb46a5794d3d7603d52075ab1533ad848184a5309a1cfac1058281a'],
            ['Exporter.pm','/System/Library/Perl/5.34/Exporter.pm',18774,'073f49928a471678e14ce5c314aef306a93a58870dba423ff2f630d1de782cad'],
            ['Exporter/Heavy.pm','/System/Library/Perl/5.34/Exporter/Heavy.pm',6530,'e53ad090aaa655b01ad1cff2af2daf6c92020ed349f9d48d55109cd1d142f6a0'],
            ['File/GlobMapper.pm','/System/Library/Perl/5.34/File/GlobMapper.pm',15683,'1fc0b84c8fa4fc5b3cad7ae0a638a8fd3736efd5416c31afcc8ae58a03d525b3'],
            ['IO/Compress/Base/Common.pm','/System/Library/Perl/5.34/IO/Compress/Base/Common.pm',22774,'7dbfdfdf0851619f00d98f5958203fd4ea9535ef008a87eec5cd19cd039710e5'],
            ['IO/Compress/Gzip/Constants.pm','/System/Library/Perl/5.34/IO/Compress/Gzip/Constants.pm',3883,'108fdebbb31a16c6ff3ff2e9fb3220e197aa79ba9f7e995073da40da956315b3'],
            ['IO/Compress/Zlib/Extra.pm','/System/Library/Perl/5.34/IO/Compress/Zlib/Extra.pm',5647,'57934980c670ff320d15164647da794882b9d3edee4d1586495f91dca4c9ed01'],
            ['IO/Uncompress/Adapter/Inflate.pm','/System/Library/Perl/5.34/IO/Uncompress/Adapter/Inflate.pm',3259,'e93c905f15ba91ed6ef8cae083ed0cfd860bcbfcb763592e722a2e529ff5989b'],
            ['IO/Uncompress/Base.pm','/System/Library/Perl/5.34/IO/Uncompress/Base.pm',38337,'adcbe73669c2f03ddce11fe3234b39e26057c9c7b8283ce4bf2e4d21ff64893a'],
            ['IO/Uncompress/Gunzip.pm','/System/Library/Perl/5.34/IO/Uncompress/Gunzip.pm',32152,'f9cf9da150abe298dc8efa76e4cd385b641c377afb567db1d643e540ea3295ab'],
            ['IO/Uncompress/RawInflate.pm','/System/Library/Perl/5.34/IO/Uncompress/RawInflate.pm',31841,'efa06d6eca40888d6f1f9bd3487339d9bbb788c823118171655701617bc922b8'],
            ['JSON/PP.pm','/System/Library/Perl/5.34/JSON/PP.pm',100527,'b256804d959880439ce3e5b82497d01c080228276ae55979d3ababee48293a89'],
            ['JSON/PP/Boolean.pm','/System/Library/Perl/5.34/JSON/PP/Boolean.pm',810,'264db0a8de27d592dceb964bbaab9a05a65197855a7bfd4f10ed20d14f86f379'],
            ['PerlIO.pm','/System/Library/Perl/5.34/PerlIO.pm',14441,'183d8cc5992cd8197bd0621f0ac1c2346104327ecc4e7ccb53c26145481822b6'],
            ['SelectSaver.pm','/System/Library/Perl/5.34/SelectSaver.pm',1076,'b951b99c894f701eac08b79265ff2ccbede0954f97a537d03fb78801ed645861'],
            ['Symbol.pm','/System/Library/Perl/5.34/Symbol.pm',4905,'bd0e0df0aa0b830f87c2a991b3989abae21c9e9dce4edb2abc7125c3c7693621'],
            ['Tie/Hash.pm','/System/Library/Perl/5.34/Tie/Hash.pm',7639,'12e565ea59a4a3a332d8fefa40a654f9482014c145f165bef3d065a59daee55a'],
            ['XSLoader.pm','/System/Library/Perl/5.34/XSLoader.pm',11398,'c6efc1f25e87fb1c2343d471b868af1a755df601985065dbd22e22273d6b2192'],
            ['bytes.pm','/System/Library/Perl/5.34/bytes.pm',3782,'7e3a78b180565c3caafa7f3dd5913acb91b06fe7c9f802bf948eb5a962df00f0'],
            ['constant.pm','/System/Library/Perl/5.34/constant.pm',14724,'e67cdfa533d42cbe5265bcf3c270f055620cba38a9295b5d584b7efc37a0c156'],
            ['B.pm','/System/Library/Perl/5.34/darwin-thread-multi-2level/B.pm',30093,'cf275fdd78b25aa726b0068003aee6e08cd380f2aea1378efbb8fe268d6bc95a'],
            ['Compress/Raw/Zlib.pm','/System/Library/Perl/5.34/darwin-thread-multi-2level/Compress/Raw/Zlib.pm',47387,'7b9321c1d13ab20c19e2bd0deafc09a0c3fa30f526c68078145d9409f2ab2bc6'],
            ['Config.pm','/System/Library/Perl/5.34/darwin-thread-multi-2level/Config.pm',3886,'e85c38637cedf6a9e29e6946201fbefeceba184e07b720b976c068ecab4d7283'],
            ['Digest/SHA.pm','/System/Library/Perl/5.34/darwin-thread-multi-2level/Digest/SHA.pm',22174,'15efed6020da9028a7a5b2d41d7e6d8e6b1719aeae365bc592ffb4025f76d33d'],
            ['DynaLoader.pm','/System/Library/Perl/5.34/darwin-thread-multi-2level/DynaLoader.pm',25540,'dde9744d54a185e1d38d52c98bf9349a83360d5fb31c82904e28d514a87c79fe'],
            ['Encode.pm','/System/Library/Perl/5.34/darwin-thread-multi-2level/Encode.pm',32075,'134fddc376de04a40dea58e6055f7ce28bc4159487a47c260ac8feaf04201a54'],
            ['Encode/Alias.pm','/System/Library/Perl/5.34/darwin-thread-multi-2level/Encode/Alias.pm',12545,'9ec57c436578d4c67b269c53dcb70db64bf845b7ba294da2b8fb998bc00a45ea'],
            ['Encode/Config.pm','/System/Library/Perl/5.34/darwin-thread-multi-2level/Encode/Config.pm',6065,'a15072cf84ac4a431b91b1a893a7c8d4c4dd48adefa077cd3a9b271cf0aba3bf'],
            ['Encode/Encoding.pm','/System/Library/Perl/5.34/darwin-thread-multi-2level/Encode/Encoding.pm',9063,'1daaf4400c4462c24d785b7eb91fbebc6eb868192aad410df48019fe7af6e39d'],
            ['Encode/MIME/Name.pm','/System/Library/Perl/5.34/darwin-thread-multi-2level/Encode/MIME/Name.pm',3821,'1cabed37ee26cfd763999649f9ac9a5f1e5a81cbc5125b8d85ff19d60b72f906'],
            ['Fcntl.pm','/System/Library/Perl/5.34/darwin-thread-multi-2level/Fcntl.pm',4044,'80511e494fc719cb63d252a95987ba24c04557947c1bf1584f5eeb6704786e9b'],
            ['File/Glob.pm','/System/Library/Perl/5.34/darwin-thread-multi-2level/File/Glob.pm',12712,'ff854e2cccfcd78e6c22278c843ea61fda1d0164704b1aa8941fe05ff9dbbfe8'],
            ['IO.pm','/System/Library/Perl/5.34/darwin-thread-multi-2level/IO.pm',1462,'d1db057bb61c36632e97e7216733ddf70ccd367f1f32393f9d7a4248cc4ec07e'],
            ['IO/File.pm','/System/Library/Perl/5.34/darwin-thread-multi-2level/IO/File.pm',4872,'133658ff1c17332f46d01d34f872b71309c715656b47f39e31393e2d10d827e4'],
            ['IO/Handle.pm','/System/Library/Perl/5.34/darwin-thread-multi-2level/IO/Handle.pm',16641,'af3d3b9f9bc2132644248480d21b2e7e5c1a7e0d7a3c1f121e89888a2153b9f1'],
            ['IO/Seekable.pm','/System/Library/Perl/5.34/darwin-thread-multi-2level/IO/Seekable.pm',2891,'ce170c83abf1a599320c0f4369c8e6e123310b4603ac3791bee0e733d9e8e533'],
            ['IO/Select.pm','/System/Library/Perl/5.34/darwin-thread-multi-2level/IO/Select.pm',9263,'a6804f44f8c90c88f8cc60cdd38538f65f3f92ce533fcda6933887c7228ad5d7'],
            ['List/Util.pm','/System/Library/Perl/5.34/darwin-thread-multi-2level/List/Util.pm',24055,'0d3135c14b4d4156a0de8156f2d33f54c6f0b6233b2f6fe5d4b9122e9fef1a5a'],
            ['MIME/Base64.pm','/System/Library/Perl/5.34/darwin-thread-multi-2level/MIME/Base64.pm',5433,'dfb1e3876b3e7f3cf9a3f23123c37464617e551802e618e54cabd7890c986cc8'],
            ['POSIX.pm','/System/Library/Perl/5.34/darwin-thread-multi-2level/POSIX.pm',20384,'d941cf37b6dee5253b859cbb703a5785629a0bcdd86f61d1ec96fa464d69df90'],
            ['PerlIO/scalar.pm','/System/Library/Perl/5.34/darwin-thread-multi-2level/PerlIO/scalar.pm',1069,'a4205c837c331d7945f0221600ae8b4bf6ea562812c71b535ac06693de26a859'],
            ['Scalar/Util.pm','/System/Library/Perl/5.34/darwin-thread-multi-2level/Scalar/Util.pm',10189,'9ba58fcbefc535a73d3fc0da949d0fb1e524411dea4e8bee97529700607a98a4'],
            ['Storable.pm','/System/Library/Perl/5.34/darwin-thread-multi-2level/Storable.pm',49923,'4a9ab42a68de934079da007e8df0ae3c66f33477c3f3218782596a83e3ea508c'],
            ['Time/HiRes.pm','/System/Library/Perl/5.34/darwin-thread-multi-2level/Time/HiRes.pm',25689,'9bc6ece12a90e5c01d784a4efd672c49b8a7551ce6871b620efbd38cd4960f34'],
            ['integer.pm','/System/Library/Perl/5.34/integer.pm',3254,'eb62cc3ee22a592bc673e07158927d1a6536075d33258fc67ff91e3f720cf463'],
            ['overload.pm','/System/Library/Perl/5.34/overload.pm',53349,'3ea7fb212172cb9c01dacee5f7d90aa04da396f5bca442eca84ad2e94a200d99'],
            ['overloading.pm','/System/Library/Perl/5.34/overloading.pm',1808,'5bba56c0acdcc449ca3b73500862a5750c907d97d652978038dbc7809c4fcd07'],
            ['parent.pm','/System/Library/Perl/5.34/parent.pm',2702,'046169e129cfb7d4b302567de268409f175652192914abd33245cb9939f16626'],
            ['strict.pm','/System/Library/Perl/5.34/strict.pm',4783,'f1296224730dceb5dd308ee1e72c452c8b13ced7f3bf742ccd16e1e1c416bcb5'],
            ['utf8.pm','/System/Library/Perl/5.34/utf8.pm',10756,'9dd05cc86753dc3989926bdc0ed8425ff1ae8946f3298d61440891ee92026691'],
            ['vars.pm','/System/Library/Perl/5.34/vars.pm',2458,'84de23fb5d39572d2b0dc5d4e1cd6363017fae8f54eff90d4c8121eb1edeeb57'],
            ['warnings.pm','/System/Library/Perl/5.34/warnings.pm',53221,'7aa17d79aa23ee3635aa145902944e6dad909c0f5d6ca47d27bce7be864e42d2'],
            ['warnings/register.pm','/System/Library/Perl/5.34/warnings/register.pm',759,'ce25ec34358642703ff05b546b2ac42b4f2081ab7610d8373dd94c6b78040cf4'],
        );
        my $raw_same=sub {
            return 0 unless @_==2&&!defined(CORE::tied($_[0]))&&!defined(CORE::tied($_[1]));
            my ($a,$b)=@_;return 0 unless CORE::ref($a) ne ''&&CORE::ref($b) ne '';
            return $a==$b?1:0;
        };
        my $plain=sub {
            return 0 unless @_==1&&!defined(CORE::tied($_[0]));
            my $value=$_[0];return defined($value)&&CORE::ref($value) eq ''
                &&!$utf8_original->($value)?1:0;
        };
        my $number=sub {
            return 0 unless @_==1&&$plain->($_[0])&&CORE::length($_[0])<=21;
            return $_[0]=~/\A(?:0|[1-9][0-9]{0,19}|-[1-9][0-9]{0,18})\z/?1:0;
        };
        my $error_plain=sub {return @_==1&&$plain->($_[0])&&CORE::length($_[0])<=4096?1:0;};
        my $ports=sub {
            CORE::die $literal_refusal unless @_==0
                &&$raw_same->($pm_loader_native_state,$bridge_original)
                &&$raw_same->($pm_loader_install,$installer_original)
                &&$raw_same->($pm_loader_recheck,$rechecker_original)
                &&$raw_same->($preimport_sha256,$sha_original);
        };
        my $initial_state;my $initial_ok=eval {$ports->();$initial_state=$bridge_original->();1;};
        my $initial_error=$@;my $target_hook_original;
        if($initial_ok&&CORE::ref($initial_state) eq 'ARRAY'&&!defined(CORE::tied(@$initial_state))
            &&@$initial_state==4&&!defined(CORE::tied($initial_state->[3]))) {
            $target_hook_original=$initial_state->[3];
        }
        my $observe=sub {
            CORE::die $literal_refusal unless @_==0&&@target_events<512;
            my $event={kind=>'observe',intent=>1};CORE::push(@target_events,$event);
            my $state;my $ok=eval {$ports->();$state=$bridge_original->();1;};
            $event->{error}=$@;$event->{result}=$state;
            CORE::die $literal_refusal unless $ok&&$error_plain->($event->{error})
                &&CORE::ref($state) eq 'ARRAY'&&!defined(CORE::tied(@$state))&&@$state==4;
            for my $index(0..2) {CORE::die $literal_refusal unless $plain->($state->[$index]);}
            CORE::die $literal_refusal unless $state->[0]=~/\A(?:new|installing|installed|burned|revoked)\z/
                &&$number->($state->[1])&&$state->[1]>=0&&$number->($state->[2])&&$state->[2]>=0
                &&$raw_same->($state->[3],$target_hook_original);
            return $state;
        };
        my $target_call=sub {
            CORE::die $literal_refusal unless @_==1&&@target_events<512;
            my $kind=$_[0];my $event={kind=>$kind,intent=>1};CORE::push(@target_events,$event);
            my $ok=eval {
                $ports->();
                if($kind eq 'install') {$event->{result}=$installer_original->();}
                elsif($kind eq 'invalidate') {$event->{result}=$installer_original->(undef);}
                elsif($kind eq 'check') {$event->{result}=$rechecker_original->();}
                else {CORE::die $literal_refusal;}1;
            };
            $event->{error}=$@;$event->{ok}=$ok?1:0;return $event;
        };
        my $phase_guard=sub {
            CORE::die $literal_refusal unless @_==0&&!defined(CORE::tied($phase))
                &&$plain->($phase)&&($phase eq 'acquiring'||$phase eq 'held');
        };
        my $charge=sub {
            CORE::die $literal_refusal unless @_==1&&$number->($_[0])&&$_[0]>=0
                &&$operations<16384&&$text_reserved+5120<=33554432
                &&$raw_reserved+$_[0]<=67108864;
            $operations++;$text_reserved+=5120;$raw_reserved+=$_[0];
        };
        my $shape=sub {
            CORE::die $literal_refusal unless @_==1&&!defined(CORE::tied($_[0]));
            my $handle=$_[0];CORE::die $literal_refusal unless CORE::ref($handle) ne '';
            my $io=*{$handle}{IO};
            CORE::die $literal_refusal unless defined($io)&&CORE::ref($io) ne ''
                &&!defined(CORE::tied(*{$handle}));return ($handle,$io);
        };
        my $same=sub {
            CORE::die $literal_refusal unless @_==1;
            my $record=$_[0];CORE::die $literal_refusal unless $record->{known}&&!$record->{close_attempted};
            my ($handle,$io)=$shape->(${ $record->{cell} });
            CORE::die $literal_refusal unless $raw_same->($handle,$record->{handle})
                &&$raw_same->($io,$record->{io});return $handle;
        };
        my $native=sub {
            CORE::die $literal_refusal unless @_==3;
            my ($kind,$record,$request)=@_;$phase_guard->();
            my $handle=$kind eq 'lstat'||$kind eq 'open'?undef:$same->($record);
            my $raw=$kind eq 'capabilities'||$kind eq 'security'?8192:$kind eq 'read'||$kind eq 'eof'?$request:0;
            $charge->($raw);
            my $event={sequence=>$operations,kind=>$kind,index=>$record->{index},intent=>1};
            CORE::push(@native_events,$event);my ($buffer,$attributes,$fd);
            if($kind eq 'capabilities'||$kind eq 'security') {
                $fd=$record->{acl_fd};CORE::die $literal_refusal unless $number->($fd)&&$fd>=0&&$fd<=2147483647;
                $attributes=CORE::pack('SSLLLLL',5,0,$kind eq 'security'?0x00400000:0,
                    $kind eq 'capabilities'?0x80020000:0,0,0,0);
                $buffer="\xcc" x 8192;$event->{attributes}=$attributes;$event->{buffer_cell}=\$buffer;$event->{request}=8192;
            }elsif($kind eq 'read'||$kind eq 'eof') {
                CORE::die $literal_refusal unless $number->($request)&&$request>=1&&$request<=100528;
                $buffer='';$event->{buffer_cell}=\$buffer;$event->{request}=$request;
            }
            $phase_guard->();$!=0;
            my $ok=eval {
                if($kind eq 'lstat') {$event->{values}=[CORE::lstat($record->{path})];}
                elsif($kind eq 'stat') {$event->{values}=[CORE::stat($handle)];}
                elsif($kind eq 'open') {
                    $event->{result}=CORE::sysopen(${ $record->{cell} },$record->{path},0x01000100);
                    $event->{errno}=0+$!;
                    # Enroll a completed positive native original before postguards.
                    if($plain->($event->{result})&&$event->{result} eq '1') {
                        my ($opened_handle,$opened_io)=$shape->(${ $record->{cell} });
                        for my $prior(@originals) {
                            next unless $prior->{known};
                            CORE::die $literal_refusal if $raw_same->($opened_handle,$prior->{handle})
                                ||$raw_same->($opened_io,$prior->{io});
                        }
                        $record->{handle}=$opened_handle;$record->{io}=$opened_io;$record->{known}=1;
                    }
                }
                elsif($kind eq 'fileno') {$event->{result}=CORE::fileno($handle);}
                elsif($kind eq 'capabilities'||$kind eq 'security') {$event->{result}=CORE::syscall(228,$fd,$attributes,$buffer,8192,4);}
                elsif($kind eq 'seek') {$event->{result}=CORE::sysseek($handle,0,0);}
                elsif($kind eq 'read'||$kind eq 'eof') {$event->{result}=CORE::sysread($handle,$buffer,$request);}
                else {CORE::die $literal_refusal;}
                $event->{errno}=0+$! unless $kind eq 'open';1;
            };
            $event->{error}=$@;$event->{ok}=$ok?1:0;
            CORE::die $literal_refusal unless $ok&&$error_plain->($event->{error})&&$event->{error} eq ''
                &&$number->($event->{errno});
            $phase_guard->();return $event;
        };
        my $tuple=sub {
            CORE::die $literal_refusal unless @_==2;
            my ($values,$record)=@_;
            CORE::die $literal_refusal unless CORE::ref($values) eq 'ARRAY'&&!defined(CORE::tied(@$values))&&@$values==13;
            for my $value(@$values) {CORE::die $literal_refusal unless $number->($value);}
            CORE::die $literal_refusal unless ($values->[2]&0170000)==($record->{file}?0100000:0040000)
                &&($values->[2]&0022)==0&&$values->[4]==0&&$values->[5]==0;
            CORE::die $literal_refusal if $record->{file}&&$values->[7]!=$record->{size};
        };
        my $equal_tuple=sub {
            CORE::die $literal_refusal unless @_==2;
            my ($a,$b)=@_;for my $index(0..7,9..12) {CORE::die $literal_refusal unless $a->[$index]==$b->[$index];}
        };
        my $acl=sub {
            CORE::die $literal_refusal unless @_==1;my $record=$_[0];
            my $fd_event=$native->('fileno',$record,0);
            CORE::die $literal_refusal unless $number->($fd_event->{result});
            my $fd=$fd_event->{result};
            CORE::die $literal_refusal unless $number->($fd)&&$fd>=0&&$fd<=2147483647;
            $record->{acl_fd}=$fd;
            for my $kind('capabilities','security') {
                my $event=$native->($kind,$record,8192);
                CORE::die $literal_refusal unless $plain->(${ $event->{buffer_cell} });
                my $buffer=${ $event->{buffer_cell} };
                CORE::die $literal_refusal unless $plain->($event->{result})&&$event->{result} eq '0'
                    &&$plain->($buffer)&&CORE::length($buffer)==8192;
                if($kind eq 'security') {
                    CORE::die $literal_refusal unless CORE::substr($buffer,0,12) eq CORE::pack('LLL',12,8,0)
                        &&CORE::substr($buffer,12) eq "\xcc" x 8180;
                }else {
                    CORE::die $literal_refusal unless CORE::unpack('L',CORE::substr($buffer,0,4))==36
                        &&CORE::substr($buffer,36) eq "\xcc" x 8156;
                    my @cap=CORE::unpack('L8',CORE::substr($buffer,4,32));
                    CORE::die $literal_refusal unless ($cap[1]&0x400)&&($cap[5]&0x400);
                }
            }
        };
        my $check_originals=sub {
            CORE::die $literal_refusal unless @_==0&&@originals==86;
            for my $record(@originals) {
                $same->($record);
                my $held=$native->('stat',$record,0);my $named=$native->('lstat',$record,0);
                $tuple->($held->{values},$record);$tuple->($named->{values},$record);
                $equal_tuple->($held->{values},$record->{tuple});$equal_tuple->($held->{values},$named->{values});
                $acl->($record);
            }
        };
        my $read=sub {
            CORE::die $literal_refusal unless @_==1;my $record=$_[0];
            my $seek=$native->('seek',$record,0);
            CORE::die $literal_refusal unless $plain->($seek->{result})
                &&($seek->{result} eq '0'||$seek->{result} eq '0 but true');
            my $read=$native->('read',$record,$record->{size}+1);
            CORE::die $literal_refusal unless $plain->($read->{result})&&$read->{result} eq "$record->{size}"
                &&!defined(CORE::tied(${ $read->{buffer_cell} }));
            my $bytes=${ $read->{buffer_cell} };
            CORE::die $literal_refusal unless $plain->($bytes)&&CORE::length($bytes)==$record->{size};
            my $eof=$native->('eof',$record,1);
            CORE::die $literal_refusal unless $plain->($eof->{result})&&$eof->{result} eq '0'
                &&!defined(CORE::tied(${ $eof->{buffer_cell} }))&&$plain->(${ $eof->{buffer_cell} })
                &&CORE::length(${ $eof->{buffer_cell} })==0;
            $ports->();my $digest=$sha_original->($bytes);
            CORE::die $literal_refusal unless $plain->($digest)&&$digest eq $record->{sha};
            $phase_guard->();return CORE::substr($bytes,0);
        };
        my $inputs=sub {
            CORE::die $literal_refusal unless @_==0&&!defined(CORE::tied(@pm_completed_readbacks))
                &&@pm_completed_readbacks==54&&@validated==54;
            for my $index(0..53) {
                CORE::die $literal_refusal unless $plain->($pm_completed_readbacks[$index])
                    &&$plain->($validated[$index])&&$pm_completed_readbacks[$index] eq $validated[$index];
            }
        };
        my $target_check=sub {
            CORE::die $literal_refusal unless @_==0;
            my $before=$observe->();CORE::die $literal_refusal unless $before->[0] eq 'installed'&&$before->[2]<63;
            my $event=$target_call->('check');my $after=$observe->();
            CORE::die $literal_refusal unless $event->{ok}&&$plain->($event->{result})&&$event->{result} eq '1'
                &&$error_plain->($event->{error})&&$event->{error} eq ''&&$after->[0] eq 'installed'
                &&$after->[2]==$before->[2]+1&&$after->[1]==$before->[1];
            $inputs->();CORE::die $literal_refusal if defined(CORE::tied(@INC));
            CORE::die $literal_refusal unless @INC==3&&$raw_same->($INC[0],$target_hook_original)
                &&$plain->($INC[1])&&$INC[1] eq '/System/Library/Perl/5.34/darwin-thread-multi-2level'
                &&$plain->($INC[2])&&$INC[2] eq '/System/Library/Perl/5.34';
        };
        my $revoke=sub {
            return 1 unless $claimed;
            unless($revoked) {
                $revoked=1;$revocation_outcome=0;
                my $ok=eval {
                    my $before=$observe->();
                    my $event=$target_call->('invalidate');
                    # Causal phase proof BEFORE any further quota-charged check.
                    my $after=$observe->();
                    CORE::die $literal_refusal unless !$event->{ok}&&$error_plain->($event->{error})
                        &&$event->{error} eq "TASK6A_PM_SOURCE_REFUSED\n"
                        &&(($before->[0] eq 'new'||$before->[0] eq 'installed')?$after->[0] eq 'burned'
                            :($before->[0] eq 'burned'||$before->[0] eq 'revoked')&&$after->[0] eq $before->[0])
                        &&$after->[1]==$before->[1]&&$after->[2]==$before->[2];
                    CORE::die $literal_refusal unless $after->[2]<64;
                    my $proof=$target_call->('check');my $last=$observe->();
                    CORE::die $literal_refusal unless !$proof->{ok}&&$error_plain->($proof->{error})
                        &&$proof->{error} eq "TASK6A_PM_SOURCE_REFUSED\n"
                        &&$last->[0] eq $after->[0]&&$last->[1]==$after->[1]&&$last->[2]==$after->[2]+1;1;
                };
                $revocation_error=$@;$revocation_outcome=$ok?1:0;
            }
            CORE::die $literal_refusal unless $revocation_outcome;return 1;
        };
        my $settle=sub {
            return $settle_outcome if $settle_started;
            $settle_started=1;my $all=1;
            for my $record(CORE::reverse(@originals)) {
                unless($record->{known}) {$all=0;next;}
                $record->{close_started}=1;my ($handle,$io);
                my $admitted=eval {
                    ($handle,$io)=$shape->($record->{handle});
                    CORE::die $literal_refusal unless $raw_same->($handle,$record->{handle})&&$raw_same->($io,$record->{io});1;
                };
                $record->{close_admission_error}=$@;
                if($admitted) {
                    $record->{close_attempted}=1;my $ok=eval {$record->{close_return}=CORE::close($handle);1;};
                    $record->{close_error}=$@;$record->{close_native_ok}=$ok?1:0;
                }
                # Independent original-shape/liveness attempt even after close throw.
                $record->{live_started}=1;my $live_ok=eval {
                    my ($h,$i)=$shape->($record->{handle});
                    CORE::die $literal_refusal unless $raw_same->($h,$record->{handle})&&$raw_same->($i,$record->{io});
                    $record->{live_attempted}=1;$record->{live_return}=CORE::fileno($h);1;
                };
                $record->{live_error}=$@;$record->{live_native_ok}=$live_ok?1:0;
                my $ok=$admitted&&$record->{close_native_ok}&&$plain->($record->{close_return})
                    &&$record->{close_return} eq '1'&&$error_plain->($record->{close_error})&&$record->{close_error} eq ''
                    &&$live_ok&&!defined($record->{live_return})&&$error_plain->($record->{live_error})&&$record->{live_error} eq '';
                $record->{close_ok}=$ok?1:0;$all=0 unless $ok;
            }
            $settle_outcome=$all?1:0;return $settle_outcome;
        };
        my $burn=sub {
            $phase='burned';my $ok=eval {$revoke->();1;};$burn_error=$@;
            $settle->() if $claimed;CORE::die $literal_refusal;
        };
        my $fresh=sub {
            CORE::die $literal_refusal unless @_==0&&$initial_ok&&$error_plain->($initial_error);
            my $state=$observe->();
            CORE::die $literal_refusal unless $state->[0] eq 'new'&&$state->[1]==0&&$state->[2]==0
                &&!defined(CORE::tied(%main::))&&!defined(CORE::tied(%INC))&&!defined(CORE::tied(@INC))
                &&!defined(CORE::tied(@pm_completed_readbacks))&&@pm_completed_readbacks==0
                &&CORE::keys(%INC)==0&&@INC==2&&$plain->($INC[0])&&$plain->($INC[1])
                &&$INC[0] eq '/System/Library/Perl/5.34/darwin-thread-multi-2level'
                &&$INC[1] eq '/System/Library/Perl/5.34'
                &&!CORE::exists($main::{'strict::'})&&!CORE::exists($main::{'warnings::'});
        };
        $pm_native_readback_issue=sub {
            $burn->() unless @_==0&&$phase eq 'new';
            my $ok=eval {
                $fresh->();CORE::die $literal_refusal unless $phase eq 'new';
                $claimed=1;$phase='acquiring';
                CORE::die $literal_refusal unless $^O eq 'darwin'&&CORE::unpack('H*',CORE::pack('L',1)) eq '01000000'
                    &&CORE::length(CORE::pack('J',1))==8;
                for my $index(0..85) {
                    my $leaf=$index>=32?$leaves[$index-32]:undef;my $fh;
                    my $record={index=>$index,path=>$index<32?$directories[$index]:$leaf->[1],file=>$index>=32?1:0,
                        size=>defined($leaf)?$leaf->[2]:0,sha=>defined($leaf)?$leaf->[3]:undef,
                        cell=>\$fh,known=>0,close_attempted=>0,open_started=>0};
                    CORE::push(@originals,$record);
                    my $before=$native->('lstat',$record,0);$tuple->($before->{values},$record);
                    $record->{open_started}=1;my $opened=$native->('open',$record,0);
                    CORE::die $literal_refusal unless $plain->($opened->{result})&&$opened->{result} eq '1';
                    CORE::die $literal_refusal unless $record->{known};
                    my $held=$native->('stat',$record,0);$tuple->($held->{values},$record);
                    my $named=$native->('lstat',$record,0);$tuple->($named->{values},$record);
                    $equal_tuple->($before->{values},$held->{values});$equal_tuple->($held->{values},$named->{values});
                    $record->{tuple}=[@{$held->{values}}];$acl->($record);
                }
                $check_originals->();
                for my $index(0..53) {$validated[$index]=$read->($originals[$index+32]);}
                $check_originals->();
                for my $index(0..53) {my $bytes=$read->($originals[$index+32]);CORE::die $literal_refusal unless $bytes eq $validated[$index];}
                $check_originals->();$fresh->();$phase_guard->();$phase='publishing';
                for my $index(0..53) {
                    CORE::die $literal_refusal unless $phase eq 'publishing'&&!defined(CORE::tied(@pm_completed_readbacks))
                        &&@pm_completed_readbacks==$index&&$plain->($validated[$index]);
                    my $event={index=>$index,intent=>1};CORE::push(@publications,$event);
                    # Numeric push result avoids an extra retained whole byte cohort.
                    my $published=eval {$event->{result}=CORE::push(@pm_completed_readbacks,CORE::substr($validated[$index],0));1;};
                    $event->{error}=$@;
                    CORE::die $literal_refusal unless $published&&$error_plain->($event->{error})&&$event->{error} eq ''
                        &&$number->($event->{result})&&$event->{result}==$index+1&&$phase eq 'publishing';
                }
                $inputs->();my $before=$observe->();
                CORE::die $literal_refusal unless $phase eq 'publishing'&&$before->[0] eq 'new'&&$before->[1]==0&&$before->[2]==0;
                $install_attempted=1;$phase='install-attempted';my $event=$target_call->('install');
                my $after=$observe->();$inputs->();
                CORE::die $literal_refusal unless $phase eq 'install-attempted'&&$event->{ok}&&$plain->($event->{result})
                    &&$event->{result} eq '1'&&$error_plain->($event->{error})&&$event->{error} eq ''
                    &&$after->[0] eq 'installed'&&$after->[1]==0&&$after->[2]==0;
                $target_check->();CORE::die $literal_refusal unless $phase eq 'install-attempted';
                $install_succeeded=1;$hook_captured=1;$phase='held';1;
            };
            $issue_error=$@;$burn->() unless $ok;return 1;
        };
        $pm_native_readback_recheck=sub {
            $burn->() unless @_==0&&$phase eq 'held'&&++$rechecks<=64;
            my $ok=eval {
                $check_originals->();
                for my $index(0..53) {my $bytes=$read->($originals[$index+32]);CORE::die $literal_refusal unless $bytes eq $validated[$index];}
                $check_originals->();$target_check->();$phase_guard->();1;
            };
            $recheck_error=$@;$burn->() unless $ok;return 1;
        };
        $pm_native_readback_release=sub {
            if(@_!=0) {$burn->();}
            return $settle_outcome if $phase eq 'released';
            unless($claimed) {$phase='released';$settle_outcome=1;return 1;}
            $phase='releasing';my $ok=eval {$revoke->();1;};$release_error=$@;
            my $closed=$settle->();$burn->() unless $ok&&$closed;
            $phase='released';return 1;
        };
        # Private native PM lifecycle closures end here.
    }
}
# End native PM readback prerequisite.
# Inert fixed XS native readback prerequisite. No production invocation.
# Conditional fixed source-file custody only; native loaded-image trust is separate.
my ($xs_native_readback_issue,$xs_native_readback_recheck,$xs_native_readback_release);
{
    BEGIN {$^H|=0x01000000;CORE::delete($^H{'overloading'});}
    BEGIN {
        my $xs_literal_refusal="TASK6A_NATIVE_XS_READBACK_REFUSED\n";
        my $xs_phase='new';my $xs_claimed=0;my $xs_rechecks=0;
        my ($xs_operations,$xs_raw_reserved,$xs_text_reserved)=(0,0,0);
        my (@xs_originals,@xs_native_events,@xs_validated);
        my $xs_utf8_original=\&utf8::is_utf8;
        my $xs_sha_original=$preimport_sha256;
        my $xs_identity_original=$strict_same_reference;
        my ($xs_issue_error,$xs_recheck_error,$xs_burn_error);
        my $xs_settle_started=0;my $xs_settle_outcome;my $xs_settle_error='';
        my $xs_release_api_started=0;my $xs_release_api_outcome;my $xs_release_api_error='';
        my @xs_directories=(
            '/',
            '/System',
            '/System/Library',
            '/System/Library/Perl',
            '/System/Library/Perl/5.34',
            '/System/Library/Perl/5.34/darwin-thread-multi-2level',
            '/System/Library/Perl/5.34/darwin-thread-multi-2level/auto',
            '/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/B',
            '/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/Compress',
            '/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/Digest',
            '/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/Encode',
            '/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/Fcntl',
            '/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/File',
            '/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/IO',
            '/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/List',
            '/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/MIME',
            '/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/POSIX',
            '/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/PerlIO',
            '/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/Storable',
            '/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/Time',
            '/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/Compress/Raw',
            '/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/Digest/SHA',
            '/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/File/Glob',
            '/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/List/Util',
            '/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/MIME/Base64',
            '/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/PerlIO/scalar',
            '/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/Time/HiRes',
            '/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/Compress/Raw/Zlib',
        );
        my @xs_leaves=(
            ['/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/B/B.bundle',238208,'cb67010fc8fd0cd9526017d1eedd509fc16e46128c80d9484814dafb278b095e'],
            ['/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/Compress/Raw/Zlib/Zlib.bundle',187504,'6375b83850447c7b08e3f22c446790d5d9eb3c64ceeb12a7960febd19aa67e98'],
            ['/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/Digest/SHA/SHA.bundle',151888,'0aee84231c0297e0d51e7f8523fac64cd3c8887daa644d58e957642436ec1628'],
            ['/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/Encode/Encode.bundle',154672,'0d6d427f6caefb29744bee9cdde231aff56ce675397b85d296ee2767b23d6156'],
            ['/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/Fcntl/Fcntl.bundle',118688,'fa9d85d04cc25eaf10ea9bfe761ddde566568c222a14f6b5043de9ed971f42ab'],
            ['/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/File/Glob/Glob.bundle',137824,'10171bdaecea588bdbc099f46f4a891dc03fa31e2155cb33476c3807f338a014'],
            ['/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/IO/IO.bundle',120224,'16943647611acf30476a89c564c14a9cf15617c17e9b44c73c81ccea724801b4'],
            ['/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/List/Util/Util.bundle',188608,'bb0c14ea99a66b4cab6d9c4ae3b39e13bd27b72b239e8d7f209d8f0e276055e9'],
            ['/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/MIME/Base64/Base64.bundle',118400,'1c7ec3c9d946c9da29e4077d0bdea7b3c89366e33d45bfa97a60f3293dcdb263'],
            ['/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/POSIX/POSIX.bundle',242592,'300b45401ae71f3b09666c107ef94404a994d11a61528202b7b184978799c754'],
            ['/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/PerlIO/scalar/scalar.bundle',119376,'3203586f1bcc6609dd971d822a96a7ef87b9e9ed7ade6df926580cd3400d641d'],
            ['/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/Storable/Storable.bundle',271712,'8357bfed40e3cc39bc90cd29f180a256f1ee9adb200218ad4276633eb3355921'],
            ['/System/Library/Perl/5.34/darwin-thread-multi-2level/auto/Time/HiRes/HiRes.bundle',119840,'759c7cc87b97b1084eb8fdf3d5dd4ca3fb80b9a291823408aba1ca001316b336'],
        );
        my $xs_raw_same=sub {
            return 0 unless @_==2&&!defined(CORE::tied($_[0]))&&!defined(CORE::tied($_[1]));
            my ($xs_a,$xs_b)=@_;return 0 unless CORE::ref($xs_a) ne ''&&CORE::ref($xs_b) ne '';
            return $xs_a==$xs_b?1:0;
        };
        my $xs_plain=sub {
            return 0 unless @_==1&&!defined(CORE::tied($_[0]));
            my $xs_value=$_[0];return defined($xs_value)&&CORE::ref($xs_value) eq ''
                &&!$xs_utf8_original->($xs_value)?1:0;
        };
        my $xs_number=sub {
            return 0 unless @_==1&&$xs_plain->($_[0])&&CORE::length($_[0])<=21;
            return $_[0]=~/\A(?:0|[1-9][0-9]{0,19}|-[1-9][0-9]{0,18})\z/?1:0;
        };
        my $xs_error_plain=sub {return @_==1&&$xs_plain->($_[0])&&CORE::length($_[0])<=4096?1:0;};
        my $xs_ports_guard=sub {
            CORE::die $xs_literal_refusal unless @_==0
                &&!defined(CORE::tied($preimport_sha256))&&!defined(CORE::tied($strict_same_reference))
                &&!defined(CORE::tied($xs_sha_original))&&!defined(CORE::tied($xs_identity_original))
                &&!defined(CORE::tied($xs_utf8_original))
                &&$xs_raw_same->($preimport_sha256,$xs_sha_original)
                &&$xs_raw_same->($strict_same_reference,$xs_identity_original)
                &&$xs_raw_same->(\&utf8::is_utf8,$xs_utf8_original);
        };
        my $xs_phase_guard=sub {
            CORE::die $xs_literal_refusal unless @_==0&&!defined(CORE::tied($xs_phase))
                &&$xs_plain->($xs_phase)&&($xs_phase eq 'acquiring'||$xs_phase eq 'reading'
                    ||$xs_phase eq 'held'||$xs_phase eq 'rechecking');
            $xs_ports_guard->();
        };
        my $xs_charge=sub {
            CORE::die $xs_literal_refusal unless @_==1&&$xs_number->($_[0])&&$_[0]>=0
                &&$xs_operations<16384&&$xs_text_reserved+5120<=33554432
                &&$xs_raw_reserved+$_[0]<=67108864;
            $xs_operations++;$xs_text_reserved+=5120;$xs_raw_reserved+=$_[0];
        };
        my $xs_shape=sub {
            CORE::die $xs_literal_refusal unless @_==1&&!defined(CORE::tied($_[0]));
            my $xs_handle=$_[0];CORE::die $xs_literal_refusal unless CORE::ref($xs_handle) ne '';
            my $xs_io=*{$xs_handle}{IO};
            CORE::die $xs_literal_refusal unless defined($xs_io)&&CORE::ref($xs_io) ne ''
                &&!defined(CORE::tied(*{$xs_handle}));return ($xs_handle,$xs_io);
        };
        my $xs_same=sub {
            CORE::die $xs_literal_refusal unless @_==1;
            my $xs_record=$_[0];CORE::die $xs_literal_refusal unless $xs_record->{known}&&!$xs_record->{close_attempted};
            my ($xs_handle,$xs_io)=$xs_shape->(${ $xs_record->{cell} });
            CORE::die $xs_literal_refusal unless $xs_raw_same->($xs_handle,$xs_record->{handle})
                &&$xs_raw_same->($xs_io,$xs_record->{io});return $xs_handle;
        };
        my $xs_native=sub {
            CORE::die $xs_literal_refusal unless @_==3;
            my ($xs_kind,$xs_record,$xs_request)=@_;$xs_phase_guard->();my $xs_expected_phase=CORE::substr($xs_phase,0);
            my $xs_handle=$xs_kind eq 'lstat'||$xs_kind eq 'open'?undef:$xs_same->($xs_record);
            my $xs_raw=$xs_kind eq 'capabilities'||$xs_kind eq 'security'?8192:$xs_kind eq 'read'||$xs_kind eq 'eof'?$xs_request:0;
            $xs_charge->($xs_raw);
            my $xs_event={sequence=>$xs_operations,kind=>$xs_kind,index=>$xs_record->{index},intent=>1};
            CORE::push(@xs_native_events,$xs_event);my ($xs_buffer,$xs_attributes,$xs_fd);
            if($xs_kind eq 'capabilities'||$xs_kind eq 'security') {
                $xs_fd=$xs_record->{acl_fd};CORE::die $xs_literal_refusal unless $xs_number->($xs_fd)&&$xs_fd>=0&&$xs_fd<=2147483647;
                $xs_attributes=CORE::pack('SSLLLLL',5,0,$xs_kind eq 'security'?0x00400000:0,
                    $xs_kind eq 'capabilities'?0x80020000:0,0,0,0);
                $xs_buffer="\xcc" x 8192;$xs_event->{attributes}=$xs_attributes;$xs_event->{buffer_cell}=\$xs_buffer;$xs_event->{request}=8192;
            }elsif($xs_kind eq 'read'||$xs_kind eq 'eof') {
                CORE::die $xs_literal_refusal unless $xs_number->($xs_request)&&$xs_request>=1&&$xs_request<=271713;
                $xs_buffer='';$xs_event->{buffer_cell}=\$xs_buffer;$xs_event->{request}=$xs_request;
            }
            $xs_phase_guard->();$!=0;
            my $xs_ok=eval {
                if($xs_kind eq 'lstat') {$xs_event->{values}=[CORE::lstat($xs_record->{path})];}
                elsif($xs_kind eq 'stat') {$xs_event->{values}=[CORE::stat($xs_handle)];}
                elsif($xs_kind eq 'open') {
                    $xs_event->{result}=CORE::sysopen(${ $xs_record->{cell} },$xs_record->{path},0x01000100);
                    $xs_event->{errno}=0+$!;
                    # Enroll a completed positive native original before postguards.
                    if($xs_plain->($xs_event->{result})&&$xs_event->{result} eq '1') {
                        my ($xs_opened_handle,$xs_opened_io)=$xs_shape->(${ $xs_record->{cell} });
                        for my $xs_prior(@xs_originals) {
                            next unless $xs_prior->{known};
                            CORE::die $xs_literal_refusal if $xs_raw_same->($xs_opened_handle,$xs_prior->{handle})
                                ||$xs_raw_same->($xs_opened_io,$xs_prior->{io});
                        }
                        $xs_record->{handle}=$xs_opened_handle;$xs_record->{io}=$xs_opened_io;$xs_record->{known}=1;
                    }
                }
                elsif($xs_kind eq 'fileno') {$xs_event->{result}=CORE::fileno($xs_handle);}
                elsif($xs_kind eq 'capabilities'||$xs_kind eq 'security') {$xs_event->{result}=CORE::syscall(228,$xs_fd,$xs_attributes,$xs_buffer,8192,4);}
                elsif($xs_kind eq 'seek') {$xs_event->{result}=CORE::sysseek($xs_handle,0,0);}
                elsif($xs_kind eq 'read'||$xs_kind eq 'eof') {$xs_event->{result}=CORE::sysread($xs_handle,$xs_buffer,$xs_request);}
                else {CORE::die $xs_literal_refusal;}
                $xs_event->{errno}=0+$! unless $xs_kind eq 'open';1;
            };
            $xs_event->{error}=$@;$xs_event->{ok}=$xs_ok?1:0;
            CORE::die $xs_literal_refusal unless $xs_ok&&$xs_error_plain->($xs_event->{error})&&$xs_event->{error} eq ''
                &&$xs_number->($xs_event->{errno});
            $xs_phase_guard->();CORE::die $xs_literal_refusal unless $xs_phase eq $xs_expected_phase;return $xs_event;
        };
        my $xs_tuple=sub {
            CORE::die $xs_literal_refusal unless @_==2;
            my ($xs_values,$xs_record)=@_;
            CORE::die $xs_literal_refusal unless CORE::ref($xs_values) eq 'ARRAY'&&!defined(CORE::tied(@$xs_values))&&@$xs_values==13;
            for my $xs_value(@$xs_values) {CORE::die $xs_literal_refusal unless $xs_number->($xs_value);}
            CORE::die $xs_literal_refusal unless ($xs_values->[2]&0170000)==($xs_record->{file}?0100000:0040000)
                &&($xs_values->[2]&0022)==0&&$xs_values->[4]==0&&$xs_values->[5]==0;
            CORE::die $xs_literal_refusal if $xs_record->{file}&&$xs_values->[7]!=$xs_record->{size};
        };
        my $xs_equal_tuple=sub {
            CORE::die $xs_literal_refusal unless @_==2;
            my ($xs_a,$xs_b)=@_;for my $xs_index(0..7,9..12) {CORE::die $xs_literal_refusal unless $xs_a->[$xs_index]==$xs_b->[$xs_index];}
        };
        my $xs_acl=sub {
            CORE::die $xs_literal_refusal unless @_==1;my $xs_record=$_[0];
            my $xs_fd_event=$xs_native->('fileno',$xs_record,0);
            CORE::die $xs_literal_refusal unless $xs_number->($xs_fd_event->{result});
            my $xs_fd=$xs_fd_event->{result};
            CORE::die $xs_literal_refusal unless $xs_number->($xs_fd)&&$xs_fd>=0&&$xs_fd<=2147483647;
            $xs_record->{acl_fd}=$xs_fd;
            for my $xs_kind('capabilities','security') {
                my $xs_event=$xs_native->($xs_kind,$xs_record,8192);
                CORE::die $xs_literal_refusal unless $xs_plain->(${ $xs_event->{buffer_cell} });
                my $xs_buffer=${ $xs_event->{buffer_cell} };
                CORE::die $xs_literal_refusal unless $xs_plain->($xs_event->{result})&&$xs_event->{result} eq '0'
                    &&$xs_plain->($xs_buffer)&&CORE::length($xs_buffer)==8192;
                if($xs_kind eq 'security') {
                    CORE::die $xs_literal_refusal unless CORE::substr($xs_buffer,0,12) eq CORE::pack('LLL',12,8,0)
                        &&CORE::substr($xs_buffer,12) eq "\xcc" x 8180;
                }else {
                    CORE::die $xs_literal_refusal unless CORE::unpack('L',CORE::substr($xs_buffer,0,4))==36
                        &&CORE::substr($xs_buffer,36) eq "\xcc" x 8156;
                    my @xs_cap=CORE::unpack('L8',CORE::substr($xs_buffer,4,32));
                    CORE::die $xs_literal_refusal unless ($xs_cap[1]&0x400)&&($xs_cap[5]&0x400);
                }
            }
        };
        my $xs_check_originals=sub {
            CORE::die $xs_literal_refusal unless @_==0&&@xs_originals==41;
            for my $xs_record(@xs_originals) {
                $xs_same->($xs_record);
                my $xs_held=$xs_native->('stat',$xs_record,0);my $xs_named=$xs_native->('lstat',$xs_record,0);
                $xs_tuple->($xs_held->{values},$xs_record);$xs_tuple->($xs_named->{values},$xs_record);
                $xs_equal_tuple->($xs_held->{values},$xs_record->{tuple});$xs_equal_tuple->($xs_held->{values},$xs_named->{values});
                $xs_acl->($xs_record);
            }
        };
        my $xs_read=sub {
            CORE::die $xs_literal_refusal unless @_==1;my $xs_record=$_[0];
            my $xs_seek=$xs_native->('seek',$xs_record,0);
            CORE::die $xs_literal_refusal unless $xs_plain->($xs_seek->{result})
                &&($xs_seek->{result} eq '0'||$xs_seek->{result} eq '0 but true');
            my $xs_read=$xs_native->('read',$xs_record,$xs_record->{size}+1);
            CORE::die $xs_literal_refusal unless $xs_plain->($xs_read->{result})&&$xs_read->{result} eq "$xs_record->{size}"
                &&!defined(CORE::tied(${ $xs_read->{buffer_cell} }));
            my $xs_bytes=${ $xs_read->{buffer_cell} };
            CORE::die $xs_literal_refusal unless $xs_plain->($xs_bytes)&&CORE::length($xs_bytes)==$xs_record->{size};
            my $xs_eof=$xs_native->('eof',$xs_record,1);
            CORE::die $xs_literal_refusal unless $xs_plain->($xs_eof->{result})&&$xs_eof->{result} eq '0'
                &&!defined(CORE::tied(${ $xs_eof->{buffer_cell} }))&&$xs_plain->(${ $xs_eof->{buffer_cell} })
                &&CORE::length(${ $xs_eof->{buffer_cell} })==0;
            $xs_ports_guard->();my $xs_digest=$xs_sha_original->($xs_bytes);
            CORE::die $xs_literal_refusal unless $xs_plain->($xs_digest)&&$xs_digest eq $xs_record->{sha};
            $xs_phase_guard->();return CORE::substr($xs_bytes,0);
        };
        my $xs_settle=sub {
            return $xs_settle_outcome if $xs_settle_started;
            $xs_settle_started=1;my $xs_all=1;my @xs_settle_errors;
            for my $xs_record(CORE::reverse(@xs_originals)) {
                unless($xs_record->{known}) {$xs_all=0;next;}
                $xs_record->{close_started}=1;my ($xs_handle,$xs_io);
                my $xs_admitted=eval {
                    ($xs_handle,$xs_io)=$xs_shape->($xs_record->{handle});
                    CORE::die $xs_literal_refusal unless $xs_raw_same->($xs_handle,$xs_record->{handle})&&$xs_raw_same->($xs_io,$xs_record->{io});1;
                };
                $xs_record->{close_admission_error}=$@;
                if($xs_admitted) {
                    $xs_record->{close_attempted}=1;my $xs_ok=eval {$xs_record->{close_return}=CORE::close($xs_handle);1;};
                    $xs_record->{close_error}=$@;$xs_record->{close_native_ok}=$xs_ok?1:0;
                }
                # Independent original-shape/liveness attempt even after close throw.
                $xs_record->{live_started}=1;my $xs_live_ok=eval {
                    my ($xs_h,$xs_i)=$xs_shape->($xs_record->{handle});
                    CORE::die $xs_literal_refusal unless $xs_raw_same->($xs_h,$xs_record->{handle})&&$xs_raw_same->($xs_i,$xs_record->{io});
                    $xs_record->{live_attempted}=1;$xs_record->{live_return}=CORE::fileno($xs_h);1;
                };
                $xs_record->{live_error}=$@;$xs_record->{live_native_ok}=$xs_live_ok?1:0;
                my $xs_ok=$xs_admitted&&$xs_record->{close_native_ok}&&$xs_plain->($xs_record->{close_return})
                    &&$xs_record->{close_return} eq '1'&&$xs_error_plain->($xs_record->{close_error})&&$xs_record->{close_error} eq ''
                    &&$xs_live_ok&&!defined($xs_record->{live_return})&&$xs_error_plain->($xs_record->{live_error})&&$xs_record->{live_error} eq '';
                $xs_record->{close_ok}=$xs_ok?1:0;$xs_all=0 unless $xs_ok;CORE::push(@xs_settle_errors,[$xs_record->{index},$xs_record->{close_admission_error},$xs_record->{close_error},$xs_record->{live_error}]) unless $xs_ok;
            }
            $xs_settle_error=$xs_all?'':$xs_literal_refusal;$xs_settle_outcome=$xs_all?1:0;return $xs_settle_outcome;
        };
        my $xs_burn=sub {
            $xs_phase='burned';
            if($xs_claimed) {my $xs_ok=eval {$xs_settle->();1;};$xs_burn_error=$@;}
            CORE::die $xs_literal_refusal;
        };
        $xs_native_readback_issue=sub {
            $xs_burn->() unless @_==0&&!defined(CORE::tied($xs_phase))&&$xs_phase eq 'new';
            my $xs_ok=eval {
                $xs_ports_guard->();CORE::die $xs_literal_refusal unless $xs_phase eq 'new'
                    &&!defined(CORE::tied(@xs_originals))&&@xs_originals==0
                    &&!defined(CORE::tied(@xs_validated))&&@xs_validated==0;
                $xs_claimed=1;$xs_phase='acquiring';
                CORE::die $xs_literal_refusal unless $^O eq 'darwin'
                    &&CORE::unpack('H*',CORE::pack('L',1)) eq '01000000'&&CORE::length(CORE::pack('J',1))==8;
                for my $xs_index(0..40) {
                    my $xs_leaf=$xs_index>=28?$xs_leaves[$xs_index-28]:undef;my $xs_fh;
                    my $xs_record={index=>$xs_index,path=>$xs_index<28?$xs_directories[$xs_index]:$xs_leaf->[0],
                        file=>$xs_index>=28?1:0,size=>defined($xs_leaf)?$xs_leaf->[1]:0,
                        sha=>defined($xs_leaf)?$xs_leaf->[2]:undef,cell=>\$xs_fh,known=>0,close_attempted=>0,open_started=>0};
                    CORE::push(@xs_originals,$xs_record);
                    my $xs_before=$xs_native->('lstat',$xs_record,0);$xs_tuple->($xs_before->{values},$xs_record);
                    $xs_record->{open_started}=1;my $xs_opened=$xs_native->('open',$xs_record,0);
                    CORE::die $xs_literal_refusal unless $xs_plain->($xs_opened->{result})&&$xs_opened->{result} eq '1'
                        &&$xs_record->{known};
                    my $xs_held=$xs_native->('stat',$xs_record,0);$xs_tuple->($xs_held->{values},$xs_record);
                    my $xs_named=$xs_native->('lstat',$xs_record,0);$xs_tuple->($xs_named->{values},$xs_record);
                    $xs_equal_tuple->($xs_before->{values},$xs_held->{values});$xs_equal_tuple->($xs_held->{values},$xs_named->{values});
                    $xs_record->{tuple}=[@{$xs_held->{values}}];$xs_acl->($xs_record);
                }
                $xs_check_originals->();$xs_phase='reading';
                for my $xs_index(0..12) {$xs_validated[$xs_index]=$xs_read->($xs_originals[$xs_index+28]);}
                $xs_check_originals->();
                for my $xs_index(0..12) {
                    my $xs_bytes=$xs_read->($xs_originals[$xs_index+28]);
                    CORE::die $xs_literal_refusal unless $xs_plain->($xs_validated[$xs_index])&&$xs_bytes eq $xs_validated[$xs_index];
                }
                $xs_check_originals->();$xs_ports_guard->();
                CORE::die $xs_literal_refusal unless $xs_phase eq 'reading'&&@xs_validated==13;
                $xs_phase='held';1;
            };
            $xs_issue_error=$@;$xs_burn->() unless $xs_ok;return 1;
        };
        $xs_native_readback_recheck=sub {
            $xs_rechecks++;$xs_burn->() unless @_==0&&$xs_rechecks<=64
                &&!defined(CORE::tied($xs_phase))&&$xs_phase eq 'held';
            $xs_phase='rechecking';
            my $xs_ok=eval {
                $xs_ports_guard->();CORE::die $xs_literal_refusal unless $xs_phase eq 'rechecking'
                    &&!defined(CORE::tied(@xs_validated))&&@xs_validated==13;
                $xs_check_originals->();
                for my $xs_index(0..12) {
                    my $xs_bytes=$xs_read->($xs_originals[$xs_index+28]);
                    CORE::die $xs_literal_refusal unless !defined(CORE::tied($xs_validated[$xs_index]))
                        &&$xs_plain->($xs_validated[$xs_index])&&$xs_bytes eq $xs_validated[$xs_index];
                }
                $xs_check_originals->();$xs_phase_guard->();
                CORE::die $xs_literal_refusal unless $xs_phase eq 'rechecking';
                $xs_phase='held';1;
            };
            $xs_recheck_error=$@;$xs_burn->() unless $xs_ok;return 1;
        };
        $xs_native_readback_release=sub {
            if($xs_release_api_started) {
                $xs_burn->() unless @_==0;
                CORE::die $xs_literal_refusal unless $xs_release_api_outcome;return 1;
            }
            $xs_release_api_started=1;$xs_phase='releasing';
            my $xs_ok=eval {CORE::die $xs_literal_refusal unless @_==0;$xs_ports_guard->();1;};
            $xs_release_api_error=$@;
            my $xs_closed;my $xs_settled=eval {$xs_closed=$xs_settle->();1;};my $xs_settlement_error=$@;
            $xs_release_api_outcome=$xs_ok&&$xs_settled&&$xs_closed?1:0;
            $xs_release_api_error=$xs_settlement_error if $xs_ok&&!$xs_settled;
            $xs_release_api_error=$xs_literal_refusal if !$xs_release_api_outcome&&$xs_release_api_error eq '';
            $xs_phase=$xs_release_api_outcome?'released':'burned';
            CORE::die $xs_literal_refusal unless $xs_release_api_outcome;return 1;
        };
        # Private XS lifecycle closures end here.
    }
}
# End fixed XS native readback prerequisite.
use strict;
use warnings;
use B ();
use JSON::PP ();
use Digest::SHA ();
use MIME::Base64 ();
use Encode ();
use POSIX ();
use Fcntl ();
use IO::Select ();
use Time::HiRes ();

my $last_clock=0;
sub task6a_origin_now {
    task6a_origin_refuse() unless @_==0;
    my $now;
    my $ok=eval {$now=Time::HiRes::clock_gettime(Time::HiRes::CLOCK_MONOTONIC());1;};
    task6a_origin_refuse() unless $ok&&defined($now)&&!ref($now);
    my $flags=B::svref_2object(\$now)->FLAGS;
    task6a_origin_refuse() if $flags&B::SVf_POK();
    task6a_origin_refuse() unless $flags&(B::SVf_IOK()|B::SVf_NOK());
    task6a_origin_refuse() if $now!=$now||$now<0||$now<$last_clock||$now>1e12;
    $last_clock=$now;return $now;
}
my $bootstrap_deadline=task6a_origin_now()+180;
my @helper_ledger;
my $helper_lifecycle_burned=0;
my @file_ledger;
my @directory_ledger;
my $file_lifecycle_burned=0;
my $file_lifecycle_released=0;
my $physical_state='new';
my $physical_owns_ledgers=0;
my $physical_internal=0;
my $physical_cleanup_attempted=0;
my $physical_cleanup_ok=0;
my $physical_file;
my @physical_directories;
my @physical_owned_handles;

# The private constructor below mints its own original launcher pair.
# Cold entry and startup admission remain closed.
my ($parent_admission,$parent_original_admission,$parent_original_pid);
my ($parent_constructor,$parent_constructor_finish,$parent_constructor_dispose,
    $parent_constructor_material_allowed,$parent_constructor_observe_wait,$parent_native_can_claim,
    $parent_constructor_deadline,$parent_constructor_cleanup_deadline,
    $parent_constructor_owns_node,$parent_constructor_shutdown_node,
    $parent_constructor_children_settled,$parent_constructor_physical_bindings);
my ($physical_can_claim,$physical_claim,$physical_require_live,$physical_epoch,
    $physical_hold_private,$physical_release_private,$physical_open,$physical_disposal_allowed,
    $physical_cleanup_private,$physical_cleanup_complete,$physical_constructor_dispose);
my $parent_material_deadline=sub {
    return $parent_constructor_deadline if defined($parent_constructor_deadline)
        &&defined($parent_constructor_material_allowed)&&!$parent_constructor_material_allowed->()
        &&$parent_constructor_deadline<$bootstrap_deadline;
    return $bootstrap_deadline;
};
my ($parent_native_original_pid,$parent_native_target_pid,$parent_native_birth_ordinal,$parent_native_original_start,$parent_native_deadline);
my @parent_native_originals;
my ($parent_native_epoch1,$parent_native_epoch2,$parent_native_finish,
    $parent_native_dispose,$parent_native_node_wait_allowed,$parent_native_prepare,$parent_native_cleanup_complete);
my @parent_originals;
my $parent_phase='absent';
my $parent_invalid=0;
my ($parent_cleanup_started,$parent_cleanup_complete)=(0,0);
my (@parent_close_attempted,@parent_definitely_closed);
my ($parent_start,$parent_deadline);
my ($parent_authenticated,$parent_known_live,$parent_reaped,$parent_uncertain)=(0,0,0,0);
my $parent_raw_status;
my ($parent_pending,$parent_input_bytes,$parent_output_bytes)=('',0,0);
my @parent_nonces;
my ($parent_matched,$parent_ready,$parent_end_written,$parent_final_end)=(0,0,0,0);
my @parent_eof;

my $parent_same_identity=sub {
    my ($original,$observed)=@_;
    task6a_origin_refuse() unless ref($original) eq 'ARRAY'&&ref($observed) eq 'ARRAY'
        &&@$original==13&&@$observed==13;
    for my $field(0..6) {
        task6a_origin_refuse() unless defined($original->[$field])&&defined($observed->[$field])
            &&$original->[$field]==$observed->[$field];
    }
};
my $parent_recheck_originals=sub {
    my %fds;
    for my $index(0..$#parent_originals) {
        my $record=$parent_originals[$index];next unless defined($record);
        next if $parent_definitely_closed[$index];
        my $fh=$record->{fh};my $fd=defined($fh)?fileno($fh):undef;
        task6a_origin_refuse() unless defined($fd)&&defined($record->{fd})&&$fd==$record->{fd}&&!$fds{$fd}++;
        my @now=stat($fh);$parent_same_identity->($record->{identity},\@now);
        task6a_origin_refuse() unless $index==4?Fcntl::S_ISCHR($now[2]):Fcntl::S_ISFIFO($now[2]);
    }
};
my $parent_close=sub {
    my ($index)=@_;
    task6a_origin_refuse() if $parent_close_attempted[$index]||$parent_definitely_closed[$index];
    my $record=$parent_originals[$index];task6a_origin_refuse() unless defined($record)&&defined($record->{fh});
    $parent_close_attempted[$index]=1;
    my $ok=eval {close($record->{fh})};my $error=$@;
    task6a_origin_refuse() unless $ok&&!length($error)&&!defined(fileno($record->{fh}));
    $parent_definitely_closed[$index]=1;
};
my $parent_dispose=sub {
    return if $parent_cleanup_started;
    $parent_cleanup_started=1;my $closed=1;
    # Source, not a test fence, settles the querying observer before any Node
    # reap/shutdown. Unknown observer preserves the original unreaped Node lease.
    my $native_settled;my $native_ok=eval {$native_settled=$parent_native_dispose->();1;};
    my $native_error=$@;$parent_uncertain=1 unless $native_ok&&!length($native_error)&&$native_settled;
    for my $index(0..$#parent_originals) {
        next unless defined($parent_originals[$index]);
        next if $parent_definitely_closed[$index];
        if($parent_close_attempted[$index]) {$closed=0;next;}
        my $ok=eval {$parent_close->($index);1;};my $error=$@;
        $closed=0 unless $ok&&!length($error)&&$parent_definitely_closed[$index];
    }
    if(defined($parent_constructor_owns_node)&&$parent_constructor_owns_node->()) {
        unless($parent_reaped||$parent_uncertain) {
            my $ok=eval {task6a_origin_refuse() unless $parent_constructor_shutdown_node->();1;};
            $parent_uncertain=1 unless $ok&&!length($@);
        }
    } else {
    if($parent_authenticated&&!$parent_reaped&&!$parent_uncertain) {
        # Valid custody may fail before its first epoch poll. Cleanup observes
        # ONLY this authenticated sealed PID, never an admission field.
        my $ok=eval {task6a_origin_poll($parent_original_pid,\$parent_reaped,\$parent_uncertain,\$parent_raw_status);1;};
        my $error=$@;$parent_uncertain=1 unless $ok&&!length($error);
        $parent_known_live=!$parent_reaped&&!$parent_uncertain;
    }
    if($parent_authenticated&&$parent_known_live&&!$parent_reaped&&!$parent_uncertain) {
        my $ok=eval {task6a_origin_shutdown_helper($parent_original_pid,\$parent_reaped,\$parent_uncertain,\$parent_raw_status);1;};
        my $error=$@;$parent_uncertain=1 unless $ok&&!length($error);
    }
    }
    $parent_cleanup_complete=$closed&&$parent_native_cleanup_complete->()&&(!$parent_authenticated||($parent_reaped&&!$parent_uncertain));
};
my $parent_check_admission=sub {
    task6a_origin_refuse() unless ref($parent_admission) eq 'HASH'&&ref($parent_original_admission) eq 'HASH'
        &&$parent_admission==$parent_original_admission
        &&join(',',sort keys %$parent_admission) eq 'input,pid,setup,stderr,stdout';
    # Target pid_t is signed32. Inspect raw flags BEFORE coercive equality,
    # including the independently copied PID in the admission record.
    for my $pid($parent_original_pid,$parent_admission->{pid}) {
        task6a_origin_refuse() unless defined($pid)&&!ref($pid);
        my $flags=B::svref_2object(\$pid)->FLAGS;
        task6a_origin_refuse() if $flags&B::SVf_POK();
        task6a_origin_refuse() unless ($flags&(B::SVf_IOK()|B::SVf_NOK()))
            &&$pid>=1&&$pid<=2147483647&&$pid==int($pid);
    }
    task6a_origin_refuse() unless $parent_admission->{pid}==$parent_original_pid;
    my @names=('input','stdout','stderr','setup');
    for my $index(0..3) {
        my $original=$parent_originals[$index];my $selected=$parent_admission->{$names[$index]};
        task6a_origin_refuse() unless ref($original) eq 'HASH'&&defined($original->{fh})
            &&defined($selected)&&ref($selected)&&$selected==$original->{fh};
    }
};
my $parent_epoch=sub {
    task6a_origin_parent_require_unburned();
    $physical_require_live->();
    task6a_origin_refuse() unless $parent_native_node_wait_allowed->();
    $parent_check_admission->();
    my $now=task6a_origin_now();task6a_origin_refuse() unless defined($parent_deadline)&&$now<$parent_deadline;
    my $ok=eval {task6a_origin_poll($parent_original_pid,\$parent_reaped,\$parent_uncertain,\$parent_raw_status);1;};
    my $error=$@;$parent_uncertain=1 unless $ok&&!length($error);
    task6a_origin_refuse() if $parent_uncertain;
    if($parent_reaped) {
        task6a_origin_refuse() unless $parent_definitely_closed[0]
            &&defined($parent_raw_status)&&$parent_raw_status==0;
        $parent_known_live=0;
    } else {$parent_known_live=1;}
    $parent_recheck_originals->();return $now;
};
my $parent_write=sub {
    my ($bytes,$terminal)=@_;$parent_epoch->();
    task6a_origin_refuse() unless defined($bytes)&&!ref($bytes)&&!utf8::is_utf8($bytes)
        &&length($bytes)>0&&$parent_input_bytes+length($bytes)<=229;
    my ($count,$errno);my $ok=eval {$!=0;
        $count=syswrite($parent_originals[0]{fh},$bytes,length($bytes));$errno=0+$!;1;};my $error=$@;
    task6a_origin_refuse() unless $ok&&!length($error)&&defined($count)&&$count==length($bytes)&&$errno==0;
    $parent_input_bytes+=$count;$parent_epoch->() unless $terminal;
};
my $parent_entropy=sub {
    unless(defined($parent_originals[4])) {
        my @before=lstat('/dev/urandom');
        task6a_origin_refuse() unless @before==13&&Fcntl::S_ISCHR($before[2])&&$before[3]==1&&$before[4]==0&&$before[5]==0;
        my $fh;
        sysopen($fh,'/dev/urandom',Fcntl::O_RDONLY()|Fcntl::O_NOFOLLOW()|Fcntl::O_NONBLOCK()) or task6a_origin_refuse();
        # A live alias is not a new acquisition or a second close obligation.
        for my $index(0..3) {
            next if $parent_definitely_closed[$index];
            my $old=$parent_originals[$index]{fh};
            task6a_origin_refuse() if $fh==$old
                ||(defined(fileno($fh))&&defined(fileno($old))&&fileno($fh)==fileno($old));
        }
        $parent_originals[4]={fh=>$fh};
        $parent_originals[4]{fd}=fileno($fh);
        my @opened=stat($fh);$parent_originals[4]{identity}=\@opened;
        $parent_same_identity->(\@before,\@opened);
        binmode($fh) or task6a_origin_refuse();
        fcntl($fh,Fcntl::F_SETFD(),Fcntl::FD_CLOEXEC()) or task6a_origin_refuse();
        my $flags=fcntl($fh,Fcntl::F_GETFL(),0);my $descriptor=fcntl($fh,Fcntl::F_GETFD(),0);
        task6a_origin_refuse() unless defined($flags)&&($flags&Fcntl::O_ACCMODE())==Fcntl::O_RDONLY()
            &&($flags&Fcntl::O_NONBLOCK())&&defined($descriptor)&&($descriptor&Fcntl::FD_CLOEXEC());
    }
    my $record=$parent_originals[4];$parent_epoch->();
    my ($count,$errno);my $bytes='';
    my $ok=eval {$!=0;$count=sysread($record->{fh},$bytes,32);$errno=0+$!;1;};my $error=$@;
    task6a_origin_refuse() unless $ok&&!length($error)&&defined($count)&&$count==32&&$errno==0
        &&!utf8::is_utf8($bytes)&&length($bytes)==32;
    $parent_epoch->();
    $parent_same_identity->($record->{identity},[lstat('/dev/urandom')]);
    $parent_same_identity->($record->{identity},[stat($record->{fh})]);
    my $nonce=unpack('H*',$bytes);
    task6a_origin_refuse() unless $nonce =~ /\A[0-9a-f]{64}\z/;
    for my $old(@parent_nonces) {task6a_origin_refuse() if $old eq $nonce;}
    $parent_close->(4) if @parent_nonces==2;
    return $nonce;
};

sub task6a_origin_parent_require_unburned {
    task6a_origin_refuse() unless @_==0&&!$parent_invalid;
    return JSON::PP::true;
}
my $parent_consume_protocol=sub {
    my $arity=@_;my $diagnostic;
    my $ok=eval {
        task6a_origin_parent_require_unburned();
        task6a_origin_refuse() unless $arity==0&&$parent_phase eq 'absent'&&@parent_originals==4;
        $parent_check_admission->();
        $parent_recheck_originals->();$parent_authenticated=1;$parent_phase='starting';
        $parent_start=task6a_origin_now();$parent_deadline=$parent_start+45;
        $parent_deadline=$bootstrap_deadline if $bootstrap_deadline<$parent_deadline;
        $parent_deadline=$parent_constructor_deadline if defined($parent_constructor_deadline)&&$parent_constructor_deadline<$parent_deadline;
        $parent_deadline=$parent_native_deadline if defined($parent_native_deadline)&&$parent_native_deadline<$parent_deadline;
        $parent_epoch->();
        for my $index(0..3) {
            my $fh=$parent_originals[$index]{fh};binmode($fh) or task6a_origin_refuse();
            fcntl($fh,Fcntl::F_SETFD(),Fcntl::FD_CLOEXEC()) or task6a_origin_refuse();
            my $flags=fcntl($fh,Fcntl::F_GETFL(),0);task6a_origin_refuse() unless defined($flags);
            fcntl($fh,Fcntl::F_SETFL(),$flags|Fcntl::O_NONBLOCK()) or task6a_origin_refuse();
            my $actual=fcntl($fh,Fcntl::F_GETFL(),0);my $descriptor=fcntl($fh,Fcntl::F_GETFD(),0);
            task6a_origin_refuse() unless defined($actual)&&($actual&Fcntl::O_NONBLOCK())
                &&defined($descriptor)&&($descriptor&Fcntl::FD_CLOEXEC());
        }
        $parent_recheck_originals->();$parent_phase='active';
        my $selector=IO::Select->new(map {$parent_originals[$_]{fh}} (1,2,3));
        while(1) {
            my $now=$parent_epoch->();
            if($parent_phase eq 'ending'&&$parent_final_end&&$parent_eof[1]&&$parent_eof[2]&&$parent_eof[3]
                &&$parent_reaped&&!$parent_uncertain&&defined($parent_raw_status)&&$parent_raw_status==0) {
                task6a_origin_refuse() unless @parent_originals==5&&$parent_input_bytes==229&&$parent_output_bytes==220
                    &&@parent_nonces==3&&$parent_matched==3;
                for my $index(0..4) {task6a_origin_refuse() unless $parent_definitely_closed[$index];}
                $parent_native_finish->();
                $parent_phase='settled';$parent_cleanup_started=1;$parent_cleanup_complete=1;
                $diagnostic={scope=>'parent-entry-protocol-diagnostic-only',productionAuthority=>JSON::PP::false,
                    challengeCount=>3,inputBytes=>229,outputBytes=>220,handlesClosed=>5,reaped=>JSON::PP::true};
                last;
            }
            my $wait=$parent_deadline-$now;$wait=0.01 if $wait>0.01;
            my (@ready,$errno);my $ready_ok=eval {$!=0;@ready=$selector->can_read($wait);$errno=0+$!;1;};my $ready_error=$@;
            task6a_origin_refuse() unless $ready_ok&&!length($ready_error)&&$errno==0;
            $parent_epoch->();my %ready;
            for my $fh(@ready) {
                my $found;
                for my $index(1,2,3) {
                    next if $parent_definitely_closed[$index];
                    $found=$index if ref($fh)&&$fh==$parent_originals[$index]{fh};
                }
                task6a_origin_refuse() unless defined($found)&&!$ready{$found}++&&$selector->exists($fh);
            }
            for my $index(3,2,1) {
                next unless $ready{$index};$parent_epoch->();
                my $buffer='';my ($count,$read_errno);my $request=$index==1?71:1;
                my $read_ok=eval {$!=0;$count=sysread($parent_originals[$index]{fh},$buffer,$request);$read_errno=0+$!;1;};
                my $read_error=$@;
                task6a_origin_refuse() unless $read_ok&&!length($read_error)&&defined($count)&&!ref($count)
                    &&$count>=0&&$count==int($count)&&$count<=$request&&$read_errno==0
                    &&!utf8::is_utf8($buffer)&&length($buffer)==$count;
                $parent_epoch->();
                if($count==0) {
                    task6a_origin_refuse() if $index==1&&(!$parent_final_end||$parent_phase ne 'ending');
                    $parent_eof[$index]=1;$selector->remove($parent_originals[$index]{fh});$parent_close->($index);
                    next;
                }
                task6a_origin_refuse() unless $index==1&&!$parent_final_end;
                $parent_output_bytes+=$count;task6a_origin_refuse() if $parent_output_bytes>220;
                $parent_pending.=$buffer;
                my $expected;
                if(!$parent_ready) {$expected="READY\n";}
                elsif($parent_phase eq 'ending') {
                    task6a_origin_refuse() unless $parent_end_written&&$parent_definitely_closed[0];$expected="END\n";
                } else {
                    task6a_origin_refuse() unless @parent_nonces==$parent_matched+1;
                    $expected='PONG '.$parent_nonces[$parent_matched]."\n";
                }
                task6a_origin_refuse() unless length($parent_pending)<=length($expected)&&index($expected,$parent_pending)==0;
                if(length($parent_pending)==length($expected)) {
                    if(!$parent_ready) {next;}
                    if($parent_phase eq 'ending') {$parent_final_end=1;}
                    else {++$parent_matched;}
                    $parent_pending='';
                }
            }
            if(!$parent_ready&&$parent_pending eq "READY\n"&&$parent_eof[3]&&$parent_definitely_closed[3]) {
                $parent_ready=1;$parent_pending='';
            }
            if($parent_ready&&$parent_phase eq 'active'&&$parent_matched==@parent_nonces) {
                if($parent_matched==3) {
                    $physical_epoch->();$parent_native_epoch2->();
                    $parent_write->("END\n",1);$parent_end_written=1;
                    $parent_close->(0);$parent_phase='ending';$parent_epoch->();
                } else {
                    if($parent_matched==0) {$physical_epoch->();$parent_native_epoch1->();}
                    my $nonce=$parent_entropy->();$parent_write->('CHALLENGE '.$nonce."\n",0);
                    push @parent_nonces,$nonce;
                }
            }
            Time::HiRes::sleep($wait) unless $selector->count()||$parent_reaped;
        }
        1;
    };my $primary=$@;
    if(!$ok) {$parent_invalid=1;$parent_dispose->();task6a_origin_refuse();}
    return $diagnostic;
};

sub task6a_origin_consume_entry_protocol {
    # Preclaim is outside the protocol catch: prior owners are never ours to burn.
    task6a_origin_refuse() unless @_==0&&defined($parent_constructor);
    $parent_constructor->();
    my $diagnostic;my $ok=eval {
        $diagnostic=$parent_consume_protocol->();$parent_constructor_finish->();1;
    };my $error=$@;
    unless($ok&&!length($error)) {eval {$parent_constructor_dispose->();1;};task6a_origin_refuse();}
    return $diagnostic;
}

my $staged_plain_cell=sub {
    my ($cell)=@_;
    my $sv=B::svref_2object($cell);
    task6a_origin_refuse() if $sv->FLAGS & 0x00f00000;
    # No candidate value has been accessed yet. B object dispatch is on the
    # installed introspection object, never on the candidate.
    return $sv;
};
my $staged_scalar=sub {
    my ($cell)=@_;
    my $sv=$staged_plain_cell->($cell);
    task6a_origin_refuse() if $sv->FLAGS & B::SVf_ROK();
    task6a_origin_refuse() unless defined($$cell);
    return $$cell;
};
my $staged_container=sub {
    my ($cell,$kind)=@_;
    my $sv=$staged_plain_cell->($cell);
    task6a_origin_refuse() unless ref($sv) eq 'B::IV'
        &&($sv->FLAGS & B::SVf_ROK());
    my $rv=$sv->RV;
    task6a_origin_refuse() unless ref($rv) eq $kind;
    task6a_origin_refuse() if $rv->FLAGS & 0x00f00000;
    my $magic=$rv->MAGIC;
    task6a_origin_refuse() if defined($magic);
    return $$cell;
};
my $staged_vector=sub {
    my ($reference)=@_;
    # reference is manufactured privately with \@vector. Inspect the original
    # AV before length/index/iteration; taking its reference does not FETCH it.
    my $av=B::svref_2object($reference);
    task6a_origin_refuse() unless ref($av) eq 'B::AV';
    task6a_origin_refuse() if $av->FLAGS & 0x00f00000;
    my $magic=$av->MAGIC;
    task6a_origin_refuse() if defined($magic);
};
my $staged_native_fh=sub {
    my ($cell,$allow_empty)=@_;
    my $sv=$staged_plain_cell->($cell);
    unless($sv->FLAGS & B::SVf_ROK()) {
        return 0 if $allow_empty&&!defined($$cell);
        task6a_origin_refuse();
    }
    task6a_origin_refuse() unless ref($sv) eq 'B::IV';
    my $gv=$sv->RV;
    task6a_origin_refuse() unless ref($gv) eq 'B::GV';
    task6a_origin_refuse() if $gv->FLAGS & 0x00f00000;
    my $gv_magic=$gv->MAGIC;
    task6a_origin_refuse() if defined($gv_magic);
    my $io=$gv->IO;
    task6a_origin_refuse() unless ref($io) eq 'B::IO';
    # Ordinary native IO has SVs_OBJECT. Magic, not that bit, admits FILENO
    # callbacks; the scalar and GV object bits were already rejected above.
    task6a_origin_refuse() if $io->FLAGS & 0x00e00000;
    my $io_magic=$io->MAGIC;
    task6a_origin_refuse() if defined($io_magic);
    return 1;
};

# Inert private parent/native owner. No production initializer or artifact path.
{
    BEGIN {$^H|=0x01000000;CORE::delete($^H{'overloading'});}
    # Fixed protected target policy. Only an ordinary declaration-copy fixture
    # projects these two literals; this is not a production profile selector.
    my ($parent_native_uid,$parent_native_gid)=(70,70);
    my ($native_invalid,$native_busy,$native_claimed)=(0,0,0);
    my ($native_inflight,$native_expected,$native_sequence)=(-1,0,1);
    my ($native_reaped,$native_uncertain,$native_status)=(0,0,undef);
    my ($native_deadline,$native_cleanup_deadline,$native_stage_deadline);
    my ($native_os,$native_io,$native_reads,$native_clean)=(0,0,0,0);
    my ($native_bytes,$native_raw_bytes,$native_frames,$native_input)=(0,0,0,0);
    my ($native_pending,$native_primary)=('','');
    my (@native_raw,@native_errors,@native_forced,@native_native,@native_closed);
    my (@native_eof,@native_close_attempted,@native_definitely_closed);
    my ($native_birth,$native_audit,$native_name);
    my ($native_ack,$native_end,$native_closed_frame)=(0,0,0);
    my $native_owned_pid;my @native_writes;
    my ($native_rows,$native_attempts,$native_cursor,$native_ended)=(0,0,0,0);
    my ($native_dispose_started,$native_dispose_ok,$native_prepared,$native_prepare_claimed,$native_physical)=(0,0,0,0,0);
    my @native_keeper;
    my $native_error=sub {
        my ($error)=@_;$error='' unless defined($error);
        push @native_errors,substr($error,0,1024) if @native_errors<64;
        $native_invalid=1 if length($error)>1024||@native_errors>=64;
    };
    my $native_charge=sub {
        my ($io,$cleanup)=@_;
        if($cleanup&&$cleanup==2) {task6a_origin_refuse() if ++$native_physical>20;}
        elsif($cleanup) {task6a_origin_refuse() if ++$native_clean>4076;}
        else {task6a_origin_refuse() if ++$native_os>131072||($io&&++$native_io>32768);}
    };
    my $native_clock=sub {$native_charge->(0,$native_dispose_started?1:0);return task6a_origin_now();};
    my $native_now=sub {
        my $now=$native_clock->();
        task6a_origin_refuse() unless defined($native_deadline)&&$now<$native_deadline
            &&(!defined($native_stage_deadline)||$now<$native_stage_deadline);
        return $now;
    };
    my $native_pid=sub {
        my ($cell)=@_;my $sv=$staged_plain_cell->($cell);
        task6a_origin_refuse() if $sv->FLAGS&(B::SVf_ROK()|B::SVf_POK());
        task6a_origin_refuse() unless $sv->FLAGS&B::SVf_IOK();
        my $value=$$cell;
        task6a_origin_refuse() unless $value>=1&&$value<=2147483647&&$value==int($value);
        return $value;
    };
    my $native_shape=sub {
        my ($cell)=@_;$staged_native_fh->($cell,0);
        my $gv=B::svref_2object($cell)->RV;my $io=$gv->IO;
        return [$$gv,$$io];
    };
    my $native_all_closed=sub {
        return 0 unless @native_keeper==4&&@native_definitely_closed==4;
        for my $index(0..3) {return 0 unless defined($native_keeper[$index])&&$native_definitely_closed[$index];}
        return 1;
    };
    my $native_close=sub {
        my ($index)=@_;return $native_definitely_closed[$index] if $native_close_attempted[$index];
        $native_close_attempted[$index]=1;
        my $record=$native_keeper[$index];
        task6a_origin_refuse() unless ref($record) eq 'HASH'&&$record->{close_allowed};
        $staged_native_fh->(\($record->{fh}),0);$record->{known}=1;
        my ($ret,$errno);my $ok=eval {$native_charge->(0,2);$staged_native_fh->(\($record->{fh}),0);
            if(defined($record->{fd})) {$native_charge->(0,2);my $fd=fileno($record->{fh});task6a_origin_refuse() unless defined($fd)&&$fd==$record->{fd};}
            if(defined($record->{identity})) {$native_charge->(0,2);my @now=stat($record->{fh});$parent_same_identity->($record->{identity},\@now);}
            $native_charge->(0,2);$!=0;$ret=close($record->{fh});$errno=0+$!;1;};my $error=$@;
        $record->{close_return}=$ret;$record->{close_errno}=$errno;$record->{close_error}=$error;
        my ($live,$live_error);my $live_ok=eval {$native_charge->(0,2);
            $staged_native_fh->(\($record->{fh}),0);$live=fileno($record->{fh});1;};$live_error=$@;
        $record->{live_fileno}=$live;$record->{live_error}=$live_error;
        $native_definitely_closed[$index]=1 if $ok&&$ret&&!length($error)&&$live_ok&&!defined($live)&&!length($live_error);
        $native_error->('close-'.$index) unless $native_definitely_closed[$index];
        return $native_definitely_closed[$index];
    };
    my $native_poll=sub {
        my ($cleanup)=@_;return if $native_reaped||$native_uncertain;
        $native_charge->(0,$cleanup);
        my $ok=eval {task6a_origin_refuse() unless defined($native_owned_pid);task6a_origin_poll($native_owned_pid,\$native_reaped,\$native_uncertain,\$native_status);1;};
        my $error=$@;$native_error->($error) if length($error);
        $native_uncertain=1 unless $ok&&!length($error);
    };
    my $native_handles=sub {
        $staged_vector->(\@parent_native_originals);
        task6a_origin_refuse() unless @parent_native_originals==4&&@native_keeper==4;
        my %fds;
        for my $index(0..3) {
            my $record=$staged_container->(\($parent_native_originals[$index]),'B::HV');
            my $kept=$native_keeper[$index];task6a_origin_refuse() unless defined($kept)&&$record==$kept->{record};
            # Guard the ORIGINAL lent scalar before FETCH, including closed cells.
            my $shape=$native_shape->(\($record->{fh}));
            task6a_origin_refuse() unless $shape->[0]==$kept->{shape}[0]&&$shape->[1]==$kept->{shape}[1];
            next if $native_definitely_closed[$index];
            task6a_origin_refuse() unless $kept->{close_allowed}&&!$native_close_attempted[$index];
            $native_charge->(0,0);my $fd=fileno($kept->{fh});task6a_origin_refuse() unless defined($fd)&&$fd==$kept->{fd}&&!$fds{$fd}++;
            $native_charge->(0,0);my @now=stat($kept->{fh});$parent_same_identity->($kept->{identity},\@now);
            task6a_origin_refuse() unless Fcntl::S_ISFIFO($now[2]);
        }
    };
    my $native_guard=sub {
        task6a_origin_refuse() if $native_invalid||$native_uncertain||($native_reaped&&$native_expected<4)||$native_dispose_started;
        $native_now->();$native_handles->();
        task6a_origin_refuse() unless $native_pid->(\$parent_native_target_pid)==$native_pid->(\$parent_original_pid)
            &&$native_pid->(\$parent_native_original_pid)==$native_owned_pid&&$native_owned_pid!=$parent_original_pid;
    };
    my $native_record=sub {
        my ($bytes)=@_;
        # Exact consumed original bytes enter bounded private retention before
        # any header, semantic, event or native-value predicate.
        push @native_raw,$bytes;$native_bytes+=length($bytes);
        task6a_origin_refuse() if $native_bytes>2097152;
    };
    my $native_bsd=sub {
        my ($raw,$initial)=@_;task6a_origin_refuse() unless length($raw)==136;
        my @v=unpack('L<9',substr($raw,0,36));
        task6a_origin_refuse() unless $v[3]==$parent_original_pid&&$v[4]==$$
            &&$v[5]==$parent_native_uid&&$v[6]==$parent_native_gid
            &&$v[7]==$parent_native_uid&&$v[8]==$parent_native_gid;
        my ($seconds,$micros)=unpack('Q<Q<',substr($raw,120,16));
        task6a_origin_refuse() unless $seconds>0&&$micros<1000000;
        my $birth=substr($raw,12,24).substr($raw,120,16);
        if($initial) {$native_birth=$birth;}
        else {task6a_origin_refuse() unless defined($native_birth)&&$birth eq $native_birth;}
    };
    my $native_audit_check=sub {
        my ($raw,$initial)=@_;task6a_origin_refuse() unless length($raw)==36&&unpack('L<',substr($raw,0,4))==8;
        my @v=unpack('L<8',substr($raw,4,32));
        task6a_origin_refuse() unless $v[1]==$parent_native_uid&&$v[2]==$parent_native_gid
            &&$v[3]==$parent_native_uid&&$v[4]==$parent_native_gid&&$v[5]==$parent_original_pid;
        if($initial) {$native_audit=substr($raw,4,32);}
        else {task6a_origin_refuse() unless defined($native_audit)&&substr($raw,4,32) eq $native_audit;}
    };
    my $native_parse=sub {
        while(length($native_pending)>=32) {
            my ($magic,$type,$phase,$sequence,$length,$address)=unpack('a8L<L<L<L<Q<',substr($native_pending,0,32));
            task6a_origin_refuse() unless $magic eq 'T6ARP001'&&$type>=1&&$type<=6&&$phase==$native_inflight
                &&$sequence==$native_sequence&&$length<=272&&$native_inflight>=0&&!$native_closed_frame;
            last if length($native_pending)<32+$length;
            my $payload=substr($native_pending,32,$length);substr($native_pending,0,32+$length,'');
            ++$native_sequence;task6a_origin_refuse() if ++$native_frames>8322;
            if($type==6) {
                task6a_origin_refuse() unless $length>=16;
                my ($api,$ret,$errno,$rawlen)=unpack('L<l<l<L<',$payload);my $raw=substr($payload,16);
                my @schedule=$phase==0?(1,2,3,4,5,6):$phase==3?(7,8):(1,2,6,6,2,1);
                my %lengths=(1=>4,2=>136,3=>4,4=>4,5=>4,6=>36,7=>0,8=>4);
                task6a_origin_refuse() unless @native_native<@schedule&&$api==$schedule[@native_native]
                    &&exists($lengths{$api})&&$rawlen==$lengths{$api}&&$length==16+$rawlen;
                task6a_origin_refuse() if ($phase==1||$phase==2)&&@native_native>=3&&!$native_ended;
                $native_raw_bytes+=$rawlen;task6a_origin_refuse() if $native_raw_bytes>1048576;
                push @native_native,[$api,$ret,$errno,$raw];
                if($api==1) {task6a_origin_refuse() unless $ret==$$&&unpack('L<',$raw)==$$;}
                elsif($api==2) {task6a_origin_refuse() unless $ret==136;$native_bsd->($raw,$phase==0);}
                elsif($api==3) {$native_name=unpack('L<',$raw);task6a_origin_refuse() unless $ret==0&&$native_name>0;}
                elsif($api==4) {my $v=unpack('L<',$raw);task6a_origin_refuse() unless $ret==0&&($v&65536)&&!($v&1048576);}
                elsif($api==5) {task6a_origin_refuse() unless $ret==0&&unpack('L<',$raw)==$parent_original_pid;}
                elsif($api==6) {task6a_origin_refuse() unless $ret==0;$native_audit_check->($raw,$phase==0);}
                elsif($api==7) {task6a_origin_refuse() unless $ret==0;}
                elsif($api==8) {task6a_origin_refuse() unless $ret==0&&unpack('l<',$raw)==3;}
            } elsif($type==2) {
                task6a_origin_refuse() unless ($phase==1||$phase==2)&&$length==104&&@native_native==3&&!$native_ended&&$address==$native_cursor;
                my ($ret,$errno)=unpack('l<l<',$payload);my $raw=substr($payload,8,96);
                $native_raw_bytes+=96;task6a_origin_refuse() if $native_raw_bytes>1048576||++$native_attempts>4097;
                if($ret==96) {
                    my ($start,$size)=unpack('Q<Q<',substr($raw,80,16));
                    task6a_origin_refuse() unless $raw=~/[^\0]/&&++$native_rows<=4096&&$size>0&&$start>=$native_cursor
                        &&$start<=281474976710656&&$size<=281474976710656-$start&&$start+$size>$native_cursor;
                    $native_cursor=$start+$size;
                } else {task6a_origin_refuse() unless $ret==0&&$errno==22&&$native_rows>0;$native_ended=1;}
            } elsif($type==1) {
                task6a_origin_refuse() unless $phase==0&&$length==0&&@native_native==6&&!$native_ack;
                $native_ack=1;$native_inflight=-1;
            } elsif($type==3) {
                task6a_origin_refuse() unless ($phase==1||$phase==2)&&$length==16&&@native_native==6&&$native_ended;
                my @v=unpack('L<L<l<l<',$payload);
                task6a_origin_refuse() unless $v[0]==$native_rows&&$v[1]==$native_attempts&&$v[2]==0&&$v[3]==22;
                $native_end=$phase;$native_inflight=-1;
            } elsif($type==5) {
                task6a_origin_refuse() unless $phase==3&&$length==16&&@native_native==2
                    &&join(',',unpack('L<4',$payload)) eq '1,1,0,7';
                $native_closed_frame=1;$native_inflight=-1;
            } else {
                # Genuine FAILURE is retained above but can never be admission.
                task6a_origin_refuse() unless $type==4&&$length==16;
                my ($stage,$reason,$api,$cause)=unpack('L<4',$payload);
                task6a_origin_refuse() unless $stage>=1&&$stage<=5&&$reason>=1&&$reason<=12&&$api<=14&&$cause<$sequence;
                task6a_origin_refuse();
            }
            # No queued old/future frame may pass into another requested phase.
            task6a_origin_refuse() if $native_inflight<0&&length($native_pending);
        }
    };
    my $native_pump=sub {
        my ($cleanup)=@_;my @live=grep {!$native_eof[$_]&&!$native_definitely_closed[$_]} (1,2,3);
        return unless @live;
        my $selector=IO::Select->new(map {$native_keeper[$_]{fh}} @live);
        $native_charge->(1,$cleanup);$!=0;my @ready=$selector->can_read(0.01);my $errno=0+$!;
        task6a_origin_refuse() unless $errno==0;
        my %seen;for my $fh(@ready) {
            my ($index)=grep {$fh==$native_keeper[$_]{fh}} @live;
            task6a_origin_refuse() unless defined($index)&&!$seen{$index}++;
            task6a_origin_refuse() if ++$native_reads>16384;
            my $record=$native_keeper[$index];my $cap=$index==1?2097152:$index==2?65536:16;
            my $remaining=$cap+1-($record->{bytes}//0);task6a_origin_refuse() unless $remaining>0;
            my $request=$remaining<65536?$remaining:65536;my $buffer='';
            $native_charge->(1,$cleanup);$!=0;my $count=sysread($fh,$buffer,$request);my $read_errno=0+$!;
            $record->{last_read}=[$count,$read_errno,$buffer];
            if(defined($count)&&$count>0) {$record->{bytes}=($record->{bytes}//0)+$count;$native_record->($buffer);}
            task6a_origin_refuse() unless defined($count)&&$count>=0&&$count<=$request&&$read_errno==0&&length($buffer)==$count;
            task6a_origin_refuse() if ($record->{bytes}//0)>$cap;
            if($count==0) {$native_eof[$index]=1;$native_close->($index);next;}
            task6a_origin_refuse() unless $index==1;
            unless($cleanup) {$native_pending.=$buffer;$native_parse->();}
        }
    };
    my $native_wait=sub {
        my ($kind)=@_;
        while(1) {
            $native_guard->();
            if($kind==0?$native_eof[3]:$kind==1?$native_ack:$kind==2?$native_end==1:$kind==3?$native_end==2:
                $native_closed_frame&&$native_eof[1]&&$native_eof[2]&&$native_eof[3]&&$native_reaped) {
                $native_now->();last;
            }
            $native_poll->(0);
            task6a_origin_refuse() if $native_uncertain||($native_reaped&&$kind!=4);
            $native_pump->(0);
        }
    };
    my $native_command=sub {
        my ($opcode)=@_;$native_guard->();
        task6a_origin_refuse() unless $native_inflight==-1&&$opcode==$native_expected+1&&!length($native_pending);
        task6a_origin_refuse() if $opcode<4&&($parent_reaped||$parent_uncertain||!$parent_known_live);
        task6a_origin_refuse() unless $opcode<4||($parent_reaped&&!$parent_uncertain&&$parent_raw_status==0);
        my $bytes=pack('a8L<L<L<L<Q<Q<Q<','T6ARQ001',1,$opcode,$$,$parent_original_pid,$parent_native_birth_ordinal,int($native_deadline*1e9),0);
        task6a_origin_refuse() unless length($bytes)==48;
        $native_inflight=$opcode-1;@native_native=();($native_rows,$native_attempts,$native_cursor,$native_ended)=(0,0,0,0);
        my $at=0;while($at<48) {
            $native_guard->();$native_charge->(1,0);$!=0;
            my $count=syswrite($native_keeper[0]{fh},$bytes,48-$at,$at);my $errno=0+$!;
            # Every actual attempt/prefix survives later partial-write failure.
            my $written=defined($count)&&$count>0?substr($bytes,$at,$count):'';
            push @native_writes,[$count,$errno,$at,$written];
            task6a_origin_refuse() if @native_writes>193;
            $native_keeper[0]{last_write}=[$count,$errno,$written];
            task6a_origin_refuse() unless defined($count)&&$count>0&&$count<=48-$at&&$errno==0;
            $at+=$count;$native_input+=$count;task6a_origin_refuse() if $native_input>192;
        }
        ++$native_expected;
    };
    $parent_native_cleanup_complete=sub {
        return 1 unless $native_prepare_claimed||$native_claimed||@native_keeper;
        return $native_dispose_ok&&$native_all_closed->();
    };
    $parent_native_node_wait_allowed=sub {
        # Cleanup/barrier custody comes from sealed keepers, never a borrowed
        # vector/PID cell that may have drifted after eligible enrollment.
        return 1 unless @native_keeper||defined($native_owned_pid);
        return 1 if $native_reaped&&!$native_uncertain;
        return 0 if $native_uncertain||$native_invalid||$native_dispose_started||$native_inflight>=0;
        return 1;
    };
    $parent_native_dispose=sub {
        return $native_reaped&&!$native_uncertain if $native_dispose_started;
        # Cleanup/barrier custody comes from sealed keepers, never a borrowed
        # vector/PID cell that may have drifted after eligible enrollment.
        return 1 unless @native_keeper||defined($native_owned_pid);
        $native_dispose_started=1;$native_invalid=1;$native_busy=1;
        my $now;my $clock_ok=eval {$now=$native_clock->();1;};$native_error->($@) unless $clock_ok;
        # A sealed trusted clock deadline was acquired before any handle metadata.
        # Never coerce an unvalidated borrowed creation field while burned.
        $clock_ok=0 unless defined($native_cleanup_deadline);
        eval {$native_close->(0);1;};$native_error->($@) if length($@);
        # One nonblocking actual settlement observation remains independent of
        # a spent normal/stage deadline. It never authorizes another query.
        eval {$native_poll->(1);1;};$native_error->($@) if length($@);
        my ($term,$kill)=(0,0);my $start=$now;
        my $loop_ok=eval {task6a_origin_refuse() unless $clock_ok;while(!$native_reaped&&!$native_uncertain&&$native_clock->()<$native_cleanup_deadline) {
            eval {$native_poll->(1);1;};$native_error->($@) if length($@);
            last if $native_reaped||$native_uncertain;
            my $elapsed=$native_clock->()-$start;
            my $signal=(!$term&&$elapsed>=2)?'TERM':(!$kill&&$elapsed>=7)?'KILL':undef;
            if(defined($signal)) {
                $term=1 if $signal eq 'TERM';$kill=1 if $signal eq 'KILL';
                my $ok=eval {$native_charge->(0,1);$!=0;my $ret=kill($signal,$native_owned_pid);
                    push @native_forced,[$signal,$ret,0+$!];1;};$native_error->($@) unless $ok;
            }
            eval {$native_pump->(1);1;};$native_error->($@) if length($@);
        }
        1;};$native_error->($@) unless $loop_ok;
        for my $index(0..3) {eval {$native_close->($index);1;};$native_error->($@) if length($@);}
        $native_dispose_ok=$native_reaped&&!$native_uncertain&&$native_all_closed->();
        $native_busy=0;return $native_reaped&&!$native_uncertain;
    };
    $parent_native_prepare=sub {
        my $arity=@_;task6a_origin_refuse() if $native_prepare_claimed++;
        $native_busy=1;my $ok=eval {
            # Retain eligible raw originals independently of unrelated PID,
            # target/birth semantics or a borrowed parent-baseline predicate.
            $staged_vector->(\@parent_native_originals);my $count=@parent_native_originals;
            my ($admission_failed,%gv,%io)=($count==4?0:1);
            for my $index(0..($count<4?$count:4)-1) {
                my $admitted=eval {
                    my $r=$staged_container->(\($parent_native_originals[$index]),'B::HV');
                    my $shape=$native_shape->(\($r->{fh}));
                    task6a_origin_refuse() if $gv{$shape->[0]}||$io{$shape->[1]};
                    my $fh=$r->{fh};
                    $native_keeper[$index]={fh=>$fh,record=>$r,shape=>$shape,known=>1,close_allowed=>1};
                    $gv{$shape->[0]}=1;$io{$shape->[1]}=1;1;
                };my $error=$@;
                unless($admitted&&!length($error)) {$admission_failed=1;$native_error->($error);}
            }
            # Mark ALL cross-owner aliases before any semantic refusal can
            # enter cleanup. Unknown parent shapes quarantine native candidates;
            # no borrowed Node IO becomes a second native close obligation.
            my $parent_scan_failed=0;
            my $parents_ok=eval {$staged_vector->(\@parent_originals);task6a_origin_refuse() if @parent_originals>5;1;};
            unless($parents_ok) {$parent_scan_failed=1;for my $kept(@native_keeper) {$kept->{close_allowed}=0 if defined($kept);}}
            if($parents_ok) {for my $old(@parent_originals) {
                next unless defined($old);
                my $scan_ok=eval {
                    my $r=$staged_container->(\$old,'B::HV');my $shape=$native_shape->(\($r->{fh}));
                    for my $kept(@native_keeper) {
                        next unless defined($kept);
                        if($shape->[0]==$kept->{shape}[0]||$shape->[1]==$kept->{shape}[1]) {$kept->{close_allowed}=0;$parent_scan_failed=1;}
                    }1;
                };my $error=$@;
                unless($scan_ok&&!length($error)) {
                    $parent_scan_failed=1;$native_error->($error);
                    for my $kept(@native_keeper) {$kept->{close_allowed}=0 if defined($kept);}
                }
            }}
            # Even a rejected cell leaves the other eligible originals enrolled.
            my $start=$native_clock->();$native_cleanup_deadline=$start+30;
            $native_cleanup_deadline=$bootstrap_deadline if $bootstrap_deadline<$native_cleanup_deadline;
            $native_cleanup_deadline=$parent_constructor_cleanup_deadline if defined($parent_constructor_cleanup_deadline)&&$parent_constructor_cleanup_deadline<$native_cleanup_deadline;
            task6a_origin_refuse() unless $arity==0&&!$native_invalid&&!$native_dispose_started;
            $native_owned_pid=$native_pid->(\$parent_native_original_pid);
            $native_pid->(\$parent_native_target_pid);
            task6a_origin_refuse() unless $parent_native_target_pid==$parent_original_pid&&$native_owned_pid!=$parent_original_pid
                &&$native_pid->(\$parent_native_birth_ordinal)==1;
            task6a_origin_refuse() if $admission_failed||$parent_scan_failed;
            my $start_sv=$staged_plain_cell->(\$parent_native_original_start);
            task6a_origin_refuse() if $start_sv->FLAGS&(B::SVf_ROK()|B::SVf_POK());
            task6a_origin_refuse() unless $start_sv->FLAGS&(B::SVf_IOK()|B::SVf_NOK());
            task6a_origin_refuse() unless $parent_native_original_start>=0&&$parent_native_original_start<=$start;
            $native_deadline=$parent_native_original_start+15;
            my $total=$parent_native_original_start+45;
            $native_cleanup_deadline=$total if $total<$native_cleanup_deadline;
            $native_deadline=$parent_deadline if defined($parent_deadline)&&$parent_deadline<$native_deadline;
            $native_deadline=$bootstrap_deadline if $bootstrap_deadline<$native_deadline;
            $native_deadline=$parent_constructor_deadline if defined($parent_constructor_deadline)&&$parent_constructor_deadline<$native_deadline;
            $native_cleanup_deadline=$parent_constructor_cleanup_deadline if defined($parent_constructor_cleanup_deadline)&&$parent_constructor_cleanup_deadline<$native_cleanup_deadline;
            $parent_native_deadline=$native_deadline;
            # Second pass: metadata and configuration only use retained originals.
            my %fds;for my $old(@parent_originals) {
                next unless defined($old);my $r=$staged_container->(\$old,'B::HV');$native_shape->(\($r->{fh}));
                $native_charge->(0,0);my $fd=fileno($r->{fh});$fds{$fd}=1 if defined($fd);
            }
            my $fd_failed=0;
            for my $index(0..3) {
                my $kept=$native_keeper[$index];my $fd_ok=eval {
                    $native_charge->(0,0);my $fd=fileno($kept->{fh});
                    if(!defined($fd)||$fds{$fd}++) {
                        # Distinct IO with a borrowed FD is not a second close lease.
                        $kept->{close_allowed}=0;task6a_origin_refuse();
                    }
                    $kept->{fd}=$fd;1;
                };my $error=$@;
                unless($fd_ok&&!length($error)) {$fd_failed=1;$native_error->($error);}
            }
            task6a_origin_refuse() if $fd_failed;
            for my $index(0..3) {
                my $kept=$native_keeper[$index];my $fh=$kept->{fh};
                $native_charge->(0,0);my @tuple=stat($fh);$kept->{raw_identity}=[@tuple];
                task6a_origin_refuse() unless @tuple==13&&Fcntl::S_ISFIFO($tuple[2]);
                $kept->{identity}=[@tuple];
                $native_charge->(0,0);binmode($fh) or task6a_origin_refuse();
                $native_charge->(0,0);fcntl($fh,Fcntl::F_SETFD(),Fcntl::FD_CLOEXEC()) or task6a_origin_refuse();
                $native_charge->(0,0);my $flags=fcntl($fh,Fcntl::F_GETFL(),0);task6a_origin_refuse() unless defined($flags);
                $native_charge->(0,0);fcntl($fh,Fcntl::F_SETFL(),$flags|Fcntl::O_NONBLOCK()) or task6a_origin_refuse();
            }
            $native_prepared=1;1;
        };my $error=$@;$native_busy=0;
        unless($ok&&!length($error)) {
            $native_primary=$error unless length($native_primary);$native_invalid=1;
            my $cleanup_ok=eval {$parent_native_dispose->();1;};$native_error->($@) unless $cleanup_ok;
            task6a_origin_refuse();
        }
        return 1;
    };
    my $native_run=sub {
        my ($step,$arity)=@_;my $ok=eval {
            task6a_origin_refuse() unless $arity==0&&!$native_invalid&&!$native_dispose_started;
            $native_busy=1;
            if($step==1) {
                task6a_origin_refuse() if $native_claimed++;
                task6a_origin_refuse() unless $parent_ready&&$parent_eof[3]&&$parent_definitely_closed[3]&&$parent_matched==0;
                task6a_origin_refuse() unless $native_prepared;
                my $start=$native_clock->();
                $native_stage_deadline=$start+5;$native_wait->(0);
                task6a_origin_refuse() if $native_keeper[3]{bytes};
                $native_stage_deadline=$native_clock->()+3;$native_command->(1);$native_wait->(1);
                $native_stage_deadline=$native_clock->()+3;$native_command->(2);$native_wait->(2);
            } elsif($step==2) {
                task6a_origin_refuse() unless $native_claimed==1&&$native_end==1&&$parent_matched==3;
                $native_stage_deadline=$native_clock->()+3;$native_command->(3);$native_wait->(3);
            } else {
                task6a_origin_refuse() unless $step==3&&$native_end==2&&$parent_reaped&&!$parent_uncertain&&$parent_raw_status==0;
                $native_stage_deadline=$native_clock->()+1;$native_command->(4);$native_close->(0);$native_wait->(4);
                task6a_origin_refuse() unless defined($native_status)&&$native_status==0&&$native_input==192&&!length($native_pending)
                    &&!@native_errors&&!@native_forced&&$native_all_closed->();
                $native_dispose_started=1;$native_dispose_ok=1;
            }
            $native_busy=0;1;
        };my $error=$@;
        unless($ok&&!length($error)) {$native_primary=$error unless length($native_primary);$native_invalid=1;$native_busy=0;task6a_origin_refuse();}
        return 1;
    };
    $parent_native_can_claim=sub {
        return @_==0&&!$native_invalid&&!$native_busy&&!$native_claimed&&!$native_prepare_claimed
            &&!$native_dispose_started&&!@native_keeper&&!defined($native_owned_pid);
    };
    $parent_native_epoch1=sub {$native_run->(1,scalar @_)};
    $parent_native_epoch2=sub {$native_run->(2,scalar @_)};
    $parent_native_finish=sub {$native_run->(3,scalar @_)};
}
# End inert private parent/native owner.

my $staged_admission;
my $staged_snapshot;
my $staged_phase='absent';
my ($staged_invalid,$staged_uncertain,$staged_disposal_started)=(0,0,0);
my (@staged_files,@staged_directories,@staged_originals,@staged_foreign,@staged_pending);
my @staged_policy=(
    ['archive-helper','source/task6a-origin-archive-v2.pm',
        'da1fd458fcaba775be5ba09ef88157b5ee48dbda',0400],
    ['native-helper','source/task6a-origin-native-v2.pm',
        '59e1ae8de38cf2083a0294c55454083840eb47f1',0400],
    ['map-helper','source/task6a-origin-map-v2.pm',
        '9719bf4f3676b43b7858e3cabe3cee3e679120f8',0400],
    ['entry','source/task6a-protected-origin-entry-v2.mjs',
        'e53be63cdcdf286dc89adbec9770668b1fdb9cc7',0444],
);
my $staged_vendor_pin='ef28d8fab2c0e4314522d4bb1b7173270aa3937e93b92cb7de79c112ac1fa953';
my $staged_keys=sub {
    my ($hash,$literal)=@_;
    task6a_origin_refuse() unless join(',',sort keys %$hash) eq $literal;
};
my $staged_bytes=sub {
    my ($cell,$limit)=@_;
    my $sv=$staged_plain_cell->($cell);
    task6a_origin_refuse() unless ($sv->FLAGS & B::SVf_POK())
        &&!($sv->FLAGS & B::SVf_ROK());
    my $bytes=$staged_scalar->($cell);
    task6a_origin_refuse() if utf8::is_utf8($bytes);
    task6a_origin_refuse() unless length($bytes)>0&&length($bytes)<=$limit;
    return $bytes;
};
my $staged_read_admission=sub {
    my $admit=$staged_container->(\$staged_admission,'B::HV');
    $staged_keys->($admit,'creator,selected,sources,vendor');
    my $creator=$staged_container->(\($admit->{creator}),'B::HV');
    $staged_keys->($creator,'creationIdentity,rootPath');
    my $root=$staged_scalar->(\($creator->{rootPath}));
    task6a_origin_refuse() unless !utf8::is_utf8($root)&&length($root)<=1024
        &&$root =~ m{\A/private/tmp/[A-Za-z0-9][A-Za-z0-9._-]{0,127}\z};
    my $creation=$staged_container->(\($creator->{creationIdentity}),'B::AV');
    task6a_origin_refuse() unless @$creation==13;
    my @creation;
    for my $index(0..12) {
        my $cell=\($creation->[$index]);
        my $sv=$staged_plain_cell->($cell);
        task6a_origin_refuse() if $sv->FLAGS & (B::SVf_ROK()|B::SVf_POK());
        task6a_origin_refuse() unless $sv->FLAGS & B::SVf_IOK();
        my $value=$staged_scalar->($cell);
        task6a_origin_refuse() unless $value>=0&&$value<=9223372036854775807;
        push @creation,$value;
    }
    task6a_origin_refuse() unless Fcntl::S_ISDIR($creation[2])
        &&$creation[4]==0&&$creation[5]==0;
    my $sources=$staged_container->(\($admit->{sources}),'B::AV');
    task6a_origin_refuse() unless @$sources==4;
    my @refs=($admit,$creator,$creation,$sources);
    my @values=($root,@creation);
    my @bytes;
    for my $index(0..3) {
        my $row=$staged_container->(\($sources->[$index]),'B::HV');
        $staged_keys->($row,'bytes,gitBlobSha,relativePath,role');
        my $role=$staged_scalar->(\($row->{role}));
        my $path=$staged_scalar->(\($row->{relativePath}));
        my $sha=$staged_scalar->(\($row->{gitBlobSha}));
        task6a_origin_refuse() unless $role eq $staged_policy[$index][0]
            &&$path eq $staged_policy[$index][1]&&$sha eq $staged_policy[$index][2];
        my $body=$staged_bytes->(\($row->{bytes}),2097152);
        push @refs,$row;push @values,$role,$path,$sha,$body;push @bytes,$body;
    }
    my $vendor=$staged_container->(\($admit->{vendor}),'B::HV');
    $staged_keys->($vendor,'bytes,filename');
    my $filename=$staged_scalar->(\($vendor->{filename}));
    task6a_origin_refuse() unless $filename eq 'node-v22.23.1-darwin-arm64.tar.gz';
    my $archive=$staged_bytes->(\($vendor->{bytes}),134217728);
    my $selected=$staged_container->(\($admit->{selected}),'B::HV');
    $staged_keys->($selected,'archiveRef,bytes,memberName');
    my $archive_ref=$staged_container->(\($selected->{archiveRef}),'B::HV');
    task6a_origin_refuse() unless $archive_ref==$vendor;
    my $member=$staged_scalar->(\($selected->{memberName}));
    task6a_origin_refuse() unless $member eq 'node-v22.23.1-darwin-arm64/bin/node';
    my $native=$staged_bytes->(\($selected->{bytes}),134217728);
    push @refs,$vendor,$selected,$archive_ref;
    push @values,$filename,$archive,$member,$native;
    push @bytes,$archive,$native;
    return {refs=>\@refs,values=>\@values,root=>$root,creation=>\@creation,bytes=>\@bytes};
};
my $staged_check_admission=sub {
    my $now=$staged_read_admission->();
    task6a_origin_refuse() unless defined($staged_snapshot)
        &&@{$now->{refs}}==@{$staged_snapshot->{refs}}
        &&@{$now->{values}}==@{$staged_snapshot->{values}};
    for my $index(0..$#{$now->{refs}}) {
        # A retained original may have been mutated after current admission
        # replaced it. Validate both sides before any reference comparison.
        my $kind=($index==2||$index==3)?'B::AV':'B::HV';
        $staged_container->(\($staged_snapshot->{refs}[$index]),$kind);
        task6a_origin_refuse() unless $now->{refs}[$index]==$staged_snapshot->{refs}[$index];
    }
    for my $index(0..$#{$now->{values}}) {
        $staged_scalar->(\($staged_snapshot->{values}[$index]));
        task6a_origin_refuse() unless $now->{values}[$index] eq $staged_snapshot->{values}[$index];
    }
};
my $staged_freeze_admission=sub {
    task6a_origin_refuse() if defined($staged_snapshot);
    my $now=$staged_read_admission->();
    for my $index(0..3) {
        my $bytes=$now->{bytes}[$index];
        task6a_origin_refuse() unless Digest::SHA::sha1_hex(
            'blob '.length($bytes)."\0".$bytes) eq $staged_policy[$index][2];
    }
    task6a_origin_refuse() unless Digest::SHA::sha256_hex($now->{bytes}[4]) eq $staged_vendor_pin;
    # Capture expectations once; later read_admission validates current values
    # against these copies, never regenerating the record's expected hashes.
    $staged_snapshot={refs=>[@{$now->{refs}}],values=>[@{$now->{values}}],
        root=>$now->{root},creation=>[@{$now->{creation}}],files=>[]};
    my @relative=(map {$_->[1]} @staged_policy);
    push @relative,'vendor/node-v22.23.1-darwin-arm64.tar.gz','vendor/node';
    my @modes=(map {$_->[3]} @staged_policy);
    push @modes,0400,0555;
    for my $index(0..5) {
        my $bytes=$now->{bytes}[$index];
        push @{$staged_snapshot->{files}},{path=>$now->{root}.'/'.$relative[$index],
            mode=>$modes[$index],size=>length($bytes),sha256=>Digest::SHA::sha256_hex($bytes)};
    }
};

my $staged_freeze_foreign=sub {
    task6a_origin_refuse() if @staged_foreign;
    my @bindings;
    for my $records(\@parent_originals,\@file_ledger,\@directory_ledger) {
        $staged_vector->($records);
        for my $index(0..$#$records) {
            my $cell=\($records->[$index]);
            my $sv=$staged_plain_cell->($cell);
            next unless defined($$cell);
            my $row=$staged_container->($cell,'B::HV');
            task6a_origin_refuse() unless exists($row->{fh});
            my $binding=\($row->{fh});
            my $present=$staged_native_fh->($binding,1);
            push @bindings,$$binding if $present;
        }
    }
    $staged_vector->(\@physical_owned_handles);
    for my $index(0..$#physical_owned_handles) {
        my $cell=\($physical_owned_handles[$index]);
        $staged_native_fh->($cell,0);
        push @bindings,$$cell;
    }
    for my $fh(@bindings) {
        $staged_native_fh->(\$fh,0);
        next if grep {$_->{fh}==$fh} @staged_foreign;
        my $fd=CORE::fileno($fh);
        push @staged_foreign,{fh=>$fh,fd=>$fd};
    }
};
my $staged_seal=sub {
    my ($cell)=@_;
    my ($present,$fh,$fd);my $proven_alias=0;
    my $classified=eval {
        $present=$staged_native_fh->($cell,1);
        if($present) {
            # Copy/fileno only after the original-cell native shape guard.
            $fh=$$cell;$fd=CORE::fileno($fh);
            task6a_origin_refuse() unless defined($fd)&&$fd>=3;
            for my $foreign(@staged_foreign) {
                my $original=$foreign->{fh};
                $staged_native_fh->(\$original,0);
                my $live=CORE::fileno($original);
                if($fh==$original||(defined($live)&&$live==$fd)) {
                    $proven_alias=1;task6a_origin_refuse();
                }
                task6a_origin_refuse() if defined($live)&&defined($foreign->{fd})
                    &&$live!=$foreign->{fd};
            }
            for my $sealed(@staged_originals) {
                my ($original,$original_fd,$attempted,$closed)=$sealed->('binding');
                $staged_native_fh->(\$original,0);
                my $live=CORE::fileno($original);
                if($fh==$original||(defined($live)&&$live==$fd)) {
                    $proven_alias=1;task6a_origin_refuse();
                }
                task6a_origin_refuse() if defined($live)&&$live!=$original_fd;
            }
        }
        1;
    };
    my $classification_error=$@;
    unless($classified&&!length($classification_error)) {
        # Incomplete classification is not a proven borrowed alias. Never
        # independently close that uncertain pending boundary.
        $staged_uncertain=1 unless $proven_alias;
        task6a_origin_refuse();
    }
    return undef unless $present;
    my ($attempted,$closed)=(0,0);
    # The primitive is selected and captured now. No mutable record chooses
    # the FH, disposal kind or primitive at cleanup time.
    my $original_close=sub {close($fh)};
    my $sealed=sub {
        my ($op)=@_;
        return ($fh,$fd,$attempted,$closed) if $op eq 'binding';
        return $closed if $op eq 'closed';
        task6a_origin_refuse() unless $op eq 'dispose'&&!$attempted;
        $attempted=1;
        my $safe=eval {
            $staged_native_fh->(\$fh,0);
            my $live=CORE::fileno($fh);
            task6a_origin_refuse() unless defined($live)&&$live==$fd;
            1;
        };my $safety_error=$@;
        return 0 unless $safe&&!length($safety_error);
        my $ok=eval {$original_close->()};my $close_error=$@;
        my $end;
        my $inspected=eval {$staged_native_fh->(\$fh,0);$end=CORE::fileno($fh);1;};
        my $inspection_error=$@;
        $closed=1 if $ok&&!length($close_error)&&$inspected
            &&!length($inspection_error)&&!defined($end);
        return $closed;
    };
    # Register before any config/stat/hash/clock/ACL/trace operation.
    push @staged_originals,$sealed;
    return $sealed;
};
my $staged_dispose=sub {
    return 0 if $staged_disposal_started;
    $staged_disposal_started=1;
    my $all=1;
    for my $sealed(@staged_originals) {
        my $ok=eval {$sealed->('dispose')};my $error=$@;
        $all=0 unless $ok&&!length($error);
    }
    $staged_uncertain=1 unless $all;
    return $all&&!$staged_uncertain;
};
my $staged_burn=sub {
    $staged_invalid=1;$staged_phase='burned';
    unless($staged_disposal_started) {
        my $ok=eval {$staged_dispose->()};my $error=$@;
        $staged_uncertain=1 unless $ok&&!length($error);
    }
    task6a_origin_refuse();
};

my @staged_record_checks;
my $staged_guard_partial=sub {
    task6a_origin_refuse() if $staged_invalid||$staged_uncertain||$staged_disposal_started;
    $staged_vector->(\@staged_directories);$staged_vector->(\@staged_files);
    $staged_vector->(\@staged_originals);$staged_vector->(\@staged_record_checks);
};
my $staged_configure=sub {
    my ($fh,$directory)=@_;
    $staged_native_fh->(\$fh,0);
    my $flags=fcntl($fh,Fcntl::F_GETFL(),0);
    task6a_origin_refuse() unless defined($flags)&&!ref($flags)
        &&($flags & Fcntl::O_ACCMODE())==Fcntl::O_RDONLY();
    task6a_origin_refuse() unless $directory||($flags & Fcntl::O_NONBLOCK());
    my $before=fcntl($fh,Fcntl::F_GETFD(),0);
    task6a_origin_refuse() unless defined($before)&&!ref($before)
        &&($before & ~Fcntl::FD_CLOEXEC())==0;
    my $set=fcntl($fh,Fcntl::F_SETFD(),Fcntl::FD_CLOEXEC());
    task6a_origin_refuse() unless defined($set)&&$set;
    my $after=fcntl($fh,Fcntl::F_GETFD(),0);
    task6a_origin_refuse() unless defined($after)&&!ref($after)
        &&$after==Fcntl::FD_CLOEXEC();
    binmode($fh) or task6a_origin_refuse() unless $directory;
};
my $staged_acquire=sub {
    my ($path,$flags)=@_;
    my $pending;
    # Retain the ORIGINAL cell before opening, including unknown/magical output
    # boundaries. Dropping a last native reference must not become implicit
    # disposal after classification failed. Never read this slot via a callback.
    push @staged_pending,\$pending;
    my $returned;
    my $open_ok=eval {$returned=sysopen($pending,$path,$flags);1;};
    my $open_error=$@;
    # Preserve return/exception before any clock, trace or metadata callback.
    # Classify the actual output even after false or an exposed assignment/throw.
    my $sealed=$staged_seal->(\$pending);
    $staged_plain_cell->(\$returned);
    task6a_origin_refuse() unless $open_ok&&!length($open_error)
        &&defined($returned)&&!ref($returned)&&$returned&&defined($sealed);
    return $sealed;
};
my $staged_record=sub {
    my ($sealed,$path,$identity,$hash,$directory)=@_;
    my ($fh,$fd)=$sealed->('binding');
    my @expected=@$identity;
    my $original_identity=[@expected];
    my $record={path=>$path,identity=>$original_identity,fh=>$fh};
    $record->{sha256}=$hash unless $directory;
    my $check=sub {
        my ($cell)=@_;
        my $now=$staged_container->($cell,'B::HV');
        $staged_container->(\$record,'B::HV');
        task6a_origin_refuse() unless $now==$record;
        $staged_keys->($now,$directory?'fh,identity,path':'fh,identity,path,sha256');
        my $actual_path=$staged_scalar->(\($now->{path}));
        task6a_origin_refuse() unless $actual_path eq $path;
        unless($directory) {
            my $actual_hash=$staged_scalar->(\($now->{sha256}));
            task6a_origin_refuse() unless $actual_hash eq $hash;
        }
        $staged_native_fh->(\($now->{fh}),0);
        $staged_native_fh->(\$fh,0);
        task6a_origin_refuse() unless $now->{fh}==$fh
            &&defined(CORE::fileno($fh))&&CORE::fileno($fh)==$fd;
        my $tuple=$staged_container->(\($now->{identity}),'B::AV');
        $staged_container->(\$original_identity,'B::AV');
        task6a_origin_refuse() unless $tuple==$original_identity&&@$tuple==13;
        for my $index(0..12) {
            my $tuple_cell=\($tuple->[$index]);
            my $sv=$staged_plain_cell->($tuple_cell);
            task6a_origin_refuse() unless ($sv->FLAGS & B::SVf_IOK())
                &&!($sv->FLAGS & (B::SVf_ROK()|B::SVf_POK()));
            my $value=$staged_scalar->($tuple_cell);
            task6a_origin_refuse() unless $value==$expected[$index];
        }
        # Validators get a fresh immutable-expectation view, not mutable
        # admission/record fields that a later port callback could change.
        my $view={path=>$path,identity=>[@expected],fh=>$fh};
        $view->{sha256}=$hash unless $directory;
        return $view;
    };
    push @staged_record_checks,$check;
    return $record;
};
my $staged_require_live=sub {
    task6a_origin_refuse() if defined($parent_constructor_deadline)&&defined($parent_constructor_material_allowed)&&!$parent_constructor_material_allowed->()
        &&task6a_origin_now()>=$parent_material_deadline->();
    task6a_origin_refuse() if $staged_invalid||$staged_uncertain||$staged_disposal_started;
    $staged_vector->(\@staged_directories);$staged_vector->(\@staged_files);
    $staged_vector->(\@staged_originals);$staged_vector->(\@staged_record_checks);
    task6a_origin_refuse() unless task6a_origin_helpers_settled();
    $staged_check_admission->();
    task6a_origin_refuse() unless @staged_directories==6&&@staged_files==6
        &&@staged_originals==12&&@staged_record_checks==12;
    for my $index(0..5) {
        $staged_record_checks[$index]->(\($staged_directories[$index]));
        $staged_record_checks[$index+6]->(\($staged_files[$index]));
    }
    task6a_origin_refuse() if defined($parent_constructor_deadline)&&defined($parent_constructor_material_allowed)&&!$parent_constructor_material_allowed->()
        &&task6a_origin_now()>=$parent_material_deadline->();
};
my $staged_epoch=sub {
    $staged_require_live->();
    for my $index(0..5) {
        $staged_require_live->();
        my $view=$staged_record_checks[$index]->(\($staged_directories[$index]));
        task6a_origin_check_directory($view);
    }
    for my $index(0..5) {
        $staged_require_live->();
        my $view=$staged_record_checks[$index+6]->(\($staged_files[$index]));
        task6a_origin_check_held_file($view);
        $staged_require_live->();
        $view=$staged_record_checks[$index+6]->(\($staged_files[$index]));
        task6a_origin_acl_free($view->{path});
        $staged_require_live->();
        $view=$staged_record_checks[$index+6]->(\($staged_files[$index]));
        task6a_origin_check_held_file($view);
    }
    for my $index(0..5) {
        $staged_require_live->();
        my $view=$staged_record_checks[$index]->(\($staged_directories[$index]));
        task6a_origin_check_directory($view);
    }
    $staged_require_live->();
};
my $staged_diagnostic=sub {
    return {scope=>'staged-source-vendor-custody-diagnostic-only',
        productionAuthority=>JSON::PP::false,fileCount=>6,directoryCount=>6};
};
sub task6a_origin_hold_staged_custody {
    # Refuse before the hold catch can burn a live constructor's material owner.
    task6a_origin_refuse() if defined($parent_constructor_material_allowed)&&!$parent_constructor_material_allowed->();
    my $ok=eval {
        task6a_origin_refuse() unless @_==0&&$staged_phase eq 'absent'
            &&!$staged_invalid&&!$staged_disposal_started;
        $staged_phase='capturing';
        # Boundary guard1: hold entry; do not renew bootstrap_deadline.
        task6a_origin_refuse() unless task6a_origin_now()<$bootstrap_deadline;
        task6a_origin_refuse() unless task6a_origin_helpers_settled();
        $staged_freeze_admission->();$staged_freeze_foreign->();
        my $root=$staged_snapshot->{root};
        my @paths=('/','/private','/private/tmp',$root,$root.'/source',$root.'/vendor');
        for my $index(0..5) {
            $staged_guard_partial->();
            my $path=$paths[$index];my @before=lstat($path);
            task6a_origin_refuse() unless @before==13&&Fcntl::S_ISDIR($before[2])
                &&$before[4]==0&&$before[5]==0;
            my $mode=$before[2]&07777;
            task6a_origin_refuse() unless $index==2?$mode==01777
                :$index==3?$mode==0711:$index>=4?$mode==0555
                :($mode==0755||$mode==0711||$mode==0700||$mode==0555);
            if($index==3) {
                for my $field(0,1,4,5) {
                    task6a_origin_refuse() unless $before[$field]==$staged_snapshot->{creation}[$field];
                }
            }
            my $sealed=$staged_acquire->($path,
                Fcntl::O_RDONLY()|Fcntl::O_NOFOLLOW()|Fcntl::O_DIRECTORY());
            my ($fh)=$sealed->('binding');$staged_configure->($fh,1);
            $staged_guard_partial->();
            my $record=$staged_record->($sealed,$path,\@before,undef,1);
            $staged_guard_partial->();
            push @staged_directories,$record;
            $staged_guard_partial->();
            my $view=$staged_record_checks[$index]->(\($staged_directories[$index]));
            task6a_origin_check_directory($view);
            $staged_guard_partial->();
        }
        for my $expected(@{$staged_snapshot->{files}}) {
            $staged_guard_partial->();
            my $path=$expected->{path};my @before=lstat($path);
            task6a_origin_refuse() unless @before==13&&Fcntl::S_ISREG($before[2])
                &&($before[2]&07777)==$expected->{mode}&&$before[3]==1
                &&$before[4]==0&&$before[5]==0&&$before[7]==$expected->{size};
            my $sealed=$staged_acquire->($path,
                Fcntl::O_RDONLY()|Fcntl::O_NOFOLLOW()|Fcntl::O_NONBLOCK());
            my ($fh)=$sealed->('binding');$staged_configure->($fh,0);
            $staged_guard_partial->();
            my $record=$staged_record->($sealed,$path,\@before,$expected->{sha256},0);
            $staged_guard_partial->();
            push @staged_files,$record;
            $staged_guard_partial->();
            my $index=$#staged_files;
            my $view=$staged_record_checks[$index+6]->(\($staged_files[$index]));
            task6a_origin_check_held_file($view);
            $staged_guard_partial->();
        }
        $staged_epoch->();
        # Boundary guard2: hold completion, after actual helper settlement.
        task6a_origin_refuse() unless task6a_origin_now()<$bootstrap_deadline;
        $staged_require_live->();$staged_phase='active';1;
    };my $primary=$@;
    $staged_burn->() unless $ok&&!length($primary);
    return $staged_diagnostic->();
}
sub task6a_origin_recheck_staged_custody {
    # Refuse before the public burn catch while a constructor material lease lives.
    task6a_origin_refuse() if defined($parent_constructor_material_allowed)&&!$parent_constructor_material_allowed->();
    my $ok=eval {
        task6a_origin_refuse() unless @_==0&&$staged_phase eq 'active';
        $staged_require_live->();
        # Boundary guard3: recheck entry.
        task6a_origin_refuse() unless task6a_origin_now()<$bootstrap_deadline;
        $staged_epoch->();
        # Boundary guard4: recheck completion.
        task6a_origin_refuse() unless task6a_origin_now()<$bootstrap_deadline;
        $staged_require_live->();1;
    };my $primary=$@;
    $staged_burn->() unless $ok&&!length($primary);
    return $staged_diagnostic->();
}
sub task6a_origin_release_staged_custody {
    # A live/unknown constructor holds a non-disposing lease on these originals.
    task6a_origin_refuse() if defined($parent_constructor_material_allowed)&&!$parent_constructor_material_allowed->();
    # No validity/admission/helper/deadline operation in release.
    unless(@_==0&&$staged_phase eq 'active'&&!$staged_invalid
        &&!$staged_uncertain&&!$staged_disposal_started) {$staged_burn->();}
    $staged_phase='released';
    my $ok=eval {$staged_dispose->()};my $primary=$@;
    $staged_burn->() unless $ok&&!length($primary)&&@staged_originals==12
        &&!grep {!$_->('closed')} @staged_originals;
    my $diagnostic=$staged_diagnostic->();$diagnostic->{handlesClosed}=12;
    return $diagnostic;
}

sub task6a_origin_helpers_settled {
    task6a_origin_refuse() unless @_==0;
    return JSON::PP::false if $helper_lifecycle_burned;
    for my $record(@helper_ledger) {return JSON::PP::false unless $record->{settled};}
    return JSON::PP::true;
}

# Private producer prerequisite only. No caller path or admission initializer;
# both cold entry guards stay closed. Its originals never enter staged custody.
my ($creator_uid,$creator_gid)=(0,0);
my $creator_phase='absent';
my $producer_phase='absent';
my ($producer_creator_claimed,$producer_staged_started)=(0,0);
my $creator_vendor_count=0;
my ($creator_root_mode,$creator_vendor_mode)=(0700,0700);
my ($creator_root_directory,$creator_vendor_directory);
my ($creator_entry_readback,$creator_entry_commitment);
my ($creator_invalid,$creator_uncertain,$creator_disposal_started)=(0,0,0);
my ($creator_root,$creator_creation);
my $creator_source_count=0;
my $creator_source_mode=0700;
my (@creator_pending,@creator_originals,@creator_directory_checks,@creator_file_checks);
my $creator_source_directory;
my ($creator_archive_readback,$creator_archive_commitment,$creator_archive_original);
my $creator_archive_phase='absent';
my ($creator_native_readback,$creator_native_commitment,$creator_native_original);
my ($creator_map_readback,$creator_map_commitment,$creator_map_original);
my $creator_policy_phase='absent';
my $creator_process_owner=sub {
    task6a_origin_refuse() unless $<==$creator_uid&&$>==$creator_uid
        &&$( =~ /\A$creator_gid(?: |\z)/&&$) =~ /\A$creator_gid(?: |\z)/;
};
my $creator_live=sub {
    task6a_origin_refuse() if $creator_invalid||$creator_uncertain||$creator_disposal_started;
    $creator_process_owner->();
    task6a_origin_refuse() unless $parent_phase eq 'absent'&&!@parent_originals
        &&!@file_ledger&&!@directory_ledger&&!@physical_owned_handles
        &&$physical_state eq 'new'&&$staged_phase eq 'absent'
        &&!@staged_originals&&!@staged_pending&&!defined($staged_admission);
    task6a_origin_refuse() unless task6a_origin_helpers_settled()
        &&task6a_origin_now()<$bootstrap_deadline;
};
my $creator_epoch=sub {
    $creator_live->();
    for my $check(@creator_directory_checks) {$check->();}
    for my $check(@creator_file_checks) {$check->();}
    $creator_live->();
};
my $creator_seal_original=sub {
    my ($cell)=@_;my ($fh,$fd,$present,$alias);
    my $ok=eval {
        $present=$staged_native_fh->($cell,1);
        if($present) {
            $fh=$$cell;$fd=CORE::fileno($fh);
            task6a_origin_refuse() unless defined($fd)&&$fd>=3;
            for my $old(@creator_originals) {
                my ($original,$original_fd,$attempted,$closed)=$old->('binding');
                next if $closed;
                $staged_native_fh->(\$original,0);
                my $live=CORE::fileno($original);
                if($fh==$original||(defined($live)&&$live==$fd)) {
                    $alias=1;task6a_origin_refuse();
                }
                task6a_origin_refuse() unless defined($live)&&$live==$original_fd;
            }
        }
        1;
    };my $error=$@;
    unless($ok&&!length($error)) {$creator_uncertain=1 unless $alias;task6a_origin_refuse();}
    return undef unless $present;
    my ($attempted,$closed)=(0,0);
    my $original_close=sub {CORE::close($fh)};
    my $sealed=sub {
        my ($op)=@_;
        return ($fh,$fd,$attempted,$closed) if $op eq 'binding';
        return $closed if $op eq 'closed';
        task6a_origin_refuse() unless $op eq 'dispose';
        return $closed if $attempted;
        $attempted=1;
        my $safe=eval {$staged_native_fh->(\$fh,0);
            task6a_origin_refuse() unless defined(CORE::fileno($fh))&&CORE::fileno($fh)==$fd;1;};
        my $safety_error=$@;return 0 unless $safe&&!length($safety_error);
        my $result=eval {$original_close->()};my $close_error=$@;
        my $end;my $inspected=eval {$staged_native_fh->(\$fh,0);$end=CORE::fileno($fh);1;};
        my $inspection_error=$@;
        $closed=1 if $result&&!length($close_error)&&$inspected
            &&!length($inspection_error)&&!defined($end);
        return $closed;
    };
    push @creator_originals,$sealed;
    return $sealed;
};
my $creator_dispose=sub {
    return 0 if $creator_disposal_started;
    $creator_disposal_started=1;my $all=1;
    for my $sealed(reverse @creator_originals) {
        next if $sealed->('closed');
        my $ok=eval {$sealed->('dispose')};my $error=$@;
        $all=0 unless $ok&&!length($error);
    }
    $creator_uncertain=1 unless $all;
    return $all&&!$creator_uncertain;
};
my $creator_burn=sub {
    $creator_invalid=1;$creator_phase='burned';
    unless($creator_disposal_started) {
        my $ok=eval {$creator_dispose->()};my $error=$@;
        $creator_uncertain=1 unless $ok&&!length($error);
    }
    task6a_origin_refuse();
};
my $creator_close=sub {
    my ($sealed)=@_;
    my $ok=eval {$sealed->('dispose')};my $error=$@;
    unless($ok&&!length($error)&&$sealed->('closed')) {
        $creator_uncertain=1;task6a_origin_refuse();
    }
};
my $creator_open=sub {
    my ($path,$flags,$mode)=@_;$creator_epoch->();
    my $pending;push @creator_pending,\$pending;
    my $returned;my $ok=eval {$returned=CORE::sysopen($pending,$path,$flags,$mode);1;};
    my $error=$@;
    # Retain/classify exposed output before inspecting return, exception, clock,
    # flags or metadata. Unknown pending cells stay retained and burn forever.
    my $sealed=$creator_seal_original->(\$pending);
    $staged_plain_cell->(\$returned);
    task6a_origin_refuse() unless $ok&&!length($error)&&defined($returned)
        &&!ref($returned)&&$returned&&defined($sealed);
    $creator_epoch->();my ($fh)=$sealed->('binding');
    binmode($fh) or task6a_origin_refuse();$creator_epoch->();
    my $set=fcntl($fh,Fcntl::F_SETFD(),Fcntl::FD_CLOEXEC());
    task6a_origin_refuse() unless defined($set)&&$set;$creator_epoch->();
    my $actual=fcntl($fh,Fcntl::F_GETFL(),0);my $descriptor=fcntl($fh,Fcntl::F_GETFD(),0);
    task6a_origin_refuse() unless defined($actual)&&defined($descriptor)
        &&($actual&Fcntl::O_ACCMODE())==($flags&Fcntl::O_ACCMODE())
        &&(!($flags&Fcntl::O_NONBLOCK())||($actual&Fcntl::O_NONBLOCK()))
        &&$descriptor==Fcntl::FD_CLOEXEC();$creator_epoch->();
    return $sealed;
};
my $creator_same_object=sub {
    my ($before,$now)=@_;
    task6a_origin_refuse() unless @$before==13&&@$now==13;
    for my $field(0,1,4,5) {task6a_origin_refuse() unless $before->[$field]==$now->[$field];}
};
my $creator_hold_directory=sub {
    my ($path,$mode,$owned,$source)=@_;$creator_epoch->();
    my @before=CORE::lstat($path);
    task6a_origin_refuse() unless @before==13&&Fcntl::S_ISDIR($before[2])
        &&($before[2]&07777)==$mode&&$before[4]==($owned?$creator_uid:0)
        &&$before[5]==($owned?$creator_gid:0);
    $creator_epoch->();
    my $sealed=$creator_open->($path,Fcntl::O_RDONLY()|Fcntl::O_NOFOLLOW()|Fcntl::O_DIRECTORY(),0);
    my ($fh,$fd)=$sealed->('binding');my @identity=@before;
    my $check=sub {
        $staged_native_fh->(\$fh,0);
        task6a_origin_refuse() unless defined(CORE::fileno($fh))&&CORE::fileno($fh)==$fd;
        my @held=CORE::stat($fh);my @named=CORE::lstat($path);
        $creator_same_object->(\@identity,\@held);$creator_same_object->(\@identity,\@named);
        for my $now(\@held,\@named) {
            task6a_origin_refuse() unless Fcntl::S_ISDIR($now->[2])
                &&($now->[2]&07777)==($source==1?$creator_source_mode:$source==2?$creator_vendor_mode
                    :$owned?$creator_root_mode:$mode);
        }
    };
    push @creator_directory_checks,$check;$creator_epoch->();
    $creator_creation=[@before] if $owned&&$source==0;
    $creator_root_directory=$sealed if $owned&&$source==0;
    $creator_source_directory=$sealed if $source==1;
    $creator_vendor_directory=$sealed if $source==2;
    return $sealed;
};
my $creator_read=sub {
    my ($fh,$length,$single)=@_;my $bytes='';
    while(length($bytes)<$length) {
        $creator_epoch->();my $request=$length-length($bytes);
        $request=65536 if !$single&&$request>65536;
        my ($count,$errno);my $buffer='';my $ok=eval {$!=0;
            $count=CORE::sysread($fh,$buffer,$request);$errno=0+$!;1;};my $error=$@;
        $staged_plain_cell->(\$count);$staged_plain_cell->(\$buffer);
        task6a_origin_refuse() unless $ok&&!length($error)&&defined($count)&&!ref($count)
            &&$count>0&&$count<=$request&&$count==int($count)&&$errno==0
            &&!utf8::is_utf8($buffer)&&length($buffer)==$count&&(!$single||$count==$length);
        $bytes.=$buffer;$creator_epoch->();
    }
    unless($single) {
        $creator_epoch->();my ($count,$errno);my $buffer='';
        my $ok=eval {$!=0;$count=CORE::sysread($fh,$buffer,1);$errno=0+$!;1;};my $error=$@;
        task6a_origin_refuse() unless $ok&&!length($error)&&defined($count)
            &&!ref($count)&&$count==0&&$errno==0&&$buffer eq '';$creator_epoch->();
    }
    return $bytes;
};
my $creator_diagnostic=sub {
    return {scope=>'source-creator-write-custody-diagnostic-only',
        productionAuthority=>JSON::PP::false,sourceCount=>$creator_source_count};
};
sub task6a_origin_create_source_root {
    my $ok=eval {
        task6a_origin_refuse() unless @_==0&&$creator_phase eq 'absent';
        $creator_phase='creating';$creator_epoch->();
        $creator_hold_directory->('/',0755,0,0);
        $creator_hold_directory->('/private',0755,0,0);
        $creator_hold_directory->('/private/tmp',01777,0,0);
        my @before=CORE::lstat('/dev/urandom');
        task6a_origin_refuse() unless @before==13&&Fcntl::S_ISCHR($before[2])
            &&$before[3]==1&&$before[4]==0&&$before[5]==0;$creator_epoch->();
        my $entropy=$creator_open->('/dev/urandom',
            Fcntl::O_RDONLY()|Fcntl::O_NOFOLLOW()|Fcntl::O_NONBLOCK(),0);
        my ($fh)=$entropy->('binding');
        $creator_same_object->(\@before,[CORE::stat($fh)]);
        my $nonce=$creator_read->($fh,32,1);
        $creator_same_object->(\@before,[CORE::stat($fh)]);
        $creator_same_object->(\@before,[CORE::lstat('/dev/urandom')]);
        $creator_close->($entropy);$creator_epoch->();
        $creator_root='/private/tmp/task6a-source-v2-'.unpack('H*',$nonce);
        for my $path($creator_root,$creator_root.'/source') {
            $creator_epoch->();my $result;my $made=eval {$result=CORE::mkdir($path,0700);1;};
            my $error=$@;
            task6a_origin_refuse() unless $made&&!length($error)&&$result;
            $creator_epoch->();$creator_hold_directory->($path,0700,1,$path ne $creator_root);
        }
        $creator_epoch->();$creator_phase='writing';1;
    };my $error=$@;$creator_burn->() unless $ok&&!length($error);
    return $creator_diagnostic->();
}
my $creator_write_leaf=sub {
    my ($path,$bytes,$mode)=@_;$creator_epoch->();
    my $sealed=$creator_open->($path,Fcntl::O_RDWR()|Fcntl::O_CREAT()
        |Fcntl::O_EXCL()|Fcntl::O_NOFOLLOW()|Fcntl::O_NONBLOCK(),0600);
    my ($fh,$fd)=$sealed->('binding');my @identity=CORE::stat($fh);
    my $check=sub {
        my ($mode,$size,$held)=@_;my @named=CORE::lstat($path);
        $creator_same_object->(\@identity,\@named);
        my @tuples=(\@named);
        if($held) {
            $staged_native_fh->(\$fh,0);
            task6a_origin_refuse() unless defined(CORE::fileno($fh))&&CORE::fileno($fh)==$fd;
            my @now=CORE::stat($fh);$creator_same_object->(\@identity,\@now);push @tuples,\@now;
            my $flags=fcntl($fh,Fcntl::F_GETFL(),0);my $descriptor=fcntl($fh,Fcntl::F_GETFD(),0);
            task6a_origin_refuse() unless defined($flags)&&($flags&Fcntl::O_ACCMODE())==Fcntl::O_RDWR()
                &&($flags&Fcntl::O_NONBLOCK())&&defined($descriptor)&&$descriptor==Fcntl::FD_CLOEXEC();
        }
        for my $now(@tuples) {
            task6a_origin_refuse() unless Fcntl::S_ISREG($now->[2])&&($now->[2]&07777)==$mode
                &&$now->[3]==1&&$now->[4]==$creator_uid&&$now->[5]==$creator_gid&&$now->[7]==$size;
        }
    };
    $check->(0600,0,1);$creator_epoch->();my ($count,$errno);
    my $written=eval {$!=0;$count=CORE::syswrite($fh,$bytes,length($bytes));$errno=0+$!;1;};
    my $write_error=$@;$staged_plain_cell->(\$count);
    task6a_origin_refuse() unless $written&&!length($write_error)&&defined($count)
        &&!ref($count)&&$count==length($bytes)&&$errno==0;
    $creator_epoch->();$check->(0600,length($bytes),1);
    my $seek=CORE::sysseek($fh,0,0);task6a_origin_refuse() unless defined($seek)&&$seek==0;
    $creator_epoch->();my $observed=$creator_read->($fh,length($bytes),0);
    task6a_origin_refuse() unless $observed eq $bytes
        &&Digest::SHA::sha256_hex($observed) eq Digest::SHA::sha256_hex($bytes);
    $check->(0600,length($bytes),1);$creator_epoch->();
    my $changed=CORE::chmod($mode,$fh);task6a_origin_refuse() unless $changed==1;
    $creator_epoch->();$check->($mode,length($bytes),1);
    $creator_close->($sealed);
    push @creator_file_checks,sub {$check->($mode,length($bytes),0)};
    $creator_epoch->();
    return $observed;
};
sub task6a_origin_write_source_member {
    my $ok=eval {
        task6a_origin_refuse() unless @_==2&&$creator_phase eq 'writing'&&$creator_source_count<4;
        $creator_epoch->();
        my $role=$staged_scalar->(\$_[0]);my $bytes=$staged_bytes->(\$_[1],2097152);
        my $policy=$staged_policy[$creator_source_count];
        task6a_origin_refuse() unless $role eq $policy->[0]
            &&Digest::SHA::sha1_hex('blob '.length($bytes)."\0".$bytes) eq $policy->[2];
        my $path=$creator_root.'/'.$policy->[1];
        my $observed=$creator_write_leaf->($path,$bytes,$policy->[3]);
        if($creator_source_count==0) {
            $creator_archive_readback=''.$observed;
            $creator_archive_commitment=Digest::SHA::sha256_hex($observed);
        }
        if($creator_source_count==1) {
            $creator_native_readback=''.$observed;
            $creator_native_commitment=Digest::SHA::sha256_hex($observed);
        }
        if($creator_source_count==2) {
            $creator_map_readback=''.$observed;
            $creator_map_commitment=Digest::SHA::sha256_hex($observed);
        }
        if($creator_source_count==3) {
            $creator_entry_readback=''.$observed;
            $creator_entry_commitment=Digest::SHA::sha256_hex($observed);
        }
        ++$creator_source_count;1;
    };my $error=$@;$creator_burn->() unless $ok&&!length($error);
    return $creator_diagnostic->();
}
sub task6a_origin_finish_source_writes {
    my $ok=eval {
        task6a_origin_refuse() unless @_==0&&$creator_phase eq 'writing'
            &&$creator_source_count==4&&@creator_file_checks==4;
        $creator_epoch->();my ($fh)=$creator_source_directory->('binding');
        my $changed=CORE::chmod(0555,$fh);task6a_origin_refuse() unless $changed==1;
        $creator_source_mode=0555;$creator_epoch->();$creator_phase='written';1;
    };my $error=$@;$creator_burn->() unless $ok&&!length($error);
    return $creator_diagnostic->();
}
my $creator_namespace_exists=sub {
    my ($parts)=@_;my $table=\%main::;
    for my $part(@$parts) {
        $creator_epoch->();$staged_container->(\$table,'B::HV');
        my $key=$part.'::';return 0 unless exists($table->{$key});
        my $sv=$staged_plain_cell->(\($table->{$key}));
        task6a_origin_refuse() unless ref($sv) eq 'B::GV';
        my $magic=$sv->MAGIC;task6a_origin_refuse() if defined($magic);
        my $glob=$table->{$key};
        {no strict 'refs';$table=*{$glob}{HASH};}
        task6a_origin_refuse() unless defined($table);
        $staged_container->(\$table,'B::HV');$creator_epoch->();
    }
    return 1;
};
sub task6a_origin_initialize_created_archive_helper {
    my $ok=eval {
        task6a_origin_refuse() unless @_==0&&$creator_phase eq 'written'
            &&$creator_source_count==4&&@creator_originals==10
            &&$creator_archive_phase eq 'absent';
        $creator_archive_phase='initializing';$creator_epoch->();
        my $bytes=$staged_bytes->(\$creator_archive_readback,2097152);
        my $commitment=$staged_scalar->(\$creator_archive_commitment);
        task6a_origin_refuse() unless Digest::SHA::sha1_hex('blob '.length($bytes)."\0".$bytes)
            eq $staged_policy[0][2]&&$commitment =~ /\A[a-f0-9]{64}\z/
            &&Digest::SHA::sha256_hex($bytes) eq $commitment;
        $creator_epoch->();
        task6a_origin_refuse() if $creator_namespace_exists->(['Task6aOriginArchiveV2']);
        $creator_epoch->();
        task6a_origin_refuse() if $creator_namespace_exists->(['IO','Uncompress','Gunzip']);
        $creator_epoch->();my $cache=\%INC;$staged_container->(\$cache,'B::HV');
        task6a_origin_refuse() if exists($INC{'IO/Uncompress/Gunzip.pm'});
        $creator_epoch->();
        my $result=eval $bytes;my $load_error=$@;
        $staged_plain_cell->(\$result);
        task6a_origin_refuse() unless !length($load_error)&&defined($result)&&!ref($result)&&$result eq '1';
        $creator_epoch->();
        my $original=UNIVERSAL::can('Task6aOriginArchiveV2','extract_node_v2');
        my $sv=$staged_plain_cell->(\$original);
        task6a_origin_refuse() unless ref($sv) eq 'B::IV'&&($sv->FLAGS&B::SVf_ROK());
        my $cv=$sv->RV;task6a_origin_refuse() unless ref($cv) eq 'B::CV';
        task6a_origin_refuse() if $cv->FLAGS & 0x00f00000;
        my $magic=$cv->MAGIC;task6a_origin_refuse() if defined($magic);
        $creator_epoch->();$creator_archive_original=$original;
        $creator_archive_phase='initialized';$creator_epoch->();1;
    };my $error=$@;
    unless($ok&&!length($error)) {$creator_archive_phase='burned';$creator_burn->();}
    return {scope=>'created-archive-helper-initializer-diagnostic-only',
        productionAuthority=>JSON::PP::false,initialized=>JSON::PP::true};
}
my $creator_policy_cache=sub {
    $creator_epoch->();my $cache=\%INC;$staged_container->(\$cache,'B::HV');
    task6a_origin_refuse() unless exists($INC{'JSON/PP.pm'});
    $creator_epoch->();my $path=$staged_bytes->(\($INC{'JSON/PP.pm'}),4096);
    task6a_origin_refuse() unless $path eq '/System/Library/Perl/5.34/JSON/PP.pm'
        ||$path eq '/System/Library/Perl/5.34/darwin-thread-multi-2level/JSON/PP.pm';
    $creator_epoch->();return $path;
};
my $creator_policy_code=sub {
    my ($cell)=@_;my $sv=$staged_plain_cell->($cell);
    task6a_origin_refuse() unless ref($sv) eq 'B::IV'&&($sv->FLAGS&B::SVf_ROK());
    my $cv=$sv->RV;task6a_origin_refuse() unless ref($cv) eq 'B::CV';
    task6a_origin_refuse() if $cv->FLAGS & 0x00f00000;
    my $magic=$cv->MAGIC;task6a_origin_refuse() if defined($magic);
    return $$cell;
};
sub task6a_origin_initialize_created_policy_helpers {
    my $ok=eval {
        task6a_origin_refuse() unless @_==0&&$creator_phase eq 'written'
            &&$creator_source_count==4&&@creator_originals==10
            &&$creator_archive_phase eq 'initialized'&&$creator_policy_phase eq 'absent';
        $creator_policy_phase='initializing';$creator_epoch->();
        $creator_policy_code->(\$creator_archive_original);$creator_epoch->();
        my $native_bytes=$staged_bytes->(\$creator_native_readback,2097152);
        my $map_bytes=$staged_bytes->(\$creator_map_readback,2097152);
        my $native_commitment=$staged_scalar->(\$creator_native_commitment);
        my $map_commitment=$staged_scalar->(\$creator_map_commitment);
        task6a_origin_refuse() unless Digest::SHA::sha1_hex('blob '.length($native_bytes)."\0".$native_bytes)
            eq $staged_policy[1][2]&&$native_commitment =~ /\A[a-f0-9]{64}\z/
            &&Digest::SHA::sha256_hex($native_bytes) eq $native_commitment;
        task6a_origin_refuse() unless Digest::SHA::sha1_hex('blob '.length($map_bytes)."\0".$map_bytes)
            eq $staged_policy[2][2]&&$map_commitment =~ /\A[a-f0-9]{64}\z/
            &&Digest::SHA::sha256_hex($map_bytes) eq $map_commitment;
        $creator_epoch->();
        task6a_origin_refuse() if $creator_namespace_exists->(['Task6aOriginNativeV2']);
        task6a_origin_refuse() if $creator_namespace_exists->(['Task6aOriginMapV2']);
        my $cache_path=$creator_policy_cache->();$creator_epoch->();
        task6a_origin_refuse() if $creator_namespace_exists->(['Task6aOriginNativeV2']);
        task6a_origin_refuse() unless $creator_policy_cache->() eq $cache_path;
        $creator_epoch->();
        my $native_result=eval $native_bytes;my $native_error=$@;
        $staged_plain_cell->(\$native_result);
        task6a_origin_refuse() unless !length($native_error)&&defined($native_result)
            &&!ref($native_result)&&$native_result eq '1';$creator_epoch->();
        my $native=UNIVERSAL::can('Task6aOriginNativeV2','assert_node_native_v2');
        $creator_native_original=$creator_policy_code->(\$native);$creator_epoch->();
        task6a_origin_refuse() if $creator_namespace_exists->(['Task6aOriginMapV2']);
        task6a_origin_refuse() unless $creator_policy_cache->() eq $cache_path;
        $creator_epoch->();
        my $map_result=eval $map_bytes;my $map_error=$@;
        $staged_plain_cell->(\$map_result);
        task6a_origin_refuse() unless !length($map_error)&&defined($map_result)
            &&!ref($map_result)&&$map_result eq '1';$creator_epoch->();
        my $map=UNIVERSAL::can('Task6aOriginMapV2','parse_map_v2');
        $creator_map_original=$creator_policy_code->(\$map);$creator_epoch->();
        $creator_policy_phase='initialized';$creator_epoch->();1;
    };my $error=$@;
    unless($ok&&!length($error)) {$creator_policy_phase='burned';$creator_burn->();}
    return {scope=>'created-policy-helper-initializer-diagnostic-only',
        productionAuthority=>JSON::PP::false,initialized=>JSON::PP::true,helperCount=>2};
}
sub task6a_origin_release_source_creator {
    unless(@_==0&&$creator_phase eq 'written'&&!$creator_invalid
        &&!$creator_uncertain&&!$creator_disposal_started) {$creator_burn->();}
    my $expected;
    if(!$producer_creator_claimed) {
        $expected=10;
        $creator_burn->() unless $creator_source_count==4&&$creator_vendor_count==0
            &&@creator_directory_checks==5&&@creator_file_checks==4&&$creator_root_mode==0700;
    } elsif($producer_phase eq 'handoff') {
        $expected=13;
        $creator_burn->() unless $creator_source_count==4&&$creator_vendor_count==2
            &&@creator_directory_checks==6&&@creator_file_checks==6
            &&$creator_source_mode==0555&&$creator_vendor_mode==0555&&$creator_root_mode==0711;
    } else {$creator_burn->();}
    $creator_phase='released';my $ok=eval {$creator_dispose->()};my $error=$@;
    $creator_burn->() unless $ok&&!length($error)&&@creator_originals==$expected
        &&!grep {!$_->('closed')} @creator_originals;
    my $out=$creator_diagnostic->();$out->{handlesClosed}=$expected;return $out;
}

# Private fixed producer, never called by either closed production entry.
my $producer_transport_epoch=sub {
    $creator_epoch->() if $producer_phase eq 'observing'||$producer_phase eq 'vendor-fetching';
};
my ($producer_handoff_admission,$producer_handoff_snapshot);
my $producer_handoff_guard=sub {
    my ($assigned,$phase)=@_;
    task6a_origin_refuse() unless $producer_phase eq 'handoff'&&$creator_phase eq 'released'
        &&$creator_disposal_started&&!$creator_invalid&&!$creator_uncertain
        &&@creator_originals==13&&@creator_directory_checks==6&&@creator_file_checks==6
        &&$creator_source_count==4&&$creator_vendor_count==2;
    for my $sealed(@creator_originals) {
        my ($fh,$fd,$attempted,$closed)=$sealed->('binding');
        task6a_origin_refuse() unless $attempted&&$closed;
        $staged_native_fh->(\$fh,0);task6a_origin_refuse() if defined(CORE::fileno($fh));
    }
    $creator_process_owner->();
    task6a_origin_refuse() unless $parent_phase eq 'absent'&&!@parent_originals
        &&!@file_ledger&&!@directory_ledger&&!@physical_owned_handles&&$physical_state eq 'new'
        &&!$staged_invalid&&!$staged_uncertain&&!$staged_disposal_started
        &&$staged_phase eq $phase&&task6a_origin_helpers_settled()
        &&task6a_origin_now()<$bootstrap_deadline;
    unless($assigned) {
        task6a_origin_refuse() if defined($staged_admission)||@staged_originals||@staged_pending;
    } else {
        my $admit=$staged_container->(\$staged_admission,'B::HV');
        $staged_container->(\$producer_handoff_admission,'B::HV');
        task6a_origin_refuse() unless $admit==$producer_handoff_admission;
        if($phase eq 'active') {$staged_check_admission->();}
        else {
            my $now=$staged_read_admission->();
            my $retained=$staged_container->(\$producer_handoff_snapshot,'B::HV');
            my $retained_refs=$staged_container->(\($retained->{refs}),'B::AV');
            my $retained_values=$staged_container->(\($retained->{values}),'B::AV');
            task6a_origin_refuse() unless @{$now->{refs}}==11&&@$retained_refs==11
                &&@{$now->{values}}==34&&@$retained_values==34;
            for my $index(0..10) {
                my $kind=($index==2||$index==3)?'B::AV':'B::HV';
                $staged_container->(\($retained_refs->[$index]),$kind);
                task6a_origin_refuse() unless $now->{refs}[$index]==$retained_refs->[$index];
            }
            for my $index(0..33) {
                $staged_scalar->(\($retained_values->[$index]));
                task6a_origin_refuse() unless $now->{values}[$index] eq $retained_values->[$index];
            }
        }
        task6a_origin_refuse() unless $phase eq 'active'?
            @staged_originals==12:!@staged_originals&&!@staged_pending;
    }
};
sub task6a_origin_produce_source_vendor_staged_custody {
    # A repeated call refuses without changing the existing owned held realm.
    task6a_origin_refuse() unless $producer_phase eq 'absent';
    my $arity=@_;$producer_phase='observing';
    my $ok=eval {
        task6a_origin_refuse() unless $arity==0;
        task6a_origin_refuse() unless $creator_phase eq 'absent';$creator_epoch->();
        $producer_creator_claimed=1;
        my $observed=task6a_origin_observe_sources();$creator_epoch->();
        my $record=$staged_container->(\$observed,'B::HV');
        my $rows=$staged_container->(\($record->{sources}),'B::AV');
        task6a_origin_refuse() unless @$rows==4;
        my @source_bytes;
        for my $index(0..3) {
            $creator_epoch->();my $row=$staged_container->(\($rows->[$index]),'B::HV');
            $staged_keys->($row,'byteLength,bytes,contentSha256,gitBlobSha,path');
            my $policy=$staged_policy[$index];my $name=$policy->[1];$name=~s{\Asource/}{};
            my $path=$staged_bytes->(\($row->{path}),1024);
            my $blob=$staged_bytes->(\($row->{gitBlobSha}),40);
            my $hash=$staged_bytes->(\($row->{contentSha256}),64);
            my $size_sv=$staged_plain_cell->(\($row->{byteLength}));
            task6a_origin_refuse() unless ($size_sv->FLAGS&B::SVf_IOK())
                &&!($size_sv->FLAGS&(B::SVf_ROK()|B::SVf_POK()));
            my $size=$staged_scalar->(\($row->{byteLength}));
            my $bytes=$staged_bytes->(\($row->{bytes}),2097152);
            task6a_origin_refuse() unless $path eq 'scripts/'.$name&&$blob eq $policy->[2]
                &&$size==length($bytes)&&Digest::SHA::sha256_hex($bytes) eq $hash
                &&Digest::SHA::sha1_hex('blob '.length($bytes)."\0".$bytes) eq $policy->[2];
            push @source_bytes,''.$bytes;$creator_epoch->();
        }
        $producer_phase='creating';$creator_epoch->();task6a_origin_create_source_root();
        for my $index(0..3) {
            $creator_epoch->();task6a_origin_write_source_member($staged_policy[$index][0],$source_bytes[$index]);
            $creator_epoch->();
        }
        task6a_origin_finish_source_writes();$creator_epoch->();$producer_phase='initializing';
        task6a_origin_initialize_created_archive_helper();$creator_epoch->();
        task6a_origin_initialize_created_policy_helpers();$creator_epoch->();
        my @completed_cells=(\$creator_archive_readback,\$creator_native_readback,
            \$creator_map_readback,\$creator_entry_readback);
        my @commitment_cells=(\$creator_archive_commitment,\$creator_native_commitment,
            \$creator_map_commitment,\$creator_entry_commitment);
        my @sources;
        for my $index(0..3) {
            $creator_epoch->();my $bytes=$staged_bytes->($completed_cells[$index],2097152);
            my $commitment=$staged_bytes->($commitment_cells[$index],64);
            task6a_origin_refuse() unless Digest::SHA::sha256_hex($bytes) eq $commitment
                &&Digest::SHA::sha1_hex('blob '.length($bytes)."\0".$bytes) eq $staged_policy[$index][2];
            push @sources,{role=>$staged_policy[$index][0],relativePath=>$staged_policy[$index][1],
                gitBlobSha=>$staged_policy[$index][2],bytes=>''.$bytes};$creator_epoch->();
        }
        $producer_phase='vendor-fetching';$creator_epoch->();
        my $transport=task6a_origin_get_vendor();$creator_epoch->();
        my $vendor_result=$staged_container->(\$transport,'B::HV');
        my $filename=$staged_bytes->(\($vendor_result->{filename}),128);
        my $archive=$staged_bytes->(\($vendor_result->{archiveBytes}),134217728);
        task6a_origin_refuse() unless $filename eq 'node-v22.23.1-darwin-arm64.tar.gz'
            &&Digest::SHA::sha256_hex($archive) eq $staged_vendor_pin;
        $archive=''.$archive;$creator_epoch->();$producer_phase='selecting';
        my $decoder=$creator_policy_code->(\$creator_archive_original);$creator_epoch->();
        my $selected=$decoder->($archive);$creator_epoch->();
        my $node=$staged_bytes->(\$selected,134217728);$node=''.$node;
        my $native=$creator_policy_code->(\$creator_native_original);$creator_epoch->();
        $native->($node);$creator_epoch->();my $node_hash=Digest::SHA::sha256_hex($node);
        $producer_phase='writing';$creator_epoch->();my $vendor_path=$creator_root.'/vendor';
        my $made;my $created=eval {$made=CORE::mkdir($vendor_path,0700);1;};my $mkdir_error=$@;
        task6a_origin_refuse() unless $created&&!length($mkdir_error)&&$made;
        $creator_epoch->();$creator_hold_directory->($vendor_path,0700,1,2);$creator_epoch->();
        for my $kind(0..1) {
            $creator_epoch->();my $bytes=$kind?$node:$archive;
            my $expected=$kind?$node_hash:$staged_vendor_pin;
            task6a_origin_refuse() unless Digest::SHA::sha256_hex($bytes) eq $expected;
            my $path=$vendor_path.'/'.($kind?'node':$filename);
            my $readback=$creator_write_leaf->($path,$bytes,$kind?0555:0400);
            task6a_origin_refuse() unless Digest::SHA::sha256_hex($readback) eq $expected;
            ++$creator_vendor_count;$creator_epoch->();
        }
        task6a_origin_refuse() unless $creator_vendor_count==2&&@creator_originals==13
            &&@creator_file_checks==6&&@creator_directory_checks==6;
        $producer_phase='sealing';$creator_epoch->();my ($vendor_fh)=$creator_vendor_directory->('binding');
        my $sealed=CORE::chmod(0555,$vendor_fh);task6a_origin_refuse() unless $sealed==1;
        $creator_vendor_mode=0555;$creator_epoch->();my ($root_fh)=$creator_root_directory->('binding');
        $sealed=CORE::chmod(0711,$root_fh);task6a_origin_refuse() unless $sealed==1;
        $creator_root_mode=0711;$creator_epoch->();
        my $vendor={filename=>$filename,bytes=>$archive};
        my $admission={creator=>{rootPath=>$creator_root,creationIdentity=>[@$creator_creation]},
            sources=>\@sources,vendor=>$vendor,
            selected=>{archiveRef=>$vendor,bytes=>$node,memberName=>'node-v22.23.1-darwin-arm64/bin/node'}};
        $producer_phase='handoff';$creator_epoch->();task6a_origin_release_source_creator();
        # Producer boundary: before-assignment.
        $producer_handoff_guard->(0,'absent');
        $producer_staged_started=1;
        $producer_handoff_admission=$admission;$staged_admission=$admission;
        $producer_handoff_snapshot=$staged_read_admission->();
        # Producer boundary: before-hold.
        $producer_handoff_guard->(1,'absent');task6a_origin_hold_staged_custody();
        # Producer boundary: after-hold.
        $producer_handoff_guard->(1,'active');
        # Producer boundary: before-recheck.
        $producer_handoff_guard->(1,'active');task6a_origin_recheck_staged_custody();
        # Producer boundary: after-recheck.
        $producer_handoff_guard->(1,'active');
        # Producer boundary: before-held.
        $producer_handoff_guard->(1,'active');$producer_phase='held';1;
    };my $error=$@;
    unless($ok&&!length($error)) {
        $producer_phase='burned';
        if($producer_staged_started) {eval {$staged_burn->()};}
        eval {$creator_burn->()} if $producer_creator_claimed;task6a_origin_refuse();
    }
    return {scope=>'source-vendor-producer-custody-diagnostic-only',productionAuthority=>JSON::PP::false,
        sourceCount=>4,vendorCount=>2,creatorHandlesClosed=>13,fileCount=>6,directoryCount=>6};
}

# Private system-Perl occurrence. No caller can supply originals or settlement.
{
    my (@physical_pending,@physical_kept);
    my ($physical_acquisition_unknown,$physical_constructor_lease)=(0,0);
    my $physical_shape=sub {
        my ($cell)=@_;$staged_native_fh->($cell,0);
        my $gv=B::svref_2object($cell)->RV;my $io=$gv->IO;return [$$gv,$$io];
    };
    my $physical_helpers_definite=sub {
        $staged_vector->(\@helper_ledger);
        for my $i(0..$#helper_ledger) {
            my $r=$staged_container->(\($helper_ledger[$i]),'B::HV');
            return 0 unless exists($r->{settled})&&$staged_scalar->(\($r->{settled}));
        }
        return 1;
    };
    $physical_disposal_allowed=sub {
        return 0 unless $physical_helpers_definite->();
        return 1 unless $physical_constructor_lease;
        return defined($parent_constructor_children_settled)&&$parent_constructor_children_settled->();
    };
    # Collect independently: one malformed borrowed cell cannot hide later aliases.
    my $physical_foreign=sub {
        my @cells;my $all=1;
        for my $records(\@parent_originals,\@parent_native_originals) {
            my $vector_ok=eval {$staged_vector->($records);1;};
            unless($vector_ok) {$all=0;next;}
            for my $i(0..$#$records) {
                my $ok=eval {
                    $staged_plain_cell->(\($records->[$i]));
                    if(defined($records->[$i])) {
                        my $r=$staged_container->(\($records->[$i]),'B::HV');
                        task6a_origin_refuse() unless exists($r->{fh});
                        $staged_native_fh->(\($r->{fh}),1);push @cells,\($r->{fh});
                    }
                    1;
                };$all=0 unless $ok;
            }
        }
        my $vector_ok=eval {$staged_vector->(\@staged_originals);1;};
        if($vector_ok) {
            for my $i(0..$#staged_originals) {
                my $ok=eval {
                    my $sv=$staged_plain_cell->(\($staged_originals[$i]));
                    task6a_origin_refuse() unless ref($sv) eq 'B::IV'&&($sv->FLAGS&B::SVf_ROK());
                    my $cv=$sv->RV;task6a_origin_refuse() unless ref($cv) eq 'B::CV';
                    task6a_origin_refuse() if $cv->FLAGS&0x00f00000;
                    my $magic=$cv->MAGIC;task6a_origin_refuse() if defined($magic);
                    my ($fh,$fd,$attempted,$closed)=$staged_originals[$i]->('binding');
                    $closed=$staged_scalar->(\$closed);
                    task6a_origin_refuse() unless $closed eq '0'||$closed eq '1';
                    unless($closed) {$staged_native_fh->(\$fh,0);push @cells,\$fh;}
                    1;
                };$all=0 unless $ok;
            }
        } else {$all=0;}
        if(defined($parent_constructor_physical_bindings)) {
            my ($bindings,$known);my $ok=eval {($bindings,$known)=$parent_constructor_physical_bindings->();1;};
            if($ok) {push @cells,@$bindings;$all=0 unless $known;} else {$all=0;}
        }
        return (\@cells,$all);
    };
    my $physical_aliases=sub {
        my ($kept)=@_;my $all=1;my ($foreign,$known)=([],0);
        my $got=eval {($foreign,$known)=$physical_foreign->();1;};$all=0 unless $got&&$known;
        for my $r(@$kept) {
            next unless defined($r->{shape});
            for my $other(@$kept) {
                next if $r==$other||!defined($other->{shape});
                if($r->{shape}[0]==$other->{shape}[0]||$r->{shape}[1]==$other->{shape}[1]
                    ||(defined($r->{fd})&&defined($other->{fd})&&$r->{fd}==$other->{fd})) {
                    # The first original owns the unique close entitlement.
                    if($r->{ordinal}>$other->{ordinal}) {$r->{alias}=1;$r->{safe}=0;$r->{state}='alias';}
                    $all=0;
                }
            }
            for my $cell(@$foreign) {
                my $ok=eval {
                    if($staged_native_fh->($cell,1)) {
                    my $shape=$physical_shape->($cell);my $fd=CORE::fileno($$cell);
                    if($shape->[0]==$r->{shape}[0]||$shape->[1]==$r->{shape}[1]
                        ||(defined($fd)&&defined($r->{fd})&&$fd==$r->{fd})) {
                        $r->{alias}=1;$r->{safe}=0;$r->{state}='alias';$all=0;
                    }}
                    1;
                };unless($ok&&!length($@)) {$r->{safe}=0;$all=0;}
            }
        }
        unless($got&&$known) {$_->{safe}=0 for @$kept;}
        $physical_acquisition_unknown=1 unless $all;
        return $all;
    };
    $physical_open=sub {
        my ($cell,$path,$flags)=@_;
        task6a_origin_refuse() unless $physical_owns_ledgers&&$physical_internal
            &&@physical_pending<4&&!$physical_acquisition_unknown;
        my $r={cell=>$cell,path=>$path,ordinal=>1+@physical_pending,state=>'not-started',safe=>0,alias=>0,attempted=>0,closed=>0};
        push @physical_pending,$r;
        task6a_origin_refuse() unless task6a_origin_now()<$parent_material_deadline->();
        $r->{state}='pending';
        my ($returned,$errno,$status);my $ok=eval {$returned=sysopen($$cell,$path,$flags);$errno=0+$!;$status=$?;1;};my $error=$@;
        $errno=0+$! unless defined($errno);$status=$? unless defined($status);
        $r->{returned}=$returned;$r->{errno}=$errno;$r->{status}=$status;$r->{error}=$error;
        my $error_plain=eval {
            my $sv=$staged_plain_cell->(\$error);task6a_origin_refuse() if $sv->FLAGS&B::SVf_ROK();1;
        };
        $physical_acquisition_unknown=1 unless $error_plain;
        my $classified=eval {
            if($staged_native_fh->($cell,1)) {
                $r->{fh}=$$cell;$r->{shape}=$physical_shape->($cell);$r->{state}='known';
                push @physical_kept,$r;
                $r->{fd}=CORE::fileno($r->{fh});
                task6a_origin_refuse() unless defined($r->{fd})&&$r->{fd}>=3;
                $r->{safe}=1;
            } else {$r->{state}=($error_plain&&!length($error)&&$ok)?'absent':'unknown';$physical_acquisition_unknown=1 if $r->{state} eq 'unknown';}
            1;
        };$r->{classification_error}=$@;
        unless($classified&&!length($r->{classification_error})) {$r->{state}='unknown';$physical_acquisition_unknown=1;}
        my $aliases=eval {$physical_aliases->(\@physical_kept)};my $alias_error=$@;
        $physical_acquisition_unknown=1 unless $aliases&&!length($alias_error);
        push @physical_owned_handles,$r->{fh} if $r->{state} eq 'known'&&$r->{safe}&&!$r->{alias};
        my $returned_sv=$staged_plain_cell->(\$returned);
        task6a_origin_refuse() if $returned_sv->FLAGS&B::SVf_ROK();
        task6a_origin_refuse() unless $error_plain&&$ok&&!length($error)&&defined($returned)&&$returned
            &&$classified&&!length($r->{classification_error})&&$aliases&&!length($alias_error)&&$r->{state} eq 'known';
        task6a_origin_refuse() unless task6a_origin_now()<$parent_material_deadline->();
        return $returned;
    };
    $physical_can_claim=sub {
        task6a_origin_refuse() unless @_==0&&$physical_state eq 'new'&&!$physical_owns_ledgers&&!$physical_internal
            &&!$physical_cleanup_attempted&&!$physical_cleanup_ok&&!$file_lifecycle_burned&&!$file_lifecycle_released
            &&!$physical_acquisition_unknown&&!$physical_constructor_lease;
        for my $a(\@file_ledger,\@directory_ledger,\@physical_owned_handles,\@physical_pending,\@physical_kept,\@physical_directories) {
            $staged_vector->($a);task6a_origin_refuse() if @$a;
        }
        $staged_plain_cell->(\$physical_file);task6a_origin_refuse() if defined($physical_file);return 1;
    };
    $physical_require_live=sub {
        task6a_origin_refuse() unless @_==0&&$physical_state eq 'active'&&$physical_owns_ledgers&&!$physical_internal
            &&!$file_lifecycle_burned&&!$file_lifecycle_released&&!$physical_cleanup_attempted
            &&!$physical_acquisition_unknown&&@physical_pending==4&&@physical_kept==4
            &&task6a_origin_now()<$parent_material_deadline->();
        for my $a(\@file_ledger,\@directory_ledger,\@physical_directories,\@physical_owned_handles) {$staged_vector->($a);}
        task6a_origin_refuse() unless @physical_owned_handles==4&&@file_ledger==1&&@directory_ledger==3&&@physical_directories==3;
        for my $i(0..3) {
            my $cell=$i<3?\($directory_ledger[$i]):\($file_ledger[0]);
            my $row=$staged_container->($cell,'B::HV');
            task6a_origin_refuse() unless exists($row->{path})&&exists($row->{fh})&&exists($row->{identity});
            task6a_origin_refuse() unless $staged_scalar->(\($row->{path})) eq $physical_kept[$i]{path};
            $staged_native_fh->(\($row->{fh}),0);my $shape=$physical_shape->(\($row->{fh}));
            my $fd=CORE::fileno($row->{fh});my $r=$physical_kept[$i];
            task6a_origin_refuse() unless $shape->[0]==$r->{shape}[0]&&$shape->[1]==$r->{shape}[1]&&defined($fd)&&$fd==$r->{fd};
            my $identity=$staged_container->(\($row->{identity}),'B::AV');
            $staged_vector->($identity);task6a_origin_refuse() unless @$identity==13;
            for my $n(0..12) {$staged_scalar->(\($identity->[$n]));}
        }
        for my $i(0..3) {
            my $r=$physical_kept[$i];$staged_native_fh->(\($physical_owned_handles[$i]),0);
            my $shape=$physical_shape->(\($physical_owned_handles[$i]));my $fd=CORE::fileno($physical_owned_handles[$i]);
            task6a_origin_refuse() unless $r->{safe}&&!$r->{alias}&&!$r->{attempted}&&!$r->{closed}
                &&$shape->[0]==$r->{shape}[0]&&$shape->[1]==$r->{shape}[1]&&defined($fd)&&$fd==$r->{fd};
        }
        task6a_origin_refuse() unless task6a_origin_physical_records()&&$physical_aliases->(\@physical_kept);return 1;
    };
    $physical_cleanup_private=sub {
        return $physical_cleanup_ok if $physical_cleanup_attempted;
        return 0 unless $physical_owns_ledgers;
        return 0 unless $physical_disposal_allowed->();
        $physical_cleanup_attempted=1;$file_lifecycle_released=1;my $all=1;
        for my $r(@physical_kept) {
            next if $r->{alias};
            unless($r->{safe}&&defined($r->{fd})) {$all=0;next;}
            if($r->{attempted}) {$all=0 unless $r->{closed};next;}
            $r->{attempted}=1;my ($returned,$errno,$status);
            my $ok=eval {
                my $shape=$physical_shape->(\($r->{fh}));my $fd=CORE::fileno($r->{fh});
                task6a_origin_refuse() unless $shape->[0]==$r->{shape}[0]&&$shape->[1]==$r->{shape}[1]&&defined($fd)&&$fd==$r->{fd};
                $returned=close($r->{fh});$errno=0+$!;$status=$?;1;
            };my $error=$@;
            $r->{close_return}=$returned;$r->{close_errno}=$errno;$r->{close_status}=$status;$r->{close_error}=$error;
            my $live;my $observed=eval {$physical_shape->(\($r->{fh}));$live=CORE::fileno($r->{fh});1;};my $live_error=$@;
            $r->{live}=$live;$r->{live_error}=$live_error;
            my $admitted=eval {
                my $sv=$staged_plain_cell->(\$returned);task6a_origin_refuse() if $sv->FLAGS&B::SVf_ROK();
                my $error_sv=$staged_plain_cell->(\$error);task6a_origin_refuse() if $error_sv->FLAGS&B::SVf_ROK();1;
            };$r->{close_admission_error}=$@;
            $r->{closed}=1 if $admitted&&$ok&&!length($error)&&defined($returned)&&$returned&&$observed&&!length($live_error)&&!defined($live);
            $all=0 unless $r->{closed};
        }
        $all=0 if $physical_acquisition_unknown||grep {$_->{state} eq 'pending'||$_->{state} eq 'unknown'||$_->{alias}} @physical_pending;
        $physical_cleanup_ok=$all?1:0;$file_lifecycle_burned=1 unless $all;
        return $physical_cleanup_ok;
    };
    $physical_claim=sub {
        $physical_can_claim->();$physical_constructor_lease=1;
        $physical_hold_private->();return 1;
    };
    $physical_release_private=sub {
        task6a_origin_refuse() unless $physical_constructor_lease&&$physical_disposal_allowed->();
        my $valid=eval {$physical_epoch->();1;};my $error=$@;
        $physical_state=$valid&&!length($error)?'released':'burned';$file_lifecycle_burned=1 unless $valid&&!length($error);
        my $closed=task6a_origin_physical_cleanup();
        task6a_origin_refuse() unless $valid&&!length($error)&&$closed;return 1;
    };
    $physical_constructor_dispose=sub {
        # Neutral only for the exact untouched occurrence; no owner/once intent.
        return $physical_can_claim->() unless $physical_constructor_lease;
        $physical_state='burned' unless $physical_state eq 'released';
        $file_lifecycle_burned=1 if $physical_owns_ledgers;
        return task6a_origin_physical_cleanup();
    };
    $physical_cleanup_complete=sub {
        return 1 unless $physical_constructor_lease;
        return $physical_cleanup_attempted&&$physical_cleanup_ok&&!$physical_acquisition_unknown;
    };
}

# Private fixed Source constructor. This occurrence is not startup admission.
{
    my ($constructor_phase,$constructor_claimed,$constructor_busy)=('new',0,0);
    my ($constructor_start,$constructor_deadline,$constructor_cleanup_deadline);
    my ($constructor_actions,$constructor_io,$constructor_cleanup_actions,$constructor_close_actions)=(0,0,0,0);
    my ($constructor_dispose_started,$constructor_complete,$constructor_uncertain)=(0,0,0);
    my ($constructor_node,$constructor_observer,$constructor_published,$constructor_parent_pid);
    my %constructor_acquisition=(node=>'not-started',observer=>'not-started');
    my (@constructor_fhs,@constructor_files,@constructor_pending,@constructor_errors,@constructor_events);
    my ($constructor_capsule_root,$constructor_capsule_path);
    my ($constructor_owner_uid,$constructor_owner_gid)=(0,0);
    my $constructor_payload_sha='5374233d94f8bc8263fce1bd6711a1257cb747b5b67d994f0b3a177c02d3f8fa';
    my $constructor_payload=MIME::Base64::decode_base64('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TAAAAAAAAAAAAAAAAAAAAAMAAAAMABEAUAABAAAAAABoAwABpAMAACwKAAKMDgAAlBIAAtAXAADYGgADHBsAAVgbAACcGwACXCYAAPAqAAFAKwAAXC8AAagvAAAYMgACACAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABCAAQAAAAAAEIACAAAAAAAQgAMAAAAAABCABAAAAAAAEIAFAAAAAAAQgAYAAAAAABCABwAAAAAAEIAIAAAAAAAQgAkAAAAAABCACgAAAAAAEIALAAAAAAAQgAwAAAAAABCADQAAAAAAEIAOAAAAAAAQgA8AAAAAABCAEAAAAAAAEIARAAAAAAAQgBIAAAAAABCAEwAAAAAAEIAUAAAAAAAQgBUAAAAAABCAFgAAAAAAEIAXAAAAAAAQgBgAAAAAABCAGQAAAAAAEIAaAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA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1AAAAAEAAAEAAAAAAAAAAOUAAAABAAABAAAAAAAAAADtAAAAAQAAAQAAAAAAAAAA9QAAAAEAAAEAAAAAAAAAAP0AAAABAAABAAAAAAAAAAALAQAAAQAAAQAAAAAAAAAAEQEAAAEAAAEAAAAAAAAAAB8BAAABAAABAAAAAAAAAAAlAQAAAQAAAQAAAAAAAAAALQEAAAEAAAEAAAAAAAAAADgBAAABAAABAAAAAAAAAABLAQAAAQAAAQAAAAAAAAAAJAAAACUAAAAmAAAAJwAAACkAAAAqAAAAKwAAACwAAAAtAAAALgAAAC8AAAAwAAAAMQAAADIAAAA0AAAANQAAADYAAAA3AAAAOAAAADkAAAA6AAAAOwAAADwAAAA9AAAAPgAAACQAAAAlAAAAJgAAACcAAAAoAAAAKQAAACoAAAArAAAALAAAAC0AAAAuAAAALwAAADAAAAAxAAAAMgAAADMAAAA0AAAANQAAADYAAAA3AAAAOAAAADkAAAA6AAAAOwAAADwAAAA9AAAAPgAAACAAX19taF9leGVjdXRlX2hlYWRlcgBfbWFpbgBfX19lcnJvcgBfX19tZW1jcHlfY2hrAF9fX21lbXNldF9jaGsAX19fc3RhY2tfY2hrX2ZhaWwAX19fc3RhY2tfY2hrX2d1YXJkAF9jbG9ja19nZXR0aW1lAF9jbG9zZQBfZmNudGwAX2dldGVnaWQAX2dldGV1aWQAX2dldGdpZABfZ2V0cHBpZABfZ2V0dWlkAF9tYWNoX3BvcnRfZGVhbGxvY2F0ZQBfbWFjaF9wb3J0X3R5cGUAX21hY2hfdGFza19zZWxmXwBfbWVtY21wAF9tZW1jcHkAX21lbXNldABfcGlkX2Zvcl90YXNrAF9wb2xsAF9wcm9jX3BpZGluZm8AX3JlYWQAX3NpZ25hbABfdGFza19pbmZvAF90YXNrX25hbWVfZm9yX3BpZABfd3JpdGUAX3JlZnVzZQBfaW5pdGlhbGl6ZQBfY29tbWFuZABfYmluZF90YXJnZXQAX3NhbXBsZQBfcmVhZF9ieXRlcwBfbm9ybWFsX3RpbWUAX3ByaW1hcnlfZmFpbHVyZQBfcGh5c2ljYWxfY2xlYW51cABfY2xvY2tfbnMAX3JlcG9ydGluZ19jbG9zZQBfb3NfY2hhcmdlAF9taW5pbXVtAF9nZXQzMgBfZ2V0NjQAX3BhcmVudF9xdWVyeQBfYnNkX3F1ZXJ5AF9uYW1lX3F1ZXJ5AF90eXBlX3F1ZXJ5AF9waWRfcXVlcnkAX2F1ZGl0X3F1ZXJ5AF9jb250cm9sAF9uYXRpdmVfYmVnaW4AX25hdGl2ZV9maW5pc2gAX3BhY2tldF9iZWdpbgBfcHV0MzIAX3B1dDY0AF9wYWNrZXRfcHVibGlzaABfcmVwb3J0aW5nX2Zyb20AX2lvX2NoYXJnZQBfcG9sbF9vd25lZABfZW1pdF9mYWlsdXJlAF9jbGVhbnVwX25hdGl2ZQBfZwAAAAAAAAAAAPreDMAAAAGyAAAAAQAAAAAAAAAU+t4MAgAAAZ4AAgQAAAIAAgAAAH4AAABYAAAAAAAAAAkAAIoQIAIADAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAANVAAAAAAAAAAAXRhc2s2YS1vcmlnaW4tb3duZWQtY2hpbGQtb2JzZXJ2ZXItdjIA+9uziuCt3MhexZieCNEeDQ4h5GvrGJ6AqZCYPDekROKUrwzSCmPrCQbORL238l8DLcAoBseWkN2qsPu05La/Q2gLWAPOuk5sBu5EJsbkU1AQJb8jXpfxVsd84fDxlIMOrBJCV7oCP93fYOp7zRCX8ByO8rhbm15U+kb3o7HG6DZnKzvmmreMcz1Dno68LYAhrzahJqo2Z1cT5VaVaphpxK1/rLJYb8bpZsAE19HRawJPWAX/fLR8eoXavYtIiSynrX+sslhvxulmwATX0dFrAk9YBf98tHx6hdq9i0iJLKetf6yyWG/G6WbABNfR0WsCT1gF/3y0fHqF2r2LSIksp1vi5yIW3uAC8vepmb/bDV98avur+INk+J5Ynnw78AyuAAAAAAAA');
    my $constructor_error=sub {my ($where,$error)=@_;push @constructor_errors,[$where,substr($error//'',0,1024)] if @constructor_errors<64;};
    my $constructor_charge=sub {
        my ($cleanup,$io)=@_;
        task6a_origin_refuse() if $cleanup==2?++$constructor_close_actions>92:$cleanup?++$constructor_cleanup_actions>8192:
            (++$constructor_actions>131072||($io&&++$constructor_io>32768));
    };
    my $constructor_now=sub {
        my ($cleanup)=@_;$constructor_charge->($cleanup,0);my $now=task6a_origin_now();
        task6a_origin_refuse() unless defined($cleanup?$constructor_cleanup_deadline:$constructor_deadline)
            &&$now<($cleanup?$constructor_cleanup_deadline:$constructor_deadline);
        $physical_require_live->() if !$cleanup&&$constructor_claimed;
        return $now;
    };
    my $constructor_shape=sub {
        my ($cell)=@_;$staged_native_fh->($cell,0);my $gv=B::svref_2object($cell)->RV;
        my $io=$gv->IO;return [$$gv,$$io];
    };
    my $constructor_keep=sub {
        my ($cell,$kind,$path)=@_;
        return undef unless $staged_native_fh->($cell,1);
        my $shape=$constructor_shape->($cell);
        for my $old(@constructor_fhs,@constructor_files) {
            task6a_origin_refuse() if $shape->[0]==$old->{shape}[0]||$shape->[1]==$old->{shape}[1];
        }
        # Capture the genuine original and close entitlement before metadata.
        my $record={fh=>$$cell,shape=>$shape,kind=>$kind,path=>$path,close_attempted=>0,closed=>0,transferred=>''};
        push @{ $kind eq 'pipe'?\@constructor_fhs:\@constructor_files },$record;
        return $record;
    };
    my $constructor_close=sub {
        my ($record)=@_;return $record->{closed} if $record->{close_attempted};
        $record->{close_attempted}=1;
        my ($returned,$errno);my $ok=eval {
            my $shape=$constructor_shape->(\($record->{fh}));
            task6a_origin_refuse() unless $shape->[0]==$record->{shape}[0]&&$shape->[1]==$record->{shape}[1];
            if(defined($record->{fd})) {my $live_fd=fileno($record->{fh});task6a_origin_refuse() unless defined($live_fd)&&$live_fd==$record->{fd};}
            $constructor_charge->(2,0);$!=0;$returned=close($record->{fh});$errno=0+$!;1;
        };my $error=$@;
        $record->{close_return}=$returned;$record->{close_errno}=$errno;$record->{close_error}=$error;
        my $live;my $live_ok=eval {$constructor_charge->(2,0);$live=fileno($record->{fh});1;};my $live_error=$@;
        $record->{live}=$live;$record->{live_error}=$live_error;
        $record->{closed}=1 if $ok&&$returned&&!length($error)&&$live_ok&&!defined($live)&&!length($live_error);
        $constructor_error->('close',$error.$live_error) unless $record->{closed};return $record->{closed};
    };
    my $constructor_open=sub {
        my ($path,$flags,$mode)=@_;$constructor_now->(0);my $fh;push @constructor_pending,\$fh;
        my ($opened,$errno);my $ok=eval {$!=0;$opened=CORE::sysopen($fh,$path,$flags,$mode);$errno=0+$!;1;};my $error=$@;
        my $record;my $kept=eval {$record=$constructor_keep->(\$fh,'file',$path);1;};my $keep_error=$@;
        $constructor_uncertain=1 unless $kept&&!length($keep_error);
        if(defined($record)) {$record->{open_return}=$opened;$record->{open_errno}=$errno;$record->{open_error}=$error;}
        push @constructor_events,['open-result',$path,$opened,$errno,$error];
        task6a_origin_refuse() unless $ok&&!length($error)&&$opened&&$kept&&!length($keep_error)&&defined($record);
        $constructor_charge->(0,0);$record->{fd}=fileno($fh);
        task6a_origin_refuse() unless defined($record->{fd})&&$record->{fd}>=3;
        $constructor_charge->(0,0);binmode($fh) or task6a_origin_refuse();
        $constructor_charge->(0,0);fcntl($fh,Fcntl::F_SETFD(),Fcntl::FD_CLOEXEC()) or task6a_origin_refuse();
        $constructor_now->(0);return $record;
    };
    my $constructor_file_check=sub {
        my ($record,$directory,$mode,$hash)=@_;$constructor_now->(0);my $fh=$record->{fh};
        my $shape=$constructor_shape->(\$fh);task6a_origin_refuse() unless $shape->[0]==$record->{shape}[0]&&$shape->[1]==$record->{shape}[1];
        my $live_fd=fileno($fh);task6a_origin_refuse() unless defined($record->{fd})&&defined($live_fd)&&$live_fd==$record->{fd};
        $constructor_charge->(0,0);my @held=stat($fh);$constructor_charge->(0,0);my @named=lstat($record->{path});
        task6a_origin_refuse() unless @held==13&&@named==13&&($directory?Fcntl::S_ISDIR($held[2]):Fcntl::S_ISREG($held[2]))
            &&($held[2]&07777)==$mode
            &&$held[4]==(index($record->{path},'/private/tmp/setfarm-task6a-observer-v2.')==0?$constructor_owner_uid:0)
            &&$held[5]==$constructor_owner_gid&&($directory||$held[3]==1);
        if($directory) {task6a_origin_directory_identity(\@held,\@named);}
        else {task6a_origin_file_identity(\@held,\@named);}
        if(defined($record->{identity})) {
            if($directory) {task6a_origin_directory_identity($record->{identity},\@held);}
            else {task6a_origin_file_identity($record->{identity},\@held);}
        }
        if(defined($hash)) {
            $constructor_charge->(0,1);my $at=sysseek($fh,0,0);task6a_origin_refuse() unless defined($at)&&$at==0;
            my ($bytes,$total)=('',0);
            while(1) {$constructor_now->(0);$constructor_charge->(0,1);my $part='';$!=0;
                my $got=sysread($fh,$part,65536);my $errno=0+$!;$record->{last_read}=[$got,$errno,$part];
                task6a_origin_refuse() unless defined($got)&&$got>=0&&$errno==0&&length($part)==$got;
                last if $got==0;$bytes.=$part;$total+=$got;task6a_origin_refuse() if $total>35784;
            }
            task6a_origin_refuse() unless $total==35784&&Digest::SHA::sha256_hex($bytes) eq $hash;
            task6a_origin_file_identity(\@held,[stat($fh)]);task6a_origin_file_identity(\@held,[lstat($record->{path})]);
        }
        $record->{identity}=[@held];$constructor_now->(0);return 1;
    };
    my $constructor_capsule_check=sub {
        task6a_origin_refuse() unless @constructor_files==7;
        for my $index(0..3) {$constructor_file_check->($constructor_files[$index],1,$index==3?0500:($index==2?01777:0755),undef);}
        $constructor_file_check->($constructor_files[6],0,0555,$constructor_payload_sha);
        # ACL rows are genuine Source captures; never remove ACLs or forge ls.
        for my $record($constructor_files[3],$constructor_files[6]) {
            $constructor_now->(0);task6a_origin_acl_free($record->{path});$constructor_now->(0);
        }
        $constructor_file_check->($constructor_files[3],1,0500,undef);
        $constructor_file_check->($constructor_files[6],0,0555,$constructor_payload_sha);
    };
    my $constructor_capsule=sub {
        task6a_origin_refuse() unless length($constructor_payload)==35784&&Digest::SHA::sha256_hex($constructor_payload) eq $constructor_payload_sha;
        for my $path('/','/private','/private/tmp') {
            my $record=$constructor_open->($path,Fcntl::O_RDONLY()|Fcntl::O_NOFOLLOW()|Fcntl::O_DIRECTORY(),0);
            $constructor_file_check->($record,1,$path eq '/private/tmp'?01777:0755,undef);
        }
        my $entropy=$constructor_open->('/dev/urandom',Fcntl::O_RDONLY()|Fcntl::O_NOFOLLOW()|Fcntl::O_NONBLOCK(),0);
        my @entropy=stat($entropy->{fh});task6a_origin_refuse() unless @entropy==13&&Fcntl::S_ISCHR($entropy[2])&&$entropy[4]==0&&$entropy[5]==0;
        my $bytes='';$constructor_charge->(0,1);$!=0;my $got=sysread($entropy->{fh},$bytes,32);my $errno=0+$!;
        task6a_origin_refuse() unless defined($got)&&$got==32&&length($bytes)==32&&$errno==0;
        $constructor_close->($entropy) or task6a_origin_refuse();
        $constructor_capsule_root='/private/tmp/setfarm-task6a-observer-v2.'.unpack('H*',$bytes);
        $constructor_now->(0);$constructor_charge->(0,0);CORE::mkdir($constructor_capsule_root,0700) or task6a_origin_refuse();
        my $root=$constructor_open->($constructor_capsule_root,Fcntl::O_RDONLY()|Fcntl::O_NOFOLLOW()|Fcntl::O_DIRECTORY(),0);
        # Canonical retained order: ancestry3, capsule root, entropy, writer, reader.
        @constructor_files[3,4]=@constructor_files[4,3];
        $constructor_file_check->($root,1,0700,undef);
        $constructor_capsule_path=$constructor_capsule_root.'/task6a-origin-owned-child-observer-v2';
        my $writer=$constructor_open->($constructor_capsule_path,Fcntl::O_WRONLY()|Fcntl::O_CREAT()|Fcntl::O_EXCL()|Fcntl::O_NOFOLLOW(),0600);
        my $offset=0;while($offset<length($constructor_payload)) {
            $constructor_now->(0);$constructor_charge->(0,1);$!=0;
            my $got=syswrite($writer->{fh},$constructor_payload,length($constructor_payload)-$offset,$offset);my $errno=0+$!;
            push @constructor_events,['capsule-write',$offset,$got,$errno];
            task6a_origin_refuse() unless defined($got)&&$got>0&&$got<=length($constructor_payload)-$offset&&$errno==0;$offset+=$got;
        }
        $constructor_charge->(0,0);CORE::chmod(0555,$writer->{fh})==1 or task6a_origin_refuse();
        $constructor_close->($writer) or task6a_origin_refuse();
        $constructor_charge->(0,0);CORE::chmod(0500,$root->{fh})==1 or task6a_origin_refuse();
        $root->{identity}=undef;
        $constructor_open->($constructor_capsule_path,Fcntl::O_RDONLY()|Fcntl::O_NOFOLLOW(),0);
        $constructor_capsule_check->();
    };
    my $constructor_pipe=sub {
        my ($role)=@_;$constructor_now->(0);my ($read,$write);push @constructor_pending,\$read,\$write;$constructor_charge->(0,1);
        my ($returned,$errno,$status);my $pipe_ok=eval {$returned=pipe($read,$write);$errno=0+$!;$status=$?;1;};my $pipe_error=$@;
        my ($r,$w);my $r_ok=eval {$r=$constructor_keep->(\$read,'pipe',$role.'-r');1;};my $r_error=$@;
        my $w_ok=eval {$w=$constructor_keep->(\$write,'pipe',$role.'-w');1;};my $w_error=$@;
        $constructor_uncertain=1 unless $r_ok&&$w_ok&&!length($r_error.$w_error);
        for my $record($r,$w) {next unless defined($record);$record->{pipe_return}=$returned;$record->{pipe_errno}=$errno;$record->{pipe_status}=$status;$record->{pipe_error}=$pipe_error;}
        task6a_origin_refuse() unless $pipe_ok&&!length($pipe_error)&&$returned&&$r_ok&&$w_ok&&!length($r_error.$w_error)&&defined($r)&&defined($w);
        for my $record($r,$w) {
            $constructor_charge->(0,0);$record->{fd}=fileno($record->{fh});
            $constructor_charge->(0,0);my @tuple=stat($record->{fh});
            task6a_origin_refuse() unless defined($record->{fd})&&$record->{fd}>=3&&@tuple==13&&Fcntl::S_ISFIFO($tuple[2]);
            $record->{identity}=[@tuple];binmode($record->{fh}) or task6a_origin_refuse();
            fcntl($record->{fh},Fcntl::F_SETFD(),Fcntl::FD_CLOEXEC()) or task6a_origin_refuse();
        }
        return [$r,$w];
    };
    $parent_constructor_observe_wait=sub {
        my ($pid,$reaped,$uncertain,$status)=@_;
        for my $record($constructor_node,$constructor_observer) {
            next unless defined($record)&&$record->{pid}==$pid;
            # Retired PID values cannot bind a later helper occurrence. The
            # same record-reference case is this actual constructor poll only.
            next if ($record->{reaped}||$record->{uncertain})&&$reaped!=\($record->{reaped});
            $record->{reaped}=$$reaped;$record->{uncertain}=$$uncertain;
            $record->{status}=$$status if $$reaped;
            if($constructor_published&&$record->{role} eq 'node') {
                $parent_reaped=$record->{reaped};$parent_uncertain=$record->{uncertain};
                $parent_raw_status=$record->{status} if $record->{reaped};
                $parent_known_live=!$record->{reaped}&&!$record->{uncertain};
            }
        }
    };
    my $constructor_settle=sub {
        my ($record)=@_;return 1 unless defined($record);
        return $record->{reaped}&&!$record->{uncertain} if $record->{reaped}||$record->{uncertain};
        my $start=$constructor_now->(1);my ($term,$kill)=(0,0);
        while(!$record->{reaped}&&!$record->{uncertain}) {
            my $now=$constructor_now->(1);$constructor_charge->(1,0);
            task6a_origin_poll($record->{pid},\($record->{reaped}),\($record->{uncertain}),\($record->{status}));
            last if $record->{reaped}||$record->{uncertain};
            my $signal=(!$term&&$now-$start>=2)?'TERM':(!$kill&&$now-$start>=7)?'KILL':undef;
            if(defined($signal)) {$constructor_now->(1);$constructor_charge->(1,0);$term=1 if $signal eq 'TERM';$kill=1 if $signal eq 'KILL';
                my $returned=kill($signal,$record->{pid});push @constructor_events,['shutdown',$record->{role},$signal,$returned,0+$!];
            }
            Time::HiRes::sleep(0.01);
        }
        return $record->{reaped}&&!$record->{uncertain};
    };
    $parent_constructor_owns_node=sub {return $constructor_claimed&&defined($constructor_node)&&defined($parent_original_pid)&&$constructor_node->{pid}==$parent_original_pid;};
    $parent_constructor_shutdown_node=sub {
        task6a_origin_refuse() unless $parent_constructor_owns_node->()&&defined($constructor_observer)&&$constructor_observer->{reaped}&&!$constructor_observer->{uncertain};
        return $constructor_settle->($constructor_node);
    };
    $parent_constructor_children_settled=sub {
        return 1 unless $constructor_claimed;
        for my $role('observer','node') {
            my $state=$constructor_acquisition{$role};
            return 0 if $state eq 'pending'||$state eq 'unknown';
            next if $state eq 'not-started'||$state eq 'absent';
            my $r=$role eq 'observer'?$constructor_observer:$constructor_node;
            return 0 unless $state eq 'enrolled'&&defined($r)&&$r->{reaped}&&!$r->{uncertain};
        }
        return 1;
    };
    $parent_constructor_physical_bindings=sub {
        my @cells;my $all=1;
        for my $records(\@constructor_files,\@constructor_fhs) {
            my $vector_ok=eval {$staged_vector->($records);1;};
            unless($vector_ok) {$all=0;next;}
            for my $i(0..$#$records) {
                my $ok=eval {
                    my $r=$staged_container->(\($records->[$i]),'B::HV');
                    task6a_origin_refuse() unless exists($r->{closed})&&exists($r->{fh});
                    my $closed=$staged_scalar->(\($r->{closed}));
                    task6a_origin_refuse() unless $closed eq '0'||$closed eq '1';
                    $staged_native_fh->(\($r->{fh}),0);
                    push @cells,\($r->{fh}) unless $closed;1;
                };$all=0 unless $ok;
            }
        }
        return (\@cells,$all);
    };
    $parent_constructor_material_allowed=sub {return !$constructor_claimed||$constructor_complete;};
    $parent_constructor_dispose=sub {
        return $constructor_complete if $constructor_dispose_started;
        return 1 unless $constructor_claimed;
        $constructor_dispose_started=1;$constructor_phase='disposing';my $all=1;
        if($constructor_published) {my $ok=eval {$parent_dispose->();1;};$constructor_error->('parent-dispose',$@) unless $ok;}
        # Even a pre-prepare observer original remains the first settlement lease.
        my $observer_ok=eval {task6a_origin_refuse() if $constructor_acquisition{observer} eq 'pending'||$constructor_acquisition{observer} eq 'unknown';$constructor_settle->($constructor_observer)};my $observer_error=$@;
        my $observer_settled=$observer_ok&&!length($observer_error);$constructor_error->('observer-settle',$observer_error) unless $observer_settled;
        for my $record(@constructor_fhs) {
            next if $record->{transferred} ne '';
            my $ok=eval {$constructor_close->($record)};$all=0 unless $ok&&!length($@);
        }
        my $node_settled=0;
        if($observer_settled) {my $ok=eval {task6a_origin_refuse() if $constructor_acquisition{node} eq 'pending'||$constructor_acquisition{node} eq 'unknown';$node_settled=$constructor_settle->($constructor_node);1;};$constructor_error->('node-settle',$@) unless $ok;}
        $all=0 unless $observer_settled&&$node_settled;
        if($constructor_published) {
            $all=0 unless $parent_cleanup_complete&&$parent_native_cleanup_complete->();
        }
        # Material is quarantined while either actual original is unresolved.
        if($observer_settled&&$node_settled&&task6a_origin_helpers_settled()) {
            for my $record(reverse @constructor_files) {my $ok=eval {$constructor_close->($record)};$all=0 unless $ok&&!length($@);}
        }
        my $physical_closed=eval {$physical_constructor_dispose->()};my $physical_error=$@;
        $all=0 unless $physical_closed&&!length($physical_error)&&$physical_cleanup_complete->();
        $all=0 if $constructor_uncertain||!task6a_origin_helpers_settled();$constructor_complete=$all?1:0;$constructor_uncertain=1 unless $all;
        $constructor_phase=$all?'closed':'quarantined';return $constructor_complete;
    };
    $parent_constructor_finish=sub {
        $constructor_now->(0);
        task6a_origin_refuse() unless $parent_phase eq 'settled'&&$constructor_node->{reaped}&&!$constructor_node->{uncertain}
            &&$constructor_node->{status}==0&&$constructor_observer->{reaped}&&!$constructor_observer->{uncertain}
            &&$constructor_observer->{status}==0&&$parent_native_cleanup_complete->();
        $constructor_capsule_check->();$staged_require_live->();
        for my $record(@constructor_fhs) {
            if($record->{transferred} ne '') {task6a_origin_refuse() if defined(fileno($record->{fh}));}
            else {task6a_origin_refuse() unless $record->{closed};}
        }
        $physical_release_private->();
        for my $record(reverse @constructor_files) {$constructor_close->($record) or task6a_origin_refuse();}
        task6a_origin_refuse() unless $physical_cleanup_complete->();
        $constructor_complete=1;$constructor_dispose_started=1;$constructor_phase='closed';return 1;
    };
    $parent_constructor=sub {
        # Preclaim refuses without entering another occurrence's disposal catch.
        task6a_origin_refuse() unless @_==0&&$constructor_phase eq 'new'&&!$constructor_claimed&&!$constructor_busy
            &&$parent_phase eq 'absent'&&!$parent_invalid&&!$parent_authenticated&&!@parent_originals
            &&!defined($parent_original_pid)&&!defined($parent_admission)&&!defined($parent_original_admission)
            &&!@parent_native_originals&&!defined($parent_native_original_pid)&&!defined($parent_native_target_pid)
            &&$parent_native_can_claim->()&&$producer_phase eq 'held'&&$creator_phase eq 'released'
            &&$staged_phase eq 'active'&&task6a_origin_helpers_settled();
        $physical_can_claim->();$staged_require_live->();
        my $start=task6a_origin_now();task6a_origin_refuse() unless $start<$bootstrap_deadline;
        $constructor_start=$start;$constructor_deadline=$start+30;$constructor_cleanup_deadline=$start+45;
        $constructor_deadline=$bootstrap_deadline if $bootstrap_deadline<$constructor_deadline;
        $constructor_cleanup_deadline=$bootstrap_deadline if $bootstrap_deadline<$constructor_cleanup_deadline;
        $parent_constructor_deadline=$constructor_deadline;$parent_constructor_cleanup_deadline=$constructor_cleanup_deadline;
        $constructor_parent_pid=$$;$constructor_claimed=1;$constructor_busy=1;$constructor_phase='preparing';
        my $ok=eval {
            $SIG{CHLD}='DEFAULT';$^F=2;$staged_epoch->();$physical_claim->();
            $constructor_capsule->();$staged_epoch->();
            my $node_view=$staged_record_checks[11]->(\($staged_files[5]));
            my $entry_view=$staged_record_checks[9]->(\($staged_files[3]));
            task6a_origin_refuse() unless $node_view->{path} eq $creator_root.'/vendor/node'
                &&$entry_view->{path} eq $creator_root.'/source/task6a-protected-origin-entry-v2.mjs';
            my @node=map {$constructor_pipe->('node-'.$_)} qw(input stdout stderr setup);
            my @observer=map {$constructor_pipe->('observer-'.$_)} qw(input stdout stderr setup);
            my $node_fd=fileno($node_view->{fh});my $entry_fd=fileno($entry_view->{fh});
            my $capsule_fd=$constructor_files[6]{fd};
            my $fds=task6a_origin_fds();$constructor_now->(0);
            $parent_native_original_start=task6a_origin_now();
            for my $role('node','observer') {
                $constructor_now->(0);$constructor_charge->(0,0);
                my ($pid,$errno,$status);$constructor_acquisition{$role}='pending';
                my $fork_ok=eval {$pid=fork();$errno=0+$!;$status=$?;1;};my $fork_error=$@;
                if(defined($pid)&&$pid>0) {
                    # Seal creation origin BEFORE metadata, diagnostics or close.
                    my $original={pid=>$pid,role=>$role,reaped=>0,uncertain=>0,status=>undef};
                    if($role eq 'node') {$constructor_node=$original;} else {$constructor_observer=$original;}
                    $constructor_acquisition{$role}='enrolled';
                    push @constructor_events,['fork-original',$role,$pid,$errno,$status];
                }
                push @constructor_events,['fork-result',$role,$pid,$errno,$status,$fork_error] if $$==$constructor_parent_pid;
                if(!defined($pid)&&$fork_ok&&!length($fork_error)) {$constructor_acquisition{$role}='absent';}
                elsif(!defined($pid)||$pid<0||($pid==0&&$$==$constructor_parent_pid)) {$constructor_acquisition{$role}='unknown';$constructor_uncertain=1;}
                if($$!=$constructor_parent_pid) {
                    my $pipes=$role eq 'node'?\@node:\@observer;my $error_fh=$pipes->[3][1]{fh};my $error_fd=fileno($error_fh);
                    my $child_ok=eval {
                        task6a_origin_refuse() unless $fork_ok&&!length($fork_error)&&defined($pid)&&$pid==0;
                        my @pairs=([$pipes->[0][0]{fh},$role eq 'node'?0:3],[$pipes->[1][1]{fh},1],[$pipes->[2][1]{fh},2]);
                        my @sources=map {fileno($_->[0])} @pairs;
                        # FD3 is rewritten only after its source was duplicated.
                        for my $i(0..2) {my $got=POSIX::dup2($sources[$i],$pairs[$i][1]);task6a_origin_refuse() unless defined($got)&&$got==$pairs[$i][1];}
                        for my $fd(@$fds) {next if ($fd<=2&&($role eq 'node'||$fd!=0))||$fd==$error_fd||($role eq 'observer'&&($fd==3||$fd==$capsule_fd))
                                ||($role eq 'node'&&($fd==$node_fd||$fd==$entry_fd));
                            my $got=POSIX::close($fd);task6a_origin_refuse() unless defined($got)&&$got==0;}
                        chdir('/') or task6a_origin_refuse();%ENV=(PATH=>'/usr/bin:/bin',LANG=>'C',LC_ALL=>'C');
                        if($role eq 'node') {
                            task6a_origin_file_identity($node_view->{identity},[stat($node_view->{fh})]);
                            task6a_origin_file_identity($node_view->{identity},[lstat($node_view->{path})]);
                            task6a_origin_file_identity($entry_view->{identity},[stat($entry_view->{fh})]);
                            task6a_origin_file_identity($entry_view->{identity},[lstat($entry_view->{path})]);
                            $)='70 70';task6a_origin_refuse() unless POSIX::setgid(70)==0&&POSIX::setuid(70)==0;
                            task6a_origin_refuse() unless $<==70&&$>==70&&$(==70&&join(' ',split(' ',$))) eq '70 70';
                            no warnings 'exec';exec {$node_view->{path}} $node_view->{path},$entry_view->{path};
                        } else {
                            task6a_origin_refuse() unless $<==0&&$>==0&&$(==0&&$) =~ /\A0(?: |\z)/;
                            task6a_origin_file_identity($constructor_files[6]{identity},[stat($constructor_files[6]{fh})]);
                            task6a_origin_file_identity($constructor_files[6]{identity},[lstat($constructor_capsule_path)]);
                            no warnings 'exec';exec {$constructor_capsule_path} $constructor_capsule_path;
                        }
                        task6a_origin_refuse();
                    };
                    syswrite($error_fh,"E\n");POSIX::_exit(126);
                }
                task6a_origin_refuse() unless $fork_ok&&!length($fork_error)&&defined($pid)&&$pid>0;
            }
            for my $pair(@node,@observer) {for my $record(@$pair) {
                my $keep=($record==$node[0][1]||$record==$node[1][0]||$record==$node[2][0]||$record==$node[3][0]
                    ||$record==$observer[0][1]||$record==$observer[1][0]||$record==$observer[2][0]||$record==$observer[3][0]);
                $constructor_close->($record) or task6a_origin_refuse() unless $keep;
            }}
            @parent_originals=map {$_->{transferred}='node';$_} ($node[0][1],$node[1][0],$node[2][0],$node[3][0]);
            @parent_native_originals=map {$_->{transferred}='observer';$_} ($observer[0][1],$observer[1][0],$observer[2][0],$observer[3][0]);
            $parent_original_pid=$constructor_node->{pid};$parent_native_original_pid=$constructor_observer->{pid};
            $parent_native_target_pid=$parent_original_pid;$parent_native_birth_ordinal=1;
            $parent_admission={pid=>$parent_original_pid,map {($_->[0]=>$parent_originals[$_->[1]]{fh})} (['input',0],['stdout',1],['stderr',2],['setup',3])};
            $parent_original_admission=$parent_admission;$constructor_published=1;
            $constructor_now->(0);$parent_native_prepare->();$constructor_now->(0);$constructor_phase='running';$constructor_busy=0;1;
        };my $error=$@;
        unless($ok&&!length($error)) {$constructor_error->('construct',$error);$constructor_busy=0;eval {$parent_constructor_dispose->();1;};task6a_origin_refuse();}
        return 1;
    };
}
# End private fixed Source constructor.


# Fixed backend namespace prerequisite. Independent private occurrence; no
# descriptor/server/identity/genesis publication or ordinary startup admission.
my ($namespace_uid,$namespace_process_gid,$namespace_directory_gid)=(0,0,80);
my @namespace_existing_gids=(0,0,80);
my @namespace_paths=('/','/Library','/Library/Application Support','/Library/Application Support/Setfarm','/Library/Application Support/Setfarm/authority','/Library/Application Support/Setfarm/PostgreSQL');
my $namespace_phase='absent';
my ($namespace_invalid,$namespace_uncertain,$namespace_helper_unknown)=(0,0,0);
my ($namespace_release_started,$namespace_release_complete,$namespace_release_ok)=(0,0,0);
my ($namespace_deadline,$namespace_positive,$namespace_rechecks)=(0,0,0);
my (@namespace_pending,@namespace_originals,@namespace_mkdir_intents,@namespace_seal_intents);
my $namespace_process=sub {
    task6a_origin_refuse() unless $<==$namespace_uid&&$>==$namespace_uid
        &&$( =~ /\A$namespace_process_gid(?: |\z)/&&$) =~ /\A$namespace_process_gid(?: |\z)/;
};
my $namespace_other_realms_absent=sub {
    task6a_origin_refuse() unless $parent_phase eq 'absent'&&!@parent_originals
        &&$creator_phase eq 'absent'&&!@creator_originals&&!@creator_pending
        &&$staged_phase eq 'absent'&&!@staged_originals&&!@staged_pending
        &&!defined($staged_admission)&&!@file_ledger&&!@directory_ledger
        &&$physical_state eq 'new'&&!@physical_owned_handles;
};
my $namespace_helpers=sub {
    unless(task6a_origin_helpers_settled()&&!$helper_lifecycle_burned) {
        $namespace_helper_unknown=1;$namespace_uncertain=1;task6a_origin_refuse();
    }
};
my $namespace_live=sub {
    task6a_origin_refuse() if $namespace_invalid||$namespace_uncertain||$namespace_release_started;
    task6a_origin_refuse() unless $namespace_phase eq 'creating'||$namespace_phase eq 'held';
    $namespace_process->();$namespace_other_realms_absent->();$namespace_helpers->();
    my $now=task6a_origin_now();
    task6a_origin_refuse() unless $now<$namespace_deadline&&$now<$bootstrap_deadline;
};
my $namespace_intent=sub {
    $namespace_live->();task6a_origin_refuse() if $namespace_positive>=8192;
    ++$namespace_positive;
};
my $namespace_call=sub {
    my ($call)=@_;$namespace_intent->();return $call->();
};
my $namespace_same=sub {
    my ($expected,$actual,$mode,$gid)=@_;
    task6a_origin_refuse() unless @$expected==13&&@$actual==13;
    for my $field(0,1) {task6a_origin_refuse() unless $actual->[$field]==$expected->[$field];}
    task6a_origin_refuse() unless Fcntl::S_ISDIR($actual->[2])&&($actual->[2]&07777)==$mode
        &&$actual->[4]==$namespace_uid&&$actual->[5]==$gid;
};
my $namespace_seal_original=sub {
    my ($cell,$path)=@_;my ($fh,$fd,$present,$alias);
    my $safe=eval {
        $present=$staged_native_fh->($cell,1);
        if($present) {
            $fh=$$cell;$fd=CORE::fileno($fh);
            task6a_origin_refuse() unless defined($fd)&&$fd>=3&&@namespace_originals<6;
            for my $old(@namespace_originals) {
                next if $old->{closed};my $original=$old->{fh};
                $staged_native_fh->(\$original,0);
                my $live=CORE::fileno($original);
                if($fh==$original||(defined($live)&&$live==$fd)) {$alias=1;task6a_origin_refuse();}
                task6a_origin_refuse() unless defined($live)&&$live==$old->{fd};
            }
        }
        1;
    };
    unless($safe) {$namespace_uncertain=1 unless $alias;task6a_origin_refuse();}
    return undef unless $present;
    my $namespace_original_close=sub {CORE::close( $fh )};
    my $record={fh=>$fh,fd=>$fd,path=>$path,close=>$namespace_original_close,
        attempted=>0,closed=>0,state=>'live'};
    push @namespace_originals,$record;return $record;
};
my $namespace_acl=sub {
    my ($record)=@_;
    my $r=$namespace_call->(sub {task6a_origin_capture('/bin/ls',['-ldne',$record->{path}],2,4096)});
    $namespace_helpers->();
    task6a_origin_refuse() unless ref($r) eq 'HASH'&&defined($r->{status})&&$r->{status}==0
        &&JSON::PP::is_bool($r->{reaped})&&$r->{reaped}&&defined($r->{err})&&$r->{err} eq ''
        &&defined($r->{out})&&!ref($r->{out})&&!utf8::is_utf8($r->{out})&&length($r->{out})<=4096;
    my ($path,$gid)=@$record{qw(path gid)};
    task6a_origin_refuse() unless $r->{out} =~ /\A[d][rwxStTs-]{9}\@?[ ]+
        [1-9][0-9]{0,9}[ ]+\Q$namespace_uid\E[ ]+\Q$gid\E[ ]+(?:0|[1-9][0-9]{0,12})[ ]+
        (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[ ]+
        (?:[1-9]|[12][0-9]|3[01])[ ]+(?:(?:[01][0-9]|2[0-3]):[0-5][0-9]|[12][0-9]{3})[ ]+
        \Q$path\E\n\z/x;
};
my $namespace_check=sub {
    my ($record)=@_;$namespace_live->();my $fh=$record->{fh};
    $staged_native_fh->(\$fh,0);
    task6a_origin_refuse() unless defined(CORE::fileno($fh))&&CORE::fileno($fh)==$record->{fd};
    for my $acl(0,1) {
        my @held=$namespace_call->(sub {CORE::stat($fh)});
        my @named=$namespace_call->(sub {CORE::lstat($record->{path})});
        $namespace_same->($record->{identity},\@held,$record->{mode},$record->{gid});
        $namespace_same->($record->{identity},\@named,$record->{mode},$record->{gid});
        $namespace_acl->($record) unless $acl;
    }
    my $flags=$namespace_call->(sub {CORE::fcntl($fh,Fcntl::F_GETFL(),0)});
    my $descriptor=$namespace_call->(sub {CORE::fcntl($fh,Fcntl::F_GETFD(),0)});
    task6a_origin_refuse() unless defined($flags)&&($flags&Fcntl::O_ACCMODE())==Fcntl::O_RDONLY()
        &&defined($descriptor)&&$descriptor==Fcntl::FD_CLOEXEC();$namespace_live->();
};
my $namespace_epoch=sub {
    $namespace_live->();for my $record(@namespace_originals) {$namespace_check->($record);}$namespace_live->();
};
my $namespace_open=sub {
    my ($path,$mode,$gid,$just_created)=@_;
    # A definite mkdir must enroll its new original before another ACL helper.
    # All previous originals were checked immediately before that mkdir.
    $namespace_epoch->() unless $just_created;
    my @before=$namespace_call->(sub {CORE::lstat($path)});
    task6a_origin_refuse() unless @before==13&&Fcntl::S_ISDIR($before[2])
        &&($before[2]&07777)==$mode&&$before[4]==$namespace_uid&&$before[5]==$gid;
    my $namespace_open_flags=Fcntl::O_RDONLY()|Fcntl::O_DIRECTORY()|Fcntl::O_NOFOLLOW();
    my $pending;push @namespace_pending,\$pending;$namespace_intent->();
    my $returned;my $ok=eval {$returned=CORE::sysopen($pending,$path,$namespace_open_flags,$mode); # namespace original
        1;};my $error=$@;
    my $record=$namespace_seal_original->(\$pending,$path);
    $staged_plain_cell->(\$returned);$staged_plain_cell->(\$error);
    unless($ok&&!ref($error)&&!length($error)&&defined($returned)&&!ref($returned)&&$returned&&$record) {
        $namespace_uncertain=1 unless $record;task6a_origin_refuse();
    }
    $record->{identity}=[@before];$record->{mode}=$mode;$record->{gid}=$gid;
    my $fh=$record->{fh};my @held=$namespace_call->(sub {CORE::stat($fh)});
    $namespace_same->($record->{identity},\@held,$mode,$gid);
    my $set=$namespace_call->(sub {CORE::fcntl($fh,Fcntl::F_SETFD(),Fcntl::FD_CLOEXEC())});
    task6a_origin_refuse() unless defined($set)&&$set;
    $namespace_check->($record);$namespace_epoch->();return $record;
};
my $namespace_dispose=sub {
    return $namespace_release_ok if $namespace_release_complete;
    task6a_origin_refuse() if $namespace_release_started;
    $namespace_release_started=1;$namespace_invalid=1;
    $namespace_helper_unknown=1 unless task6a_origin_helpers_settled()&&!$helper_lifecycle_burned;
    my $all=$namespace_uncertain?0:1;
    unless($namespace_helper_unknown) {
        for my $record(reverse @namespace_originals) {
            next if $record->{attempted};$record->{attempted}=1;$record->{state}='closing';
            my ($returned,$error,$safe);
            $safe=eval {my $fh=$record->{fh};$staged_native_fh->(\$fh,0);
                task6a_origin_refuse() unless defined(CORE::fileno($fh))&&CORE::fileno($fh)==$record->{fd};
                if($record->{identity}) {my @now=CORE::stat($fh);
                    task6a_origin_refuse() unless @now==13&&$now[0]==$record->{identity}[0]
                        &&$now[1]==$record->{identity}[1]&&Fcntl::S_ISDIR($now[2]);}
                $returned=$record->{close}->();1;};$error=$@;
            $record->{returned}=$returned;$record->{error}=$error;
            my $ended;my $inspected=eval {my $fh=$record->{fh};$staged_native_fh->(\$fh,0);
                $ended=CORE::fileno($fh);$staged_plain_cell->(\$returned);$staged_plain_cell->(\$error);1;};
            if($safe&&$inspected&&!ref($error)&&!length($error)
                &&defined($returned)&&!ref($returned)&&$returned&&!defined($ended)) {
                $record->{closed}=1;$record->{state}='closed';
            } else {$all=0;$namespace_uncertain=1;$record->{state}='unknown';}
        }
    } else {$all=0;$namespace_uncertain=1;}
    $namespace_release_ok=$all&&!$namespace_uncertain?1:0;$namespace_release_complete=1;
    $namespace_phase=$namespace_release_ok?'released':'quarantined';return $namespace_release_ok;
};
my $namespace_burn=sub {
    $namespace_invalid=1;$namespace_phase='burned';
    eval {$namespace_dispose->()} unless $namespace_release_started;
    task6a_origin_refuse();
};
my $namespace_diagnostic=sub {
    return {scope=>'backend-namespace-custody-diagnostic-only',productionAuthority=>JSON::PP::false,
        directoryCount=>scalar(@namespace_originals),
        createdDirectoryCount=>scalar(grep {$_->{confirmed}} @namespace_mkdir_intents)};
};
sub task6a_origin_create_backend_namespace {
    # Preclaim refusal must not burn, close or cache any existing occurrence.
    task6a_origin_refuse() unless @_==0&&$namespace_phase eq 'absent';
    $namespace_process->();$namespace_other_realms_absent->();
    task6a_origin_refuse() unless task6a_origin_helpers_settled()&&!$helper_lifecycle_burned
        &&task6a_origin_now()<$bootstrap_deadline;
    $namespace_phase='creating';$namespace_deadline=task6a_origin_now()+180;
    my $ok=eval {
        for my $index(0..2) {$namespace_open->($namespace_paths[$index],0755,$namespace_existing_gids[$index]);}
        for my $index(3..5) {
            $namespace_epoch->();my $path=$namespace_paths[$index];my (@before,$errno);
            @before=$namespace_call->(sub {$!=0;my @row=CORE::lstat($path);$errno=0+$!;return @row;});
            task6a_origin_refuse() unless !@before&&$errno==POSIX::ENOENT();
            my $intent={path=>$path,attempted=>1};push @namespace_mkdir_intents,$intent;
            $namespace_intent->();my $returned;my $made=eval {$returned=CORE::mkdir($path, 0700); # namespace exclusive
                1;};my $error=$@;$intent->{returned}=$returned;$intent->{error}=$error;
            $staged_plain_cell->(\$returned);$staged_plain_cell->(\$error);
            task6a_origin_refuse() unless $made&&!ref($error)&&!length($error)&&defined($returned)&&!ref($returned)&&$returned;
            $intent->{confirmed}=1;
            $namespace_open->($path,0700,$namespace_directory_gid,1);
        }
        for my $record(@namespace_originals[3..5]) {
            $namespace_epoch->();my $fh=$record->{fh};
            my $intent={path=>$record->{path},attempted=>1};push @namespace_seal_intents,$intent;
            $namespace_intent->();my $returned;my $sealed=eval {$returned=CORE::chmod(0755,$fh);1;};
            my $error=$@;$intent->{returned}=$returned;$intent->{error}=$error;
            $staged_plain_cell->(\$returned);$staged_plain_cell->(\$error);
            task6a_origin_refuse() unless $sealed&&!ref($error)&&!length($error)&&defined($returned)&&!ref($returned)&&$returned==1;
            $record->{mode}=0755;$namespace_epoch->();
        }
        $namespace_epoch->();$namespace_phase='held';1;
    };$namespace_burn->() unless $ok;return $namespace_diagnostic->();
}
sub task6a_origin_recheck_backend_namespace {
    task6a_origin_refuse() unless @_==0&&$namespace_phase eq 'held'&&!$namespace_release_started;
    if($namespace_rechecks>=64) {$namespace_burn->();}++$namespace_rechecks;
    my $ok=eval {$namespace_epoch->();1;};$namespace_burn->() unless $ok;
    return $namespace_diagnostic->();
}
sub task6a_origin_release_backend_namespace {
    task6a_origin_refuse() unless @_==0&&$namespace_phase ne 'absent';
    task6a_origin_refuse() unless $namespace_dispose->();return $namespace_diagnostic->();
}

# Pure framing declarations are part of the independently owner-admitted
# bootstrap bytes. Test declarations alone cannot create execution authority.
sub task6a_origin_refuse {die "TASK6A_ORIGIN_BOOTSTRAP_REFUSED\n";}
sub task6a_origin_file_identity {
    my ($expected,$actual)=@_;
    task6a_origin_refuse() unless @$expected==13&&@$actual==13;
    for my $field(0,1,2,3,4,5,7,9,10) {
        task6a_origin_refuse() unless defined($actual->[$field])&&$actual->[$field]==$expected->[$field];
    }
}
sub task6a_origin_check_held_file {
    my ($record)=@_;my $fh=$record->{fh};
    task6a_origin_refuse() if defined($parent_constructor_deadline)&&defined($parent_constructor_material_allowed)&&!$parent_constructor_material_allowed->()&&task6a_origin_now()>=$parent_material_deadline->();
    task6a_origin_refuse() unless defined($fh)&&defined(fileno($fh));
    task6a_origin_file_identity($record->{identity},[stat($fh)]);
    task6a_origin_file_identity($record->{identity},[lstat($record->{path})]);
    my $position=sysseek($fh,0,0);
    task6a_origin_refuse() unless defined($position)&&$position==0;
    my $digest=Digest::SHA->new(256);my $length=0;
    while(1) {
        task6a_origin_refuse() unless task6a_origin_now()<$parent_material_deadline->();
        my $bytes='';my $n=sysread($fh,$bytes,65536);
        task6a_origin_refuse() unless defined($n);
        last if $n==0;
        $length+=$n;task6a_origin_refuse() if $length>$record->{identity}[7];
        $digest->add($bytes);
    }
    task6a_origin_refuse() unless $length==$record->{identity}[7]&&$digest->hexdigest eq $record->{sha256};
    task6a_origin_file_identity($record->{identity},[stat($fh)]);
    task6a_origin_file_identity($record->{identity},[lstat($record->{path})]);
    task6a_origin_refuse() unless task6a_origin_now()<$parent_material_deadline->();
}
sub task6a_origin_hold_file {
    task6a_origin_guard_raw_physical();
    task6a_origin_refuse() unless @_==4&&!$file_lifecycle_burned&&!$file_lifecycle_released;
    my ($path,$hash,$mode,$limit)=@_;my $record;
    my $ok=eval {
        task6a_origin_text($path,1024);task6a_origin_text($hash,64);
        task6a_origin_refuse() unless $path =~ m{\A/(?:[A-Za-z0-9._ +\-]+/)*[A-Za-z0-9._ +\-]+\z}
            &&$hash =~ /\A[a-f0-9]{64}\z/&&defined($mode)&&!ref($mode)
            &&($mode==0400||$mode==0444||$mode==0555||$mode==0755||$mode==04755)
            &&defined($limit)&&!ref($limit)&&$limit>=1&&$limit<=134217728&&$limit==int($limit);
        for my $part(split('/',$path)) {task6a_origin_refuse() if $part eq '.'||$part eq '..';}
        my @before=lstat($path);
        task6a_origin_refuse() unless @before==13&&Fcntl::S_ISREG($before[2])
            &&($before[2]&07777)==$mode&&$before[3]==1&&$before[4]==0&&$before[5]==0
            &&$before[7]>=0&&$before[7]<=$limit&&@file_ledger<256;
        $record={path=>$path,sha256=>$hash,identity=>\@before,fh=>undef};
        push(@file_ledger,$record);
        my $fh;
        if($physical_owns_ledgers&&$physical_internal) {$physical_open->(\$fh,$path,Fcntl::O_RDONLY()|Fcntl::O_NOFOLLOW()|Fcntl::O_NONBLOCK());}
        else {sysopen($fh,$path,Fcntl::O_RDONLY()|Fcntl::O_NOFOLLOW()|Fcntl::O_NONBLOCK()) or task6a_origin_refuse();}
        $record->{fh}=$fh;
        binmode($fh) or task6a_origin_refuse();
        fcntl($fh,Fcntl::F_SETFD(),Fcntl::FD_CLOEXEC()) or task6a_origin_refuse();
        task6a_origin_check_held_file($record);
        1;
    };
    if(!$ok) {$file_lifecycle_burned=1;task6a_origin_refuse();}
    # Descriptor/identity stay private. This fragment does not admit ancestry,
    # ACLs, native closure, origin, execution or cleanup authority by itself.
    return {scope=>'retained-file-diagnostic-only',productionAuthority=>JSON::PP::false,
        path=>$path,contentSha256=>$hash,byteLength=>$record->{identity}[7]};
}
sub task6a_origin_recheck_files {
    task6a_origin_refuse() unless @_==0&&!$file_lifecycle_burned&&!$file_lifecycle_released;
    my $ok=eval {for my $record(@file_ledger) {task6a_origin_check_held_file($record);}1;};
    if(!$ok) {$file_lifecycle_burned=1;task6a_origin_refuse();}
    return {scope=>'retained-file-diagnostic-only',productionAuthority=>JSON::PP::false,
        fileCount=>scalar(@file_ledger)};
}
sub task6a_origin_close_files {
    task6a_origin_guard_raw_physical();
    task6a_origin_refuse() unless @_==0&&!$file_lifecycle_released;
    $file_lifecycle_released=1;
    for my $record(@file_ledger,@directory_ledger) {
        my $fh=$record->{fh};next unless defined($fh);
        my $closed=eval {defined(fileno($fh))&&close($fh)};
        $file_lifecycle_burned=1 unless $closed&&!$@;
    }
    task6a_origin_refuse() if $file_lifecycle_burned;
}
sub task6a_origin_acl_free {
    task6a_origin_refuse() unless @_==1;
    my ($path)=@_;task6a_origin_text($path,1024);
    task6a_origin_refuse() unless $path eq '/'
        ||$path =~ m{\A/(?:[A-Za-z0-9._ +\-]+/)*[A-Za-z0-9._ +\-]+\z};
    for my $part(split('/',$path)) {task6a_origin_refuse() if $part eq '.'||$part eq '..';}
    my $r=eval {task6a_origin_capture('/bin/ls',['-lde',$path],2,4096)};
    task6a_origin_refuse() if $@||ref($r) ne 'HASH';
    task6a_origin_refuse() unless defined($r->{status})&&$r->{status}==0
        &&JSON::PP::is_bool($r->{reaped})&&$r->{reaped}&&defined($r->{err})&&$r->{err} eq ''
        &&defined($r->{out})&&!ref($r->{out})&&!utf8::is_utf8($r->{out})&&length($r->{out})<=4096;
    # Exactly one complete row. '@' is an xattr marker, not ACL authority;
    # '+' and every appended ACL/warning/diagnostic row are denied.
    task6a_origin_refuse() unless $r->{out} =~ /\A[d-][rwxStTs-]{9}\@?[ ]+
        [1-9][0-9]{0,9}[ ]+root[ ]+wheel[ ]+(?:0|[1-9][0-9]{0,12})[ ]+
        (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[ ]+
        (?:[1-9]|[12][0-9]|3[01])[ ]+(?:(?:[01][0-9]|2[0-3]):[0-5][0-9]|[12][0-9]{3})[ ]+
        \Q$path\E\n\z/x;
    return {scope=>'acl-sample-diagnostic-only',productionAuthority=>JSON::PP::false};
}
sub task6a_origin_directory_identity {
    my ($expected,$actual)=@_;
    task6a_origin_refuse() unless @$expected==13&&@$actual==13;
    # Directory contents can legitimately change (especially /private/tmp).
    # This holds ancestry identity, NOT an exact descendant census or ABA fence.
    for my $field(0,1,2,4,5) {
        task6a_origin_refuse() unless defined($actual->[$field])&&$actual->[$field]==$expected->[$field];
    }
}
sub task6a_origin_check_directory {
    my ($record)=@_;my $fh=$record->{fh};
    task6a_origin_refuse() unless defined($fh)&&defined(fileno($fh))&&task6a_origin_now()<$parent_material_deadline->();
    task6a_origin_directory_identity($record->{identity},[stat($fh)]);
    task6a_origin_directory_identity($record->{identity},[lstat($record->{path})]);
    task6a_origin_acl_free($record->{path});
    task6a_origin_directory_identity($record->{identity},[stat($fh)]);
    task6a_origin_directory_identity($record->{identity},[lstat($record->{path})]);
    task6a_origin_refuse() unless task6a_origin_now()<$parent_material_deadline->();
}
sub task6a_origin_hold_ancestry {
    task6a_origin_guard_raw_physical();
    task6a_origin_refuse() unless @_==1&&!$file_lifecycle_burned&&!$file_lifecycle_released;
    my ($path)=@_;my $ok=eval {
        task6a_origin_text($path,1024);
        task6a_origin_refuse() unless $path =~ m{\A/(?:[A-Za-z0-9._ +\-]+/)*[A-Za-z0-9._ +\-]+\z};
        my @parts=split('/',$path);shift(@parts);
        task6a_origin_refuse() unless @parts>=1&&@parts<=32;
        for(@parts) {task6a_origin_refuse() if $_ eq '.'||$_ eq '..';}
        pop(@parts);my @parents=('/');my $prefix='';
        for(@parts) {$prefix.='/'.$_;push(@parents,$prefix);}
        for my $parent(@parents) {
            my @prior=grep {$_->{path} eq $parent} @directory_ledger;
            task6a_origin_refuse() if @prior>1;
            if(@prior) {task6a_origin_check_directory($prior[0]);next;}
            my @before=lstat($parent);
            task6a_origin_refuse() unless @before==13&&Fcntl::S_ISDIR($before[2])
                &&$before[4]==0&&$before[5]==0&&@directory_ledger<128;
            my $mode=$before[2]&07777;
            task6a_origin_refuse() unless $parent eq '/private/tmp'?$mode==01777
                :($mode==0755||$mode==0711||$mode==0700||$mode==0555);
            my $record={path=>$parent,identity=>\@before,fh=>undef};push(@directory_ledger,$record);
            my $fh;
            if($physical_owns_ledgers&&$physical_internal) {$physical_open->(\$fh,$parent,Fcntl::O_RDONLY()|Fcntl::O_NOFOLLOW()|Fcntl::O_DIRECTORY());}
            else {sysopen($fh,$parent,Fcntl::O_RDONLY()|Fcntl::O_NOFOLLOW()|Fcntl::O_DIRECTORY()) or task6a_origin_refuse();}
            $record->{fh}=$fh;
            fcntl($fh,Fcntl::F_SETFD(),Fcntl::FD_CLOEXEC()) or task6a_origin_refuse();
            task6a_origin_check_directory($record);
        }
        1;
    };
    if(!$ok) {$file_lifecycle_burned=1;task6a_origin_refuse();}
    return {scope=>'retained-ancestry-diagnostic-only',productionAuthority=>JSON::PP::false,
        directoryCount=>scalar(@directory_ledger)};
}
sub task6a_origin_recheck_ancestry {
    task6a_origin_refuse() unless @_==0&&!$file_lifecycle_burned&&!$file_lifecycle_released;
    my $ok=eval {for my $record(@directory_ledger) {task6a_origin_check_directory($record);}1;};
    if(!$ok) {$file_lifecycle_burned=1;task6a_origin_refuse();}
    return {scope=>'retained-ancestry-diagnostic-only',productionAuthority=>JSON::PP::false,
        directoryCount=>scalar(@directory_ledger)};
}
sub task6a_origin_physical_cleanup {
    return $physical_cleanup_private->();
}
sub task6a_origin_physical_fail {
    $physical_state='burned' unless $physical_state eq 'released';
    $file_lifecycle_burned=1 if $physical_owns_ledgers;
    task6a_origin_physical_cleanup();
    task6a_origin_refuse();
}
sub task6a_origin_guard_raw_physical {
    task6a_origin_refuse() if !$physical_internal&&defined($parent_constructor_material_allowed)&&!$parent_constructor_material_allowed->();
    task6a_origin_physical_fail() if $physical_owns_ledgers&&!$physical_internal;
}
sub task6a_origin_physical_records {
    my $ok=eval {
        for my $a(\@file_ledger,\@directory_ledger,\@physical_directories) {$staged_vector->($a);}
        task6a_origin_refuse() unless @file_ledger==1&&@directory_ledger==3&&@physical_directories==3;
        my $file=$staged_container->(\$physical_file,'B::HV');
        my $row=$staged_container->(\($file_ledger[0]),'B::HV');
        task6a_origin_refuse() unless $file==$row&&exists($file->{path})
            &&$staged_scalar->(\($file->{path})) eq '/usr/bin/perl';
        my @paths=('/','/usr','/usr/bin');
        for my $i(0..2) {
            my $original=$staged_container->(\($physical_directories[$i]),'B::HV');
            my $row=$staged_container->(\($directory_ledger[$i]),'B::HV');
            task6a_origin_refuse() unless $original==$row&&exists($row->{path})
                &&$staged_scalar->(\($row->{path})) eq $paths[$i];
        }
        1;
    };return $ok?1:0;
}
$physical_epoch=sub {
    my $ok=eval {
        $physical_require_live->();
        task6a_origin_refuse() unless @_==0&&$physical_state eq 'active'
            &&$physical_owns_ledgers&&!$physical_internal&&!$file_lifecycle_burned
            &&!$file_lifecycle_released&&task6a_origin_physical_records()
            &&task6a_origin_helpers_settled()&&task6a_origin_now()<$parent_material_deadline->();
        task6a_origin_recheck_ancestry();
        task6a_origin_recheck_files();
        task6a_origin_acl_free('/usr/bin/perl');
        task6a_origin_recheck_files();
        task6a_origin_recheck_ancestry();
        task6a_origin_refuse() unless task6a_origin_physical_records()
            &&task6a_origin_helpers_settled()&&task6a_origin_now()<$parent_material_deadline->();
        1;
    };
    unless($ok) {$physical_state='burned' unless $physical_state eq 'released';$file_lifecycle_burned=1 if $physical_owns_ledgers;task6a_origin_refuse();}
    return {scope=>'composed-system-perl-physical-candidate-diagnostic-only',
        productionAuthority=>JSON::PP::false,fileCount=>1,directoryCount=>3};
};
sub task6a_origin_recheck_system_perl_physical {
    task6a_origin_refuse() if defined($parent_constructor_material_allowed)&&!$parent_constructor_material_allowed->();
    my $r;my $ok=eval {$r=$physical_epoch->(@_);1;};
    task6a_origin_physical_fail() unless $ok;return $r;
}
$physical_hold_private=sub {
    task6a_origin_physical_fail() unless @_==0&&$physical_state eq 'new'
        &&!$file_lifecycle_burned&&!$file_lifecycle_released
        &&@file_ledger==0&&@directory_ledger==0;
    $physical_state='starting';
    $physical_owns_ledgers=1;
    $physical_internal=1;
    my $ok=eval {
        task6a_origin_refuse() unless task6a_origin_helpers_settled()
            &&task6a_origin_now()<$parent_material_deadline->();
        task6a_origin_hold_ancestry('/usr/bin/perl');
        task6a_origin_acl_free('/usr/bin/perl');
        task6a_origin_hold_file('/usr/bin/perl',
            'abda2bfd23a6c9a8e57adf2291f0aea4abd8faf440558ee49fe4ced55e8d9ad0',0755,1048576);
        $physical_file=$file_ledger[0];
        @physical_directories=@directory_ledger;
        $physical_internal=0;
        $physical_state='active';
        $physical_epoch->();
        1;
    };
    $physical_internal=0;
    task6a_origin_physical_fail() unless $ok;
    return {scope=>'composed-system-perl-physical-candidate-diagnostic-only',
        productionAuthority=>JSON::PP::false,fileCount=>1,directoryCount=>3};
};
sub task6a_origin_hold_system_perl_physical {
    task6a_origin_refuse() if defined($parent_constructor_material_allowed)&&!$parent_constructor_material_allowed->();
    return $physical_hold_private->(@_);
}
sub task6a_origin_release_system_perl_physical {
    task6a_origin_refuse() if defined($parent_constructor_material_allowed)&&!$parent_constructor_material_allowed->();
    my $valid=eval {
        task6a_origin_refuse() unless @_==0;
        task6a_origin_recheck_system_perl_physical();
        1;
    };
    $physical_state='released';
    $file_lifecycle_burned=1 if !$valid&&$physical_owns_ledgers;
    my $closed=task6a_origin_physical_cleanup();
    task6a_origin_refuse() unless $valid&&$closed;
    return {scope=>'composed-system-perl-physical-candidate-diagnostic-only',
        productionAuthority=>JSON::PP::false,released=>JSON::PP::true};
}
sub task6a_origin_record {
    my ($v)=@_;task6a_origin_refuse() unless ref($v) eq 'HASH'&&keys(%$v)<=64;return $v;
}
sub task6a_origin_field {
    my ($r,$k)=@_;task6a_origin_record($r);task6a_origin_refuse() unless exists($r->{$k});return $r->{$k};
}
sub task6a_origin_text {
    my ($v,$bound)=@_;
    task6a_origin_refuse() if !defined($v)||ref($v)
        ||!(B::svref_2object(\$v)->FLAGS&B::SVp_POK());
    task6a_origin_refuse() if length($v)>$bound||$v =~ /[\r\0]/;
    my $bytes=eval {Encode::encode('UTF-8',$v,Encode::FB_CROAK()|Encode::LEAVE_SRC())};
    task6a_origin_refuse() if $@||!defined($bytes)||length($bytes)>$bound;
    return $v;
}
sub task6a_origin_oid {
    my ($v)=@_;task6a_origin_text($v,40);task6a_origin_refuse() unless $v =~ /\A[a-f0-9]{40}\z/;return $v;
}
sub task6a_origin_size {
    my ($v)=@_;task6a_origin_refuse() if !defined($v)||ref($v);
    my $flags=B::svref_2object(\$v)->FLAGS;
    task6a_origin_refuse() if ($flags&B::SVp_POK())||!($flags&(B::SVp_IOK()|B::SVp_NOK()))
        ||$v<0||$v>2097152||$v!=int($v);
    return $v;
}
sub task6a_origin_list {
    my ($v,$max)=@_;task6a_origin_refuse() unless ref($v) eq 'ARRAY'&&@$v<=$max;return $v;
}
sub task6a_origin_identity {
    my ($r,$expected)=@_;task6a_origin_oid($expected);
    task6a_origin_refuse() unless task6a_origin_oid(task6a_origin_field($r,'sha')) eq $expected;
}
sub task6a_origin_framed {
    my ($kind,$bytes)=@_;return Digest::SHA::sha1_hex($kind.' '.length($bytes)."\0".$bytes);
}
sub task6a_origin_details {
    my ($kind,$sha,$details)=@_;
    return {schema=>'setfarm.task6a-github-object-protocol.v2',scope=>'object-protocol-only',
        productionAuthority=>JSON::PP::false,objectKind=>$kind,sha=>$sha,%$details};
}
sub task6a_origin_armor {
    my ($s)=@_;my @lines=split(/\n/,$s,-1);pop(@lines) if @lines&&$lines[-1] eq '';
    task6a_origin_refuse() unless @lines>=3&&shift(@lines) eq '-----BEGIN PGP SIGNATURE-----'
        &&pop(@lines) eq '-----END PGP SIGNATURE-----';
    my %headers;
    while(@lines&&$lines[0] =~ /\A(Version|Comment): [\x20-\x7e]+\z/) {
        task6a_origin_refuse() if $headers{$1}++;shift(@lines);
    }
    task6a_origin_refuse() unless @lines&&shift(@lines) eq '';
    if(@lines&&$lines[-1] =~ /\A=/) {
        task6a_origin_refuse() unless pop(@lines) =~ /\A=[A-Za-z0-9+\/]{4}\z/;
    }
    task6a_origin_refuse() unless @lines;
    for(@lines) {task6a_origin_refuse() if length($_)>76||$_ !~ /\A[A-Za-z0-9+\/]+={0,2}\z/;}
    my $encoded=join('',@lines);
    task6a_origin_refuse() if length($encoded)%4||$encoded !~ /\A[A-Za-z0-9+\/]+={0,2}\z/
        ||MIME::Base64::encode_base64(MIME::Base64::decode_base64($encoded),'') ne $encoded;
    # Armor syntax and a GitHub TLS verdict are not local GPG verification.
}
sub task6a_origin_verify_merge {
    task6a_origin_refuse() unless @_==2;my ($r,$expected)=@_;
    task6a_origin_identity($r,$expected);
    my $v=task6a_origin_record(task6a_origin_field($r,'verification'));
    my $verified=task6a_origin_field($v,'verified');
    task6a_origin_refuse() unless JSON::PP::is_bool($verified)&&$verified
        &&task6a_origin_text(task6a_origin_field($v,'reason'),32) eq 'valid';
    my $p=task6a_origin_text(task6a_origin_field($v,'payload'),65536);
    my $s=task6a_origin_text(task6a_origin_field($v,'signature'),16384);task6a_origin_armor($s);
    my $split=index($p,"\n\n");task6a_origin_refuse() if $split<0;
    my @h=split(/\n/,substr($p,0,$split),-1);
    task6a_origin_refuse() unless @h==5&&$h[0] =~ /\Atree [a-f0-9]{40}\z/
        &&$h[1] =~ /\Aparent [a-f0-9]{40}\z/&&$h[2] =~ /\Aparent [a-f0-9]{40}\z/;
    for my $pair([3,'author'],[4,'committer']) {
        my ($i,$kind)=@$pair;
        task6a_origin_refuse() unless $h[$i] =~ /\A$kind [^<>\n]+ <[^<>\n]+> (?:0|[1-9][0-9]{0,11}) [+-](?:0[0-9]|1[0-4])[0-5][0-9]\z/;
    }
    my $tree=task6a_origin_oid(task6a_origin_field(task6a_origin_field($r,'tree'),'sha'));
    my $parents=task6a_origin_list(task6a_origin_field($r,'parents'),2);
    task6a_origin_refuse() unless @$parents==2;
    my @ids=map {task6a_origin_oid(task6a_origin_field($_,'sha'))} @$parents;
    task6a_origin_refuse() if $ids[0] eq $ids[1]||$h[0] ne 'tree '.$tree
        ||$h[1] ne 'parent '.$ids[0]||$h[2] ne 'parent '.$ids[1];
    my $raw=substr($p,0,$split)."\ngpgsig ".join("\n ",split(/\n/,$s,-1)).substr($p,$split);
    my $bytes=Encode::encode('UTF-8',$raw,Encode::FB_CROAK()|Encode::LEAVE_SRC());
    task6a_origin_refuse() unless task6a_origin_framed('commit',$bytes) eq $expected;
    return task6a_origin_details('commit',$expected,{treeSha=>$tree,parentShas=>\@ids});
}
sub task6a_origin_verify_tree {
    task6a_origin_refuse() unless @_==2;my ($r,$expected)=@_;
    task6a_origin_identity($r,$expected);my $truncated=task6a_origin_field($r,'truncated');
    task6a_origin_refuse() unless JSON::PP::is_bool($truncated)&&!$truncated;
    my $entries=task6a_origin_list(task6a_origin_field($r,'tree'),4096);
    my @parts;my %names;
    for my $e(@$entries) {
        my $name=task6a_origin_text(task6a_origin_field($e,'path'),255);
        task6a_origin_refuse() unless $name =~ /\A[A-Za-z0-9._@+\-]+\z/
            &&$name ne '.'&&$name ne '..'&&!$names{lc($name)}++;
        my $mode=task6a_origin_text(task6a_origin_field($e,'mode'),6);
        my $kind=task6a_origin_text(task6a_origin_field($e,'type'),8);
        my $sha=task6a_origin_oid(task6a_origin_field($e,'sha'));
        my $directory=$mode eq '040000'&&$kind eq 'tree';
        if($directory) {task6a_origin_refuse() if exists($e->{size});}
        elsif(($mode eq '100644'||$mode eq '100755')&&$kind eq 'blob') {
            task6a_origin_size(task6a_origin_field($e,'size'));
        } else {task6a_origin_refuse();}
        push(@parts,{sort=>$name.($directory?'/':''),bytes=>($directory?'40000':$mode).' '.$name."\0".pack('H*',$sha)});
    }
    my $bytes=join('',map {$_->{bytes}} sort {$a->{sort} cmp $b->{sort}} @parts);
    task6a_origin_refuse() unless task6a_origin_framed('tree',$bytes) eq $expected;
    return task6a_origin_details('tree',$expected,{entryCount=>scalar(@$entries)});
}
sub task6a_origin_verify_blob {
    task6a_origin_refuse() unless @_==2;my ($r,$expected)=@_;
    task6a_origin_identity($r,$expected);my $length=task6a_origin_size(task6a_origin_field($r,'size'));
    task6a_origin_refuse() unless task6a_origin_text(task6a_origin_field($r,'encoding'),8) eq 'base64';
    my $content=task6a_origin_text(task6a_origin_field($r,'content'),4194304);
    task6a_origin_refuse() unless $content =~ /\A[A-Za-z0-9+\/=\n]*\z/;
    $content =~ s/\n//g;
    task6a_origin_refuse() unless length($content)==4*int(($length+2)/3)&&$content =~ /\A[A-Za-z0-9+\/]*={0,2}\z/;
    my $bytes=MIME::Base64::decode_base64($content);
    task6a_origin_refuse() unless length($bytes)==$length&&MIME::Base64::encode_base64($bytes,'') eq $content
        &&task6a_origin_framed('blob',$bytes) eq $expected;
    return task6a_origin_details('blob',$expected,{byteLength=>$length,
        contentSha256=>Digest::SHA::sha256_hex($bytes),bytes=>$bytes});
}
sub task6a_origin_fds {
    opendir(my $directory,'/dev/fd') or task6a_origin_refuse();
    my $own=fileno($directory);
    my %fds;
    my $ok=eval {
        task6a_origin_refuse() unless defined($own);
        while(1) {
            $!=0;my $name=readdir($directory);
            if(!defined($name)) {task6a_origin_refuse() if $!;last;}
            next if $name eq '.'||$name eq '..';
            task6a_origin_refuse() unless $name =~ /\A(?:0|[1-9][0-9]{0,6})\z/&&$name<=1048576&&!exists($fds{$name});
            $fds{$name}=1;task6a_origin_refuse() if keys(%fds)>4096;
        }
        1;
    };
    my $closed=closedir($directory);
    task6a_origin_refuse() unless $ok&&$closed;
    delete($fds{$own});
    task6a_origin_refuse() unless exists($fds{0})&&exists($fds{1})&&exists($fds{2});
    return [sort {$a<=>$b} keys(%fds)];
}
sub task6a_origin_poll {
    my ($pid,$reaped,$uncertain,$status)=@_;return if $$reaped||$$uncertain;
    my $got=waitpid($pid,POSIX::WNOHANG());
    if(!defined($got)) {$$uncertain=1;}
    elsif($got==$pid) {$$status=$?;$$reaped=1;}
    elsif($got!=0) {$$uncertain=1;}
    # One actual wait occurrence updates the constructor's same original lease.
    $parent_constructor_observe_wait->($pid,$reaped,$uncertain,$status)
        if defined($parent_constructor_observe_wait);
}
sub task6a_origin_shutdown_helper {
    my ($pid,$reaped,$uncertain,$status)=@_;
    # Burned shutdown-only budget, never source/origin validity renewal.
    for my $phase([0,5],['TERM',2],['KILL',2]) {
        if(defined($parent_constructor_cleanup_deadline)&&defined($parent_constructor_material_allowed)&&!$parent_constructor_material_allowed->()) {
            my $now;my $ok=eval {$now=task6a_origin_now();1;};
            unless($ok&&$now<$parent_constructor_cleanup_deadline) {$$uncertain=1;return;}
        }
        task6a_origin_poll($pid,$reaped,$uncertain,$status);
        return if $$reaped||$$uncertain;
        if($phase->[0]) {
            if(defined($parent_constructor_cleanup_deadline)&&defined($parent_constructor_material_allowed)&&!$parent_constructor_material_allowed->()) {
                my $now;my $ok=eval {$now=task6a_origin_now();1;};
                unless($ok&&$now<$parent_constructor_cleanup_deadline) {$$uncertain=1;return;}
            }
            unless(kill($phase->[0],$pid)==1) {
                task6a_origin_poll($pid,$reaped,$uncertain,$status);
                $$uncertain=1 unless $$reaped;return;
            }
        }
        my $end=task6a_origin_now()+$phase->[1];
        $end=$parent_constructor_cleanup_deadline if defined($parent_constructor_cleanup_deadline)
            &&defined($parent_constructor_material_allowed)&&!$parent_constructor_material_allowed->()&&$parent_constructor_cleanup_deadline<$end;
        while(task6a_origin_now()<$end) {
            task6a_origin_poll($pid,$reaped,$uncertain,$status);
            return if $$reaped||$$uncertain;Time::HiRes::sleep(0.01);
        }
    }
    $$uncertain=1 unless $$reaped;
}
sub task6a_origin_capture {
    task6a_origin_refuse() unless @_==4;
    my ($tool,$args,$seconds,$limit)=@_;
    my %tools=('/usr/bin/curl'=>1,'/bin/ps'=>1,'/usr/sbin/lsof'=>1,'/bin/ls'=>1);
    task6a_origin_refuse() unless defined($tool)&&!ref($tool)&&$tools{$tool}
        &&ref($args) eq 'ARRAY'&&@$args<=128&&defined($seconds)&&!ref($seconds)
        &&$seconds>0&&$seconds<=60&&defined($limit)&&!ref($limit)
        &&$limit>=1&&$limit<=134218752&&$limit==int($limit);
    for(@$args) {task6a_origin_text($_,8192);task6a_origin_refuse() if /[^\x20-\x7e\n]/;}
    my $deadline=task6a_origin_now()+$seconds;
    $deadline=$bootstrap_deadline if $bootstrap_deadline<$deadline;
    $deadline=$parent_constructor_deadline if defined($parent_constructor_deadline)
        &&defined($parent_constructor_material_allowed)&&!$parent_constructor_material_allowed->()&&$parent_constructor_deadline<$deadline;
    task6a_origin_refuse() unless task6a_origin_now()<$deadline;
    # Retained parent-owned lifetime registry, not caller cleanup receipts.
    # Register before any pipe/fork effect; uncertainty burns permanently.
    my $record={settled=>0,pid=>undef};push(@helper_ledger,$record);
    my ($pid,$status);my $reaped=0;my $uncertain=0;my @handles;
    my ($out,$err,$setup)=('','','');
    my $ok=eval {
        $SIG{CHLD}='DEFAULT';$^F=2;
        pipe(my $in_r,my $in_w) or task6a_origin_refuse();push(@handles,$in_r,$in_w);
        pipe(my $out_r,my $out_w) or task6a_origin_refuse();push(@handles,$out_r,$out_w);
        pipe(my $err_r,my $err_w) or task6a_origin_refuse();push(@handles,$err_r,$err_w);
        pipe(my $setup_r,my $setup_w) or task6a_origin_refuse();push(@handles,$setup_r,$setup_w);
        for(@handles) {binmode($_) or task6a_origin_refuse();task6a_origin_refuse() unless fileno($_)>=3;}
        fcntl($setup_w,Fcntl::F_SETFD(),Fcntl::FD_CLOEXEC()) or task6a_origin_refuse();
        my $fds=task6a_origin_fds();my $error_fd=fileno($setup_w);
        task6a_origin_refuse() unless task6a_origin_now()<$deadline;
        $pid=fork();task6a_origin_refuse() unless defined($pid);
        $record->{pid}=$pid if $pid>0;
        if($pid==0) {
            my $ready=eval {
                for my $pair([$in_r,0],[$out_w,1],[$err_w,2]) {
                    my $duplicated=POSIX::dup2(fileno($pair->[0]),$pair->[1]);
                    task6a_origin_refuse() unless defined($duplicated)&&$duplicated==$pair->[1];
                }
                for my $fd(@$fds) {
                    next if $fd<=2||$fd==$error_fd;
                    my $closed=POSIX::close($fd);
                    task6a_origin_refuse() unless defined($closed)&&$closed==0;
                }
                chdir('/') or task6a_origin_refuse();
                %ENV=(PATH=>'/usr/bin:/bin',LANG=>'C',LC_ALL=>'C');
                no warnings 'exec';exec {$tool} $tool,@$args;
                task6a_origin_refuse();
            };
            syswrite($setup_w,"E\n");POSIX::_exit(126);
        }
        for($in_r,$in_w,$out_w,$err_w,$setup_w) {close($_) or task6a_origin_refuse();}
        my $select=IO::Select->new($out_r,$err_r,$setup_r);
        my %channels=(fileno($out_r)=>[\$out,$limit],fileno($err_r)=>[\$err,65536],fileno($setup_r)=>[\$setup,4096]);
        while($select->count||!$reaped) {
            task6a_origin_poll($pid,\$reaped,\$uncertain,\$status);
            task6a_origin_refuse() if $uncertain||task6a_origin_now()>=$deadline;
            my @ready=$select->can_read(0.01);
            for my $fh(@ready) {
                my $fd=fileno($fh);my $channel=$channels{$fd};my $bytes='';
                my $n=sysread($fh,$bytes,65536);
                task6a_origin_refuse() unless defined($n);
                if($n==0) {$select->remove($fh);close($fh) or task6a_origin_refuse();}
                else {${$channel->[0]}.=$bytes;task6a_origin_refuse() if length(${$channel->[0]})>$channel->[1];}
            }
            task6a_origin_poll($pid,\$reaped,\$uncertain,\$status);
            task6a_origin_refuse() if $uncertain;
        }
        task6a_origin_refuse() unless $reaped&&defined($status)&&$status==0
            &&$setup eq ''&&task6a_origin_now()<$deadline;
        1;
    };
    my $close_ok=1;
    for my $fh(@handles) {
        my $closed=eval {!defined(fileno($fh))||close($fh)};
        $close_ok=0 unless $closed&&!$@;
    }
    if(defined($pid)&&$pid>0&&!$reaped&&!$uncertain) {
        eval {task6a_origin_shutdown_helper($pid,\$reaped,\$uncertain,\$status);};
        $uncertain=1 if $@;
    }
    if(defined($pid)&&$pid>0&&$close_ok&&$reaped&&!$uncertain) {$record->{settled}=1;}
    else {$helper_lifecycle_burned=1;}
    unless($ok&&$close_ok&&$reaped&&!$uncertain) {
        task6a_origin_physical_fail() if $physical_owns_ledgers;
        task6a_origin_refuse();
    }
    return {out=>$out,err=>$err,status=>0,pid=>$pid,reaped=>JSON::PP::true};
}
sub task6a_origin_get_metadata {
    task6a_origin_refuse() unless @_==1;
    $producer_transport_epoch->();
    my ($route)=@_;task6a_origin_text($route,256);
    # Only fixed policy-derived Git object/PR identities reach this edge.
    # Never follow API-returned URL fields, redirects or caller source paths.
    task6a_origin_refuse() unless $route eq '/git/ref/heads/main'
        ||$route =~ m{\A/git/(?:commits|trees|blobs)/[a-f0-9]{40}\z}
        ||$route =~ m{\A/commits/[a-f0-9]{40}/pulls\?per_page=100&page=1\z}
        ||$route =~ m{\A/pulls/[1-9][0-9]{0,6}\z};
    my $start=task6a_origin_now();my $millis=int(($bootstrap_deadline-$start)*1000);
    $millis=10000 if $millis>10000;task6a_origin_refuse() unless $millis>=1;
    my $seconds=$millis/1000;my $deadline=$start+$seconds;
    my $url='https://api.github.com/repos/hikmetgulsesli/setfarm'.$route;
    my $r=eval {task6a_origin_capture('/usr/bin/curl',[
        '-q','--silent','--show-error','--proto','=https','--tlsv1.2',
        '--cacert','/private/etc/ssl/cert.pem','--proxy','','--noproxy','*','--max-redirs','0',
        '--connect-timeout','5','--max-time',''.$seconds,
        '-H','Accept: application/vnd.github+json','-H','X-GitHub-Api-Version: 2022-11-28',
        '--write-out',"\n%{http_code}\n%{content_type}\n%{url_effective}",$url,
    ],$seconds,4195328)};
    task6a_origin_refuse() if $@;
    $producer_transport_epoch->();
    my $now=task6a_origin_now();task6a_origin_refuse() unless $now<$deadline&&$now<$bootstrap_deadline;
    task6a_origin_refuse() unless ref($r) eq 'HASH'&&defined($r->{status})&&$r->{status}==0
        &&JSON::PP::is_bool($r->{reaped})&&$r->{reaped}&&defined($r->{err})&&$r->{err} eq ''
        &&defined($r->{out})&&!ref($r->{out})&&!utf8::is_utf8($r->{out})&&length($r->{out})<=4195328;
    my $raw=$r->{out};
    task6a_origin_refuse() unless $raw =~ /\A(.*)\n200\n(application\/json(?:;[\x20-\x7e]*)?)\n([^\n]+)\z/s;
    my ($body,$effective)=($1,$3);
    task6a_origin_refuse() unless $effective eq $url&&length($body)<=4194304;
    my $text=eval {Encode::decode('UTF-8',$body,Encode::FB_CROAK()|Encode::LEAVE_SRC())};
    task6a_origin_refuse() if $@||!defined($text);
    my $value=eval {JSON::PP->new->max_depth(32)->max_size(4194304)->decode($text)};
    task6a_origin_refuse() if $@||(ref($value) ne 'HASH'&&ref($value) ne 'ARRAY');
    $now=task6a_origin_now();task6a_origin_refuse() unless $now<$deadline&&$now<$bootstrap_deadline;
    return $value;
}
sub task6a_origin_vendor_bytes {
    task6a_origin_refuse() unless @_==1;
    $producer_transport_epoch->();
    my ($kind)=@_;task6a_origin_refuse() unless defined($kind)&&!ref($kind)
        &&($kind eq 'manifest'||$kind eq 'archive');
    my $manifest=$kind eq 'manifest';
    my $url='https://nodejs.org/dist/v22.23.1/'.($manifest?'SHASUMS256.txt':'node-v22.23.1-darwin-arm64.tar.gz');
    my $limit=$manifest?1048576:134217728;my $max=$manifest?10:60;
    my $start=task6a_origin_now();my $millis=int(($bootstrap_deadline-$start)*1000);
    $millis=$max*1000 if $millis>$max*1000;task6a_origin_refuse() unless $millis>=1;
    my $seconds=$millis/1000;my $deadline=$start+$seconds;
    my $r=eval {task6a_origin_capture('/usr/bin/curl',[
        '-q','--silent','--show-error','--proto','=https','--tlsv1.2',
        '--cacert','/private/etc/ssl/cert.pem','--proxy','','--noproxy','*','--max-redirs','0',
        '--connect-timeout','5','--max-time',''.$seconds,
        '--write-out',"\n%{http_code}\n%{content_type}\n%{url_effective}",$url,
    ],$seconds,$limit+1024)};
    task6a_origin_refuse() if $@;
    $producer_transport_epoch->();
    my $now=task6a_origin_now();task6a_origin_refuse() unless $now<$deadline&&$now<$bootstrap_deadline;
    task6a_origin_refuse() unless ref($r) eq 'HASH'&&defined($r->{status})&&$r->{status}==0
        &&JSON::PP::is_bool($r->{reaped})&&$r->{reaped}&&defined($r->{err})&&$r->{err} eq ''
        &&defined($r->{out})&&!ref($r->{out})&&!utf8::is_utf8($r->{out})&&length($r->{out})<=$limit+1024;
    task6a_origin_refuse() unless $r->{out} =~ /\A(.*)\n200\n([^\n]+)\n([^\n]+)\z/s;
    my ($body,$type,$effective)=($1,$2,$3);
    task6a_origin_refuse() unless $effective eq $url&&length($body)<=$limit;
    task6a_origin_refuse() unless $manifest
        ?$type =~ /\Atext\/plain(?:;[\x20-\x7e]*)?\z/
        :$type =~ /\Aapplication\/(?:octet-stream|gzip)(?:;[\x20-\x7e]*)?\z/;
    $now=task6a_origin_now();task6a_origin_refuse() unless $now<$deadline&&$now<$bootstrap_deadline;
    return $body;
}
sub task6a_origin_get_vendor {
    task6a_origin_refuse() unless @_==0;
    my $pin='ef28d8fab2c0e4314522d4bb1b7173270aa3937e93b92cb7de79c112ac1fa953';
    my $filename='node-v22.23.1-darwin-arm64.tar.gz';
    my $manifest=task6a_origin_vendor_bytes('manifest');
    task6a_origin_refuse() unless length($manifest)>0&&$manifest =~ /\n\z/;
    my @rows=split(/\n/,$manifest,-1);pop(@rows);
    task6a_origin_refuse() unless @rows>=1&&@rows<=2000;
    my %names;my $selected;
    for my $row(@rows) {
        task6a_origin_refuse() unless $row =~ /\A([a-f0-9]{64})  ([a-zA-Z0-9][a-zA-Z0-9._\/-]{0,255})\z/;
        my ($hash,$name)=($1,$2);
        # Other release members can be canonical relative Windows paths. They
        # remain inert manifest labels: never extraction/URL/exec selections.
        my @parts=split(/\//,$name,-1);
        task6a_origin_refuse() unless @parts<=8;
        for my $part(@parts) {
            task6a_origin_refuse() unless $part =~ /\A[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}\z/;
        }
        task6a_origin_refuse() if $names{$name}++;
        $selected=$hash if $name eq $filename;
    }
    task6a_origin_refuse() unless defined($selected)&&$selected eq $pin&&task6a_origin_now()<$bootstrap_deadline;
    my $archive=task6a_origin_vendor_bytes('archive');my $hash=Digest::SHA::sha256_hex($archive);
    task6a_origin_refuse() unless $hash eq $pin&&task6a_origin_now()<$bootstrap_deadline;
    return {scope=>'vendor-transport-bytes-diagnostic-only',productionAuthority=>JSON::PP::false,
        filename=>$filename,contentSha256=>$hash,archiveBytes=>$archive};
}
sub task6a_origin_main_ref {
    my ($r)=@_;
    task6a_origin_refuse() unless task6a_origin_text(task6a_origin_field($r,'ref'),64) eq 'refs/heads/main';
    my $object=task6a_origin_field($r,'object');
    task6a_origin_refuse() unless task6a_origin_text(task6a_origin_field($object,'type'),8) eq 'commit';
    return task6a_origin_oid(task6a_origin_field($object,'sha'));
}
sub task6a_origin_observe_sources {
    task6a_origin_refuse() unless @_==0;
    # Literal owner-reviewed source policy. Final independent review/delivery
    # must bind these exact bytes; caller receipts cannot select replacements.
    my @policy=(
        ['task6a-origin-archive-v2.pm','da1fd458fcaba775be5ba09ef88157b5ee48dbda'],
        ['task6a-origin-native-v2.pm','59e1ae8de38cf2083a0294c55454083840eb47f1'],
        ['task6a-origin-map-v2.pm','9719bf4f3676b43b7858e3cabe3cee3e679120f8'],
        ['task6a-protected-origin-entry-v2.mjs','e53be63cdcdf286dc89adbec9770668b1fdb9cc7'],
    );
    my $ref='/git/ref/heads/main';
    my $main=task6a_origin_main_ref(task6a_origin_get_metadata($ref));
    my $merge=task6a_origin_verify_merge(task6a_origin_get_metadata('/git/commits/'.$main),$main);
    my $associations=task6a_origin_list(task6a_origin_get_metadata('/commits/'.$main.'/pulls?per_page=100&page=1'),99);
    my @matches;
    for my $p(@$associations) {
        my $sha=task6a_origin_field($p,'merge_commit_sha');
        next unless defined($sha);
        push(@matches,$p) if task6a_origin_oid($sha) eq $main;
    }
    task6a_origin_refuse() unless @matches==1;
    my $number=task6a_origin_size(task6a_origin_field($matches[0],'number'));
    task6a_origin_refuse() unless $number>0;
    my $pr=task6a_origin_get_metadata('/pulls/'.$number);
    my $merged=task6a_origin_field($pr,'merged');
    task6a_origin_refuse() unless task6a_origin_size(task6a_origin_field($pr,'number'))==$number
        &&task6a_origin_text(task6a_origin_field($pr,'state'),16) eq 'closed'
        &&JSON::PP::is_bool($merged)&&$merged
        &&task6a_origin_text(task6a_origin_field($pr,'merged_at'),32) =~ /\A[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z\z/
        &&task6a_origin_oid(task6a_origin_field($pr,'merge_commit_sha')) eq $main;
    my $base=task6a_origin_field($pr,'base');my $head=task6a_origin_field($pr,'head');
    task6a_origin_refuse() unless task6a_origin_text(task6a_origin_field($base,'ref'),64) eq 'main'
        &&task6a_origin_text(task6a_origin_field(task6a_origin_field($base,'repo'),'full_name'),128) eq 'hikmetgulsesli/setfarm'
        &&task6a_origin_text(task6a_origin_field(task6a_origin_field($head,'repo'),'full_name'),128) eq 'hikmetgulsesli/setfarm'
        &&task6a_origin_oid(task6a_origin_field($head,'sha')) eq $merge->{parentShas}[1];
    my $root=task6a_origin_get_metadata('/git/trees/'.$merge->{treeSha});
    task6a_origin_verify_tree($root,$merge->{treeSha});
    my @directories=grep {$_->{path} eq 'scripts'} @{$root->{tree}};
    task6a_origin_refuse() unless @directories==1&&$directories[0]{mode} eq '040000'&&$directories[0]{type} eq 'tree';
    my $directory=$directories[0]{sha};my $scripts=task6a_origin_get_metadata('/git/trees/'.$directory);
    task6a_origin_verify_tree($scripts,$directory);
    my @sources;
    for my $pin(@policy) {
        my ($name,$oid)=@$pin;my @entries=grep {$_->{path} eq $name} @{$scripts->{tree}};
        task6a_origin_refuse() unless @entries==1&&$entries[0]{mode} eq '100644'
            &&$entries[0]{type} eq 'blob'&&$entries[0]{sha} eq $oid;
        my $blob=task6a_origin_verify_blob(task6a_origin_get_metadata('/git/blobs/'.$oid),$oid);
        task6a_origin_refuse() unless $blob->{byteLength}==$entries[0]{size};
        push(@sources,{path=>'scripts/'.$name,gitBlobSha=>$oid,byteLength=>$blob->{byteLength},
            contentSha256=>$blob->{contentSha256},bytes=>$blob->{bytes}});
    }
    # Bracketed sampled ref agreement, not ABA exclusion or review attestation.
    task6a_origin_refuse() unless task6a_origin_main_ref(task6a_origin_get_metadata($ref)) eq $main;
    return {schema=>'setfarm.task6a-protected-origin-source-policy.v2',
        scope=>'merged-source-policy-diagnostic-only',productionAuthority=>JSON::PP::false,
        reviewAuthority=>JSON::PP::false,mainSha=>$main,treeSha=>$merge->{treeSha},
        headSha=>$merge->{parentShas}[1],prNumber=>$number,sources=>\@sources};
}
sub task6a_origin_main {
    task6a_origin_refuse() unless $<==0&&$>==0&&@ARGV==0;
    # Publisher and held execution components exist; final orchestration, outer
    # settlement and initial trust/startup gates still keep both entries closed.
    task6a_origin_refuse();
}
task6a_origin_main();
