/**
 * 채용 대시보드 카드. 본부/팀별 채용 현황을 수기 입력(hr_recruitment_plan)하고,
 * tfoot 합계는 화면에서 reduce 로 자동 계산한다.
 */
import { useEffect, useState } from 'react';
import { Plus, Trash2, Users, Save, CheckCircle2, AlertCircle, Edit3, Loader2 } from 'lucide-react';
import { listRecruitmentPlan, saveRecruitmentPlan, type RecruitmentPlanRow } from '../lib/db';
import { DashboardNotesPanel } from './DashboardNotesPanel';

interface Props {
  period: string;
}

type CountField =
  | 'current_count'
  | 'retire_planned_count'
  | 'recruit_planned_count'
  | 'document_passed_count'
  | 'interview_count'
  | 'final_passed_count';

/** 열 정의: 헤더/입력/합계 스타일을 한 곳에서 관리 */
const COUNT_COLS: { field: CountField; label: string; th: string; input: string; cell: string; foot: string }[] = [
  {
    field: 'current_count',
    label: '현재 인원수',
    th: '',
    input: 'border-slate-300 focus:bg-indigo-50/50 focus:border-indigo-500 focus:ring-indigo-400 font-semibold text-slate-700',
    cell: 'font-semibold text-slate-700',
    foot: 'font-bold text-slate-800',
  },
  {
    field: 'retire_planned_count',
    label: '퇴직(예정)',
    th: 'text-rose-700',
    input: 'border-slate-300 focus:bg-rose-50/60 focus:border-rose-400 focus:ring-rose-300 font-semibold text-rose-600',
    cell: 'font-semibold text-rose-600',
    foot: 'font-bold text-rose-600',
  },
  {
    field: 'recruit_planned_count',
    label: '충원예정',
    th: 'text-blue-700 font-bold',
    input: 'border-blue-300 focus:bg-blue-50/60 focus:border-blue-500 focus:ring-blue-400 font-bold text-blue-700',
    cell: 'font-bold text-blue-700',
    foot: 'font-black text-blue-700 bg-blue-50/60',
  },
  {
    field: 'document_passed_count',
    label: '서류합격',
    th: '',
    input: 'border-slate-300 focus:bg-indigo-50/50 focus:border-indigo-500 focus:ring-indigo-400 font-semibold text-slate-700',
    cell: 'font-semibold text-slate-700',
    foot: 'font-bold text-slate-800',
  },
  {
    field: 'interview_count',
    label: '면접',
    th: '',
    input: 'border-slate-300 focus:bg-indigo-50/50 focus:border-indigo-500 focus:ring-indigo-400 font-semibold text-slate-700',
    cell: 'font-semibold text-slate-700',
    foot: 'font-bold text-slate-800',
  },
  {
    field: 'final_passed_count',
    label: '최종합격',
    th: 'text-emerald-700 font-bold',
    input: 'border-emerald-300 focus:bg-emerald-50/60 focus:border-emerald-500 focus:ring-emerald-400 font-bold text-emerald-700',
    cell: 'font-bold text-emerald-700',
    foot: 'font-black text-emerald-700 bg-emerald-50/60',
  },
];

const TEXT_INPUT_CLS =
  'w-full py-1 px-2 bg-white hover:bg-slate-50 focus:bg-indigo-50/50 rounded border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-400 font-medium text-slate-800 text-xs transition-colors outline-none';

export function RecruitmentDashboard({ period }: Props) {
  const [rows, setRows] = useState<RecruitmentPlanRow[] | null>(null); // null = 로딩 중
  /** 수정 중인 대상 월. null = 조회 모드. 상위 기준일이 바뀌어도 이 값이 저장 대상이다. */
  const [editPeriod, setEditPeriod] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<'ok' | 'fail' | null>(null);
  const isEditing = editPeriod !== null;
  const stale = editPeriod !== null && editPeriod !== period;

  useEffect(() => {
    // 수정 중에는 재로드하지 않는다 — 상위 기준일이 바뀔 때 입력 중이던 행이
    // 말없이 사라지던 문제(저장 대상은 editPeriod 로 고정하고 경고 배너로 알린다).
    if (editPeriod !== null) return;
    let alive = true;
    setRows(null);
    setNotice(null);
    void listRecruitmentPlan(period).then((r) => alive && setRows([...r].sort((a, b) => a.sort_order - b.sort_order)));
    return () => {
      alive = false;
    };
  }, [period, editPeriod]);

  const patch = (id: string, p: Partial<RecruitmentPlanRow>) =>
    setRows((prev) => prev && prev.map((r) => (r.id === id ? { ...r, ...p } : r)));

  const handleAddRow = () =>
    setRows((prev) => [
      ...(prev ?? []),
      {
        id: crypto.randomUUID(),
        division: '',
        team: '',
        current_count: 0,
        retire_planned_count: 0,
        recruit_planned_count: 1,
        document_passed_count: 0,
        interview_count: 0,
        final_passed_count: 0,
        sort_order: (prev?.length ?? 0) + 1,
      },
    ]);

  const handleSave = async () => {
    if (!rows) return;
    setSaving(true);
    setNotice(null);
    const ok = await saveRecruitmentPlan(editPeriod ?? period, rows.map((r, i) => ({ ...r, sort_order: i + 1 })));
    setSaving(false);
    setNotice(ok ? 'ok' : 'fail');
    if (ok) {
      setEditPeriod(null);
      setTimeout(() => setNotice((n) => (n === 'ok' ? null : n)), 2000);
    }
  };

  const list = rows ?? [];
  const totals = COUNT_COLS.map((c) => list.reduce((acc, r) => acc + (Number(r[c.field]) || 0), 0));
  const colCount = 2 + COUNT_COLS.length + (isEditing ? 1 : 0);

  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-4 bg-indigo-600 rounded-full"></span>
          <h3 className="text-sm font-bold text-slate-900 tracking-tight">채용 대시보드</h3>
          <span className="text-[11px] text-slate-400 font-mono">{period}</span>
          {isEditing ? (
            <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
              수정 모드
            </span>
          ) : (
            <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">조회 모드</span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {notice === 'ok' && (
            <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold animate-pulse mr-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              저장되었습니다
            </span>
          )}
          {notice === 'fail' && (
            <span className="flex items-center gap-1 text-[11px] text-rose-600 font-semibold mr-1" role="alert">
              <AlertCircle className="w-3.5 h-3.5" />
              저장 실패 — 다시 시도해 주세요
            </span>
          )}
          {isEditing && (
            <button
              type="button"
              onClick={handleAddRow}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded-lg font-semibold transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
              title="새로운 채용 계획 행 추가"
            >
              <Plus className="w-3.5 h-3.5" />
              행 추가
            </button>
          )}
          {isEditing && (
            <button
              type="button"
              onClick={() => setEditPeriod(null)}
              disabled={saving}
              className="px-3 py-1.5 text-xs rounded-lg font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer disabled:opacity-50"
              title="수정 내용을 버리고 조회 모드로 돌아간다"
            >
              취소
            </button>
          )}
          <button
            type="button"
            onClick={() => setEditPeriod(period)}
            disabled={isEditing || rows === null}
            className={`px-3 py-1.5 text-xs rounded-lg font-semibold transition-colors flex items-center gap-1.5 ${
              isEditing || rows === null
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200 cursor-pointer'
            }`}
            title="채용 대시보드 수치 수정"
          >
            <Edit3 className="w-3.5 h-3.5" />
            수정
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!isEditing || saving}
            className={`px-3 py-1.5 text-xs rounded-lg font-semibold transition-all flex items-center gap-1.5 shadow-2xs ${
              isEditing
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white ring-2 ring-indigo-300 ring-offset-1 cursor-pointer disabled:opacity-60'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
            title="수정 내용 저장"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            저장
          </button>
        </div>
      </div>

      {stale && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-300 text-[11px] text-amber-900" role="alert">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>
            기준일이 바뀌었지만 <b className="font-mono">{editPeriod}</b> 를 수정 중입니다. [저장] 하면{' '}
            <b className="font-mono">{editPeriod}</b> 에 반영되고, [취소] 하면 <b className="font-mono">{period}</b> 를 불러옵니다.
          </span>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-xs text-left text-slate-700 border-collapse min-w-[700px]">
          <thead>
            <tr className="bg-slate-50/90 text-slate-800 font-semibold border-b border-slate-200">
              <th scope="col" className="py-2.5 px-3.5 w-36 font-bold">본부</th>
              <th scope="col" className="py-2.5 px-3.5 w-36 font-bold">팀</th>
              {COUNT_COLS.map((c) => (
                <th key={c.field} scope="col" className={`py-2.5 px-3 text-center w-24 ${c.th}`}>
                  {c.label}
                </th>
              ))}
              {isEditing && <th scope="col" className="py-2.5 px-2 text-center w-12 font-bold">삭제</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows === null ? (
              <tr>
                <td colSpan={colCount} className="py-10 text-center text-slate-400">
                  <span className="inline-flex items-center gap-1.5">
                    <Loader2 className="w-4 h-4 animate-spin" /> 불러오는 중…
                  </span>
                </td>
              </tr>
            ) : list.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="py-8 text-center text-slate-400 text-xs">
                  등록된 채용 현황 데이터가 없습니다. 상단 [수정]을 누른 후 [+ 행 추가] 버튼으로 채용 계획을 등록하세요.
                </td>
              </tr>
            ) : (
              list.map((row, idx) => (
                <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-2 px-3.5">
                    {isEditing ? (
                      <input
                        type="text"
                        value={row.division}
                        placeholder="예: 연구개발본부"
                        onChange={(e) => patch(row.id, { division: e.target.value })}
                        aria-label={`행 ${idx + 1} 본부`}
                        className={TEXT_INPUT_CLS}
                      />
                    ) : (
                      <span className="font-semibold text-slate-900">{row.division || '-'}</span>
                    )}
                  </td>
                  <td className="py-2 px-3.5">
                    {isEditing ? (
                      <input
                        type="text"
                        value={row.team}
                        placeholder="예: AI솔루션팀"
                        onChange={(e) => patch(row.id, { team: e.target.value })}
                        aria-label={`행 ${idx + 1} 팀`}
                        className={TEXT_INPUT_CLS}
                      />
                    ) : (
                      <span className="font-medium text-slate-700">{row.team || '-'}</span>
                    )}
                  </td>
                  {COUNT_COLS.map((c) => (
                    <td key={c.field} className="py-2 px-3 text-center">
                      {isEditing ? (
                        <input
                          type="number"
                          min={0}
                          value={row[c.field]}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => patch(row.id, { [c.field]: Math.max(0, Number(e.target.value) || 0) })}
                          aria-label={`행 ${idx + 1} ${c.label}`}
                          className={`w-full text-center py-1 px-1 bg-white hover:bg-slate-50 rounded border focus:ring-1 text-xs transition-colors outline-none ${c.input}`}
                        />
                      ) : (
                        <span className={c.cell}>{row[c.field]}명</span>
                      )}
                    </td>
                  ))}
                  {isEditing && (
                    <td className="py-1.5 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => setRows((prev) => prev && prev.filter((r) => r.id !== row.id))}
                        className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="이 행 삭제 (저장 시 반영)"
                        aria-label={`행 ${idx + 1} 삭제`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>

          {list.length > 0 && (
            <tfoot>
              <tr className="bg-slate-100/90 font-bold text-slate-900 border-t-2 border-slate-300">
                <td colSpan={2} className="py-2.5 px-3.5 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Users className="w-3.5 h-3.5 text-slate-600" />
                    <span>합계 ({list.length}개 조직)</span>
                  </div>
                </td>
                {COUNT_COLS.map((c, i) => (
                  <td key={c.field} className={`py-2.5 px-3 text-center ${c.foot}`}>
                    {totals[i]}명
                  </td>
                ))}
                {isEditing && <td className="py-2.5 px-2"></td>}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <DashboardNotesPanel scope="채용" period={period} accent="indigo" />
    </div>
  );
}
