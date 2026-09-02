-- 0001_roles.sql
-- 역할 소스: user_roles (사용자 self-write 금지). 헬퍼 함수는 SECURITY DEFINER + search_path 고정.
-- 이 파일은 supabase Studio SQL 편집기에서 그대로 실행 가능하다.

-- [보안 리뷰 반영] 앞으로 이 롤(통상 postgres)이 public 스키마에 만드는 모든 신규 테이블은,
-- 개별 마이그레이션에서 명시적으로 grant 하기 전까지 anon/authenticated 에게 기본 권한이
-- 전혀 생기지 않는다. "깜빡하고 GRANT 를 안 좁힌 새 테이블이 그대로 노출"되는 사고를 원천 차단.
alter default privileges in schema public revoke all on tables from anon, authenticated;

-- 역할은 user_roles 로만 관리한다. profiles/JWT 어디에도 role 을 이중으로 두지 않는다.
create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  -- 구 4역할 + 신 2역할(0012)을 모두 허용한다. 0002 의 handle_new_user() 는 '사용자' 를
  -- 넣으므로, 여기서 구 4역할만 허용하면 0012 적용 전까지 신규 가입이 전부 실패한다.
  role text not null check (role in ('시스템관리자','인사담당자','팀장','일반','사용자','관리자')),
  updated_by uuid,
  updated_at timestamptz not null default now()
);

alter table public.user_roles enable row level security;
alter table public.user_roles force row level security;
revoke all on public.user_roles from anon, authenticated;

-- 헬퍼 함수: SECURITY DEFINER + search_path 고정으로 role 상승/우회를 막는다.
create or replace function public.current_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.user_roles where user_id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_role() = '시스템관리자'
$$;

create or replace function public.is_hr()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_role() in ('시스템관리자','인사담당자')
$$;

revoke execute on function public.current_role() from public;
revoke execute on function public.is_admin() from public;
revoke execute on function public.is_hr() from public;
grant execute on function public.current_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_hr() to authenticated;

-- user_roles 는 admin 만 쓰기, 본인은 자기 role 읽기만 가능(self-write 금지).
create policy "roles admin all" on public.user_roles
  for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "roles self read" on public.user_roles
  for select
  using (user_id = auth.uid());

grant select on public.user_roles to authenticated;
