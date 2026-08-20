-- 0008_settings.sql
-- 조직·기준·기능토글 설정. 보안판단(RLS 조건)에는 절대 사용하지 않는다 — role 판단은
-- 오직 user_roles/is_admin()/is_hr() 로만 한다. 여기는 UI/동작 토글 용도.

create table if not exists public.org_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

alter table public.org_settings enable row level security;
alter table public.org_settings force row level security;
revoke all on public.org_settings from anon, authenticated;
grant select on public.org_settings to authenticated;
grant insert, update, delete on public.org_settings to authenticated; -- RLS 로 admin 만 실제 통과

create policy "settings authenticated read" on public.org_settings
  for select
  using (true);

create policy "settings admin write" on public.org_settings
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- 초기값: 규칙값 + 기능 토글 (n8n 도 REST 로 읽어서 동작 분기 가능)
insert into public.org_settings (key, value) values
  ('probation_days', '{"first": 30, "final": 55}'::jsonb),
  ('retire_age', '60'::jsonb),
  ('exclude_pattern', '["테스트", "test", "GPRO"]'::jsonb),
  ('org_name_map', '{"총괄": "TBS"}'::jsonb),
  ('employee_input_enabled', 'true'::jsonb),
  ('leave_input_enabled', 'true'::jsonb)
on conflict (key) do nothing;
