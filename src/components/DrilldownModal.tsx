import React from 'react';
import { X, Users, Factory, Truck, CheckCircle2, ChevronRight } from 'lucide-react';
import { fieldWorkDrilldown } from '../mockData';

interface DrilldownModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCategory: string;
}

export const DrilldownModal: React.FC<DrilldownModalProps> = ({
  isOpen,
  onClose,
  selectedCategory,
}) => {
  if (!isOpen) return null;

  const currentCat = fieldWorkDrilldown.categories.find(
    (c) => c.name === selectedCategory || c.id === selectedCategory
  ) || fieldWorkDrilldown.categories[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center space-x-2">
            {currentCat.id === 'prod' ? (
              <Factory className="w-5 h-5 text-emerald-600" />
            ) : (
              <Truck className="w-5 h-5 text-blue-600" />
            )}
            <div>
              <h3 className="text-base font-bold text-slate-900">
                현장직 세부 조직 드릴다운 ({currentCat.name})
              </h3>
              <p className="text-xs text-slate-500">
                총 인원: <span className="font-semibold text-slate-800">{currentCat.totalCount}명</span> | {currentCat.recentTrend}
              </p>
            </div>
          </div>
          <button
            type="button"
            id="close-drilldown-modal"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl text-xs text-emerald-900 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>
                <strong>인력 운영 현황:</strong> 천안 사업장 현장 라인 정상 가동 중 (충원율 95.8%)
              </span>
            </div>
            <span className="font-semibold text-[11px] bg-emerald-100 px-2 py-0.5 rounded text-emerald-800">
              실시간 집계
            </span>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-900">세부 파트/팀별 인력 배치표</h4>
            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5">소속 팀/파트명</th>
                    <th className="px-4 py-2.5 text-center">인원 수</th>
                    <th className="px-4 py-2.5">파트장 / 리더</th>
                    <th className="px-4 py-2.5">근무 형태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {currentCat.teams.map((t, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-900 flex items-center space-x-2">
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                        <span>{t.teamName}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md font-bold bg-blue-50 text-blue-700 border border-blue-100">
                          {t.count}명
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-800 font-medium">{t.leader}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-[11px] bg-slate-100 text-slate-700">
                          {t.shift}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end px-6 py-3.5 border-t border-slate-100 bg-slate-50">
          <button
            type="button"
            id="btn-close-drilldown"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold"
          >
            확인 및 닫기
          </button>
        </div>
      </div>
    </div>
  );
};
