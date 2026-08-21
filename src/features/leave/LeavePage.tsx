/**
 * 휴직자 관리 — db.listLeave() 조회 → LeavePersonItem[] 매핑 → 원본 LeaveManagement(hr-app.html) 그대로 렌더.
 * 등록/수정은 기존 LeaveForm 재사용, 상태전환(복직 처리 등)은 LeaveManagement 콜백에서 DB update로 배선.
 */
import { useEffect, useState } from 'react';
import { LeaveManagement } from '../../components/LeaveManagement';
import { listLeave, updateLeave, getOrgSetting, type LeaveRecord } from '../../lib/db';
import { logEvent } from '../../lib/audit';
import { dday } from '../../excel/derive';
import type { LeavePersonItem } from '../../types';
import { LeaveForm } from './LeaveForm';

const REASON_VALUES: LeavePersonItem['reason'][] = [
  '육아휴직',
  '질병휴직',
  '가족돌봄휴직',
  '학업휴직',
  '기타휴직',
];

function toReason(r: string | null): LeavePersonItem['reason'] {
  return (REASON_VALUES as readonly string[]).includes(r ?? '')
    ? (r as LeavePersonItem['reason'])
    : '기타휴직';
}

function toPerson(r: LeaveRecord): LeavePersonItem {
  return {
    id: r.id,
    name: r.name,
    department: r.dept ?? '-',
    position: r.position ?? '-',
    reason: toReason(r.reason),
    startDate: r.start_date ?? '-',
    expectedReturnDate: r.expected_return_date ?? '-',
    dDay: dday(r.expected_return_date) ?? 999,
    substituteAssigned: r.substitute_assigned,
    substituteName: r.substitute_name ?? undefined,
    contact: r.contact ?? '-',
    status: r.status,
  };
}

export function LeavePage() {
  const [records, setRecords] = useState<LeaveRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [formRecord, setFormRecord] = useState<LeaveRecord | 'new' | null>(null);
  const [inputEnabled, setInputEnabled] = useState(true);

  const reload = () => {
    setLoading(true);
    listLeave().then((data) => {
      setRecords(data);
      setLoading(false);
    });
  };

  useEffect(() => {
    reload();
    getOrgSetting('leave_input_enabled').then(setInputEnabled);
  }, []);

  const handleUpdateLeaveStatus = async (id: string, status: LeavePersonItem['status']) => {
    const ok = await updateLeave(id, { status });
    if (ok) {
      await logEvent('update_leave', { targetId: id, targetTable: 'leave_records', meta: { status } });
      reload();
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-24 text-sm text-slate-500">불러오는 중...</div>;
  }

  // dDay 는 dday() 내부의 today() 기준으로 매 렌더 재계산된다.
  const leavePersons = records.map(toPerson);

  return (
    <>
      <LeaveManagement
        leavePersons={leavePersons}
        onUpdateLeaveStatus={handleUpdateLeaveStatus}
        onRegisterNew={inputEnabled ? () => setFormRecord('new') : undefined}
      />

      {formRecord && (
        <LeaveForm
          record={formRecord === 'new' ? null : formRecord}
          onClose={() => setFormRecord(null)}
          onSaved={() => {
            setFormRecord(null);
            reload();
          }}
        />
      )}
    </>
  );
}
