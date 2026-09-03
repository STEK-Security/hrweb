/**
 * 웹 행위 감사로그 훅. `log_event` RPC(0013_audit_events.sql)를 호출해 서버측에서
 * IP/UA 를 채워 audit_log 에 기록한다. 로그 실패는 앱 흐름을 막지 않는다(조용히 무시).
 */
import { supabase } from './supabase';

/** log_event RPC 의 action 화이트리스트와 동일해야 한다. */
export type AuditAction =
  | 'login_success'
  | 'login_fail'
  | 'logout'
  | 'view_screen'
  | 'view_employee'
  | 'create_employee'
  | 'update_employee'
  | 'delete_employee'
  | 'create_leave'
  | 'update_leave'
  | 'export'
  | 'reveal'
  | 'read_ssn_full'
  | 'role_change'
  | 'issue_certificate'
  | 'create_transfer'
  | 'update_transfer'
  | 'delete_transfer'
  | 'create_event'
  | 'update_event'
  | 'delete_event'
  | 'create_checklist'
  | 'update_checklist'
  | 'delete_checklist'
  | 'create_training_course'
  | 'update_training_course'
  | 'delete_training_course'
  | 'create_training_record'
  | 'update_training_record'
  | 'delete_training_record'
  | 'create_evaluation'
  | 'update_evaluation'
  | 'delete_evaluation'
  | 'toggle_account'
  | 'update_settings'
  | 'change_password';

export interface LogEventOptions {
  targetId?: string | null;
  targetTable?: string | null;
  meta?: Record<string, unknown> | null;
}

/** 행위 감사로그 기록. 실패해도 예외를 던지지 않는다. */
export async function logEvent(action: AuditAction, opts: LogEventOptions = {}): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.rpc('log_event', {
      p_action: action,
      p_target_id: opts.targetId ?? null,
      p_target_table: opts.targetTable ?? null,
      p_meta: opts.meta ?? null,
    });
  } catch {
    // 감사로그 실패는 화면 동작에 영향을 주지 않는다.
  }
}
