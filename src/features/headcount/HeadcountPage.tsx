/**
 * 인력현황 — HeadcountAnalysis(4서브탭) DB 연동 래퍼.
 * DashboardPage 의 파생 계산 함수를 재사용해 상세분석/입퇴사Peak/인력구성비 데이터를 만들고,
 * 4번째 탭(휴직복직)은 휴직자관리로 단일화되어 링크만 제공한다(HC-4 중복 제거 결정).
 */
import { useEffect, useState } from 'react';
import { HeadcountAnalysis, type FieldWorkDrilldown } from '../../components/HeadcountAnalysis';
import { listEmployees, listLeave, type Employee, type LeaveRecord } from '../../lib/db';
import { isRealOrg, isLeader, dday } from '../../excel/derive';
import {
  buildMonthly,
  buildTenureByDepartment,
  buildJobTypeRatio,
  groupBy,
  pct,
} from '../../lib/stats';
import type { RatioData } from '../../types';

const TENURE_BAND_ORDER = ['1년 미만', '1~3년', '3~5년', '5~10년', '10년 이상'];
const TENURE_COLORS = ['#f43f5e', '#f59e0b', '#3b82f6', '#10b981', '#6366f1'];

function buildTenureBandRatio(active: Employee[]): RatioData[] {
  const total = active.length;
  return TENURE_BAND_ORDER.map((band, i) => {
    const count = active.filter((e) => e._tenureBand === band).length;
    return { name: band, value: count, color: TENURE_COLORS[i], percentage: pct(count, total) };
  });
}

/**
 * 현장직을 생산직/물류직으로 나누고 팀별 인원·리더를 집계한다.
 * 현장직 판정 자체는 직급 기준(derive.ts officeType)이고, 여기서의 생산/물류 구분만 소속명 기준이다.
 * 두 정규식에 걸리지 않는 현장직(예: 설비기술팀)은 '기타'로 모아 총원과 합계가 어긋나지 않게 한다.
 */
function buildFieldWorkDrilldown(active: Employee[]): FieldWorkDrilldown {
  const field = active.filter((e) => e._office === '현장직');
  const cats: { id: string; name: string; re: RegExp }[] = [
    { id: 'prod', name: '생산직', re: /생산|품질/ },
    { id: 'logistics', name: '물류직', re: /물류/ },
    { id: 'etc', name: '기타 현장직', re: /(?!)/ }, // 아래에서 미분류 인원을 채운다
  ];
  const classified = new Set<Employee>();
  const categories = cats.map((cat) => {
    const members =
      cat.id === 'etc'
        ? field.filter((e) => !classified.has(e))
        : field.filter((e) => cat.re.test(`${e._team} ${e._div}`));
    members.forEach((e) => classified.add(e));
    const byTeam = groupBy(members.filter((e) => isRealOrg(e._team)), (e) => e._team);
    const teams = Object.entries(byTeam)
      .sort((a, b) => b[1].length - a[1].length)
      .map(([teamName, arr]) => ({
        teamName,
        count: arr.length,
        leader: arr.find((e) => isLeader(e))?._name ?? '-',
        // ponytail: 근무 교대 형태 데이터 소스 없음(테이블 컬럼 제거로 대체)
        shift: '-',
      }));
    return { id: cat.id, name: cat.name, totalCount: members.length, teams, recentTrend: '' };
  });
  return { total: field.length, categories: categories.filter((c) => c.totalCount > 0) };
}

function buildEmploymentBreakdown(active: Employee[], leaveOfAbsenceCount: number) {
  const regular = active.filter((e) => /^정규/.test(e._emp)).length;
  const contract = Math.max(active.length - regular - leaveOfAbsenceCount, 0);
  return { regular, contract, leave: leaveOfAbsenceCount };
}

interface HeadcountPageProps {
  /** "휴직자 관리로 이동" 클릭 시 호출(App.tsx 라우팅) */
  onNavigateLeave: () => void;
}

export function HeadcountPage({ onNavigateLeave }: HeadcountPageProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leave, setLeave] = useState<LeaveRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listEmployees(), listLeave()]).then(([emp, lv]) => {
      if (cancelled) return;
      setEmployees(emp);
      setLeave(lv);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-24 text-sm text-slate-500">불러오는 중...</div>;
  }

  const active = employees.filter((e) => e._activeNow);
  const leaveOfAbsenceCount = leave.filter((l) => l.status === '휴직중').length;
  const upcomingReturnCount = leave.filter((l) => {
    if (l.status === '복직완료') return false;
    const d = dday(l.expected_return_date);
    return d != null && d >= 0 && d <= 30;
  }).length;

  return (
    <HeadcountAnalysis
      totalEmployees={active.length}
      monthlyData={buildMonthly(employees)}
      tenureByDepartment={buildTenureByDepartment(employees).filter((t) => isRealOrg(t.department))}
      tenureBandRatio={buildTenureBandRatio(active)}
      jobTypeRatioData={buildJobTypeRatio(active)}
      fieldWorkDrilldown={buildFieldWorkDrilldown(active)}
      employmentBreakdown={buildEmploymentBreakdown(active, leaveOfAbsenceCount)}
      leaveOfAbsenceCount={leaveOfAbsenceCount}
      upcomingReturnCount={upcomingReturnCount}
      onOpenMonthModal={() => {}}
      onNavigateLeave={onNavigateLeave}
    />
  );
}
