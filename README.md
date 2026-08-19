# STEK HR — 인사정보 플랫폼

인사기초정보 엑셀(.xlsx)을 브라우저에 업로드하면 69개 항목을 자동 인식해
대시보드·인력현황·HR캘린더·평가·조직 분석을 생성하는 사내 HR 웹앱.

- **React 19 + TypeScript + Vite + Tailwind v4**
- 엑셀 파싱은 외부 라이브러리 없이 브라우저 네이티브 API(`DecompressionStream`) 사용
- 급여·교육·휴직처럼 엑셀에 없는 항목은 데모 샘플로 채우고 화면에 "샘플 데이터" 배너 표시
- 배포물은 자기완결형 단일 HTML(`hr-app.html`) 하나

## 개발

```bash
bun install
bun run dev            # 개발 서버 (http://localhost:3000)
bun run build:single   # → hr-app.html (단일 파일 빌드)
```

## 로그인 (데모 계정)

| 아이디 | 비밀번호 | 역할 |
|---|---|---|
| `admin` | `admin1234` | 시스템 관리자 |
| `hr` | `hr1234` | 인사담당자 |
| `lead` | `lead1234` | 팀장 |
| `user` | `user1234` | 일반사용자 |

## 데이터 규칙

- **제외**: 성명·소속 등에 `테스트`/`test`/`GPRO` 가 있는 행은 집계에서 제외
- **조직 표기**: `총괄` → `TBS`
- **현장직**: 소속이 생산·품질·물류인 인원 (그 외 사무직)
- **수습평가일**: 입사일 +30일 = 1차, +55일 = 최종
- **캘린더**: 생일·수습평가·계약종료는 그 날짜에 재직 중인 사람만 표시

## 구조

```
src/
  App.tsx              로그인·업로드 게이트 + 화면 셸
  components/          화면 컴포넌트 (대시보드/인력현황/캘린더/평가 등)
  excel/
    parse.ts           xlsx 파서 (zip + DecompressionStream)
    derive.ts          파생 필드 + 조직/제외/수습평가 규칙
    adapt.ts           엑셀 → 화면 데이터 어댑터
  mockData.ts          화면 데이터 (엑셀 업로드 시 주입, 없으면 샘플)
scripts/inline.mjs     dist → 단일 HTML 인라인
test/                  헤드리스 크롬 검증 (e2e / 기준일 / 규칙)
```

## 검증

```bash
./test-app.sh          # 로그인→업로드→전 메뉴 + 기준일 + 규칙 검증
```

## 배포

`hr.stek.kr` (사내 Dokploy). `main` 브랜치 push 시 GitHub Actions(자체 호스팅 러너)가
빌드 후 Dokploy에 반영한다. 수동 배포는 `./deploy.sh`.
