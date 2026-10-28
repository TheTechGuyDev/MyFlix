\set ON_ERROR_STOP 0
insert into auth.users (id, email, raw_user_meta_data) values
 ('11111111-1111-1111-1111-111111111111', 'ada@test.com', '{}'),
 ('22222222-2222-2222-2222-222222222222', 'bob@test.com', '{"ref":"NAIJAABCDEF"}'),
 ('33333333-3333-3333-3333-333333333333', 'staff@myflix.ng', '{}');
select email, status, referral_code, referred_by from accounts order by email;
insert into staff (user_id, name, email, role_id) values ('33333333-3333-3333-3333-333333333333', 'Owner', 'staff@myflix.ng', 'super');
delete from titles; insert into titles (id, title, type, status) values ('eko-nights', 'Eko Nights', 'series', 'published'), ('draft-one', 'Draft', 'movie', 'draft');
insert into promos (code, label, kind, value) values ('WELCOME50', '50% off', 'percent', 50);

-- ===== as Ada (member)
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select set_config('request.jwt.claim.role', 'authenticated', false);
select set_config('request.jwt.claims', '{"aal":"aal1"}', false);
\echo -- member sees only own account:
select count(*) as accounts_visible from accounts;
\echo -- member tries to make herself active (expect error):
update accounts set status = 'active', paid_until = now() + interval '1 year' where id = auth.uid();
\echo -- member can change notification prefs:
update accounts set notifications = '{"push": false}' where id = auth.uid();
\echo -- titles visible to member (expect 1):
select id from titles;
insert into viewer_profiles (account_id, name) values (auth.uid(), 'Ada') returning id \gset
select set_profile_pin(:'id', '1234');
select check_profile_pin(:'id', '1234') as pin_ok, check_profile_pin(:'id', '0000') as pin_bad;
\echo -- read pins table (expect permission error):
select * from profile_pins;
select my_quote('standard', 'annual', 'WELCOME50') as quote;
select claim_stream('s1', :'id', 'Chrome', 'eko-nights') as before_pay;
\echo -- member tries to insert payment (expect error):
insert into payments (email, reference, amount) values ('x', 'r', 1);
\echo -- member tries to read promos (expect 0 / error):
select * from promos;
\echo -- staff_can as member:
select staff_can('content');
reset role;

-- service role activates Ada on standard (2 screens)
update accounts set status='active', plan_id='standard', paid_until=now()+interval '30 days' where email='ada@test.com';

set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select claim_stream('s1', :'id', 'Chrome', 'eko-nights')->>'ok' as s1, claim_stream('s2', :'id', 'Phone', 'eko-nights')->>'ok' as s2, claim_stream('s3', :'id', 'TV', 'eko-nights') as s3;
select stop_stream('s1'); select claim_stream('s1', :'id', 'Chrome', 'eko-nights')->>'reason' as s1_after_stop;
select claim_stream('s3', :'id', 'TV', 'eko-nights')->>'ok' as s3_after_free;
select create_ticket('Billing', 'Card charged twice', 'Please help') as ticket;
select count(*) as my_tickets from tickets;
\echo -- Bob cannot see Ada profile
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
select count(*) as bob_sees_profiles from viewer_profiles; select count(*) as bob_tickets from tickets;
\echo -- staff without MFA (aal1): expect 1 visible account (own)
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
select count(*) staff_aal1_accounts from accounts; select staff_can('users') as can_aal1;
\echo -- staff with MFA (aal2): sees all, sees drafts, can suspend
select set_config('request.jwt.claims', '{"aal":"aal2"}', false);
select count(*) staff_aal2_accounts from accounts; select count(*) titles_staff from titles;
update accounts set status='suspended' where email='bob@test.com';
select (admin_stats(30))->>'members_active' as active, (admin_stats(30))->>'mrr' as mrr;
select jsonb_array_length((admin_live())->'streams') as live_streams_staff;
select admin_stop_stream('s2');
\echo -- member can't see Live Now (expect error)
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
select admin_live();
select claim_stream('s2', :'id', 'Phone', 'eko-nights')->>'reason' as s2_after_admin_stop;
reset role;

\echo -- sign-ups paused: a new account is refused, an invited one is allowed
update site_settings set data = data || '{"signupsOpen": false}' where id = 1;
insert into auth.users (id, email) values ('44444444-4444-4444-4444-444444444444', 'late@test.com');
insert into auth.users (id, email, invited_at) values ('55555555-5555-5555-5555-555555555555', 'newstaff@test.com', now());
select count(*) as invited_ok from accounts where email = 'newstaff@test.com';
update site_settings set data = data || '{"signupsOpen": true}' where id = 1;
select email, status from accounts order by email;
