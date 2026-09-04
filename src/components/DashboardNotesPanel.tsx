/**
 * 대시보드 카드 하단 "특이사항 및 이슈" 패널. 핵심지표/채용 두 카드가 공용.
 * 카드 안에는 최근 3건 미리보기만, 전체 목록·추가·수정·삭제는 모달에서 처리한다.
 * 저장은 전부 db.ts(hr_dashboard_notes) — 변경 후 목록을 다시 읽어 화면과 DB 를 맞춘다.
 */
import { useEffect, useState } from 'react';
import { FileText, Plus, List, X, Loader2, Pencil, Trash2, Check } from 'lucide-react';
import {
  listDashboardNotes,
  addDashboardNote,
  updateDashboardNote,
  deleteDashboardNote,
  type DashboardNote,
  type NoteScope,
  type NoteImportance,
} from '../lib/db';

interface Props {
  scope: NoteScope;
  period: string;
  accent: 'amber' | 'indigo';
}

const PREVIEW_LIMIT = 3;
const IMPORTANCES: NoteImportance[] = ['높음', '보통', '낮음'];

// Tailwind v4 는 클래스 문자열을 정적으로 스캔하므로 조합하지 않고 완성형으로 둔다.
const ACCENT = {
  amber: {
    wrap: 'bg-amber-50/40 border-amber-200/80',
    divider: 'border-amber-200/60',
    icon: 'text-amber-600',
    solid: 'bg-amber-600 hover:bg-amber-700 text-white',
    outline: 'bg-white hover:bg-amber-100/80 text-slate-700 border border-amber-300',
    field: 'border-amber-300 focus:border-amber-500 focus:ring-amber-200/50',
    chip: 'bg-amber-100/90 text-amber-800 border-amber-300',
    bar: 'bg-amber-500',
  },
  indigo: {
    wrap: 'bg-indigo-50/30 border-indigo-200/70',
    divider: 'border-indigo-200/60',
    icon: 'text-indigo-600',
    solid: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    outline: 'bg-white hover:bg-indigo-100/80 text-slate-700 border border-indigo-300',
    field: 'border-indigo-300 focus:border-indigo-500 focus:ring-indigo-200/50',
    chip: 'bg-indigo-100/90 text-indigo-800 border-indigo-300',
    bar: 'bg-indigo-500',
  },
} as const;

const IMPORTANCE_STYLE: Record<NoteImportance, { badge: string; dot: string }> = {
  높음: { badge: 'bg-rose-100 text-rose-700 border-rose-200 font-bold', dot: 'bg-rose-500' },
  보통: { badge: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' },
  낮음: { badge: 'bg-slate-50 text-slate-400 border-slate-200', dot: 'bg-slate-300' },
};

const fmtDate = (iso: string) => iso.slice(0, 10).replace(/-/g, '.');

function ImportanceBadge({ level }: { level: NoteImportance }) {
  const s = IMPORTANCE_STYLE[level];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-px rounded border shrink-0 ${s.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {level}
    </span>
  );
}

export function DashboardNotesPanel({ scope, period, accent }: Props) {
  const a = ACCENT[accent];
  const [notes, setNotes] = useState<DashboardNote[] | null>(null); // null = 로딩 중
  const [open, setOpen] = useState(false);

  const reload = async () => setNotes(await listDashboardNotes(scope, { period }));

  useEffect(() => {
    let alive = true;
    setNotes(null);
    void listDashboardNotes(scope, { period }).then((r) => alive && setNotes(r));
    return () => {
      alive = false;
    };
  }, [scope, period]);

  const preview = notes?.slice(0, PREVIEW_LIMIT) ?? [];
  const rest = (notes?.length ?? 0) - preview.length;

  return (
    <div className={`rounded-xl border p-4 space-y-2.5 ${a.wrap}`}>
      <div className={`flex items-center justify-between gap-2 border-b pb-2 ${a.divider}`}>
        <div className="flex items-center gap-2">
          <FileText className={`w-4 h-4 ${a.icon}`} />
          <h4 className="text-xs font-bold text-slate-900">* 특이사항 및 이슈</h4>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${a.chip}`}>
            {notes === null ? '…' : `총 ${notes.length}건`}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setOpen(true)}
            title={`${scope} 이슈 전체 목록 보기`}
            className={`px-2.5 py-1 text-[11px] rounded-lg font-semibold transition-colors flex items-center gap-1 shadow-2xs ${a.outline}`}
          >
            <List className="w-3.5 h-3.5" />
            전체보기
          </button>
          <button
            type="button"
            onClick={() => setOpen(true)}
            title={`${scope} 이슈 추가`}
            className={`px-2.5 py-1 text-[11px] rounded-lg font-semibold transition-colors flex items-center gap-1 shadow-2xs ${a.solid}`}
          >
            <Plus className="w-3.5 h-3.5" />
            이슈 추가
          </button>
        </div>
      </div>

      {/* 미리보기: 최대 3건, 높이 고정에 가깝게 */}
      <ul className="bg-white/85 rounded-lg border border-slate-200/70 divide-y divide-slate-100 min-h-[84px]">
        {notes === null ? (
          <li className="h-[84px] flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> 불러오는 중…
          </li>
        ) : preview.length === 0 ? (
          <li className="h-[84px] flex items-center justify-center text-xs text-slate-400 italic px-3 text-center">
            등록된 특이사항 및 이슈가 없습니다. [이슈 추가] 버튼을 눌러 내용을 입력하세요.
          </li>
        ) : (
          preview.map((n) => (
            <li key={n.id} className="flex items-center gap-2 px-3 py-1.5 text-xs" title={n.content}>
              <ImportanceBadge level={n.importance} />
              <span className="flex-1 truncate text-slate-800">{n.content}</span>
              <span className="text-[10px] text-slate-400 font-mono shrink-0">{fmtDate(n.created_at)}</span>
            </li>
          ))
        )}
      </ul>
      {rest > 0 && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="나머지 이슈 보기"
          className="text-[11px] text-slate-500 hover:text-slate-800 underline underline-offset-2"
        >
          외 {rest}건 더보기
        </button>
      )}

      {open && (
        <NotesModal
          scope={scope}
          period={period}
          accent={accent}
          onClose={() => setOpen(false)}
          onChanged={reload}
        />
      )}
    </div>
  );
}

/* ---------------- 모달 ---------------- */

interface ModalProps extends Props {
  onClose: () => void;
  onChanged: () => Promise<void>;
}

function NotesModal({ scope, period, accent, onClose, onChanged }: ModalProps) {
  const a = ACCENT[accent];
  const titleId = `notes-modal-title-${accent}`;
  const [periodFilter, setPeriodFilter] = useState<'period' | 'all'>('period');
  const [impFilter, setImpFilter] = useState<NoteImportance | '전체'>('전체');
  const [list, setList] = useState<DashboardNote[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 추가 폼
  const [newContent, setNewContent] = useState('');
  const [newImp, setNewImp] = useState<NoteImportance>('보통');
  const [busy, setBusy] = useState(false);

  // 인라인 수정
  const [editId, setEditId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editImp, setEditImp] = useState<NoteImportance>('보통');

  /**
   * 재조회 트리거. 추가/수정/삭제 뒤에 load() 를 직접 부르면 그 핸들러가 잡아둔
   * 옛 periodFilter 클로저로 다시 읽어, 그 사이 사용자가 필터를 바꿨을 때
   * 화면 선택과 다른 목록으로 덮어써 버린다. 항상 최신 필터로 읽도록 effect 에 맡긴다.
   */
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setList(null);
    void listDashboardNotes(scope, periodFilter === 'period' ? { period } : {}).then((r) => alive && setList(r));
    return () => {
      alive = false;
    };
  }, [scope, period, periodFilter, reloadKey]);

  // Tab 으로 포커스가 모달 밖(배경 카드의 버튼 등)으로 나가면 컨테이너 onKeyDown 이
  // Esc 를 못 받는다. document 에서 잡아 항상 닫히게 한다.
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [onClose]);

  const afterChange = async () => {
    setReloadKey((k) => k + 1);
    await onChanged();
  };

  const handleAdd = async () => {
    const content = newContent.trim();
    if (!content) return;
    setBusy(true);
    setError(null);
    const created = await addDashboardNote({ period, scope, content, importance: newImp });
    setBusy(false);
    if (!created) {
      setError('이슈 추가에 실패했습니다. 다시 시도해 주세요.');
      return;
    }
    setNewContent('');
    setNewImp('보통');
    await afterChange();
  };

  const handleUpdate = async (id: string) => {
    const content = editContent.trim();
    if (!content) return;
    setBusy(true);
    setError(null);
    const ok = await updateDashboardNote(id, { content, importance: editImp });
    setBusy(false);
    if (!ok) {
      setError('수정 저장에 실패했습니다.');
      return;
    }
    setEditId(null);
    await afterChange();
  };

  const handleDelete = async (n: DashboardNote) => {
    if (!window.confirm(`이 이슈를 삭제할까요? 되돌릴 수 없습니다.\n\n"${n.content.slice(0, 60)}"`)) return;
    setBusy(true);
    setError(null);
    const ok = await deleteDashboardNote(n.id);
    setBusy(false);
    if (!ok) {
      setError('삭제에 실패했습니다.');
      return;
    }
    await afterChange();
  };

  const visible = (list ?? []).filter((n) => impFilter === '전체' || n.importance === impFilter);
  const selectCls = `text-xs py-1 px-2 rounded-lg border bg-white outline-none focus:ring-2 ${a.field}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
    >
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-4 rounded-full ${a.bar}`} />
            <h3 id={titleId} className="text-base font-bold text-slate-900">
              {scope} 특이사항 및 이슈
            </h3>
            <span className="text-[11px] text-slate-500 font-mono">{period}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            title="닫기"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-sm overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-semibold">{error}</div>
          )}

          {/* 추가 폼 */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleAdd();
            }}
            className={`rounded-xl border p-3 space-y-2 ${a.wrap}`}
          >
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              rows={2}
              autoFocus
              aria-label="새 이슈 내용"
              placeholder={
                scope === '채용'
                  ? '채용 관련 특이사항, 면접 일정, 부서별 긴급 충원 요청 사항 등'
                  : '당월 HR 주요 특이사항, 노무비 변동 원인 등'
              }
              className={`w-full bg-white text-xs leading-relaxed text-slate-800 p-2.5 rounded-lg border outline-none focus:ring-2 resize-y placeholder:text-slate-400 ${a.field}`}
            />
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-1.5 text-[11px] text-slate-600">
                중요도
                <select
                  value={newImp}
                  onChange={(e) => setNewImp(e.target.value as NoteImportance)}
                  aria-label="새 이슈 중요도"
                  className={selectCls}
                >
                  {IMPORTANCES.map((i) => (
                    <option key={i}>{i}</option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                disabled={busy || !newContent.trim()}
                title="이슈 추가"
                className={`px-3 py-1.5 text-xs rounded-lg font-bold transition-colors flex items-center gap-1 shadow-2xs disabled:opacity-50 ${a.solid}`}
              >
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                추가
              </button>
            </div>
          </form>

          {/* 필터 */}
          <div className="flex items-center gap-3 flex-wrap text-[11px] text-slate-600">
            <label className="flex items-center gap-1.5">
              기간
              <select
                value={periodFilter}
                onChange={(e) => setPeriodFilter(e.target.value as 'period' | 'all')}
                aria-label="기간 필터"
                className={selectCls}
              >
                <option value="period">이번 달 ({period})</option>
                <option value="all">전체</option>
              </select>
            </label>
            <label className="flex items-center gap-1.5">
              중요도
              <select
                value={impFilter}
                onChange={(e) => setImpFilter(e.target.value as NoteImportance | '전체')}
                aria-label="중요도 필터"
                className={selectCls}
              >
                <option>전체</option>
                {IMPORTANCES.map((i) => (
                  <option key={i}>{i}</option>
                ))}
              </select>
            </label>
            <span className="ml-auto text-slate-400">{list === null ? '' : `${visible.length}건`}</span>
          </div>

          {/* 목록 */}
          <ul className="border border-slate-200 rounded-lg divide-y divide-slate-100">
            {list === null ? (
              <li className="py-8 flex items-center justify-center gap-1.5 text-xs text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" /> 불러오는 중…
              </li>
            ) : visible.length === 0 ? (
              <li className="py-8 text-center text-xs text-slate-400 italic">조건에 맞는 이슈가 없습니다.</li>
            ) : (
              visible.map((n) => (
                <li
                  key={n.id}
                  className={`px-3 py-2 text-xs ${n.importance === '높음' ? 'bg-rose-50/40 border-l-2 border-l-rose-400' : ''}`}
                >
                  {editId === n.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={2}
                        autoFocus
                        aria-label="이슈 내용 수정"
                        className={`w-full bg-white text-xs leading-relaxed text-slate-800 p-2 rounded-lg border outline-none focus:ring-2 resize-y ${a.field}`}
                      />
                      <div className="flex items-center justify-between gap-2">
                        <select
                          value={editImp}
                          onChange={(e) => setEditImp(e.target.value as NoteImportance)}
                          aria-label="이슈 중요도 수정"
                          className={selectCls}
                        >
                          {IMPORTANCES.map((i) => (
                            <option key={i}>{i}</option>
                          ))}
                        </select>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditId(null)}
                            title="수정 취소"
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-[11px]"
                          >
                            취소
                          </button>
                          <button
                            type="button"
                            disabled={busy || !editContent.trim()}
                            onClick={() => void handleUpdate(n.id)}
                            title="수정 저장"
                            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] flex items-center gap-1 disabled:opacity-50 ${a.solid}`}
                          >
                            <Check className="w-3.5 h-3.5" /> 저장
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <ImportanceBadge level={n.importance} />
                      <p className="flex-1 text-slate-800 leading-relaxed whitespace-pre-line break-words">{n.content}</p>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] text-slate-400 font-mono mr-1" title={n.author_email ?? undefined}>
                          {periodFilter === 'all' ? `${n.period} · ` : ''}
                          {fmtDate(n.created_at)}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditId(n.id);
                            setEditContent(n.content);
                            setEditImp(n.importance);
                          }}
                          title="수정"
                          aria-label="이슈 수정"
                          className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleDelete(n)}
                          title="삭제"
                          aria-label="이슈 삭제"
                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
