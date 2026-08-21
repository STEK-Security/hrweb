/**
 * 직원 상세 드로어. 비민감 필드는 db.getEmployee() 로 그대로 표시.
 * 민감정보(주민번호·휴대폰·급여/경비계좌·개인메일)는 hr(인사담당자/시스템관리자)만
 * get_sensitive_masked RPC 로 마스킹된 값을 보고, "보이기" 클릭 시 reveal_sensitive_field RPC 로
 * 원본을 개별 조회한다(호출마다 감사로그 기록). 그 외 역할은 섹션 자체를 숨긴다.
 */
import { useEffect, useState } from 'react';
import { X, ShieldAlert, Eye, Loader2 } from 'lucide-react';
import { getEmployee, getSensitiveMasked, revealField, type Employee } from '../../lib/db';
import { useRole } from '../../lib/auth';

interface EmployeeDrawerProps {
  employeeId: string | null;
  onClose: () => void;
}

type MaskedAcct = { bank?: string; number?: string; owner?: string } | null;
type Masked = {
  ssn?: string | null;
  salary_acct?: MaskedAcct;
  expense_acct?: MaskedAcct;
  phone?: string | null;
  email?: string | null;
} | null;

const FIELD_GROUPS: { title: string; fields: [string, string][] }[] = [
  {
    title: '기본정보',
    fields: [
      ['사번', '사번'], ['성명', '성명'], ['영문성명', '영문성명'], ['닉네임', '닉네임'],
      ['성별', '성별'], ['생년월일', '생년월일'], ['나이(만)', '나이(만)'],
      ['결혼여부', '결혼여부'], ['음양구분', '음양구분'], ['생일', '생일'],
    ],
  },
  {
    title: '조직정보',
    fields: [
      ['법인', '법인'], ['소속', '소속'], ['전체소속명', '전체소속명'],
      ['직책', '직책'], ['직급', '직급'], ['고용구분', '고용구분'], ['근무지', '근무지'], ['발령명', '발령명'],
    ],
  },
  {
    title: '입퇴사',
    fields: [
      ['입사일', '입사일'], ['그룹입사일', '그룹입사일'], ['퇴직일', '퇴직일'], ['퇴직사유', '퇴직사유'],
      ['근속연수(그룹입사일)', '근속연수(그룹입사일)'], ['근속연수(입사일)', '근속연수(입사일)'],
      ['입사경로', '입사경로'], ['추천인', '추천인'],
      ['인정경력(년)', '인정경력(년)'], ['인정경력(월)', '인정경력(월)'],
    ],
  },
  {
    title: '학력',
    fields: [['학력', '학력'], ['학교', '학교'], ['학위', '학위'], ['전공', '전공']],
  },
  {
    title: '병역·기타',
    fields: [
      ['역종', '역종'], ['군별', '군별'], ['계급', '계급'],
      ['병역특례여부', '병역특례여부'], ['장애여부', '장애여부'], ['보훈대상자', '보훈대상자'],
    ],
  },
  {
    title: '국적·체류',
    fields: [
      ['국적', '국적'], ['내/외국인', '내/외국인'], ['거주지국', '거주지국'],
      ['체류자격', '체류자격'], ['체류시작일', '체류시작일'], ['체류종료일', '체류종료일'],
    ],
  },
  {
    title: '기타 기준일',
    fields: [
      ['근태기준일', '근태기준일'], ['퇴직기준일', '퇴직기준일'], ['최종이동일', '최종이동일'],
      ['최종보임일', '최종보임일'], ['직무변경일', '직무변경일'], ['직종전환일', '직종전환일'],
      ['계약시작일', '계약시작일'], ['계약종료일', '계약종료일'], ['수습종료일', '수습종료일'],
    ],
  },
];

const HR_ROLES = new Set(['시스템관리자', '인사담당자']);

function Field({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <span className="text-[11px] text-slate-500 block">{label}</span>
      <span className="text-sm font-semibold text-slate-800">
        {value === null || value === undefined || value === '' ? '-' : String(value)}
      </span>
    </div>
  );
}

function RevealButton({ onClick, revealing }: { onClick: () => void; revealing: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={revealing}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-blue-200 bg-blue-50 text-blue-700 text-[10px] font-bold hover:bg-blue-100 disabled:opacity-50"
    >
      {revealing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />}
      보이기
    </button>
  );
}

export function EmployeeDrawer({ employeeId, onClose }: EmployeeDrawerProps) {
  const role = useRole();
  const isHr = !!role && HR_ROLES.has(role);

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(false);
  const [masked, setMasked] = useState<Masked>(null);
  const [maskedLoading, setMaskedLoading] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, string | null>>({});
  const [revealing, setRevealing] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!employeeId) return;
    let cancelled = false;
    setLoading(true);
    setMasked(null);
    setRevealed({});
    getEmployee(employeeId).then((e) => {
      if (!cancelled) {
        setEmployee(e);
        setLoading(false);
      }
    });
    if (isHr) {
      setMaskedLoading(true);
      getSensitiveMasked(employeeId).then((m) => {
        if (!cancelled) {
          setMasked((m as Masked) ?? null);
          setMaskedLoading(false);
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, [employeeId, isHr]);

  if (!employeeId) return null;

  const handleReveal = async (field: 'phone' | 'salary_acct' | 'expense_acct' | 'ssn') => {
    setRevealing((r) => ({ ...r, [field]: true }));
    const value = await revealField(employeeId, field);
    setRevealed((r) => ({ ...r, [field]: value }));
    setRevealing((r) => ({ ...r, [field]: false }));
  };

  const parseAcct = (raw: string | null): MaskedAcct => {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return { number: raw };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white h-full w-full sm:max-w-lg shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50 sticky top-0 z-10">
          <div>
            <h3 className="text-base font-bold text-slate-900">{employee?._name ?? '직원 상세'}</h3>
            <p className="text-xs text-slate-500">
              {employee ? `사번 ${employee._id} · ${employee._team}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 text-sm">
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-xs">불러오는 중...</div>
          ) : !employee ? (
            <div className="py-12 text-center text-slate-400 text-xs">직원 정보를 불러올 수 없습니다.</div>
          ) : (
            <>
              {FIELD_GROUPS.map((group) => (
                <div key={group.title} className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <h4 className="text-xs font-bold text-slate-700 mb-3">{group.title}</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {group.fields.map(([label, key]) => (
                      <div key={key}>
                        <Field label={label} value={(employee as unknown as Record<string, unknown>)[key]} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* 민감정보 섹션 */}
              <div className="bg-rose-50/50 p-4 rounded-xl border border-rose-200">
                <div className="flex items-center gap-1.5 mb-3">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  <h4 className="text-xs font-bold text-rose-800">민감정보</h4>
                </div>

                {!isHr ? (
                  <p className="text-xs text-rose-700 font-semibold">인사팀만 조회 가능합니다.</p>
                ) : maskedLoading ? (
                  <p className="text-xs text-slate-400">불러오는 중...</p>
                ) : !masked ? (
                  <p className="text-xs text-slate-400">민감정보를 불러올 수 없습니다.</p>
                ) : (
                  <div className="space-y-3">
                    <Field label="개인메일" value={masked.email} />

                    <div>
                      <span className="text-[11px] text-slate-500 block mb-0.5">주민번호</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-800 font-mono">
                          {revealed.ssn ?? masked.ssn ?? '-'}
                        </span>
                        {masked.ssn && !revealed.ssn && (
                          <RevealButton onClick={() => handleReveal('ssn')} revealing={!!revealing.ssn} />
                        )}
                      </div>
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-500 block mb-0.5">휴대폰</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-800 font-mono">
                          {revealed.phone ?? masked.phone ?? '-'}
                        </span>
                        {masked.phone && !revealed.phone && (
                          <RevealButton onClick={() => handleReveal('phone')} revealing={!!revealing.phone} />
                        )}
                      </div>
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-500 block mb-0.5">급여계좌</span>
                      {revealed.salary_acct ? (
                        (() => {
                          const acct = parseAcct(revealed.salary_acct);
                          return (
                            <span className="text-sm font-semibold text-slate-800">
                              {acct?.bank ?? ''} {acct?.number ?? ''} ({acct?.owner ?? '-'})
                            </span>
                          );
                        })()
                      ) : masked.salary_acct ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-800">
                            {masked.salary_acct.bank} {masked.salary_acct.number} ({masked.salary_acct.owner})
                          </span>
                          <RevealButton onClick={() => handleReveal('salary_acct')} revealing={!!revealing.salary_acct} />
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400">-</span>
                      )}
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-500 block mb-0.5">경비계좌</span>
                      {revealed.expense_acct ? (
                        (() => {
                          const acct = parseAcct(revealed.expense_acct);
                          return (
                            <span className="text-sm font-semibold text-slate-800">
                              {acct?.bank ?? ''} {acct?.number ?? ''} ({acct?.owner ?? '-'})
                            </span>
                          );
                        })()
                      ) : masked.expense_acct ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-800">
                            {masked.expense_acct.bank} {masked.expense_acct.number} ({masked.expense_acct.owner})
                          </span>
                          <RevealButton onClick={() => handleReveal('expense_acct')} revealing={!!revealing.expense_acct} />
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400">-</span>
                      )}
                    </div>

                    <p className="text-[10px] text-rose-600/80 pt-1 border-t border-rose-200/70">
                      "보이기" 클릭 시 열람 이력이 감사로그에 기록됩니다.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
