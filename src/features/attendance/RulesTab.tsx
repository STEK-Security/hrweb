/**
 * 근태관리 '규칙' 탭 — 근무형태(GET/PUT /shift-types), 공휴일(GET/PUT /holidays), 계산 규칙 새 버전(GET/POST /rules).
 * 검증 범위는 Worker admin.ts RANGES·validateRules 와 같게 둔다. "이 규칙으로 계산하면" 미리 계산은 하지 않는다(엔진이 다른 레포).
 */
import { useCallback, useEffect, useState } from 'react';
import { Plus, Save, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { att } from '../../lib/attendance';
import { logEvent } from '../../lib/audit';
import { errorText } from './labels';
import { ampm } from './pattern';

interface ShiftType { code: string; name: string; kind: 'work' | 'weekly_holiday' | 'rest'; start: string | null; end: string | null; fri_start: string | null; fri_end: string | null; breaks: string; color: string | null }
interface Holiday { date: string; name: string }
interface Rules { overtimeMode: 'measured' | 'approved'; roundUnitMin: number; nightIncludesBreaks: boolean; punchWindowBeforeMin: number; punchWindowAfterMin: number; closeDay: number }
interface RuleVersion { id: number; effective_month: string; created_by: string | null; created_at: string }

const card = 'bg-white rounded-xl border border-slate-200 shadow-xs';
const input = 'border border-slate-200 rounded-md px-2 py-1 text-xs bg-white';
const btn = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
const KINDS = { work: '근무', weekly_holiday: '주휴', rest: '휴일' } as const;
const ROUND_UNITS = [1, 5, 10, 15, 30, 60];
const kstNow = () => new Date(Date.now() + 9 * 3600_000).toISOString();

/** breaks JSON ↔ '12:00-13:00, 00:00-01:00' */
const breaksText = (json: string) => {
  try { return (JSON.parse(json) as { start: string; end: string }[]).map((b) => `${b.start}-${b.end}`).join(', '); } catch { return ''; }
};
const parseBreaks = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean).map((x) => {
  const [start, end] = x.split('-').map((y) => y.trim());
  return { start, end };
});

const Msg = ({ error, msg }: { error: string; msg: string }) => (
  <>
    {error && <p role="alert" className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}
    {msg && <p role="status" className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{msg}</p>}
  </>
);

export function RulesTab() {
  return (
    <div className="space-y-4">
      <ShiftTypes />
      <div className="grid gap-4 lg:grid-cols-2">
        <RuleForm />
        <Holidays />
      </div>
    </div>
  );
}

function ShiftTypes() {
  const [rows, setRows] = useState<(ShiftType & { breaksText: string; isNew?: boolean })[] | null>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    att<ShiftType[]>('GET', '/api/admin/shift-types')
      .then((r) => setRows(r.map((x) => ({ ...x, breaksText: breaksText(x.breaks) }))))
      .catch((e) => { setRows([]); setError(errorText(e)); });
  }, []);
  useEffect(load, [load]);

  const set = (i: number, patch: Partial<ShiftType & { breaksText: string }>) => setRows((rs) => rs && rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const save = async () => {
    if (!rows?.length) return;
    setBusy(true);
    setError('');
    setMsg('');
    try {
      const body = { rows: rows.map((r) => ({ code: r.code.trim(), name: r.name.trim(), kind: r.kind, start: r.start || null, end: r.end || null, fri_start: r.fri_start || null, fri_end: r.fri_end || null, breaks: parseBreaks(r.breaksText), color: r.color || null })) };
      const res = await att<{ note?: string }>('PUT', '/api/admin/shift-types', { body });
      await logEvent('attendance.rules', { meta: { op: 'shift_types', rows: body.rows.length } });
      setMsg(`근무형태를 저장했습니다. ${res.note ?? ''}`);
      load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const time = (i: number, k: 'start' | 'end' | 'fri_start' | 'fri_end', v: string | null, label: string) => (
    <div>
      <input type="time" aria-label={label} value={v ?? ''} onChange={(e) => set(i, { [k]: e.target.value || null })} className={`${input} w-24`} />
      <span className="block text-[10px] text-slate-500 mt-0.5">{ampm(v) || '\u00a0'}</span>
    </div>
  );

  return (
    <section className={`${card} min-w-0`} aria-label="근무형태">
      <div className="flex items-center gap-2 flex-wrap p-3 border-b border-slate-100">
        <h2 className="text-sm font-bold text-slate-800">근무형태</h2>
        <span className="text-[11px] text-slate-400">휴게는 '12:00-13:00, 00:00-01:00' 처럼 · 저장하면 열린 달을 다시 계산합니다</span>
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={() => setRows((rs) => [...(rs ?? []), { code: '', name: '', kind: 'work', start: null, end: null, fri_start: null, fri_end: null, breaks: '[]', color: null, breaksText: '', isNew: true }])}
            className={`${btn} border border-slate-200 bg-white hover:bg-slate-50 text-slate-700`}>
            <Plus className="w-3.5 h-3.5" /> 추가
          </button>
          <button type="button" onClick={save} disabled={busy || !rows?.length} className={`${btn} bg-blue-600 hover:bg-blue-700 text-white`}>
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} 저장
          </button>
        </div>
      </div>
      <div className="p-3 space-y-2"><Msg error={error} msg={msg} /></div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr className="text-left">{['코드', '이름', '종류', '시업', '종업', '금 시업', '금 종업', '휴게'].map((h) => <th key={h} className="px-2 py-2 font-semibold whitespace-nowrap">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {!rows ? <tr><td colSpan={8} className="p-6 text-center text-slate-400">불러오는 중…</td></tr>
              : rows.map((r, i) => (
                <tr key={i}>
                  <td className="px-2 py-1.5">
                    {r.isNew ? <input aria-label="코드" value={r.code} onChange={(e) => set(i, { code: e.target.value })} className={`${input} w-24`} /> : <span className="font-semibold">{r.code}</span>}
                  </td>
                  <td className="px-2 py-1.5"><input aria-label={`${r.code} 이름`} value={r.name} onChange={(e) => set(i, { name: e.target.value })} className={`${input} w-28`} /></td>
                  <td className="px-2 py-1.5">
                    <select aria-label={`${r.code} 종류`} value={r.kind} onChange={(e) => set(i, { kind: e.target.value as ShiftType['kind'] })} className={input}>
                      {Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1.5">{time(i, 'start', r.start, `${r.code} 시업`)}</td>
                  <td className="px-2 py-1.5">{time(i, 'end', r.end, `${r.code} 종업`)}</td>
                  <td className="px-2 py-1.5">{time(i, 'fri_start', r.fri_start, `${r.code} 금요일 시업`)}</td>
                  <td className="px-2 py-1.5">{time(i, 'fri_end', r.fri_end, `${r.code} 금요일 종업`)}</td>
                  <td className="px-2 py-1.5"><input aria-label={`${r.code} 휴게`} value={r.breaksText} onChange={(e) => set(i, { breaksText: e.target.value })} className={`${input} w-44`} /></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RuleForm() {
  const [month, setMonth] = useState(() => kstNow().slice(0, 7));
  const [rules, setRules] = useState<Rules | null>(null);
  const [versions, setVersions] = useState<RuleVersion[]>([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return;
    let ok = true;
    att<{ effective: Rules; versions: RuleVersion[] }>('GET', '/api/admin/rules', { query: { ym: month } })
      .then((r) => { if (ok) { setRules(r.effective); setVersions(r.versions); } })
      .catch((e) => ok && setError(errorText(e)));
    return () => { ok = false; };
  }, [month, reload]);

  const num = (k: 'punchWindowBeforeMin' | 'punchWindowAfterMin' | 'closeDay', label: string, min: number, max: number, unit: string) => rules && (
    <label className="block text-xs font-semibold text-slate-600">
      {label}
      <span className="mt-1 flex items-center gap-1.5">
        <input type="number" min={min} max={max} step={1} required value={rules[k]} onChange={(e) => setRules({ ...rules, [k]: e.target.valueAsNumber })} className={`${input} w-24 text-sm`} />
        <span className="font-normal text-slate-400">{unit} ({min}~{max})</span>
      </span>
    </label>
  );

  const save = async () => {
    if (!rules) return;
    if (!window.confirm(`${month}부터 적용할 새 규칙 버전을 저장하시겠습니까?\n열린 달은 새 규칙으로 다시 계산합니다.`)) return;
    setBusy(true);
    setError('');
    setMsg('');
    try {
      const { overtimeMode, roundUnitMin, nightIncludesBreaks, punchWindowBeforeMin, punchWindowAfterMin, closeDay } = rules;
      const body = { effective_month: month, rules: { overtimeMode, roundUnitMin, nightIncludesBreaks, punchWindowBeforeMin, punchWindowAfterMin, closeDay } };
      const res = await att<{ id: number; note?: string }>('POST', '/api/admin/rules', { body });
      await logEvent('attendance.rules', { meta: { month, op: 'rules', id: res.id, ...body.rules } });
      setMsg(`규칙 버전 #${res.id} 를 저장했습니다. ${res.note ?? ''}`);
      setReload((n) => n + 1);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`${card} p-4 space-y-3`} aria-label="계산 규칙">
      <h2 className="text-sm font-bold text-slate-800">계산 규칙</h2>
      <Msg error={error} msg={msg} />
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <label className="block text-xs font-semibold text-slate-600">
          적용 시작 월
          <input type="month" required value={month} onChange={(e) => { setMonth(e.target.value); setError(''); }} className={`${input} mt-1 block text-sm`} />
        </label>
        {!rules ? <p className="text-xs text-slate-400">불러오는 중…</p> : (
          <>
            <fieldset className="text-xs font-semibold text-slate-600">
              <legend>연장근로 인정</legend>
              <div className="mt-1 flex gap-4 font-normal">
                {([['measured', '실측 (시업 이후 실근로 전부)'], ['approved', '기안 (승인분만)']] as const).map(([v, l]) => (
                  <label key={v} className="flex items-center gap-1.5"><input type="radio" name="overtimeMode" checked={rules.overtimeMode === v} onChange={() => setRules({ ...rules, overtimeMode: v })} /> {l}</label>
                ))}
              </div>
            </fieldset>
            <label className="block text-xs font-semibold text-slate-600">
              단수 처리 (일별 버림 단위)
              <select value={rules.roundUnitMin} onChange={(e) => setRules({ ...rules, roundUnitMin: +e.target.value })} className={`${input} mt-1 block text-sm`}>
                {ROUND_UNITS.map((u) => <option key={u} value={u}>{u === 1 ? '없음 (1분)' : `${u}분 버림`}</option>)}
              </select>
            </label>
            {rules.roundUnitMin > 1 && (
              <p role="alert" className="flex gap-1.5 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                일 단위 {rules.roundUnitMin}분 버림은 근로자에게 불리한 절사라 임금 전액지급(근로기준법 제43조) 위반 소지가 큽니다. 지각 몇 분에 기본시간이 {rules.roundUnitMin}분 깎일 수 있습니다. 노무사 확인 후 사용하세요.
              </p>
            )}
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <input type="checkbox" checked={rules.nightIncludesBreaks} onChange={(e) => setRules({ ...rules, nightIncludesBreaks: e.target.checked })} /> 휴게와 겹친 야간도 야간으로 인정
            </label>
            <div className="grid grid-cols-2 gap-3">
              {num('punchWindowBeforeMin', '출근 인정 범위 (시업 전)', 0, 720, '분')}
              {num('punchWindowAfterMin', '퇴근 인정 범위 (종업 후)', 0, 720, '분')}
            </div>
            {num('closeDay', '자동 마감일 (매월)', 1, 28, '일')}
            <button type="submit" disabled={busy} className={`${btn} bg-blue-600 hover:bg-blue-700 text-white`}>
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} 새 버전 저장
            </button>
          </>
        )}
      </form>
      {versions.length > 0 && (
        <details className="text-xs text-slate-600">
          <summary className="cursor-pointer font-semibold">저장된 버전 {versions.length}개</summary>
          <ul className="mt-2 space-y-1">
            {versions.map((v) => <li key={v.id} className="tabular-nums">#{v.id} · {v.effective_month}부터 · {v.created_by ?? '—'} · {v.created_at.slice(0, 16)}</li>)}
          </ul>
        </details>
      )}
    </section>
  );
}

function Holidays() {
  const [year, setYear] = useState(() => +kstNow().slice(0, 4));
  const [rows, setRows] = useState<Holiday[] | null>(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let ok = true;
    setRows(null);
    setError('');
    att<Holiday[]>('GET', '/api/admin/holidays', { query: { year: String(year) } })
      .then((r) => ok && setRows(r))
      .catch((e) => { if (ok) { setRows([]); setError(errorText(e)); } });
    return () => { ok = false; };
  }, [year, reload]);

  const set = (i: number, patch: Partial<Holiday>) => setRows((rs) => rs && rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const save = async () => {
    if (!rows) return;
    if (!window.confirm(`${year}년 공휴일 ${rows.length}일로 바꾸시겠습니까?\n바뀐 날은 열린 달만 다시 계산합니다(마감 달은 바꿀 수 없음).`)) return;
    setBusy(true);
    setError('');
    setMsg('');
    try {
      const body = { year, rows: rows.map((r) => ({ date: r.date, name: r.name.trim() })).sort((a, b) => a.date.localeCompare(b.date)) };
      const res = await att<{ note?: string }>('PUT', '/api/admin/holidays', { body });
      await logEvent('attendance.rules', { meta: { year, op: 'holidays', rows: body.rows.length } });
      setMsg(`공휴일을 저장했습니다. ${res.note ?? ''}`);
      setReload((n) => n + 1);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`${card} p-4 space-y-3 min-w-0`} aria-label="공휴일">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-sm font-bold text-slate-800">공휴일</h2>
        <select aria-label="연도" value={year} onChange={(e) => setYear(+e.target.value)} className={input}>
          {[-1, 0, 1].map((d) => { const y = +kstNow().slice(0, 4) + d; return <option key={y} value={y}>{y}년</option>; })}
        </select>
        <div className="ml-auto flex gap-2">
          <button type="button" disabled={!rows} onClick={() => setRows((rs) => [...(rs ?? []), { date: `${year}-01-01`, name: '' }])} className={`${btn} border border-slate-200 bg-white hover:bg-slate-50 text-slate-700`}>
            <Plus className="w-3.5 h-3.5" /> 추가
          </button>
          <button type="button" onClick={save} disabled={busy || !rows} className={`${btn} bg-blue-600 hover:bg-blue-700 text-white`}>
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} 저장
          </button>
        </div>
      </div>
      <Msg error={error} msg={msg} />
      <div className="max-h-96 overflow-y-auto">
        {!rows ? <p className="text-xs text-slate-400">불러오는 중…</p> : rows.length === 0 ? <p className="text-xs text-slate-400">공휴일이 없습니다.</p> : (
          <ul className="space-y-1.5">
            {rows.map((r, i) => (
              <li key={i} className="flex items-center gap-2">
                <input type="date" aria-label="날짜" min={`${year}-01-01`} max={`${year}-12-31`} value={r.date} onChange={(e) => set(i, { date: e.target.value })} className={input} />
                <input aria-label="이름" placeholder="이름" value={r.name} onChange={(e) => set(i, { name: e.target.value })} className={`${input} flex-1 min-w-0`} />
                <button type="button" aria-label={`${r.date} 삭제`} onClick={() => setRows((rs) => rs && rs.filter((_, j) => j !== i))} className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
