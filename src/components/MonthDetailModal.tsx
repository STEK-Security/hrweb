import React from 'react';
import { X, TrendingUp, Calendar, AlertCircle, ArrowUpRight, ArrowDownRight, UserPlus, UserMinus } from 'lucide-react';
import { MonthlyHireLeaverData } from '../types';

interface MonthDetailModalProps {
  monthData: MonthlyHireLeaverData | null;
  isOpen: boolean;
  onClose: () => void;
}

export const MonthDetailModal: React.FC<MonthDetailModalProps> = ({
  monthData,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !monthData) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {monthData.month} 입·퇴사 변동 및 Peak Time 정밀 분석
              </h3>
              <p className="text-xs text-slate-500">당해년도(2026) vs 전년도(2025) 비교</p>
            </div>
          </div>
          <button
            type="button"
            id="close-month-modal"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs">
          {monthData.highlightNote && (
            <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl flex items-start space-x-2.5 text-blue-900">
              <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block mb-0.5">해당 월 주요 인사 이벤트</span>
                <span>{monthData.highlightNote}</span>
              </div>
            </div>
          )}

          {/* Cards comparison */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-emerald-50/70 border border-emerald-200 p-4 rounded-xl">
              <div className="flex items-center justify-between text-emerald-800 font-bold mb-2">
                <span className="flex items-center space-x-1">
                  <UserPlus className="w-4 h-4 text-emerald-600" />
                  <span>당월 신규 입사자</span>
                </span>
                <span className="text-lg font-black text-emerald-700">{monthData.currentYearHires}명</span>
              </div>
              <p className="text-emerald-700 text-[11px]">
                전년 동월 ({monthData.prevYearHires}명) 대비{' '}
                <strong className="underline">
                  {monthData.currentYearHires - monthData.prevYearHires >= 0 ? '+' : ''}
                  {monthData.currentYearHires - monthData.prevYearHires}명 (
                  {(
                    ((monthData.currentYearHires - monthData.prevYearHires) /
                      monthData.prevYearHires) *
                    100
                  ).toFixed(1)}
                  %) 증감
                </strong>
              </p>
            </div>

            <div className="bg-rose-50/70 border border-rose-200 p-4 rounded-xl">
              <div className="flex items-center justify-between text-rose-800 font-bold mb-2">
                <span className="flex items-center space-x-1">
                  <UserMinus className="w-4 h-4 text-rose-600" />
                  <span>당월 퇴사자</span>
                </span>
                <span className="text-lg font-black text-rose-700">{monthData.currentYearLeavers}명</span>
              </div>
              <p className="text-rose-700 text-[11px]">
                전년 동월 ({monthData.prevYearLeavers}명) 대비{' '}
                <strong>
                  {monthData.currentYearLeavers - monthData.prevYearLeavers >= 0 ? '+' : ''}
                  {monthData.currentYearLeavers - monthData.prevYearLeavers}명
                </strong>
              </p>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-2">
            <span className="font-bold text-slate-800 block">순증감 (Net Growth)</span>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">당해년도 순증 인원:</span>
              <span className="text-sm font-bold text-blue-600">+{monthData.netChange}명 순증</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">전년도 순증 인원:</span>
              <span className="text-sm font-bold text-slate-700">
                +{monthData.prevYearHires - monthData.prevYearLeavers}명
              </span>
            </div>
          </div>

          <div className="space-y-1.5 text-slate-600 text-[11px] leading-relaxed">
            <p>• <strong>인사담당자 코멘트:</strong> 본 월은 사업 확장 및 하반기 전략 프로젝트 일정에 맞춰 충원 관리가 선제적으로 진행되었습니다.</p>
            <p>• <strong>수습 관리 알림:</strong> 신규 입사 인원은 1개월 차 및 3개월 차 수습 평가 일정에 자동 연동 등록됩니다.</p>
          </div>
        </div>

        <div className="flex items-center justify-end px-6 py-3 border-t border-slate-100 bg-slate-50">
          <button
            type="button"
            id="btn-close-month-modal"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
};
