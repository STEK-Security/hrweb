/**
 * Supabase Auth 세션·역할 유틸.
 * 로그인은 이메일+비밀번호만 지원(회원가입 없음 — 관리자가 계정 생성).
 * 역할은 user_roles 테이블에서 조회(RLS self read 로 본인 것만 보임).
 */
import { useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, supabaseConfigured } from './supabase';
import { logEvent } from './audit';

export type Role = '시스템관리자' | '인사담당자' | '팀장' | '일반';

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

/** role 조회 결과. 실패해도 '일반'으로 조용히 폴백하지 않고 error 로 명시한다. */
async function fetchRole(userId: string): Promise<{ role: Role | null; error: boolean }> {
  if (!supabase) return { role: null, error: true };
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
