/**
 * 직원 명부 — db.listEmployees() 조회 + 필터. 민감컬럼(주민번호·계좌·주소·연락처 등)은
 * 표에 표시하지 않는다(RLS 도 별도로 막지만 화면에서도 노출하지 않음). 행 클릭 → 상세 드로어.
 */
import { useEffect, useMemo, useState } from 'react';
import { Search, Users, UserPlus, Pencil, Trash2 } from 'lucide-react';
import { listEmployees, softDeleteEmployee, type Employee } from '../../lib/db';
import { isRealOrg } from '../../excel/derive';
import { useRole } from '../../lib/auth';
import { logEvent } from '../../lib/audit';
import { EmployeeDrawer, HR_ROLES } from './EmployeeDrawer';
import { EmployeeForm } from './EmployeeForm';

type StatusFilter = '전체' | '재직중' | '퇴직예정' | '퇴직';

const uniqueSorted = (values: string[]): string[] =>
  Array.from(new Set(values.filter((v) => isRealOrg(v)))).sort((a, b) => a.localeCompare(b, 'ko'));

function statusOf(e: Employee): '재직중' | '퇴직예정' | '퇴직' {
  if (e._retired) return '퇴직';
  if (e._pending) return '퇴직예정';
  return '재직중';
}

function StatusBadge({ status }: { status: '재직중' | '퇴직예정' | '퇴직' }) {
  const cls =
    status === '재직중'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : status === '퇴직예정'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-rose-50 text-rose-700 border-rose-200';
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border whitespace-nowrap ${cls}`}>
      {status}
    </span>
  );
}

export function RosterPage() {
  const role = useRole();
  const isHr = !!role && HR_ROLES.has(role);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [corp, setCorp] = useState('전체');
  const [div, setDiv] = useState('전체');
  const [team, setTeam] = useState('전체');
  const [grade, setGrade] = useState('전체');
  const [empType, setEmpType] = useState('전체');
  const [status, setStatus] = useState<StatusFilter>('전체');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formEmployeeId, setFormEmployeeId] = useState<string | null | 'new'>(null);

  const reload = () => {
    setLoading(true);
    listEmployees().then((data) => {
      setEmployees(data);
      setLoading(false);
    });
  };

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

  const handleDelete = async (e: Employee) => {
    if (!window.confirm(`${e._name}(${e._id}) 직원을 삭제하시겠습니까?`)) return;
    const id = e['id'] as string;
    const ok = await softDeleteEmployee(id);
    if (!ok) {
      window.alert('삭제에 실패했습니다.');
      return;
    }
    await logEvent('delete_employee', { targetId: id, targetTable: 'employees' });
    reload();
  };

  const corps = useMemo(() => uniqueSorted(employees.map((e) => e._corp)), [employees]);
  const divs = useMemo(() => uniqueSorted(employees.map((e) => e._div)), [employees]);
  const teams = useMemo(() => uniqueSorted(employees.map((e) => e._team)), [employees]);
  const grades = useMemo(() => uniqueSorted(employees.map((e) => e._grade)), [employees]);
  const empTypes = useMemo(() => uniqueSorted(employees.map((e) => e._emp)), [employees]);

  const filtered = employees.filter((e) => {
    if (corp !== '전체' && e._corp !== corp) return false;
    if (div !== '전체' && e._div !== div) return false;
    if (team !== '전체' && e._team !== team) return false;
    if (grade !== '전체' && e._grade !== grade) return false;
    if (empType !== '전체' && e._emp !== empType) return false;
    if (status !== '전체' && statusOf(e) !== status) return false;
    if (search && !e._name.includes(search) && !e._id.includes(search)) return false;
    return true;
  });

  const selectField = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    options: string[]
  ) => (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
    >
      <option value="전체">{label} 전체</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-600" />
          직원 명부
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">
            조회 {filtered.length}명 / 전체 {employees.length}명
          </span>
          {isHr && (
            <button
              type="button"
              onClick={() => setFormEmployeeId('new')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
              직원 추가
            </button>
          )}
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            aria-label="사번·성명 검색"
            placeholder="사번 또는 성명 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-7 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 w-48"
          />
        </div>
        {selectField('법인', corp, setCorp, corps)}
        {selectField('본부', div, setDiv, divs)}
        {selectField('팀', team, setTeam, teams)}
        {selectField('직급', grade, setGrade, grades)}
        {selectField('고용구분', empType, setEmpType, empTypes)}
        <select
          aria-label="재직상태"
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {(['전체', '재직중', '퇴직예정', '퇴직'] as const).map((s) => (
            <option key={s} value={s}>
              {s === '전체' ? '재직상태 전체' : s}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-320px)]">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0">
              <tr>
                <th className="px-3 py-2.5">사번</th>
                <th className="px-3 py-2.5">성명</th>
                <th className="px-3 py-2.5">법인</th>
                <th className="px-3 py-2.5">본부</th>
                <th className="px-3 py-2.5">팀</th>
                <th className="px-3 py-2.5">직책</th>
                <th className="px-3 py-2.5">직급</th>
                <th className="px-3 py-2.5">고용구분</th>
                <th className="px-3 py-2.5">근무지</th>
                <th className="px-3 py-2.5">입사일</th>
                <th className="px-3 py-2.5">근속</th>
                <th className="px-3 py-2.5">나이</th>
                <th className="px-3 py-2.5">성별</th>
                <th className="px-3 py-2.5">상태</th>
                {isHr && <th className="px-3 py-2.5">관리</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={15} className="px-3 py-8 text-center text-slate-400">
                    불러오는 중...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={15} className="px-3 py-8 text-center text-slate-400">
                    조회 결과가 없습니다.
                  </td>
                </tr>
              ) : (
                filtered.map((e) => (
                  <tr
                    key={e._id}
                    onClick={() => setSelectedId(e['id'] as string)}
                    className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                  >
                    <td className="px-3 py-2.5 font-mono">{e._id}</td>
                    <td className="px-3 py-2.5 font-bold text-slate-900">{e._name}</td>
                    <td className="px-3 py-2.5">{e._corp}</td>
                    <td className="px-3 py-2.5">{e._div}</td>
                    <td className="px-3 py-2.5">{e._team}</td>
                    <td className="px-3 py-2.5">{e._title}</td>
                    <td className="px-3 py-2.5">{e._grade}</td>
                    <td className="px-3 py-2.5">{e._emp}</td>
                    <td className="px-3 py-2.5">{e._site}</td>
                    <td className="px-3 py-2.5">{e._hireDate ?? '-'}</td>
                    <td className="px-3 py-2.5">{e._tenure != null ? `${e._tenure}년` : '-'}</td>
                    <td className="px-3 py-2.5">{e._age ?? '-'}</td>
                    <td className="px-3 py-2.5">{e._sex}</td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={statusOf(e)} />
                    </td>
                    {isHr && (
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              setFormEmployeeId(e['id'] as string);
                            }}
                            aria-label="수정"
                            className="p-1 rounded text-blue-600 hover:bg-blue-50"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              void handleDelete(e);
                            }}
                            aria-label="삭제"
                            className="p-1 rounded text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <EmployeeDrawer
        employeeId={selectedId}
        onClose={() => setSelectedId(null)}
        onEdit={(id) => {
          setSelectedId(null);
          setFormEmployeeId(id);
        }}
      />

      {formEmployeeId && (
        <EmployeeForm
          employeeId={formEmployeeId === 'new' ? null : formEmployeeId}
          onClose={() => setFormEmployeeId(null)}
          onSaved={() => {
            setFormEmployeeId(null);
            reload();
          }}
        />
      )}
    </div>
  );
}
