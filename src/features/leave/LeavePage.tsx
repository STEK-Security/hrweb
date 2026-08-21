/**
 * 휴직자 관리 — db.listLeave() 조회 + 필터 + 등록/수정. RosterPage 와 동일한 톤(카드+테이블).
 */
import { useEffect, useMemo, useState } from 'react';
import { Search, UserCheck, UserPlus, Pencil } from 'lucide-react';
import { listLeave, getOrgSetting, type LeaveRecord } from '../../lib/db';
import { LeaveForm } from './LeaveForm';

type StatusFilter = '전체' | LeaveRecord['status'];

function StatusBadge({ status }: { status: LeaveRecord['status'] }) {
  const cls =
    status === '휴직중'
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : status === '복직예정'
        ? 'bg-blue-50 text-blue-700 border-blue-200'
        : 'bg-slate-100 text-slate-500 border-slate-200';
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border whitespace-nowrap ${cls}`}>
      {status}
    </span>
  );
}

export function LeavePage() {
  const [records, setRecords] = useState<LeaveRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dept, setDept] = useState('전체');
  const [status, setStatus] = useState<StatusFilter>('전체');
  const [formRecord, setFormRecord] = useState<LeaveRecord | 'new' | null>(null);
  const [inputEnabled, setInputEnabled] = useState(true);

  const reload = () => {
    setLoading(true);
    listLeave().then((data) => {
      setRecords(data);
      setLoading(false);
    });
  };

  useEffect(() => {
    reload();
    getOrgSetting('leave_input_enabled').then(setInputEnabled);
  }, []);

  const depts = useMemo(() => {
    const set = new Set<string>();
    for (const r of records) if (r.dept) set.add(r.dept);
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ko'));
  }, [records]);

  const filtered = records.filter((r) => {
    if (dept !== '전체' && r.dept !== dept) return false;
    if (status !== '전체' && r.status !== status) return false;
    if (search && !r.name.includes(search) && !(r.position ?? '').includes(search)) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-blue-600" />
          휴직자 관리
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">
            조회 {filtered.length}명 / 전체 {records.length}명
          </span>
          {inputEnabled && (
            <button
              type="button"
              onClick={() => setFormRecord('new')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
              휴직자 등록
            </button>
          )}
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            aria-label="성명·직급 검색"
            placeholder="성명 또는 직급 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-7 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 w-48"
          />
        </div>
        <select
          aria-label="부서"
          value={dept}
          onChange={(e) => setDept(e.target.value)}
          className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="전체">부서 전체</option>
          {depts.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          aria-label="상태"
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {(['전체', '휴직중', '복직예정', '복직완료'] as const).map((s) => (
            <option key={s} value={s}>
              {s === '전체' ? '상태 전체' : s}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-320px)]">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0">
              <tr>
                <th className="px-3 py-2.5">성명</th>
                <th className="px-3 py-2.5">부서</th>
                <th className="px-3 py-2.5">직급</th>
                <th className="px-3 py-2.5">사유</th>
                <th className="px-3 py-2.5">휴직 시작일</th>
                <th className="px-3 py-2.5">복직 예정일</th>
                <th className="px-3 py-2.5">대체인력</th>
                <th className="px-3 py-2.5">상태</th>
                <th className="px-3 py-2.5">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-slate-400">
                    불러오는 중...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-slate-400">
                    조회 결과가 없습니다.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-blue-50/40 transition-colors">
                    <td className="px-3 py-2.5 font-bold text-slate-900">{r.name}</td>
                    <td className="px-3 py-2.5">{r.dept ?? '-'}</td>
                    <td className="px-3 py-2.5">{r.position ?? '-'}</td>
                    <td className="px-3 py-2.5">{r.reason ?? '-'}</td>
                    <td className="px-3 py-2.5">{r.start_date ?? '-'}</td>
                    <td className="px-3 py-2.5">{r.expected_return_date ?? '-'}</td>
                    <td className="px-3 py-2.5">
                      {r.substitute_assigned ? r.substitute_name || '배치완료' : '-'}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => setFormRecord(r)}
                        aria-label="수정"
                        className="p-1 rounded text-blue-600 hover:bg-blue-50"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {formRecord && (
        <LeaveForm
          record={formRecord === 'new' ? null : formRecord}
          onClose={() => setFormRecord(null)}
          onSaved={() => {
            setFormRecord(null);
            reload();
          }}
        />
      )}
    </div>
  );
}
