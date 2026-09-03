-- 0029_google_sso_group_gate.sql
-- 구글 SSO + 인사팀 구글 그룹 게이트.
--
-- 요구사항: 인사팀 구글 그룹 멤버는 (계정이 없으면) 자동가입되어 로그인, 같은 stek.kr
-- 도메인이라도 그룹 비멤버는 로그인 자체가 실패. 기본 역할 '사용자', 관리자 승격은 기존 관리자만.
--
-- 설계 근거(전부 GoTrue v2.189.0 소스로 확인):
--  · Google OIDC ID 토큰에는 그룹 클레임이 없고 커스텀 클레임 매핑 기능도 없다. 토큰으로
--    알 수 있는 건 hd(도메인)까지 → 그룹 판정은 반드시 서버측 별도 조회다.
--  · 자동가입을 켜면 handle_new_user() 가 무조건 '사용자'(= 인사데이터 전권)를 부여한다.
--    그러므로 게이트는 auth.users 행이 "생기기 전"에 걸려야 한다 → before_user_created 훅.
--  · 그 훅은 외부 프로바이더 경로에서 DetermineAccountLinking 결과가 CreateAccount 일 때만
--    발화한다. 즉 "이미 있는 계정의 첫 구글 로그인"(LinkAccount)은 훅을 안 탄다 →
--    접근 시점 게이트가 따로 있어야 그룹에서 빠진 기존 계정이 막힌다.
--
-- 그래서 두 겹이다:
--  (1) 가입 시점 — before_user_created 훅이 allowlist 에 없는 이메일을 403 으로 거부
--  (2) 접근 시점 — current_role() 에 allowlist 조건 추가. 그룹에서 빠지면 다음 동기화 즉시
--                  is_hr()/is_admin() 이 false 가 되어 전 데이터 접근이 끊긴다.
--                  (profiles.enabled 는 관리자 수동 차단용으로 그대로 둔다)
--
-- 재실행 안전: 전부 IF NOT EXISTS / CREATE OR REPLACE / 조건부 INSERT.

-- ============================================================
-- 0) ★ 선행 조치 — 기존 계정의 email_confirmed_at 채우기
--    GoTrue createAccountFromExternalIdentity 는 "미확인 유저"에 OAuth 아이덴티티가 붙을 때
--    RemoveUnconfirmedIdentities() 를 호출한다. pre-account-takeover 방어 로직인데,
--    encrypted_password 를 지우고 기존 email 아이덴티티를 Destroy 한다.
--    확인된 계정은 이 블록을 타지 않는다. 안 채우고 SSO 를 켜면 첫 구글 로그인에서
--    기존 비밀번호 로그인이 소실된다.
-- ============================================================
update auth.users
   set email_confirmed_at = coalesce(email_confirmed_at, now())
 where email_confirmed_at is null;

-- ============================================================
-- 1) 로그인 허용목록 = 인사팀 구글 그룹 멤버 스냅샷
-- ============================================================
create table if not exists public.login_allowlist (
  email     text primary key,          -- 항상 lower(btrim()) 로 정규화해 저장한다
  synced_at timestamptz not null default now()
);

alter table public.login_allowlist enable row level security;
alter table public.login_allowlist force row level security;
revoke all on public.login_allowlist from anon, authenticated;

-- 관리자만 화면에서 확인 가능(누가 로그인 가능한지 보는 용도).
grant select on public.login_allowlist to authenticated;
drop policy if exists "allowlist admin read" on public.login_allowlist;
create policy "allowlist admin read" on public.login_allowlist
  for select using (public.is_admin());

-- GoTrue 훅이 이 테이블을 읽는다. 공식 문서 권장에 따라 훅 함수에 security definer 를 쓰지
-- 않고 supabase_auth_admin 에 필요한 권한만 명시적으로 준다.
grant usage on schema public to supabase_auth_admin;
grant select on public.login_allowlist to supabase_auth_admin;
drop policy if exists "allowlist auth admin read" on public.login_allowlist;
create policy "allowlist auth admin read" on public.login_allowlist
  for select to supabase_auth_admin using (true);

-- ★ 부트스트랩: 이 마이그레이션 직후 현재 계정들이 잠기지 않도록 기존 프로필을 옮겨 담는다.
--   이후 첫 그룹 동기화가 그룹 기준으로 정리한다.
insert into public.login_allowlist (email)
  select distinct lower(btrim(p.email))
    from public.profiles p
   where p.email is not null and btrim(p.email) <> ''
  on conflict (email) do nothing;

-- ============================================================
-- 2) 가입 게이트 — GoTrue before_user_created 훅
--    URI: pg-functions://postgres/public/hook_before_user_created
--
--    반환 규약(v2.189.0 internal/hooks/hookserrors/hookserrors.go):
--      통과 = '{}'::jsonb
--      거부 = {"error":{"http_code":403,"message":"..."}}
--    · message 가 비면 에러로 취급되지 않고 그냥 통과한다 → 반드시 채운다.
--    · http_code 를 빼면 500 으로 바뀐다 → 반드시 채운다.
--    · 클라이언트에는 AuthApiError(status 403, code 'unknown', message 그대로)로 도착한다.
--      커스텀 error_code 는 전달되지 않으므로 프론트는 message 로 분기해야 한다.
--    · pg 훅에는 statement_timeout 2초가 고정으로 걸린다(조정 env 없음).
--      아래 조회는 PK 인덱스 단건이라 안전하다.
-- ============================================================
create or replace function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  v_email text := lower(btrim(event->'user'->>'email'));
begin
  if v_email is null or v_email = '' then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403,
      'message', '이메일이 없는 계정은 사용할 수 없습니다.'));
  end if;

  if not exists (select 1 from public.login_allowlist a where a.email = v_email) then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403,
      'message', '인사팀 구글 그룹 구성원만 로그인할 수 있습니다. 인사팀 관리자에게 문의하세요.'));
  end if;

  return '{}'::jsonb;
end;
$$;

grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated;

-- ============================================================
-- 3) 접근 게이트 — current_role() 에 그룹 조건 추가 (0021 재정의)
--    이 함수가 is_hr()/is_admin() 의 유일한 소스라, 여기 한 줄이 전 RLS 에 적용된다.
--    그룹에서 빠진 사람은 세션이 살아 있어도 데이터가 한 건도 안 나온다.
-- ============================================================
create or replace function public.current_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select ur.role
    from public.user_roles ur
    join public.profiles p on p.id = ur.user_id
   where ur.user_id = auth.uid()
     and p.enabled = true
     and exists (
       select 1 from public.login_allowlist a
        where a.email = lower(btrim(p.email))
     )
$$;
alter function public.current_role() owner to postgres;

-- ============================================================
-- 4) 그룹 → 허용목록 동기화 RPC (n8n 전용)
--    Admin SDK members.list(includeDerivedMembership=true) 결과 전체를 한 번에 넘긴다.
-- ============================================================
create or replace function public.n8n_sync_login_allowlist(emails text[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n_in    int;
  removed int;
  kept    int;
begin
  if emails is null then
    raise exception 'emails is null';
  end if;

  create temp table _incoming (email text primary key) on commit drop;
  insert into _incoming (email)
    select distinct lower(btrim(e))
      from unnest(emails) e
     where e is not null and btrim(e) <> '';
  select count(*) into n_in from _incoming;

  -- 그룹 조회 실패·토큰 만료로 빈 배열이 오면 전원이 잠긴다. 그런 동기화는 거부한다.
  if n_in = 0 then
    raise exception 'refusing to sync an empty allowlist';
  end if;

  -- 관리자가 한 명도 안 남으면 아무도 권한을 되돌릴 수 없다(계정관리 화면이 is_admin 이다).
  if not exists (
    select 1
      from public.user_roles ur
      join public.profiles p on p.id = ur.user_id
      join _incoming i on i.email = lower(btrim(p.email))
     where ur.role = '관리자'
  ) then
    raise exception 'refusing to sync: no 관리자 account would remain allowed';
  end if;

  delete from public.login_allowlist a
   where not exists (select 1 from _incoming i where i.email = a.email);
  get diagnostics removed = row_count;

  insert into public.login_allowlist (email)
    select email from _incoming
    on conflict (email) do update set synced_at = now();

  select count(*) into kept from public.login_allowlist;

  insert into public.audit_log (actor, action, target_table, column_name)
    values (null, 'n8n_sync_login_allowlist', 'login_allowlist', kept || '/-' || removed);

  return jsonb_build_object('allowed', kept, 'removed', removed);
end;
$$;
alter function public.n8n_sync_login_allowlist(text[]) owner to postgres;
revoke execute on function public.n8n_sync_login_allowlist(text[]) from public, anon, authenticated;
grant execute on function public.n8n_sync_login_allowlist(text[]) to n8n_ingest;

-- 0028 의 n8n 감사로그 정책은 action 을 'n8n_ingest_sensitive' 하나로 못박아 뒀다.
-- 위 RPC 의 로그가 그 정책에 걸려 실패하므로 action 목록을 넓힌다.
drop policy if exists "audit n8n ingest" on public.audit_log;
create policy "audit n8n ingest" on public.audit_log
  for insert
  with check (
    actor is null
    and action in ('n8n_ingest_sensitive', 'n8n_sync_login_allowlist')
  );
