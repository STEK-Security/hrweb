-- 0009_audit.sql
-- 감사로그: 누가/언제/무엇을(테이블·행·컬럼) 만. 민감 원본 값은 절대 기록하지 않는다.
-- append-only: update/delete 는 전부 차단.

create table if not exists public.audit_log (
  id bigserial primary key,
  actor uuid,
  action text not null,
  target_id uuid,
  target_table text,
  column_name text,
  ts timestamptz not null default now()
);

alter table public.audit_log enable row level security;
alter table public.audit_log force row level security;
revoke all on public.audit_log from anon, authenticated;
grant select, insert on public.audit_log to authenticated;

-- 누구나(로그인 사용자) 자기 자신을 actor 로 하는 행만 insert 가능
create policy "audit insert self" on public.audit_log
  for insert
  with check (actor = auth.uid());

-- 조회는 admin 만
create policy "audit admin select" on public.audit_log
  for select
  using (public.is_admin());

-- append-only: update/delete 는 명시적으로 전부 차단
create policy "audit no update" on public.audit_log
  for update
  using (false);

create policy "audit no delete" on public.audit_log
  for delete
  using (false);
