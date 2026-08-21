-- 0012_two_roles.sql
-- 2역할 마이그레이션: user_roles.role 을 ('사용자','관리자') 로 단순화.
-- 매핑: 시스템관리자→관리자, 인사담당자|팀장|일반→사용자.
-- is_hr() = 인증된 전원(사용자·관리자 모두 인사팀 전 기능), is_admin() = 관리자만(+로그·계정·설정).
-- 팀장/일반 전용 정책·team_managers 테이블은 미사용이라 함께 정리한다.

-- 1) 기존 CHECK 제약을 먼저 제거해야 아래 update 가 통과한다
--    (구 제약은 '관리자'/'사용자' 값을 모르므로 매핑 update 자체가 위반이 된다).
alter table public.user_roles drop constraint if exists user_roles_role_check;

-- 2) 기존 값 매핑
update public.user_roles set role = '관리자' where role = '시스템관리자';
update public.user_roles set role = '사용자' where role in ('인사담당자','팀장','일반');

-- 3) 새 CHECK 제약 추가
alter table public.user_roles add constraint user_roles_role_check
  check (role in ('사용자','관리자'));

-- 4) 헬퍼 함수 재정의 (current_role() 자체는 그대로 유지)
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_role() = '관리자'
$$;

create or replace function public.is_hr()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_role() in ('사용자','관리자')
$$;

-- 5) 팀장/일반 전용 정책 DROP.
-- "emp hr all"/"leave hr all" 은 FOR ALL(select 포함) + is_hr() 이라 이제 인증된 전원을 이미 커버한다.
drop policy if exists "emp mgr read" on public.employees;
drop policy if exists "emp self read" on public.employees;
drop policy if exists "leave mgr read" on public.leave_records;
drop policy if exists "leave self read" on public.leave_records;

-- 6) team_managers 미사용 → 정책 먼저 DROP 후 테이블 DROP.
drop policy if exists "team_managers hr all" on public.team_managers;
drop policy if exists "team_managers self read" on public.team_managers;
drop table if exists public.team_managers;

-- roles self read 는 유지(본인 role 조회 필요) — 변경 없음.

-- 7) [버그 수정] handle_new_user() 가 여전히 role='일반' 으로 신규 계정을 만들고 있었다.
--    위 3)에서 CHECK 제약을 ('사용자','관리자') 로 바꿔놨기 때문에, 이 함수를 그대로 두면
--    신규 계정 가입(auth.users insert) 이 CHECK 위반으로 전부 실패한다. role='사용자' 로 교체.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
    on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, '사용자')
    on conflict (user_id) do nothing;
  return new;
end;
$$;
