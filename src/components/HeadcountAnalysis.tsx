import React, { useState } from 'react';
import {
  HeadcountSubTab,
  MonthlyHireLeaverData,
  LeavePersonItem,
  RatioData,
} from '../types';
// TODO(redesign): DB 데이터로 교체 예정
const tenureByDepartment: { department: string; avgYears: number; earlyTurnoverRate: number }[] = [];
const salesCohortTurnoverData: { period: string; turnoverRate: number; mainReason: string }[] = [];
const jobTypeRatioData: RatioData[] = [];
const genderRatioData: RatioData[] = [];
const nationalityRatioData: RatioData[] = [];
const ageRatioData: RatioData[] = [];
const fieldWorkDrilldown: {
  total: number;
  categories: {
    id: string;
    name: string;
    totalCount: number;
    teams: { teamName: string; count: number; leader: string; shift: string }[];
    recentTrend: string;
  }[];
} = { total: 0, categories: [] };
const employmentBreakdown = { regular: 0, contract: 0, leave: 0 };
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Line,
  ComposedChart,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Users,
  TrendingUp,
  PieChart as PieIcon,
  Clock,
  AlertTriangle,
  Factory,
  Truck,
  Briefcase,
  ChevronRight,
  UserCheck,
  Calendar,
  Phone,
  FileText,
  CheckCircle,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';

interface HeadcountAnalysisProps {
  totalEmployees: number;
  monthlyData: MonthlyHireLeaverData[];
  leavePersons: LeavePersonItem[];
  onOpenDrilldown: (cat: string) => void;
  onOpenMonthModal: (m: MonthlyHireLeaverData) => void;
  onUpdateLeaveStatus: (id: string, newStatus: LeavePersonItem['status']) => void;
}

export const HeadcountAnalysis: React.FC<HeadcountAnalysisProps> = ({
  totalEmployees,
  monthlyData,
  leavePersons,
  onOpenDrilldown,
  onOpenMonthModal,
  onUpdateLeaveStatus,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<HeadcountSubTab>('상세분석');
  const [leaveFilter, setLeaveFilter] = useState<string>('전체');
  const [selectedFieldCat, setSelectedFieldCat] = useState<'prod' | 'logistics'>('prod');

  const filteredLeavePersons = leavePersons.filter((p) => {
    if (leaveFilter === '전체') return true;
    return p.reason === leaveFilter;
  });

  const currentYear = new Date().getFullYear();
  const prevYear = currentYear - 1;
  const totalNetChange = monthlyData.reduce((sum, m) => sum + m.netChange, 0);

  const avgTenureAll = tenureByDepartment.length
    ? (
        tenureByDepartment.reduce((sum, t) => sum + t.avgYears, 0) / tenureByDepartment.length
      ).toFixed(1)
    : '0.0';
  const tenureSortedDesc = [...tenureByDepartment].sort((a, b) => b.avgYears - a.avgYears);
  const tenureTop2 = tenureSortedDesc.slice(0, 2);
  const tenureBottom = tenureSortedDesc[tenureSortedDesc.length - 1];

  const officeRatio = jobTypeRatioData.find((d) => d.name === '사무직');
  const fieldRatio = jobTypeRatioData.find((d) => d.name === '현장직');
  const prodCat = fieldWorkDrilldown.categories.find((c) => c.id === 'prod');
  const logisticsCat = fieldWorkDrilldown.categories.find((c) => c.id === 'logistics');
  const activeFieldCat = fieldWorkDrilldown.categories.find((c) => c.id === selectedFieldCat);

  return (
    <div className="space-y-6">
      {/* Top Header with Total Headcount & 4 Toggle Sub-Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-black text-slate-900">
                  인력 현황 정밀 분석
                </h1>
              </div>
              <p className="text-xs text-slate-500">
                전사 총 재직 인원수:{' '}
                <strong className="text-blue-600 text-sm font-black">
                  {totalEmployees}명
                </strong>{' '}
                (정규직 {employmentBreakdown.regular}명 / 계약직·인턴{' '}
                {employmentBreakdown.contract}명 / 휴직 {employmentBreakdown.leave}명 별도)
              </p>
            </div>
          </div>

          {/* 4 Toggle Buttons */}
          <div className="flex items-center space-x-1.5 bg-slate-100 p-1.5 rounded-xl text-xs font-bold">
            {(['상세분석', '입퇴사', '인력구성비', '휴직'] as HeadcountSubTab[]).map(
              (tab) => {
                const isActive = activeSubTab === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    id={`headcount-tab-${tab}`}
                    onClick={() => setActiveSubTab(tab)}
                    className={`px-3.5 py-2 rounded-lg transition-all ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                  >
                    {tab === '상세분석' && '1. 상세분석 (인구통계/근속)'}
                    {tab === '입퇴사' && '2. 입·퇴사 추이 (Peak분석)'}
                    {tab === '인력구성비' && '3. 인력 구성비 (현장직 드릴다운)'}
                    {tab === '휴직' && '4. 휴직자 현황 및 복직관리'}
                  </button>
                );
              }
            )}
          </div>
        </div>

        {/* Dynamic sub-tab description */}
        <div className="pt-3 text-xs text-slate-500 flex items-center justify-between">
          <span>
            {activeSubTab === '상세분석' && '부서별 평균 근속연수 및 영업직 등 특정 직군의 조기 퇴사 전환율 패턴을 정밀 분석합니다.'}
            {activeSubTab === '입퇴사' && '전년도 대비 당해년도 월별 채용 및 퇴사 변동 추이와 특정 월의 피크타임 요인을 대조합니다.'}
            {activeSubTab === '인력구성비' && '사무직과 현장직의 구성을 비교하고, 현장직 클릭 시 생산직·물류직 세부 조직으로 드릴다운합니다.'}
            {activeSubTab === '휴직' && '육아·질병 등 사유별 휴직 대상자 및 복직 D-Day, 대체인력 배치 현황을 관리합니다.'}
          </span>
          <span className="text-slate-400 font-mono text-[11px]">모듈 코드: HR-STAT-2026</span>
        </div>
      </div>

      {/* SUB-VIEW 1: 상세분석 (인구통계 / 근속 / 영업직 퇴사율) */}
      {activeSubTab === '상세분석' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Department Tenure Chart */}
            <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    부서별 평균 근속 기간 및 조기 퇴사율
                  </h3>
                  <p className="text-xs text-slate-500">
                    조직별 근속 안정성과 1년 이내 이탈 위험도를 교차 분석합니다.
                  </p>
                </div>
                <span className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded font-semibold">
                  전체 평균 {avgTenureAll}년
                </span>
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tenureByDepartment} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="department" type="category" tick={{ fontSize: 11 }} width={90} />
                    <Tooltip
                      formatter={(val: any, name: string) => [
                        name === 'avgYears' ? `${val}년` : `${val}%`,
                        name === 'avgYears' ? '평균 근속' : '조기 퇴사율',
                      ]}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar isAnimationActive={false}
                      dataKey="avgYears"
                      name="평균 근속연수 (년)"
                      fill="#3b82f6"
                      radius={[0, 4, 4, 0]}
                    />
                    <Bar isAnimationActive={false}
                      dataKey="earlyTurnoverRate"
                      name="1년내 조기퇴사율 (%)"
                      fill="#f43f5e"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1">
                <p className="font-bold text-slate-900 flex items-center space-x-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>인사 진단 인사이트:</span>
                </p>
                {tenureTop2.length >= 2 && (
                  <p>
                    • <strong>{tenureTop2[0].department}({tenureTop2[0].avgYears}년)</strong>와{' '}
                    <strong>{tenureTop2[1].department}({tenureTop2[1].avgYears}년)</strong>는 장기 근속 문화가 안정적으로 정착되어 있습니다.
                  </p>
                )}
                {tenureByDepartment.length >= 2 && (
                  <p>
                    • 반면 <strong>{tenureBottom.department}({tenureBottom.avgYears}년)</strong>는 타 부서 대비 근속 기간이{' '}
                    {tenureBottom.earlyTurnoverRate > 0 ? (
                      <>짧고 조기 퇴사율이 <strong>{tenureBottom.earlyTurnoverRate}%</strong>로 높아 집중 관리가 요구됩니다.</>
                    ) : (
                      '짧아 집중 관리가 요구됩니다.'
                    )}
                  </p>
                )}
              </div>
            </div>

            {/* Sales Turnover Deep-Dive Cohort */}
            <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-1.5">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">
                    샘플 데이터
                  </span>
                  <h3 className="text-sm font-bold text-slate-900">
                    영업직 조기 퇴사 전환율 및 근속 패턴
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  입사 시점별 이탈 코호트 분석 및 주요 원인
                </p>
              </div>

              <div className="space-y-3">
                {salesCohortTurnoverData.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-100 transition-colors text-xs space-y-1.5"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-900">{item.period}</span>
                      <span className="font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                        누적 퇴사율 {item.turnoverRate}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-rose-500 h-full rounded-full"
                        style={{ width: `${(item.turnoverRate / 20) * 100}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-600">
                      <strong>주요 요인:</strong> {item.mainReason}
                    </p>
                  </div>
                ))}
              </div>

              <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl text-xs text-blue-900 space-y-1">
                <span className="font-bold block">💡 인사팀 리텐션 솔루션 추진 계획</span>
                <p className="text-[11px] leading-relaxed">
                  1. 영업 신입 전담 멘토링 제도(1:1 코칭) 및 초기 KPI 완화 완충기간 부여
                  <br />
                  2. 6개월 차 수습 리텐션 인센티브 지급 검토 중
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW 2: 입퇴사 (Peak Time 분석) */}
      {activeSubTab === '입퇴사' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  월별 입·퇴사 추이 비교 ({currentYear}년 당해 vs {prevYear}년 전년)
                </h3>
                <p className="text-xs text-slate-500">
                  차트의 막대를 클릭하거나 하단 월별 카드를 클릭하면 해당 월의 세부 Peak Time 분석이 표출됩니다.
                </p>
              </div>
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                연간 순증 {totalNetChange >= 0 ? `+${totalNetChange}` : totalNetChange}명
              </span>
            </div>

            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={monthlyData}
                  onClick={(e: any) => {
                    if (e && e.activePayload && e.activePayload.length > 0) {
                      onOpenMonthModal(e.activePayload[0].payload);
                    }
                  }}
                  className="cursor-pointer"
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(val: any, name: string) => [`${val}명`, name]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar isAnimationActive={false}
                    dataKey="currentYearHires"
                    name={`${currentYear} 입사자`}
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar isAnimationActive={false}
                    dataKey="currentYearLeavers"
                    name={`${currentYear} 퇴사자`}
                    fill="#f43f5e"
                    radius={[4, 4, 0, 0]}
                  />
                  <Line isAnimationActive={false}
                    type="monotone"
                    dataKey="prevYearHires"
                    name={`${prevYear} 전년 입사`}
                    stroke="#3b82f6"
                    strokeWidth={2}
                  />
                  <Line isAnimationActive={false}
                    type="monotone"
                    dataKey="prevYearLeavers"
                    name={`${prevYear} 전년 퇴사`}
                    stroke="#f59e0b"
                    strokeDasharray="4 4"
                    strokeWidth={2}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Monthly Peak Quick Selector Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 pt-2">
              {monthlyData.map((m) => {
                const isPeakHires = m.currentYearHires >= 20;
                const isPeakLeavers = m.currentYearLeavers >= 7;

                return (
                  <button
                    key={m.month}
                    type="button"
                    onClick={() => onOpenMonthModal(m)}
                    className={`p-3 rounded-xl border text-left transition-all hover:border-blue-400 hover:shadow-xs ${
                      isPeakHires
                        ? 'bg-emerald-50/70 border-emerald-300'
                        : isPeakLeavers
                        ? 'bg-rose-50/70 border-rose-300'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-slate-900 text-xs">{m.month}</span>
                      {isPeakHires && (
                        <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.2 rounded font-bold">
                          입사피크
                        </span>
                      )}
                      {isPeakLeavers && (
                        <span className="text-[10px] bg-rose-600 text-white px-1.5 py-0.2 rounded font-bold">
                          퇴사피크
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-600 space-y-0.5">
                      <p>
                        입사: <strong className="text-emerald-600">{m.currentYearHires}명</strong>
                      </p>
                      <p>
                        퇴사: <strong className="text-rose-600">{m.currentYearLeavers}명</strong>
                      </p>
                      <p className="font-bold text-slate-800 text-[10px]">
                        순증: {m.netChange >= 0 ? `+${m.netChange}` : m.netChange}명
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW 3: 인력구성비 (현장직 드릴다운) */}
      {activeSubTab === '인력구성비' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Office vs Field Ratio Card */}
            <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900">
                  직군별 구성비 (사무직 vs 현장직)
                </h3>
                <p className="text-xs text-slate-500">
                  현장직 영역 또는 버튼을 클릭하면 세부 조직(생산직/물류직)으로 드릴다운됩니다.
                </p>
              </div>

              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie isAnimationActive={false}
                      data={jobTypeRatioData}
                      dataKey="value"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={4}
                    >
                      {jobTypeRatioData.map((entry, index) => (
                        <Cell key={`cell-jt-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => [`${v}명`, '인원']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Office */}
                <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/60 text-xs">
                  <span className="text-indigo-800 font-bold block mb-1">사무직 ({officeRatio?.value ?? 0}명)</span>
                  <p className="text-[11px] text-indigo-700">
                    전체 인원의 {officeRatio?.percentage ?? 0}%
                  </p>
                </div>

                {/* Field Work (Interactive Drilldown Trigger) */}
                <button
                  type="button"
                  id="btn-trigger-field-drilldown"
                  onClick={() => onOpenDrilldown('현장직')}
                  className="p-3.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100/80 text-left transition-all text-xs group cursor-pointer shadow-xs"
                >
                  <div className="flex justify-between items-center text-emerald-900 font-bold mb-1">
                    <span>현장직 ({fieldRatio?.value ?? fieldWorkDrilldown.total}명)</span>
                    <ExternalLink className="w-3.5 h-3.5 text-emerald-700 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                  <p className="text-[11px] text-emerald-700">
                    클릭하여 생산직·물류직 세부 조직 드릴다운 팝업 열기
                  </p>
                </button>
              </div>
            </div>

            {/* In-place Drilldown Preview Panel */}
            <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    현장직({fieldWorkDrilldown.total}명) 세부 조직 드릴다운 뷰
                  </h3>
                  <p className="text-xs text-slate-500">
                    생산직({prodCat?.totalCount ?? 0}명) 및 물류직({logisticsCat?.totalCount ?? 0}명) 조직 배치 현황
                  </p>
                </div>

                {/* Switch between prod / logistics */}
                <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg text-xs font-bold">
                  <button
                    type="button"
                    id="btn-cat-prod"
                    onClick={() => setSelectedFieldCat('prod')}
                    className={`px-3 py-1.5 rounded-md flex items-center space-x-1 transition-colors ${
                      selectedFieldCat === 'prod'
                        ? 'bg-white text-emerald-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Factory className="w-3.5 h-3.5" />
                    <span>생산직 ({prodCat?.totalCount ?? 0}명)</span>
                  </button>
                  <button
                    type="button"
                    id="btn-cat-logistics"
                    onClick={() => setSelectedFieldCat('logistics')}
                    className={`px-3 py-1.5 rounded-md flex items-center space-x-1 transition-colors ${
                      selectedFieldCat === 'logistics'
                        ? 'bg-white text-blue-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>물류직 ({logisticsCat?.totalCount ?? 0}명)</span>
                  </button>
                </div>
              </div>

              {/* Drilldown details table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="px-3.5 py-2.5">팀 / 파트 명칭</th>
                      <th className="px-3.5 py-2.5 text-center">인원 수</th>
                      <th className="px-3.5 py-2.5">조직 리더</th>
                      <th className="px-3.5 py-2.5">근무 교대 형태</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {fieldWorkDrilldown.categories
                      .find((c) => c.id === selectedFieldCat)
                      ?.teams.map((t, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="px-3.5 py-3 font-bold text-slate-900">{t.teamName}</td>
                          <td className="px-3.5 py-3 text-center font-black text-blue-600">
                            {t.count}명
                          </td>
                          <td className="px-3.5 py-3 text-slate-800 font-medium">{t.leader}</td>
                          <td className="px-3.5 py-3">
                            <span className="px-2 py-0.5 rounded text-[11px] bg-slate-100 text-slate-700 font-medium">
                              {t.shift}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center pt-2">
                <span className="text-xs text-slate-500">{activeFieldCat?.recentTrend}</span>
                <button
                  type="button"
                  id="btn-open-full-drilldown"
                  onClick={() =>
                    onOpenDrilldown(selectedFieldCat === 'prod' ? '생산직' : '물류직')
                  }
                  className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center space-x-1"
                >
                  <span>전체 팀별 세부 명단 팝업 보기</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-VIEW 4: 휴직 (휴직 사유별 및 복직 예정일 목록) */}
      {activeSubTab === '휴직' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  휴직 사유별 대상자 현황 및 복직 예정일 관리
                </h3>
                <p className="text-xs text-slate-500">
                  육아휴직, 질병휴직, 가족돌봄 등 사유별 통계 및 복직 D-Day 카운트다운
                </p>
              </div>

              {/* Filter by leave reason */}
              <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
                {(['전체', '육아휴직', '질병휴직', '가족돌봄휴직', '학업휴직'] as const).map(
                  (reason) => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setLeaveFilter(reason)}
                      className={`px-3 py-1 rounded-md transition-colors ${
                        leaveFilter === reason
                          ? 'bg-white text-blue-700 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {reason}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Leave table */}
            <div className="border border-slate-200 rounded-xl overflow-x-auto text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-3.5 py-2.5">성명 / 직급</th>
                    <th className="px-3.5 py-2.5">소속 부서</th>
                    <th className="px-3.5 py-2.5">휴직 구분</th>
                    <th className="px-3.5 py-2.5">휴직 기간</th>
                    <th className="px-3.5 py-2.5 text-center">복직 D-Day</th>
                    <th className="px-3.5 py-2.5">대체인력 지정</th>
                    <th className="px-3.5 py-2.5 text-center">상태 변경</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredLeavePersons.map((person) => {
                    const isUpcomingReturn = person.dDay <= 30;

                    return (
                      <tr key={person.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-3.5 py-3 font-bold text-slate-900">
                          {person.name} ({person.position})
                        </td>
                        <td className="px-3.5 py-3 text-slate-800">{person.department}</td>
                        <td className="px-3.5 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                              person.reason === '육아휴직'
                                ? 'bg-pink-50 text-pink-700 border border-pink-200'
                                : person.reason === '질병휴직'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {person.reason}
                          </span>
                        </td>
                        <td className="px-3.5 py-3 text-slate-600 font-mono text-[11px]">
                          {person.startDate} ~ {person.expectedReturnDate}
                        </td>
                        <td className="px-3.5 py-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${
                              isUpcomingReturn
                                ? 'bg-rose-100 text-rose-700 animate-pulse'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            D-{person.dDay}일
                          </span>
                        </td>
                        <td className="px-3.5 py-3">
                          {person.substituteAssigned ? (
                            <span className="text-emerald-700 font-medium flex items-center space-x-1">
                              <CheckCircle className="w-3.5 h-3.5" />
                              <span>{person.substituteName}</span>
                            </span>
                          ) : (
                            <span className="text-rose-600 font-medium">대체인력 미지정</span>
                          )}
                        </td>
                        <td className="px-3.5 py-3 text-center">
                          <select
                            value={person.status}
                            onChange={(e) =>
                              onUpdateLeaveStatus(
                                person.id,
                                e.target.value as LeavePersonItem['status']
                              )
                            }
                            className="px-2 py-1 rounded border border-slate-300 bg-white text-xs text-slate-800 font-medium focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="휴직중">휴직중</option>
                            <option value="복직예정">복직예정</option>
                            <option value="복직완료">복직완료</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
