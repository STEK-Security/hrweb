/**
 * 인건비 — payroll_monthly/department_productivity 테이블에서 조회. 시드 전(빈 테이블)에는
 * PayrollAnalysis 내부 데모 상수로 자동 대체되어 빈 화면을 방지한다.
 */
import { useEffect, useState } from 'react';
import { PayrollAnalysis } from '../../components/PayrollAnalysis';
import { listPayrollMonthly, listDeptProductivity } from '../../lib/db';
import type { PayrollMonthlyData, DepartmentProductivityData } from '../../types';

export function PayrollPlaceholderPage() {
  const [payrollData, setPayrollData] = useState<PayrollMonthlyData[]>([]);
  const [departmentData, setDepartmentData] = useState<DepartmentProductivityData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([listPayrollMonthly(), listDeptProductivity()]).then(([monthly, dept]) => {
      if (!active) return;
      setPayrollData(
        monthly.map((r) => ({
          month: r.month,
          currentYearAmount: r.current_year_amount,
          prevYearAmount: r.prev_year_amount,
          baseSalary: r.base_salary,
          bonusAmount: r.bonus_amount,
          allowance: r.allowance,
          insuranceSocial: r.insurance_social,
          employerContribution: r.employer_contribution,
          newHireImpact: r.new_hire_impact,
          note: r.note ?? undefined,
          isBonusPeak: r.is_bonus_peak,
        }))
      );
      setDepartmentData(
        dept.map((r) => ({
          id: r.id,
          department: r.department,
          headcount: r.headcount,
          annualPayroll: r.annual_payroll,
          monthlyPayrollAvg: r.monthly_payroll_avg,
          generatedRevenue: r.generated_revenue,
          kpiScore: r.kpi_score,
          productivityPerPerson: r.productivity_per_person,
          payrollRoi: r.payroll_roi,
        }))
      );
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-3">
      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
        샘플 인건비 · 급여시스템 연동 시 실데이터 반영
      </span>
      {loading ? (
        <div className="text-sm text-slate-500 p-6">불러오는 중...</div>
      ) : (
        <PayrollAnalysis payrollData={payrollData} departmentData={departmentData} />
      )}
    </div>
  );
}
