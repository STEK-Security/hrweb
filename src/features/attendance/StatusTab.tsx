/**
 * 근태관리 '현황' 탭 — 월 이동·마감 상태, 요약 카드 4개, 직원×일 매트릭스, 검토할 경고 목록, 일별 상세(HR 수정).
 * 데이터: GET /months, /employees, /confirmations, /matrix, /month (모두 Worker admin.ts 모양 그대로).
 */
import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, Loader2, X, AlertTriangle, Pencil } from 'lucide-react';
import { att } from '../../lib/attendance';
import { logEvent } from '../../lib/audit';
import {
  FLAG_LABELS,
  MINUTE_LABELS,
  MONTH_STATUS_LABELS,
  SOURCE_LABELS,
  STATUS_LABELS,
  cellLabel,
  cellWarnings,
  errorText,
  hm,
  shiftYm,
  type MatrixCell,
} from './labels';

interface MonthRow {
  ym: string;
  status: 'open' | 'closing' | 'closed';
  job: { done: number; total: number } | null;
}
interface Emp {
  sabun: string;
  name: string;
  dept: string | null;
  shift_group: string | null;
  attendance_target: number;
}
interface Confirmation {
  sabun: string;
  confirmed_at: string | null;
}
interface MatrixRow {
  sabun: string;
  name: string;
  dept: string | null;
  cells: Record<string, MatrixCell>;
}
interface Matrix {
  dates: string[];
  rows: MatrixRow[];
}
interface Day {
  date: string;
  shiftCode: string | null;
  inAt: string | null;
  outAt: string | null;
  source: string | null;
  status: string;
  dayClass: string;
  minutes: Record<string, number>;
  flags: string[];
}

interface Data {
  month: MonthRow | null;
  emps: Emp[];
  confs: Confirmation[];
  matrix: Matrix;
}

interface Target {
  sabun: string;
  name: string;
  date: string;
}

const NONE = '__none';
const WD = ['일', '월', '화', '수', '목', '금', '토'];
const weekday = (d: string) => new Date(`${d}T00:00:00Z`).getUTCDay();

const card = 'bg-white rounded-xl border border-slate-200 shadow-xs';
const selectCls = 'px-2 py-1.5 rounded-md border border-slate-300 bg-white text-xs font-semibold text-slate-700 focus:ring-1 focus:ring-blue-500';

const LABEL_TONE: Record<string, string> = {
  주: 'bg-blue-50 text-blue-700',
  야: 'bg-indigo-100 text-indigo-800',
  휴: 'bg-slate-100 text-slate-500',
  연: 'bg-amber-50 text-amber-700',
  '!': 'bg-rose-50 text-rose-700 font-bold',
};

interface Props {
  ym: string;
  onChangeYm: (ym: string) => void;
  pending: number | null;
}

export function StatusTab({ ym, onChangeYm, pending }: Props) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [group, setGroup] = useState('');
  const [dept, setDept] = useState('');
  const [openFlag, setOpenFlag] = useState<string | null>(null);
  const [target, setTarget] = useState<Target | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    Promise.all([
      att<MonthRow[]>('GET', '/api/admin/months'),
      att<Emp[]>('GET', '/api/admin/employees'),
      att<Confirmation[]>('GET', '/api/admin/confirmations', { query: { ym } }),
      att<Matrix>('GET', '/api/admin/matrix', { query: { ym } }),
    ])
      .then(([months, emps, confs, matrix]) => {
        if (alive) setData({ month: months.find((m) => m.ym === ym) ?? null, emps, confs, matrix });
      })
      .catch((e) => alive && setError(errorText(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [ym, reloadKey]);

  const groupOf = useMemo(() => new Map(data?.emps.map((e) => [e.sabun, e.shift_group]) ?? []), [data]);
  const groups = useMemo(() => [...new Set(data?.emps.map((e) => e.shift_group).filter((g): g is string => !!g))].sort(), [data]);
  const depts = useMemo(() => [...new Set(data?.matrix.rows.map((r) => r.dept).filter((d): d is string => !!d))].sort(), [data]);

  const rows = useMemo(
    () =>
      (data?.matrix.rows ?? []).filter((r) => {
        const g = groupOf.get(r.sabun) ?? null;
        if (group && (group === NONE ? g : g !== group)) return false;
        return !dept || r.dept === dept;
      }),
    [data, group, dept, groupOf],
  );

  // 경고 종류 → (직원·날짜) 목록
  const warnings = useMemo(() => {
    const m = new Map<string, Target[]>();
    for (const r of rows)
      for (const [date, c] of Object.entries(r.cells) as [string, MatrixCell][])
        for (const f of cellWarnings(c)) (m.get(f) ?? m.set(f, []).get(f)!).push({ sabun: r.sabun, name: r.name, date });
    for (const list of m.values()) list.sort((a, b) => a.date.localeCompare(b.date) || a.sabun.localeCompare(b.sabun));
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [rows]);
  const warnTotal = warnings.reduce((s, [, l]) => s + l.length, 0);

  const month = data?.month;
  const status = month?.status ?? 'open';
  const targets = data?.emps.filter((e) => e.attendance_target === 1).length;
  const confirmed = data?.confs.filter((c) => c.confirmed_at).length;

  const summary: { label: string; value: string; sub?: string; tone?: string }[] = [
    { label: '근태 대상', value: targets != null ? `${targets}명` : '-' },
    { label: '직원 확정', value: confirmed != null ? `${confirmed}명` : '-', sub: data ? `대상 ${data.confs.length}명 중` : undefined },
    { label: '대기 정정', value: pending != null ? `${pending}건` : '-', sub: '전체 달', tone: pending ? 'text-amber-600' : undefined },
    { label: '경고', value: data ? `${warnTotal}건` : '-', sub: '필터 적용', tone: warnTotal ? 'text-rose-600' : undefined },
  ];

  return (
    <div className="space-y-4">
      {/* 월 이동 + 상태 */}
      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" onClick={() => onChangeYm(shiftYm(ym, -1))} aria-label="이전 달" className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 cursor-pointer">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-base font-bold text-slate-900 tabular-nums min-w-24 text-center" aria-live="polite">
          {ym.slice(0, 4)}년 {+ym.slice(5)}월
        </span>
        <button type="button" onClick={() => onChangeYm(shiftYm(ym, 1))} aria-label="다음 달" className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 cursor-pointer">
          <ChevronRight className="w-4 h-4" />
        </button>
        <span
          className={`px-2 py-1 rounded-md border text-[11px] font-semibold ${
            status === 'closed'
              ? 'bg-slate-700 border-slate-700 text-white'
              : status === 'closing'
                ? 'bg-amber-50 border-amber-200 text-amber-700'
                : 'bg-emerald-50 border-emerald-200 text-emerald-700'
          }`}
        >
          {MONTH_STATUS_LABELS[status]}
          {status === 'closing' && month?.job && ` ${month.job.done}/${month.job.total}`}
        </span>
        <button
          type="button"
          onClick={() => setReloadKey((k) => k + 1)}
          disabled={loading}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-600 disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          새로고침
        </button>
      </div>

      {error && (
        <div role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-semibold">
          근태 정보를 불러오지 못했습니다: {error}
        </div>
      )}

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {summary.map((s) => (
          <div key={s.label} className={`${card} p-4`}>
            <p className="text-[11px] font-semibold text-slate-500">{s.label}</p>
            <p className={`mt-1 text-xl font-bold tabular-nums ${s.tone ?? 'text-slate-900'}`}>{s.value}</p>
            {s.sub && <p className="text-[10px] text-slate-400">{s.sub}</p>}
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        {/* 매트릭스 */}
        <section className={`${card} min-w-0`} aria-label="직원별 일별 근태">
          <div className="flex items-center gap-2 flex-wrap p-3 border-b border-slate-100">
            <label className="flex items-center gap-1.5 text-xs text-slate-500">
              근무조
              <select value={group} onChange={(e) => setGroup(e.target.value)} className={selectCls}>
                <option value="">전체</option>
                {groups.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
                <option value={NONE}>미지정</option>
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-xs text-slate-500">
              부서
              <select value={dept} onChange={(e) => setDept(e.target.value)} className={selectCls}>
                <option value="">전체</option>
                {depts.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <span className="ml-auto text-[11px] text-slate-400">
              {rows.length}명 · 주/야/휴/연, ! 누락·결근, 점선 = 경고
            </span>
          </div>

          {loading && !data ? (
            <div className="flex items-center justify-center py-20 text-sm text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> 불러오는 중...
            </div>
          ) : !rows.length ? (
            <p className="py-16 text-center text-sm text-slate-500">표시할 직원이 없습니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="text-[11px] border-separate border-spacing-0">
                <thead>
                  <tr>
                    <th scope="col" className="sticky left-0 z-10 bg-white px-3 py-2 text-left font-semibold text-slate-500 border-b border-slate-100 min-w-28">
                      직원
                    </th>
                    {data!.matrix.dates.map((d) => {
                      const w = weekday(d);
                      return (
                        <th key={d} scope="col" className={`px-0.5 py-1 font-semibold border-b border-slate-100 ${w === 0 ? 'text-rose-500' : w === 6 ? 'text-blue-500' : 'text-slate-500'}`}>
                          <div className="tabular-nums">{+d.slice(8)}</div>
                          <div className="text-[9px] font-normal">{WD[w]}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.sabun} className="group">
                      <th scope="row" className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 px-3 py-1 text-left font-semibold text-slate-800 border-b border-slate-50 whitespace-nowrap">
                        {r.name}
                        <span className="block text-[9px] font-normal text-slate-400">
                          {r.dept ?? '-'} · {groupOf.get(r.sabun) ?? '미지정'}
                        </span>
                      </th>
                      {data!.matrix.dates.map((d) => {
                        const c = r.cells[d];
                        const label = cellLabel(c);
                        const warn = cellWarnings(c);
                        return (
                          <td key={d} className="p-0.5 border-b border-slate-50 group-hover:bg-slate-50">
                            <button
                              type="button"
                              onClick={() => setTarget({ sabun: r.sabun, name: r.name, date: d })}
                              aria-label={`${r.name} ${d} ${c ? STATUS_LABELS[c.status] ?? c.status : '기록 없음'}${warn.length ? ` 경고 ${warn.map((f) => FLAG_LABELS[f] ?? f).join(', ')}` : ''}`}
                              title={warn.map((f) => FLAG_LABELS[f] ?? f).join(', ') || undefined}
                              className={`w-7 h-7 rounded-md text-[11px] leading-none cursor-pointer hover:ring-2 hover:ring-blue-300 ${LABEL_TONE[label] ?? 'text-slate-400'} ${
                                warn.length ? 'border border-dashed border-rose-400' : ''
                              }`}
                            >
                              {label}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* 검토할 경고 */}
        <aside className={`${card} p-3 h-fit`} aria-label="검토할 경고">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-800 mb-2">
            <AlertTriangle className="w-4 h-4 text-rose-500" />
            검토할 경고
          </h2>
          {!warnings.length ? (
            <p className="text-xs text-slate-500 py-4 text-center">{data ? '경고가 없습니다.' : '-'}</p>
          ) : (
            <ul className="space-y-1">
              {warnings.map(([f, list]) => (
                <li key={f}>
                  <button
                    type="button"
                    aria-expanded={openFlag === f}
                    onClick={() => setOpenFlag(openFlag === f ? null : f)}
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    {FLAG_LABELS[f] ?? f}
                    <span className="px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-700 text-[10px] tabular-nums">{list.length}</span>
                  </button>
                  {openFlag === f && (
                    <ul className="ml-2 mb-1 max-h-64 overflow-y-auto border-l border-slate-100">
                      {list.map((t) => (
                        <li key={`${t.sabun}:${t.date}`}>
                          <button
                            type="button"
                            onClick={() => setTarget(t)}
                            className="w-full text-left px-2 py-1 text-[11px] text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded cursor-pointer"
                          >
                            <span className="tabular-nums">{t.date.slice(5)}</span> {t.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[10px] text-slate-400 leading-relaxed">
            근태 서버의 일별 상태 기준입니다. 휴게 부족·종업 이후 근로·주 52시간은 일별 상세에서 확인하세요.
          </p>
        </aside>
      </div>

      {target && (
        <DayDetailModal
          ym={ym}
          target={target}
          editable={status === 'open'}
          onClose={() => setTarget(null)}
          onSaved={() => setReloadKey((k) => k + 1)}
        />
      )}
    </div>
  );
}

/** datetime-local 값('YYYY-MM-DDTHH:MM') ↔ Worker KST 문자열('YYYY-MM-DD HH:MM'). */
const toLocal = (s: string | null) => (s ? s.replace(' ', 'T') : '');
const fromLocal = (s: string) => (s ? s.replace('T', ' ') : null);

function DayDetailModal({
  ym,
  target,
  editable,
  onClose,
  onSaved,
}: {
  ym: string;
  target: Target;
  editable: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [day, setDay] = useState<Day | null | undefined>(undefined); // undefined = 불러오는 중, null = 기록 없음
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [editing, setEditing] = useState(false);
  const [inAt, setInAt] = useState('');
  const [outAt, setOutAt] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setDay(undefined);
    setLoadErr(null);
    att<{ days: Day[] }>('GET', '/api/admin/month', { query: { ym, sabun: target.sabun } })
      .then((r) => {
        if (!alive) return;
        const d = r.days.find((x) => x.date === target.date) ?? null;
        setDay(d);
        setInAt(toLocal(d?.inAt ?? null));
        setOutAt(toLocal(d?.outAt ?? null));
      })
      .catch((e) => alive && setLoadErr(errorText(e)));
    return () => {
      alive = false;
    };
  }, [ym, target.sabun, target.date, reload]);

  const save = async () => {
    setSaveErr(null);
    if (!inAt && !outAt) return setSaveErr('출근 또는 퇴근 시각을 입력하세요.');
    if (reason.trim().length < 2) return setSaveErr('사유를 2자 이상 입력하세요.');
    setSaving(true);
    try {
      const body = { in: fromLocal(inAt), out: fromLocal(outAt), reason: reason.trim() };
      await att('POST', `/api/admin/days/${encodeURIComponent(target.sabun)}/${target.date}/edit`, { body });
      await logEvent('attendance.correction', {
        targetId: `${target.sabun}:${target.date}`,
        meta: { kind: 'hr_edit', in: body.in, out: body.out },
      });
      setEditing(false);
      setReason('');
      setReload((k) => k + 1);
      onSaved();
    } catch (e) {
      setSaveErr(errorText(e));
    } finally {
      setSaving(false);
    }
  };

  const minutes = day ? (Object.entries(day.minutes) as [string, number][]).filter(([, v]) => v > 0) : [];
  const inputCls = 'w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="att-day-title"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
    >
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
          <h3 id="att-day-title" className="text-base font-bold text-slate-900">
            {target.name} · {target.date} ({WD[weekday(target.date)]})
          </h3>
          <button type="button" onClick={onClose} aria-label="닫기" autoFocus className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-sm overflow-y-auto">
          {loadErr ? (
            <div role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-semibold">{loadErr}</div>
          ) : day === undefined ? (
            <div className="flex items-center justify-center py-8 text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> 불러오는 중...
            </div>
          ) : day === null ? (
            <p className="text-xs text-slate-500">이 날 계산된 기록이 없습니다.</p>
          ) : (
            <>
              <dl className="grid grid-cols-2 gap-2">
                {[
                  ['출근', day.inAt?.slice(11) ?? '-'],
                  ['퇴근', day.outAt ? (day.outAt.slice(0, 10) === day.date ? day.outAt.slice(11) : `익일 ${day.outAt.slice(11)}`) : '-'],
                  ['상태', STATUS_LABELS[day.status] ?? day.status],
                  ['근무', `${day.shiftCode ?? '-'} · ${day.dayClass}`],
                  ['출처', day.source ? SOURCE_LABELS[day.source] ?? day.source : '-'],
                ].map(([k, v]) => (
                  <div key={k} className="p-2 rounded-lg bg-slate-50">
                    <dt className="text-[10px] text-slate-500">{k}</dt>
                    <dd className="text-sm font-semibold text-slate-800 tabular-nums">{v}</dd>
                  </div>
                ))}
              </dl>
              {minutes.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 mb-1">시간(시:분)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {minutes.map(([k, v]) => (
                      <span key={k} className="px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-[11px] font-semibold tabular-nums">
                        {MINUTE_LABELS[k] ?? k} {hm(v)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {day.flags.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 mb-1">경고</p>
                  <div className="flex flex-wrap gap-1.5">
                    {day.flags.map((f) => (
                      <span key={f} className="px-2 py-1 rounded-md bg-rose-50 text-rose-700 text-[11px] font-semibold">
                        {FLAG_LABELS[f] ?? f}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {!editable && <p className="text-[11px] text-slate-500">마감(또는 마감 중)인 달은 수정할 수 없습니다.</p>}

          {editable && !loadErr && day !== undefined && !editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs shadow-xs cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
              HR 수정
            </button>
          )}

          {editing && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
              className="space-y-3 pt-3 border-t border-slate-100"
            >
              {saveErr && (
                <div role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-semibold">{saveErr}</div>
              )}
              <div>
                <label htmlFor="att-in" className="text-[11px] text-slate-500 block mb-0.5">출근 (그날)</label>
                <input id="att-in" type="datetime-local" value={inAt} onChange={(e) => setInAt(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label htmlFor="att-out" className="text-[11px] text-slate-500 block mb-0.5">퇴근 (그날 또는 다음 날)</label>
                <input id="att-out" type="datetime-local" value={outAt} onChange={(e) => setOutAt(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label htmlFor="att-reason" className="text-[11px] text-slate-500 block mb-0.5">사유 (2자 이상)</label>
                <input id="att-reason" type="text" required value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} />
              </div>
              <p className="text-[10px] text-slate-400">저장하면 승인된 HR 수정으로 기록되고 그날이 다시 계산됩니다.</p>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEditing(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs cursor-pointer">
                  취소
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs shadow-xs disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  저장
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
