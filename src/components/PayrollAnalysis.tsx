import React, { useState } from 'react';
import { PayrollMonthlyData, DepartmentProductivityData } from '../types';
// TODO(redesign): DB(n8n) 데이터로 교체 예정 — 현재는 UI/UX 복원용 데모데이터
const initialPayrollData: PayrollMonthlyData[] = [
  { month: '1월', currentYearAmount: 32.4, prevYearAmount: 29.8, baseSalary: 23.2, bonusAmount: 2.1, allowance: 2.8, insuranceSocial: 2.3, employerContribution: 2.0, newHireImpact: 0.6 },
  { month: '2월', currentYearAmount: 32.8, prevYearAmount: 30.1, baseSalary: 23.5, bonusAmount: 2.0, allowance: 2.9, insuranceSocial: 2.4, employerContribution: 2.0, newHireImpact: 0.8 },
  { month: '3월', currentYearAmount: 34.5, prevYearAmount: 31.0, baseSalary: 24.2, bonusAmount: 2.5, allowance: 3.1, insuranceSocial: 2.6, employerContribution: 2.1, newHireImpact: 1.4, note: '상반기 대규모 신규 입사자 급여 반영' },
  { month: '4월', currentYearAmount: 34.8, prevYearAmount: 31.4, baseSalary: 24.5, bonusAmount: 2.2, allowance: 3.2, insuranceSocial: 2.7, employerContribution: 2.2, newHireImpact: 1.5 },
  { month: '5월', currentYearAmount: 35.1, prevYearAmount: 31.8, baseSalary: 24.7, bonusAmount: 2.3, allowance: 3.2, insuranceSocial: 2.7, employerContribution: 2.2, newHireImpact: 1.6 },
  { month: '6월', currentYearAmount: 35.6, prevYearAmount: 32.2, baseSalary: 25.0, bonusAmount: 2.4, allowance: 3.3, insuranceSocial: 2.7, employerContribution: 2.2, newHireImpact: 1.8 },
  { month: '7월', currentYearAmount: 36.2, prevYearAmount: 32.5, baseSalary: 25.3, bonusAmount: 2.5, allowance: 3.4, insuranceSocial: 2.8, employerContribution: 2.2, newHireImpact: 2.0 },
  { month: '8월 (당월)', currentYearAmount: 36.8, prevYearAmount: 32.9, baseSalary: 25.6, bonusAmount: 2.6, allowance: 3.5, insuranceSocial: 2.8, employerContribution: 2.3, newHireImpact: 2.2 },
  { month: '9월 (예상)', currentYearAmount: 37.1, prevYearAmount: 33.2, baseSalary: 25.8, bonusAmount: 2.6, allowance: 3.5, insuranceSocial: 2.9, employerContribution: 2.3, newHireImpact: 2.4 },
  { month: '10월 (예상)', currentYearAmount: 46.8, prevYearAmount: 41.5, baseSalary: 26.2, bonusAmount: 11.8, allowance: 3.6, insuranceSocial: 2.9, employerContribution: 2.3, newHireImpact: 2.7, isBonusPeak: true, note: '추석 명절 상여금 및 하반기 경영성과급 지급 스파이크' },
  { month: '11월 (예상)', currentYearAmount: 37.5, prevYearAmount: 33.6, baseSalary: 26.3, bonusAmount: 2.7, allowance: 3.6, insuranceSocial: 2.6, employerContribution: 2.3, newHireImpact: 2.8 },
  { month: '12월 (예상)', currentYearAmount: 43.2, prevYearAmount: 38.9, baseSalary: 26.5, bonusAmount: 8.2, allowance: 3.6, insuranceSocial: 2.6, employerContribution: 2.3, newHireImpact: 2.9, note: '연말 특별 인센티브 및 결산 수당' },
];

const departmentProductivityData: DepartmentProductivityData[] = [
  { id: '1', department: '연구개발본부', headcount: 164, annualPayroll: 128.4, monthlyPayrollAvg: 1070, generatedRevenue: 890.0, kpiScore: 96.4, productivityPerPerson: 5.43, payrollRoi: 6.93 },
  { id: '2', department: '생산본부', headcount: 184, annualPayroll: 119.6, monthlyPayrollAvg: 996, generatedRevenue: 1240.0, kpiScore: 94.8, productivityPerPerson: 6.74, payrollRoi: 10.37 },
  { id: '3', department: '영업마케팅본부', headcount: 112, annualPayroll: 89.2, monthlyPayrollAvg: 743, generatedRevenue: 1420.0, kpiScore: 92.1, productivityPerPerson: 12.68, payrollRoi: 15.92 },
  { id: '4', department: '물류운영팀', headcount: 82, annualPayroll: 45.8, monthlyPayrollAvg: 381, generatedRevenue: 280.0, kpiScore: 95.0, productivityPerPerson: 3.41, payrollRoi: 6.11 },
  { id: '5', department: '경영지원본부', headcount: 64, annualPayroll: 42.6, monthlyPayrollAvg: 355, generatedRevenue: 190.0, kpiScore: 98.2, productivityPerPerson: 2.97, payrollRoi: 4.46 },
  { id: '6', department: '품질보증팀', headcount: 42, annualPayroll: 28.4, monthlyPayrollAvg: 236, generatedRevenue: 210.0, kpiScore: 93.7, productivityPerPerson: 5.00, payrollRoi: 7.39 },
];

const payrollCostBreakdown: { name: string; value: number; color: string }[] = [
  { name: '기본급', value: 68.2, color: '#2563eb' },
  { name: '상여금 및 인센티브', value: 14.5, color: '#f59e0b' },
  { name: '법정 제수당 (연장/야간)', value: 8.8, color: '#10b981' },
  { name: '4대 사회보험 (회사부담)', value: 5.4, color: '#8b5cf6' },
  { name: '퇴직급여충당금 및 복리후생', value: 3.1, color: '#ec4899' },
];
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
  ShieldAlert,
  ShieldCheck,
  DollarSign,
  TrendingUp,
  Award,
  AlertCircle,
  Calculator,
  Download,
  Info,
  Layers,
} from 'lucide-react';

interface PayrollAnalysisProps {
  payrollData?: PayrollMonthlyData[];
  departmentData?: DepartmentProductivityData[];
}

export const PayrollAnalysis: React.FC<PayrollAnalysisProps> = ({
  payrollData: payrollDataProp,
  departmentData: departmentDataProp,
}) => {
  // DB 데이터가 없거나 비어있으면(시드 전) 데모 상수로 안전하게 대체
  const payrollData = payrollDataProp && payrollDataProp.length > 0 ? payrollDataProp : initialPayrollData;
  const productivityData =
    departmentDataProp && departmentDataProp.length > 0 ? departmentDataProp : departmentProductivityData;
  const [highlightMonth, setHighlightMonth] = useState<string>('10월 (예상)');
  const [simulationHeadcount, setSimulationHeadcount] = useState<number>(10);
  const [simulatedAvgSalary, setSimulatedAvgSalary] = useState<number>(5500); // 만원 단위

  const simulatedAdditionalAnnualCost = (simulationHeadcount * simulatedAvgSalary * 1.15) / 10000; // 억원 단위 (4대보험/퇴직충당 15% 포함)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-md border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-blue-600 text-white shadow-xs">
              <DollarSign className="w-3.5 h-3.5" />
              <span>인건비 분석 총괄</span>
            </span>
          </div>
          <h1 className="text-xl font-black mt-1.5 text-white">
            2026년도 월별 급여·인건비 총괄 분석 및 부서별 생산성 ROI
          </h1>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          <div className="bg-slate-800 border border-slate-700 px-3 py-2 rounded-xl text-slate-300">
            <span>연간 총 인건비 예산 집행률: </span>
            <strong className="text-emerald-400 font-black text-sm">64.8%</strong>
            <span className="text-slate-400 text-[11px]"> (총 448억원 중 290.4억원 집행)</span>
          </div>
        </div>
      </div>

      {/* Row 1: 12-Month Payroll Trend & October Bonus Spike */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-slate-900">
                월별 인건비 추이 (전년 vs 당해년도 및 10월 상여금 스파이크)
              </h3>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                10월 상여금 스파이크 (46.8억원)
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              전월/전년 대비 비교 및 하반기 신규 입사자 연동에 따른 인건비 가중치 곡선
            </p>
          </div>

          <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200">
            단위: <strong className="text-slate-900">억원 (KRW)</strong>
          </div>
        </div>

        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={payrollData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis domain={[20, 50]} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(val: any, name: string) => [`${val}억원`, name]}
                labelFormatter={(label) => `${label} 인건비 상세 내역`}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar isAnimationActive={false}
                dataKey="currentYearAmount"
                name="2026 총 인건비"
                fill="#2563eb"
                radius={[4, 4, 0, 0]}
              />
              <Line isAnimationActive={false}
                type="monotone"
                dataKey="prevYearAmount"
                name="2025 전년 동월 인건비"
                stroke="#94a3b8"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line isAnimationActive={false}
                type="monotone"
                dataKey="newHireImpact"
                name="신규 입사자 순증 영향분"
                stroke="#10b981"
                strokeWidth={2}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Highlight Note for October Spike & Hire link */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
          <div className="bg-amber-50/80 border border-amber-200 p-3.5 rounded-xl text-xs text-amber-900 space-y-1">
            <span className="font-bold flex items-center space-x-1 text-amber-800">
              <AlertCircle className="w-4 h-4" />
              <span>10월 인건비 급상승(스파이크) 원인 분석:</span>
            </span>
            <p className="text-[11px] leading-relaxed">
              • 추석 명절 상여금(기본급의 50%) 및 하반기 경영성과급 11.8억원 일시 지급 반영
              <br />
              • 3분기 대규모 채용 완료 인력(28명)의 전사 급여 본격 정산 연동
            </p>
          </div>

          <div className="bg-blue-50/80 border border-blue-200 p-3.5 rounded-xl text-xs text-blue-900 space-y-1">
            <span className="font-bold flex items-center space-x-1 text-blue-800">
              <TrendingUp className="w-4 h-4" />
              <span>하반기 입사자 인건비 연동 가중치:</span>
            </span>
            <p className="text-[11px] leading-relaxed">
              • 8월 현재 신규 입사 영향분 <strong>2.2억원/월</strong>에서 12월 <strong>2.9억원/월</strong>로 점진적 확대 예상
              <br />
              • 연간 인건비 예산 한도(448억원) 내 안정적 관리 가능 (예상 집행률 98.2%)
            </p>
          </div>
        </div>
      </div>

      {/* Row 2: Department Productivity & Cost Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Department Productivity Table (7 cols) */}
        <div className="lg:col-span-8 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                부서별 인건비 & 생산성 (인건비 대비 매출/KPI 연계)
              </h3>
              <p className="text-xs text-slate-500">
                1인당 인건비 대비 매출 기여도 및 인건비 투자 수익률(ROI) 지표
              </p>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-x-auto text-xs">
            <table className="w-full text-left">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-3.5 py-2.5">부서명</th>
                  <th className="px-3.5 py-2.5 text-center">인원</th>
                  <th className="px-3.5 py-2.5 text-right">연간 총 인건비</th>
                  <th className="px-3.5 py-2.5 text-right">창출 매출/성과</th>
                  <th className="px-3.5 py-2.5 text-center">1인당 생산성</th>
                  <th className="px-3.5 py-2.5 text-right">인건비 ROI 배수</th>
                  <th className="px-3.5 py-2.5 text-center">KPI 점수</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {productivityData.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-3.5 py-3 font-bold text-slate-900">{d.department}</td>
                    <td className="px-3.5 py-3 text-center">{d.headcount}명</td>
                    <td className="px-3.5 py-3 text-right font-medium">{d.annualPayroll}억원</td>
                    <td className="px-3.5 py-3 text-right font-bold text-slate-900">
                      {d.generatedRevenue}억원
                    </td>
                    <td className="px-3.5 py-3 text-center">
                      <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                        {d.productivityPerPerson}억원/인
                      </span>
                    </td>
                    <td className="px-3.5 py-3 text-right font-black text-emerald-600">
                      {d.payrollRoi}배
                    </td>
                    <td className="px-3.5 py-3 text-center font-bold text-slate-800">
                      {d.kpiScore}점
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detailed Item Cost Breakdown (5 cols) */}
        <div className="lg:col-span-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900">제반 인건비 세부 항목 구성비</h3>
            <p className="text-xs text-slate-500">
              기본급, 상여금, 4대 사회보험 및 사업주 법정 부담금
            </p>
          </div>

          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie isAnimationActive={false}
                  data={payrollCostBreakdown}
                  dataKey="value"
                  innerRadius={38}
                  outerRadius={65}
                  paddingAngle={3}
                >
                  {payrollCostBreakdown.map((entry, index) => (
                    <Cell key={`cell-cb-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => [`${v}%`, '비중']} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2 text-xs">
            {payrollCostBreakdown.map((item) => (
              <div key={item.name} className="flex justify-between items-center text-slate-700">
                <span className="flex items-center space-x-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span>{item.name}</span>
                </span>
                <span className="font-bold text-slate-900">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Headcount & Payroll Simulation Tool */}
      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-3">
        <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
          <Calculator className="w-4 h-4 text-blue-600" />
          <span>하반기 추가 충원 시 인건비 영향도 시뮬레이터</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              신규 충원 인원 수 (명)
            </label>
            <input
              type="number"
              min={1}
              max={100}
              value={simulationHeadcount}
              onChange={(e) => setSimulationHeadcount(Number(e.target.value) || 0)}
              className="w-full p-2 rounded-lg border border-slate-300 bg-white font-bold text-slate-900"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              1인당 평균 연봉 (만원)
            </label>
            <input
              type="number"
              step={100}
              min={2000}
              max={15000}
              value={simulatedAvgSalary}
              onChange={(e) => setSimulatedAvgSalary(Number(e.target.value) || 0)}
              className="w-full p-2 rounded-lg border border-slate-300 bg-white font-bold text-slate-900"
            />
          </div>

          <div className="bg-white p-3 rounded-xl border border-blue-200 flex flex-col justify-center">
            <span className="text-slate-500 text-[11px]">예상 추가 연간 소요 예산 (제세공과금 포함)</span>
            <span className="text-base font-black text-blue-600">
              약 {simulatedAdditionalAnnualCost.toFixed(2)}억원 / 년
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
