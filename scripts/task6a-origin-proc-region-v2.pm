package Task6aOriginProcRegionV2;
use strict;
use warnings;
use Config ();
use JSON::PP ();

# Pure SDK ABI diagnostics, not recursive map completeness or code origin.
sub refuse { die "TASK6A_ORIGIN_PROC_REGION_REFUSED\n"; }
sub decode_region_v2 {
    refuse() unless @_==2 && $Config::Config{ivsize}==8;
    my ($raw,$query)=@_;
    refuse() if !defined($raw)||ref($raw)||utf8::is_utf8($raw)||length($raw)!=96;
    refuse() if !defined($query)||ref($query)||$query !~ /\A(?:0|[1-9][0-9]{0,14})\z/
        ||$query>281474976710655;
    $query=0+$query;
    my @head=unpack('V4',substr($raw,0,16));
    my $offset=unpack('Q<',substr($raw,16,8));
    my @body=unpack('V14',substr($raw,24,56));
    my ($address,$size)=unpack('Q<2',substr($raw,80,16));
    refuse() if $head[0]>7||$head[1]>7||($head[0]&$head[1])!=$head[0];
    refuse() if $head[3]>3||$body[13]!=0||$body[2]==4294967295||$body[9]>8;
    # Bound operands before addition: admitted integer sums cannot overflow.
    refuse() if $address>281474976710655||!$size||$size>281474976710656;
    my $end=$address+$size;
    refuse() if $end>281474976710656||$end<=$query;
    my @names=qw(behavior userWiredCount userTag pagesResident pagesSharedNowPrivate
        pagesSwappedOut pagesDirtied referenceCount shadowDepth shareMode
        privatePagesResident sharedPagesResident objectId depth);
    my %fields;@fields{@names}=@body;
    return {
        %fields,scope=>'proc-region-abi-diagnostic-only',
        completeNativeClosure=>JSON::PP::false,productionAuthority=>JSON::PP::false,
        protection=>$head[0],maximumProtection=>$head[1],inheritance=>$head[2],flags=>$head[3],
        offsetHex=>sprintf('%016x',$offset),address=>$address,size=>$size,end=>$end,
        submap=>($head[3]&1)?JSON::PP::true:JSON::PP::false,
        shared=>($head[3]&2)?JSON::PP::true:JSON::PP::false,
        currentExecutable=>($head[0]&4)?JSON::PP::true:JSON::PP::false,
        potentialExecutable=>($head[1]&4)?JSON::PP::true:JSON::PP::false,
    };
}
1;
