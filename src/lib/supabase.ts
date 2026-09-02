/**
 * Supabase 클라이언트 — 빌드 시 주입되는 VITE 환경변수로 초기화.
 * 사내 supabase(api.hr.stek.kr)를 브라우저에서 anon key 로 호출한다.
 * 값이 없으면 null (미연결). 실제 데이터/인증 사용은 이 클라이언트를 통해 확장.
 *
 * db.ts 의 모든 조회 함수는 실패를 삼키고 []/null 을 반환한다(화면이 깨지지 않게). 그 대신
 * 실패 사실 자체는 여기 global.fetch 훅 한 곳에서 전부 붙잡아 상단 배너로 올린다 —
 * "데이터가 없다"와 "못 불러왔다"를 사용자가 구분할 수 있어야 하기 때문이다.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigured = !!(url && anon);

type DbErrorHandler = (message: string) => void;
let dbErrorHandler: DbErrorHandler | null = null;
/** 상단 배너가 구독한다(단일 배너 전제 — 로그인화면/앱화면은 동시에 뜨지 않는다). */
export function setDbErrorHandler(fn: DbErrorHandler) {
  dbErrorHandler = fn;
}
/** 자기가 등록한 핸들러일 때만 해제한다 — 언마운트 순서가 엇갈려도 남의 것을 지우지 않는다. */
export function clearDbErrorHandler(fn: DbErrorHandler) {
  if (dbErrorHandler === fn) dbErrorHandler = null;
}

const reqUrl = (input: RequestInfo | URL): string =>
  typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

/**
 * PostgREST/RPC 실패를 한 곳에서 관측한다.
 *  · /auth/v1/ 은 제외 — 로그인 실패는 로그인 폼이 직접 안내한다.
 *  · 406 은 .single() 의 "행 없음"이라 오류가 아니다.
 */
const trackingFetch: typeof fetch = async (input, init) => {
  const res = await fetch(input, init);
  if (res.ok) return res;

  const u = reqUrl(input);
  if (u.includes('/auth/v1/')) return res; // 로그인/토큰갱신 실패는 로그인 폼이 안내한다
  if (res.status === 406) return res;      // .single() 의 "행 없음"

  let code = '';
  let detail = '';
  try {
    const body = (await res.clone().json()) as { message?: string; hint?: string; code?: string } | null;
    code = body?.code ?? '';
    detail = [body?.message, body?.hint].filter(Boolean).join(' — ');
  } catch {
    /* 본문이 JSON 이 아니면 상태코드만 쓴다 */
  }
  if (code === 'PGRST116') return res;     // 위 406 과 같은 상황(버전에 따라 400 으로 온다)

  console.error('[supabase]', res.status, u, code, detail);
  dbErrorHandler?.(`${res.status} ${detail || res.statusText}`);
  return res;
};

export const supabase: SupabaseClient | null =
  supabaseConfigured ? createClient(url as string, anon as string, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storage: window.localStorage,
      detectSessionInUrl: false,
    },
    global: { fetch: trackingFetch },
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
