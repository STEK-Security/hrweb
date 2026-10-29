-- 0038_attendance_shift_templates.sql
-- 근무표 탭 '템플릿 만들기' — 인사팀이 만든 4주 템플릿(주차별 근무 코드). 기본 16가지(주·야 조합)는 코드에 있다.
-- 근무조 패턴에 적용할 때만 쓰는 입력 도구라 근태 데이터 사본이 아니다(0036 과 같은 예외).
--
-- 재실행 안전: if not exists / drop ... if exists.

create table if not exists public.attendance_shift_templates (
  name text primary key check (char_length(name) between 1 and 20),
  weeks text[] not null check (array_length(weeks, 1) = 4 and weeks <@ array['DAY', 'NIGHT', 'DAY_STD', 'REST']),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

alter table public.attendance_shift_templates enable row level security;
alter table public.attendance_shift_templates force row level security;
revoke all on public.attendance_shift_templates from anon, authenticated;
grant select, insert, delete on public.attendance_shift_templates to authenticated;

drop policy if exists "attendance_shift_templates hr all" on public.attendance_shift_templates;
create policy "attendance_shift_templates hr all" on public.attendance_shift_templates
  for all
  using (public.is_hr())
  with check (public.is_hr());
