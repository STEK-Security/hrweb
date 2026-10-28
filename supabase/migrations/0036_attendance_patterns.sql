-- 0036_attendance_patterns.sql
-- 근태관리 '근무표' 탭의 근무조 28일 패턴. 근태 데이터 사본은 Supabase 에 두지 않는다는 원칙의 유일한 예외
-- (패턴은 hr.stek.kr 만 쓰는 입력 도구이고, 실제 근무표는 Worker `PUT /api/admin/schedules` 로 들어간다).
--
-- applied_pattern·applied_anchor: 이 근무조에 마지막으로 '적용'한 패턴. Worker 근무표 행에는 note 가 없어
-- (GET 이 돌려주지 않고 PUT 도 저장하지 않음) 기존 칸이 패턴으로 넣은 것인지 직접 수정한 것인지 알 수 없다.
-- 마지막 적용 패턴과 같은 값이면 패턴 칸으로 보고 덮어쓰며, 다르면 직접 수정한 칸으로 보고 보존한다.
--
-- 재실행 안전: if not exists / on conflict do nothing / drop policy if exists.

create table if not exists public.attendance_shift_patterns (
  group_name text primary key,
  anchor_date date not null,
  pattern text[] not null check (array_length(pattern, 1) = 28),
  applied_pattern text[] check (applied_pattern is null or array_length(applied_pattern, 1) = 28),
  applied_anchor date,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);

alter table public.attendance_shift_patterns enable row level security;
alter table public.attendance_shift_patterns force row level security;
revoke all on public.attendance_shift_patterns from anon, authenticated;
grant select, insert, update, delete on public.attendance_shift_patterns to authenticated;

drop policy if exists "attendance_shift_patterns hr all" on public.attendance_shift_patterns;
create policy "attendance_shift_patterns hr all" on public.attendance_shift_patterns
  for all
  using (public.is_hr())
  with check (public.is_hr());

-- 수정 시각·수정자는 클라이언트가 보내는 값을 믿지 않고 서버에서 채운다.
create or replace function public.attendance_shift_patterns_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists attendance_shift_patterns_touch on public.attendance_shift_patterns;
create trigger attendance_shift_patterns_touch
  before insert or update on public.attendance_shift_patterns
  for each row execute function public.attendance_shift_patterns_touch();

-- 시드: 2조 2교대(주간 2주 + 야간 2주, 6·7일차 휴일). B조는 A조의 반대. 1일차 = 2026-11-02(월).
insert into public.attendance_shift_patterns (group_name, anchor_date, pattern) values
  ('A조', '2026-11-02', array['DAY','DAY','DAY','DAY','DAY','REST','REST','DAY','DAY','DAY','DAY','DAY','REST','REST',
                              'NIGHT','NIGHT','NIGHT','NIGHT','NIGHT','REST','REST','NIGHT','NIGHT','NIGHT','NIGHT','NIGHT','REST','REST']),
  ('B조', '2026-11-02', array['NIGHT','NIGHT','NIGHT','NIGHT','NIGHT','REST','REST','NIGHT','NIGHT','NIGHT','NIGHT','NIGHT','REST','REST',
                              'DAY','DAY','DAY','DAY','DAY','REST','REST','DAY','DAY','DAY','DAY','DAY','REST','REST']),
  ('품질A조', '2026-11-02', array['DAY','DAY','DAY','DAY','DAY','REST','REST','DAY','DAY','DAY','DAY','DAY','REST','REST',
                              'NIGHT','NIGHT','NIGHT','NIGHT','NIGHT','REST','REST','NIGHT','NIGHT','NIGHT','NIGHT','NIGHT','REST','REST']),
  ('품질B조', '2026-11-02', array['NIGHT','NIGHT','NIGHT','NIGHT','NIGHT','REST','REST','NIGHT','NIGHT','NIGHT','NIGHT','NIGHT','REST','REST',
                              'DAY','DAY','DAY','DAY','DAY','REST','REST','DAY','DAY','DAY','DAY','DAY','REST','REST'])
on conflict (group_name) do nothing;
