import React, { useState, useEffect } from 'react';
import { CalendarEventItem } from '../types';
import { X, Calendar as CalendarIcon, CheckCircle2, Trash2, AlertTriangle } from 'lucide-react';

interface EditScheduleModalProps {
  isOpen: boolean;
  event: CalendarEventItem | null;
  onClose: () => void;
  onUpdateEvent: (event: CalendarEventItem) => void;
  onDeleteEvent: (eventId: string) => void;
}

export const EditScheduleModal: React.FC<EditScheduleModalProps> = ({
  isOpen,
  event,
  onClose,
  onUpdateEvent,
  onDeleteEvent,
}) => {
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [category, setCategory] = useState<CalendarEventItem['category']>('전사HR');
  const [location, setLocation] = useState<string>('서울');
  const [description, setDescription] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (event) {
      setTitle(event.title || '');
      const start = event.startDate || event.date || '2026-08-18';
      const end = event.endDate || event.date || start;
      setStartDate(start);
      setEndDate(end);
      setCategory(event.category || '전사HR');
      setLocation(event.location || '서울');
      setDescription(event.description || '');
      setShowDeleteConfirm(false);
    }
  }, [event, isOpen]);

  if (!isOpen || !event) return null;

  const handleStartDateChange = (newStart: string) => {
    if (endDate === startDate || endDate < newStart) {
      setEndDate(newStart);
    }
    setStartDate(newStart);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const updatedEvent: CalendarEventItem = {
      ...event,
      title,
      date: startDate,
      startDate,
      endDate: endDate || startDate,
      category,
      location,
      description,
    };

    onUpdateEvent(updatedEvent);
    onClose();
  };

  const handleDelete = () => {
    onDeleteEvent(event.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center space-x-2">
            <CalendarIcon className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-bold text-slate-900">HR 일정 수정</h3>
          </div>
          <button
            type="button"
            id="close-edit-schedule-modal"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {showDeleteConfirm ? (
          <div className="p-6 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-900">일정을 삭제하시겠습니까?</h4>
              <p className="text-xs text-slate-500 mt-1">
                선택한 <strong className="text-slate-800">'{event.title}'</strong> 일정이 캘린더 및 목록에서 완전히 삭제됩니다.
              </p>
            </div>
            <div className="flex items-center justify-center space-x-3 pt-3">
              <button
                type="button"
                id="cancel-delete-btn"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 font-medium text-xs transition-colors cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                id="confirm-delete-btn"
                onClick={handleDelete}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs shadow-xs transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>삭제 확인</span>
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4 text-sm">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                일정 명칭 <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                id="edit-schedule-title"
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
                  id="edit-schedule-category"
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
                  id="edit-schedule-location"
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-900 font-medium"
                >
                  <option value="서울">서울</option>
                  <option value="천안">천안</option>
                  {location !== '서울' && location !== '천안' && (
                    <option value={location}>{location}</option>
                  )}
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
                  id="edit-schedule-start-date"
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
                  id="edit-schedule-end-date"
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
                id="edit-schedule-desc"
                rows={3}
                placeholder="일정 세부 사항, 준비물 및 유의사항을 입력하세요."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              {/* Delete Button on the Left */}
              <button
                type="button"
                id="btn-delete-schedule"
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium text-xs transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>일정 삭제</span>
              </button>

              {/* Cancel and Save on the Right */}
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  id="btn-cancel-edit-schedule"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 font-medium text-xs transition-colors cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  id="btn-submit-edit-schedule"
                  className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow-xs transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>수정 완료</span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
