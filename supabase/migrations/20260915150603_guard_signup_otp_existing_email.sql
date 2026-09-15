create or replace function public.can_send_signup_otp(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1
    from auth.users as u
    where lower(u.email) = lower(btrim(p_email))
      and (u.raw_user_meta_data -> 'signup_completed') is distinct from 'false'::jsonb
  );
$$;

revoke all on function public.can_send_signup_otp(text) from public;
grant execute on function public.can_send_signup_otp(text) to anon, authenticated;

comment on function public.can_send_signup_otp(text) is
  'Returns false for an existing completed account, while allowing a new or unfinished signup to request its verification OTP.';
