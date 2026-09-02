/**
 * 대시보드·인력현황·구성다양성이 공유하는 순수 집계 함수.
 * (원래 DashboardPage.tsx 안에 있었으나 페이지가 페이지를 import 하는 구조였고 JSX 없이
 *  테스트할 수 없었다 → 순수 계산만 이 파일로 분리)
 *
 * 모든 함수는 "기준일(asOf) 시점 스냅샷" 을 전제로 한다. 호출 측이 deriveAllAsOf(rows, asOf)
 * 로 파생필드를 재계산한 배열을 넘기면 _activeNow/_age/_tenure 가 그 기준일 값이 된다.
 */
import { today, localISO, isRealOrg } from '../excel/derive';
import type { Employee } from '../excel/derive';
import type { LeaveRecord } from './db';
import type { KPIData, MonthlyHireLeaverData, DetailedMatrixRow, RatioData } from '../types';

const pad2 = (n: number) => String(n).padStart(2, '0');

/** 0으로 나눔 방지 백분율 (소수 1자리, 정수 반환은 기존 mockData 관례를 따른다) */
export const pct = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

export function groupBy<T>(arr: T[], keyFn: (t: T) => string): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const item of arr) {
    const k = keyFn(item);
    (out[k] ||= []).push(item);
  }
  return out;
}

const GENDER_COLOR: Record<string, string> = { 남성: '#3b82f6', 여성: '#ec4899' };
const NATIONALITY_COLOR: Record<string, string> = { 내국인: '#0284c7', 외국인: '#f59e0b' };
const JOBTYPE_COLOR: Record<string, string> = { 사무직: '#6366f1', 현장직: '#10b981' };
const AGE_COLOR: Record<string, string> = {
  '20대 이하': '#06b6d4',
  '30대': '#3b82f6',
  '40대': '#8b5cf6',
  '50대 이상': '#64748b',
};
const POSITION_PALETTE = ['#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af', '#172554'];

export function buildGenderRatio(active: Employee[]): RatioData[] {
  const male = active.filter((e) => e._sex === '남').length;
  const female = active.filter((e) => e._sex === '여').length;
  const total = male + female;
  return [
    { name: '남성', value: male, color: GENDER_COLOR['남성'], percentage: pct(male, total) },
    { name: '여성', value: female, color: GENDER_COLOR['여성'], percentage: pct(female, total) },
  ];
}

export function buildNationalityRatio(active: Employee[]): RatioData[] {
  const foreign = active.filter((e) => e._foreign).length;
  const domestic = active.length - foreign;
  const total = active.length;
  return [
    { name: '내국인', value: domestic, color: NATIONALITY_COLOR['내국인'], percentage: pct(domestic, total) },
    { name: '외국인', value: foreign, color: NATIONALITY_COLOR['외국인'], percentage: pct(foreign, total) },
  ];
}

/** 사무직/현장직 — 판정 규칙은 derive.ts officeType(직급 기준)이 단독으로 갖는다. */
export function buildJobTypeRatio(active: Employee[]): RatioData[] {
  const office = active.filter((e) => e._office === '사무직').length;
  const field = active.length - office;
  const total = active.length;
  return [
    { name: '사무직', value: office, color: JOBTYPE_COLOR['사무직'], percentage: pct(office, total) },
    { name: '현장직', value: field, color: JOBTYPE_COLOR['현장직'], percentage: pct(field, total) },
  ];
}

export function buildAgeRatio(active: Employee[]): RatioData[] {
  const total = active.length;
  const bands: RatioData['name'][] = ['20대 이하', '30대', '40대', '50대 이상'];
  return bands.map((band) => {
    const count = active.filter((e) => e._ageBand === band).length;
    return { name: band, value: count, color: AGE_COLOR[band], percentage: pct(count, total) };
  });
}

export function buildPositionDistribution(active: Employee[]) {
  const total = active.length;
  const grouped = groupBy(active.filter((e) => isRealOrg(e._grade)), (e) => e._grade);
  return Object.entries(grouped)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([name, arr], i) => ({
      name,
      count: arr.length,
      percentage: pct(arr.length, total),
      color: POSITION_PALETTE[i % POSITION_PALETTE.length],
    }));
}

/**
 * 부서별 인원 분포. 부서 = 그룹웨어 기준 부서 = 전체소속명 마지막 토큰(= `소속` 컬럼) = _team.
 * (2026-08 요청으로 본부(_div) → 부서(_team) 로 변경)
 */
export function buildDepartmentDistribution(active: Employee[]) {
  const total = active.length;
  const grouped = groupBy(active.filter((e) => isRealOrg(e._team)), (e) => e._team);
  return Object.entries(grouped)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([name, arr]) => ({
      name,
      count: arr.length,
      percentage: pct(arr.length, total),
      fillRate: 100, // ponytail: 목데이터의 정원충족률 필드 — DB 에 정원(TO) 데이터 없어 100 고정
    }));
}

/** ISO 날짜(YYYY-MM-DD) 간 일수 차. Date.parse 는 UTC 파싱이라 DST/시간대 영향 없음. */
const dayDiff = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86400000);

/** 근속 365일 미만 퇴사(입사 당일 퇴사 = 0일도 포함) */
const isEarlyLeaver = (hire: string | null, quit: string | null) =>
  !!hire && !!quit && dayDiff(hire, quit) < 365;

/** 소수 둘째 자리 반올림 (명세: ROUND(rate, 2)) */
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * 연간 누적 퇴사율 / 1년 내 조기 퇴사율(방식 B).
 *   연간 누적 = 당해 퇴사자 / ((연초 재직자 + 연말 재직자) / 2) × 100
 *   조기 = 당해 퇴사자 중 근속 365일 미만 / 당해 퇴사자 × 100
 * 진행 중인 연도면 "연말" 을 기준일(asOf) 로 잡는다. 분모 0 이면 0% 로 반환.
 */
export function buildTurnoverRates(
  records: { hireDate: string | null; quitDate: string | null }[],
  asOf: string
) {
  const year = asOf.slice(0, 4);
  const yearStart = `${year}-01-01`;
  // ponytail: 진행 중인 연도는 asOf 가 연말을 대신한다(퇴사자 집계 상한도 동일하게 clamp)
  const yearEnd = asOf < `${year}-12-31` ? asOf : `${year}-12-31`;

  const leavers = records.filter((r) => r.quitDate && r.quitDate >= yearStart && r.quitDate <= yearEnd);
  const earlyLeavers = leavers.filter((r) => isEarlyLeaver(r.hireDate, r.quitDate)).length;

  const startHeadcount = records.filter(
    (r) => r.hireDate && r.hireDate < yearStart && (!r.quitDate || r.quitDate >= yearStart)
  ).length;
  const endHeadcount = records.filter(
    (r) => r.hireDate && r.hireDate <= yearEnd && (!r.quitDate || r.quitDate > yearEnd)
  ).length;
  const avgHeadcount = (startHeadcount + endHeadcount) / 2;

  return {
    leavers: leavers.length,
    earlyLeavers,
    startHeadcount,
    endHeadcount,
    avgHeadcount,
    annualRate: avgHeadcount > 0 ? round2((leavers.length / avgHeadcount) * 100) : 0,
    earlyRate: leavers.length > 0 ? round2((earlyLeavers / leavers.length) * 100) : 0,
  };
}

/**
 * 부서(=팀)별 평균 근속·조기퇴사율. 집계 단위는 buildDepartmentDistribution 과 동일하게 _team.
 * 조기퇴사율은 buildTurnoverRates 와 같은 방식 B(분모=해당 부서 퇴사자)를 쓴다.
 */
export function buildTenureByDepartment(employees: Employee[]) {
  const grouped = groupBy(employees.filter((e) => isRealOrg(e._team)), (e) => e._team);
  return Object.entries(grouped).map(([department, arr]) => {
    const active = arr.filter((e) => e._activeNow && e._tenure != null);
    const avgYears = active.length
      ? active.reduce((sum, e) => sum + (e._tenure as number), 0) / active.length
      : 0;
    const leavers = arr.filter((e) => e._retired);
    const earlyLeavers = leavers.filter((e) => isEarlyLeaver(e._hireDate, e._quitDate)).length;
    const earlyTurnoverRate = leavers.length ? round2((earlyLeavers / leavers.length) * 100) : 0;
    return { department, avgYears, earlyTurnoverRate };
  });
}

/**
 * 기준일 시점 휴직 여부. leave_records 에 실제 복직일 컬럼이 없어 (휴직시작일 ~ 복직예정일)
 * 구간으로 판정한다. status 문자열만 보던 기존 방식은 '오늘' 전용이라 과거 기준일에서 틀렸다.
 */
export const onLeaveAsOf = (l: LeaveRecord, asOf: string): boolean =>
  !!l.start_date && l.start_date <= asOf && (!l.expected_return_date || l.expected_return_date > asOf);

/** 기준일 시점 재직 여부(입사일 ≤ 기준일 < 퇴직일) */
export const activeAsOf = (
  e: { _hireDate: string | null; _quitDate: string | null },
  asOf: string
): boolean => !!e._hireDate && e._hireDate <= asOf && (!e._quitDate || e._quitDate > asOf);

export function buildKPI(employees: Employee[], leave: LeaveRecord[], asOf: string): KPIData {
  const [y, m] = asOf.split('-').map(Number);
  const currentYM = asOf.slice(0, 7);
  const prevMonthDate = new Date(y, m - 2, 1);
  const prevYM = `${prevMonthDate.getFullYear()}-${pad2(prevMonthDate.getMonth() + 1)}`;
  const prevMonthEndISO = localISO(new Date(y, m - 1, 0));

  const totalEmployees = employees.filter((e) => e._activeNow).length;
  const newHiresThisMonth = employees.filter((e) => e._hireDate?.slice(0, 7) === currentYM).length;
  const leaversThisMonth = employees.filter((e) => e._quitDate?.slice(0, 7) === currentYM).length;
  const prevMonthActive = employees.filter((e) => activeAsOf(e, prevMonthEndISO)).length;
  const prevMonthHires = employees.filter((e) => e._hireDate?.slice(0, 7) === prevYM).length;
  const prevMonthLeavers = employees.filter((e) => e._quitDate?.slice(0, 7) === prevYM).length;
  const leaveOfAbsenceCount = leave.filter((l) => onLeaveAsOf(l, asOf)).length;
  const prevLeaveCount = leave.filter((l) => onLeaveAsOf(l, prevMonthEndISO)).length;

  return {
    totalEmployees,
    newHiresThisMonth,
    leaversThisMonth,
    leaveOfAbsenceCount,
    totalTO: totalEmployees,
    fillRate: 100,
    prevMonthDiff: {
      total: totalEmployees - prevMonthActive,
      newHires: newHiresThisMonth - prevMonthHires,
      leavers: leaversThisMonth - prevMonthLeavers,
      leave: leaveOfAbsenceCount - prevLeaveCount,
    },
  };
}

/** 기준일 연도의 월별 입·퇴사 추이(전년 동월 비교 포함). asOf 미지정 시 오늘 기준. */
export function buildMonthly(employees: Employee[], asOf?: string): MonthlyHireLeaverData[] {
  const base = asOf ?? localISO(today());
  const [year, curMonth] = base.split('-').map(Number);

  const countBy = (field: '_hireDate' | '_quitDate', ym: string) =>
    employees.filter((e) => e[field]?.slice(0, 7) === ym).length;

  return Array.from({ length: 12 }, (_, idx) => {
    const m = idx + 1;
    const ym = `${year}-${pad2(m)}`;
    const prevYm = `${year - 1}-${pad2(m)}`;
    const currentYearHires = countBy('_hireDate', ym);
    const currentYearLeavers = countBy('_quitDate', ym);
    const prevYearHires = countBy('_hireDate', prevYm);
    const prevYearLeavers = countBy('_quitDate', prevYm);
    const month = m < curMonth ? `${m}월` : m === curMonth ? `${m}월 (당월)` : `${m}월 (예상)`;
    return {
      month,
      currentYearHires,
      currentYearLeavers,
      prevYearHires,
      prevYearLeavers,
      netChange: currentYearHires - currentYearLeavers,
    };
  });
}

/** 법인명·근무지명에 공백이 있어(예: '천안 본사') 그룹 키 구분자로 유닛구분자를 쓴다.
 * 제어문자를 소스에 직접 넣으면 파일이 바이너리로 취급돼 grep 에서 누락되므로 이스케이프로 쓴다. */
const MATRIX_KEY_SEP = '\u001F';

/** 법인×근무지 인원집계 현황표. 휴직 인원은 기준일 시점으로 센다. */
export function buildMatrixRows(
  employees: Employee[],
  leave: LeaveRecord[],
  asOf: string
): DetailedMatrixRow[] {
  const active = employees.filter((e) => e._activeNow);
  const onLeaveIds = new Set(leave.filter((l) => onLeaveAsOf(l, asOf)).map((l) => l.employee_id));
  const g = groupBy(
    active.filter((e) => isRealOrg(e._corp)),
    (e) => `${e._corp}${MATRIX_KEY_SEP}${e._site}`
  );
  return Object.entries(g).map(([key, arr], i) => {
    const [corp, site] = key.split(MATRIX_KEY_SEP);
    return {
      id: String(i + 1),
      corporation: corp,
      location: site,
      maleCount: arr.filter((e) => e._sex === '남').length,
      femaleCount: arr.filter((e) => e._sex === '여').length,
      domesticCount: arr.filter((e) => !e._foreign).length,
      foreignCount: arr.filter((e) => e._foreign).length,
      leaveCount: arr.filter((e) => onLeaveIds.has(e['id'] as string)).length,
      totalCount: arr.length,
    };
  });
}
