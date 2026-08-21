/**
 * 증명서 발급(재직/경력) — employees 데이터만으로 미리보기를 만들고 window.print() 로 인쇄한다.
 * 발급 시 logEvent('issue_certificate', {targetId, meta:{type}}) 기록.
 */
import { useEffect, useMemo, useState } from 'react';
import { FileCheck2, Search, Printer } from 'lucide-react';
import { listEmployees, type Employee } from '../../lib/db';
import { today, localISO } from '../../excel/derive';
import { logEvent } from '../../lib/audit';

type CertType = '재직증명서' | '경력증명서';

const COMPANY_NAME = 'STEK';

export function CertificatePage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [certType, setCertType] = useState<CertType>('재직증명서');
  const [purpose, setPurpose] = useState('제출용');
  const [issued, setIssued] = useState(false);

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

  const results = useMemo(() => {
    if (!search) return [];
    return employees.filter((e) => e._name.includes(search) || e._id.includes(search)).slice(0, 20);
  }, [employees, search]);

  const selected = employees.find((e) => (e['id'] as string) === selectedId) ?? null;
  const issueDate = localISO(today());

  const handleIssue = async () => {
    if (!selected) return;
    await logEvent('issue_certificate', {
      targetId: selected['id'] as string,
      targetTable: 'employees',
      meta: { type: certType },
    });
    setIssued(true);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-24 text-sm text-slate-500">불러오는 중...</div>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 print:hidden">
        <FileCheck2 className="w-5 h-5 text-blue-600" />
        증명서 발급
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* 좌측: 직원 선택 + 옵션 */}
        <div className="lg:col-span-4 space-y-4 print:hidden">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                aria-label="사번·성명 검색"
                placeholder="사번 또는 성명 검색"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setIssued(false);
                }}
                className="w-full pl-7 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            {search && (
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-56 overflow-y-auto">
                {results.length === 0 ? (
                  <div className="px-3 py-3 text-xs text-slate-400">검색 결과가 없습니다.</div>
                ) : (
                  results.map((e) => (
                    <button
                      key={e['id'] as string}
                      type="button"
                      onClick={() => {
                        setSelectedId(e['id'] as string);
                        setSearch('');
                        setIssued(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 transition-colors"
                    >
                      <span className="font-bold text-slate-900">{e._name}</span>{' '}
                      <span className="text-slate-500">{e._id} · {e._team}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <div>
              <span className="text-xs font-bold text-slate-700 block mb-1.5">증명서 종류</span>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold w-fit">
                {(['재직증명서', '경력증명서'] as CertType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setCertType(t);
                      setIssued(false);
                    }}
                    className={`px-3 py-1.5 rounded-md transition-colors ${
                      certType === t ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5" htmlFor="cert-purpose">용도</label>
              <input
                id="cert-purpose"
                type="text"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <button
              type="button"
              disabled={!selected}
              onClick={() => window.print()}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              인쇄
            </button>
            <button
              type="button"
              disabled={!selected}
              onClick={handleIssue}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
            >
              발급 확정(감사로그 기록)
            </button>
            {issued && <p className="text-[11px] text-emerald-600 text-center">발급 이력이 기록되었습니다.</p>}
          </div>
        </div>

        {/* 우측: 미리보기(인쇄영역) */}
        <div className="lg:col-span-8">
          <div className="bg-white p-10 rounded-xl border border-slate-200 shadow-xs min-h-[600px] print:border-0 print:shadow-none print:rounded-none">
            {!selected ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-400 py-24">
                좌측에서 직원을 검색해 선택하세요.
              </div>
            ) : (
              <div className="max-w-2xl mx-auto space-y-8 text-slate-900">
                <h1 className="text-2xl font-black text-center tracking-widest">{certType}</h1>

                <table className="w-full text-sm border-t border-b border-slate-300">
                  <tbody>
                    <tr className="border-b border-slate-200">
                      <td className="py-2.5 px-3 bg-slate-50 font-bold w-32">성명</td>
                      <td className="py-2.5 px-3">{selected._name}</td>
                      <td className="py-2.5 px-3 bg-slate-50 font-bold w-32">사번</td>
                      <td className="py-2.5 px-3">{selected._id}</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="py-2.5 px-3 bg-slate-50 font-bold">부서</td>
                      <td className="py-2.5 px-3">{selected._team}</td>
                      <td className="py-2.5 px-3 bg-slate-50 font-bold">직급/직책</td>
                      <td className="py-2.5 px-3">{selected._grade} / {selected._title}</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="py-2.5 px-3 bg-slate-50 font-bold">입사일</td>
                      <td className="py-2.5 px-3">{selected._hireDate ?? '-'}</td>
                      <td className="py-2.5 px-3 bg-slate-50 font-bold">근속기간</td>
                      <td className="py-2.5 px-3">{selected._tenure != null ? `${selected._tenure}년` : '-'}</td>
                    </tr>
                    {certType === '재직증명서' && (
                      <tr className="border-b border-slate-200">
                        <td className="py-2.5 px-3 bg-slate-50 font-bold">재직 상태</td>
                        <td className="py-2.5 px-3" colSpan={3}>{selected._activeNow ? '재직중' : '퇴직'}</td>
                      </tr>
                    )}
                    {certType === '경력증명서' && (
                      <tr className="border-b border-slate-200">
                        <td className="py-2.5 px-3 bg-slate-50 font-bold">퇴직일</td>
                        <td className="py-2.5 px-3" colSpan={3}>{selected._quitDate ?? '재직중'}</td>
                      </tr>
                    )}
                  </tbody>
                </table>

                <p className="text-sm leading-relaxed text-center">
                  위 사람은 {COMPANY_NAME}에 {certType === '재직증명서' ? '재직중임을' : '근무하였음을'} 증명합니다.
                  <br />
                  용도: {purpose || '제출용'}
                </p>

                <div className="text-center text-sm space-y-1">
                  <p>{issueDate}</p>
                  <p className="font-bold text-base">{COMPANY_NAME}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
