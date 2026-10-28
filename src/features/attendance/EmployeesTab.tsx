/** 근태관리 '직원 설정' 탭 — GET /employees, PATCH /employees/:sabun, POST /accounts/:sabun/reset. */
import { useCallback, useEffect, useState } from 'react';
import { att, syncEmployees } from '../../lib/attendance';
import { logEvent } from '../../lib/audit';
import { supabase } from '../../lib/supabase';
import { errorText } from './labels';

/** 직원 설정에 보일 상위 조직. 하위 팀(생산관리팀·QM 등)은 전체소속명 경로로 함께 잡힌다. */
const SCOPE_DEPTS = ['생산본부', '품질팀'];

interface Emp {
  sabun: string;
  name: string;
  dept: string | null;
  dept_path: string | null;
  title: string | null;
  retire_date: string | null;
  site: string | null;
  night_consent: number;
  attendance_target: number;
  approver_override: string | null;
  /** 실제 승인자 사번 또는 'HR' (Worker 계산: 지정값 > 직원명부 팀장 > 인사팀) */
  approver: string;
  shift_group: string | null;
  has_account: number;
}

export function EmployeesTab() {
  const [emps, setEmps] = useState<Emp[] | null>(null);
  const [groups, setGroups] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const [showRetired, setShowRetired] = useState(false); // 기본은 퇴사자 숨김
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [edit, setEdit] = useState<Emp | null>(null);
  const [draft, setDraft] = useState({ group: '', target: false, night: false, approver: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    att<Emp[]>('GET', '/api/admin/employees').then(setEmps).catch((e) => { setEmps([]); setError(errorText(e)); });
  }, []);
  useEffect(load, [load]);
  useEffect(() => {
    supabase?.from('attendance_shift_patterns').select('group_name').order('group_name').then(({ data }) => setGroups((data ?? []).map((r) => r.group_name as string)));
  }, []);

  const open = (e: Emp) => {
    setEdit(e);
    setError('');
    setDraft({ group: e.shift_group ?? '', target: !!e.attendance_target, night: !!e.night_consent, approver: e.approver_override ?? '' });
  };

  const save = async () => {
    if (!edit) return;
    setBusy(true);
    setError('');
    try {
      const body = { shift_group: draft.group || null, attendance_target: draft.target, night_consent: draft.night, approver_override: draft.approver.trim() || null };
      await att('PATCH', `/api/admin/employees/${edit.sabun}`, { body });
      await logEvent('attendance.employee', { meta: { sabun: edit.sabun, op: 'patch', ...body } });
      setEdit(null);
      load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const reset = async (e: Emp) => {
    if (!window.confirm(`${e.name}(${e.sabun}) 비밀번호를 초기화하시겠습니까? 기존 로그인 세션이 끊깁니다.`)) return;
    setError('');
    try {
      await att('POST', `/api/admin/accounts/${e.sabun}/reset`);
      await logEvent('attendance.employee', { meta: { sabun: e.sabun, op: 'reset_password' } });
      setMsg(`${e.name} 비밀번호를 초기화했습니다.`);
      load();
    } catch (err) {
      setError(errorText(err));
    }
  };

  const sync = async () => {
    setBusy(true);
    setError('');
    setMsg('');
    try {
      const r = await syncEmployees();
      await logEvent('attendance.employee', { meta: { op: 'sync', upserted: r.upserted, rejected: r.rejected.length } });
      setMsg(`직원명부 ${r.total}명 중 ${r.upserted}명을 반영했습니다(새 계정 ${r.accountsCreated}개).`
        + (r.skippedNoLoginId ? ` 그룹웨어ID 없음 ${r.skippedNoLoginId}명 제외.` : '')
        + (r.rejected.length ? ` 거부 ${r.rejected.length}건: ${r.rejected.slice(0, 3).map((x) => `${x.sabun} ${x.reason}`).join(', ')}` : '')
        + (r.conflicts.length ? ` 재직자끼리 로그인 ID 가 겹침(최근 입사자만 로그인 가능 — 직원명부 그룹웨어ID 확인): ${r.conflicts.map((c) => c.join('·')).join(', ')}` : ''));
      load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  // 근태 대상은 천안 근무자 중 생산본부·품질팀(하위 조직 포함) — 직원명부 근무지·전체소속명 기준
  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10); // KST
  const inScope = (e: Emp) => (e.dept_path ?? '').split(' > ').some((d) => SCOPE_DEPTS.includes(d.trim()));
  const retired = (e: Emp) => !!e.retire_date && e.retire_date < today; // 퇴직일이 지난 사람만(퇴직 예정자는 재직)
  const shown = emps?.filter((e) => e.site === '천안' && inScope(e) && (showRetired || !retired(e)) && (!q || `${e.sabun} ${e.name} ${e.dept ?? ''}`.includes(q.trim())));
  const nameOf = (sabun: string) => (sabun === 'HR' ? '인사팀' : emps?.find((x) => x.sabun === sabun)?.name ?? sabun);
  const approverText = (e: Emp) => `${nameOf(e.approver)} (${e.approver_override ? '지정' : e.approver === 'HR' ? '팀장 없음' : '팀장 자동'})`;
  const unknownGroup = !!draft.group && !groups.includes(draft.group);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input aria-label="직원 검색" placeholder="사번·이름·부서 검색" value={q} onChange={(e) => setQ(e.target.value)}
          className="w-full sm:w-64 border border-slate-200 rounded-lg px-3 py-1.5 text-sm" />
        <button type="button" onClick={sync} disabled={busy}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs shadow-xs transition-colors disabled:opacity-50 cursor-pointer">
          {busy ? '가져오는 중…' : '직원명부에서 가져오기'}
        </button>
        <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
          <input type="checkbox" checked={showRetired} onChange={(e) => setShowRetired(e.target.checked)} className="w-4 h-4" />
          퇴사자 보기
        </label>
        <span className="text-[11px] text-slate-500">사번·이름·그룹웨어ID·소속·직책·입사/퇴직일·근무지·성별·출생연도만 보냅니다.</span>
      </div>
      {error && <p role="alert" className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}
      {msg && <p role="status" className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{msg}</p>}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr className="text-left">{['사번', '이름', '부서', '근무조', '근태 대상', '야간 동의', '승인자', ''].map((h) => <th key={h} className="px-3 py-2 font-semibold whitespace-nowrap">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shown === undefined || shown === null ? <tr><td colSpan={8} className="p-6 text-center text-slate-400">불러오는 중…</td></tr>
              : shown.length === 0 ? <tr><td colSpan={8} className="p-6 text-center text-slate-400">직원이 없습니다.</td></tr>
              : shown.map((e) => (
                <tr key={e.sabun} className={e.retire_date ? 'text-slate-400' : ''}>
                  <td className="px-3 py-2 whitespace-nowrap">{e.sabun}</td>
                  <td className="px-3 py-2 whitespace-nowrap font-semibold">{e.name}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{e.dept ?? '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{e.shift_group ?? '없음'}</td>
                  <td className="px-3 py-2">{e.attendance_target ? 'O' : '—'}</td>
                  <td className="px-3 py-2">{e.night_consent ? 'O' : '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{approverText(e)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <button type="button" onClick={() => open(e)} className="px-2.5 py-1 rounded-md border border-slate-200 font-semibold text-slate-700 cursor-pointer">편집</button>{' '}
                    <button type="button" onClick={() => reset(e)} disabled={!e.has_account} className="px-2.5 py-1 rounded-md border border-slate-200 font-semibold text-slate-700 cursor-pointer disabled:opacity-40">비밀번호 초기화</button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {edit && (
        <div role="dialog" aria-modal="true" aria-label={`${edit.name} 설정`} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
          onKeyDown={(e) => e.key === 'Escape' && setEdit(null)}>
          <form className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5 space-y-3" onSubmit={(e) => { e.preventDefault(); save(); }}>
            <h2 className="text-sm font-bold text-slate-900">{edit.name} ({edit.sabun}) 근태 설정</h2>
            <label className="block text-xs font-semibold text-slate-600">
              근무조
              <select value={draft.group} onChange={(e) => setDraft({ ...draft, group: e.target.value })} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-normal">
                <option value="">없음</option>
                {unknownGroup && <option value={draft.group}>{draft.group} (패턴 없음)</option>}
                {groups.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <input type="checkbox" checked={draft.target} onChange={(e) => setDraft({ ...draft, target: e.target.checked })} /> 근태 대상
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <input type="checkbox" checked={draft.night} onChange={(e) => setDraft({ ...draft, night: e.target.checked })} /> 야간근로 동의
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              승인자 (사번 또는 HR, 비우면 직원명부 팀장 자동 — 지금: {approverText(edit)})
              <input list="att-approvers" value={draft.approver} onChange={(e) => setDraft({ ...draft, approver: e.target.value })} className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-normal" />
              <datalist id="att-approvers">
                <option value="HR">인사팀</option>
                {emps?.filter((x) => !x.retire_date && x.sabun !== edit.sabun).map((x) => <option key={x.sabun} value={x.sabun}>{x.name}</option>)}
              </datalist>
            </label>
            {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEdit(null)} className="px-3 py-1.5 text-xs font-semibold text-slate-600 cursor-pointer">취소</button>
              <button type="submit" disabled={busy} className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-xs font-semibold cursor-pointer disabled:opacity-50">저장</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
