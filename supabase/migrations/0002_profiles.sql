-- 0002_profiles.sql
-- 계정 프로필. role 은 여기 없음(0001 user_roles 가 유일 소스).

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  dept text,
  team text,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.profiles force row level security;
revoke all on public.profiles from anon, authenticated;

grant select (id, email, name, dept, team, enabled) on public.profiles to authenticated;
grant update (name, dept, team) on public.profiles to authenticated;

-- 본인은 본인 행 + hr 은 전체 조회
create policy "profiles self read" on public.profiles
  for select
  using (id = auth.uid() or public.is_hr());

-- 본인은 비민감 필드만 수정(role 없음 = 자기승격 불가)
create policy "profiles self update" on public.profiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles admin all" on public.profiles
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- auth.users 신규 생성 시 profiles/user_roles 기본행 자동 생성
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
    on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, '일반')
    on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
