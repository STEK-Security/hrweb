-- 0030_audit_password_change.sql
-- 웹에서 본인 비밀번호 변경(auth.updateUser) 시 감사로그를 남기기 위해 log_event 의
-- action 화이트리스트에 'change_password' 를 추가한다. 비밀번호 원문은 meta 에 담지 않는다(웹 코드에서 보장).
-- 함수 본문은 0022(최신본)와 완전 동일하고 화이트리스트 한 줄만 추가 — 0022 가 그랬듯, 화이트리스트를
-- 옛 시점으로 되돌리면 이미 배포된 action 들이 'invalid action' 으로 막히는 회귀가 생기기 때문이다.
-- idempotent(create or replace).

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
    'create_leave','update_leave','export','reveal','read_ssn_full','role_change',
    'issue_certificate',
    'create_transfer','update_transfer','delete_transfer',
    'create_event','update_event','delete_event',
    'create_checklist','update_checklist','delete_checklist',
    'create_training_course','update_training_course','delete_training_course',
    'create_training_record','update_training_record','delete_training_record',
    'create_evaluation','update_evaluation','delete_evaluation',
    'toggle_account','update_settings',
    'change_password'
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
      v_ip := coalesce(
        nullif(v_headers ->> 'x-client-ip', ''),
        split_part(v_headers ->> 'x-forwarded-for', ',', 1)
      )::inet;
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
