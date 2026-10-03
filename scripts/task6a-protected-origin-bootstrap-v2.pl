BEGIN {
    @INC=('/System/Library/Perl/5.34/darwin-thread-multi-2level',
        '/System/Library/Perl/5.34');
}
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

# No production initializer: only a future separately admitted launcher may
# establish custody. Ordinary tests initialize a uniquely anchored memory copy.
my ($parent_admission,$parent_original_admission,$parent_original_pid);
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
    for my $index(0..$#parent_originals) {
        next unless defined($parent_originals[$index]);
        next if $parent_definitely_closed[$index];
        if($parent_close_attempted[$index]) {$closed=0;next;}
        my $ok=eval {$parent_close->($index);1;};my $error=$@;
        $closed=0 unless $ok&&!length($error)&&$parent_definitely_closed[$index];
    }
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
    $parent_cleanup_complete=$closed&&(!$parent_authenticated||($parent_reaped&&!$parent_uncertain));
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
sub task6a_origin_consume_entry_protocol {
    my $arity=@_;my $diagnostic;
    my $ok=eval {
        task6a_origin_parent_require_unburned();
        task6a_origin_refuse() unless $arity==0&&$parent_phase eq 'absent'&&@parent_originals==4;
        $parent_check_admission->();
        $parent_recheck_originals->();$parent_authenticated=1;$parent_phase='starting';
        $parent_start=task6a_origin_now();$parent_deadline=$parent_start+45;
        $parent_deadline=$bootstrap_deadline if $bootstrap_deadline<$parent_deadline;
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
                    $parent_write->("END\n",1);$parent_end_written=1;
                    $parent_close->(0);$parent_phase='ending';$parent_epoch->();
                } else {
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
}

sub task6a_origin_helpers_settled {
    task6a_origin_refuse() unless @_==0;
    return JSON::PP::false if $helper_lifecycle_burned;
    for my $record(@helper_ledger) {return JSON::PP::false unless $record->{settled};}
    return JSON::PP::true;
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
    task6a_origin_refuse() unless defined($fh)&&defined(fileno($fh));
    task6a_origin_file_identity($record->{identity},[stat($fh)]);
    task6a_origin_file_identity($record->{identity},[lstat($record->{path})]);
    my $position=sysseek($fh,0,0);
    task6a_origin_refuse() unless defined($position)&&$position==0;
    my $digest=Digest::SHA->new(256);my $length=0;
    while(1) {
        task6a_origin_refuse() unless task6a_origin_now()<$bootstrap_deadline;
        my $bytes='';my $n=sysread($fh,$bytes,65536);
        task6a_origin_refuse() unless defined($n);
        last if $n==0;
        $length+=$n;task6a_origin_refuse() if $length>$record->{identity}[7];
        $digest->add($bytes);
    }
    task6a_origin_refuse() unless $length==$record->{identity}[7]&&$digest->hexdigest eq $record->{sha256};
    task6a_origin_file_identity($record->{identity},[stat($fh)]);
    task6a_origin_file_identity($record->{identity},[lstat($record->{path})]);
    task6a_origin_refuse() unless task6a_origin_now()<$bootstrap_deadline;
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
        sysopen(my $fh,$path,Fcntl::O_RDONLY()|Fcntl::O_NOFOLLOW()|Fcntl::O_NONBLOCK()) or task6a_origin_refuse();
        push(@physical_owned_handles,$fh) if $physical_owns_ledgers&&$physical_internal;
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
    task6a_origin_refuse() unless defined($fh)&&defined(fileno($fh))&&task6a_origin_now()<$bootstrap_deadline;
    task6a_origin_directory_identity($record->{identity},[stat($fh)]);
    task6a_origin_directory_identity($record->{identity},[lstat($record->{path})]);
    task6a_origin_acl_free($record->{path});
    task6a_origin_directory_identity($record->{identity},[stat($fh)]);
    task6a_origin_directory_identity($record->{identity},[lstat($record->{path})]);
    task6a_origin_refuse() unless task6a_origin_now()<$bootstrap_deadline;
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
            sysopen(my $fh,$parent,Fcntl::O_RDONLY()|Fcntl::O_NOFOLLOW()|Fcntl::O_DIRECTORY()) or task6a_origin_refuse();
            push(@physical_owned_handles,$fh) if $physical_owns_ledgers&&$physical_internal;
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
    return $physical_cleanup_ok if $physical_cleanup_attempted;
    return 0 unless $physical_owns_ledgers;
    $physical_cleanup_attempted=1;
    $file_lifecycle_released=1;
    # Capture handle ownership immediately after each successful open, before
    # any subsequent fallible check. Never adopt a contaminated live ledger.
    for my $fh(@physical_owned_handles) {
        my $closed=eval {defined(fileno($fh))&&close($fh)};
        $file_lifecycle_burned=1 unless $closed&&!$@;
    }
    $physical_cleanup_ok=$file_lifecycle_burned?0:1;
    return $physical_cleanup_ok;
}
sub task6a_origin_physical_fail {
    $physical_state='burned' unless $physical_state eq 'released';
    $file_lifecycle_burned=1 if $physical_owns_ledgers;
    task6a_origin_physical_cleanup();
    task6a_origin_refuse();
}
sub task6a_origin_guard_raw_physical {
    task6a_origin_physical_fail() if $physical_owns_ledgers&&!$physical_internal;
}
sub task6a_origin_physical_records {
    return 0 unless @file_ledger==1&&@directory_ledger==3&&@physical_directories==3
        &&defined($physical_file)&&$file_ledger[0]==$physical_file
        &&$physical_file->{path} eq '/usr/bin/perl';
    my @paths=('/','/usr','/usr/bin');
    for my $index(0..2) {
        return 0 unless $directory_ledger[$index]==$physical_directories[$index]
            &&$directory_ledger[$index]{path} eq $paths[$index];
    }
    return 1;
}
sub task6a_origin_recheck_system_perl_physical {
    my $ok=eval {
        task6a_origin_refuse() unless @_==0&&$physical_state eq 'active'
            &&$physical_owns_ledgers&&!$physical_internal&&!$file_lifecycle_burned
            &&!$file_lifecycle_released&&task6a_origin_physical_records()
            &&task6a_origin_helpers_settled()&&task6a_origin_now()<$bootstrap_deadline;
        task6a_origin_recheck_ancestry();
        task6a_origin_recheck_files();
        task6a_origin_acl_free('/usr/bin/perl');
        task6a_origin_recheck_files();
        task6a_origin_recheck_ancestry();
        task6a_origin_refuse() unless task6a_origin_physical_records()
            &&task6a_origin_helpers_settled()&&task6a_origin_now()<$bootstrap_deadline;
        1;
    };
    task6a_origin_physical_fail() unless $ok;
    return {scope=>'composed-system-perl-physical-candidate-diagnostic-only',
        productionAuthority=>JSON::PP::false,fileCount=>1,directoryCount=>3};
}
sub task6a_origin_hold_system_perl_physical {
    task6a_origin_physical_fail() unless @_==0&&$physical_state eq 'new'
        &&!$file_lifecycle_burned&&!$file_lifecycle_released
        &&@file_ledger==0&&@directory_ledger==0;
    $physical_state='starting';
    $physical_owns_ledgers=1;
    $physical_internal=1;
    my $ok=eval {
        task6a_origin_refuse() unless task6a_origin_helpers_settled()
            &&task6a_origin_now()<$bootstrap_deadline;
        task6a_origin_hold_ancestry('/usr/bin/perl');
        task6a_origin_acl_free('/usr/bin/perl');
        task6a_origin_hold_file('/usr/bin/perl',
            'abda2bfd23a6c9a8e57adf2291f0aea4abd8faf440558ee49fe4ced55e8d9ad0',0755,1048576);
        $physical_file=$file_ledger[0];
        @physical_directories=@directory_ledger;
        $physical_internal=0;
        $physical_state='active';
        task6a_origin_recheck_system_perl_physical();
        1;
    };
    $physical_internal=0;
    task6a_origin_physical_fail() unless $ok;
    return {scope=>'composed-system-perl-physical-candidate-diagnostic-only',
        productionAuthority=>JSON::PP::false,fileCount=>1,directoryCount=>3};
}
sub task6a_origin_release_system_perl_physical {
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
}
sub task6a_origin_shutdown_helper {
    my ($pid,$reaped,$uncertain,$status)=@_;
    # Burned shutdown-only budget, never source/origin validity renewal.
    for my $phase([0,5],['TERM',2],['KILL',2]) {
        task6a_origin_poll($pid,$reaped,$uncertain,$status);
        return if $$reaped||$$uncertain;
        if($phase->[0]) {
            unless(kill($phase->[0],$pid)==1) {
                task6a_origin_poll($pid,$reaped,$uncertain,$status);
                $$uncertain=1 unless $$reaped;return;
            }
        }
        my $end=task6a_origin_now()+$phase->[1];
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
    for my $fh(@handles) {if(defined(fileno($fh))) {$close_ok=0 unless close($fh);}}
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
    # The source publisher and held execution path are not implemented yet.
    # Keep both ordinary and privileged invocation closed until their TDD gates.
    task6a_origin_refuse();
}
task6a_origin_main();
