# STEK HR 웹앱 재설계 — 설계 스펙

작성일: 2026-08-19
상태: 초안 (보안 검토 반영 예정)

## 1. 배경 / 목표

기존 앱은 브라우저에서 엑셀을 매 세션 업로드해 화면에 뿌리는 **클라이언트 데모**였다.
이를 **supabase DB 기반 실서비스**로 재설계한다.

- 데이터는 **n8n 크롤러가 DB에 직접 적재**(주 파이프라인). 웹에서도 입력/수정/삭제(CRUD) 가능.
- 로그인 후 메인페이지. 엑셀 상시 업로드 UI 제거(관리자 일괄 임포트는 별도).
- 데모 계정·데모 목데이터 제거. 단, **초기 검증용으로 DB에 데모 데이터 시드**(정상동작 확인 후 삭제 예정).
- **관리자 기능** 신설: 사용자·역할, 직원 CRUD+일괄임포트, 조직·기준 설정, 감사로그.
- **설정을 API로** 제어(입력 on/off 등) → 외부(n8n) 유연 연동.
- **민감 인사정보(주민번호·계좌·주소·연락처) 유출 0** 이 최우선.

## 2. 아키텍처 (Approach A — 백엔드 없음)

```
브라우저(SPA, hr.stek.kr)
   │  supabase-js (same-origin: https://hr.stek.kr/{auth,rest,storage}/...)
   ▼
nginx (frontend 컨테이너)  ── /assets, / → SPA
   └ /auth/ /rest/ /storage/ /realtime/ → proxy_pass → supabase kong (내부 네트워크)
                                                          │
n8n(크롤러) ── 전용 DB 롤/토큰 ──────────────────────────▶ Postgres (RLS)
```

- **same-origin 프록시**로 자체서명 cross-origin fetch 문제 해소. `VITE_SUPABASE_URL=https://hr.stek.kr`.
- 별도 백엔드 없음. **RLS(Row Level Security)가 접근제어의 핵심 방어선.**
- frontend 컨테이너를 supabase compose 네트워크에 연결해 kong 으로 proxy_pass.

## 3. 데이터 모델 (supabase Postgres)

### 3.1 employees (직원 기본)
엑셀 69항목 중 **비민감 항목**만. 사번(사내 고유), 성명, 영문성명, 닉네임, 법인/소속/전체소속명,
직책/직급/고용구분/근무지, 입사일/그룹입사일/퇴직일/퇴직사유, 근속·발령·계약·수습 날짜,
성별/생년월일/나이/결혼여부/음양구분/생일, 학력/학교/학위/전공, 역종/군별/계급/병역특례/장애/보훈,
국적/내외국인/거주지국/체류자격/체류기간, 입사경로/추천인/인정경력, 발령명.
- PK: `id uuid`, 자연키 `사번` unique.
- 파생값(본부·팀·현장직·수습평가일 등)은 저장하지 않고 조회 후 계산(derive 로직 재사용) 또는 뷰.

### 3.2 employee_sensitive (민감 분리) ★보안 핵심
주민번호, 급여계좌(은행/번호/예금주), 경비계좌, 현주소·등본주소, 휴대폰번호, 비상연락망, 개인메일.
- `employee_id` FK. **employees 와 분리**해 강한 RLS 를 별도로 건다(일반/팀장은 접근 불가).
- 화면 표시는 **마스킹 뷰/RPC** 경유. 원본 직접 SELECT 는 관리자/인사만.

### 3.3 leave_records (휴직) — 신규
성명/직원FK, 부서, 직책, 휴직사유(육아/질병/학업/가족돌봄), 시작일, 복직예정일, D-Day(계산),
대체인력 여부·이름, 연락처, 상태(휴직중/복직예정/복직완료).
- 엑셀에 없음 → **데모 행 시드**(기존 휴직관리 화면 형식과 동일).

### 3.4 profiles (계정·역할)
`id`(=auth.users.id), 이메일, 성명, 부서, 팀, `role`(시스템관리자|인사담당자|팀장|일반), enabled.
- **role 은 본인이 변경 불가**(관리자만). RLS 로 강제.

### 3.5 org_settings (조직·기준·기능 토글) — API 제어 대상
- 부서/직급 목록, 규칙값(수습 +30/+55, 정년 60, 제외패턴 테스트·GPRO, 총괄→TBS).
- **기능 토글**: `employee_input_enabled`, `leave_input_enabled` 등 — 입력 on/off 를 설정으로.
- 관리자만 쓰기(RLS). 외부(n8n)는 읽어서 동작 분기.

### 3.6 audit_log
누가/언제/무엇을(테이블·행·컬럼)/이전→이후. **민감값 원본은 기록 금지**(변경 사실만).

## 4. 인증 / 역할

- **Supabase Auth**(이메일+비밀번호). 세션은 supabase-js 기본(로컬 저장, 만료).
- 최초 시스템관리자 1명 시드 → 이후 관리자가 계정 생성·역할 부여.
- 역할별 권한(요약):
  | 역할 | employees | employee_sensitive | leave | profiles | org_settings | audit |
  |---|---|---|---|---|---|---|
  | 시스템관리자 | CRUD | 조회+수정 | CRUD | CRUD | CRUD | 조회 |
  | 인사담당자 | CRUD | 조회+수정 | CRUD | 조회 | 조회 | 조회 |
  | 팀장 | 본인팀 조회 | ✕ | 본인팀 조회 | 본인 | 조회 | ✕ |
  | 일반 | 본인 조회 | 본인만 | 본인 | 본인 | ✕ | ✕ |

## 5. 화면 (v1)

1. **로그인** — supabase Auth. 이메일/비밀번호.
2. **메인 대시보드** — DB 집계(기존 대시보드 UI 재사용, mockData→DB 쿼리).
3. **직원 명부/상세** — DB 기반. 민감정보는 권한+마스킹. 관리자/인사는 CRUD.
4. **휴직 관리** — leave_records 테이블(기존 휴직화면 형식).
5. **관리자** — ①사용자·역할 ②직원 CRUD+일괄임포트 ③조직·기준·기능토글 ④감사로그.

## 6. 설정 API화 / n8n 연동

- 모든 설정은 `org_settings` 테이블 + supabase REST(`/rest/v1/org_settings`)로 노출 → 외부에서 읽고 분기.
- **n8n**: 전용 DB 롤(최소권한: employees/leave insert·update만, employee_sensitive 는 별도 통제),
  또는 전용 인제스트 함수+토큰. service_role 무단 사용 금지. 키는 n8n 자격증명 보관, 회전 가능.
- 입력 on/off 토글로 "웹 입력 vs n8n 적재" 전환.

## 7. 마이그레이션 / 정리

제거: `src/mockData.ts` 데모, `DataSourceView`(상시 업로드), 클라이언트 `parse.ts` 상시 업로드 경로,
데모 계정(`LoginView` 하드코딩), `SAMPLE_ONLY` 배너. `derive.ts` 분석 로직은 DB 행에 재사용하도록 유지.
데모 시드: 엑셀 10명 → employees/employee_sensitive, 휴직 데모 3~5행, 관리자 계정 1개.

## 8. 보안 (보안 에이전트 위협모델 반영)

**전제:** Approach A 는 브라우저가 anon key 로 Postgres 에 직접 붙으므로 **RLS 가 유일 방어선**.
아래 P0 를 하나라도 빠뜨리면 주민번호·계좌 전량 유출 위험 → **P0 전량 + CI 가드 + 암호화가 채택 조건.**
(그중 하나라도 못 지키면 민감 CRUD 만 얇은 Edge Function 뒤로 옮기는 하이브리드로 승격.)

### P0 (치명 — 반드시)
1. **전 테이블 RLS + FORCE + CI 가드.** `enable/force row level security` 전 테이블. anon/authenticated 기본 GRANT 회수 후 필요한 컬럼만 grant. 배포 파이프라인에 "RLS 미적용/anon SELECT 허용 테이블 있으면 배포 실패" 쿼리 게이트.
2. **role 자기승격 차단.** 역할 소스를 사용자가 write 못하는 곳(JWT custom claim via Auth Hook, 또는 self-write 금지 `user_roles`)에 둔다. profiles 자기수정은 비민감 필드만, role 은 admin 전용. `is_admin()`/`is_hr()` 는 `SECURITY DEFINER set search_path=public`.
3. **민감값: 분리 + 암호화 + 마스킹 RPC (3중).** `employee_sensitive`(주민번호·계좌…)를 별도 테이블로, authenticated 에 직접 SELECT GRANT 안 줌. 값은 pgcrypto 로 **암호화 저장**(키는 DB 밖 주입/Vault). 조회는 `SECURITY DEFINER` 마스킹 RPC 로만(권한 확인+건별 감사로그+최소노출). **RPC/뷰 마스킹 단독은 부적합**(base table 원본 접근을 못 막음).
4. **n8n 은 service_role 금지.** 전용 최소권한 DB 롤(`n8n_ingest`: 특정 테이블 insert/update만, SELECT·민감테이블 권한 없음, RLS 적용). 더 나은 대안: 전용 인제스트 Edge Function + HMAC 토큰(n8n 이 DB 자격을 아예 안 듦). 키는 회전 가능하게 secret store 에만.
5. **Studio·Postgres(5432)·관리경로 외부 차단.** kong 은 `/auth /rest /storage /realtime` 만, 관리경로 deny. 5432 는 앱·n8n 만 네트워크 정책 허용. 자체서명→**사내 CA 인증서**로 전환해 경고 습관 제거(MITM 방어).
6. **역할별 RLS 4종(SELECT/INSERT/UPDATE/DELETE) 전부 + WITH CHECK.** 팀장=본인팀(매핑은 self-write 금지 `team_managers`), 일반=본인, 인사/관리자=전체. DELETE 는 인사/관리자만. 정책은 OR 결합이므로 과대범위 점검.

### P1 (높음)
7. **컬럼단위 GRANT** — 준민감(주소·연락처·개인메일)은 일반에게 컬럼 SELECT 미부여(PostgREST 는 grant 없는 컬럼 미반환).
8. **org_settings 는 보안판단에 쓰지 않음** — admin-only write, 나머지 read. 입력 on/off 는 UI/동작 토글 용도만(RLS 는 role 로만 판단).
9. **audit_log**: actor/action/target/컬럼명/시각만, **민감 원본 기록 금지**, append-only(update/delete 차단), 조회 admin 만.
10. **Auth/세션**: 이메일확인·최소비번·유출비번차단(HIBP)·로그인 rate-limit·refresh 회전·JWT 짧은 만료. 세션 localStorage 는 XSS 취약 → CSP 로 완화.
11. **CSP/보안헤더**(nginx): script self·inline 금지, X-Frame-Options DENY, nosniff, no-referrer, 사내CA 후 HSTS. **n8n 크롤링 데이터는 신뢰불가 입력**(저장형 XSS 주벡터) → textContent/이스케이프만.
12. **nginx 프록시 범위 축소** — `/auth /rest /storage /realtime` 만, 와일드카드 프록시 금지, 관리경로 location deny.
13. **SECURITY DEFINER search_path 고정** + `revoke execute from public` 후 필요한 롤만.
14. **Storage**(파일 쓰면): private 버킷, storage.objects RLS, 서명URL 짧은 만료, 타입·크기 검증.

### P2 (중간)
15. realtime: 민감테이블 publication 제외. 16. anon 잔여 GRANT 점검·시드에 실제 주민번호 형식 금지. 17. DB 오류 원문 미노출. 18. 의존성 감사(`bun audit`)·lockfile 고정. 19. role 을 JWT claim 으로 일원화(성능·self-write 차단). 20. 백업 암호화·PII 보존/파기 정책.

### 시드 데이터 주의
데모 시드의 주민번호·계좌는 **명백한 가짜값**(예: `000000-0000000`)만. 실제 형식·실값 금지.

## 9. 범위 밖(다음 단계)
인력현황 정밀분석·인건비·교육·평가 화면의 완전 DB화, 다국어, 모바일 최적화.
