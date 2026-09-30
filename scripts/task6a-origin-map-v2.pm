package Task6aOriginMapV2;
use strict;
use warnings;
use JSON::PP ();

# Complete, bounded format diagnostics only. Names, labels, apparent image
# paths and maximum permissions confer no executable-content authenticity.
sub refuse {die "TASK6A_ORIGIN_MAP_REFUSED\n";}
sub absolute_path {
    my ($path)=@_;
    refuse() unless defined($path)&&length($path)<=4096&&$path =~ /\A\/[\x20-\x7e]+\z/;
    refuse() if $path =~ /[\x20]\z/;
    my @parts=split('/',substr($path,1),-1);
    refuse() if grep {$_ eq ''||$_ eq '.'||$_ eq '..'} @parts;
    return $path;
}
sub metric {
    my ($text)=@_;
    refuse() unless $text =~ /\A(0|[1-9][0-9]{0,11})(\.[0-9])?([KMGT])?\z/;
    my ($whole,$fraction,$unit)=($1,$2,$3);
    refuse() if defined($fraction)&&!defined($unit);
    my %power=(K=>1,M=>2,G=>3,T=>4);
    my $value=(0+$whole)+(defined($fraction)?0+$fraction:0);
    $value*=1024**$power{$unit} if defined($unit);
    refuse() if $value>281474976710655;
    return $text; # Rounded display metrics are not exact address lengths.
}
sub address {
    my ($text)=@_;
    refuse() unless $text =~ /\A[1-9a-f][0-9a-f]{0,11}\z/;
    return hex($text) if length($text)<=6;
    return hex(substr($text,0,-6))*16777216+hex(substr($text,-6));
}
sub decimal {
    my ($text,$limit)=@_;
    refuse() unless $text =~ /\A(?:0|[1-9][0-9]{0,9})\z/&&$text<=$limit;
    return 0+$text;
}
sub parse_map_v2 {
    refuse() unless @_==2;
    my ($raw,$pid)=@_;
    refuse() if !defined($raw)||ref($raw)||utf8::is_utf8($raw)||!length($raw)
        ||length($raw)>1048576||$raw !~ /\n\z/||$raw =~ /[^\x09\x0a\x20-\x7e]/;
    refuse() if !defined($pid)||ref($pid)||$pid !~ /\A[1-9][0-9]{0,9}\z/||$pid>2147483647;
    my @lines=split(/\n/,$raw,-1);pop @lines;
    refuse() if @lines>8192;
    s/ +\z// for @lines; # vmmap pads complete lines to the table width.
    my $cursor=0;
    my $next=sub {refuse() if $cursor>=@lines;return $lines[$cursor++];};
    my $exact=sub {my ($want)=@_;refuse() unless $next->() eq $want;};
    my $header=sub {
        my ($label,$pattern)=@_;my $line=$next->();
        refuse() unless $line =~ /\A\Q$label\E: +($pattern)\z/;return $1;
    };
    my $process=$header->('Process',qr/[A-Za-z0-9_.-]{1,128} \[[1-9][0-9]{0,9}\]/);
    refuse() unless $process =~ /\A([A-Za-z0-9_.-]+) \[\Q$pid\E\]\z/;
    my $name=$1;
    my $image_path=absolute_path($header->('Path',qr/[\x20-\x7e]{1,4096}/));
    my $load=address(substr($header->('Load Address',qr/0x[1-9a-f][0-9a-f]{0,11}/),2));
    $header->('Identifier',qr/[\x21-\x7e]{1,256}/);
    $header->('Version',qr/[\x20-\x7e]{1,128}/);
    $header->('Code Type',qr/ARM64E?/);
    $header->('Platform',qr/macOS/);
    my $parent=$header->('Parent Process',qr/[A-Za-z0-9_.-]{1,128} \[(?:0|[1-9][0-9]{0,9})\]/);
    $parent =~ /\[([0-9]+)\]\z/;decimal($1,2147483647);
    $header->('Target Type',qr/live task/);
    $exact->('');
    my $date=qr/[0-9]{4}-(?:0[1-9]|1[012])-(?:0[1-9]|[12][0-9]|3[01]) (?:[01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]\.[0-9]{3} [+-][0-9]{4}/;
    $header->('Date/Time',$date);$header->('Launch Time',$date);
    $header->('OS Version',qr/macOS [0-9]{1,3}(?:\.[0-9]{1,3}){1,2} \([A-Za-z0-9]{1,32}\)/);
    $header->('Report Version',qr/7/);$header->('Analysis Tool',qr/\/usr\/bin\/vmmap/);
    $exact->('');
    metric($header->('Physical footprint',qr/[0-9.KMGT]+/));
    metric($header->('Physical footprint (peak)',qr/[0-9.KMGT]+/));
    $header->('Idle exit',qr/untracked/);$exact->('----');$exact->('');
    $exact->("Virtual Memory Map of process $pid ($name)");
    $exact->('Output report format:  2.4  -- 64-bit process');
    $exact->('VM page size:  16384 bytes');
    $exact->('Collected with PhysFootprint mode enabled');$exact->('');
    $exact->("==== regions for process $pid  (non-writable and writable regions are interleaved)");
    $exact->('REGION TYPE                    START - END         [ VSIZE  RSDNT  DIRTY   SWAP] PRT/MAX SHRMOD PURGE    REGION DETAIL');
    my %types=map {$_=>1} ('__TEXT','__DATA_CONST','__DATA','__LINKEDIT','__AUTH',
        '__AUTH_CONST','__DATA_DIRTY','__OBJC_RO','__OBJC_RW','__TPRO_CONST',
        'Kernel Alloc Once','shared memory','MALLOC guard page','MALLOC metadata',
        'MALLOC_NANO metadata','MALLOC_TINY','MALLOC_SMALL','STACK GUARD','Stack',
        'unused __DATA','unused __TEXT','unused __DATA_DIRTY','unused __AUTH','page table in kernel');
    my (@regions,%counts,%zone_references);my $previous_end=0;my $kernel_seen=0;
    my ($current_count,$potential_count,$anonymous_count)=(0,0,0);
    while($cursor<@lines&&$lines[$cursor] ne '') {
        refuse() if @regions>=4096;
        my $line=$next->();
        refuse() unless $line =~ /\A(.+?) +([0-9a-f]+-[0-9a-f]+|kernel-kernel) +\[ *([^\]]+)\] +([r-][w-][x-])\/([r-][w-][x-]) +SM=(COW|PRV|NUL|ALI|SHM|ZER|S\/A)(?: +(.*))?\z/;
        my ($type,$range,$metrics,$current,$maximum,$sharing,$detail)=($1,$2,$3,$4,$5,$6,$7//'');
        refuse() unless $types{$type}||$type =~ /\AMemory Tag (?:[1-9][0-9]{0,2})\z/&&substr($type,11)<=255;
        my @metrics=split(/ +/,$metrics);refuse() unless @metrics==4;metric($_) for @metrics;
        for my $bit (0..2) {refuse() if substr($current,$bit,1) ne '-'&&substr($maximum,$bit,1) eq '-';}
        my $region={type=>$type,currentProtection=>$current,maximumProtection=>$maximum,
            sharingMode=>$sharing,metrics=>\@metrics,kernel=>JSON::PP::false};
        if($range eq 'kernel-kernel') {
            refuse() if $type ne 'page table in kernel'||$kernel_seen++||$detail ne 'charged to process physical footprint';
            $region->{kernel}=JSON::PP::true;
        } else {
            refuse() if $kernel_seen||$type eq 'page table in kernel';
            my ($start,$end)=map {address($_)} split(/-/,$range);
            refuse() if $start>=$end||$start<$previous_end;$previous_end=$end;
            $region->{start}=$start;$region->{end}=$end;
            if($detail =~ s/\A([VNE]) +//) {$region->{purgeableMode}=$1;}
            if($type =~ /\Aunused /) {
                refuse() unless $detail =~ /\Aon dirty page  unused (.+)\z/;
                my $unused=$1;
                if($unused ne 'system shared lib __DATA') {$region->{unusedPath}=absolute_path($unused);}
            }
            elsif($detail =~ /\A\//) {refuse() unless $type =~ /\A__/;$region->{path}=absolute_path($detail);}
            elsif($detail eq '') {}
            elsif($detail =~ /\A(DefaultMallocZone_0x[1-9a-f][0-9a-f]{0,11})\z/) {
                refuse() unless $type =~ /\AMALLOC(?: metadata|_NANO metadata|_TINY|_SMALL)\z/;
                address(substr($detail,20));++$zone_references{$detail};
            } elsif($detail =~ /\Astack guard for thread (?:0|[1-9][0-9]{0,5})\z/) {refuse() unless $type eq 'STACK GUARD';}
            elsif($detail =~ /\Athread (?:0|[1-9][0-9]{0,5})\z/) {refuse() unless $type eq 'Stack';}
            elsif($detail eq 'dyld shared cache combined __LINKEDIT') {refuse() unless $type eq '__LINKEDIT';}
            else {refuse();}
        }
        $region->{detail}=$detail;
        my $executable=index($current,'x')>=0;my $potential=$executable||index($maximum,'x')>=0;
        $region->{currentExecutable}=$executable?JSON::PP::true:JSON::PP::false;
        $region->{potentialExecutable}=$potential?JSON::PP::true:JSON::PP::false;
        ++$current_count if $executable;++$potential_count if $potential;
        ++$anonymous_count if $potential&&!exists($region->{path});
        my $category=$type =~ /\Aunused /?'unused but dirty shlib __DATA':$type;
        ++$counts{$category};push @regions,$region;
    }
    refuse() unless @regions&&$kernel_seen==1;
    refuse() unless 1==grep { !$_->{kernel}&&$_->{type} eq '__TEXT'
        &&$_->{start}==$load&&defined($_->{path})&&$_->{path} eq $image_path } @regions;
    $exact->('');$exact->('==== Legend');$exact->('SM=sharing mode:');
    $exact->("\tCOW=copy_on_write PRV=private NUL=empty ALI=aliased");
    $exact->("\tSHM=shared ZER=zero_filled S/A=shared_alias");
    $exact->('PURGE=purgeable mode:');
    $exact->("\tV=volatile N=nonvolatile E=empty   otherwise is unpurgeable");$exact->('');
    $exact->("==== Summary for process $pid");
    my $metric=qr/(?:0|[1-9][0-9]{0,11})(?:\.[0-9])?[KMGT]?/;
    my $percent=qr/(?:0|[1-9][0-9]?|100)/;
    my $ro=$next->();
    refuse() unless $ro =~ /\AReadOnly portion of Libraries: Total=($metric) resident=($metric)\(($percent)%\) swapped_out_or_unallocated=($metric)\(($percent)%\)\z/;
    metric($1);metric($2);metric($4);
    my $rw=$next->();
    refuse() unless $rw =~ /\AWritable regions: Total=($metric) written=($metric)\(($percent)%\) resident=($metric)\(($percent)%\) swapped_out=($metric)\(($percent)%\) unallocated=($metric)\(($percent)%\)\z/;
    metric($_) for ($1,$2,$4,$6,$8);
    $exact->('');
    $exact->('                                VIRTUAL RESIDENT    DIRTY  SWAPPED VOLATILE   NONVOL    EMPTY   REGION');
    $exact->('REGION TYPE                        SIZE     SIZE     SIZE     SIZE     SIZE     SIZE     SIZE    COUNT (non-coalesced)');
    my $separator='===========                     ======= ========    =====  ======= ========   ======    =====  =======';
    $exact->($separator);my %summaries;
    while($cursor<@lines&&$lines[$cursor] ne $separator) {
        refuse() if keys(%summaries)>=64;
        my $line=$next->();
        refuse() unless $line =~ /\A(.+?) +((?:$metric +){7})([1-9][0-9]{0,3})(?: +(see MALLOC ZONE table below))?\z/;
        my ($type,$values,$count,$tail)=($1,$2,$3,$4);
        refuse() if !exists($counts{$type})||$summaries{$type}++||decimal($count,4096)!=$counts{$type};
        refuse() if defined($tail)&&$type !~ /\AMALLOC_(?:NANO metadata|SMALL|TINY)\z/;
        metric($_) for split(/ +/,$values);
    }
    refuse() unless keys(%summaries)==keys(%counts);$exact->($separator);
    my $total=$next->();
    refuse() unless $total =~ /\ATOTAL +((?:$metric +){7})([1-9][0-9]{0,3})\z/;
    my ($total_values,$total_count)=($1,$2);metric($_) for split(/ +/,$total_values);
    refuse() unless decimal($total_count,4096)==@regions;$exact->('');
    $exact->('                                 VIRTUAL   RESIDENT      DIRTY    SWAPPED ALLOCATION      BYTES DIRTY+SWAP          REGION');
    $exact->('MALLOC ZONE                         SIZE       SIZE       SIZE       SIZE      COUNT  ALLOCATED  FRAG SIZE  % FRAG   COUNT');
    $exact->('===========                      =======  =========  =========  =========  =========  =========  =========  ======  ======');
    my %zones;
    while($cursor<@lines&&$lines[$cursor] ne '') {
        refuse() if keys(%zones)>=32;
        my $line=$next->();
        refuse() unless $line =~ /\A(DefaultMallocZone_0x[1-9a-f][0-9a-f]{0,11}) +((?:$metric +){4})((?:0|[1-9][0-9]{0,9})) +($metric) +($metric) +($percent)% +([1-9][0-9]{0,3})\z/;
        my ($zone,$values,$allocations,$allocated,$fragment,$percentage,$count)=($1,$2,$3,$4,$5,$6,$7);
        refuse() if $zones{$zone}++||!exists($zone_references{$zone});
        metric($_) for split(/ +/,$values);metric($allocated);metric($fragment);
        decimal($allocations,1000000000);refuse() unless decimal($count,4096)==$zone_references{$zone};
    }
    refuse() unless keys(%zones)&&keys(%zones)==keys(%zone_references);
    refuse() if @lines-$cursor>4;
    $exact->('') while $cursor<@lines;
    return {scope=>'complete-map-format-diagnostic-only',productionAuthority=>JSON::PP::false,
        regionCount=>scalar(@regions),regions=>\@regions,currentExecutableCount=>$current_count,
        potentialExecutableCount=>$potential_count,anonymousPotentialExecutableCount=>$anonymous_count,
        processPath=>$image_path};
}
1;
