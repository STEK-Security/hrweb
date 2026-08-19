import React, { useState } from 'react';
import { CalendarEventItem, DailyChecklistItem } from '../types';
import { EditScheduleModal } from './EditScheduleModal';
import {
  Calendar as CalendarIcon,
  Plus,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  MapPin,
  CalendarCheck,
  CalendarDays,
  Sparkles,
  Edit2,
  Layers,
} from 'lucide-react';

interface HRCalendarViewProps {
  events: CalendarEventItem[];
  checklists: DailyChecklistItem[];
  onOpenAddSchedule: () => void;
  onUpdateEvent?: (event: CalendarEventItem) => void;
  onDeleteEvent?: (eventId: string) => void;
  onToggleChecklist: (id: string) => void;
  onAddChecklist: (item: DailyChecklistItem) => void;
  onSyncDB: () => void;
}

export const HRCalendarView: React.FC<HRCalendarViewProps> = ({
  events,
  onOpenAddSchedule,
  onUpdateEvent,
  onDeleteEvent,
  onSyncDB,
}) => {
  const today = new Date();
  const [viewYear, setViewYear] = useState<number>(today.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(today.getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState<number>(today.getDate());
  const [selectedCategory, setSelectedCategory] = useState<string>('전체');
  const [isSyncing, setIsSyncing] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEventItem | null>(null);

  const handleSyncClick = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      onSyncDB();
    }, 600);
  };

  // Helper for category badge classes
  const getCategoryBadgeClass = (category: string) => {
    if (category === '전사HR') {
      return 'bg-blue-50 text-blue-700 border-blue-200';
    }
    if (category === '입사자' || category === '입사' || category.includes('입사')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (category === '퇴사자' || category === '퇴사' || category.includes('퇴사')) {
      return 'bg-rose-50 text-rose-700 border-rose-200';
    }
    if (
      category === '1차 수습평가' ||
      category === '1차수습평가' ||
      category === '1차 수습평가일' ||
      category.includes('1차')
    ) {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    if (
      category === '최종 수습평가' ||
      category === '최종수습평가' ||
      category === '최종 수습평가일' ||
      category.includes('최종')
    ) {
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    }
    if (category.includes('수습')) {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    if (category.includes('평가')) {
      return 'bg-purple-50 text-purple-700 border-purple-200';
    }
    return 'bg-slate-50 text-slate-700 border-slate-200';
  };

  const getCategoryDotColor = (category: string) => {
    if (category === '전사HR') {
      return 'bg-blue-500';
    }
    if (category === '입사자' || category === '입사' || category.includes('입사')) {
      return 'bg-emerald-500';
    }
    if (category === '퇴사자' || category === '퇴사' || category.includes('퇴사')) {
      return 'bg-rose-500';
    }
    if (
      category === '1차 수습평가' ||
      category === '1차수습평가' ||
      category === '1차 수습평가일' ||
      category.includes('1차')
    ) {
      return 'bg-amber-500';
    }
    if (
      category === '최종 수습평가' ||
      category === '최종수습평가' ||
      category === '최종 수습평가일' ||
      category.includes('최종')
    ) {
      return 'bg-indigo-500';
    }
    if (category.includes('수습')) {
      return 'bg-amber-500';
    }
    if (category.includes('평가')) {
      return 'bg-purple-500';
    }
    return 'bg-slate-400';
  };

  const getCategoryBarColors = (category: string) => {
    if (category === '전사HR') {
      return {
        bg: 'bg-blue-100/90 text-blue-900 border-blue-300',
        border: 'border-blue-300',
        dot: 'bg-blue-600',
      };
    }
    if (category === '입사자' || category === '입사' || category.includes('입사')) {
      return {
        bg: 'bg-emerald-100/90 text-emerald-900 border-emerald-300',
        border: 'border-emerald-300',
        dot: 'bg-emerald-600',
      };
    }
    if (category === '퇴사자' || category === '퇴사' || category.includes('퇴사')) {
      return {
        bg: 'bg-rose-100/90 text-rose-900 border-rose-300',
        border: 'border-rose-300',
        dot: 'bg-rose-600',
      };
    }
    if (
      category === '1차 수습평가' ||
      category === '1차수습평가' ||
      category === '1차 수습평가일' ||
      category.includes('1차')
    ) {
      return {
        bg: 'bg-amber-100/90 text-amber-900 border-amber-300',
        border: 'border-amber-300',
        dot: 'bg-amber-600',
      };
    }
    if (
      category === '최종 수습평가' ||
      category === '최종수습평가' ||
      category === '최종 수습평가일' ||
      category.includes('최종')
    ) {
      return {
        bg: 'bg-indigo-100/90 text-indigo-900 border-indigo-300',
        border: 'border-indigo-300',
        dot: 'bg-indigo-600',
      };
    }
    if (category.includes('수습')) {
      return {
        bg: 'bg-amber-100/90 text-amber-900 border-amber-300',
        border: 'border-amber-300',
        dot: 'bg-amber-600',
      };
    }
    if (category.includes('평가')) {
      return {
        bg: 'bg-purple-100/90 text-purple-900 border-purple-300',
        border: 'border-purple-300',
        dot: 'bg-purple-600',
      };
    }
    return {
      bg: 'bg-slate-100 text-slate-800 border-slate-300',
      border: 'border-slate-300',
      dot: 'bg-slate-500',
    };
  };

  // Days in the displayed month + first weekday offset (0=Sun..6=Sat)
  const yearStr = String(viewYear);
  const monthStr = String(viewMonth).padStart(2, '0');
  const daysInMonthArr = Array.from(
    { length: new Date(viewYear, viewMonth, 0).getDate() },
    (_, i) => i + 1
  );
  const firstDayOffset = new Date(viewYear, viewMonth - 1, 1).getDay();
  const emptyDays = Array.from({ length: firstDayOffset }, (_, i) => i);

  const selectedDateStr = `${yearStr}-${monthStr}-${String(selectedDay).padStart(2, '0')}`;

  const goToPrevMonth = () => {
    setViewMonth((m) => {
      if (m === 1) {
        setViewYear((y) => y - 1);
        return 12;
      }
      return m - 1;
    });
    setSelectedDay(1);
  };

  const goToNextMonth = () => {
    setViewMonth((m) => {
      if (m === 12) {
        setViewYear((y) => y + 1);
        return 1;
      }
      return m + 1;
    });
    setSelectedDay(1);
  };

  const isEventOnDate = (ev: CalendarEventItem, targetDateStr: string) => {
    const start = ev.startDate || ev.date;
    const end = ev.endDate || ev.date;
    if (!end || end === start) {
      return start === targetDateStr;
    }
    return targetDateStr >= start && targetDateStr <= end;
  };

  // Filter events by selected category
  const filteredEvents = events.filter((ev) => {
    if (selectedCategory === '전체') return true;
    if (selectedCategory === '전사HR') return ev.category === '전사HR';
    if (selectedCategory === '입사자') {
      return (
        ev.category === '입사자' ||
        ev.category === '입사' ||
        ev.category.includes('입사')
      );
    }
    if (selectedCategory === '퇴사자') {
      return (
        ev.category === '퇴사자' ||
        ev.category === '퇴사' ||
        ev.category.includes('퇴사')
      );
    }
    if (selectedCategory === '수습평가') {
      return (
        ev.category === '수습평가' ||
        ev.category === '1차 수습평가' ||
        ev.category === '최종 수습평가' ||
        ev.category.includes('수습')
      );
    }
    if (selectedCategory === '평가') {
      return (
        ev.category === '평가' ||
        ev.category === '기타 평가기간' ||
        (ev.category.includes('평가') && !ev.category.includes('수습'))
      );
    }
    return ev.category === selectedCategory;
  });

  // Daily events for selected day
  const dailyEvents = events.filter((ev) => isEventOnDate(ev, selectedDateStr));

  // Group events into 5 target categories: 전사HR, 입사자, 퇴사자, 수습평가(1차/최종), 평가
  const categoryGroups = [
    {
      id: '전사HR',
      name: '전사HR',
      subTitle: '행사(워크샵, 패밀리데이), 공식회의일정',
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
      dotClass: 'bg-blue-600',
      items: events.filter((ev) => ev.category === '전사HR'),
    },
    {
      id: '입사자',
      name: '입사자',
      subTitle: '신규 입사 및 온보딩 OJT 일정',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      dotClass: 'bg-emerald-600',
      items: events.filter(
        (ev) =>
          ev.category === '입사자' ||
          ev.category === '입사' ||
          (ev.category.includes('입사') && !ev.category.includes('퇴'))
      ),
    },
    {
      id: '퇴사자',
      name: '퇴사자',
      subTitle: '퇴직 절차 및 업무 인수인계 일정',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
      dotClass: 'bg-rose-600',
      items: events.filter(
        (ev) =>
          ev.category === '퇴사자' ||
          ev.category === '퇴사' ||
          (ev.category.includes('퇴사') && !ev.category.includes('입'))
      ),
    },
    {
      id: '수습평가',
      name: '수습평가',
      subTitle: '1차 수습평가(주황) · 최종 수습평가(보라)',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
      dotClass: 'bg-amber-600',
      items: events.filter(
        (ev) =>
          ev.category === '수습평가' ||
          ev.category === '1차 수습평가' ||
          ev.category === '최종 수습평가' ||
          ev.category.includes('수습')
      ),
    },
    {
      id: '평가',
      name: '평가',
      subTitle: '역량평가, 성과평가 (MBO)',
      badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
      dotClass: 'bg-purple-600',
      items: events.filter(
        (ev) =>
          ev.category === '평가' ||
          ev.category === '기타 평가기간' ||
          (ev.category.includes('평가') && !ev.category.includes('수습'))
      ),
    },
  ];

  const categoryOptions = ['전체', '전사HR', '입사자', '퇴사자', '수습평가', '평가'];

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <CalendarIcon className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <span>HR 캘린더</span>
              <span className="text-sm font-normal text-slate-400">{viewYear}년 {viewMonth}월</span>
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Sparkles className="w-3 h-3 mr-1" /> 인사 DB 연동
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            id="btn-sync-calendar-db"
            onClick={handleSyncClick}
            disabled={isSyncing}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? '동기화 중...' : '인사 DB 동기화'}</span>
          </button>

          <button
            type="button"
            id="btn-add-calendar-schedule"
            onClick={onOpenAddSchedule}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>일정 추가</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Left Side Large Calendar (7 cols) / Right Side Detailed Schedule (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Large Interactive Calendar (7 cols) */}
        <section className="lg:col-span-7 xl:col-span-7 bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4 flex flex-col">
          {/* Calendar Header & Category Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={goToPrevMonth}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 transition-colors"
                title="이전 달"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <h2 className="text-base font-bold text-slate-900 font-mono">{yearStr}. {monthStr}</h2>
              <button
                type="button"
                onClick={goToNextMonth}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 transition-colors"
                title="다음 달"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <span className="text-[11px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold ml-2">
                총 {events.length}개 일정
              </span>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar py-0.5">
              {categoryOptions.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Calendar Day Grid */}
          <div className="flex-1 flex flex-col">
            {/* Weekday Header */}
            <div className="grid grid-cols-7 text-center font-bold text-xs py-2 bg-slate-50/80 rounded-t-lg border border-slate-200 text-slate-600">
              <span className="text-rose-500">일</span>
              <span>월</span>
              <span>화</span>
              <span>수</span>
              <span>목</span>
              <span>금</span>
              <span className="text-blue-500">토</span>
            </div>

            {/* Dates Grid */}
            <div className="grid grid-cols-7 auto-rows-fr gap-px bg-slate-200 border-x border-b border-slate-200 rounded-b-lg overflow-hidden flex-1">
              {emptyDays.map((_, idx) => (
                <div
                  key={`empty-${idx}`}
                  className="bg-slate-50/40 p-2 min-h-[82px] text-slate-300 select-none"
                />
              ))}

              {daysInMonthArr.map((day) => {
                const dayStr = String(day).padStart(2, '0');
                const dateStr = `${yearStr}-${monthStr}-${dayStr}`;
                const dayEvents = filteredEvents.filter((ev) => isEventOnDate(ev, dateStr));
                const isSelected = selectedDay === day;
                const isToday =
                  viewYear === today.getFullYear() &&
                  viewMonth === today.getMonth() + 1 &&
                  day === today.getDate();
                const dayOfWeek = (firstDayOffset + day - 1) % 7;
                const isSunday = dayOfWeek === 0;
                const isSaturday = dayOfWeek === 6;

                return (
                  <button
                    key={`day-${day}`}
                    type="button"
                    onClick={() => setSelectedDay(day)}
                    className={`p-1.5 min-h-[86px] text-left transition-all relative flex flex-col justify-between cursor-pointer focus:outline-none ${
                      isSelected
                        ? 'bg-blue-50/90 ring-2 ring-blue-600 z-10'
                        : isToday
                        ? 'bg-blue-50/40 hover:bg-blue-50/70'
                        : 'bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between px-0.5">
                      <span
                        className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full ${
                          isSelected
                            ? 'bg-blue-600 text-white shadow-xs'
                            : isToday
                            ? 'bg-blue-100 text-blue-700 font-black'
                            : isSunday
                            ? 'text-rose-500'
                            : isSaturday
                            ? 'text-blue-500'
                            : 'text-slate-700'
                        }`}
                      >
                        {day}
                      </span>
                      {isToday && (
                        <span className="text-[9px] font-bold text-blue-600 bg-blue-100/80 px-1 rounded">
                          오늘
                        </span>
                      )}
                    </div>

                    {/* Event indicators: Continuous line spans for multi-day, standalone chips for single-day */}
                    <div className="space-y-1 mt-1 flex-1 overflow-hidden">
                      {dayEvents.slice(0, 3).map((ev) => {
                        const start = ev.startDate || ev.date;
                        const end = ev.endDate || ev.date;
                        const isMultiDay = Boolean(end && end !== start);
                        const isStart = dateStr === start;
                        const isEnd = dateStr === end;
                        const isMiddle = isMultiDay && !isStart && !isEnd && dateStr > start && dateStr < end;
                        const colors = getCategoryBarColors(ev.category);

                        if (isMultiDay) {
                          if (isStart) {
                            return (
                              <div
                                key={ev.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingEvent(ev);
                                }}
                                className={`h-5 text-[10px] font-semibold flex items-center gap-1 pl-1.5 pr-1 border-y border-l cursor-pointer hover:brightness-95 transition-all shadow-2xs z-1 ${
                                  isSaturday ? 'rounded-md border-r' : '-mr-2 rounded-l-md'
                                } ${colors.bg} ${colors.border}`}
                                title={`${ev.title} (${start.slice(5)} ~ ${end.slice(5)}) · 클릭하여 수정/삭제`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${colors.dot}`} />
                                <span className="truncate whitespace-nowrap">{ev.title}</span>
                              </div>
                            );
                          }

                          if (isEnd) {
                            return (
                              <div
                                key={ev.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingEvent(ev);
                                }}
                                className={`h-5 text-[10px] font-semibold flex items-center justify-between pl-1 pr-1.5 border-y border-r cursor-pointer hover:brightness-95 transition-all shadow-2xs z-1 ${
                                  isSunday ? 'rounded-md border-l' : '-ml-2 rounded-r-md'
                                } ${colors.bg} ${colors.border}`}
                                title={`${ev.title} (${start.slice(5)} ~ ${end.slice(5)}) · 클릭하여 수정/삭제`}
                              >
                                <span className="truncate whitespace-nowrap text-[9px] opacity-75 font-normal">
                                  {isSunday ? ev.title : '종료'}
                                </span>
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${colors.dot}`} />
                              </div>
                            );
                          }

                          if (isMiddle) {
                            return (
                              <div
                                key={ev.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingEvent(ev);
                                }}
                                className={`h-5 text-[10px] font-medium flex items-center border-y cursor-pointer hover:brightness-95 transition-all z-1 ${
                                  isSunday
                                    ? 'rounded-l-md border-l pl-1.5 -mr-2'
                                    : isSaturday
                                    ? 'rounded-r-md border-r pr-1.5 -ml-2'
                                    : '-mx-2 px-1'
                                } ${colors.bg} ${colors.border}`}
                                title={`${ev.title} (${start.slice(5)} ~ ${end.slice(5)}) · 클릭하여 수정/삭제`}
                              >
                                {isSunday ? (
                                  <span className="truncate text-[9px] font-semibold opacity-90 whitespace-nowrap">
                                    {ev.title} (계속)
                                  </span>
                                ) : (
                                  <div className="w-full h-0.5 border-t border-dashed border-current opacity-35 mx-0.5" />
                                )}
                              </div>
                            );
                          }
                        }

                        // Single day standalone event chip
                        return (
                          <div
                            key={ev.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingEvent(ev);
                            }}
                            className={`h-5 px-1.5 rounded text-[10px] font-medium truncate flex items-center gap-1 border cursor-pointer hover:shadow-xs hover:scale-[1.01] transition-all ${getCategoryBadgeClass(
                              ev.category
                            )}`}
                            title={`${ev.title} · 클릭하여 수정/삭제`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${getCategoryDotColor(
                                ev.category
                              )}`}
                            />
                            <span className="truncate">{ev.title}</span>
                          </div>
                        );
                      })}
                      {dayEvents.length > 3 && (
                        <span className="text-[9px] text-slate-400 font-medium block pl-1">
                          +{dayEvents.length - 3}개 더보기
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Category Color Legend */}
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
            <span className="font-bold text-slate-400">구분:</span>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
              <span>전사HR</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
              <span>입사자</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
              <span>퇴사자</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-600" />
              <span>1차 수습평가</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
              <span>최종 수습평가</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
              <span>평가</span>
            </div>
            <div className="ml-auto text-[10px] text-slate-400 flex items-center gap-1">
              <Layers className="w-3 h-3 text-slate-400" />
              <span>기간 일정은 연결선으로 표시됩니다</span>
            </div>
          </div>
        </section>

        {/* Right Side: Detailed Schedule (5 cols) - Split into Daily (Top) and Categorized Weekly/Monthly (Bottom) */}
        <section className="lg:col-span-5 xl:col-span-5 space-y-5 flex flex-col">
          {/* Top Part: 일일 일정 (Daily Schedule) */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center space-x-2">
                <CalendarCheck className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  일일 일정 <span className="text-blue-600 font-bold ml-1">({viewMonth}월 {selectedDay}일)</span>
                </h3>
              </div>
              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                {dailyEvents.length}건
              </span>
            </div>

            {/* Daily Events List */}
            <div className="space-y-2.5 min-h-[140px]">
              {dailyEvents.length > 0 ? (
                dailyEvents.map((ev) => (
                  <div
                    key={ev.id}
                    onClick={() => setEditingEvent(ev)}
                    className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-blue-50/30 hover:border-blue-300 transition-all text-xs space-y-1.5 cursor-pointer group relative"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getCategoryBadgeClass(
                          ev.category
                        )}`}
                      >
                        {ev.category}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 text-[11px] font-mono font-medium">
                          {ev.endDate && ev.endDate !== (ev.startDate || ev.date) ? (
                            <span>{(ev.startDate || ev.date).slice(5)} ~ {ev.endDate.slice(5)}</span>
                          ) : (
                            <span>{(ev.startDate || ev.date).slice(5)}</span>
                          )}
                        </span>
                        <span className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-blue-600 rounded transition-all">
                          <Edit2 className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </div>

                    <h4 className="font-bold text-slate-900 text-sm leading-snug group-hover:text-blue-600 transition-colors">
                      {ev.title}
                    </h4>

                    {ev.location && (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-600 pt-0.5">
                        <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px] border border-slate-200/60">
                          {ev.location}
                        </span>
                      </div>
                    )}

                    {ev.description && (
                      <p className="text-[11px] text-slate-600 bg-white p-2 rounded border border-slate-100 mt-1">
                        {ev.description}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center text-slate-400 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                  <CalendarDays className="w-8 h-8 text-slate-300 mb-2" />
                  <p className="text-xs font-bold text-slate-600">{viewMonth}월 {selectedDay}일에 등록된 일정이 없습니다.</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">새로운 HR 일정을 추가해 보세요.</p>
                  <button
                    type="button"
                    onClick={onOpenAddSchedule}
                    className="mt-3 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded text-[11px] font-bold transition-colors cursor-pointer"
                  >
                    + 이 날짜에 일정 등록
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Part: 주간/월간 세부 일정 (Categorized Details) */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3.5 flex-1">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center space-x-2">
                <CalendarDays className="w-4 h-4 text-slate-700" />
                <h3 className="text-sm font-bold text-slate-900">주간 및 핵심 HR 세부 일정</h3>
              </div>
              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                전체 {events.length}건
              </span>
            </div>

            {/* 4 Categorized Sub-Groups */}
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {categoryGroups.map((group) => (
                <div
                  key={group.id}
                  className="p-3 rounded-lg bg-slate-50/70 border border-slate-200/80 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${group.badgeClass}`}
                      >
                        {group.name}
                      </span>
                      <span className="text-[10px] text-slate-500">{group.subTitle}</span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400">
                      {group.items.length}건
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {group.items.length > 0 ? (
                      group.items.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => setEditingEvent(item)}
                          className="p-2 rounded bg-white border border-slate-100 hover:border-blue-300 hover:shadow-xs transition-all cursor-pointer flex items-center justify-between text-xs group"
                          title="클릭하여 일정 수정/삭제"
                        >
                          <div className="min-w-0 pr-2 space-y-0.5">
                            <div className="flex items-center gap-1.5 truncate">
                              {group.id === '수습평가' && (
                                <span
                                  className={`px-1.5 py-0.2 rounded text-[9px] font-bold border shrink-0 ${getCategoryBadgeClass(
                                    item.category
                                  )}`}
                                >
                                  {item.category.includes('1차') ? '1차평가' : item.category.includes('최종') ? '최종평가' : '수습평가'}
                                </span>
                              )}
                              <p className="font-semibold text-slate-800 text-[11px] truncate group-hover:text-blue-600 transition-colors">
                                {item.title}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 truncate">
                              {item.location && (
                                <span className="font-semibold text-slate-600 bg-slate-100 px-1 py-0.2 rounded border border-slate-200/50">
                                  {item.location}
                                </span>
                              )}
                              {item.description && (
                                <span className="truncate">{item.description}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] font-mono font-bold text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                              {item.endDate && item.endDate !== (item.startDate || item.date)
                                ? `${(item.startDate || item.date).slice(5)}~${item.endDate.slice(5)}`
                                : (item.startDate || item.date).slice(5)}
                            </span>
                            <Edit2 className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-[11px] text-slate-400 py-1 pl-1">등록된 일정이 없습니다.</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Edit Schedule Modal */}
      <EditScheduleModal
        isOpen={Boolean(editingEvent)}
        event={editingEvent}
        onClose={() => setEditingEvent(null)}
        onUpdateEvent={(updated) => {
          if (onUpdateEvent) onUpdateEvent(updated);
          setEditingEvent(null);
        }}
        onDeleteEvent={(id) => {
          if (onDeleteEvent) onDeleteEvent(id);
          setEditingEvent(null);
        }}
      />
    </div>
  );
};
