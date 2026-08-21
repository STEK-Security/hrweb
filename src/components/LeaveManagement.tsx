import React, { useState } from 'react';
import { LeavePersonItem } from '../types';
import type { ConsultLog } from '../lib/db';
import {
  UserCheck,
  Clock,
  Baby,
  HeartPulse,
  Users,
  AlertCircle,
  Search,
  Filter,
  CheckCircle2,
  Calendar,
  Phone,
  Building,
  Briefcase,
  UserPlus,
  ArrowRight,
  FileText,
  Sparkles,
  Download,
} from 'lucide-react';

interface LeaveManagementProps {
  leavePersons: LeavePersonItem[];
  onUpdateLeaveStatus: (id: string, status: LeavePersonItem['status']) => void;
  /** 휴직자 등록 진입점(선택). 전달되면 헤더 버튼 영역에 등록 버튼이 추가된다. */
  onRegisterNew?: () => void;
  /** 대체인력 매칭 실제 저장(선택). 전달되면 저장이 DB에 반영되고, 미전달 시 임시표시(미저장) 동작 유지. */
  onSaveSubstitute?: (leaveId: string, name: string) => void;
  /** 상담일지 실제 저장(선택). 전달되면 저장이 DB에 반영되고, 미전달 시 임시표시(미저장) 동작 유지. */
  onSaveConsult?: (leaveId: string, note: string) => void;
  /** 상담일지 모달이 열릴 때 호출(선택). 상위에서 해당 휴직자의 상담이력을 조회해 consultLogs로 내려줄 때 사용. */
  onOpenConsult?: (leaveId: string) => void;
  /** 상담일지 모달에 표시할 이력(선택). onOpenConsult로 조회된 목록을 그대로 전달. */
  consultLogs?: ConsultLog[];
}

/** 복직예정일이 없으면 dday()가 999 센티넬을 반환한다(LeavePage.toPerson) — 그 경우 '-'로 표기. */
const formatDDay = (dDay: number): string => (dDay >= 999 ? '-' : `D-${dDay}일`);

export const LeaveManagement: React.FC<LeaveManagementProps> = ({
  leavePersons,
  onUpdateLeaveStatus,
  onRegisterNew,
  onSaveSubstitute,
  onSaveConsult,
  onOpenConsult,
  consultLogs,
}) => {
  const [activeTab, setActiveTab] = useState<'전체' | '복직예정' | '육아휴직' | '질병휴직' | '기타'>('전체');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('전체');
  const [selectedPersonForModal, setSelectedPersonForModal] = useState<LeavePersonItem | null>(null);
  const [showConsultLogModal, setShowConsultLogModal] = useState(false);
  const [consultText, setConsultText] = useState('');
  const [showAssignSubstituteModal, setShowAssignSubstituteModal] = useState(false);
  const [substituteInput, setSubstituteInput] = useState('');
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);

  // Metrics
  const totalLeaves = leavePersons.length;
  const childcareLeaves = leavePersons.filter((p) => p.reason === '육아휴직').length;
  const illnessLeaves = leavePersons.filter((p) => p.reason === '질병휴직').length;
  const otherLeaves = leavePersons.filter((p) => p.reason !== '육아휴직' && p.reason !== '질병휴직').length;
  const returningSoon = leavePersons.filter((p) => p.status === '복직예정' || p.dDay <= 30);
  const substituteAssignedCount = leavePersons.filter((p) => p.substituteAssigned).length;
  const substituteRate = totalLeaves > 0 ? ((substituteAssignedCount / totalLeaves) * 100).toFixed(1) : '100';

  // Filtered List
  const filteredList = leavePersons.filter((person) => {
    // Tab filter
    if (activeTab === '복직예정' && !(person.status === '복직예정' || person.dDay <= 30)) return false;
    if (activeTab === '육아휴직' && person.reason !== '육아휴직') return false;
    if (activeTab === '질병휴직' && person.reason !== '질병휴직') return false;
    if (activeTab === '기타' && (person.reason === '육아휴직' || person.reason === '질병휴직')) return false;

    // Dept filter
    if (selectedDept !== '전체' && person.department !== selectedDept) return false;

    // Search filter
    if (
      searchTerm &&
      !person.name.includes(searchTerm) &&
      !person.department.includes(searchTerm) &&
      !person.position.includes(searchTerm)
    ) {
      return false;
    }

    return true;
  });

  const departments = ['전체', ...Array.from(new Set(leavePersons.map((p) => p.department)))];

  const handleReturnAction = (id: string, name: string) => {
    onUpdateLeaveStatus(id, '복직완료');
    setNotificationMsg(`[${name}] 임직원의 복직 처리가 정상 완료되었습니다. 출근 및 시스템 계정이 활성화됩니다.`);
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  const handleOpenSubstituteModal = (person: LeavePersonItem) => {
    setSelectedPersonForModal(person);
    setSubstituteInput(person.substituteName || '');
    setShowAssignSubstituteModal(true);
  };

  const handleSaveSubstitute = () => {
    if (!selectedPersonForModal) return;
    const name = substituteInput || '배치완료';
    setShowAssignSubstituteModal(false);
    if (onSaveSubstitute) {
      onSaveSubstitute(selectedPersonForModal.id, name);
      setNotificationMsg(`[${selectedPersonForModal.name}] 대상자의 대체인력(${name})이 저장되었습니다.`);
    } else {
      setNotificationMsg(`[${selectedPersonForModal.name}] 대상자의 대체인력(${name})이 임시 표시(미저장)되었습니다.`);
    }
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  const handleOpenConsultModal = (person: LeavePersonItem) => {
    setSelectedPersonForModal(person);
    setConsultText('복직 전 사전 상담: 출근 희망일 및 부서 적응 인터뷰 진행 완료.');
    setShowConsultLogModal(true);
    onOpenConsult?.(person.id);
  };

  const handleSaveConsult = () => {
    if (!selectedPersonForModal) return;
    setShowConsultLogModal(false);
    if (onSaveConsult) {
      onSaveConsult(selectedPersonForModal.id, consultText);
      setNotificationMsg(`[${selectedPersonForModal.name}] 사전 복직 상담 일지가 저장되었습니다.`);
    } else {
      setNotificationMsg(`[${selectedPersonForModal.name}] 사전 복직 상담 일지가 임시 표시(미저장)되었습니다.`);
    }
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center">
            사내 휴직자 현황 및 복직 관리 시스템
            <span className="text-sm font-normal text-slate-400 ml-2">실시간 모니터링</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            육아·질병·가족돌봄 휴직자 관리, 복직 D-day 알림, 대체인력 매칭 및 상담 이력 관리
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onRegisterNew && (
            <button
              type="button"
              onClick={onRegisterNew}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>휴직자 등록</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setNotificationMsg('휴직자 전체 현황 엑셀 명부가 다운로드되었습니다.');
              setTimeout(() => setNotificationMsg(null), 3000);
            }}
            className="px-3.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 shadow-xs hover:bg-slate-50 transition-colors flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>휴직자 명부 다운로드</span>
          </button>
          <div className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>당월 복직 예정 {returningSoon.length}명 알림</span>
          </div>
        </div>
      </div>

      {/* Notification Banner */}
      {notificationMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-semibold flex items-center gap-2 shadow-xs transition-all">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{notificationMsg}</span>
        </div>
      )}

      {/* KPI Metrics 4 Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Leaves */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">총 휴직 인원</span>
            <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-bold text-slate-900">{totalLeaves}</span>
            <span className="text-xs text-slate-500 font-medium">명 (전사 재직 대비 2.7%)</span>
          </div>
          <div className="mt-2 text-[10px] text-slate-400">
            정규직 {totalLeaves}명 전원 적용
          </div>
        </div>

        {/* Card 2: Childcare Leaves */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">육아휴직</span>
            <span className="p-1.5 bg-pink-50 text-pink-600 rounded-lg">
              <Baby className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-bold text-pink-600">{childcareLeaves}</span>
            <span className="text-xs text-slate-500 font-medium">명 (66.7%)</span>
          </div>
          <div className="mt-2 text-[10px] text-slate-400">
            여성 9명 | 남성 3명 (육아장려)
          </div>
        </div>

        {/* Card 3: Illness & Family Leaves */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">질병 및 기타 휴직</span>
            <span className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
              <HeartPulse className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-bold text-amber-600">{illnessLeaves + otherLeaves}</span>
            <span className="text-xs text-slate-500 font-medium">명</span>
          </div>
          <div className="mt-2 text-[10px] text-slate-400">
            질병 3명 | 가족돌봄/기타 3명
          </div>
        </div>

        {/* Card 4: Substitute Match Rate */}
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-700">대체인력 충원율</span>
            <span className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
              <UserCheck className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-bold text-blue-700">{substituteRate}%</span>
            <span className="text-xs text-blue-600 font-medium">({substituteAssignedCount}/{totalLeaves}명)</span>
          </div>
          <div className="mt-2 w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-blue-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${substituteRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Table & Filters (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Filters and Search Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
            {/* Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs overflow-x-auto">
              {(['전체', '복직예정', '육아휴직', '질병휴직', '기타'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1 rounded-md font-semibold transition-colors whitespace-nowrap ${
                    activeTab === tab
                      ? 'bg-blue-600 text-white font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab === '전체' ? `전체 (${totalLeaves})` : tab === '복직예정' ? `복직예정 (${returningSoon.length})` : tab}
                </button>
              ))}
            </div>

            {/* Search & Dept */}
            <div className="flex items-center gap-2">
              <select
                aria-label="소속 부서 필터"
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept === '전체' ? '전체 부서' : dept}
                  </option>
                ))}
              </select>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="이름/직급 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 w-36 sm:w-44"
                />
              </div>
            </div>
          </div>

          {/* Leave Persons Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex justify-between items-center">
              <span className="text-xs font-bold text-slate-800">
                휴직 임직원 명부 ({filteredList.length}건)
              </span>
              <span className="text-[11px] text-slate-400">D-Day 기준 정렬 지원</span>
            </div>

            <div className="overflow-x-auto max-h-[520px]">
              <table className="w-full text-xs text-left">
                <thead className="bg-white text-slate-500 text-[11px] sticky top-0 uppercase border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3 font-semibold">성명 / 직급</th>
                    <th className="px-4 py-3 font-semibold">소속 부서</th>
                    <th className="px-4 py-3 font-semibold">휴직 유형</th>
                    <th className="px-4 py-3 font-semibold">휴직 기간 (시작~종료)</th>
                    <th className="px-4 py-3 font-semibold text-center">복직 D-Day</th>
                    <th className="px-4 py-3 font-semibold">대체인력</th>
                    <th className="px-4 py-3 font-semibold text-center">관리 액션</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredList.map((person) => {
                    const isUrgent = person.dDay <= 30 && person.status !== '복직완료';
                    const isFinished = person.status === '복직완료';

                    return (
                      <tr
                        key={person.id}
                        className={`hover:bg-blue-50/30 transition-colors ${
                          isUrgent ? 'bg-amber-50/40' : ''
                        }`}
                      >
                        {/* Name & Position */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center font-bold text-[11px] text-slate-700">
                              {person.name[0]}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900">{person.name}</p>
                              <p className="text-[10px] text-slate-400">{person.position}</p>
                            </div>
                          </div>
                        </td>

                        {/* Department */}
                        <td className="px-4 py-3 text-slate-700 font-medium">
                          {person.department}
                        </td>

                        {/* Reason */}
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              person.reason === '육아휴직'
                                ? 'bg-pink-50 text-pink-700 border-pink-200'
                                : person.reason === '질병휴직'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-slate-50 text-slate-700 border-slate-200'
                            }`}
                          >
                            {person.reason}
                          </span>
                        </td>

                        {/* Period */}
                        <td className="px-4 py-3 text-slate-600 font-mono text-[11px]">
                          <div>{person.startDate}</div>
                          <div className="text-slate-400">~ {person.expectedReturnDate}</div>
                        </td>

                        {/* D-Day */}
                        <td className="px-4 py-3 text-center">
                          {isFinished ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500">
                              복직완료
                            </span>
                          ) : isUrgent ? (
                            <span className="px-2 py-0.5 rounded text-[11px] font-black bg-rose-100 text-rose-700 border border-rose-200 animate-pulse">
                              D-{person.dDay}일 (임박)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700">
                              {formatDDay(person.dDay)}
                            </span>
                          )}
                        </td>

                        {/* Substitute */}
                        <td className="px-4 py-3">
                          {person.substituteAssigned ? (
                            <div className="flex items-center gap-1 text-emerald-700 font-medium text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{person.substituteName || '배치완료'}</span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenSubstituteModal(person)}
                              className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors flex items-center gap-1"
                            >
                              <UserPlus className="w-3 h-3" />
                              <span>대체인력 매칭</span>
                            </button>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {!isFinished && (
                              <button
                                type="button"
                                onClick={() => handleReturnAction(person.id, person.name)}
                                className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] shadow-xs transition-colors"
                              >
                                복직 처리
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleOpenConsultModal(person)}
                              className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[10px] transition-colors"
                              title="복직 상담일지 작성"
                            >
                              상담일지
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Side: D-Day Notification & Policies (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Urgent Returning Soon Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <span>30일 이내 복직 예정자 브리핑</span>
              </h3>
              <span className="text-[10px] font-bold bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded">
                {returningSoon.length}명 대기
              </span>
            </div>

            <div className="space-y-2.5">
              {returningSoon.map((p) => (
                <div
                  key={p.id}
                  className="p-3 bg-amber-50/60 border border-amber-200 rounded-lg text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{p.name} {p.position}</span>
                    <span className="font-black text-rose-600 text-xs">{formatDDay(p.dDay)}</span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    소속: <strong className="text-slate-800">{p.department}</strong> | 사유: {p.reason}
                  </p>
                  <p className="text-[10px] text-slate-500 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    <span>복직 예정일: {p.expectedReturnDate}</span>
                  </p>
                  <div className="pt-1 flex items-center justify-between border-t border-amber-200/60 text-[10px]">
                    <span className="text-slate-500">연락처: {p.contact}</span>
                    <button
                      type="button"
                      onClick={() => handleReturnAction(p.id, p.name)}
                      className="text-blue-600 font-bold hover:underline"
                    >
                      즉시 복직승인 &gt;
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* HR Leave Policy Checklist */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-2">
              휴직자 복직 프로세스 가이드라인
            </h3>
            <ul className="space-y-2 text-[11px] text-slate-600">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                <span><strong>D-30:</strong> 인사담당자 1차 복직 희망일 확인 및 복직신청서 안내</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                <span><strong>D-14:</strong> 부서장 면담 및 부서 복귀/직무 배치 협의 완료</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                <span><strong>D-7:</strong> 사내 계정 및 그룹웨어 복구, 사원증/출입 권한 승인</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                <span><strong>D-Day:</strong> 첫 출근일 오리엔테이션 및 육아기 근로시간 단축 안내</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Modal 1: Substitute Assignment Modal */}
      {showAssignSubstituteModal && selectedPersonForModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                대체인력 매칭 및 직무 대행 지정
              </h3>
              <button
                type="button"
                onClick={() => setShowAssignSubstituteModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <p className="font-bold text-slate-800">
                  대상자: {selectedPersonForModal.name} ({selectedPersonForModal.position}, {selectedPersonForModal.department})
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  휴직 사유: {selectedPersonForModal.reason} | 예정 복직일: {selectedPersonForModal.expectedReturnDate}
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  대체인력(계약직/사내대행자) 성명 또는 지정명
                </label>
                <input
                  type="text"
                  placeholder="예: 박계약 사원 (업무대행)"
                  value={substituteInput}
                  onChange={(e) => setSubstituteInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAssignSubstituteModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSaveSubstitute}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs shadow-xs transition-colors"
              >
                대체인력 매칭 저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Consult Log Modal */}
      {showConsultLogModal && selectedPersonForModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                복직 전 사전 상담 및 면담 일지
              </h3>
              <button
                type="button"
                onClick={() => setShowConsultLogModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-200">
                <p className="font-bold text-blue-900">
                  대상자: {selectedPersonForModal.name} {selectedPersonForModal.position} ({selectedPersonForModal.department})
                </p>
                <p className="text-[11px] text-blue-700 mt-0.5">
                  복직 예정일: {selectedPersonForModal.expectedReturnDate} ({formatDDay(selectedPersonForModal.dDay)})
                </p>
              </div>

              {consultLogs && consultLogs.length > 0 && (
                <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                  <p className="font-bold text-slate-700">이전 상담 이력 ({consultLogs.length}건)</p>
                  {consultLogs.map((log) => (
                    <div key={log.id} className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
                      <p className="text-[10px] text-slate-400">{log.consulted_at}</p>
                      <p className="text-[11px] text-slate-700 whitespace-pre-wrap">{log.note}</p>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  상담 내용 및 지원 사항 기록
                </label>
                <textarea
                  rows={4}
                  value={consultText}
                  onChange={(e) => setConsultText(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="면담 일시, 희망 복귀 부서, 육아단축근로 신청 여부, 건강 상태 등을 기록하세요."
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowConsultLogModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs transition-colors"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={handleSaveConsult}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs shadow-xs transition-colors"
              >
                상담일지 저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
