/**
 * Supabase 클라이언트 — 빌드 시 주입되는 VITE 환경변수로 초기화.
 * 사내 supabase(api.hr.stek.kr)를 브라우저에서 anon key 로 호출한다.
 * 값이 없으면 null (미연결). 실제 데이터/인증 사용은 이 클라이언트를 통해 확장.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigured = !!(url && anon);
export const supabase: SupabaseClient | null =
  supabaseConfigured ? createClient(url as string, anon as string, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storage: window.localStorage,
      detectSessionInUrl: false,
    },
  }) : null;

export const supabaseInfo = { url: url || null };

/** 브라우저에서 supabase 도달 여부 확인 (REST 루트 ping) */
export async function checkSupabase(): Promise<boolean> {
  if (!url || !anon) return false;
  try {
    const res = await fetch(`${url}/rest/v1/`, {
      headers: { apikey: anon, Authorization: `Bearer ${anon}` },
    });
    return res.status < 500; // 200/404 = 도달(게이트웨이 응답), 5xx/네트워크실패 = 미연결
  } catch {
    return false;
  }
}
