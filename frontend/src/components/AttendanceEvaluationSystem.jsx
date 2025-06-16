import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Users, FileText, AlertTriangle, CheckCircle, XCircle, Plus, Search, Filter, Download } from 'lucide-react';

const AttendanceEvaluationSystem = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [employees, setEmployees] = useState([
    {
      id: 1,
      name: '김철수',
      department: '개발팀',
      position: '시니어 개발자',
      deadlineCompliance: 92,
      reportSubmission: 95,
      meetingAttendance: 88,
      collaboration: 90,
      recentViolations: 1
    },
    {
      id: 2,
      name: '이영희',
      department: '마케팅팀',
      position: '팀장',
      deadlineCompliance: 98,
      reportSubmission: 100,
      meetingAttendance: 95,
      collaboration: 96,
      recentViolations: 0
    },
    {
      id: 3,
      name: '박지훈',
      department: '영업팀',
      position: '주임',
      deadlineCompliance: 75,
      reportSubmission: 80,
      meetingAttendance: 70,
      collaboration: 78,
      recentViolations: 3
    }
  ]);

  const [evaluationData, setEvaluationData] = useState([]);
  const [newViolation, setNewViolation] = useState({
    employeeId: '',
    type: '',
    description: '',
    severity: 'low',
    date: new Date().toISOString().split('T')[0]
  });

  const violationTypes = [
    '마감일 준수 위반',
    '보고서 미제출',
    '회의 무단 불참',
    '협업 일정 지연',
    '프로세스 미준수'
  ];

  const getScoreColor = (score) => {
    if (score >= 90) return 'text-green-600 bg-green-100';
    if (score >= 80) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const calculateTotalScore = (employee) => {
    const weights = {
      deadlineCompliance: 0.3,
      reportSubmission: 0.25,
      meetingAttendance: 0.25,
      collaboration: 0.2
    };

    return Math.round(
      employee.deadlineCompliance * weights.deadlineCompliance +
      employee.reportSubmission * weights.reportSubmission +
      employee.meetingAttendance * weights.meetingAttendance +
      employee.collaboration * weights.collaboration
    );
  };

  const handleAddViolation = () => {
    if (newViolation.employeeId && newViolation.type && newViolation.description) {
      const violation = {
        id: Date.now(),
        ...newViolation,
        timestamp: new Date().toISOString()
      };

      setEvaluationData([...evaluationData, violation]);

      // 해당 직원의 위반 횟수 업데이트
      setEmployees(prev => prev.map(emp =>
        emp.id === parseInt(newViolation.employeeId)
          ? { ...emp, recentViolations: emp.recentViolations + 1 }
          : emp
      ));

      setNewViolation({
        employeeId: '',
        type: '',
        description: '',
        severity: 'low',
        date: new Date().toISOString().split('T')[0]
      });
    }
  };

  const DashboardView = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">총 직원 수</p>
              <p className="text-2xl font-bold text-gray-900">{employees.length}</p>
            </div>
            <Users className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">평균 준수율</p>
              <p className="text-2xl font-bold text-green-600">
                {Math.round(employees.reduce((acc, emp) => acc + calculateTotalScore(emp), 0) / employees.length)}%
              </p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">이번 달 위반</p>
              <p className="text-2xl font-bold text-red-600">
                {employees.reduce((acc, emp) => acc + emp.recentViolations, 0)}
              </p>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">우수 직원</p>
              <p className="text-2xl font-bold text-blue-600">
                {employees.filter(emp => calculateTotalScore(emp) >= 90).length}
              </p>
            </div>
            <FileText className="h-8 w-8 text-blue-600" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">직원별 근태 현황</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">직원명</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">부서</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">마감 준수율</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">보고서 제출율</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">회의 참석률</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">협업 점수</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">총점</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">위반 횟수</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {employees.map((employee) => (
                <tr key={employee.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-medium text-gray-900">{employee.name}</div>
                      <div className="text-sm text-gray-500">{employee.position}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{employee.department}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getScoreColor(employee.deadlineCompliance)}`}>
                      {employee.deadlineCompliance}%
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getScoreColor(employee.reportSubmission)}`}>
                      {employee.reportSubmission}%
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getScoreColor(employee.meetingAttendance)}`}>
                      {employee.meetingAttendance}%
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getScoreColor(employee.collaboration)}`}>
                      {employee.collaboration}%
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getScoreColor(calculateTotalScore(employee))}`}>
                      {calculateTotalScore(employee)}%
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      employee.recentViolations === 0 ? 'text-green-600 bg-green-100' :
                      employee.recentViolations <= 2 ? 'text-yellow-600 bg-yellow-100' :
                      'text-red-600 bg-red-100'
                    }`}>
                      {employee.recentViolations}회
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const ViolationManagement = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">위반 사항 등록</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">직원 선택</label>
              <select
                value={newViolation.employeeId}
                onChange={(e) => setNewViolation({...newViolation, employeeId: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">직원을 선택하세요</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name} - {emp.department}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">위반 유형</label>
              <select
                value={newViolation.type}
                onChange={(e) => setNewViolation({...newViolation, type: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">위반 유형을 선택하세요</option>
                {violationTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">발생 날짜</label>
              <input
                type="date"
                value={newViolation.date}
                onChange={(e) => setNewViolation({...newViolation, date: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">심각도</label>
              <select
                value={newViolation.severity}
                onChange={(e) => setNewViolation({...newViolation, severity: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="low">경미</option>
                <option value="medium">보통</option>
                <option value="high">심각</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">상세 설명</label>
              <textarea
                value={newViolation.description}
                onChange={(e) => setNewViolation({...newViolation, description: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows="3"
                placeholder="위반 사항에 대한 상세 설명을 입력하세요"
              />
            </div>
          </div>

          <div className="mt-6">
            <button
              onClick={handleAddViolation}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center"
            >
              <Plus className="h-4 w-4 mr-2" />
              위반 사항 등록
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">최근 위반 사항</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">날짜</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">직원</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">위반 유형</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">심각도</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">설명</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {evaluationData.slice(0, 10).map((violation) => {
                const employee = employees.find(emp => emp.id === parseInt(violation.employeeId));
                return (
                  <tr key={violation.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">{violation.date}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {employee ? `${employee.name} (${employee.department})` : '알 수 없음'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{violation.type}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        violation.severity === 'high' ? 'text-red-600 bg-red-100' :
                        violation.severity === 'medium' ? 'text-yellow-600 bg-yellow-100' :
                        'text-green-600 bg-green-100'
                      }`}>
                        {violation.severity === 'high' ? '심각' : violation.severity === 'medium' ? '보통' : '경미'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{violation.description}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-blue-600 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">근태 평가 관리 시스템</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center">
                <Download className="h-4 w-4 mr-2" />
                보고서 내보내기
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'dashboard'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              대시보드
            </button>
            <button
              onClick={() => setActiveTab('violations')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'violations'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              위반 사항 관리
            </button>
          </nav>
        </div>

        {activeTab === 'dashboard' && <DashboardView />}
        {activeTab === 'violations' && <ViolationManagement />}
      </div>
    </div>
  );
};

export default AttendanceEvaluationSystem;
