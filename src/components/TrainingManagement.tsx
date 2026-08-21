import React, { useState } from 'react';
import { TrainingCourseItem, TrainingParticipant } from '../types';
// TODO(redesign): DB 데이터로 교체 예정
const initialTrainingCourses: TrainingCourseItem[] = [];
const initialTrainingParticipants: TrainingParticipant[] = [];
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';
import {
  GraduationCap,
  CheckCircle,
  AlertTriangle,
  Send,
  Calendar,
  BookOpen,
  Users,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Sparkles,
  Plus,
  Pencil,
  Trash2,
} from 'lucide-react';

export interface TrainingManagementProps {
  /** 미전달 시 내부 데모데이터 사용 */
  courses?: TrainingCourseItem[];
  records?: TrainingParticipant[];
  onCreateCourse?: () => void;
  onEditCourse?: (courseId: string) => void;
  onDeleteCourse?: (courseId: string) => void;
  onCreateRecordForCourse?: (courseId: string) => void;
  onEditRecord?: (recordId: string) => void;
  onDeleteRecord?: (recordId: string) => void;
}

export const TrainingManagement: React.FC<TrainingManagementProps> = ({
  courses = initialTrainingCourses,
  records: participants = initialTrainingParticipants,
  onCreateCourse,
  onEditCourse,
  onDeleteCourse,
  onCreateRecordForCourse,
  onEditRecord,
  onDeleteRecord,
}) => {
  const [statusFilter, setStatusFilter] = useState<'전체' | '수료' | '미수료' | '진행중'>('전체');
  const [categoryFilter, setCategoryFilter] = useState<string>('전체');
  const [searchTerm, setSearchTerm] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Overall Statistics
  const totalTargetEmployees = courses.reduce((acc, c) => acc + c.targetCount, 0);
  const totalCompletedEmployees = courses.reduce((acc, c) => acc + c.completedCount, 0);
  const overallCompletionRate =
    totalTargetEmployees === 0 ? '0.0' : ((totalCompletedEmployees / totalTargetEmployees) * 100).toFixed(1);

  // 법정의무교육 / 신규입사자OJT 이수율 — 데모 상수 대신 courses(props) 기준으로 계산
  const mandatoryCourses = courses.filter((c) => c.category === '법정의무교육');
  const mandatoryTarget = mandatoryCourses.reduce((acc, c) => acc + c.targetCount, 0);
  const mandatoryCompleted = mandatoryCourses.reduce((acc, c) => acc + c.completedCount, 0);
  const mandatoryRate = mandatoryTarget === 0 ? '0.0' : ((mandatoryCompleted / mandatoryTarget) * 100).toFixed(1);

  const ojtCourses = courses.filter((c) => c.category === '신규입사자OJT');
  const ojtTarget = ojtCourses.reduce((acc, c) => acc + c.targetCount, 0);
  const ojtCompleted = ojtCourses.reduce((acc, c) => acc + c.completedCount, 0);
  const ojtRate = ojtTarget === 0 ? '0.0' : ((ojtCompleted / ojtTarget) * 100).toFixed(1);

  // 집중 독려 대상(미수료) — records(props) 기준, 부서별 인원 상위 순 요약
  const uncompletedParticipants = participants.filter((p) => p.status === '미수료');
  const uncompletedByDept = Array.from(
    uncompletedParticipants
      .reduce((m, p) => m.set(p.department, (m.get(p.department) ?? 0) + 1), new Map<string, number>())
      .entries()
  ).sort((a, b) => b[1] - a[1]);
  const uncompletedSummary =
    uncompletedByDept.length === 0
      ? '미수료 대상자가 없습니다.'
      : uncompletedByDept.slice(0, 2).map(([dept, n]) => `${dept} ${n}명`).join(', ') +
        (uncompletedByDept.length > 2 ? ' 등' : '');

  const chartData = [
    { name: '수료 완료', value: totalCompletedEmployees, color: '#10b981' },
    { name: '미수료/진행중', value: totalTargetEmployees - totalCompletedEmployees, color: '#f43f5e' },
  ];

  const filteredParticipants = participants.filter((p) => {
    if (statusFilter !== '전체' && p.status !== statusFilter) return false;
    if (searchTerm.trim() && !p.name.includes(searchTerm) && !p.department.includes(searchTerm)) {
      return false;
    }
    return true;
  });

  const handleSendReminder = () => {
    const uncompletedCount = participants.filter((p) => p.status === '미수료').length;
    setToastMessage(`미수료 대상자(${uncompletedCount}명) 전원에게 사내 메신저 및 이메일 수강 독려 알림이 발송되었습니다.`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Toast alert */}
      {toastMessage && (
        <div className="bg-emerald-600 text-white p-3.5 rounded-xl shadow-lg flex items-center justify-between text-xs font-bold animate-in fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-emerald-200 hover:text-white"
          >
            닫기
          </button>
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-800">
              교육 관리 시스템
            </span>
            <span className="text-xs text-slate-500">
              법정의무교육, 직무 역량 개발 및 신규 입사자 OJT 이수율 관리
            </span>
          </div>
          <h1 className="text-xl font-black text-slate-900 mt-1">
            2026년도 사내 교육 과정 및 수료·미수료 현황판
          </h1>
        </div>

        <div className="flex items-center space-x-3">
          {onCreateCourse && (
            <button
              type="button"
              id="btn-create-training-course"
              onClick={onCreateCourse}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>과정 등록</span>
            </button>
          )}
          <button
            type="button"
            id="btn-send-training-reminder"
            onClick={handleSendReminder}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            <span>미수료자 전원 원클릭 독려 알림 발송</span>
          </button>
        </div>
      </div>

      {/* Top Row: Overall Donut Rate & Key KPIs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Donut Chart: Overall Completion Rate */}
        <div className="lg:col-span-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-3">
          <div className="border-b border-slate-100 pb-2.5">
            <h3 className="text-sm font-bold text-slate-900">전체 교육 평균 수료율 시각화</h3>
            <p className="text-xs text-slate-500">전사 법정 및 직무 필수 교육 종합</p>
          </div>

          <div className="h-44 relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie isAnimationActive={false}
                  data={chartData}
                  dataKey="value"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={3}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-tc-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => [`${v}명`, '인원']} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute flex flex-col items-center justify-center text-center pointer-events-none">
              <span className="text-2xl font-black text-slate-900">{overallCompletionRate}%</span>
              <span className="text-[10px] text-slate-500 font-semibold">종합 수료율</span>
            </div>
          </div>

          <div className="flex justify-center space-x-4 text-xs">
            <div className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-slate-600 font-medium">수료 ({totalCompletedEmployees}명)</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span className="text-slate-600 font-medium">
                미수료 ({totalTargetEmployees - totalCompletedEmployees}명)
              </span>
            </div>
          </div>
        </div>

        {/* 3 Status KPI Cards */}
        <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-600">
              <span className="text-xs font-bold">법정의무교육 이수율</span>
              <BookOpen className="w-4 h-4 text-blue-600" />
            </div>
            <div className="my-2">
              <span className="text-3xl font-black text-blue-600">{mandatoryRate}%</span>
              <p className="text-xs text-slate-500 mt-1">대상 {mandatoryTarget}명 중 {mandatoryCompleted}명 수료</p>
            </div>
            <div className="bg-blue-50 p-2 rounded-lg text-[11px] text-blue-800 font-semibold">
              법정의무교육 {mandatoryCourses.length}개 과정 진행 중
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-600">
              <span className="text-xs font-bold">신규 입사자 OJT 이수율</span>
              <Users className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="my-2">
              <span className="text-3xl font-black text-emerald-600">{ojtRate}%</span>
              <p className="text-xs text-slate-500 mt-1">대상 {ojtTarget}명 중 {ojtCompleted}명 수료</p>
            </div>
            <div className="bg-emerald-50 p-2 rounded-lg text-[11px] text-emerald-800 font-semibold">
              신규입사자 OJT {ojtCourses.length}개 과정 진행 중
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-600">
              <span className="text-xs font-bold">집중 독려 대상 (미수료)</span>
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            </div>
            <div className="my-2">
              <span className="text-3xl font-black text-rose-600">{uncompletedParticipants.length}명</span>
              <p className="text-xs text-slate-500 mt-1">{uncompletedSummary}</p>
            </div>
            <div className="bg-rose-50 p-2 rounded-lg text-[11px] text-rose-800 font-semibold">
              사내 모바일 러닝 앱 링크 재전송
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Training Courses List & Schedule */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              2026년 정규 사내 교육 과정 및 진행 현황
            </h3>
            <p className="text-xs text-slate-500">
              과정별 교육 기간, 대상 인원, 수료율 및 필수 여부
            </p>
          </div>

          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
            {(['전체', '법정의무교육', '직무전문교육', '리더십교육', '신규입사자OJT'] as const).map(
              (cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1 rounded-md transition-colors ${
                    categoryFilter === cat
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {cat}
                </button>
              )
            )}
          </div>
        </div>

        <div className="border border-slate-200 rounded-xl overflow-x-auto text-xs">
          <table className="w-full text-left">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="px-3.5 py-2.5">교육 과정명</th>
                <th className="px-3.5 py-2.5">분류</th>
                <th className="px-3.5 py-2.5">교육 기간</th>
                <th className="px-3.5 py-2.5">담당 강사/기관</th>
                <th className="px-3.5 py-2.5 text-center">대상/수료</th>
                <th className="px-3.5 py-2.5 text-center">수료율</th>
                <th className="px-3.5 py-2.5 text-center">상태</th>
                {(onEditCourse || onDeleteCourse || onCreateRecordForCourse) && (
                  <th className="px-3.5 py-2.5 text-center">관리</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {courses
                .filter((c) => categoryFilter === '전체' || c.category === categoryFilter)
                .map((course) => (
                  <tr key={course.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-3.5 py-3 font-bold text-slate-900">
                      <div className="flex items-center space-x-1.5">
                        <span>{course.title}</span>
                        {course.mandatory && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] bg-rose-100 text-rose-700 font-bold">
                            필수
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3.5 py-3 text-slate-700">{course.category}</td>
                    <td className="px-3.5 py-3 font-mono text-[11px] text-slate-600">
                      {course.startDate} ~ {course.endDate}
                    </td>
                    <td className="px-3.5 py-3 text-slate-700">{course.instructor}</td>
                    <td className="px-3.5 py-3 text-center">
                      <span className="font-semibold text-slate-900">
                        {course.completedCount} / {course.targetCount}명
                      </span>
                    </td>
                    <td className="px-3.5 py-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded font-black text-xs ${
                          course.completionRate >= 95
                            ? 'bg-emerald-100 text-emerald-800'
                            : course.completionRate >= 80
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {course.completionRate}%
                      </span>
                    </td>
                    <td className="px-3.5 py-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          course.status === '진행중'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {course.status}
                      </span>
                    </td>
                    {(onEditCourse || onDeleteCourse || onCreateRecordForCourse) && (
                      <td className="px-3.5 py-3 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          {onCreateRecordForCourse && (
                            <button
                              type="button"
                              aria-label="수료현황 등록"
                              onClick={() => onCreateRecordForCourse(course.id)}
                              className="p-1 rounded text-blue-600 hover:bg-blue-50"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {onEditCourse && (
                            <button
                              type="button"
                              aria-label="과정 수정"
                              onClick={() => onEditCourse(course.id)}
                              className="p-1 rounded text-slate-600 hover:bg-slate-100"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {onDeleteCourse && (
                            <button
                              type="button"
                              aria-label="과정 삭제"
                              onClick={() => onDeleteCourse(course.id)}
                              className="p-1 rounded text-rose-600 hover:bg-rose-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row 3: Participants Management (수료 / 미수료 인원 구분 현황판) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              수료 / 미수료 인원 구분 현황판 (개별 수강 이력)
            </h3>
            <p className="text-xs text-slate-500">
              대상자별 교육 이수 여부 및 미수료자 관리
            </p>
          </div>

          <div className="flex items-center space-x-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                id="search-participant"
                placeholder="이름 또는 부서 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Status Filter */}
            <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
              {(['전체', '수료', '미수료', '진행중'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    statusFilter === st
                      ? 'bg-white text-blue-700 shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="border border-slate-200 rounded-xl overflow-x-auto text-xs">
          <table className="w-full text-left">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="px-3.5 py-2.5">성명 / 직급</th>
                <th className="px-3.5 py-2.5">소속 부서</th>
                <th className="px-3.5 py-2.5">수강 교육 과정</th>
                <th className="px-3.5 py-2.5 text-center">수료 상태</th>
                <th className="px-3.5 py-2.5">수료 일자</th>
                <th className="px-3.5 py-2.5 text-center">평가 점수</th>
                {(onEditRecord || onDeleteRecord) && (
                  <th className="px-3.5 py-2.5 text-center">관리</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredParticipants.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-3.5 py-3 font-bold text-slate-900">
                    {p.name} ({p.position})
                  </td>
                  <td className="px-3.5 py-3 text-slate-800">{p.department}</td>
                  <td className="px-3.5 py-3 font-medium text-slate-900">{p.courseTitle}</td>
                  <td className="px-3.5 py-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        p.status === '수료'
                          ? 'bg-emerald-100 text-emerald-800'
                          : p.status === '미수료'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="px-3.5 py-3 font-mono text-slate-600">
                    {p.completedDate || '-'}
                  </td>
                  <td className="px-3.5 py-3 text-center font-bold text-slate-800">
                    {p.score ? `${p.score}점` : '-'}
                  </td>
                  {(onEditRecord || onDeleteRecord) && (
                    <td className="px-3.5 py-3 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        {onEditRecord && (
                          <button
                            type="button"
                            aria-label="수료현황 수정"
                            onClick={() => onEditRecord(p.id)}
                            className="p-1 rounded text-slate-600 hover:bg-slate-100"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onDeleteRecord && (
                          <button
                            type="button"
                            aria-label="수료현황 삭제"
                            onClick={() => onDeleteRecord(p.id)}
                            className="p-1 rounded text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
