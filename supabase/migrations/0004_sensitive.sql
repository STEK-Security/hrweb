-- 0004_sensitive.sql
-- 민감값 분리 + 암호화 저장. employees 와 완전히 분리된 테이블이며,
-- anon/authenticated 에게 어떤 GRANT·정책도 주지 않는다(직접 SELECT 불가).
-- 접근은 오직 0005_sensitive_rpc.sql 의 SECURITY DEFINER RPC 로만 가능하다.

create extension if not exists pgcrypto;

create table if not exists public.employee_sensitive (
  employee_id uuid primary key references public.employees(id) on delete cascade,
  ssn_enc bytea,           -- 주민번호
  salary_acct_enc bytea,   -- 급여계좌(은행/계좌번호/예금주 를 jsonb 로 암호화)
  expense_acct_enc bytea,  -- 경비계좌(은행/계좌번호/예금주 를 jsonb 로 암호화)
  addr_enc bytea,          -- 현주소(우편번호/주소 를 jsonb 로 암호화)
  reg_addr_enc bytea,      -- 등본주소(우편번호/주소 를 jsonb 로 암호화)
  phone_enc bytea,         -- 휴대폰번호
  emergency_enc bytea,     -- 비상연락망
  email_enc bytea,         -- 개인메일
  updated_by uuid,
  updated_at timestamptz not null default now()
);

alter table public.employee_sensitive enable row level security;
alter table public.employee_sensitive force row level security;

-- 의도적으로 GRANT·정책 없음: anon/authenticated 는 직접 select/insert/update/delete 전부 불가.
revoke all on public.employee_sensitive from anon, authenticated;
revoke all on public.employee_sensitive from public;
-- (정책을 만들지 않음 = RLS 하에서 모든 행이 기본 차단. 오직 테이블 소유자(SECURITY DEFINER 함수 실행 주체)만 우회 가능.)
