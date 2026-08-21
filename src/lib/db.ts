/**
 * DB 데이터 접근 계층. RLS 가 역할별로 걸러주므로 여기서는 조회만 하고
 * 결과에 derive.ts 규칙(제외·총괄→TBS·현장직·D-Day·수습 등)을 적용한다.
 * 조회 실패/빈 결과는 예외를 던지지 않고 빈 배열/null 로 안전 처리한다.
 */
import { supabase } from './supabase';
import type { RawRow } from '../excel/parse';
import { deriveAll, derive, type Employee } from '../excel/derive';

export type { Employee };

export interface LeaveRecord {
  id: string;
  employee_id: string | null;
  name: string;
  dept: string | null;
  position: string | null;
  reason: string | null;
  start_date: string | null;
  expected_return_date: string | null;
  substitute_assigned: boolean;
  substitute_name: string | null;
  contact: string | null;
  status: '휴직중' | '복직예정' | '복직완료';
  created_at: string;
  updated_at: string;
}

export interface OrgSetting {
  key: string;
  value: unknown;
  updated_by: string | null;
  updated_at: string;
}

export interface AuditLogRow {
  id: number;
  actor: string | null;
  action: string;
  target_id: string | null;
  target_table: string | null;
  column_name: string | null;
  meta: Record<string, unknown> | null;
  ip: string | null;
  user_agent: string | null;
  actor_email: string | null;
  ts: string;
}

export interface ProfileLite {
  id: string;
  email: string | null;
  name: string | null;
}

export interface TransferRecord {
  id: string;
  employee_id: string;
  transfer_date: string;
  transfer_type: string;
  prev_org: string | null;
  new_org: string | null;
  prev_position: string | null;
  new_position: string | null;
  order_title: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface HrEvent {
  id: string;
  title: string;
  event_date: string;
  end_date: string | null;
  category: string | null;
  location: string | null;
  description: string | null;
  created_by: string | null;
  created_at: string;
}

export interface HrChecklistItem {
  id: string;
  title: string;
  category: string | null;
  due_date: string | null;
  completed: boolean;
  assignee: string | null;
  created_by: string | null;
  created_at: string;
}

export interface TrainingCourse {
  id: string;
  title: string;
  category: string | null;
  target_count: number | null;
  start_date: string | null;
  end_date: string | null;
  instructor: string | null;
  status: string | null;
  mandatory: boolean;
  created_by: string | null;
  created_at: string;
}

export interface TrainingRecord {
  id: string;
  course_id: string;
  employee_id: string;
  status: '수료' | '미수료' | '진행중';
  completed_date: string | null;
  score: number | null;
  created_by: string | null;
  created_at: string;
}

export interface EvaluationRecord {
  id: string;
  employee_id: string;
  type: '수습' | '역량' | '성과';
  evaluator: string | null;
  stage: string | null;
  status: '진행중' | '완료' | '미작성';
  due_date: string | null;
  self_score: number | null;
  manager_score: number | null;
  final_grade: string | null;
  feedback: string | null;
  submitted_date: string | null;
  created_by: string | null;
  created_at: string;
}

/** employees 전체 조회(soft delete 된 행 제외) → 제외 규칙 적용 후 파생필드까지 붙여 반환. */
export async function listEmployees(): Promise<Employee[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('employees').select('*').is('deleted_at', null);
  if (error || !data) return [];
  return deriveAll(data as RawRow[]);
}

/** 단일 직원 조회(파생필드 포함). 없으면 null. */
export async function getEmployee(id: string): Promise<Employee | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('employees').select('*').eq('id', id).single();
  if (error || !data) return null;
  return derive(data as RawRow, 0);
}

/** 비민감 필드 신규 등록. 성공 시 새 employees.id, 실패 시 null. */
export async function createEmployee(
  fields: Record<string, string | number | null>
): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('employees').insert(fields).select('id').single();
  if (error || !data) return null;
  return data.id as string;
}

/** 비민감 필드 수정. */
export async function updateEmployee(
  id: string,
  fields: Record<string, string | number | null>
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from('employees').update(fields).eq('id', id);
  return !error;
}

/** soft delete: deleted_at 만 채운다(물리 삭제 없음). */
export async function softDeleteEmployee(id: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from('employees').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  return !error;
}

/** 민감값 등록/수정(변경된 키만 payload에 포함, set_sensitive RPC). */
export async function setSensitive(empId: string, payload: Record<string, unknown>): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.rpc('set_sensitive', { emp: empId, payload });
  return !error;
}

/** 휴직 기록 전체 조회. */
export async function listLeave(): Promise<LeaveRecord[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('leave_records').select('*');
  if (error || !data) return [];
  return data as LeaveRecord[];
}

/** 휴직 신규 등록. 성공 시 새 leave_records.id, 실패 시 null. */
export async function createLeave(
  fields: Partial<Omit<LeaveRecord, 'id' | 'created_at' | 'updated_at'>>
): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('leave_records').insert(fields).select('id').single();
  if (error || !data) return null;
  return data.id as string;
}

/** 휴직 기록 수정(상태전환·대체인력 포함). */
export async function updateLeave(
  id: string,
  fields: Partial<Omit<LeaveRecord, 'id' | 'created_at' | 'updated_at'>>
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from('leave_records').update(fields).eq('id', id);
  return !error;
}

/** 민감값 마스킹 조회(hr 만 값이 나옴, 그 외는 RPC 자체가 forbidden 예외). */
export async function getSensitiveMasked(empId: string): Promise<Record<string, unknown> | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('get_sensitive_masked', { emp: empId });
  if (error || !data) return null;
  return data as Record<string, unknown>;
}

/** 민감값 개별 필드 원본 조회("보이기", hr 만). 실패 시 null. */
export async function revealField(empId: string, field: string): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('reveal_sensitive_field', { emp: empId, field });
  if (error) return null;
  return (data as string | null) ?? null;
}

/** 조직·기준·기능토글 설정 전체 조회. */
export async function listOrgSettings(): Promise<OrgSetting[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('org_settings').select('*');
  if (error || !data) return [];
  return data as OrgSetting[];
}

export interface AuditLogFilter {
  from?: string;
  to?: string;
  action?: string;
  actorId?: string;
  targetTable?: string;
}

/** 감사로그 페이지 조회(관리자만 RLS 통과, 그 외는 빈 배열). ts 내림차순, 필터+페이지네이션. */
export async function listAuditLog(
  filter: AuditLogFilter,
  page: number,
  pageSize: number
): Promise<{ rows: AuditLogRow[]; total: number }> {
  if (!supabase) return { rows: [], total: 0 };
  let query = supabase
    .from('audit_log')
    .select('*', { count: 'exact' })
    .order('ts', { ascending: false });
  if (filter.from) query = query.gte('ts', filter.from);
  if (filter.to) query = query.lte('ts', filter.to);
  if (filter.action) query = query.eq('action', filter.action);
  if (filter.actorId) query = query.eq('actor', filter.actorId);
  if (filter.targetTable) query = query.eq('target_table', filter.targetTable);

  const start = page * pageSize;
  const { data, error, count } = await query.range(start, start + pageSize - 1);
  if (error || !data) return { rows: [], total: 0 };
  return { rows: data as AuditLogRow[], total: count ?? data.length };
}

/** actor 표시용 프로필 목록(이메일·이름). 관리자는 전체, 그 외는 본인만(RLS). */
export async function listProfiles(): Promise<ProfileLite[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('profiles').select('id,email,name');
  if (error || !data) return [];
  return data as ProfileLite[];
}

/** 인사발령이력 조회. employeeId 지정 시 해당 직원만, 발령일 내림차순. */
export async function listTransfers(employeeId?: string): Promise<TransferRecord[]> {
  if (!supabase) return [];
  let query = supabase.from('employee_transfers').select('*').order('transfer_date', { ascending: false });
  if (employeeId) query = query.eq('employee_id', employeeId);
  const { data, error } = await query;
  if (error || !data) return [];
  return data as TransferRecord[];
}

export async function createTransfer(
  fields: Omit<TransferRecord, 'id' | 'created_by' | 'created_at'>
): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('employee_transfers').insert(fields).select('id').single();
  if (error || !data) return null;
  return data.id as string;
}

export async function updateTransfer(
  id: string,
  fields: Partial<Omit<TransferRecord, 'id' | 'created_by' | 'created_at'>>
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from('employee_transfers').update(fields).eq('id', id);
  return !error;
}

export async function deleteTransfer(id: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from('employee_transfers').delete().eq('id', id);
  return !error;
}

/** HR캘린더 일정 조회. */
export async function listHrEvents(): Promise<HrEvent[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('hr_events').select('*').order('event_date', { ascending: true });
  if (error || !data) return [];
  return data as HrEvent[];
}

export async function createHrEvent(
  fields: Omit<HrEvent, 'id' | 'created_by' | 'created_at'>
): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('hr_events').insert(fields).select('id').single();
  if (error || !data) return null;
  return data.id as string;
}

export async function updateHrEvent(
  id: string,
  fields: Partial<Omit<HrEvent, 'id' | 'created_by' | 'created_at'>>
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from('hr_events').update(fields).eq('id', id);
  return !error;
}

export async function deleteHrEvent(id: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from('hr_events').delete().eq('id', id);
  return !error;
}

/** HR캘린더 체크리스트 조회. */
export async function listHrChecklists(): Promise<HrChecklistItem[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('hr_checklists').select('*').order('due_date', { ascending: true });
  if (error || !data) return [];
  return data as HrChecklistItem[];
}

export async function createHrChecklist(
  fields: Omit<HrChecklistItem, 'id' | 'created_by' | 'created_at'>
): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('hr_checklists').insert(fields).select('id').single();
  if (error || !data) return null;
  return data.id as string;
}

export async function updateHrChecklist(
  id: string,
  fields: Partial<Omit<HrChecklistItem, 'id' | 'created_by' | 'created_at'>>
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from('hr_checklists').update(fields).eq('id', id);
  return !error;
}

export async function deleteHrChecklist(id: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from('hr_checklists').delete().eq('id', id);
  return !error;
}

/** 교육 과정 조회. */
export async function listTrainingCourses(): Promise<TrainingCourse[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('training_courses').select('*').order('start_date', { ascending: false });
  if (error || !data) return [];
  return data as TrainingCourse[];
}

export async function createTrainingCourse(
  fields: Omit<TrainingCourse, 'id' | 'created_by' | 'created_at'>
): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('training_courses').insert(fields).select('id').single();
  if (error || !data) return null;
  return data.id as string;
}

export async function updateTrainingCourse(
  id: string,
  fields: Partial<Omit<TrainingCourse, 'id' | 'created_by' | 'created_at'>>
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from('training_courses').update(fields).eq('id', id);
  return !error;
}

export async function deleteTrainingCourse(id: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from('training_courses').delete().eq('id', id);
  return !error;
}

/** 교육 수료현황 조회. courseId 지정 시 해당 과정만. */
export async function listTrainingRecords(courseId?: string): Promise<TrainingRecord[]> {
  if (!supabase) return [];
  let query = supabase.from('training_records').select('*').order('created_at', { ascending: false });
  if (courseId) query = query.eq('course_id', courseId);
  const { data, error } = await query;
  if (error || !data) return [];
  return data as TrainingRecord[];
}

export async function createTrainingRecord(
  fields: Omit<TrainingRecord, 'id' | 'created_by' | 'created_at'>
): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('training_records').insert(fields).select('id').single();
  if (error || !data) return null;
  return data.id as string;
}

export async function updateTrainingRecord(
  id: string,
  fields: Partial<Omit<TrainingRecord, 'id' | 'created_by' | 'created_at'>>
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from('training_records').update(fields).eq('id', id);
  return !error;
}

export async function deleteTrainingRecord(id: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from('training_records').delete().eq('id', id);
  return !error;
}

/** 평가 조회. */
export async function listEvaluations(): Promise<EvaluationRecord[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('evaluations').select('*').order('due_date', { ascending: true });
  if (error || !data) return [];
  return data as EvaluationRecord[];
}

export async function createEvaluation(
  fields: Omit<EvaluationRecord, 'id' | 'created_by' | 'created_at'>
): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('evaluations').insert(fields).select('id').single();
  if (error || !data) return null;
  return data.id as string;
}

export async function updateEvaluation(
  id: string,
  fields: Partial<Omit<EvaluationRecord, 'id' | 'created_by' | 'created_at'>>
): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from('evaluations').update(fields).eq('id', id);
  return !error;
}

export async function deleteEvaluation(id: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from('evaluations').delete().eq('id', id);
  return !error;
}
