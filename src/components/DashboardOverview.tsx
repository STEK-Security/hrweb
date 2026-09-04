import React, { useState, useEffect, useRef } from 'react';
import {
  KPIData,
  MonthlyHireLeaverData,
  DetailedMatrixRow,
  CalendarEventItem,
  RatioData,
} from '../types';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  ComposedChart,
  Line,
} from 'recharts';
import {
  Users,
  UserPlus,
  UserMinus,
  UserCheck,
  Target,
  TrendingUp,
  Clock,
  Building,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { buildTurnoverRates } from '../lib/stats';
import { KeyMetricsSummary } from './KeyMetricsSummary';
import { RecruitmentDashboard } from './RecruitmentDashboard';

interface DashboardOverviewProps {
  kpiData: KPIData;
  monthlyData: MonthlyHireLeaverData[];
  matrixRows: DetailedMatrixRow[];
  calendarEvents: CalendarEventItem[];
  onSelectMonthModal: (data: MonthlyHireLeaverData) => void;
  onOpenAddSchedule: () => void;
  selectedCorp: string;
  genderRatioData?: RatioData[];
  nationalityRatioData?: RatioData[];
  jobTypeRatioData?: RatioData[];
  ageRatioData?: RatioData[];
  positionDistributionData?: { name: string; count: number; percentage: number; color: string }[];
  departmentDistributionData?: { name: string; count: number; percentage: number; fillRate: number }[];
  tenureByDepartment?: { department: string; avgYears: number; earlyTurnoverRate: number }[];
  /** 기준일(ISO yyyy-mm-dd). 상위(DashboardPage)가 소유한다 — 이 값이 바뀌면 상위가 모든 집계를 재계산한다. */
  asOfDate?: string;
  onChangeAsOfDate?: (iso: string) => void;
  employeeRecords?: { hireDate: string | null; quitDate: string | null }[];
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  kpiData,
  monthlyData,
  matrixRows,
  calendarEvents,
  onSelectMonthModal,
  onOpenAddSchedule,
  selectedCorp,
  genderRatioData = [],
  nationalityRatioData = [],
  jobTypeRatioData = [],
  ageRatioData = [],
  positionDistributionData = [],
  departmentDistributionData = [],
  tenureByDepartment = [],
  asOfDate: asOfDateProp,
  onChangeAsOfDate,
  employeeRecords = [],
}) => {
  const today = new Date();
  const todayDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const corpNames = [...new Set(matrixRows.map((r) => r.corporation))];

  // 기준일은 상위가 소유한다. prop 미지정(구 호출부 호환) 시에만 오늘로 고정.
  const asOfDate = asOfDateProp ?? todayDateStr;
  const setAsOfDate = (iso: string) => onChangeAsOfDate?.(iso);
  const [selectedDay, setSelectedDay] = useState<number>(today.getDate());
  const [tableFilter, setTableFilter] = useState<string>(
    selectedCorp && corpNames.includes(selectedCorp) ? selectedCorp : '전체'
  );

  // Calendar popover state
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarYear, setCalendarYear] = useState(today.getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(today.getMonth() + 1); // 1-12
  const calendarRef = useRef<HTMLDivElement>(null);

  // Parse as-of date
  const [asOfYear, asOfMonth, asOfDay] = asOfDate.split('-').map(Number);

  // Close calendar popover on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setIsCalendarOpen(false);
      }
    };
    if (isCalendarOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isCalendarOpen]);

  // Calendar generator helpers
  const daysInMonthCount = new Date(calendarYear, calendarMonth, 0).getDate();
  const monthFirstDayOfWeek = new Date(calendarYear, calendarMonth - 1, 1).getDay(); // 0=Sun, ..., 6=Sat
  const calendarDays = Array.from({ length: daysInMonthCount }, (_, i) => i + 1);
  const calendarEmptySlots = Array.from({ length: monthFirstDayOfWeek }, (_, i) => i);

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (calendarMonth === 1) {
      setCalendarYear((prev) => prev - 1);
      setCalendarMonth(12);
    } else {
      setCalendarMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (calendarMonth === 12) {
      setCalendarYear((prev) => prev + 1);
      setCalendarMonth(1);
    } else {
      setCalendarMonth((prev) => prev + 1);
    }
  };

  const handleSelectDate = (day: number) => {
    const formattedDate = `${calendarYear}-${String(calendarMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setAsOfDate(formattedDate);
    setSelectedDay(day);
    setIsCalendarOpen(false);
  };

  // 기준일(asOfDate)에 맞춰 총원·입사자·퇴사자를 다시 계산한다.
  // 업로드된 엑셀의 입·퇴사일이 있으면 그것으로, 없으면 기존 KPI 값을 쓴다.
  const asOfMonthKey = `${asOfYear}-${String(asOfMonth).padStart(2, '0')}`;
  const prevMonthDate = new Date(asOfYear, asOfMonth - 2, 1);
  const prevMonthKey = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;
  const monthEnd = (key: string) => {
    const [y, m] = key.split('-').map(Number);
    const d = new Date(y, m, 0);
    return `${y}-${String(m).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const headcountAsOf = (dateStr: string) =>
    employeeRecords.filter(
      (r) => r.hireDate && r.hireDate <= dateStr && (!r.quitDate || r.quitDate > dateStr)
    ).length;
  const inMonth = (d: string | null, key: string) => !!d && d.slice(0, 7) === key;

  const hasRecords = employeeRecords.length > 0;
  const currentTotal = hasRecords ? headcountAsOf(asOfDate) : kpiData.totalEmployees;
  const currentNewHires = hasRecords
    ? employeeRecords.filter((r) => inMonth(r.hireDate, asOfMonthKey)).length
    : kpiData.newHiresThisMonth;
  const currentLeavers = hasRecords
    ? employeeRecords.filter((r) => inMonth(r.quitDate, asOfMonthKey)).length
    : kpiData.leaversThisMonth;
  const currentLeaveOfAbsence = kpiData.leaveOfAbsenceCount;

  const prevMonthTotal = hasRecords ? headcountAsOf(monthEnd(prevMonthKey)) : kpiData.totalEmployees - (kpiData.prevMonthDiff?.total ?? 0);
  const prevMonthLeavers = hasRecords
    ? employeeRecords.filter((r) => inMonth(r.quitDate, prevMonthKey)).length
    : 0;
  const prevMonthHires = hasRecords
    ? employeeRecords.filter((r) => inMonth(r.hireDate, prevMonthKey)).length
    : 0;

  /* 도넛 라벨을 실제 데이터에서 뽑는다 (하드코딩 제거) */
  const rd = (arr: { name: string; value: number; percentage?: number }[], name: string) =>
    arr.find((x) => x.name === name);
  const rdV = (arr: { name: string; value: number; percentage?: number }[], name: string) =>
    rd(arr, name)?.value ?? 0;
  const rdP = (arr: { name: string; value: number; percentage?: number }[], name: string) =>
    rd(arr, name)?.percentage ?? 0;
  const rdTop = (arr: { name: string; value: number; percentage?: number }[]) =>
    arr.reduce((a, b) => (b.value > (a?.value ?? -1) ? b : a), arr[0]);

  /* 근속·퇴사율 지표를 실제 데이터에서 계산 */
  const sortedTenure = [...tenureByDepartment].sort((a, b) => b.avgYears - a.avgYears);
  const tenureRows = sortedTenure.slice(0, 3);
  const minTenure = sortedTenure.length ? sortedTenure[sortedTenure.length - 1].avgYears : 0;
  const overallTenure = tenureByDepartment.length
    ? tenureByDepartment.reduce((sum, t) => sum + t.avgYears, 0) / tenureByDepartment.length
    : 0;
  const yearHires = monthlyData.reduce((sum, m) => sum + (m.currentYearHires || 0), 0);
  const yearLeavers = monthlyData.reduce((sum, m) => sum + (m.currentYearLeavers || 0), 0);
  // 기준일 연도 기준 누적 (엑셀 레코드가 있을 때)
  const yearHiresAsOf = hasRecords
    ? employeeRecords.filter((r) => r.hireDate && r.hireDate.slice(0, 4) === String(asOfYear)).length
    : yearHires;
  const yearLeaversAsOf = hasRecords
    ? employeeRecords.filter((r) => r.quitDate && r.quitDate.slice(0, 4) === String(asOfYear)).length
    : yearLeavers;
  // 퇴사율 명세: 분모 = (연초 재직자 + 연말/기준일 재직자)/2, 조기 = 당해 퇴사자 중 근속 365일 미만 비중
  const turnover = buildTurnoverRates(employeeRecords, asOfDate);
  const diffTotal = hasRecords ? currentTotal - prevMonthTotal : (kpiData.prevMonthDiff?.total ?? 0);
  const diffPct = prevMonthTotal > 0 ? (diffTotal / prevMonthTotal) * 100 : 0;
  const diffLeavers = hasRecords ? currentLeavers - prevMonthLeavers : (kpiData.prevMonthDiff?.leavers ?? 0);
  const diffHires = hasRecords ? currentNewHires - prevMonthHires : (kpiData.prevMonthDiff?.newHires ?? 0);

  const filteredMatrix = matrixRows.map((r) => {
    // If scaled
    return r;
  }).filter((r) => {
    if (tableFilter === '전체') return true;
    return r.corporation === tableFilter;
  });

  const matrixTotals = filteredMatrix.reduce(
    (acc, cur) => {
      acc.male += cur.maleCount;
      acc.female += cur.femaleCount;
      acc.domestic += cur.domesticCount;
      acc.foreign += cur.foreignCount;
      acc.leave += cur.leaveCount;
      acc.total += cur.totalCount;
      return acc;
    },
    { male: 0, female: 0, domestic: 0, foreign: 0, leave: 0, total: 0 }
  );

  // 막대 길이는 최대값 기준으로 정규화한다(총원 하드코딩 스케일이던 240/200 대체).
  // 부서 집계 단위가 본부→부서(팀)로 바뀌어 항목당 인원이 작아지면 고정 분모로는 막대가 보이지 않는다.
  const barPct = (count: number, max: number) => (max > 0 ? Math.max((count / max) * 100, 2) : 0);
  const maxPositionCount = Math.max(1, ...positionDistributionData.map((p) => p.count));
  const maxDepartmentCount = Math.max(1, ...departmentDistributionData.map((d) => d.count));

  // Mini calendar generator for the currently viewed year/month
  const daysInAugust = calendarDays;
  const emptyDays = calendarEmptySlots;

  // Events within the currently viewed year/month
  const monthEvents = calendarEvents.filter((ev) => {
    const [y, m] = ev.date.split('-').map(Number);
    return y === calendarYear && m === calendarMonth;
  });
  const eventDaysInMonth = new Set(monthEvents.map((ev) => Number(ev.date.split('-')[2])));

  // Events on selected day
  const eventsForSelectedDay = calendarEvents.filter((ev) => {
    const dayStr = String(selectedDay).padStart(2, '0');
    return ev.date === `${calendarYear}-${String(calendarMonth).padStart(2, '0')}-${dayStr}`;
  });

  const getCategoryBadgeClass = (cat: string) => {
    switch (cat) {
      case '전사HR':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case '입/퇴사자':
      case '입사자':
      case '퇴사자':
      case '입사':
      case '퇴사':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case '수습평가':
      case '수습평가기간':
      case '1차 수습평가일':
      case '최종 수습평가일':
      case '1차수습평가':
      case '최종수습평가':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case '평가':
      case '기타 평가기간':
      case '역량평가':
      case '성과평가':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case '교육':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case '급여':
        return 'bg-cyan-50 text-cyan-700 border-cyan-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const formatEventDate = (dateStr: string) => {
    const [, m, d] = dateStr.split('-').map(Number);
    return `${m}월 ${d}일`;
  };

  const buildCategoryItems = (categories: string[]) =>
    monthEvents
      .filter((ev) => categories.includes(ev.category))
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((ev) => ({ date: formatEventDate(ev.date), title: ev.title }));

  const hrEventCategories = [
    {
      category: '전사HR',
      subTitle: '행사, 공식회의일정',
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
      dotColor: 'bg-blue-600',
      items: buildCategoryItems(['전사HR']),
    },
    {
      category: '입/퇴사자',
      subTitle: '입사 및 퇴직 인수인계',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      dotColor: 'bg-emerald-600',
      items: buildCategoryItems(['입/퇴사자', '입사자', '퇴사자', '입사', '퇴사']),
    },
    {
      category: '수습평가',
      subTitle: '1차/최종 수습평가',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
      dotColor: 'bg-amber-600',
      items: buildCategoryItems([
        '수습평가',
        '1차 수습평가',
        '최종 수습평가',
        '1차 수습평가일',
        '최종 수습평가일',
        '1차수습평가',
        '최종수습평가',
      ]),
    },
    {
      category: '평가',
      subTitle: '역량평가, 성과평가',
      badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
      dotColor: 'bg-purple-600',
      items: buildCategoryItems(['평가', '기타 평가기간', '역량평가', '성과평가']),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Executive Welcome & Mode Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-slate-800 flex items-center">
          STEK 인력 현황 종합
        </h2>

        <div className="flex items-center gap-2.5">
          {/* Interactive Date Filter Button with Calendar Popover */}
          <div className="relative" ref={calendarRef}>
            <button
              type="button"
              id="btn-date-filter-trigger"
              onClick={() => setIsCalendarOpen(!isCalendarOpen)}
              className={`px-3.5 py-1.5 bg-white border rounded-lg text-xs font-semibold shadow-xs transition-all flex items-center gap-2 cursor-pointer ${
                isCalendarOpen
                  ? 'border-blue-500 ring-2 ring-blue-500/20 text-blue-700 bg-blue-50/40'
                  : 'border-slate-300 hover:border-blue-400 text-slate-700 hover:bg-slate-50'
              }`}
              title="클릭하여 기준 일자 달력 열기"
            >
              <CalendarIcon className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="text-xs font-bold text-slate-900">
                {asOfYear}년 {String(asOfMonth).padStart(2, '0')}월 {String(asOfDay).padStart(2, '0')}일
              </span>
              <span className="text-xs font-semibold text-slate-500">기준</span>
            </button>

            {/* Interactive Calendar Dropdown Modal */}
            {isCalendarOpen && (
              <div className="absolute right-0 top-full mt-2 z-50 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-4 animate-in fade-in zoom-in-95 duration-150">
                {/* Calendar Top Controls */}
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                  <span className="text-sm font-bold text-slate-800">
                    {calendarYear}년 {calendarMonth}월
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handlePrevMonth}
                      className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                      title="이전 달"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleNextMonth}
                      className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                      title="다음 달"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Days of Week Header */}
                <div className="grid grid-cols-7 gap-1 text-center mb-1 text-[11px] font-semibold text-slate-400">
                  <span className="text-rose-500">일</span>
                  <span>월</span>
                  <span>화</span>
                  <span>수</span>
                  <span>목</span>
                  <span>금</span>
                  <span className="text-blue-500">토</span>
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-7 gap-1 text-center">
                  {calendarEmptySlots.map((_, idx) => (
                    <div key={`empty-${idx}`} className="h-7.5" />
                  ))}
                  {calendarDays.map((d) => {
                    const isSelected =
                      asOfYear === calendarYear &&
                      asOfMonth === calendarMonth &&
                      asOfDay === d;
                    const dayOfWeek = (monthFirstDayOfWeek + d - 1) % 7;
                    const isSunday = dayOfWeek === 0;
                    const isSaturday = dayOfWeek === 6;

                    return (
                      <button
                        key={`cal-day-${d}`}
                        type="button"
                        onClick={() => handleSelectDate(d)}
                        className={`h-7.5 w-full rounded-md text-xs font-semibold transition-all flex items-center justify-center cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600 text-white font-bold shadow-xs scale-105'
                            : isSunday
                            ? 'text-rose-600 hover:bg-rose-50'
                            : isSaturday
                            ? 'text-blue-600 hover:bg-blue-50'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>

                {/* Quick Actions Footer */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      setCalendarYear(today.getFullYear());
                      setCalendarMonth(today.getMonth() + 1);
                      handleSelectDate(today.getDate());
                    }}
                    className="text-blue-600 hover:text-blue-700 font-bold cursor-pointer"
                  >
                    오늘 ({today.getFullYear()}.{String(today.getMonth() + 1).padStart(2, '0')}.{String(today.getDate()).padStart(2, '0')})
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCalendarOpen(false)}
                    className="text-slate-500 hover:text-slate-700 font-medium cursor-pointer"
                  >
                    닫기
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* New HR Schedule Button */}
          <button
            type="button"
            id="btn-quick-add-schedule"
            onClick={onOpenAddSchedule}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>신규 HR 일정 등록</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Left ~72% / Right ~28% */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: 72% (approx 8.5 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Row 1: 4 Sleek KPI Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Card 1: Total Employees */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <p className="text-slate-500 text-xs mb-1 font-medium">총 재직 인원</p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-slate-900">{currentTotal}</span>
                <span className="text-xs text-slate-500 font-medium">명</span>
              </div>
              <div className="mt-2 flex items-center text-[10px] text-blue-600 font-bold">
                <span>{diffTotal >= 0 ? '▲' : '▼'} {Math.abs(diffPct).toFixed(1)}%</span>
                <span className="text-slate-400 font-normal ml-1">
                  전월비 ({diffTotal >= 0 ? '+' : ''}{diffTotal}명)
                </span>
              </div>
            </div>

            {/* Card 2: New Hires */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <p className="text-slate-500 text-xs mb-1 font-medium">{asOfMonth}월 입사자</p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-blue-600">{currentNewHires}</span>
                <span className="text-xs text-slate-500 font-medium">명</span>
              </div>
              <div className="mt-2 flex items-center text-[10px] text-slate-400 font-normal">
                전월 {diffHires >= 0 ? '대비 +' : '대비 '}
                {diffHires}명 | {asOfYear}년 누적 {yearHiresAsOf}명
              </div>
            </div>

            {/* Card 3: Leavers */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <p className="text-slate-500 text-xs mb-1 font-medium">{asOfMonth}월 퇴사자</p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-rose-500">{currentLeavers}</span>
                <span className="text-xs text-slate-500 font-medium">명</span>
              </div>
              <div className="mt-2 flex items-center text-[10px] text-rose-500 font-bold">
                <span>{diffLeavers > 0 ? '▲' : diffLeavers < 0 ? '▼' : '−'} {Math.abs(diffLeavers)}명</span>
                <span className="text-slate-400 font-normal ml-1">
                  전월비 · {asOfYear}년 누적 {yearLeaversAsOf}명
                </span>
              </div>
            </div>

            {/* Card 4: Leave of Absence */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <p className="text-slate-500 text-xs mb-1 font-medium">휴직자 현황</p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-slate-900">{currentLeaveOfAbsence}</span>
                <span className="text-xs text-slate-500 font-medium">명</span>
              </div>
              <div className="mt-2 flex items-center text-[10px] text-slate-400 font-normal">
                실시간 휴직 현황
              </div>
            </div>
          </div>

          {/* 핵심 지표 요약 (수기 입력 + 증감 자동계산 + 특이사항 이슈) */}
          <KeyMetricsSummary period={asOfDate.slice(0, 7)} />

          {/* 채용 대시보드 (본부/팀별 채용 현황 + 특이사항 이슈) */}
          <RecruitmentDashboard period={asOfDate.slice(0, 7)} />

          {/* Row 2: Demographic Composition (Line 1: Donut Charts / Line 2: Horizontal Bar Charts) */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-5">
            {/* Line 1: Donut Charts */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-3.5 bg-blue-600 rounded-full"></span>
                  <h4 className="text-xs font-bold text-slate-800">비율별 분포</h4>
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold">
                  {asOfYear}.{String(asOfMonth).padStart(2, '0')}.{String(asOfDay).padStart(2, '0')} 기준 전사 {currentTotal}명
                </span>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* Donut 1: Gender Ratio */}
                <div className="bg-slate-50/80 p-3.5 rounded-lg border border-slate-200/80 text-center flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-800">성별 비율</span>
                    <span className="text-[10px] text-slate-400 font-medium">총 {kpiData.totalEmployees}명</span>
                  </div>
                  <div className="h-28 my-1 relative flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie isAnimationActive={false}
                          data={genderRatioData}
                          dataKey="value"
                          innerRadius={28}
                          outerRadius={42}
                          paddingAngle={3}
                        >
                          {genderRatioData.map((entry, index) => (
                            <Cell key={`cell-g-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: any, name: any) => {
                          const percent = genderRatioData.find(g => g.name === name)?.percentage || 0;
                          return [`${value}명 (${percent}%)`, name];
                        }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-xs font-bold text-slate-800">{rdTop(genderRatioData)?.percentage ?? 0}%</span>
                      <span className="text-[9px] text-slate-400 font-medium">{rdTop(genderRatioData)?.name ?? '-'}</span>
                    </div>
                  </div>
                  <div className="flex justify-center items-center gap-2 text-[11px] font-medium pt-1 border-t border-slate-200/60">
                    <span className="text-blue-600 font-bold">남성 {rdP(genderRatioData, '남성')}% ({rdV(genderRatioData, '남성')}명)</span>
                    <span className="text-slate-300">|</span>
                    <span className="text-pink-600 font-bold">여성 {rdP(genderRatioData, '여성')}% ({rdV(genderRatioData, '여성')}명)</span>
                  </div>
                </div>

                {/* Donut 2: Nationality Ratio */}
                <div className="bg-slate-50/80 p-3.5 rounded-lg border border-slate-200/80 text-center flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-800">내/외국인 비율</span>
                    <span className="text-[10px] text-slate-400 font-medium">외국인 {rdV(nationalityRatioData, '외국인')}명</span>
                  </div>
                  <div className="h-28 my-1 relative flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie isAnimationActive={false}
                          data={nationalityRatioData}
                          dataKey="value"
                          innerRadius={28}
                          outerRadius={42}
                          paddingAngle={3}
                        >
                          {nationalityRatioData.map((entry, index) => (
                            <Cell key={`cell-n-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: any, name: any) => {
                          const percent = nationalityRatioData.find(n => n.name === name)?.percentage || 0;
                          return [`${value}명 (${percent}%)`, name];
                        }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-xs font-bold text-slate-800">{rdP(nationalityRatioData, '내국인')}%</span>
                      <span className="text-[9px] text-slate-400 font-medium">내국인</span>
                    </div>
                  </div>
                  <div className="flex justify-center items-center gap-2 text-[11px] font-medium pt-1 border-t border-slate-200/60">
                    <span className="text-sky-700 font-bold">내국인 {rdP(nationalityRatioData, '내국인')}% ({rdV(nationalityRatioData, '내국인')}명)</span>
                    <span className="text-slate-300">|</span>
                    <span className="text-amber-600 font-bold">외국인 {rdP(nationalityRatioData, '외국인')}% ({rdV(nationalityRatioData, '외국인')}명)</span>
                  </div>
                </div>

                {/* Donut 3: Job Role (Office vs Production) */}
                <div className="bg-slate-50/80 p-3.5 rounded-lg border border-slate-200/80 text-center flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-800">직군별 비율</span>
                    <span className="text-[10px] text-slate-400 font-medium">사무/현장</span>
                  </div>
                  <div className="h-28 my-1 relative flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie isAnimationActive={false}
                          data={jobTypeRatioData}
                          dataKey="value"
                          innerRadius={28}
                          outerRadius={42}
                          paddingAngle={3}
                        >
                          {jobTypeRatioData.map((entry, index) => (
                            <Cell key={`cell-j-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: any, name: any) => {
                          const percent = jobTypeRatioData.find(j => j.name === name)?.percentage || 0;
                          return [`${value}명 (${percent}%)`, name];
                        }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-xs font-bold text-slate-800">{rdP(jobTypeRatioData, '사무직')}%</span>
                      <span className="text-[9px] text-slate-400 font-medium">사무직</span>
                    </div>
                  </div>
                  <div className="flex justify-center items-center gap-2 text-[11px] font-medium pt-1 border-t border-slate-200/60">
                    <span className="text-indigo-600 font-bold">사무직 {rdP(jobTypeRatioData, '사무직')}% ({rdV(jobTypeRatioData, '사무직')}명)</span>
                    <span className="text-slate-300">|</span>
                    <span className="text-emerald-600 font-bold">현장직 {rdP(jobTypeRatioData, '현장직')}% ({rdV(jobTypeRatioData, '현장직')}명)</span>
                  </div>
                </div>

                {/* Donut 4: Age Group */}
                <div className="bg-slate-50/80 p-3.5 rounded-lg border border-slate-200/80 text-center flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-800">연령별 비율</span>
                    <span className="text-[10px] text-slate-400 font-medium">4개 구간</span>
                  </div>
                  <div className="h-28 my-1 relative flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie isAnimationActive={false}
                          data={ageRatioData}
                          dataKey="value"
                          innerRadius={28}
                          outerRadius={42}
                          paddingAngle={3}
                        >
                          {ageRatioData.map((entry, index) => (
                            <Cell key={`cell-a-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: any, name: any) => {
                          const percent = ageRatioData.find(a => a.name === name)?.percentage || 0;
                          return [`${value}명 (${percent}%)`, name];
                        }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-xs font-bold text-slate-800">{rdTop(ageRatioData)?.percentage ?? 0}%</span>
                      <span className="text-[9px] text-slate-400 font-medium">{rdTop(ageRatioData)?.name ?? '-'}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-1 gap-y-0.5 text-[10px] font-medium pt-1 border-t border-slate-200/60 text-slate-700">
                    <span className="text-cyan-700 font-bold">20대 이하: {rdP(ageRatioData, '20대 이하')}%</span>
                    <span className="text-blue-600 font-bold">30대: {rdP(ageRatioData, '30대')}%</span>
                    <span className="text-purple-600 font-bold">40대: {rdP(ageRatioData, '40대')}%</span>
                    <span className="text-slate-600 font-bold">50대+: {rdP(ageRatioData, '50대 이상')}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Line 2: Horizontal Bar Charts */}
            <div className="pt-2">
              <div className="flex items-center gap-1.5 mb-2.5">
                <span className="w-1.5 h-3.5 bg-indigo-600 rounded-full"></span>
                <h4 className="text-xs font-bold text-slate-800">인원 분포 현황</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Horizontal Bar Chart 1: Position Distribution */}
                <div className="bg-slate-50/80 p-4 rounded-lg border border-slate-200/80">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-800">
                      직급별 인원 분포
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">총 {kpiData.totalEmployees}명</span>
                  </div>
                  <div className="space-y-2.5 text-xs">
                    {positionDistributionData.map((pos) => (
                      <div key={pos.name} className="space-y-1">
                        <div className="flex justify-between items-center text-slate-700 text-[11px]">
                          <span className="font-semibold text-slate-800">{pos.name}</span>
                          <span className="font-bold text-slate-900">
                            {pos.count}명{' '}
                            <span className="text-slate-400 font-normal ml-0.5">({pos.percentage}%)</span>
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${barPct(pos.count, maxPositionCount)}%`,
                              backgroundColor: pos.color,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Horizontal Bar Chart 2: Department Distribution */}
                <div className="bg-slate-50/80 p-4 rounded-lg border border-slate-200/80">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-800">
                      부서별 인원 분포
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">{departmentDistributionData.length}개 부서</span>
                  </div>
                  <div className="space-y-2 text-xs max-h-72 overflow-y-auto pr-1">
                    {departmentDistributionData.map((dept) => (
                      <div key={dept.name} className="space-y-1">
                        <div className="flex justify-between items-center text-slate-700 text-[11px]">
                          <span className="font-semibold text-slate-800">{dept.name}</span>
                          <span className="font-bold text-slate-900">
                            {dept.count}명{' '}
                            <span className="text-slate-400 font-normal ml-0.5">({dept.percentage}%)</span>
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                          <div
                            className="bg-blue-600 h-full rounded-full transition-all duration-500"
                            style={{ width: `${barPct(dept.count, maxDepartmentCount)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Row 3: Hires/Leavers Trend & Tenure & Turnover Indicators */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* 1-Year Mixed Chart */}
            <div className="md:col-span-8 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    최근 1년 월별 입·퇴사자 추이 (당해년도 vs 전년도)
                  </h3>
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold">
                  인터랙티브 차트
                </span>
              </div>

              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={monthlyData}
                    onClick={(e: any) => {
                      if (e && e.activePayload && e.activePayload.length > 0) {
                        onSelectMonthModal(e.activePayload[0].payload);
                      }
                    }}
                    className="cursor-pointer"
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(val: any, name: string) => [`${val}명`, name]}
                      labelFormatter={(label) => `${label} 인사 변동 (클릭 시 상세조회)`}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar isAnimationActive={false}
                      dataKey="currentYearHires"
                      name="당해 입사자"
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar isAnimationActive={false}
                      dataKey="currentYearLeavers"
                      name="당해 퇴사자"
                      fill="#f43f5e"
                      radius={[4, 4, 0, 0]}
                    />
                    <Line isAnimationActive={false}
                      type="monotone"
                      dataKey="prevYearHires"
                      name="전년 입사자"
                      stroke="#94a3b8"
                      strokeDasharray="4 4"
                      strokeWidth={2}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Tenure & Turnover KPI Cards */}
            <div className="md:col-span-4 space-y-3">
              {/* Average Tenure */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between text-slate-600 mb-1.5">
                  <span className="text-xs font-bold text-slate-700">전체 평균 근속연수</span>
                  <Clock className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex items-baseline space-x-2">
                  <span className="text-2xl font-black text-slate-900">{overallTenure.toFixed(1)}년</span>
                  <span className="text-xs text-emerald-600 font-bold">본부 {tenureByDepartment.length}개 평균</span>
                </div>

                <div className="mt-2.5 space-y-1 text-[11px] text-slate-600 border-t border-slate-100 pt-2">
                  {tenureRows.map((t, i) => (
                    <div key={t.department} className="flex justify-between">
                      <span>{t.department}:</span>
                      <span
                        className={
                          t.avgYears === minTenure && sortedTenure.length > 1
                            ? 'font-bold text-rose-600'
                            : 'font-bold text-slate-800'
                        }
                      >
                        {t.avgYears.toFixed(1)}년
                        {t.avgYears === minTenure && sortedTenure.length > 1 ? ' (최저)' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Turnover Rates */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
                <span className="text-xs font-bold text-slate-700 block">핵심 퇴사율 지표</span>
                <div className="grid grid-cols-2 gap-2 text-center pt-1">
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex flex-col items-center justify-center">
                    <span className="text-[10px] text-slate-500 block">연간 누적 퇴사율</span>
                    <span className="text-lg font-black text-slate-900 mt-0.5">{turnover.annualRate.toFixed(1)}%</span>
                  </div>
                  <div className="bg-amber-50/60 p-2.5 rounded-lg border border-amber-200 flex flex-col items-center justify-center">
                    <span className="text-[10px] text-amber-800 block">1년내 조기 퇴사율</span>
                    <span className="text-lg font-black text-amber-700 mt-0.5">{turnover.earlyRate.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Row 4: Detailed Consolidated Matrix Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <span className="text-sm font-bold text-slate-700">인원 집계 현황표</span>
                <span className="text-[10px] text-slate-400 ml-2">단위: 명</span>
              </div>

              <div className="flex items-center space-x-1 bg-white border border-slate-200 p-0.5 rounded-lg text-xs">
                {(['전체', ...corpNames]).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setTableFilter(filter)}
                    className={`px-2.5 py-1 rounded-md font-medium text-xs transition-colors ${
                      tableFilter === filter
                        ? 'bg-blue-600 text-white font-bold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {filter === '전체' ? '전사 통합' : `${filter} 법인`}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto max-h-72">
              <table className="w-full text-sm text-left">
                <thead className="bg-white text-slate-500 text-[11px] sticky top-0 uppercase border-b border-slate-100">
                  <tr>
                    <th className="px-5 py-3 font-semibold">법인명</th>
                    <th className="px-5 py-3 font-semibold">근무지</th>
                    <th className="px-5 py-3 font-semibold text-center text-blue-600">합계</th>
                    <th className="px-5 py-3 font-semibold text-center text-rose-500">휴직</th>
                    <th className="px-5 py-3 font-semibold text-center">남</th>
                    <th className="px-5 py-3 font-semibold text-center">여</th>
                    <th className="px-5 py-3 font-semibold text-center">내국인</th>
                    <th className="px-5 py-3 font-semibold text-center">외국인</th>
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-slate-50">
                  {filteredMatrix.map((row) => (
                    <tr key={row.id} className="border-b border-slate-50 hover:bg-blue-50/30 transition-colors">
                      <td className="px-5 py-3 font-bold text-slate-900">
                        {row.corporation}
                      </td>
                      <td className="px-5 py-3 text-slate-500 font-medium">{row.location}</td>
                      <td className="px-5 py-3 text-center font-bold text-blue-600">
                        {row.totalCount}
                      </td>
                      <td className="px-5 py-3 text-center text-rose-500 font-medium">
                        {row.leaveCount}
                      </td>
                      <td className="px-5 py-3 text-center">{row.maleCount}</td>
                      <td className="px-5 py-3 text-center">{row.femaleCount}</td>
                      <td className="px-5 py-3 text-center">{row.domesticCount}</td>
                      <td className="px-5 py-3 text-center text-amber-700 font-medium">
                        {row.foreignCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 font-bold text-slate-800 border-t border-slate-200">
                  <tr>
                    <td colSpan={2} className="px-5 py-3 text-center font-bold">
                      통합 집계 총계
                    </td>
                    <td className="px-5 py-3 text-center text-blue-600 font-black text-sm">
                      {matrixTotals.total}
                    </td>
                    <td className="px-5 py-3 text-center text-rose-500">{matrixTotals.leave}</td>
                    <td className="px-5 py-3 text-center">{matrixTotals.male}</td>
                    <td className="px-5 py-3 text-center">{matrixTotals.female}</td>
                    <td className="px-5 py-3 text-center">{matrixTotals.domestic}</td>
                    <td className="px-5 py-3 text-center text-amber-700">{matrixTotals.foreign}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {/* Right Side: 28% Sleek HR Calendar & Aside */}
        <aside className="lg:col-span-4 space-y-5 flex flex-col">
          {/* Mini Calendar Card (Without Today's Highlights) */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-sm font-bold text-slate-800 flex items-center justify-between w-full">
                <span>HR 캘린더</span>
                <span className="text-[11px] text-blue-600 font-bold">{calendarYear}년 {calendarMonth}월</span>
              </h3>
            </div>

            {/* Calendar Grid */}
            <div className="bg-slate-50/70 p-3 rounded-lg border border-slate-200/80">
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 mb-2">
                <span className="text-rose-500">일</span>
                <span>월</span>
                <span>화</span>
                <span>수</span>
                <span>목</span>
                <span>금</span>
                <span className="text-blue-500">토</span>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center text-[11px]">
                {emptyDays.map((_, idx) => (
                  <span key={`empty-${idx}`} className="p-1 text-slate-300">
                    -
                  </span>
                ))}
                {daysInAugust.map((day) => {
                  const hasEvents = eventDaysInMonth.has(day);
                  const isSelected = selectedDay === day;
                  const isToday =
                    calendarYear === today.getFullYear() &&
                    calendarMonth === today.getMonth() + 1 &&
                    day === today.getDate();

                  return (
                    <button
                      key={`day-${day}`}
                      type="button"
                      onClick={() => {
                        setSelectedDay(day);
                        const dayStr = String(day).padStart(2, '0');
                        setAsOfDate(`${calendarYear}-${String(calendarMonth).padStart(2, '0')}-${dayStr}`);
                      }}
                      className={`p-1.5 rounded-lg text-[11px] transition-all relative flex items-center justify-center cursor-pointer ${
                        isSelected
                          ? 'bg-blue-600 text-white font-bold shadow-xs'
                          : isToday
                          ? 'text-blue-600 font-bold bg-blue-50 border border-blue-200'
                          : hasEvents
                          ? 'text-slate-900 font-semibold bg-slate-100/80 hover:bg-slate-200'
                          : 'text-slate-600 hover:bg-slate-200/60'
                      }`}
                    >
                      <span>{day}</span>
                      {hasEvents && (
                        <span
                          className={`w-1 h-1 rounded-full absolute bottom-0.5 ${
                            isSelected ? 'bg-white' : 'bg-blue-600'
                          }`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Month's Categorized HR Events List */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3.5 flex-1">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-sm font-bold text-slate-800">{calendarMonth}월 주요 HR 일정</h3>
              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                총 {hrEventCategories.reduce((acc, c) => acc + c.items.length, 0)}건
              </span>
            </div>

            <div className="space-y-3">
              {hrEventCategories.map((group) => (
                <div
                  key={group.category}
                  className="p-2.5 rounded-lg bg-slate-50/70 border border-slate-200/80 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border ${group.badgeClass}`}
                    >
                      {group.category}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {group.items.length}건
                    </span>
                  </div>
                  <div className="space-y-1 pt-0.5">
                    {group.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs py-1 px-2 rounded bg-white border border-slate-100 text-slate-800"
                      >
                        <span className="font-semibold truncate text-[11px]">
                          {item.title}
                        </span>
                        <span className="text-[10px] font-mono font-bold text-slate-500 shrink-0 ml-2">
                          {item.date}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
