-- 0013_audit_events.sql
-- 감사로그 확장: 웹 행위 로깅(로그인/로그아웃/화면전환/CRUD/내보내기 등) + 서버측 IP/UA 기록.
-- 클라이언트가 IP를 직접 insert 하면 위조 가능하므로, IP/UA는 항상 이 RPC 안에서
-- PostgREST 가 채워주는 `request.headers` GUC 에서만 읽는다(클라 payload 로는 못 넘긴다).

-- 1) 컬럼 추가 (기존 append-only 정책·admin select 정책은 그대로 유지)
alter table public.audit_log add column if not exists ip inet;
alter table public.audit_log add column if not exists user_agent text;
alter table public.audit_log add column if not exists meta jsonb;
alter table public.audit_log add column if not exists actor_email text;

-- 2) log_event RPC.
--    - actor = auth.uid() (로그인 세션이 있으면).
--    - IP/UA 는 서버측에서만: request.headers 의 x-forwarded-for(첫 IP)/user-agent.
--    - login_fail 은 세션이 없을 수 있으므로 p_meta.email 을 actor_email 로 남긴다.
--    - action 화이트리스트 검증(허용 외 값은 예외).
--    - anon(비로그인)은 login_fail/login_success 만 호출 가능, 그 외 action 은 인증 필요.
create or replace function public.log_event(
  p_action text,
  p_target_id uuid default null,
  p_target_table text default null,
  p_meta jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor uuid := auth.uid();
  v_headers jsonb;
  v_ip inet;
  v_ua text;
  v_actor_email text;
begin
  if p_action not in (
    'login_success','login_fail','logout','view_screen','view_employee',
    'create_employee','update_employee','delete_employee',
    'create_leave','update_leave','export','reveal','read_ssn_full','role_change'
  ) then
    raise exception 'invalid action';
  end if;

  -- anon(비로그인) 컨텍스트는 로그인 성공/실패 기록만 허용.
  if v_actor is null and p_action not in ('login_success','login_fail') then
    raise exception 'forbidden';
  end if;

  begin
    v_headers := current_setting('request.headers', true)::jsonb;
  exception when others then
    v_headers := null;
  end;

  if v_headers is not null then
    v_ua := v_headers ->> 'user-agent';
    begin
      v_ip := split_part(v_headers ->> 'x-forwarded-for', ',', 1)::inet;
    exception when others then
      v_ip := null;
    end;
  end if;

  v_actor_email := p_meta ->> 'email';

  insert into public.audit_log
    (actor, action, target_id, target_table, meta, ip, user_agent, actor_email)
  values
    (v_actor, p_action, p_target_id, p_target_table, p_meta, v_ip, v_ua, v_actor_email);
end;
$$;

-- audit_log 는 FORCE RLS 대상이라, 이 함수가 anon(actor 없음) 행까지 insert 하려면
-- 소유자가 RLS 를 우회하는 롤이어야 한다(0011 hotfix 의 민감 RPC 들과 동일한 이유).
alter function public.log_event(text, uuid, text, jsonb) owner to postgres;

revoke execute on function public.log_event(text, uuid, text, jsonb) from public;
grant execute on function public.log_event(text, uuid, text, jsonb) to authenticated, anon;
