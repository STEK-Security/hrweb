/**
 * 구성·다양성 — 재직자의 성별·연령대·국적·학력·직급 분포. employees 집계만, 신규 테이블 없음.
 * 성별/국적/연령/직급은 DashboardPage 의 파생 계산 함수를 재사용한다.
 */
import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Users2 } from 'lucide-react';
import { listEmployees, type Employee } from '../../lib/db';
import { isRealOrg } from '../../excel/derive';
import {
  buildGenderRatio,
  buildNationalityRatio,
  buildAgeRatio,
  buildPositionDistribution,
  groupBy,
  pct,
} from '../../lib/stats';
import type { RatioData } from '../../types';

const EDU_ORDER = ['고졸', '전문대졸', '대졸', '석사', '박사'];
const EDU_COLOR: Record<string, string> = {
  고졸: '#94a3b8',
  전문대졸: '#38bdf8',
  대졸: '#3b82f6',
  석사: '#8b5cf6',
  박사: '#1e40af',
};
const EDU_PALETTE = ['#94a3b8', '#38bdf8', '#3b82f6', '#8b5cf6', '#1e40af', '#0ea5e9'];

function buildEducationRatio(active: Employee[]): RatioData[] {
  const known = active.filter((e) => isRealOrg(e._edu) && e._edu !== '미상');
  const total = known.length;
  const grouped = groupBy(known, (e) => e._edu);
  const names = Object.keys(grouped).sort((a, b) => {
    const ai = EDU_ORDER.indexOf(a);
    const bi = EDU_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return grouped[b].length - grouped[a].length;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
  return names.map((name, i) => ({
    name,
    value: grouped[name].length,
    color: EDU_COLOR[name] ?? EDU_PALETTE[i % EDU_PALETTE.length],
    percentage: pct(grouped[name].length, total),
  }));
}

function DonutCard({ title, data, unit = '명' }: { title: string; data: RatioData[]; unit?: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        <span className="text-xs text-slate-500">전체 {total}{unit}</span>
      </div>
      {total === 0 ? (
        <div className="h-56 flex items-center justify-center text-xs text-slate-400">데이터가 없습니다.</div>
      ) : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie isAnimationActive={false} data={data} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={4}>
                {data.map((entry, index) => (
                  <Cell key={`c-${title}-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v: any, n: any) => [`${v}${unit}`, n]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export function DiversityPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listEmployees().then((data) => {
      if (cancelled) return;
      setEmployees(data);
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
  const genderRatio = buildGenderRatio(active);
  const nationalityRatio = buildNationalityRatio(active);
  const ageRatio = buildAgeRatio(active);
  const educationRatio = buildEducationRatio(active);
  const gradeDistribution = buildPositionDistribution(active);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
        <Users2 className="w-5 h-5 text-blue-600" />
        구성·다양성
      </h2>
      <p className="text-xs text-slate-500">재직중인 임직원 {active.length}명의 성별·연령대·국적·학력·직급 구성입니다.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <DonutCard title="성별 분포" data={genderRatio} />
        <DonutCard title="국적 분포" data={nationalityRatio} />
        <DonutCard title="연령대 분포" data={ageRatio} />
        <DonutCard title="학력 분포" data={educationRatio} />
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <h3 className="text-sm font-bold text-slate-900">직급별 인원 분포</h3>
        {gradeDistribution.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-xs text-slate-400">데이터가 없습니다.</div>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gradeDistribution} margin={{ left: 0, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => [`${v}명`, '인원']} />
                <Bar isAnimationActive={false} dataKey="count" name="인원" radius={[4, 4, 0, 0]}>
                  {gradeDistribution.map((entry, index) => (
                    <Cell key={`grade-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
