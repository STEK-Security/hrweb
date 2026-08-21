-- 0022_log_event_ip.sql
-- 보안리뷰 후속: log_event 의 IP 취득을 x-client-ip(nginx real_ip 복원 후 커스텀 헤더) 우선으로 변경.
-- dokploy-traefik(도커 10.0.0.0/8) 뒤에서 표준 x-forwarded-for 의 첫 항목이 중간 홉(도커 오버레이)의
-- 내부IP로 재작성되는 문제가 있어, nginx 가 real_ip_module 로 복원한 실클라 IP를
-- 위·변조 불가한 x-client-ip 커스텀 헤더로 별도 전달한다.
-- IP 취득부만 교체하고 나머지(anon 제한, UA, insert, owner to postgres, grant/revoke)는
-- 0013 과 완전 동일하게 유지한다. action 화이트리스트는 0013 이후 0015~0020 이 누적 확장한
-- 최신본(0020 최종본)을 그대로 가져온다 — 0013 시점 화이트리스트로 되돌리면 issue_certificate/
-- transfer/event/checklist/training/evaluation/toggle_account/update_settings 등 이미 배포된
-- action 들이 'invalid action' 예외로 막혀버리는 회귀가 생기기 때문이다.

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
    'toggle_account','update_settings'
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
