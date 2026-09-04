/**
 * 핵심 지표 요약 카드. 전월/당월/전년동월은 수기 입력(hr_key_metrics),
 * 증감·YoY증감은 calcDelta 로 파생되는 읽기 전용 값이라 저장하지 않는다.
 */
import { useEffect, useState } from 'react';
import { Save, CheckCircle2, AlertCircle, Edit3, Loader2 } from 'lucide-react';
import { listKeyMetrics, saveKeyMetrics, type KeyMetricRow } from '../lib/db';
import { calcDelta } from '../lib/metricDelta';
import { DashboardNotesPanel } from './DashboardNotesPanel';

interface Props {
  period: string;
}

/** 해당 월에 저장된 행이 없을 때 입력용 빈 골격. metric_key 는 마이그레이션 시드와 동일. */
const EMPTY_ROWS: KeyMetricRow[] = [
  { metric_key: 'closing_headcount', label: '기말 재직인원(명)', last_month: '', this_month: '', last_year_month: '', sort_order: 1 },
  { metric_key: 'new_hires', label: '입사자 수', last_month: '', this_month: '', last_year_month: '', sort_order: 2 },
  { metric_key: 'leavers', label: '퇴사자 수', last_month: '', this_month: '', last_year_month: '', sort_order: 3 },
  { metric_key: 'turnover_rate', label: '이직률', last_month: '', this_month: '', last_year_month: '', sort_order: 4 },
  { metric_key: 'labor_cost', label: '총 노무비(천원)', last_month: '', this_month: '', last_year_month: '', sort_order: 5 },
];

type InputField = 'last_month' | 'this_month' | 'last_year_month';

const INPUT_CLS =
  'w-full text-center py-1 px-1.5 bg-white hover:bg-slate-50 focus:bg-blue-50/60 rounded border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-400 text-xs transition-colors outline-none';

const deltaColor = (v: string, plus: string, minus: string) =>
  v.startsWith('+') ? plus : v.startsWith('-') ? minus : 'text-slate-800';

const Disabled = () => <span className="text-slate-400 font-bold select-none">-</span>;

/** 자동 계산 열 헤더: '자동' 마이크로 배지로 입력 칸이 아님을 표시 */
const AutoTh = ({ label }: { label: string }) => (
  <th scope="col" className="py-2.5 px-3 text-center w-28 bg-slate-100/70">
    {label}
    <span className="ml-1 align-middle text-[9px] font-semibold text-slate-500 bg-white border border-slate-200 rounded px-1 py-px">
      자동
    </span>
  </th>
);

/** 자동 계산 셀: 수정 모드에서도 input 대신 점선 박스로 렌더 */
const AutoCell = ({ value, cls, editing }: { value: string; cls: string; editing: boolean }) => (
  <td className="py-2 px-3 text-center bg-slate-50/70">
    {editing ? (
      <span
        className={`inline-block w-full py-1 px-1.5 rounded border border-dashed border-slate-300 bg-slate-100/80 font-semibold text-xs select-none ${cls}`}
        title="자동 계산 (당월 − 기준월)"
      >
        {value}
      </span>
    ) : (
      <span className={`font-semibold ${cls}`}>{value}</span>
    )}
  </td>
);

export function KeyMetricsSummary({ period }: Props) {
  const [rows, setRows] = useState<KeyMetricRow[] | null>(null); // null = 로딩 중
  /** 수정 중인 대상 월. null = 조회 모드. 상위 기준일이 바뀌어도 이 값이 저장 대상이다. */
  const [editPeriod, setEditPeriod] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<'ok' | 'fail' | null>(null);
  const isEditing = editPeriod !== null;
  const stale = editPeriod !== null && editPeriod !== period;

  useEffect(() => {
    // 수정 중에는 재로드하지 않는다 — 상위 기준일이 바뀔 때 입력 중이던 값이
    // 말없이 사라지던 문제(저장 대상은 editPeriod 로 고정하고 경고 배너로 알린다).
    if (editPeriod !== null) return;
    let alive = true;
    setRows(null);
    setNotice(null);
    void listKeyMetrics(period).then((r) => {
      if (!alive) return;
      setRows(r.length ? [...r].sort((a, b) => a.sort_order - b.sort_order) : EMPTY_ROWS);
    });
    return () => {
      alive = false;
    };
  }, [period, editPeriod]);

  const handleCellChange = (key: string, field: InputField, value: string) =>
    setRows((prev) => prev && prev.map((r) => (r.metric_key === key ? { ...r, [field]: value } : r)));

  const handleSave = async () => {
    if (!rows) return;
    setSaving(true);
    setNotice(null);
    const ok = await saveKeyMetrics(editPeriod ?? period, rows);
    setSaving(false);
    setNotice(ok ? 'ok' : 'fail');
    if (ok) {
      setEditPeriod(null);
      setTimeout(() => setNotice((n) => (n === 'ok' ? null : n)), 2000);
    }
  };

  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-4 bg-blue-600 rounded-full"></span>
          <h3 className="text-sm font-bold text-slate-900 tracking-tight">핵심 지표 요약</h3>
          <span className="text-[11px] text-slate-400 font-mono">{period}</span>
          {isEditing ? (
            <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
              수정 모드
            </span>
          ) : (
            <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">조회 모드</span>
          )}
        </div>

        <div className="flex items-center gap-2">
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
            title="수치 수정"
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
                ? 'bg-blue-600 hover:bg-blue-700 text-white ring-2 ring-blue-300 ring-offset-1 cursor-pointer disabled:opacity-60'
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
        <table className="w-full text-xs text-left text-slate-700 border-collapse min-w-[640px]">
          <thead>
            <tr className="bg-slate-50/90 text-slate-800 font-semibold border-b border-slate-200">
              <th scope="col" className="py-2.5 px-3.5 w-44 font-bold">구분</th>
              <th scope="col" className="py-2.5 px-3 text-center w-28">전월</th>
              <th scope="col" className="py-2.5 px-3 text-center w-28">당월</th>
              <AutoTh label="증감" />
              <th scope="col" className="py-2.5 px-3 text-center w-28">전년동월</th>
              <AutoTh label="YoY증감" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows === null ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-slate-400">
                  <span className="inline-flex items-center gap-1.5">
                    <Loader2 className="w-4 h-4 animate-spin" /> 불러오는 중…
                  </span>
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const isTurnover = row.metric_key === 'turnover_rate';
                const change = isTurnover ? '-' : calcDelta(row.this_month, row.last_month);
                const yoy = isTurnover ? '-' : calcDelta(row.this_month, row.last_year_month);
                const input = (field: InputField, extra: string) => (
                  <input
                    type="text"
                    value={row[field]}
                    onChange={(e) => handleCellChange(row.metric_key, field, e.target.value)}
                    aria-label={`${row.label} ${field === 'last_month' ? '전월' : field === 'this_month' ? '당월' : '전년동월'}`}
                    className={`${INPUT_CLS} ${extra}`}
                  />
                );
                return (
                  <tr key={row.metric_key} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2 px-3.5 font-bold text-slate-900 bg-slate-50/30">{row.label}</td>
                    <td className="py-2 px-3 text-center">
                      {isEditing ? input('last_month', 'font-semibold text-slate-800') : (
                        <span className="font-semibold text-slate-800">{row.last_month || '-'}</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {isTurnover ? <Disabled /> : isEditing ? input('this_month', 'font-bold text-blue-700') : (
                        <span className="font-bold text-blue-700">{row.this_month || '-'}</span>
                      )}
                    </td>
                    <AutoCell
                      value={change}
                      editing={isEditing && !isTurnover}
                      cls={isTurnover ? 'text-slate-400 font-bold' : deltaColor(change, 'text-emerald-700', 'text-rose-600')}
                    />
                    <td className="py-2 px-3 text-center">
                      {isEditing ? input('last_year_month', 'font-semibold text-slate-800') : (
                        <span className="font-semibold text-slate-800">{row.last_year_month || '-'}</span>
                      )}
                    </td>
                    <AutoCell
                      value={yoy}
                      editing={isEditing && !isTurnover}
                      cls={isTurnover ? 'text-slate-400 font-bold' : deltaColor(yoy, 'text-blue-700', 'text-amber-600')}
                    />
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <DashboardNotesPanel scope="핵심지표" period={period} accent="amber" />
    </div>
  );
}
