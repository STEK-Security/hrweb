import React, { useRef, useState } from 'react';
import {
  UploadCloud,
  Loader2,
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  Rows3,
  Columns3,
  BadgeCheck,
  X,
} from 'lucide-react';
import { parseWorkbook, STANDARD_COLUMNS, REQUIRED_COLUMNS, ParsedWorkbook } from '../excel/parse';

interface DataSourceViewProps {
  onLoaded: (wb: ParsedWorkbook, fileName: string) => void;
  current?: { fileName: string; rowCount: number; sheetName: string; loadedAt: Date } | null;
  onUseSample?: () => void;
  /** 이미 데이터가 적재된 상태에서 이 화면을 닫고 이전 화면으로 돌아갈 때 */
  onCancel?: () => void;
}

const PREVIEW_COLUMNS = ['성명', '법인', '소속', '직책', '직급', '고용구분', '입사일', '근무지'];

export const DataSourceView: React.FC<DataSourceViewProps> = ({ onLoaded, current, onUseSample, onCancel }) => {
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'review'>('idle');
  const [dragOver, setDragOver] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [workbook, setWorkbook] = useState<ParsedWorkbook | null>(null);
  const [fileName, setFileName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!/\.xlsx$/i.test(file.name)) {
      setStatus('error');
      setErrorMsg('.xlsx 형식의 엑셀 파일만 업로드할 수 있습니다.');
      return;
    }
    setStatus('loading');
    try {
      const wb = await parseWorkbook(file);
      setWorkbook(wb);
      setFileName(file.name);
      setStatus('review');
    } catch (e) {
      setStatus('error');
      setErrorMsg(e instanceof Error ? e.message : '파일을 분석하는 중 오류가 발생했습니다.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleCancel = () => {
    setWorkbook(null);
    setFileName('');
    setStatus('idle');
    if (inputRef.current) inputRef.current.value = '';
  };

  const missingRequired = workbook ? REQUIRED_COLUMNS.filter((c) => !workbook.headers.includes(c)) : [];
  const missingStandard = workbook ? STANDARD_COLUMNS.filter((c) => !workbook.headers.includes(c)) : [];
  const extraColumns = workbook ? workbook.headers.filter((h) => !STANDARD_COLUMNS.includes(h)) : [];
  const matchedStandardCount = STANDARD_COLUMNS.length - missingStandard.length;
  const recognitionRate = workbook ? Math.round((matchedStandardCount / STANDARD_COLUMNS.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">인사기초정보 데이터 소스 연결</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            엑셀 인사기초정보 파일을 업로드하면 시스템 전체 화면에 데이터가 반영됩니다.
          </p>
        </div>
        {onCancel && (
          <button
            type="button"
            id="btn-close-datasource-view"
            onClick={onCancel}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors shrink-0"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {current && (
        <div className="flex items-center justify-between gap-4 px-5 py-4 bg-white rounded-lg border border-slate-200 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">현재 적재된 데이터: {current.fileName}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                시트 {current.sheetName} · {current.rowCount.toLocaleString()}행 · {current.loadedAt.toLocaleString('ko-KR')} 적재
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold shrink-0">
            연동 정상
          </span>
        </div>
      )}

      {status !== 'review' && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => status !== 'loading' && inputRef.current?.click()}
          className={`rounded-xl border-2 border-dashed p-10 sm:p-14 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
            dragOver ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-white hover:bg-slate-50'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />

          {status === 'loading' ? (
            <>
              <Loader2 className="w-9 h-9 text-blue-600 animate-spin mb-3" />
              <p className="text-sm font-semibold text-slate-700">분석 중…</p>
            </>
          ) : (
            <>
              <UploadCloud className="w-9 h-9 text-blue-500 mb-3" />
              <p className="text-sm font-semibold text-slate-700">
                인사기초정보 엑셀(.xlsx)을 끌어다 놓거나 클릭해 선택하세요
              </p>
              <p className="text-xs text-slate-400 mt-1.5 space-x-1">
                <span>첫 시트의 첫 행을 헤더로 읽습니다</span>
                <span>·</span>
                <span>파일은 브라우저에서만 처리되며 서버로 전송되지 않습니다</span>
              </p>
            </>
          )}

          {status === 'error' && (
            <div
              role="alert"
              onClick={(e) => e.stopPropagation()}
              className="mt-5 flex items-start gap-2 px-3.5 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium max-w-md text-left"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{errorMsg} 다시 시도해 주세요.</span>
            </div>
          )}

          {onUseSample && status === 'idle' && (
            <button
              type="button"
              id="btn-use-sample-data"
              onClick={(e) => {
                e.stopPropagation();
                onUseSample();
              }}
              className="mt-6 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 font-medium text-xs transition-colors"
            >
              샘플 데이터로 둘러보기
            </button>
          )}
        </div>
      )}

      {status === 'review' && workbook && (
        <div className="space-y-5">
          {/* Summary KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold text-slate-500">시트명</p>
                <FileSpreadsheet className="w-4 h-4 text-blue-500" />
              </div>
              <p className="text-lg font-bold text-slate-900 mt-1 truncate">{workbook.sheetName}</p>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold text-slate-500">데이터 행 수</p>
                <Rows3 className="w-4 h-4 text-blue-500" />
              </div>
              <p className="text-lg font-bold text-slate-900 mt-1">{workbook.rows.length.toLocaleString()}행</p>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold text-slate-500">컬럼 수</p>
                <Columns3 className="w-4 h-4 text-blue-500" />
              </div>
              <p className="text-lg font-bold text-slate-900 mt-1">{workbook.headers.length}개</p>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold text-slate-500">표준 컬럼 인식률</p>
                <BadgeCheck className="w-4 h-4 text-blue-500" />
              </div>
              <p className="text-lg font-bold text-slate-900 mt-1">{recognitionRate}%</p>
            </div>
          </div>

          {missingRequired.length > 0 && (
            <div
              role="alert"
              className="flex items-start gap-2.5 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                필수 컬럼이 없어 데이터를 적용할 수 없습니다: {missingRequired.join(', ')}
              </span>
            </div>
          )}

          {missingStandard.length > 0 && (
            <div className="px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs">
              <details>
                <summary className="font-bold cursor-pointer">
                  표준 컬럼 중 누락된 항목 ({missingStandard.length}개)
                </summary>
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {missingStandard.map((m) => (
                    <span
                      key={m}
                      className="px-2 py-0.5 rounded-full bg-white border border-amber-300 text-amber-800 text-[11px] font-medium"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </details>
            </div>
          )}

          {extraColumns.length > 0 && (
            <div className="px-4 py-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-xs">
              <details>
                <summary className="font-bold cursor-pointer">
                  표준에 없는 컬럼 ({extraColumns.length}개)
                </summary>
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {extraColumns.map((m) => (
                    <span
                      key={m}
                      className="px-2 py-0.5 rounded-full bg-white border border-slate-300 text-slate-500 text-[11px] font-medium"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </details>
            </div>
          )}

          {/* Preview table */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="text-xs font-bold text-slate-700">
                데이터 미리보기 (상위 {Math.min(8, workbook.rows.length)}행)
              </p>
            </div>
            <div className="overflow-x-auto max-h-72">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    {PREVIEW_COLUMNS.map((c) => (
                      <th key={c} className="px-3 py-2 text-left font-semibold text-slate-600 whitespace-nowrap">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {workbook.rows.slice(0, 8).map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      {PREVIEW_COLUMNS.map((c) => (
                        <td key={c} className="px-3 py-2 text-slate-700 whitespace-nowrap">
                          {row[c] ?? <span className="text-slate-300">-</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              id="btn-cancel-datasource"
              onClick={handleCancel}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 font-medium text-xs transition-colors"
            >
              취소
            </button>
            <button
              type="button"
              id="btn-apply-datasource"
              disabled={missingRequired.length > 0}
              onClick={() => onLoaded(workbook, fileName)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium text-xs shadow-xs transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>데이터 적용</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
