import React, { useState } from 'react';
import { EvaluationSubTab, EvaluationItem } from '../types';
// TODO(redesign): DB 데이터로 교체 예정
const initialEvaluations: EvaluationItem[] = [];
import {
  Award,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileCheck,
  Search,
  Filter,
  UserCheck,
  Eye,
  Building,
  TrendingUp,
} from 'lucide-react';

interface EvaluationManagementProps {
  evaluations: EvaluationItem[];
  onOpenEvalModal: (item: EvaluationItem) => void;
  onUpdateEvalStatus: (id: string, status: EvaluationItem['status'], grade?: EvaluationItem['finalGrade'], feedback?: string) => void;
}

export const EvaluationManagement: React.FC<EvaluationManagementProps> = ({
  evaluations,
  onOpenEvalModal,
  onUpdateEvalStatus,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<EvaluationSubTab>('수습평가');
  const [statusFilter, setStatusFilter] = useState<'전체' | '진행중' | '완료' | '미작성'>('전체');
  const [searchTerm, setSearchTerm] = useState('');

  // Filter evaluations for the current active sub-tab
  const currentTabEvaluations = evaluations.filter((ev) => ev.type === activeSubTab);

  const filteredEvaluations = currentTabEvaluations.filter((ev) => {
    if (statusFilter !== '전체' && ev.status !== statusFilter) return false;
    if (
      searchTerm.trim() &&
      !ev.targetName.includes(searchTerm) &&
      !ev.department.includes(searchTerm)
    ) {
      return false;
    }
    return true;
  });

  // Stats for the current sub-tab
  const totalCount = currentTabEvaluations.length;
  const completedCount = currentTabEvaluations.filter((e) => e.status === '완료').length;
  const inProgressCount = currentTabEvaluations.filter((e) => e.status === '진행중').length;
  const unwrittenCount = currentTabEvaluations.filter((e) => e.status === '미작성').length;
  const completionRate = Math.round((completedCount / (totalCount || 1)) * 100);

  const getStatusBadge = (status: EvaluationItem['status']) => {
    switch (status) {
      case '완료':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case '진행중':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case '미작성':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  const getGradeBadge = (grade?: EvaluationItem['finalGrade']) => {
    if (!grade) return <span className="text-slate-400 font-mono">-</span>;
    return (
      <span
        className={`px-2 py-0.5 rounded-full font-black text-xs ${
          grade === 'S'
            ? 'bg-purple-100 text-purple-800 border border-purple-300'
            : grade === 'A'
            ? 'bg-blue-100 text-blue-800 border border-blue-300'
            : grade === 'B'
            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
            : 'bg-amber-100 text-amber-800 border border-amber-300'
        }`}
      >
        {grade}등급
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-800">
              인사 평가 관리 시스템
            </span>
            <span className="text-xs text-slate-500">
              수습평가, 역량평가, MBO 성과평가 통합 진행 관리 및 심의 의결
            </span>
          </div>
          <h1 className="text-xl font-black text-slate-900 mt-1">
            {new Date().getFullYear()}년도 임직원 평가 프레임워크 및 대상자 진행 현황판
          </h1>
        </div>

        {/* 3 Main Sub-Tabs */}
        <div className="flex items-center space-x-1.5 bg-slate-100 p-1.5 rounded-xl text-xs font-bold self-start md:self-auto">
          {(['수습평가', '역량평가', '성과평가'] as EvaluationSubTab[]).map((tab) => {
            const isActive = activeSubTab === tab;
            return (
              <button
                key={tab}
                type="button"
                id={`eval-tab-${tab}`}
                onClick={() => {
                  setActiveSubTab(tab);
                  setStatusFilter('전체');
                }}
                className={`px-4 py-2 rounded-lg transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                {tab === '수습평가' && '1. 수습평가 (1·3개월)'}
                {tab === '역량평가' && '2. 역량평가 (상·하반기)'}
                {tab === '성과평가' && '3. 성과평가 (연간 MBO)'}
              </button>
            );
          })}
        </div>
      </div>

      {/* Stats Summary Cards for Current Evaluation Type */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-slate-500 block">총 평가 대상자</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900">{totalCount}명</span>
            <span className="text-xs font-semibold text-slate-500">{activeSubTab}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-slate-500 block">평가 완료 (의결 확정)</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-black text-emerald-600">{completedCount}명</span>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
              {completionRate}% 완료
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-slate-500 block">진행 중 (부서장 심사)</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-black text-blue-600">{inProgressCount}명</span>
            <span className="text-xs text-blue-600 font-semibold">1차 작성완료</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-slate-500 block">미작성 (제출 대기)</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-black text-rose-600">{unwrittenCount}명</span>
            <span className="text-xs text-rose-600 font-semibold">제출 독려필요</span>
          </div>
        </div>
      </div>

      {/* Main Target List Table */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              [{activeSubTab}] 대상자 목록 및 평가 진행 상태 프레임워크
            </h3>
            <p className="text-xs text-slate-500">
              대상자를 클릭하거나 '상세 평가표' 버튼을 눌러 평가표 열람 및 심의 등급을 부여하세요.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                id="search-eval-target"
                placeholder="대상자 또는 부서 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Status Filter */}
            <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
              {(['전체', '진행중', '완료', '미작성'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 rounded-md transition-colors ${
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

        {/* Evaluation Table */}
        <div className="border border-slate-200 rounded-xl overflow-x-auto text-xs">
          <table className="w-full text-left">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="px-3.5 py-2.5">피평가자</th>
                <th className="px-3.5 py-2.5">소속 부서 / 직급</th>
                <th className="px-3.5 py-2.5">평가 차수/단계</th>
                <th className="px-3.5 py-2.5">1차 평가자</th>
                <th className="px-3.5 py-2.5 text-center">진행 상태</th>
                <th className="px-3.5 py-2.5">마감 기한</th>
                <th className="px-3.5 py-2.5 text-center">확정 등급</th>
                <th className="px-3.5 py-2.5 text-right">상세 심의</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredEvaluations.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-3.5 py-3 font-bold text-slate-900">
                    <span className="text-sm">{item.targetName}</span>
                  </td>
                  <td className="px-3.5 py-3 text-slate-800">
                    {item.department} / <span className="font-semibold">{item.position}</span>
                  </td>
                  <td className="px-3.5 py-3">
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
                      {item.stage}
                    </span>
                  </td>
                  <td className="px-3.5 py-3 text-slate-700">
                    {item.evaluatorName} ({item.evaluatorPosition})
                  </td>
                  <td className="px-3.5 py-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${getStatusBadge(
                        item.status
                      )}`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="px-3.5 py-3 font-mono text-[11px] text-slate-600">
                    {item.dueDate}
                  </td>
                  <td className="px-3.5 py-3 text-center">
                    {getGradeBadge(item.finalGrade)}
                  </td>
                  <td className="px-3.5 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => onOpenEvalModal(item)}
                      className="inline-flex items-center space-x-1 px-3 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs border border-blue-200 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>평가표 심의</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
