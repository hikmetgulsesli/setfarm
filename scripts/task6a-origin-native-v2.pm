package Task6aOriginNativeV2;
use strict;
use warnings;
use JSON::PP ();

# Pure static byte policy only. Vendor identity, protection, execution and
# loaded-image lifetime belong to the independent admitted parent.
sub refuse {die "TASK6A_ORIGIN_NATIVE_REFUSED\n";}
sub assert_node_native_v2 {
    refuse() unless @_==1;
    my ($bytes)=@_;
    refuse() if !defined($bytes)||ref($bytes)||utf8::is_utf8($bytes)
        ||length($bytes)<32||length($bytes)>134217728;
    my ($magic,$cpu,$subtype,$type,$count,$table,$flags,$reserved)=unpack('L<8',substr($bytes,0,32));
    refuse() if $magic!=0xfeedfacf||$cpu!=0x0100000c||$subtype!=0||$type!=2||$reserved!=0
        ||$count>4096||$table>16777216||$table<$count*8||$table>length($bytes)-32;
    my %loads=map {$_=>1} (0xc,0x80000018,0x8000001f,0x80000023,0x20);
    # Exact structures from Apple's mach-o/loader.h, not a generic opaque
    # command allowlist. Variable-sized segment/build/string tails below.
    my %fixed=(0x2=>24,0xb=>80,0x16=>16,0x1a=>72,0x1b=>24,
        0x1d=>16,0x1e=>16,0x22=>48,0x80000022=>48,0x24=>16,
        0x26=>16,0x80000028=>24,0x29=>16,0x2a=>16,0x2b=>16,
        0x2e=>16,0x31=>40,0x80000033=>16,0x80000034=>16,
        0x36=>16,0x37=>16,0x38=>16);
    my $cursor=32;my $end=32+$table;my @dependencies;my $linker;
    for(1..$count) {
        refuse() if $cursor+8>$end;
        my ($cmd,$size)=unpack('L<2',substr($bytes,$cursor,8));
        refuse() if $size<8||$size%8||$size>$end-$cursor;
        if($loads{$cmd}||$cmd==0xe||$cmd==0x39) {
            my $minimum=$loads{$cmd}?24:12;
            refuse() if $size<$minimum+1;
            my $offset=unpack('L<',substr($bytes,$cursor+8,4));
            refuse() if $offset<$minimum||$offset>=$size;
            if($loads{$cmd}) {
                my $timestamp=unpack('L<',substr($bytes,$cursor+12,4));
                refuse() if $timestamp==0x1a741800;
            }
            my $zero=index($bytes,"\0",$cursor+$offset);
            refuse() if $zero<0||$zero>=$cursor+$size;
            my $name=substr($bytes,$cursor+$offset,$zero-$cursor-$offset);
            refuse() if length($name)>1024||$name !~ /\A[\x21-\x7e]+\z/;
            if($cmd==0xe) {
                refuse() if defined($linker)||$name ne '/usr/lib/dyld';$linker=$name;
            } elsif($loads{$cmd}) {
                refuse() unless $name =~ /\A(?:\/usr\/lib\/|\/System\/Library\/)/;
                my @segments=split('/',substr($name,1),-1);
                refuse() if grep {$_ eq ''||$_ eq '.'||$_ eq '..'} @segments;
                push(@dependencies,$name);
            }
        } elsif($cmd==0x19) {
            refuse() if $size<72;
            my $sections=unpack('L<',substr($bytes,$cursor+64,4));
            refuse() if $sections>4096||$size!=72+80*$sections;
        } elsif($cmd==0x32) {
            refuse() if $size<24;
            my $platform=unpack('L<',substr($bytes,$cursor+8,4));
            my $tools=unpack('L<',substr($bytes,$cursor+20,4));
            refuse() if $platform!=1||$tools>4096||$size!=24+8*$tools;
        } else {refuse() unless exists($fixed{$cmd})&&$size==$fixed{$cmd};}
        $cursor+=$size;
    }
    refuse() if $cursor!=$end||!defined($linker);
    return {fileType=>$type,dynamicLinker=>$linker,systemDependencies=>\@dependencies,
        productionAuthority=>JSON::PP::false};
}
1;
