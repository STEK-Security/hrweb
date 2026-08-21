/**
 * 사번·성명 검색 후 직원 1명을 선택하는 공용 위젯. CertificatePage 의 검색 패턴과 동일한 톤.
 * TransfersPage/TrainingPage/EvaluationPage 에서 대상 직원 선택에 재사용한다.
 */
import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import type { Employee } from '../lib/db';

export function EmployeePicker({
  employees,
  value,
  onChange,
}: {
  employees: Employee[];
  value: string | null;
  onChange: (id: string, emp: Employee) => void;
}) {
  const [search, setSearch] = useState('');
  const selected = employees.find((e) => (e['id'] as string) === value) ?? null;
  const results = useMemo(() => {
    if (!search) return [];
    return employees.filter((e) => e._name.includes(search) || e._id.includes(search)).slice(0, 20);
  }, [employees, search]);

  return (
    <div className="relative">
      {selected ? (
        <div className="flex items-center justify-between px-3 py-2 border border-slate-300 rounded-lg bg-slate-50">
          <span className="font-semibold">
            {selected._name} <span className="text-slate-500">{selected._id} · {selected._team}</span>
          </span>
          <button type="button" onClick={() => onChange('', selected)} className="text-slate-400 hover:text-slate-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="사번 또는 성명 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-7 pr-2.5 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {search && (
            <div className="absolute z-10 mt-1 w-full border border-slate-200 bg-white rounded-lg shadow-lg divide-y divide-slate-100 max-h-48 overflow-y-auto">
              {results.length === 0 ? (
                <div className="px-3 py-2 text-slate-400">검색 결과가 없습니다.</div>
              ) : (
                results.map((e) => (
                  <button
                    key={e['id'] as string}
                    type="button"
                    onClick={() => {
                      onChange(e['id'] as string, e);
                      setSearch('');
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors"
                  >
                    <span className="font-bold text-slate-900">{e._name}</span>{' '}
                    <span className="text-slate-500">{e._id} · {e._team}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
