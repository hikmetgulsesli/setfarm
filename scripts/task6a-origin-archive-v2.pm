package Task6aOriginArchiveV2;
use strict;
use warnings;
use IO::Uncompress::Gunzip ();

# Pure bounded bytes only; caller input/output cannot grant vendor or origin
# authority. The admitted publisher owns HTTPS, policy and protected publication.
my $MEMBER='node-v22.23.1-darwin-arm64/bin/node';
sub refuse { die "TASK6A_ORIGIN_ARCHIVE_REFUSED\n"; }
sub octal {
    my ($value)=@_;
    refuse() unless $value =~ /\A *([0-7]+)[ \0]*\z/;
    my $digits=$1;refuse() if length($digits)>12;
    return oct($digits);
}
sub string_field {
    my ($value)=@_;
    my $zero=index($value,"\0");
    if($zero>=0) {
        refuse() if substr($value,$zero) =~ /[^\0]/;
        $value=substr($value,0,$zero);
    }
    return $value;
}
sub decimal {
    my ($value)=@_;
    refuse() unless $value =~ /\A(?:0|[1-9][0-9]{0,8})\z/;
    refuse() if $value>536870912;
    return 0+$value;
}
sub pax {
    my ($bytes)=@_;my %values;my $count=0;
    while(length($bytes)) {
        refuse() unless $bytes =~ /\A([1-9][0-9]{0,6}) /;
        my $size=0+$1;refuse() if $size>length($bytes);
        my $record=substr($bytes,0,$size,'');
        refuse() unless $record =~ /\A([1-9][0-9]*) ([A-Za-z0-9_.]+)=([^\r\0\n]*)\n\z/;
        my ($declared,$key,$value)=($1,$2,$3);
        refuse() if $declared!=length($record)||++$count>4096||exists($values{$key});
        refuse() unless $key =~ /\A(?:path|linkpath|size|mtime|atime|ctime|uid|gid|uname|gname)\z/;
        refuse() if ($key eq 'path'||$key eq 'linkpath')&&!length($value);
        decimal($value) if $key eq 'size';
        $values{$key}=$value;
    }
    return \%values;
}
sub extract_node_v2 {
    refuse() unless @_==1;
    my ($compressed)=@_;
    refuse() if !defined($compressed)||ref($compressed)||utf8::is_utf8($compressed)
        ||length($compressed)>134217728;
    my $result;my $ok=eval {
        open(my $input,'<',\$compressed) or refuse();binmode($input) or refuse();
        my $gzip=IO::Uncompress::Gunzip->new($input,Transparent=>0,MultiStream=>0,Strict=>1)
            or refuse();
        my $total=0;
        my $read=sub {
            my ($wanted)=@_;my $bytes='';my $count=$gzip->read($bytes,$wanted);
            refuse() if !defined($count)||$count<0;
            $total+=$count;refuse() if $total>536870912;
            return $bytes;
        };
        my $exact=sub {
            my ($wanted)=@_;my $bytes='';
            while(length($bytes)<$wanted) {
                my $part=$read->($wanted-length($bytes)>65536?65536:$wanted-length($bytes));
                refuse() unless length($part);$bytes.=$part;
            }
            return $bytes;
        };
        my $skip=sub {
            my ($wanted)=@_;
            while($wanted) {my $n=$wanted>65536?65536:$wanted;$exact->($n);$wanted-=$n;}
        };
        my %local;my %global;my $local_pending=0;my $members=0;my $selected=0;
        while(1) {
            my $header=$exact->(512);
            if($header eq "\0"x512) {
                refuse() unless $exact->(512) eq "\0"x512;
                refuse() if $local_pending;
                my $tail=0;
                while(1) {
                    my $bytes=$read->(65536);last unless length($bytes);
                    $tail+=length($bytes);refuse() if $tail>1048576||$bytes =~ /[^\0]/;
                }
                last;
            }
            refuse() if ++$members>20000;
            my $checksum=octal(substr($header,148,8));
            my $checked=$header;substr($checked,148,8)=' 'x8;
            refuse() if unpack('%32C*',$checked)!=$checksum;
            my $magic=substr($header,257,8);
            refuse() unless $magic eq "ustar\00000"||$magic eq "ustar  \0";
            my $name=string_field(substr($header,0,100));
            my $prefix=$magic eq "ustar\00000"?string_field(substr($header,345,155)):'';
            $name=$prefix.'/'.$name if length($prefix);
            refuse() unless length($name);
            my $type=substr($header,156,1);$type='0' if $type eq "\0";
            refuse() unless $type =~ /\A[0-7xgLK]\z/;
            my $size=octal(substr($header,124,12));
            refuse() if $size>536870912;
            my $extension=$type =~ /\A[xgLK]\z/;
            if($extension) {
                $local_pending=1 if $type ne 'g';
                refuse() if $size>1048576;
                my $bytes=$exact->($size);
                if($type eq 'x'||$type eq 'g') {
                    my $attrs=pax($bytes);
                    refuse() if $type eq 'g'&&grep {exists($attrs->{$_})} qw(path linkpath size);
                    my $target=$type eq 'g'?\%global:\%local;
                    for my $key(keys %$attrs) {refuse() if exists($target->{$key});$target->{$key}=$attrs->{$key};}
                } else {
                    my $key=$type eq 'L'?'path':'linkpath';
                    refuse() if exists($local{$key})||$bytes !~ /\A[^\r\n\0]+\0\z/;
                    $local{$key}=substr($bytes,0,-1);
                }
            } else {
                my %attrs=(%global,%local);%local=();$local_pending=0;
                $name=$attrs{path} if exists($attrs{path});
                $size=decimal($attrs{size}) if exists($attrs{size});
                if($name eq $MEMBER) {
                    refuse() if ++$selected>1||$type ne '0'||$size>134217728
                        ||length(string_field(substr($header,157,100)))||exists($attrs{linkpath});
                    $result=$exact->($size);
                } else {$skip->($size);}
            }
            my $padding=(512-$size%512)%512;
            refuse() if $exact->($padding) =~ /[^\0]/;
        }
        refuse() if $selected!=1||!defined($result)||length($gzip->trailingData())
            ||tell($input)!=length($compressed);
        $gzip->close() or refuse();close($input) or refuse();
        1;
    };
    refuse() unless $ok;
    return $result;
}
1;
