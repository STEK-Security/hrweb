/**
 * 직원 명부 — db.listEmployees() 조회 + 필터 + 컬럼 선택.
 *
 * 표에 뿌릴 수 있는 컬럼은 employees 의 비민감 55컬럼(= EmployeeDrawer 의 FIELD_GROUPS,
 * 단일 출처) + derive.ts 가 만든 자동분류 컬럼이다. 기본은 자주 보는 15개만 켜두고
 * "컬럼" 버튼에서 나머지를 전부 켤 수 있다(선택은 localStorage 에 유지).
 * 민감컬럼(주민번호·계좌·주소·연락처·개인메일)은 애초에 employees 에 없다 —
 * employee_sensitive + 마스킹 RPC 경로(상세 드로어)로만 본다.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Search, Users, UserPlus, Pencil, Trash2, Columns3, RotateCcw } from 'lucide-react';
import { listEmployees, softDeleteEmployee, getOrgSetting, excludedCount, type Employee } from '../../lib/db';
import { isRealOrg } from '../../excel/derive';
import { useRole } from '../../lib/auth';
import { logEvent } from '../../lib/audit';
import { EmployeeDrawer, FIELD_GROUPS, HR_ROLES } from './EmployeeDrawer';
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

/* ---------------- 컬럼 정의 ---------------- */

interface Col {
  key: string;
  label: string;
  /** 없으면 employees 원본 컬럼값을 그대로 찍는다 */
  render?: (e: Employee) => ReactNode;
}

/**
 * derive.ts 가 계산하는 분류값. 상단 필터(법인/본부/팀)가 원본 컬럼이 아니라 이 값들을
 * 기준으로 동작하므로, 표도 같은 값을 보여줘야 필터 결과와 표가 어긋나지 않는다.
 */
const DERIVED_COLS: Col[] = [
  { key: '_corp', label: '법인(분류)', render: (e) => e._corp },
  { key: '_div', label: '본부', render: (e) => e._div },
  { key: '_team', label: '팀', render: (e) => e._team },
  { key: '_tenure', label: '근속', render: (e) => (e._tenure != null ? `${e._tenure}년` : '-') },
  { key: '_tenureBand', label: '근속구간', render: (e) => e._tenureBand },
  { key: '_ageBand', label: '연령대', render: (e) => e._ageBand },
  { key: '_office', label: '직군', render: (e) => e._office },
  { key: '_status', label: '재직상태', render: (e) => <StatusBadge status={statusOf(e)} /> },
];

const COL_GROUPS: { title: string; cols: Col[] }[] = [
  ...FIELD_GROUPS.map((g) => ({
    title: g.title,
    cols: g.fields.map(([label, key]) => ({ key, label })),
  })),
  { title: '자동분류', cols: DERIVED_COLS },
];
const ALL_COLS: Col[] = COL_GROUPS.flatMap((g) => g.cols);
const COL_BY_KEY = new Map(ALL_COLS.map((c) => [c.key, c]));

/** 기본 표시 컬럼(순서 그대로 렌더). 나머지는 "컬럼" 버튼으로 켠다. */
const DEFAULT_COLS = [
  '사번', '성명', '그룹웨어ID', '_corp', '_div', '_team', '직책', '직급',
  '고용구분', '근무지', '입사일', '_tenure', '나이(만)', '성별', '_status',
];
const STORAGE_KEY = 'roster.visibleCols.v1';

const loadCols = (): string[] => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_COLS;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return DEFAULT_COLS;
    // 컬럼이 개편돼 사라진 키는 버린다. 전부 사라졌으면 기본값으로 되돌린다.
    const kept = parsed.filter((k): k is string => typeof k === 'string' && COL_BY_KEY.has(k));
    return kept.length ? kept : DEFAULT_COLS;
  } catch {
    return DEFAULT_COLS;
  }
};

const cellText = (e: Employee, key: string): string => {
  const v = (e as unknown as Record<string, unknown>)[key];
  return v === null || v === undefined || v === '' ? '-' : String(v);
};

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
  const [inputEnabled, setInputEnabled] = useState(true);
  const [visibleKeys, setVisibleKeys] = useState<string[]>(loadCols);
  /** derive.ts 제외규칙(테스트/GPRO)으로 걸러진 행 수 — 조용히 사라지지 않게 표시한다. */
  const [excluded, setExcluded] = useState(0);

  useEffect(() => {
    getOrgSetting('employee_input_enabled').then(setInputEnabled);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(visibleKeys));
    } catch {
      /* 시크릿 모드 등에서 저장 실패해도 화면은 그대로 동작한다 */
    }
  }, [visibleKeys]);

  const reload = () => {
    setLoading(true);
    listEmployees().then((data) => {
      setEmployees(data);
      setExcluded(excludedCount());
      setLoading(false);
    });
  };

  useEffect(() => {
    let cancelled = false;
    listEmployees().then((data) => {
      if (cancelled) return;
      setEmployees(data);
      setExcluded(excludedCount());
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
    if (search) {
      const q = search.trim().toLowerCase();
      const hit =
        e._name.toLowerCase().includes(q) ||
        e._id.toLowerCase().includes(q) ||
        String(e['그룹웨어ID'] ?? '').toLowerCase().includes(q);
      if (!hit) return false;
    }
    return true;
  });

  const cols = useMemo(
    () => visibleKeys.map((k) => COL_BY_KEY.get(k)).filter((c): c is Col => !!c),
    [visibleKeys]
  );
  const colCount = cols.length + (isHr ? 1 : 0);

  const toggleCol = (key: string) =>
    setVisibleKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

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
            조회 {filtered.length}명 / 전체 {employees.length}명 · 컬럼 {cols.length}/{ALL_COLS.length}
            {excluded > 0 && (
              <span
                className="ml-1 text-amber-600 font-semibold"
                title="성명·소속·그룹ID 등에 '테스트'/'GPRO' 가 들어간 행은 집계에서 제외됩니다."
              >
                · 제외 {excluded}명
              </span>
            )}
          </span>
          {isHr && inputEnabled && (
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
            aria-label="사번·성명·그룹ID 검색"
            placeholder="사번 / 성명 / 그룹ID 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-7 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 w-52"
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

        {/* ponytail: 바깥 클릭 닫기 로직 대신 네이티브 <details> — 브라우저가 이미 해준다 */}
        <details className="relative ml-auto">
          <summary className="list-none cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700">
            <Columns3 className="w-3.5 h-3.5" />
            컬럼 {cols.length}/{ALL_COLS.length}
          </summary>
          <div className="absolute right-0 top-full mt-1 z-30 w-[min(90vw,720px)] max-h-[60vh] overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-2xl p-4">
            <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-700 flex-1">표시할 컬럼</span>
              <button
                type="button"
                onClick={() => setVisibleKeys(ALL_COLS.map((c) => c.key))}
                className="px-2 py-1 rounded bg-blue-50 text-blue-700 text-[11px] font-bold hover:bg-blue-100"
              >
                전체 선택
              </button>
              <button
                type="button"
                onClick={() => setVisibleKeys(DEFAULT_COLS)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 text-slate-600 text-[11px] font-bold hover:bg-slate-200"
              >
                <RotateCcw className="w-3 h-3" />
                기본값
              </button>
            </div>
            <div className="space-y-3">
              {COL_GROUPS.map((g) => (
                <div key={g.title}>
                  <div className="text-[11px] font-bold text-slate-500 mb-1.5">{g.title}</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1">
                    {g.cols.map((c) => (
                      <label
                        key={c.key}
                        className="flex items-center gap-1.5 text-[11px] text-slate-700 cursor-pointer hover:text-blue-700"
                      >
                        <input
                          type="checkbox"
                          checked={visibleKeys.includes(c.key)}
                          onChange={() => toggleCol(c.key)}
                          className="accent-blue-600"
                        />
                        <span className="truncate">{c.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </details>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-320px)]">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-10">
              <tr>
                {cols.map((c) => (
                  <th key={c.key} className="px-3 py-2.5 whitespace-nowrap">
                    {c.label}
                  </th>
                ))}
                {isHr && <th className="px-3 py-2.5">관리</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={colCount} className="px-3 py-8 text-center text-slate-400">
                    불러오는 중...
                  </td>
                </tr>
              ) : cols.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="px-3 py-8 text-center text-slate-400">
                    표시할 컬럼이 없습니다. "컬럼"에서 선택하세요.
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="px-3 py-8 text-center text-slate-400">
                    조회 결과가 없습니다.
                  </td>
                </tr>
              ) : (
                filtered.map((e) => (
                  <tr
                    key={e['id'] as string}
                    tabIndex={0}
                    aria-label={`${e._name} 상세 보기`}
                    onClick={() => setSelectedId(e['id'] as string)}
                    onKeyDown={(ev) => {
                      if (ev.key === 'Enter' || ev.key === ' ') {
                        ev.preventDefault();
                        setSelectedId(e['id'] as string);
                      }
                    }}
                    className="hover:bg-blue-50/40 focus:bg-blue-50 focus:outline-2 focus:outline-blue-500 cursor-pointer transition-colors"
                  >
                    {cols.map((c) => (
                      <td
                        key={c.key}
                        className={`px-3 py-2.5 whitespace-nowrap ${
                          c.key === '사번' ? 'font-mono' : c.key === '성명' ? 'font-bold text-slate-900' : ''
                        }`}
                      >
                        {c.render ? c.render(e) : cellText(e, c.key)}
                      </td>
                    ))}
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
