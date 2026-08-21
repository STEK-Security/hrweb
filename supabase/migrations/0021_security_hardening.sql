-- 0021_security_hardening.sql : 비활성계정 서버측차단(P0), enabled 자기수정방지(P0), audit 직접insert 회수(P1), 마지막관리자/본인역할 서버측차단(P2)
create or replace function public.current_role()
returns text language sql security definer set search_path = public stable as $$
  select ur.role from public.user_roles ur
  join public.profiles p on p.id = ur.user_id
  where ur.user_id = auth.uid() and p.enabled = true
$$;
alter function public.current_role() owner to postgres;

create or replace function public.guard_profile_enabled()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.enabled is distinct from old.enabled and not public.is_admin() then
    raise exception 'forbidden: enabled is admin-only';
  end if;
  return new;
end $$;
alter function public.guard_profile_enabled() owner to postgres;
drop trigger if exists profiles_guard_enabled on public.profiles;
create trigger profiles_guard_enabled before update on public.profiles
  for each row execute function public.guard_profile_enabled();

revoke insert on public.audit_log from authenticated;

create or replace function public.guard_admin_roles()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.user_id = auth.uid() and new.role is distinct from old.role then
    raise exception 'cannot change own role';
  end if;
  if old.role = '관리자' and new.role <> '관리자'
     and (select count(*) from public.user_roles where role = '관리자') <= 1 then
    raise exception 'cannot demote the last admin';
  end if;
  return new;
end $$;
alter function public.guard_admin_roles() owner to postgres;
drop trigger if exists user_roles_guard on public.user_roles;
create trigger user_roles_guard before update on public.user_roles
  for each row execute function public.guard_admin_roles();
