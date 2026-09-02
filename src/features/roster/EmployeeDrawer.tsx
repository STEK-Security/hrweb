/**
 * 직원 상세 드로어. 비민감 필드는 db.getEmployee() 로 그대로 표시.
 * 민감정보(주민번호·휴대폰·급여/경비계좌·개인메일)는 hr(인사담당자/시스템관리자)만
 * get_sensitive_masked RPC 로 마스킹된 값을 보고, "보이기" 클릭 시 reveal_sensitive_field RPC 로
 * 원본을 개별 조회한다(호출마다 감사로그 기록). 그 외 역할은 섹션 자체를 숨긴다.
 */
import { useEffect, useState } from 'react';
import { X, ShieldAlert, Eye, Loader2, Pencil } from 'lucide-react';
import { getEmployee, getSensitiveMasked, revealField, type Employee } from '../../lib/db';
import { useRole } from '../../lib/auth';
import { logEvent } from '../../lib/audit';

interface EmployeeDrawerProps {
  employeeId: string | null;
  onClose: () => void;
  /** 있으면 "수정" 버튼을 보여준다(hr 만). EmployeeForm 을 여는 콜백. */
  onEdit?: (id: string) => void;
}

type MaskedAcct = { bank?: string; number?: string; owner?: string } | null;
type MaskedAddr = { postal?: string; address?: string } | null;
type Masked = Record<string, unknown> | null;

/**
 * get_sensitive_masked(0005) 가 돌려주는 8항목 전부. 예전엔 이 중 5개만 화면에 있었고
 * 비상연락망·현주소·등본주소는 서버가 보내는데도 렌더되지 않아 아예 볼 수 없었다.
 * reveal 화이트리스트(0005 reveal_sensitive_field)는 email 을 제외한 7개다 —
 * 개인메일은 정책상 처음부터 평문으로 내려온다.
 */
export type SensitiveKind = 'text' | 'acct' | 'addr';
const SENSITIVE_ROWS: { key: string; label: string; kind: SensitiveKind; revealable: boolean }[] = [
  { key: 'email', label: '개인메일', kind: 'text', revealable: false },
  { key: 'ssn', label: '주민번호', kind: 'text', revealable: true },
  { key: 'phone', label: '휴대폰', kind: 'text', revealable: true },
  { key: 'emergency', label: '비상연락망', kind: 'text', revealable: true },
  { key: 'salary_acct', label: '급여계좌', kind: 'acct', revealable: true },
  { key: 'expense_acct', label: '경비계좌', kind: 'acct', revealable: true },
  { key: 'addr', label: '현주소', kind: 'addr', revealable: true },
  { key: 'reg_addr', label: '등본주소', kind: 'addr', revealable: true },
];

const fmtAcct = (a: MaskedAcct): string =>
  a ? [a.bank, a.number, a.owner ? `(${a.owner})` : null].filter(Boolean).join(' ') : '';
const fmtAddr = (a: MaskedAddr): string =>
  a ? [a.postal ? `(${a.postal})` : null, a.address].filter(Boolean).join(' ') : '';

/**
 * 민감값 표기. 마스킹 조회(get_sensitive_masked)는 객체로 오고, "보이기"(reveal_sensitive_field)
 * 원본은 계좌/주소가 JSON 문자열로 온다. 두 경로를 같은 규칙으로 찍기 위해 한 곳에 둔다.
 * EmployeeForm 의 "현재 저장값" 표시도 이 함수를 쓴다.
 */
export const formatSensitiveValue = (kind: SensitiveKind, value: unknown): string => {
  if (value == null || value === '') return '';
  if (kind === 'text') return String(value);
  const obj =
    typeof value === 'string'
      ? (() => {
          try {
            return JSON.parse(value) as Record<string, string>;
          } catch {
            return null;
          }
        })()
      : (value as Record<string, string>);
  if (!obj) return String(value);
  return kind === 'acct' ? fmtAcct(obj as MaskedAcct) : fmtAddr(obj as MaskedAddr);
};

export const FIELD_GROUPS: { title: string; fields: [string, string][] }[] = [
  {
    title: '기본정보',
    fields: [
      ['사번', '사번'], ['그룹사원번호', '그룹사원번호'],
      // 그룹ID(그룹웨어 계정 = 그룹 메일주소). 전 시스템의 메일 발송 기준값이라 명부에 반드시 뜬다.
      // 개인메일(민감값, employee_sensitive)과 다른 값이다.
      ['그룹ID', '그룹웨어ID'],
      ['성명', '성명'], ['영문성명', '영문성명'], ['닉네임', '닉네임'],
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

export const HR_ROLES = new Set(['사용자', '관리자']);

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

export function EmployeeDrawer({ employeeId, onClose, onEdit }: EmployeeDrawerProps) {
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
    logEvent('view_employee', { targetId: employeeId, targetTable: 'employees' });
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

  const handleReveal = async (field: string) => {
    setRevealing((r) => ({ ...r, [field]: true }));
    const value = await revealField(employeeId, field);
    setRevealed((r) => ({ ...r, [field]: value }));
    setRevealing((r) => ({ ...r, [field]: false }));
    // 서버 reveal_sensitive_field RPC 가 이미 audit_log 에 기록하므로 여기서 다시 로깅하지 않는다(이중로깅 방지).
  };

  const fmt = formatSensitiveValue;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="employee-drawer-title"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="bg-white h-full w-full sm:max-w-lg shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50 sticky top-0 z-10">
          <div>
            <h3 id="employee-drawer-title" className="text-base font-bold text-slate-900">
              {employee?._name ?? '직원 상세'}
            </h3>
            <p className="text-xs text-slate-500">
              {employee ? `사번 ${employee._id} · ${employee._team}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {isHr && onEdit && (
              <button
                type="button"
                onClick={() => onEdit(employeeId)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
                수정
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
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
                  <p className="text-xs text-rose-700 font-semibold">
                    민감정보를 불러오지 못했습니다. 권한·네트워크를 확인하세요.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {SENSITIVE_ROWS.map((row) => {
                      const shown = fmt(row.kind, revealed[row.key] ?? masked[row.key]);
                      const hasValue = !!fmt(row.kind, masked[row.key]);
                      return (
                        <div key={row.key}>
                          <span className="text-[11px] text-slate-500 block mb-0.5">{row.label}</span>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-sm font-semibold ${
                                shown ? 'text-slate-800' : 'text-slate-400'
                              } ${row.kind === 'text' ? 'font-mono' : ''}`}
                            >
                              {shown || '-'}
                            </span>
                            {row.revealable && hasValue && revealed[row.key] == null && (
                              <RevealButton
                                onClick={() => handleReveal(row.key)}
                                revealing={!!revealing[row.key]}
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}

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
