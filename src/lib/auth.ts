/**
 * Supabase Auth 세션·역할 유틸.
 * 로그인은 이메일+비밀번호만 지원(회원가입 없음 — 관리자가 계정 생성).
 * 역할은 user_roles 테이블에서 조회(RLS self read 로 본인 것만 보임).
 */
import { useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, supabaseConfigured } from './supabase';
import { logEvent } from './audit';

// 0012/hotfix_0012 2역할 마이그레이션 이후 DB 값과 일치시킨다(사용자=인사팀 전 기능, 관리자=+로그·계정·설정).
export type Role = '사용자' | '관리자';

/** 이메일/비밀번호 로그인. 실패 시 한국어 에러 메시지를 던진다. */
export async function signIn(email: string, password: string): Promise<Session> {
  if (!supabaseConfigured || !supabase) {
    throw new Error('Supabase 미설정입니다. 관리자에게 문의하세요.');
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    await logEvent('login_fail', { meta: { email } });
    throw new Error('이메일 또는 비밀번호가 올바르지 않습니다.');
  }
  if (!data.session) {
    await logEvent('login_fail', { meta: { email } });
    throw new Error('로그인에 실패했습니다. 다시 시도해주세요.');
  }
  await logEvent('login_success', { meta: { email } });
  return data.session;
}

/**
 * 서버 비밀번호 최소 길이. Dokploy supabase compose 의 auth 서비스 env 에
 * GOTRUE_PASSWORD_MIN_LENGTH 가 없음을 확인했으므로(2026-09-03, gotrue v2.189.0) GoTrue 기본값 6 을 따른다.
 * 서버 정책이 바뀌면 여기 숫자만 맞추면 된다 — 어긋나도 서버가 최종 판정하므로 보안 구멍은 아니다.
 */
export const PASSWORD_MIN_LENGTH = 6;

/** GoTrue 의 영어 에러를 한국어로. 매핑 안 된 건 원문을 그대로 보여준다(숨기면 디버깅이 막힌다). */
function passwordErrorMessage(e: { code?: string; message: string }): string {
  switch (e.code) {
    case 'same_password': return '새 비밀번호가 기존 비밀번호와 같습니다.';
    case 'weak_password': return `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다.`;
    case 'reauthentication_needed': return '재인증이 필요합니다. 로그아웃 후 다시 로그인해 시도하세요.';
  }
  if (/different from the old/i.test(e.message)) return '새 비밀번호가 기존 비밀번호와 같습니다.';
  if (/at least \d+ characters/i.test(e.message)) return `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다.`;
  return e.message;
}

/**
 * 본인 비밀번호 변경. 실패 시 한국어 에러 메시지를 던진다.
 *
 * 현재 비밀번호를 signInWithPassword 로 먼저 검증한다 — 서버는 재인증을 요구하지 않는다
 * (auth 서비스 env 에 GOTRUE_SECURITY_UPDATE_PASSWORD_REQUIRE_REAUTHENTICATION 없음 → 기본 false).
 * 그래서 updateUser 만으로도 바뀌지만, 자리 비운 PC 에서 남이 비밀번호를 갈아치우는 걸 막으려면
 * 본인 확인이 필요하다.
 * 부작용 확인(auth-js 2.112.3): signInWithPassword 는 같은 사용자의 새 세션을 저장하고 SIGNED_IN 을
 * 발행한다 → useAuth 가 role 을 다시 조회할 뿐 사용자·화면은 바뀌지 않는다. 이어지는 updateUser 는
 * GoTrue 가 "현재 세션(=방금 발급된 것) 외 전부 로그아웃" 처리하므로 이 브라우저는 로그인이 유지된다.
 */
export async function changePassword(current: string, next: string): Promise<void> {
  if (!supabaseConfigured || !supabase) {
    throw new Error('Supabase 미설정입니다. 관리자에게 문의하세요.');
  }
  const { data: sess } = await supabase.auth.getSession();
  const email = sess.session?.user.email;
  if (!email) throw new Error('로그인 정보를 확인할 수 없습니다. 다시 로그인해주세요.');

  const { error: verifyErr } = await supabase.auth.signInWithPassword({ email, password: current });
  if (verifyErr) throw new Error('현재 비밀번호가 올바르지 않습니다.');

  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) throw new Error(passwordErrorMessage(error));
  // 비밀번호 원문은 절대 meta 에 넣지 않는다.
  await logEvent('change_password');
}

export async function signOut(): Promise<void> {
  if (!supabase) return;
  await logEvent('logout');
  await supabase.auth.signOut();
}

export async function getSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/** 세션 변경 구독. 구독 해제 함수를 반환한다. */
export function onAuthChange(cb: (session: Session | null) => void): () => void {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    cb(session);
  });
  return () => data.subscription.unsubscribe();
}

/**
 * role 조회 결과. 실패해도 '일반'으로 조용히 폴백하지 않고 error 로 명시한다.
 * 본인 profiles.enabled 가 false 면(관리자가 계정을 비활성화) 즉시 signOut 처리한다 —
 * 서버측(0021_security_hardening의 current_role())이 근본 방어이고, 이건 UX 정리다.
 */
async function fetchRole(userId: string): Promise<{ role: Role | null; error: boolean }> {
  if (!supabase) return { role: null, error: true };
  const { data: profile } = await supabase
    .from('profiles')
    .select('enabled')
    .eq('id', userId)
    .single();
  if (profile && profile.enabled === false) {
    await signOut();
    return { role: null, error: true };
  }
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .single();
  if (error || !data) return { role: null, error: true };
  return { role: data.role as Role, error: false };
}

interface AuthState {
  session: Session | null;
  user: User | null;
  role: Role | null;
  /** role 조회가 실패했음을 나타낸다. session 은 유지된 채로 화면이 안내를 보여줘야 한다. */
  roleError: boolean;
  loading: boolean;
}

/** 세션·역할·로딩 상태를 함께 제공하는 훅. */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    role: null,
    roleError: false,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    async function applySession(session: Session | null) {
      if (!session) {
        if (!cancelled) {
          setState({ session: null, user: null, role: null, roleError: false, loading: false });
        }
        return;
      }
      const { role, error } = await fetchRole(session.user.id);
      if (!cancelled) {
        setState({ session, user: session.user, role, roleError: error, loading: false });
      }
    }

    getSession().then(applySession);
    const unsubscribe = onAuthChange(applySession);

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return state;
}

/** role 만 필요한 경우의 편의 훅. */
export function useRole(): Role | null {
  return useAuth().role;
}
