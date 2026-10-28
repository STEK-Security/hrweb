/**
 * 근태관리 — time.stek.win 관리 API(Edge Function `attendance` 경유) 화면. 스펙 11.7.
 * 하위 탭은 기존 메뉴처럼 상태로 전환하고(URL 해시 없음), 선택한 달은 탭끼리 공유한다.
 */
import { useCallback, useEffect, useState } from 'react';
import { att } from '../../lib/attendance';
import { StatusTab } from './StatusTab';
import { ScheduleTab } from './ScheduleTab';
import { CorrectionsTab } from './CorrectionsTab';
import { CloseTab } from './CloseTab';
import { RulesTab } from './RulesTab';
import { EmployeesTab } from './EmployeesTab';

const TABS = ['현황', '근무표', '정정·승인', '확정·마감', '규칙', '직원 설정'] as const;
type Tab = (typeof TABS)[number];

/** KST 기준 이번 달 'YYYY-MM'. */
const thisYm = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 7);

export function AttendancePage() {
  const [tab, setTab] = useState<Tab>('현황');
  const [ym, setYm] = useState(thisYm);
  const [pending, setPending] = useState<number | null>(null);

  const reloadPending = useCallback(() => {
    att<unknown[]>('GET', '/api/admin/corrections', { query: { status: 'pending' } })
      .then((r) => setPending(r.length))
      .catch(() => setPending(null)); // 배지만 빠진다 — 각 탭이 자체 오류를 보여준다
  }, []);
  useEffect(reloadPending, [reloadPending]);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-slate-900">근태관리</h1>
          <p className="text-xs text-slate-500">time.stek.win 출퇴근 기록·근무표·마감</p>
        </div>
      </div>

      <div role="tablist" aria-label="근태관리 하위 메뉴" className="flex gap-1 border-b border-slate-200 overflow-x-auto no-scrollbar">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            id={`att-tab-${t}`}
            aria-selected={tab === t}
            aria-controls="att-tabpanel"
            onClick={() => setTab(t)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs md:text-sm font-semibold whitespace-nowrap -mb-px border-b-2 transition-colors cursor-pointer ${
              tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-blue-600'
            }`}
          >
            {t}
            {t === '정정·승인' && !!pending && (
              <span className="min-w-5 px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold leading-none" aria-label={`대기 ${pending}건`}>
                {pending}
              </span>
            )}
          </button>
        ))}
      </div>

      <div role="tabpanel" id="att-tabpanel" aria-labelledby={`att-tab-${tab}`}>
        {tab === '현황' ? (
          <StatusTab ym={ym} onChangeYm={setYm} pending={pending} />
        ) : tab === '근무표' ? (
          <ScheduleTab />
        ) : tab === '정정·승인' ? (
          <CorrectionsTab />
        ) : tab === '확정·마감' ? (
          <CloseTab />
        ) : tab === '규칙' ? (
          <RulesTab />
        ) : (
          <EmployeesTab />
        )}
      </div>
    </div>
  );
}

