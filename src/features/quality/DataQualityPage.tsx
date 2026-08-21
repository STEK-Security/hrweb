/**
 * 데이터품질 리포트 — employees 를 스캔해 사번 중복, 필수값(성명/입사일) 누락,
 * 형식오류(생년월일·입사일 날짜형식), 컬럼별 결측률을 보여준다. 신규 테이블 불필요.
 */
import { useEffect, useMemo, useState } from 'react';
import { ShieldAlert, AlertTriangle } from 'lucide-react';
import { listEmployees, type Employee } from '../../lib/db';

const DATE_RE = /^\d{4}[-./]\d{1,2}[-./]\d{1,2}$/;
const MISSING_RATE_COLUMNS = ['성명', '사번', '입사일', '생년월일', '성별', '직급', '직책', '전체소속명'];

function isValidDate(v: unknown): boolean {
  if (!v) return false;
  const s = String(v).trim();
  if (!DATE_RE.test(s)) return false;
  return !isNaN(new Date(s.replace(/[./]/g, '-')).getTime());
}

interface QualityIssue {
  employeeId: string;
  name: string;
  type: string;
  detail: string;
}

function scan(employees: Employee[]) {
  const issues: QualityIssue[] = [];
  const idCounts = new Map<string, number>();

  for (const e of employees) {
    const empNo = String(e['사번'] ?? '').trim();
    if (empNo) idCounts.set(empNo, (idCounts.get(empNo) ?? 0) + 1);

    if (!String(e['성명'] ?? '').trim()) {
      issues.push({ employeeId: e['id'] as string, name: e._name, type: '필수값 누락', detail: '성명 없음' });
    }
    if (!String(e['입사일'] ?? '').trim()) {
      issues.push({ employeeId: e['id'] as string, name: e._name, type: '필수값 누락', detail: '입사일 없음' });
    } else if (!isValidDate(e['입사일'])) {
      issues.push({ employeeId: e['id'] as string, name: e._name, type: '형식오류', detail: `입사일 형식 오류: "${e['입사일']}"` });
    }
    if (e['생년월일'] && !isValidDate(e['생년월일'])) {
      issues.push({ employeeId: e['id'] as string, name: e._name, type: '형식오류', detail: `생년월일 형식 오류: "${e['생년월일']}"` });
    }
  }

  for (const [empNo, count] of idCounts) {
    if (count > 1) {
      for (const e of employees) {
        if (String(e['사번'] ?? '').trim() === empNo) {
          issues.push({ employeeId: e['id'] as string, name: e._name, type: '사번 중복', detail: `사번 "${empNo}" 이(가) ${count}건 중복` });
        }
      }
    }
  }

  const total = employees.length || 1;
  const missingRates = MISSING_RATE_COLUMNS.map((col) => {
    const missing = employees.filter((e) => !String(e[col] ?? '').trim()).length;
    return { column: col, missing, rate: Math.round((missing / total) * 1000) / 10 };
  });

  return { issues, missingRates };
}

const TYPE_STYLE: Record<string, string> = {
  '사번 중복': 'bg-rose-50 text-rose-700 border-rose-200',
  '필수값 누락': 'bg-amber-50 text-amber-700 border-amber-200',
  형식오류: 'bg-orange-50 text-orange-700 border-orange-200',
};

export function DataQualityPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<'전체' | string>('전체');

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

  const { issues, missingRates } = useMemo(() => scan(employees), [employees]);
  const filtered = typeFilter === '전체' ? issues : issues.filter((i) => i.type === typeFilter);
  const dupCount = issues.filter((i) => i.type === '사번 중복').length;
  const missingCount = issues.filter((i) => i.type === '필수값 누락').length;
  const formatCount = issues.filter((i) => i.type === '형식오류').length;

  if (loading) {
    return <div className="flex items-center justify-center py-24 text-sm text-slate-500">불러오는 중...</div>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
        <ShieldAlert className="w-5 h-5 text-blue-600" />
        데이터품질 리포트
      </h2>
      <p className="text-xs text-slate-500">
        총 {employees.length}명 스캔 · 이슈 {issues.length}건 (사번중복 {dupCount} · 필수값누락 {missingCount} · 형식오류 {formatCount})
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-slate-900">컬럼별 결측률</h3>
          <div className="space-y-2">
            {missingRates.map((m) => (
              <div key={m.column} className="text-xs">
                <div className="flex justify-between mb-1">
                  <span className="text-slate-700 font-medium">{m.column}</span>
                  <span className="text-slate-500">{m.missing}건 · {m.rate}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${m.rate > 10 ? 'bg-rose-500' : m.rate > 0 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.min(m.rate, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              이슈 목록
            </h3>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
              {(['전체', '사번 중복', '필수값 누락', '형식오류'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypeFilter(t)}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    typeFilter === t ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="max-h-[calc(100vh-420px)] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="px-3 py-2">성명</th>
                  <th className="px-3 py-2">유형</th>
                  <th className="px-3 py-2">상세</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-8 text-center text-slate-400">이슈가 없습니다.</td>
                  </tr>
                ) : (
                  filtered.map((i, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-bold text-slate-900">{i.name || '(무명)'}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${TYPE_STYLE[i.type] ?? 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                          {i.type}
                        </span>
                      </td>
                      <td className="px-3 py-2">{i.detail}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
