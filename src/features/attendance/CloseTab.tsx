/**
 * 근태관리 '확정·마감' 탭 — 4단계 카드(precheck), 마감(close 202 → /jobs/step 반복), 마감 취소, 직원 확정 표, 급여 엑셀.
 * 탭에 들어오면 GET /jobs?active=1 로 진행 중 마감 작업을 찾아 스텝을 이어 돌린다(Review Focus 4). 탭을 떠나면 멈추고 크론이 잇는다.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, Loader2, Lock, Unlock, Download, CheckCircle2, Circle } from 'lucide-react';
import { att } from '../../lib/attendance';
import { logEvent } from '../../lib/audit';
import { downloadXlsx, xlsxWrite } from '../../lib/xlsxWrite';
import { MONTH_STATUS_LABELS, errorText, shiftYm } from './labels';

interface MonthRow { ym: string; status: 'open' | 'closing' | 'closed'; closed_at?: string | null }
interface Precheck { pending: number; missing: number; unmatched: number; unscheduled: string[] }
interface Job { id: number; kind?: string; ym: string; phase: 'recompute' | 'snapshot' | 'done' | 'cancelled'; total: number; done: number }
interface Confirmation { sabun: string; name: string; dept: string | null; confirmed_at: string | null }
type ExportRow = Record<string, string | number>;

/** 스펙 11.4 급여 엑셀 18열(Worker exportRows 키 순서). */
const EXPORT_COLUMNS = ['사번', '이름', '근무조', '입사일', '근무일', '요일', '일구분', '휴가여부', '출근', '퇴근', '인정시간', '기본', '연장', '야간', '휴일', '휴일연장', '유급', '수정여부'] as const;

const card = 'bg-white rounded-xl border border-slate-200 shadow-xs';
const btn = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
const thisYm = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 7);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ACTIVE = (j: Job | null) => !!j && (j.phase === 'recompute' || j.phase === 'snapshot');

interface Props { ym: string; onChangeYm: (ym: string) => void }

export function CloseTab({ ym, onChangeYm }: Props) {
  const [month, setMonth] = useState<MonthRow | null>(null);
  const [pre, setPre] = useState<Precheck | null>(null);
  const [confs, setConfs] = useState<Confirmation[] | null>(null);
  const [onlyUnconfirmed, setOnlyUnconfirmed] = useState(true);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [job, setJob] = useState<Job | null>(null);
  const [stepping, setStepping] = useState(false);
  const [busy, setBusy] = useState(false);
  const [exp, setExp] = useState<{ emps: number; rows: number } | null>(null);
  const alive = useRef(true);
  const runningId = useRef<number | null>(null);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  useEffect(() => {
    let ok = true;
    setLoading(true);
    setError('');
    Promise.all([
      att<MonthRow[]>('GET', '/api/admin/months'),
      att<Precheck>('GET', `/api/admin/months/${ym}/precheck`),
      att<Confirmation[]>('GET', '/api/admin/confirmations', { query: { ym } }),
    ])
      .then(([ms, p, c]) => { if (ok) { setMonth(ms.find((m) => m.ym === ym) ?? null); setPre(p); setConfs(c); } })
      .catch((e) => ok && setError(errorText(e)))
      .finally(() => ok && setLoading(false));
    return () => { ok = false; };
  }, [ym, reloadKey]);

  /** 작업이 끝날 때까지 /jobs/step 반복. 탭을 떠나면(alive=false) 멈춘다. */
  const runSteps = useCallback(async (start: Job) => {
    if (runningId.current === start.id) return;
    runningId.current = start.id;
    setJob(start);
    setStepping(true);
    setError('');
    try {
      let j: Job = start;
      while (alive.current && runningId.current === start.id && ACTIVE(j)) {
        const r = await att<{ processed: number; remaining: number; job?: Job }>('POST', '/api/admin/jobs/step');
        // 스텝은 가장 오래된 진행 중 작업을 처리한다 — 다른 작업이었으면 우리 작업을 따로 읽는다
        j = r.job?.id === start.id ? r.job : await att<Job>('GET', `/api/admin/jobs/${start.id}`);
        if (alive.current) setJob(j);
        if (!r.processed) await sleep(1000); // 동시 스텝·크론과 겹쳐 진전이 없으면 잠깐 쉰다
      }
      if (alive.current && !ACTIVE(j)) {
        setMsg(j.phase === 'done' ? `${j.ym} 마감을 완료했습니다.` : `${j.ym} 마감 작업이 취소되었습니다.`);
        setReloadKey((k) => k + 1);
      }
    } catch (e) {
      if (alive.current) setError(`마감 진행 중 오류: ${errorText(e)} — '이어 하기'로 다시 시도하세요.`);
    } finally {
      if (runningId.current === start.id) runningId.current = null;
      if (alive.current) setStepping(false);
    }
  }, []);

  // 탭 진입 시 진행 중 마감 작업을 이어 표시·진행
  useEffect(() => {
    att<Job[]>('GET', '/api/admin/jobs', { query: { active: '1' } })
      .then((js) => {
        const j = js.filter((x) => x.kind === 'close').sort((a, b) => a.id - b.id)[0]; // 스텝은 가장 오래된 작업부터
        if (j && alive.current) runSteps(j);
      })
      .catch((e) => alive.current && setError(errorText(e)));
  }, [runSteps]);

  const status = month?.status ?? 'open';
  const past = ym < thisYm();

  const close = async () => {
    const warn = pre ? [pre.pending && `대기 정정 ${pre.pending}건`, pre.missing && `출퇴근 누락 ${pre.missing}건`].filter(Boolean).join(', ') : '';
    if (!window.confirm(`${ym} 근태를 마감하시겠습니까?${warn ? `\n\n남은 항목: ${warn}` : ''}\n\n마감 후에는 이 달 근태를 수정할 수 없습니다(마감 취소로 다시 열 수 있음).`)) return;
    setBusy(true);
    setError('');
    setMsg('');
    try {
      const { job: j } = await att<{ job: Job }>('POST', `/api/admin/months/${ym}/close`);
      await logEvent('attendance.close', { targetId: ym, meta: { jobId: j.id } });
      setMonth((m) => ({ ...(m ?? { ym }), status: 'closing' }));
      runSteps(j);
    } catch (e) {
      setError(errorText(e));
      setReloadKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  };

  const reopen = async () => {
    if (!window.confirm(`${ym} 마감을 취소하시겠습니까?\n\n${status === 'closing' ? '진행 중인 마감 작업이 취소됩니다. ' : ''}이 달 근태를 다시 수정할 수 있게 되고, 자동 마감도 하지 않습니다.`)) return;
    setBusy(true);
    setError('');
    setMsg('');
    try {
      await att('POST', `/api/admin/months/${ym}/reopen`);
      await logEvent('attendance.reopen', { targetId: ym });
      if (job?.ym === ym) { runningId.current = null; setJob(null); }
      setMsg(`${ym} 마감을 취소했습니다.`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
      setReloadKey((k) => k + 1);
    }
  };

  /** 20명 페이지를 nextCursor 가 null 일 때까지 모아 18열 엑셀로. */
  const exportXlsx = async () => {
    setError('');
    setMsg('');
    setExp({ emps: 0, rows: 0 });
    try {
      const all: ExportRow[] = [];
      const seen = new Set<string>();
      let cursor = '';
      for (;;) {
        const r = await att<{ rows: ExportRow[]; nextCursor: string | null }>('GET', '/api/admin/export', { query: { ym, cursor } });
        all.push(...r.rows);
        r.rows.forEach((x) => seen.add(String(x.사번)));
        if (alive.current) setExp({ emps: seen.size, rows: all.length });
        if (!r.nextCursor || r.nextCursor === cursor) break;
        cursor = r.nextCursor;
      }
      const closed = status === 'closed';
      const name = `근태_${ym}${closed ? '' : '_미마감'}.xlsx`;
      downloadXlsx(xlsxWrite([[...EXPORT_COLUMNS], ...all.map((r) => EXPORT_COLUMNS.map((k) => r[k]))], `근태_${ym}`), name);
      await logEvent('attendance.export', { targetId: ym, meta: { employees: seen.size, rows: all.length, closed } });
      if (alive.current) setMsg(`${name} — ${seen.size}명 ${all.length}행을 내려받았습니다.`);
    } catch (e) {
      if (alive.current) setError(`엑셀 만들기 실패: ${errorText(e)}`);
    } finally {
      if (alive.current) setExp(null);
    }
  };

  const jobHere = job && job.ym === ym ? job : null;
  const pct = jobHere && jobHere.total ? Math.min(100, Math.round((jobHere.done / jobHere.total) * 100)) : 0;
  const steps: { title: string; done: boolean; active?: boolean; detail: string }[] = [
    { title: '대기 정정 처리', done: !!pre && !pre.pending, detail: pre ? (pre.pending ? `${pre.pending}건 남음` : '없음') : '-' },
    { title: '출퇴근 누락 확인', done: !!pre && !pre.missing, detail: pre ? (pre.missing ? `${pre.missing}건 남음` : '없음') : '-' },
    {
      title: '재계산',
      done: status === 'closed' || jobHere?.phase === 'snapshot',
      active: jobHere?.phase === 'recompute',
      detail: status === 'closed' ? '완료' : jobHere?.phase === 'recompute' ? `${jobHere.done}/${jobHere.total}` : jobHere?.phase === 'snapshot' ? '완료' : '마감 시 실행',
    },
    {
      title: '스냅샷·마감',
      done: status === 'closed',
      active: jobHere?.phase === 'snapshot',
      detail: status === 'closed' ? `마감${month?.closed_at ? ` · ${month.closed_at.slice(0, 16)}` : ''}` : jobHere?.phase === 'snapshot' ? `${jobHere.done}/${jobHere.total}` : '대기',
    },
  ];

  const confirmedN = confs?.filter((c) => c.confirmed_at).length ?? 0;
  const shownConfs = confs?.filter((c) => !onlyUnconfirmed || !c.confirmed_at);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" onClick={() => onChangeYm(shiftYm(ym, -1))} aria-label="이전 달" className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 cursor-pointer">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-base font-bold text-slate-900 tabular-nums min-w-24 text-center" aria-live="polite">{ym.slice(0, 4)}년 {+ym.slice(5)}월</span>
        <button type="button" onClick={() => onChangeYm(shiftYm(ym, 1))} aria-label="다음 달" className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 cursor-pointer">
          <ChevronRight className="w-4 h-4" />
        </button>
        <span className={`px-2 py-1 rounded-md border text-[11px] font-semibold ${status === 'closed' ? 'bg-slate-700 border-slate-700 text-white' : status === 'closing' ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
          {MONTH_STATUS_LABELS[status]}
        </span>
        <button type="button" onClick={() => setReloadKey((k) => k + 1)} disabled={loading} className={`${btn} ml-auto border border-slate-200 bg-white hover:bg-slate-50 text-slate-600`}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> 새로고침
        </button>
      </div>

      {error && <p role="alert" className="text-xs text-rose-700 font-semibold bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}
      {msg && <p role="status" className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{msg}</p>}

      {/* 다른 달의 진행 중 작업도 보이게 */}
      {job && job.ym !== ym && ACTIVE(job) && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {job.ym} 마감 진행 중 ({job.done}/{job.total}){' '}
          <button type="button" onClick={() => onChangeYm(job.ym)} className="underline font-semibold cursor-pointer">이 달 보기</button>
        </p>
      )}

      <section className={`${card} p-4 space-y-4`} aria-label="마감 단계">
        <ol className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {steps.map((s, i) => (
            <li key={s.title} className={`rounded-lg border p-3 ${s.done ? 'border-emerald-200 bg-emerald-50/50' : s.active ? 'border-blue-200 bg-blue-50/50' : 'border-slate-200'}`}>
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                {s.done ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : s.active ? <Loader2 className="w-4 h-4 text-blue-600 animate-spin" /> : <Circle className="w-4 h-4 text-slate-300" />}
                {i + 1}. {s.title}
              </div>
              <p className="mt-1 text-[11px] text-slate-500 tabular-nums">{s.detail}</p>
            </li>
          ))}
        </ol>

        {pre && (pre.unmatched > 0 || pre.unscheduled.length > 0) && (
          <p className="text-[11px] text-slate-500">
            참고: 사번 미매칭 타각 {pre.unmatched}건 · 근무표 없는 근태 대상 {pre.unscheduled.length}명
            {pre.unscheduled.length > 0 && ` (${pre.unscheduled.slice(0, 10).join(', ')}${pre.unscheduled.length > 10 ? ' …' : ''})`}
          </p>
        )}

        {jobHere && ACTIVE(jobHere) && (
          <div aria-live="polite">
            <div className="flex justify-between text-[11px] text-slate-500 mb-1">
              <span>{jobHere.phase === 'recompute' ? '재계산' : '스냅샷'} 진행 중{!stepping && ' (멈춤)'}</span>
              <span className="tabular-nums">{jobHere.done}/{jobHere.total} · {pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full bg-blue-600 transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          {status === 'open' && (
            <button type="button" onClick={close} disabled={busy || loading || !past || stepping} className={`${btn} bg-blue-600 hover:bg-blue-700 text-white`}>
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />} 지금 마감하기
            </button>
          )}
          {status === 'closing' && jobHere && !stepping && (
            <button type="button" onClick={() => runSteps(jobHere)} className={`${btn} bg-blue-600 hover:bg-blue-700 text-white`}>
              <RefreshCw className="w-3.5 h-3.5" /> 이어 하기
            </button>
          )}
          {status !== 'open' && (
            <button type="button" onClick={reopen} disabled={busy} className={`${btn} border border-slate-200 bg-white hover:bg-slate-50 text-rose-600`}>
              <Unlock className="w-3.5 h-3.5" /> 마감 취소
            </button>
          )}
          {status === 'open' && !past && <span className="text-[11px] text-slate-400">지난 달만 마감할 수 있습니다.</span>}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className={`${card} min-w-0`} aria-label="직원 확정 현황">
          <div className="flex items-center gap-2 flex-wrap p-3 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-800">직원 확정</h2>
            <span className="text-xs text-slate-500 tabular-nums">{confs ? `${confirmedN}/${confs.length}명` : ''}</span>
            <label className="ml-auto flex items-center gap-1.5 text-xs text-slate-600">
              <input type="checkbox" checked={onlyUnconfirmed} onChange={(e) => setOnlyUnconfirmed(e.target.checked)} /> 미확정만
            </label>
          </div>
          <p className="px-3 pt-2 text-[11px] text-slate-400">참고용 — 미확정이어도 마감할 수 있습니다.</p>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500 sticky top-0">
                <tr className="text-left">{['사번', '이름', '부서', '확정'].map((h) => <th key={h} className="px-3 py-2 font-semibold whitespace-nowrap">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!shownConfs ? <tr><td colSpan={4} className="p-6 text-center text-slate-400">불러오는 중…</td></tr>
                  : shownConfs.length === 0 ? <tr><td colSpan={4} className="p-6 text-center text-slate-400">{onlyUnconfirmed ? '미확정 직원이 없습니다.' : '근태 대상이 없습니다.'}</td></tr>
                  : shownConfs.map((c) => (
                    <tr key={c.sabun}>
                      <td className="px-3 py-2 whitespace-nowrap">{c.sabun}</td>
                      <td className="px-3 py-2 whitespace-nowrap font-semibold">{c.name}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{c.dept ?? '—'}</td>
                      <td className={`px-3 py-2 whitespace-nowrap ${c.confirmed_at ? 'text-emerald-700' : 'text-slate-400'}`}>{c.confirmed_at ? c.confirmed_at.slice(0, 16) : '미확정'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={`${card} p-4 space-y-3 h-fit`} aria-label="급여 엑셀">
          <h2 className="text-sm font-bold text-slate-800">급여 엑셀</h2>
          <p className="text-[11px] text-slate-500">기준표 18열 · 일별 행 · 20명씩 받아 한 파일로 합칩니다.{status !== 'closed' && ' 마감 전이면 현재 값으로 만들고 파일명에 _미마감 이 붙습니다.'}</p>
          <button type="button" onClick={exportXlsx} disabled={!!exp} className={`${btn} w-full justify-center ${status === 'closed' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'border border-slate-200 bg-white hover:bg-slate-50 text-slate-700'}`}>
            {exp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            {status === 'closed' ? '엑셀 내려받기' : '현재 값 미리 받기'}
          </button>
          {exp && <p className="text-[11px] text-slate-500 tabular-nums" aria-live="polite">{exp.emps}명 · {exp.rows}행 받는 중…</p>}
        </section>
      </div>
    </div>
  );
}
