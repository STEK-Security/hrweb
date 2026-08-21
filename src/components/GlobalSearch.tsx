/**
 * 전역검색 — Navbar 상단 검색창. 이름·사번·팀·직급으로 employees 를 검색해 드롭다운으로 보여주고
 * 클릭하면 직원 상세(EmployeeDrawer)를 연다. 검색 자체는 로그를 남기지 않는다(조회는 EmployeeDrawer
 * 의 view_employee 로만 기록된다).
 */
import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { listEmployees, type Employee } from '../lib/db';

interface GlobalSearchProps {
  onSelectEmployee: (id: string) => void;
}

export function GlobalSearch({ onSelectEmployee }: GlobalSearchProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listEmployees().then(setEmployees);
  }, []);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const q = query.trim();
  const results = q
    ? employees
        .filter(
          (e) =>
            e._name.includes(q) ||
            e._id.includes(q) ||
            e._team.includes(q) ||
            e._grade.includes(q)
        )
        .slice(0, 8)
    : [];

  return (
    <div ref={boxRef} className="relative w-full max-w-xs">
      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
      <input
        type="text"
        aria-label="전역 검색: 이름·사번·팀·직급"
        placeholder="이름·사번·팀·직급 검색"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        className="w-full pl-7 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      {open && q && (
        <div className="absolute top-full left-0 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg divide-y divide-slate-100 max-h-72 overflow-y-auto z-50">
          {results.length === 0 ? (
            <div className="px-3 py-3 text-xs text-slate-400">검색 결과가 없습니다.</div>
          ) : (
            results.map((e) => (
              <button
                key={e['id'] as string}
                type="button"
                onClick={() => {
                  onSelectEmployee(e['id'] as string);
                  setQuery('');
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 transition-colors"
              >
                <span className="font-bold text-slate-900">{e._name}</span>{' '}
                <span className="text-slate-500">{e._id} · {e._team} · {e._grade}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
