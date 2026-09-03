#!/usr/bin/env bash
# hr.stek.kr 배포 — Dokploy 가 GitHub main 의 Dockerfile 로 빌드하게 트리거하고,
# Dokploy 배포 레코드 + 라이브 번들로 결과를 검증한다.
#
# ★ 로컬에서 bun 빌드한 단일파일(hr-app.html)을 파일마운트로 밀어넣지 않는다.
#   로컬 .env 에는 VITE_SUPABASE_* 가 없어서(Dokploy buildArgs 에만 있다) 그 번들은
#   supabase 미연결로 빌드되고, 마운트가 Docker 산출물을 덮어써 앱이 통째로 빈 화면이 된다.
#   실제로 세 번 그랬다(2026-09-02 마운트 ZnVzkwSX0yuZbvWl8Hv_j 제거). 그래서 이 스크립트는
#   그런 마운트가 있으면 먼저 제거한다.
#
# 사내망(172.30.60.21 도달 가능)에서 실행. .env 에 DOKPLOY_URL / DOKPLOY_API_KEY 필요.
# GitHub webhook 은 사내망 Dokploy 에 도달하지 못하므로 push 만으로는 배포되지 않는다.
set -euo pipefail
cd "$(dirname "$0")"
[ -f .env ] && { set -a; . ./.env; set +a; }
: "${DOKPLOY_URL:?.env 에 DOKPLOY_URL 필요}"
: "${DOKPLOY_API_KEY:?.env 에 DOKPLOY_API_KEY 필요}"
AID="${DOKPLOY_APP_ID:-kmatO1BdLPi0Sg_gibUbz}"

# Dokploy 는 GitHub main 을 clone 해서 빌드한다. 그러므로 "빌드될 내용"은 로컬 작업트리가
# 아니라 origin/main 이다. 경로를 몇 개 골라 검사하면 빠진 파일 때문에 구버전을 새 버전으로
# 착각하므로, 작업트리 전체 + HEAD==origin/main 두 조건을 본다.
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "⚠ 커밋되지 않은 변경이 있습니다. Dokploy 는 GitHub main 을 빌드하므로 먼저 commit + push 하세요."
  git status --short --untracked-files=no
  exit 1
fi
git fetch -q origin main
if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
  echo "⚠ 로컬 HEAD 와 origin/main 이 다릅니다. push 하지 않으면 지금 코드가 배포되지 않습니다."
  git --no-pager log --oneline origin/main..HEAD | sed 's/^/  미푸시 /'
  exit 1
fi

DOKPLOY_URL="$DOKPLOY_URL" DOKPLOY_API_KEY="$DOKPLOY_API_KEY" AID="$AID" python3 - <<'PY'
"""마운트 정리 → buildArgs 검증 → 배포 트리거 → 배포 레코드 대기 → 라이브 번들 검증."""
import json, os, subprocess, sys, time

U, K, AID = os.environ['DOKPLOY_URL'], os.environ['DOKPLOY_API_KEY'], os.environ['AID']
HOST, IP = 'hr.stek.kr', '172.30.60.21'
ANON_MARK = 'eyJhbGciOiJIUzI1NiI'   # anon JWT 헤더. 이게 번들에 없으면 앱이 DB 미연결로 뜬다.


def api(path, body=None, timeout=120):
    cmd = ['curl', '-sS', '-H', f'x-api-key:{K}', '-H', 'content-type:application/json', f'{U}/api/{path}']
    if body is not None:
        cmd[1:1] = ['-X', 'POST', '--data-binary', '@-']
    r = subprocess.run(cmd, input=(json.dumps(body) if body is not None else None),
                       capture_output=True, text=True, timeout=timeout)
    try:
        out = json.loads(r.stdout)
    except Exception:
        return r.stdout
    return out.get('result', out) if isinstance(out, dict) else out


def live(path='', binary=False):
    """자체서명 + 사내 DNS 라 --resolve 로 직접 물린다. 실패는 None."""
    cmd = ['curl', '-sk', '--max-time', '60', '--resolve', f'{HOST}:443:{IP}', f'https://{HOST}/{path}']
    r = subprocess.run(cmd, capture_output=True, timeout=90)
    if r.returncode != 0:
        return None
    return r.stdout if binary else r.stdout.decode('utf-8', 'replace')


def newest_deployment():
    rows = api(f'deployment.all?applicationId={AID}')
    return rows[0] if isinstance(rows, list) and rows else None


app = api(f'application.one?applicationId={AID}')

for m in (app.get('mounts') or []):
    if m.get('mountPath', '').endswith('index.html'):
        print(f"▶ index.html 파일마운트 제거: {m['mountId']} (Docker 빌드 산출물을 덮어쓰고 있었음)")
        api('mounts.remove', {"mountId": m['mountId']})

args = app.get('buildArgs') or ''
missing = [k for k in ('VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY') if k not in args]
if missing:
    sys.exit(f"✗ Dokploy buildArgs 에 {', '.join(missing)} 가 없습니다. 빌드해도 supabase 미연결이 됩니다.")

before = newest_deployment()
before_id = (before or {}).get('deploymentId')

def live_asset():
    index = live()
    if not index:
        return None
    i = index.find('assets/index-')
    return index[i:index.find('"', i)] if i >= 0 else None

# 배포 전 번들 해시. 배포 레코드가 done 이어도 컨테이너 교체 전이면 구 번들이 서빙되는데,
# 구 번들에도 anon key 는 들어있어서 "키 있음"만 보면 그대로 성공으로 오판한다(실제로 그랬다).
asset_before = live_asset()
print(f"▶ 배포 트리거 (GitHub main → Dockerfile 빌드). 직전 배포: {before_id or '없음'}")
api('application.deploy', {"applicationId": AID})

# 배포 레코드가 새로 생기고 끝날 때까지 기다린다. 번들 해시 변화로 판정하면
# 프론트 소스를 안 건드린 커밋에서는 해시가 그대로라 영원히 오탐한다.
dep = None
for _ in range(60):          # 최대 5분
    time.sleep(5)
    cur = newest_deployment()
    if not cur or cur.get('deploymentId') == before_id:
        continue
    if cur.get('status') in ('done', 'error'):
        dep = cur
        break
    print(f"  ...빌드 중 ({cur.get('status')})")
else:
    sys.exit("✗ 시간 내 배포가 끝나지 않았습니다. Dokploy 빌드 로그를 확인하세요.")

title = (dep.get('title') or '').splitlines()[0]
if dep.get('status') == 'error':
    sys.exit(f"✗ 빌드 실패: {title}\n  {dep.get('errorMessage') or '(errorMessage 없음)'}")
print(f"▶ 빌드 완료: {title}")

# 컨테이너 교체가 끝날 때까지 기다린다. 판정 기준은 "번들이 실제로 바뀌었는가" 다.
asset = None
for _ in range(36):          # 최대 3분
    asset = live_asset()
    if asset and asset != asset_before:
        break
    time.sleep(5)

if asset and asset == asset_before:
    # 프론트 소스를 안 건드린 커밋이면 Vite 해시가 그대로다. 성공이라고 단정하지 않고 사실만 말한다.
    print(f"⚠ 번들이 이전과 동일하다({asset}). 프론트 변경이 없는 커밋이면 정상이고, "
          f"아니면 컨테이너 교체가 아직 안 끝난 것이다.")
    sys.exit(0)
if not asset:
    sys.exit("✗ 라이브 index.html 에서 번들을 찾지 못했습니다.")

# 새 번들에 anon key 가 실제로 들어갔는지 확인(buildArgs 주입 실패 탐지).
# ★ curl | grep -q 로 하면 grep 이 첫 매치에서 끝나 curl 이 SIGPIPE 로 죽고
#   pipefail 이 매치를 실패로 뒤집는다. 그래서 파이썬에서 내용을 직접 본다.
for _ in range(12):          # 교체 직후 404/부분응답 대비
    js = live(asset, binary=True)
    if js and ANON_MARK.encode() in js:
        print(f"✅ https://{HOST} 반영 완료 ({asset}, {len(js)} bytes, supabase 연결됨)")
        sys.exit(0)
    time.sleep(5)

sys.exit(f"✗ 새 번들 {asset} 에서 anon key 를 확인하지 못했습니다 — buildArgs 주입 실패 의심.")
PY
