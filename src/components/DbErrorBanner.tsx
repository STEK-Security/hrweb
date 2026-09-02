/**
 * DB 조회 실패/미연결을 화면 상단에 한 줄로 알린다.
 * db.ts 의 조회 함수들은 실패해도 []/null 을 반환하므로(화면이 깨지지 않게), 실패 사실은
 * supabase.ts 의 fetch 훅 → 이 배너로만 드러난다. 이게 없으면 "데이터 없음"과 "못 불러옴"이
 * 화면상 완전히 같아 보인다(실제로 배포 사고 때 그렇게 몇 시간을 날렸다).
 */
import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { setDbErrorHandler, supabaseConfigured, supabaseInfo } from '../lib/supabase';

export function DbErrorBanner() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDbErrorHandler(setError);
    return () => setDbErrorHandler(null);
  }, []);

  if (!supabaseConfigured) {
    return (
      <div role="alert" className="bg-rose-600 text-white text-xs font-bold px-4 py-2 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span>
          Supabase 미연결 — 빌드에 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 가 주입되지 않았습니다.
          모든 화면이 빈 상태로 표시됩니다. 관리자에게 재배포를 요청하세요.
        </span>
      </div>
    );
  }

  if (!error) return null;

  return (
    <div role="alert" className="bg-amber-500 text-white text-xs font-bold px-4 py-2 flex items-center gap-2">
      <AlertTriangle className="w-4 h-4 shrink-0" />
      <span className="flex-1">
        데이터를 불러오지 못했습니다 ({supabaseInfo.url ?? '서버'}) — {error}
      </span>
      <button
        type="button"
        onClick={() => setError(null)}
        aria-label="알림 닫기"
        className="p-0.5 rounded hover:bg-white/20"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
