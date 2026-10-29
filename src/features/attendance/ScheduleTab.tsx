/**
 * 근태관리 '근무표' 탭 — 근무조 4주·5주 패턴(Supabase attendance_shift_patterns)을 편집하고
 * 기간을 정해 Worker `PUT /api/admin/schedules` 로 500행씩 적용한다. 스펙 11.7.
 * 오늘 이전·마감 달·직접 수정한 칸은 덮어쓰지 않는다(pattern.ts).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Pencil, Plus, Save, Trash2, Users, X } from 'lucide-react';
import { att } from '../../lib/attendance';
import { logEvent } from '../../lib/audit';
import { supabase } from '../../lib/supabase';
import { errorText, shiftYm } from './labels';
import { CODES, CODE_LABELS, WEEK_OPTIONS, addDays, ampm, applyTemplate, buildCells, cycle, mondayOf, newPattern, resizeWeeks, searchTemplates, TEMPLATES, WEEK_CODES, weekBlock, weeksCode, weeksOf, type PatternRow, type Template } from './pattern';

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
  /** 적용 버튼 이름 — 근무조 이름 또는 '전체 근무조' */
  label: string;
  groups: string[];
}

const TABLE = 'attendance_shift_patterns';
const TPL_TABLE = 'attendance_shift_templates';
const CHUNK = 500; // Worker PUT /schedules 상한
const MAX_DAYS = 92;
const WD = ['월', '화', '수', '목', '금', '토', '일']; // 패턴 1일차 = 월요일
const card = 'bg-white rounded-xl border border-slate-200 shadow-xs';
const inputCls = 'px-2 py-1.5 rounded-md border border-slate-300 bg-white text-xs font-semibold text-slate-700 focus:ring-1 focus:ring-blue-500';
const TONE: Record<string, string> = {
  DAY: 'bg-blue-50 text-blue-700 border-blue-200',
  NIGHT: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  REST: 'bg-slate-100 text-slate-500 border-slate-200',
  DAY_STD: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};
interface ShiftType {
  code: string;
  name: string;
  start: string | null;
  end: string | null;
  fri_start: string | null;
  fri_end: string | null;
}
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
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ pattern: string[]; anchor: string } | null>(null);
  const [newName, setNewName] = useState('');
  const [newWeeks, setNewWeeks] = useState<number>(4);
  const [tplQ, setTplQ] = useState('');
  const [customTpls, setCustomTpls] = useState<Template[]>([]);
  const [tplNew, setTplNew] = useState<{ open: boolean; name: string; weeks: string[] }>({ open: false, name: '', weeks: ['DAY', 'NIGHT', 'DAY', 'NIGHT'] });
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(() => addDays(`${shiftYm(today.slice(0, 7), 2)}-01`, -1));
  const [holidayAsRest, setHolidayAsRest] = useState(true);
  const [includePast, setIncludePast] = useState(false);
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

  const loadTemplates = useCallback(async () => {
    const { data, error: e } = await supabase!.from(TPL_TABLE).select('name, weeks').order('created_at');
    if (e) return setError(`템플릿을 불러오지 못했습니다: ${e.message}`);
    setCustomTpls((data as { name: string; weeks: string[] }[]).map((t) => ({ ...t, custom: true })));
  }, []);
  const allTemplates = useMemo(() => [...customTpls, ...TEMPLATES], [customTpls]);

  const createTemplate = () =>
    run(async () => {
      const name = tplNew.name.trim() || weeksCode(tplNew.weeks);
      if (name.length > 20) throw new Error('템플릿 이름은 20자 이하로 입력하세요.');
      if (allTemplates.some((t) => t.name === name)) throw new Error(`'${name}' 템플릿이 이미 있습니다.`);
      const { error: e } = await supabase!.from(TPL_TABLE).insert({ name, weeks: tplNew.weeks });
      if (e) throw new Error(e.message);
      await logEvent('attendance.pattern', { meta: { op: 'template_create', name, weeks: tplNew.weeks } });
      setTplNew({ ...tplNew, open: false, name: '' });
      await loadTemplates();
      setMsg(`'${name}' 템플릿을 만들었습니다.`);
    });

  const deleteTemplate = (name: string) =>
    run(async () => {
      if (!window.confirm(`'${name}' 템플릿을 삭제하시겠습니까? 이미 적용한 근무조 패턴은 그대로입니다.`)) return;
      const { error: e } = await supabase!.from(TPL_TABLE).delete().eq('name', name);
      if (e) throw new Error(e.message);
      await logEvent('attendance.pattern', { meta: { op: 'template_delete', name } });
      await loadTemplates();
    });

  useEffect(() => {
    if (supabase) loadTemplates();
    loadPatterns();
    att<Emp[]>('GET', '/api/admin/employees')
      .then(setEmps)
      .catch((e) => setError(errorText(e)));
    att<ShiftType[]>('GET', '/api/admin/shift-types').then(setShiftTypes).catch((e) => setError(`근무형태를 불러오지 못했습니다: ${errorText(e)}`));
  }, [loadPatterns]);

  const current = patterns.find((p) => p.group_name === selected) ?? null;
  // 선택이 바뀌거나 저장본이 다시 로드되면 편집본을 저장본으로 맞춘다.
  useEffect(() => {
    // 1일차는 월요일 — 예전에 다른 요일로 저장된 기준일은 그 주 월요일로 맞춰 보여 준다(저장해야 반영).
    setDraft(current && { pattern: [...current.pattern], anchor: mondayOf(current.anchor_date) });
  }, [current]);
  // 패턴을 고치면(칸·주 수) 이전 미리보기로 적용되지 않게 버린다.
  useEffect(() => setPreview(null), [draft]);
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

  const dirty = !!current && !!draft && (draft.anchor !== current.anchor_date || draft.pattern.length !== current.pattern.length || draft.pattern.some((c, i) => c !== current.pattern[i]));

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
      const { error: e } = await supabase!.from(TABLE).insert({ group_name: name, anchor_date: draft?.anchor ?? '2026-11-02', pattern: newPattern(newWeeks) });
      if (e) throw new Error(e.message);
      await logEvent('attendance.pattern', { meta: { group: name, op: 'create', weeks: newWeeks } });
      setNewName('');
      await loadPatterns();
      setSelected(name);
    });

  const renameGroup = (old: string) =>
    run(async () => {
      const name = window.prompt(`'${old}' 근무조의 새 이름`, old)?.trim();
      if (!name || name === old) return;
      if (!emps) throw new Error('직원 목록을 불러오지 못해 이름을 바꿀 수 없습니다. 새로고침 후 다시 하세요.');
      if (name.length > 20) throw new Error('근무조 이름을 1~20자로 입력하세요.');
      if (patterns.some((p) => p.group_name === name)) throw new Error('이미 있는 근무조입니다.');
      const { error: e } = await supabase!.from(TABLE).update({ group_name: name }).eq('group_name', old);
      if (e) throw new Error(e.message);
      // 직원의 근무조(Worker employees.shift_group)도 새 이름으로 옮긴다. 퇴사자 포함.
      const members = emps.filter((x) => x.shift_group === old);
      const moved = (n: number) => setEmps((es) => es && es.map((x) => (members.slice(0, n).some((m) => m.sabun === x.sabun) ? { ...x, shift_group: name } : x)));
      for (const [i, x] of members.entries()) {
        try {
          await att('PATCH', `/api/admin/employees/${x.sabun}`, { body: { shift_group: name } });
        } catch (err) {
          moved(i);
          await loadPatterns();
          throw new Error(`이름은 바꿨지만 직원 ${i}/${members.length}명만 옮겼습니다 — 직원 설정 탭에서 나머지를 '${name}'로 지정하세요. (${errorText(err)})`);
        }
      }
      await logEvent('attendance.pattern', { meta: { group: name, op: 'rename', from: old, members: members.length } });
      moved(members.length);
      await loadPatterns();
      setSelected(name);
      setMsg(`'${old}' → '${name}' (직원 ${members.length}명 이동)`);
    });

  const deleteGroup = (name: string) =>
    run(async () => {
      if (!emps) throw new Error('직원 목록을 불러오지 못해 삭제할 수 없습니다. 새로고침 후 다시 하세요.');
      const n = emps.filter((x) => x.shift_group === name).length;
      if (n) throw new Error(`'${name}'에 지정된 직원 ${n}명(퇴사자 포함)이 있습니다. 직원 설정 탭에서 다른 근무조로 옮긴 뒤 삭제하세요.`);
      if (!window.confirm(`'${name}' 근무조를 삭제하시겠습니까? 이미 근무표에 들어간 날은 그대로 남습니다.`)) return;
      const { error: e } = await supabase!.from(TABLE).delete().eq('group_name', name);
      if (e) throw new Error(e.message);
      await logEvent('attendance.pattern', { meta: { group: name, op: 'delete' } });
      setSelected(null);
      await loadPatterns();
      setMsg(`'${name}' 근무조를 삭제했습니다.`);
    });

  const savePattern = () =>
    run(async () => {
      if (!current || !draft) return;
      const { error: e } = await supabase!.from(TABLE).update({ anchor_date: draft.anchor, pattern: draft.pattern }).eq('group_name', current.group_name);
      if (e) throw new Error(e.message);
      await logEvent('attendance.pattern', { meta: { group: current.group_name, anchor: draft.anchor, weeks: draft.pattern.length / 7 } });
      await loadPatterns();
      setMsg('패턴을 저장했습니다.');
    });

  const members = (group: string) =>
    (emps ?? []).filter((e) => e.shift_group === group && (!e.retire_date || e.retire_date >= from)).map((e) => e.sabun);

  /** all: 저장된 모든 근무조 패턴을 한 번에, 아니면 선택한 근무조(편집 중 패턴). */
  const makePreview = (all: boolean) =>
    run(async () => {
      if (!current || !draft) return;
      if (!from || !to || from > to) throw new Error('적용 기간을 확인하세요.');
      if (addDays(from, MAX_DAYS) <= to) throw new Error(`적용 기간은 최대 ${MAX_DAYS}일입니다.`);
      const targets = (all ? patterns : [{ group_name: current.group_name, anchor_date: draft.anchor, pattern: draft.pattern }])
        .map((p) => ({ ...p, sabuns: members(p.group_name) }))
        .filter((p) => p.sabuns.length);
      const notMonday = targets.filter((t) => mondayOf(t.anchor_date) !== t.anchor_date).map((t) => t.group_name);
      if (notMonday.length) throw new Error(`1일차가 월요일이 아닌 근무조가 있습니다: ${notMonday.join(', ')} — 근무조를 하나씩 열어 저장한 뒤 적용하세요.`);
      if (!targets.length) throw new Error('지정된 직원이 있는 근무조가 없습니다. 직원 설정 탭에서 근무조를 지정하세요.');
      const yms: string[] = [];
      for (let ym = from.slice(0, 7); ym <= to.slice(0, 7); ym = shiftYm(ym, 1)) yms.push(ym);
      const years = [...new Set(yms.map((y) => y.slice(0, 4)))];
      const [months, hols, scheds] = await Promise.all([
        att<MonthRow[]>('GET', '/api/admin/months'),
        Promise.all(years.map((year) => att<{ date: string }[]>('GET', '/api/admin/holidays', { query: { year } }))),
        Promise.all(yms.map((ym) => att<SchedRow[]>('GET', '/api/admin/schedules', { query: { ym } }))),
      ]);
      const holidays = new Set(hols.flat().map((h) => h.date));
      const closedYms = new Set(months.filter((m) => m.status !== 'open').map((m) => m.ym));
      const out: Preview = { rows: [], skipped: { past: 0, closed: 0, manual: 0, same: 0 }, people: 0, label: all ? '전체 근무조' : current.group_name, groups: [] };
      for (const t of targets) {
        const mine = new Set(t.sabuns);
        const existing = scheds.flat().filter((r) => mine.has(r.sabun));
        const r = buildCells(t.pattern, t.anchor_date, from, to, t.sabuns, existing, { group: t.group_name, holidays, holidayAsRest, today, includePast, closedYms });
        out.rows.push(...r.rows);
        for (const k of Object.keys(out.skipped) as (keyof Preview['skipped'])[]) out.skipped[k] += r.skipped[k];
        out.people += t.sabuns.length;
        out.groups.push(t.group_name);
      }
      setPreview(out);
    });

  const apply = () =>
    run(async () => {
      if (!preview) return;
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
      await logEvent('attendance.schedule', { meta: { group: preview.groups.join(','), from, to, rows: rows.length, skipped: preview.skipped } });
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
                <span className="truncate">{p.group_name}</span>
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 shrink-0">
                  <span className="px-1 rounded bg-slate-100 font-semibold">{p.pattern.length / 7}주</span>
                  <Users className="w-3 h-3" />
                  {emps ? (counts.get(p.group_name) ?? 0) : '-'}
                </span>
              </button>
              {selected === p.group_name && (
                <div className="flex justify-end gap-1 px-1 pt-1">
                  <button type="button" onClick={() => renameGroup(p.group_name)} disabled={busy} className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 cursor-pointer">
                    <Pencil className="w-3 h-3" />
                    이름 변경
                  </button>
                  <button type="button" onClick={() => deleteGroup(p.group_name)} disabled={busy} className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-rose-200 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50 cursor-pointer">
                    <Trash2 className="w-3 h-3" />
                    삭제
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
        <div className="flex gap-1 pt-1 border-t border-slate-100">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="새 근무조" aria-label="새 근무조 이름" className={`${inputCls} flex-1 min-w-0`} />
          <select value={newWeeks} onChange={(e) => setNewWeeks(+e.target.value)} aria-label="새 근무조 패턴 주 수" className={inputCls}>
            {WEEK_OPTIONS.map((w) => <option key={w} value={w}>{w}주</option>)}
          </select>
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
            {/* 4·5주 패턴 */}
            <div className={`${card} p-4 space-y-3`}>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-bold text-slate-900">{current.group_name} 패턴</h2>
                <div role="group" aria-label="패턴 주 수" className="inline-flex rounded-lg border border-slate-300 overflow-hidden text-xs font-semibold">
                  {WEEK_OPTIONS.map((w) => (
                    <button
                      key={w}
                      type="button"
                      aria-pressed={draft.pattern.length === w * 7}
                      onClick={() => setDraft({ ...draft, pattern: resizeWeeks(draft.pattern, w) })}
                      className={`px-3 py-1.5 cursor-pointer ${draft.pattern.length === w * 7 ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                    >
                      {w}주
                    </button>
                  ))}
                </div>
                <label className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                  1주차 월요일
                  <input type="date" value={draft.anchor} onChange={(e) => e.target.value && setDraft({ ...draft, anchor: mondayOf(e.target.value) })} className={inputCls} />
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
                {dirty && <span className="text-[11px] font-bold text-amber-700">저장 안 됨</span>}
              </div>
              {/* 4주 템플릿: 검색('주야주주', '1주 야 2주 주')하거나 제목을 눌러 적용. 5주 근무조면 5주차는 주간. */}
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-700">템플릿</span>
                  <input
                    value={tplQ}
                    onChange={(e) => setTplQ(e.target.value)}
                    placeholder="주야주주·이름으로 검색"
                    aria-label="템플릿 검색"
                    className={`${inputCls} w-40`}
                  />
                  <span className="text-[11px] text-slate-500">
                    1~4주차 주간(주)·야간(야) 순서{draft.pattern.length > 28 ? ' · 5주차는 주간으로 채워지니 필요하면 고치세요' : ''}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {searchTemplates(tplQ, allTemplates).map((t) => {
                    const next = applyTemplate(t.weeks, draft.pattern.length);
                    const on = next.every((c, i) => c === draft.pattern[i]);
                    const code = weeksCode(t.weeks);
                    return (
                      <span key={t.name} className="inline-flex">
                        <button
                          type="button"
                          aria-pressed={on}
                          title={code}
                          onClick={() => setDraft({ ...draft, pattern: next })}
                          className={`px-2.5 py-1 border text-xs font-bold cursor-pointer ${t.custom ? 'rounded-l-md' : 'rounded-md tracking-widest'} ${on ? 'bg-blue-600 border-blue-600 text-white' : t.custom ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100' : 'bg-white border-slate-200 text-slate-700 hover:bg-blue-50'}`}
                        >
                          {t.name}
                          {t.custom && t.name !== code && <span className="ml-1 font-normal tracking-widest opacity-70">{code}</span>}
                        </button>
                        {t.custom && (
                          <button
                            type="button"
                            onClick={() => deleteTemplate(t.name)}
                            disabled={busy}
                            aria-label={`${t.name} 템플릿 삭제`}
                            className="px-1.5 rounded-r-md border border-l-0 border-emerald-200 bg-white text-slate-400 hover:text-rose-600 cursor-pointer disabled:opacity-50"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </span>
                    );
                  })}
                  {!searchTemplates(tplQ, allTemplates).length && <span className="text-[11px] text-slate-500">맞는 템플릿이 없습니다. 주·야·통·휴 글자나 템플릿 이름으로 찾으세요.</span>}
                  <button
                    type="button"
                    onClick={() => setTplNew({ ...tplNew, open: !tplNew.open })}
                    aria-expanded={tplNew.open}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-dashed border-slate-300 text-xs font-semibold text-slate-600 hover:bg-white cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    템플릿 만들기
                  </button>
                </div>
                {tplNew.open && (
                  <div className="flex items-end gap-2 flex-wrap pt-2 border-t border-slate-200">
                    {tplNew.weeks.map((w, i) => (
                      <label key={i} className="text-[11px] font-semibold text-slate-600">
                        {i + 1}주차
                        <select
                          value={w}
                          onChange={(e) => setTplNew({ ...tplNew, weeks: tplNew.weeks.map((x, j) => (j === i ? e.target.value : x)) })}
                          className={`${inputCls} block mt-0.5`}
                        >
                          {WEEK_CODES.map((c) => (
                            <option key={c} value={c}>
                              {c === 'REST' ? '휴일' : shiftTypes.find((t) => t.code === c)?.name ?? CODE_LABELS[c]}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                    <label className="text-[11px] font-semibold text-slate-600">
                      이름 (비우면 {weeksCode(tplNew.weeks)})
                      <input value={tplNew.name} onChange={(e) => setTplNew({ ...tplNew, name: e.target.value })} maxLength={20} placeholder={weeksCode(tplNew.weeks)} className={`${inputCls} block mt-0.5 w-36`} />
                    </label>
                    <button type="button" onClick={createTemplate} disabled={busy} className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-50 cursor-pointer">
                      저장
                    </button>
                    <span className="text-[11px] text-slate-500">한 주 = 월~금 그 근무 + 토·일 휴일</span>
                  </div>
                )}
              </div>
              {draft.anchor !== current.anchor_date && (
                <p className="flex items-start gap-1.5 p-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] font-semibold text-amber-700">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
                  저장된 1일차({current.anchor_date})가 월요일이 아니어서 요일이 어긋나 있었습니다. 그 주 월요일({draft.anchor})로 맞췄으니 확인 후 저장하고, 근무표에 다시 적용하세요.
                </p>
              )}
              <p className="text-[11px] text-slate-500">
                템플릿이나 주차 옆 선택으로 한 주(월~금 근무, 토·일 휴일)를 한 번에 정하고, 칸을 누르면 하루씩 주간 → 야간 → 휴일 → 통상주간 순으로 바뀝니다. 4주/5주·템플릿·칸 변경은 <b>저장</b>해야 반영되고(5주→4주로 줄이면 5주차는 지워지고, 4주→5주로 늘리면 5주차는 주간으로 채워집니다), 근무표에는 아래 "근무표에 적용"으로 넣습니다.
              </p>
              <div className="grid grid-cols-[auto_repeat(7,minmax(0,1fr))] gap-1.5 items-center">
                <span />
                {WD.map((w) => (
                  <span key={w} className={`text-center text-[11px] font-bold ${w === '토' ? 'text-blue-600' : w === '일' ? 'text-rose-600' : 'text-slate-500'}`}>
                    {w}
                  </span>
                ))}
                {Array.from({ length: draft.pattern.length / 7 }, (_, wk) => wk).map((wk) => [
                  <span key={`w${wk}`} className="text-[11px] font-semibold text-slate-500 pr-1 whitespace-nowrap">
                    {wk + 1}주차 <span className="hidden sm:inline font-normal text-[10px]">{addDays(draft.anchor, wk * 7).slice(5).replace('-', '/')}~</span>
                    <select
                      value={weeksOf(draft.pattern)[wk] ?? ''}
                      onChange={(e) => {
                        const b = weekBlock(e.target.value);
                        setDraft({ ...draft, pattern: draft.pattern.map((x, j) => (j >= wk * 7 && j < wk * 7 + 7 ? b[j - wk * 7] : x)) });
                      }}
                      aria-label={`${wk + 1}주차 근무 일괄`}
                      className="block mt-0.5 px-1 py-0.5 rounded border border-slate-300 bg-white text-[11px] font-semibold text-slate-700"
                    >
                      <option value="" disabled>
                        섞임
                      </option>
                      {(['DAY', 'NIGHT', 'DAY_STD', 'REST'] as const).map((c) => (
                        <option key={c} value={c}>
                          {c === 'REST' ? '휴일' : shiftTypes.find((t) => t.code === c)?.name ?? CODE_LABELS[c]}
                        </option>
                      ))}
                    </select>
                  </span>,
                  ...draft.pattern.slice(wk * 7, wk * 7 + 7).map((c, k) => {
                    const i = wk * 7 + k;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setDraft({ ...draft, pattern: draft.pattern.map((x, j) => (j === i ? cycle(x) : x)) })}
                        aria-label={`${wk + 1}주차 ${WD[k]}요일 ${CODE_LABELS[c] ?? c}`}
                        className={`py-2 rounded-md border text-sm font-bold cursor-pointer ${TONE[c] ?? 'bg-white text-slate-700 border-slate-200'}`}
                      >
                        {CODE_LABELS[c] ?? c}
                      </button>
                    );
                  }),
                ])}
              </div>
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                {CODES.map((code) => {
                  const t = shiftTypes.find((x) => x.code === code);
                  if (!t) return code === 'DAY_STD' ? <li key={code} className="text-amber-700">통 = 통상주간: 규칙 탭 근무형태에 DAY_STD 가 없어 저장할 수 없습니다.</li> : null;
                  const fri = t.fri_start || t.fri_end ? ` (금 ${ampm(t.fri_start ?? t.start)}~${ampm(t.fri_end ?? t.end)})` : '';
                  return (
                    <li key={code}>
                      <b className="text-slate-700">{CODE_LABELS[code]}</b> = {t.name}
                      {t.start && t.end ? ` ${ampm(t.start)}~${t.end < t.start ? '익일 ' : ''}${ampm(t.end)}${fri}` : ''}
                    </li>
                  );
                })}
              </ul>
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
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={includePast} onChange={(e) => (setIncludePast(e.target.checked), setPreview(null))} />
                  지난 날도 채우기
                </label>
                <button
                  type="button"
                  onClick={() => makePreview(false)}
                  disabled={busy || dirty}
                  className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-50 cursor-pointer"
                >
                  {busy && !progress && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  미리보기
                </button>
                <button
                  type="button"
                  onClick={() => makePreview(true)}
                  disabled={busy || dirty}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 disabled:opacity-50 cursor-pointer"
                >
                  전체 근무조 미리보기
                </button>
              </div>
              {dirty && (
                <p className="text-[11px] font-semibold text-amber-700">
                  패턴을 먼저 저장하세요.{draft.pattern.length !== current.pattern.length && ' 주 수를 바꾸면 순환이 달라지므로 저장 후 근무표에 다시 적용해야 합니다.'}
                </p>
              )}
              <p className="text-[11px] text-slate-500">마감 달·개별 수정한 날은 덮어쓰지 않습니다. 지난 날은 '지난 날도 채우기'를 켤 때만 채우며, 저장하면 그날 판정을 다시 계산합니다.</p>

              {preview && (
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-xs text-slate-700">
                  <p className="font-semibold">
                    {preview.groups.length > 1 && <span className="text-slate-500">{preview.groups.join(' · ')} — </span>}
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
                    {preview.label} {preview.people}명에 적용
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
