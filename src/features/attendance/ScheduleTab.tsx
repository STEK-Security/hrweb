/**
 * 근태관리 '근무표' 탭 — 근무조 28일 패턴(Supabase attendance_shift_patterns)을 편집하고
 * 기간을 정해 Worker `PUT /api/admin/schedules` 로 500행씩 적용한다. 스펙 11.7.
 * 오늘 이전·마감 달·직접 수정한 칸은 덮어쓰지 않는다(pattern.ts).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Plus, Save, Users } from 'lucide-react';
import { att } from '../../lib/attendance';
import { logEvent } from '../../lib/audit';
import { supabase } from '../../lib/supabase';
import { errorText, shiftYm } from './labels';
import { CODE_LABELS, addDays, buildCells, cycle, type PatternRow } from './pattern';

interface PatternDb {
  group_name: string;
  anchor_date: string;
  pattern: string[];
}
interface Emp {
  sabun: string;
  name: string;
  shift_group: string | null;
  attendance_target: number;
  retire_date: string | null;
}
interface MonthRow {
  ym: string;
  status: string;
}
interface SchedRow {
  sabun: string;
  work_date: string;
  shift_code: string;
  note: string | null;
}
interface Preview {
  rows: PatternRow[];
  skipped: { past: number; closed: number; manual: number; same: number };
  people: number;
}

const TABLE = 'attendance_shift_patterns';
const CHUNK = 500; // Worker PUT /schedules 상한
const MAX_DAYS = 92;
const WD = ['일', '월', '화', '수', '목', '금', '토'];
const card = 'bg-white rounded-xl border border-slate-200 shadow-xs';
const inputCls = 'px-2 py-1.5 rounded-md border border-slate-300 bg-white text-xs font-semibold text-slate-700 focus:ring-1 focus:ring-blue-500';
const TONE: Record<string, string> = {
  DAY: 'bg-blue-50 text-blue-700 border-blue-200',
  NIGHT: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  REST: 'bg-slate-100 text-slate-500 border-slate-200',
};
const SKIP_LABELS: Record<keyof Preview['skipped'], string> = {
  past: '지난 날',
  closed: '마감 달',
  manual: '개별 수정한 칸',
  same: '이미 같은 값',
};

const todayKst = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);

export function ScheduleTab() {
  const today = todayKst();
  const [patterns, setPatterns] = useState<PatternDb[]>([]);
  const [emps, setEmps] = useState<Emp[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ pattern: string[]; anchor: string } | null>(null);
  const [newName, setNewName] = useState('');
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(() => addDays(`${shiftYm(today.slice(0, 7), 2)}-01`, -1));
  const [holidayAsRest, setHolidayAsRest] = useState(true);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const loadPatterns = useCallback(async () => {
    if (!supabase) return setError('Supabase 미연결');
    const { data, error: e } = await supabase.from(TABLE).select('group_name, anchor_date, pattern').order('group_name');
    if (e) return setError(e.message);
    setPatterns(data as PatternDb[]);
  }, []);

  useEffect(() => {
    loadPatterns();
    att<Emp[]>('GET', '/api/admin/employees')
      .then(setEmps)
      .catch((e) => setError(errorText(e)));
  }, [loadPatterns]);

  const current = patterns.find((p) => p.group_name === selected) ?? null;
  // 선택이 바뀌거나 저장본이 다시 로드되면 편집본을 저장본으로 맞춘다.
  useEffect(() => {
    setDraft(current && { pattern: [...current.pattern], anchor: current.anchor_date });
    setPreview(null);
  }, [current]);
  useEffect(() => {
    if (!selected && patterns.length) setSelected(patterns[0].group_name);
  }, [patterns, selected]);

  const active = (e: Emp) => !e.retire_date || e.retire_date >= today;
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of emps ?? []) if (e.shift_group && active(e)) m.set(e.shift_group, (m.get(e.shift_group) ?? 0) + 1);
    return m;
  }, [emps]); // today 는 화면을 연 동안 같다고 본다
  const unassigned = (emps ?? []).filter((e) => !e.shift_group && e.attendance_target === 1 && active(e)).length;

  const dirty = !!current && !!draft && (draft.anchor !== current.anchor_date || draft.pattern.some((c, i) => c !== current.pattern[i]));

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const addGroup = () =>
    run(async () => {
      const name = newName.trim();
      // Worker shift_group 상한 20자
      if (!name || name.length > 20) throw new Error('근무조 이름을 1~20자로 입력하세요.');
      if (patterns.some((p) => p.group_name === name)) throw new Error('이미 있는 근무조입니다.');
      const { error: e } = await supabase!.from(TABLE).insert({ group_name: name, anchor_date: draft?.anchor ?? '2026-11-02', pattern: Array(28).fill('REST') });
      if (e) throw new Error(e.message);
      await logEvent('attendance.pattern', { meta: { group: name, op: 'create' } });
      setNewName('');
      await loadPatterns();
      setSelected(name);
    });

  const savePattern = () =>
    run(async () => {
      if (!current || !draft) return;
      const { error: e } = await supabase!.from(TABLE).update({ anchor_date: draft.anchor, pattern: draft.pattern }).eq('group_name', current.group_name);
      if (e) throw new Error(e.message);
      await logEvent('attendance.pattern', { meta: { group: current.group_name, anchor: draft.anchor } });
      await loadPatterns();
      setMsg('패턴을 저장했습니다.');
    });

  const sabuns = useMemo(
    () => (emps ?? []).filter((e) => e.shift_group === selected && (!e.retire_date || e.retire_date >= from)).map((e) => e.sabun),
    [emps, selected, from],
  );

  const makePreview = () =>
    run(async () => {
      if (!current || !draft) return;
      if (!from || !to || from > to) throw new Error('적용 기간을 확인하세요.');
      if (addDays(from, MAX_DAYS) <= to) throw new Error(`적용 기간은 최대 ${MAX_DAYS}일입니다.`);
      if (!sabuns.length) throw new Error('이 근무조에 지정된 직원이 없습니다. 직원 설정 탭에서 근무조를 지정하세요.');
      const yms: string[] = [];
      for (let ym = from.slice(0, 7); ym <= to.slice(0, 7); ym = shiftYm(ym, 1)) yms.push(ym);
      const years = [...new Set(yms.map((y) => y.slice(0, 4)))];
      const [months, hols, scheds] = await Promise.all([
        att<MonthRow[]>('GET', '/api/admin/months'),
        Promise.all(years.map((year) => att<{ date: string }[]>('GET', '/api/admin/holidays', { query: { year } }))),
        Promise.all(yms.map((ym) => att<SchedRow[]>('GET', '/api/admin/schedules', { query: { ym } }))),
      ]);
      const holidays = new Set(hols.flat().map((h) => h.date));
      const mine = new Set(sabuns);
      const existing = scheds.flat().filter((r) => mine.has(r.sabun));
      const r = buildCells(draft.pattern, draft.anchor, from, to, sabuns, existing, {
        group: current.group_name,
        holidays,
        holidayAsRest,
        today,
        closedYms: new Set(months.filter((m) => m.status !== 'open').map((m) => m.ym)),
      });
      setPreview({ ...r, people: sabuns.length });
    });

  const apply = () =>
    run(async () => {
      if (!current || !draft || !preview) return;
      const rows = preview.rows;
      setProgress({ done: 0, total: rows.length });
      for (let i = 0; i < rows.length; i += CHUNK) {
        try {
          await att('PUT', '/api/admin/schedules', { body: { rows: rows.slice(i, i + CHUNK) } });
        } catch (err) {
          setPreview(null); // 일부 저장됨 — 다시 미리보기해야 남은 칸만 보낸다
          throw new Error(`${i}/${rows.length}칸 저장 후 실패: ${errorText(err)}`);
        }
        setProgress({ done: Math.min(i + CHUNK, rows.length), total: rows.length });
      }
      await logEvent('attendance.schedule', { meta: { group: current.group_name, from, to, rows: rows.length, skipped: preview.skipped } });
      setPreview(null);
      setMsg(`${rows.length}칸을 저장했습니다.`);
    }).finally(() => setProgress(null));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4">
      {/* 근무조 목록 */}
      <div className={`${card} p-3 space-y-2 self-start`}>
        <p className="text-xs font-bold text-slate-500 px-1">근무조</p>
        <ul className="space-y-1">
          {patterns.map((p) => (
            <li key={p.group_name}>
              <button
                type="button"
                onClick={() => setSelected(p.group_name)}
                aria-pressed={selected === p.group_name}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-sm font-semibold cursor-pointer ${
                  selected === p.group_name ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {p.group_name}
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                  <Users className="w-3 h-3" />
                  {emps ? (counts.get(p.group_name) ?? 0) : '-'}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-1 pt-1 border-t border-slate-100">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="새 근무조" aria-label="새 근무조 이름" className={`${inputCls} flex-1 min-w-0`} />
          <button type="button" onClick={addGroup} disabled={busy} aria-label="근무조 추가" className="p-1.5 rounded-md border border-slate-200 hover:bg-slate-50 text-slate-600 disabled:opacity-50 cursor-pointer">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        {unassigned > 0 && (
          <p className="flex items-start gap-1.5 p-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] font-semibold text-amber-700">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
            근무조 미지정 근태 대상 {unassigned}명 — 직원 설정 탭에서 지정하세요.
          </p>
        )}
      </div>

      <div className="space-y-4 min-w-0">
        {error && (
          <div role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-semibold">
            {error}
          </div>
        )}
        {msg && (
          <div role="status" className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 font-semibold">
            {msg}
          </div>
        )}

        {current && draft && (
          <>
            {/* 28일 패턴 */}
            <div className={`${card} p-4 space-y-3`}>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-bold text-slate-900">{current.group_name} 28일 패턴</h2>
                <label className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                  1일차 기준일
                  <input type="date" value={draft.anchor} onChange={(e) => e.target.value && setDraft({ ...draft, anchor: e.target.value })} className={inputCls} />
                </label>
                <button
                  type="button"
                  onClick={savePattern}
                  disabled={busy || !dirty}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold disabled:opacity-50 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  저장
                </button>
              </div>
              <p className="text-[11px] text-slate-500">칸을 누르면 주간 → 야간 → 휴일 순으로 바뀝니다.</p>
              <div className="grid grid-cols-7 gap-1.5">
                {draft.pattern.map((c, i) => {
                  const wd = WD[new Date(`${addDays(draft.anchor, i)}T00:00:00Z`).getUTCDay()];
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setDraft({ ...draft, pattern: draft.pattern.map((x, j) => (j === i ? cycle(x) : x)) })}
                      aria-label={`${i + 1}일차(${wd}) ${CODE_LABELS[c] ?? c}`}
                      className={`flex flex-col items-center py-1.5 rounded-md border text-sm font-bold cursor-pointer ${TONE[c] ?? 'bg-white text-slate-700 border-slate-200'}`}
                    >
                      <span className="text-[10px] font-semibold opacity-70">
                        {i + 1} · {wd}
                      </span>
                      {CODE_LABELS[c] ?? c}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 적용 */}
            <div className={`${card} p-4 space-y-3`}>
              <h2 className="text-sm font-bold text-slate-900">근무표에 적용</h2>
              <div className="flex items-center gap-2 flex-wrap text-xs font-semibold text-slate-600">
                <input type="date" value={from} onChange={(e) => (setFrom(e.target.value), setPreview(null))} aria-label="적용 시작일" className={inputCls} />
                ~
                <input type="date" value={to} onChange={(e) => (setTo(e.target.value), setPreview(null))} aria-label="적용 종료일" className={inputCls} />
                <label className="flex items-center gap-1.5 ml-2">
                  <input type="checkbox" checked={holidayAsRest} onChange={(e) => (setHolidayAsRest(e.target.checked), setPreview(null))} />
                  공휴일은 휴일로
                </label>
                <button
                  type="button"
                  onClick={makePreview}
                  disabled={busy || dirty}
                  className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-50 cursor-pointer"
                >
                  {busy && !progress && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  미리보기
                </button>
              </div>
              {dirty && <p className="text-[11px] font-semibold text-amber-700">패턴을 먼저 저장하세요.</p>}
              <p className="text-[11px] text-slate-500">마감 달·지난 날·개별 수정한 날은 덮어쓰지 않습니다.</p>

              {preview && (
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-xs text-slate-700">
                  <p className="font-semibold">
                    {preview.people}명 · 저장할 칸 <span className="text-blue-700">{preview.rows.length}</span>
                  </p>
                  <ul className="flex gap-3 flex-wrap text-slate-500">
                    {(Object.keys(SKIP_LABELS) as (keyof Preview['skipped'])[]).map((k) => (
                      <li key={k}>
                        {SKIP_LABELS[k]} 제외 {preview.skipped[k]}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={apply}
                    disabled={busy || !preview.rows.length}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-50 cursor-pointer"
                  >
                    {progress && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {current.group_name} {preview.people}명에 적용
                  </button>
                </div>
              )}
              {progress && (
                <div role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done} className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-blue-600 transition-all" style={{ width: `${(progress.done / Math.max(progress.total, 1)) * 100}%` }} />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
