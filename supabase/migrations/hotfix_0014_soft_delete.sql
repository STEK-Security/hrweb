-- hotfix_0014_soft_delete.sql
-- Studio SQL 편집기에 이 파일 전체를 그대로 복붙해 실행하면 된다. add column if not exists /
-- grant 재실행이 안전하다(0013 hotfix 와 동일한 방식). 내용은 0014_soft_delete.sql 과 동일.

alter table public.employees add column if not exists deleted_at timestamptz;
alter table public.leave_records add column if not exists deleted_at timestamptz;

grant select (deleted_at) on public.employees to authenticated;
