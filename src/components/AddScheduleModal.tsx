import React, { useState } from 'react';
import { CalendarEventItem } from '../types';
import { X, Calendar as CalendarIcon, CheckCircle2 } from 'lucide-react';

interface AddScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddEvent: (event: CalendarEventItem) => void;
}

export const AddScheduleModal: React.FC<AddScheduleModalProps> = ({
  isOpen,
  onClose,
  onAddEvent,
}) => {
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('2026-08-22');
  const [endDate, setEndDate] = useState('2026-08-22');
  const [category, setCategory] = useState<CalendarEventItem['category']>('전사HR');
  const [location, setLocation] = useState<'서울' | '천안'>('서울');
  const [description, setDescription] = useState('');

  if (!isOpen) return null;

  const handleStartDateChange = (newStart: string) => {
    // If end date was previously equal to start date or earlier than new start date, update end date to new start date
    if (endDate === startDate || endDate < newStart) {
      setEndDate(newStart);
    }
    setStartDate(newStart);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const newEvent: CalendarEventItem = {
      id: `EV-MAN-${Date.now()}`,
      title,
      date: startDate,
      startDate,
      endDate: endDate || startDate,
      category,
      location,
      source: '수동등록',
      description,
      completed: false,
    };

    onAddEvent(newEvent);
    onClose();
    setTitle('');
    setDescription('');
    setLocation('서울');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center space-x-2">
            <CalendarIcon className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-bold text-slate-900">HR 신규 일정 등록</h3>
          </div>
          <button
            type="button"
            id="close-add-schedule-modal"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              일정 명칭 <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              id="input-schedule-title"
              required
              placeholder="예: 3분기 우수사원 포상 심의회"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                일정 분류 <span className="text-rose-500">*</span>
              </label>
              <select
                id="select-schedule-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as CalendarEventItem['category'])}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-900"
              >
                <option value="전사HR">전사HR (행사, 회의)</option>
                <option value="입사자">입사자 (신규 입사 및 온보딩)</option>
                <option value="퇴사자">퇴사자 (퇴직 및 인수인계)</option>
                <option value="1차 수습평가">1차 수습평가 (1차 평가일)</option>
                <option value="최종 수습평가">최종 수습평가 (최종 전환 심의)</option>
                <option value="평가">평가 (역량, 성과)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                장소 구분 <span className="text-rose-500">*</span>
              </label>
              <select
                id="select-schedule-location"
                required
                value={location}
                onChange={(e) => setLocation(e.target.value as '서울' | '천안')}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-900 font-medium"
              >
                <option value="서울">서울</option>
                <option value="천안">천안</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                시작일 <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                id="input-schedule-start-date"
                required
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                종료일 <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                id="input-schedule-end-date"
                required
                min={startDate}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              상세 메모 및 주요 안건
            </label>
            <textarea
              id="input-schedule-desc"
              rows={3}
              placeholder="일정 세부 사항, 준비물 및 유의사항을 입력하세요."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              id="btn-cancel-schedule"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 font-medium text-xs transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              id="btn-submit-schedule"
              className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow-xs transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>일정 저장하기</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
