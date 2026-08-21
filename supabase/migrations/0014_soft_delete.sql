-- 0014_soft_delete.sql
-- 직원/휴직 삭제는 물리 삭제 대신 soft delete(deleted_at)로 처리한다. 기존 "emp hr all"/"leave hr all"
-- 정책(is_hr() 이 update 포함 전체 CRUD)이 그대로 커버하므로 RLS 정책은 추가하지 않는다.
-- 목록 화면에서 deleted_at is null 필터로 숨기는 것은 프론트 책임이다(팀장/본인 read 정책 범위는
-- 넓히지 않는다 — 원래도 그 정책들엔 deleted_at 필터가 없었다).

alter table public.employees add column if not exists deleted_at timestamptz;
alter table public.leave_records add column if not exists deleted_at timestamptz;

-- employees 는 0006 에서 컬럼단위 select 를 명시적으로 좁혀놨으므로, 새 컬럼은 별도 grant 가 필요하다.
-- (leave_records 는 0007 에서 테이블단위 select 를 grant 했으므로 추가 grant 불필요.)
grant select (deleted_at) on public.employees to authenticated;
