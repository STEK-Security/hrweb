-- 0037_attendance_patterns_5weeks.sql
-- 근무조 패턴을 4주(28일) 또는 5주(35일)로. 품질 근무조(이름이 '품질'로 시작)는 5주로 바꾼다 —
-- 5주차는 4주차(22~28일차)를 복사해 채우므로 실제 5주 순환에 맞게 근무표 탭에서 확인·수정해야 한다.
--
-- 재실행 안전: 제약은 drop if exists 후 다시 만들고, 품질 조는 아직 28일인 것만 늘린다.

alter table public.attendance_shift_patterns drop constraint if exists attendance_shift_patterns_pattern_check;
alter table public.attendance_shift_patterns
  add constraint attendance_shift_patterns_pattern_check check (array_length(pattern, 1) in (28, 35));

update public.attendance_shift_patterns
   set pattern = pattern || pattern[22:28]
 where group_name like '품질%' and array_length(pattern, 1) = 28;
