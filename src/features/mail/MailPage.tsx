/**
 * 메일 발송(T-mail) — Edge Function(send-mail) 즉시발송 + 발송이력(mail_queue) 조회.
 * 기본 UI(추후 재구성 전제): 작성 폼 + 발송 이력 표. is_hr 전원 접근, 특별 게이트 없음.
 */
import { useEffect, useState } from 'react';
import { Loader2, Mail, Send, X } from 'lucide-react';
import { listEmployees, getSensitiveMasked, listMailQueue, type Employee, type MailQueueRow } from '../../lib/db';
import { sendMailNow, flushMailQueue } from '../../lib/mail';
import { logEvent } from '../../lib/audit';
import { EmployeePicker } from '../../components/EmployeePicker';

interface Recipient {
  empId: string;
  name: string;
  email: string;
}

const TEMPLATES: { label: string; subject: string; body: string }[] = [
  {
    label: '교육 독려',
    subject: '[교육] 이수 독려 안내',
    body: '안녕하세요, 담당 교육 과정의 이수 기한이 다가오고 있습니다. 빠른 시일 내 이수를 완료해 주시기 바랍니다.',
  },
  {
    label: '안내',
    subject: '[안내] 인사팀 공지',
    body: '안녕하세요, 인사팀입니다. 아래 내용을 확인해 주세요.\n\n',
  },
];

export function MailPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [manualEmails, setManualEmails] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  const [history, setHistory] = useState<MailQueueRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [flushing, setFlushing] = useState(false);

  useEffect(() => {
    listEmployees().then(setEmployees);
    reloadHistory();
  }, []);

  const reloadHistory = () => {
    setHistoryLoading(true);
    listMailQueue(50)
      .then(setHistory)
      .finally(() => setHistoryLoading(false));
  };

  const addRecipient = async (empId: string, emp: Employee) => {
    if (!empId) return;
    if (recipients.some((r) => r.empId === empId)) return;
    const masked = await getSensitiveMasked(empId);
    const email = masked?.email as string | undefined;
    if (!email) {
      setMessage({ type: 'error', text: `${emp._name}님은 등록된 이메일이 없어 제외되었습니다.` });
      return;
    }
    setRecipients((prev) => [...prev, { empId, name: emp._name, email }]);
  };

  const removeRecipient = (empId: string) => {
    setRecipients((prev) => prev.filter((r) => r.empId !== empId));
  };

  const applyTemplate = (t: (typeof TEMPLATES)[number]) => {
    setSubject(t.subject);
    setBody(t.body);
  };

  const handleSend = async () => {
    const manual = manualEmails
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const emails = Array.from(new Set([...recipients.map((r) => r.email), ...manual]));
    if (emails.length === 0) {
      setMessage({ type: 'error', text: '수신자를 1명 이상 지정해 주세요.' });
      return;
    }
    if (!subject.trim() || !body.trim()) {
      setMessage({ type: 'error', text: '제목과 본문을 입력해 주세요.' });
      return;
    }
    setSending(true);
    try {
      const result = await sendMailNow({
        mails: emails.map((to) => ({ to, subject: subject.trim(), body: body.trim() })),
      });
      if (result.ok) {
        setMessage({ type: 'ok', text: `${emails.length}건 발송 요청 완료` });
        await logEvent('export', { meta: { kind: 'mail_send', count: emails.length } });
        setRecipients([]);
        setManualEmails('');
        reloadHistory();
      } else {
        setMessage({ type: 'error', text: `발송 실패: ${result.error ?? '알 수 없는 오류'}` });
      }
    } finally {
      setSending(false);
      setTimeout(() => setMessage(null), 4000);
    }
  };

  const handleFlush = async () => {
    setFlushing(true);
    try {
      const r = await flushMailQueue();
      if (r.ok) {
        setMessage({ type: 'ok', text: `대기건 발송 완료 (성공 ${r.sent ?? 0}건${r.failed ? ` · 실패 ${r.failed}건` : ''})` });
      } else {
        setMessage({ type: 'error', text: '대기건 발송에 실패했습니다.' });
      }
      reloadHistory();
    } finally {
      setFlushing(false);
      setTimeout(() => setMessage(null), 4000);
    }
  };

  return (
    <div className="space-y-4">
      {message && (
        <div
          className={`fixed top-4 right-4 z-[60] px-4 py-3 rounded-xl shadow-lg text-xs font-bold max-w-sm text-white ${
            message.type === 'ok' ? 'bg-emerald-600' : 'bg-rose-600'
          }`}
        >
          {message.text}
        </div>
      )}

      <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
        <Mail className="w-5 h-5 text-blue-600" />
        메일 발송
      </h2>

      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div>
          <label className="text-xs font-bold text-slate-700 mb-1.5 block">수신자 (직원 선택)</label>
          <EmployeePicker employees={employees} value={null} onChange={addRecipient} />
          {recipients.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {recipients.map((r) => (
                <span
                  key={r.empId}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50 border border-blue-200 text-[11px] font-semibold text-blue-700"
                >
                  {r.name} <span className="text-blue-400">{r.email}</span>
                  <button type="button" onClick={() => removeRecipient(r.empId)} className="text-blue-400 hover:text-blue-700">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="text-xs font-bold text-slate-700 mb-1.5 block">이메일 직접 입력 (콤마로 구분)</label>
          <textarea
            value={manualEmails}
            onChange={(e) => setManualEmails(e.target.value)}
            placeholder="a@stek.kr, b@stek.kr"
            rows={2}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-700">템플릿</span>
          {TEMPLATES.map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => applyTemplate(t)}
              className="px-2.5 py-1 rounded-md border border-slate-300 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
            >
              {t.label}
            </button>
          ))}
        </div>

        <div>
          <label className="text-xs font-bold text-slate-700 mb-1.5 block">제목</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-slate-700 mb-1.5 block">본문</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          type="button"
          onClick={handleSend}
          disabled={sending}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-50"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          발송
        </button>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">발송 이력 (최근 50건)</h3>
          <button
            type="button"
            onClick={handleFlush}
            disabled={flushing}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-300 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            {flushing && <Loader2 className="w-3 h-3 animate-spin" />}
            대기건 지금 발송
          </button>
        </div>

        {historyLoading ? (
          <div className="flex items-center justify-center py-10 text-sm text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> 불러오는 중...
          </div>
        ) : history.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">발송 이력이 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-3 font-bold">수신자</th>
                  <th className="py-2 pr-3 font-bold">제목</th>
                  <th className="py-2 pr-3 font-bold">상태</th>
                  <th className="py-2 pr-3 font-bold">등록일시</th>
                  <th className="py-2 pr-3 font-bold">발송일시</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="py-2 pr-3 text-slate-700">{row.to_email}</td>
                    <td className="py-2 pr-3 text-slate-700">{row.subject}</td>
                    <td className="py-2 pr-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          row.status === '발송완료'
                            ? 'bg-emerald-100 text-emerald-700'
                            : row.status === '실패'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-slate-500">{new Date(row.created_at).toLocaleString('ko-KR')}</td>
                    <td className="py-2 pr-3 text-slate-500">{row.sent_at ? new Date(row.sent_at).toLocaleString('ko-KR') : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
