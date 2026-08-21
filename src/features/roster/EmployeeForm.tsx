/**
 * 직원 등록/수정 폼. 비민감 69컬럼은 employees insert/update, 민감값(주민번호·계좌·주소·휴대폰·
 * 비상연락망·개인메일)은 set_sensitive RPC(변경된 키만 payload)로 별도 저장한다.
 * 나이(만)·근속연수는 생년월일/입사일 기반 자동계산(readonly) — derive.ts 와 동일한 공식.
 * 신규직원은 employees insert 로 id 를 받은 뒤 set_sensitive 를 호출한다.
 */
import { useEffect, useMemo, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { getEmployee, createEmployee, updateEmployee, setSensitive } from '../../lib/db';
import { logEvent } from '../../lib/audit';
import { today } from '../../excel/derive';
import { FIELD_GROUPS } from './EmployeeDrawer';

interface EmployeeFormProps {
  /** null = 신규 등록 */
  employeeId: string | null;
  onClose: () => void;
  onSaved: () => void;
}

const DATE_KEYS = new Set([
  '생년월일', '입사일', '그룹입사일', '퇴직일',
  '체류시작일', '체류종료일',
  '근태기준일', '퇴직기준일', '최종이동일', '최종보임일', '직무변경일', '직종전환일',
  '계약시작일', '계약종료일', '수습종료일',
]);
const READONLY_KEYS = new Set(['나이(만)', '근속연수(그룹입사일)', '근속연수(입사일)']);
const SELECT_OPTIONS: Record<string, string[]> = {
  '성별': ['남', '여'],
  '내/외국인': ['내국인', '외국인'],
};
const REQUIRED_KEYS = new Set(['성명', '사번', '입사일']);

type SensitiveField =
  | { kind: 'text'; key: string; label: string; placeholder?: string }
  | { kind: 'acct'; key: 'salary_acct' | 'expense_acct'; label: string }
  | { kind: 'addr'; key: 'addr' | 'reg_addr'; label: string };

const SENSITIVE_FIELDS: SensitiveField[] = [
  { kind: 'text', key: 'ssn', label: '주민번호', placeholder: '000000-0000000' },
  { kind: 'text', key: 'phone', label: '휴대폰', placeholder: '010-0000-0000' },
  { kind: 'text', key: 'email', label: '개인메일', placeholder: 'name@example.com' },
  { kind: 'text', key: 'emergency', label: '비상연락망' },
  { kind: 'acct', key: 'salary_acct', label: '급여계좌' },
  { kind: 'acct', key: 'expense_acct', label: '경비계좌' },
  { kind: 'addr', key: 'addr', label: '현주소' },
  { kind: 'addr', key: 'reg_addr', label: '등본주소' },
];

const SSN_RE = /^\d{6}-\d{7}$/;
const PHONE_RE = /^010-\d{3,4}-\d{4}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const parseD = (s: string | null | undefined): Date | null => {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};
const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86400000);
/** derive.ts 의 _age 공식과 동일 */
const computeAge = (birth: string): string => {
  const b = parseD(birth);
  return b ? String(Math.floor(daysBetween(b, today()) / 365.25)) : '';
};
/** derive.ts 의 _tenure 공식과 동일(퇴직일 있으면 퇴직일 기준) */
const computeTenure = (hire: string, quit: string): string => {
  const h = parseD(hire);
  if (!h) return '';
  const q = parseD(quit);
  const end = q && q < today() ? q : today();
  return (daysBetween(h, end) / 365.25).toFixed(1);
};

export function EmployeeForm({ employeeId, onClose, onSaved }: EmployeeFormProps) {
  const isEdit = !!employeeId;
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [sensitive, setSensitiveForm] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!employeeId) return;
    let cancelled = false;
    setLoading(true);
    getEmployee(employeeId).then((e) => {
      if (cancelled) return;
      if (e) {
        const next: Record<string, string> = {};
        for (const group of FIELD_GROUPS) {
          for (const [, key] of group.fields) {
            const v = (e as unknown as Record<string, unknown>)[key];
            next[key] = v == null ? '' : String(v);
          }
        }
        setForm(next);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [employeeId]);

  const setField = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const setSensitiveField = (key: string, value: string) =>
    setSensitiveForm((s) => ({ ...s, [key]: value }));

  const age = useMemo(() => computeAge(form['생년월일'] || ''), [form['생년월일']]);
  const tenureHire = useMemo(
    () => computeTenure(form['입사일'] || '', form['퇴직일'] || ''),
    [form['입사일'], form['퇴직일']]
  );
  const tenureGroupHire = useMemo(
    () => computeTenure(form['그룹입사일'] || '', form['퇴직일'] || ''),
    [form['그룹입사일'], form['퇴직일']]
  );

  const handleSubmit = async () => {
    setError(null);

    if (!form['성명']?.trim() || !form['사번']?.trim() || !form['입사일']?.trim()) {
      setError('성명·사번·입사일은 필수입니다.');
      return;
    }
    if (sensitive.ssn && !SSN_RE.test(sensitive.ssn)) {
      setError('주민번호 형식이 올바르지 않습니다(000000-0000000).');
      return;
    }
    if (sensitive.phone && !PHONE_RE.test(sensitive.phone)) {
      setError('휴대폰 형식이 올바르지 않습니다(010-0000-0000).');
      return;
    }
    if (sensitive.email && !EMAIL_RE.test(sensitive.email)) {
      setError('이메일 형식이 올바르지 않습니다.');
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, string | number | null> = {};
      for (const group of FIELD_GROUPS) {
        for (const [, key] of group.fields) {
          if (READONLY_KEYS.has(key)) continue;
          const v = form[key]?.trim();
          payload[key] = v ? v : null;
        }
      }
      payload['나이(만)'] = age ? Number(age) : null;
      payload['근속연수(입사일)'] = tenureHire ? Number(tenureHire) : null;
      payload['근속연수(그룹입사일)'] = tenureGroupHire ? Number(tenureGroupHire) : null;

      let id: string | null = employeeId;
      if (isEdit) {
        const ok = await updateEmployee(employeeId!, payload);
        if (!ok) throw new Error('저장에 실패했습니다.');
      } else {
        id = await createEmployee(payload);
        if (!id) throw new Error('등록에 실패했습니다.');
      }

      const sensitivePayload: Record<string, unknown> = {};
      if (sensitive.ssn) sensitivePayload.ssn = sensitive.ssn;
      if (sensitive.phone) sensitivePayload.phone = sensitive.phone;
      if (sensitive.email) sensitivePayload.email = sensitive.email;
      if (sensitive.emergency) sensitivePayload.emergency = sensitive.emergency;
      if (sensitive.salary_acct_bank || sensitive.salary_acct_number || sensitive.salary_acct_owner) {
        sensitivePayload.salary_acct = {
          bank: sensitive.salary_acct_bank || undefined,
          number: sensitive.salary_acct_number || undefined,
          owner: sensitive.salary_acct_owner || undefined,
        };
      }
      if (sensitive.expense_acct_bank || sensitive.expense_acct_number || sensitive.expense_acct_owner) {
        sensitivePayload.expense_acct = {
          bank: sensitive.expense_acct_bank || undefined,
          number: sensitive.expense_acct_number || undefined,
          owner: sensitive.expense_acct_owner || undefined,
        };
      }
      if (sensitive.addr_postal || sensitive.addr_address) {
        sensitivePayload.addr = {
          postal: sensitive.addr_postal || undefined,
          address: sensitive.addr_address || undefined,
        };
      }
      if (sensitive.reg_addr_postal || sensitive.reg_addr_address) {
        sensitivePayload.reg_addr = {
          postal: sensitive.reg_addr_postal || undefined,
          address: sensitive.reg_addr_address || undefined,
        };
      }

      const sensitiveKeyCount = Object.keys(sensitivePayload).length;
      if (sensitiveKeyCount > 0 && id) {
        const ok = await setSensitive(id, sensitivePayload);
        if (!ok) throw new Error('민감정보 저장에 실패했습니다.');
      }

      const changedFields =
        Object.values(payload).filter((v) => v != null).length + sensitiveKeyCount;
      await logEvent(isEdit ? 'update_employee' : 'create_employee', {
        targetId: id ?? undefined,
        targetTable: 'employees',
        meta: { changedFields },
      });

      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white h-full w-full sm:max-w-2xl shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50 sticky top-0 z-10">
          <h3 className="text-base font-bold text-slate-900">
            {isEdit ? '직원 정보 수정' : '직원 추가'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400 text-xs">불러오는 중...</div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmit();
            }}
            className="p-5 space-y-5 text-sm"
          >
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-semibold">
                {error}
              </div>
            )}

            {FIELD_GROUPS.map((group) => (
              <div key={group.title} className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h4 className="text-xs font-bold text-slate-700 mb-3">{group.title}</h4>
                <div className="grid grid-cols-2 gap-3">
                  {group.fields.map(([label, key]) => {
                    if (READONLY_KEYS.has(key)) {
                      const value =
                        key === '나이(만)' ? age : key === '근속연수(입사일)' ? tenureHire : tenureGroupHire;
                      return (
                        <div key={key}>
                          <label className="text-[11px] text-slate-500 block mb-0.5">{label} (자동계산)</label>
                          <input
                            type="text"
                            readOnly
                            value={value || ''}
                            className="w-full px-2 py-1.5 bg-slate-100 border border-slate-200 rounded text-xs text-slate-500"
                          />
                        </div>
                      );
                    }
                    const required = REQUIRED_KEYS.has(key);
                    if (SELECT_OPTIONS[key]) {
                      return (
                        <div key={key}>
                          <label className="text-[11px] text-slate-500 block mb-0.5">
                            {label}{required && ' *'}
                          </label>
                          <select
                            value={form[key] || ''}
                            onChange={(e) => setField(key, e.target.value)}
                            className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="">-</option>
                            {SELECT_OPTIONS[key].map((o) => (
                              <option key={o} value={o}>
                                {o}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    }
                    return (
                      <div key={key}>
                        <label className="text-[11px] text-slate-500 block mb-0.5">
                          {label}{required && ' *'}
                        </label>
                        <input
                          type={DATE_KEYS.has(key) ? 'date' : 'text'}
                          value={form[key] || ''}
                          onChange={(e) => setField(key, e.target.value)}
                          required={required}
                          className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="bg-rose-50/50 p-4 rounded-xl border border-rose-200">
              <h4 className="text-xs font-bold text-rose-800 mb-1">민감정보</h4>
              <p className="text-[10px] text-rose-600/80 mb-3">
                비워두면 기존 값이 그대로 유지됩니다. 변경할 항목만 입력하세요.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {SENSITIVE_FIELDS.map((f) => {
                  if (f.kind === 'text') {
                    return (
                      <div key={f.key}>
                        <label className="text-[11px] text-slate-500 block mb-0.5">{f.label}</label>
                        <input
                          type="text"
                          placeholder={f.placeholder}
                          value={sensitive[f.key] || ''}
                          onChange={(e) => setSensitiveField(f.key, e.target.value)}
                          className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    );
                  }
                  if (f.kind === 'acct') {
                    return (
                      <div key={f.key} className="col-span-2 grid grid-cols-3 gap-2">
                        <div className="col-span-3 text-[11px] text-slate-500">{f.label}</div>
                        <input
                          type="text"
                          placeholder="은행"
                          value={sensitive[`${f.key}_bank`] || ''}
                          onChange={(e) => setSensitiveField(`${f.key}_bank`, e.target.value)}
                          className="px-2 py-1.5 bg-white border border-slate-200 rounded text-xs"
                        />
                        <input
                          type="text"
                          placeholder="계좌번호"
                          value={sensitive[`${f.key}_number`] || ''}
                          onChange={(e) => setSensitiveField(`${f.key}_number`, e.target.value)}
                          className="px-2 py-1.5 bg-white border border-slate-200 rounded text-xs"
                        />
                        <input
                          type="text"
                          placeholder="예금주"
                          value={sensitive[`${f.key}_owner`] || ''}
                          onChange={(e) => setSensitiveField(`${f.key}_owner`, e.target.value)}
                          className="px-2 py-1.5 bg-white border border-slate-200 rounded text-xs"
                        />
                      </div>
                    );
                  }
                  return (
                    <div key={f.key} className="col-span-2 grid grid-cols-3 gap-2">
                      <div className="col-span-3 text-[11px] text-slate-500">{f.label}</div>
                      <input
                        type="text"
                        placeholder="우편번호"
                        value={sensitive[`${f.key}_postal`] || ''}
                        onChange={(e) => setSensitiveField(`${f.key}_postal`, e.target.value)}
                        className="px-2 py-1.5 bg-white border border-slate-200 rounded text-xs"
                      />
                      <input
                        type="text"
                        placeholder="주소"
                        value={sensitive[`${f.key}_address`] || ''}
                        onChange={(e) => setSensitiveField(`${f.key}_address`, e.target.value)}
                        className="col-span-2 px-2 py-1.5 bg-white border border-slate-200 rounded text-xs"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 pb-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs transition-colors"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs shadow-xs transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                저장
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
