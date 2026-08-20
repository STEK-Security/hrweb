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

/** employees 전체 조회 → 제외 규칙 적용 후 파생필드까지 붙여 반환. */
export async function listEmployees(): Promise<Employee[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('employees').select('*');
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

/** 휴직 기록 전체 조회. */
export async function listLeave(): Promise<LeaveRecord[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('leave_records').select('*');
  if (error || !data) return [];
  return data as LeaveRecord[];
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
