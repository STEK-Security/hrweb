/**
 * Edge Function `send-mail` 호출 헬퍼(함수 구현은 supabase/functions/send-mail/, 별도 담당).
 * nginx 가 /functions/ 를 kong 프록시로 넘겨 브라우저에서 same-origin 호출된다.
 */
import { supabase } from './supabase';

export interface SendMailPayload {
  to: string;
  subject: string;
  body: string;
  html?: string;
}

export interface SendMailResult {
  ok: boolean;
  result?: unknown;
  error?: string;
}

/** 즉시 발송 요청(단건 또는 다건). */
export async function sendMailNow(
  payload: SendMailPayload | { mails: SendMailPayload[] }
): Promise<SendMailResult> {
  if (!supabase) return { ok: false, error: 'supabase 미연결' };
  try {
    const { data, error } = await supabase.functions.invoke('send-mail', { body: payload });
    if (error) return { ok: false, error: error.message };
    return { ok: true, result: data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** 대기중인 메일 큐를 즉시 발송 시도. */
export async function flushMailQueue(): Promise<{ ok: boolean; sent?: number; failed?: number }> {
  if (!supabase) return { ok: false };
  try {
    const { data, error } = await supabase.functions.invoke('send-mail', { body: { mode: 'queue' } });
    if (error) return { ok: false };
    const d = (data ?? {}) as { sent?: number; failed?: number };
    return { ok: true, sent: d.sent, failed: d.failed };
  } catch {
    return { ok: false };
  }
}
