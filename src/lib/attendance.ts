/**
 * 근태(time.stek.win) 관리 API 클라이언트 — Edge Function `attendance` 경유.
 * 관리자 토큰은 Edge Function env 에만 있다. 브라우저는 로그인 JWT 만 보낸다.
 */
import { supabase } from './supabase';

export type AttMethod = 'GET' | 'POST' | 'PUT' | 'PATCH';

export interface AttOptions {
  query?: Record<string, string>;
  body?: unknown;
}

/** Worker/Edge Function 의 `{error, message}` 와 HTTP 상태를 담는다. */
export class AttendanceError extends Error {
  constructor(public status: number, public code: string, message: string, public data?: unknown) {
    super(message);
    this.name = 'AttendanceError';
  }
}

export async function att<T>(method: AttMethod, path: string, opts: AttOptions = {}): Promise<T> {
  if (!supabase) throw new AttendanceError(0, 'not_configured', 'Supabase 미연결');
  const { data, error } = await supabase.functions.invoke('attendance', {
    body: { method, path, query: opts.query, body: opts.body },
  });
  if (!error) return data as T;

  // FunctionsHttpError 는 context 에 원 Response 를 담는다(네트워크 오류는 없음).
  const res = (error as { context?: unknown }).context;
  if (res instanceof Response) {
    let body: { error?: string; message?: string } | null = null;
    try {
      body = await res.json();
    } catch {
      /* 본문이 JSON 이 아니면 상태코드만 쓴다 */
    }
    throw new AttendanceError(res.status, body?.error ?? 'http_error', body?.message ?? body?.error ?? `${res.status} ${res.statusText}`, body);
  }
  throw new AttendanceError(0, 'network', error.message);
}
