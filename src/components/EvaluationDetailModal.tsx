import React, { useState } from 'react';
import { EvaluationItem as EvaluationItemBase } from '../types';
import { X, Award, CheckCircle, Clock, User, Building, FileSpreadsheet, Star } from 'lucide-react';

// DB의 stage는 자유 텍스트이므로 원본 리터럴 유니온을 string으로 완화
type EvaluationItem = Omit<EvaluationItemBase, 'stage'> & { stage: string };

interface EvaluationDetailModalProps {
  item: EvaluationItem | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateStatus: (id: string, status: '완료' | '진행중' | '미작성', grade?: 'S' | 'A' | 'B' | 'C' | 'D', feedback?: string) => void;
}

export const EvaluationDetailModal: React.FC<EvaluationDetailModalProps> = ({
  item,
  isOpen,
  onClose,
  onUpdateStatus,
}) => {
  if (!isOpen || !item) return null;

  const [selectedGrade, setSelectedGrade] = useState<'S' | 'A' | 'B' | 'C' | 'D'>(item.finalGrade || 'A');
  const [feedback, setFeedback] = useState(item.feedbackSummary || '');
  const [managerScore, setManagerScore] = useState<number>(item.managerScore || 90);

  const handleSave = (newStatus: '완료' | '진행중') => {
    onUpdateStatus(item.id, newStatus, selectedGrade, feedback);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center space-x-2">
            <Award className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {item.type} 상세 평가표 및 심의 의결
              </h3>
              <p className="text-xs text-slate-500">{item.stage} | 평가 ID: {item.id}</p>
            </div>
          </div>
          <button
            type="button"
            id="close-eval-modal"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 text-sm max-h-[80vh] overflow-y-auto">
          {/* Target Profile Card */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <span className="text-[11px] text-slate-500 block">피평가자</span>
              <span className="text-sm font-bold text-slate-900">{item.targetName}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block">소속 부서 / 직급</span>
              <span className="text-xs font-semibold text-slate-800">{item.department} / {item.position}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block">1차 평가자</span>
              <span className="text-xs font-semibold text-slate-800">{item.evaluatorName} ({item.evaluatorPosition})</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block">마감 기한</span>
              <span className="text-xs font-semibold text-slate-800">{item.dueDate}</span>
            </div>
          </div>

          {/* Evaluation Criteria Details */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
              <FileSpreadsheet className="w-4 h-4 text-blue-600" />
              <span>항목별 평가 세부 내역</span>
            </h4>

            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-3.5 py-2">평가 영역</th>
                    <th className="px-3.5 py-2">세부 지표</th>
                    <th className="px-3.5 py-2 text-center">자기 평가</th>
                    <th className="px-3.5 py-2 text-center">부서장 평가</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  <tr>
                    <td className="px-3.5 py-2.5 font-semibold text-slate-900">직무 적합도 & 전문성</td>
                    <td className="px-3.5 py-2.5">업무 이해도, 기술 습득 속도, 과업 완수력</td>
                    <td className="px-3.5 py-2.5 text-center font-bold text-blue-600">{item.selfScore ?? 90}점</td>
                    <td className="px-3.5 py-2.5 text-center font-bold text-indigo-600">{managerScore}점</td>
                  </tr>
                  <tr>
                    <td className="px-3.5 py-2.5 font-semibold text-slate-900">조직 적응 & 협업 태도</td>
                    <td className="px-3.5 py-2.5">팀 내 커뮤니케이션, 업무 적극성, 사내 규정 준수</td>
                    <td className="px-3.5 py-2.5 text-center font-bold text-blue-600">{(item.selfScore ?? 90) - 2}점</td>
                    <td className="px-3.5 py-2.5 text-center font-bold text-indigo-600">{managerScore - 1}점</td>
                  </tr>
                  <tr>
                    <td className="px-3.5 py-2.5 font-semibold text-slate-900">핵심 가치 실천도</td>
                    <td className="px-3.5 py-2.5">혁신적 문제해결, 고객 지향 마인드</td>
                    <td className="px-3.5 py-2.5 text-center font-bold text-blue-600">{(item.selfScore ?? 90) + 1}점</td>
                    <td className="px-3.5 py-2.5 text-center font-bold text-indigo-600">{managerScore + 1}점</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Grade Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-900">
              인사위원회 최종 확정 등급
            </label>
            <div className="flex items-center space-x-2">
              {(['S', 'A', 'B', 'C', 'D'] as const).map((grade) => (
                <button
                  key={grade}
                  type="button"
                  id={`eval-grade-btn-${grade}`}
                  onClick={() => setSelectedGrade(grade)}
                  className={`flex-1 py-2 rounded-lg font-bold text-xs border transition-all ${
                    selectedGrade === grade
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {grade} 등급
                </button>
              ))}
            </div>
          </div>

          {/* Feedback */}
          <div>
            <label className="block text-xs font-bold text-slate-900 mb-1.5">
              종합 평가 의견 및 피드백 코멘트
            </label>
            <textarea
              id="eval-feedback-input"
              rows={3}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="피평가자의 강점, 향후 육성 방향 및 인사권자 종합 권고 사항을 입력하세요."
              className="w-full p-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs text-slate-900 leading-relaxed"
            />
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50">
          <div className="text-xs text-slate-500">
            현재 상태: <span className="font-semibold text-slate-800">{item.status}</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              id="eval-btn-cancel"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-medium"
            >
              닫기
            </button>
            <button
              type="button"
              id="eval-btn-save-progress"
              onClick={() => handleSave('진행중')}
              className="px-3.5 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-medium"
            >
              임시 저장
            </button>
            <button
              type="button"
              id="eval-btn-complete-confirm"
              onClick={() => handleSave('완료')}
              className="flex items-center space-x-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>평가 확정 및 승인</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
