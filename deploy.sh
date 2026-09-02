#!/usr/bin/env bash
# hr.stek.kr 배포 — Dokploy 가 GitHub 의 Dockerfile 로 빌드하게 트리거한다.
#
# ★ 로컬에서 bun 빌드한 단일파일(hr-app.html)을 파일마운트로 밀어넣지 않는다.
#   로컬 .env 에는 VITE_SUPABASE_* 가 없어서(Dokploy buildArgs 에만 있다) 그 번들은
#   supabase 미연결로 빌드되고, 마운트가 Docker 산출물을 덮어써 앱이 통째로 빈 화면이 된다.
#   실제로 두 번 그랬다. 그래서 이 스크립트는 그런 마운트가 있으면 먼저 제거한다.
#
# 사내망(172.30.60.21 도달 가능)에서 실행. .env 에 DOKPLOY_URL / DOKPLOY_API_KEY 필요.
# GitHub webhook 은 사내망 Dokploy 에 도달하지 못하므로 push 만으로는 배포되지 않는다.
set -euo pipefail
cd "$(dirname "$0")"
[ -f .env ] && { set -a; . ./.env; set +a; }
: "${DOKPLOY_URL:?.env 에 DOKPLOY_URL 필요}"
: "${DOKPLOY_API_KEY:?.env 에 DOKPLOY_API_KEY 필요}"
AID="${DOKPLOY_APP_ID:-kmatO1BdLPi0Sg_gibUbz}"

if [ -n "$(git status --porcelain -- src Dockerfile nginx.conf package.json)" ]; then
  echo "⚠ 커밋되지 않은 소스 변경이 있습니다. Dokploy 는 GitHub main 을 빌드하므로 먼저 push 하세요."
  git status --short -- src Dockerfile nginx.conf package.json
  exit 1
fi

DOKPLOY_URL="$DOKPLOY_URL" DOKPLOY_API_KEY="$DOKPLOY_API_KEY" AID="$AID" python3 - <<'PY'
import json, os, subprocess
U, K, AID = os.environ['DOKPLOY_URL'], os.environ['DOKPLOY_API_KEY'], os.environ['AID']

def api(path, body=None):
    cmd = ['curl','-sS','-H',f'x-api-key:{K}','-H','content-type:application/json', f'{U}/api/{path}']
    if body is not None:
        cmd[1:1] = ['-X','POST','--data-binary','@-']
    r = subprocess.run(cmd, input=(json.dumps(body) if body is not None else None),
                       capture_output=True, text=True, timeout=120)
    try: return json.loads(r.stdout)
    except Exception: return r.stdout

app = api(f'application.one?applicationId={AID}')
app = app.get('result') or app

for m in (app.get('mounts') or []):
    if m.get('mountPath','').endswith('index.html'):
        print(f"▶ index.html 파일마운트 제거: {m['mountId']} (Docker 빌드 산출물을 덮어쓰고 있었음)")
        api('mounts.remove', {"mountId": m['mountId']})

args = app.get('buildArgs') or ''
for key in ('VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'):
    if key not in args:
        raise SystemExit(f"✗ Dokploy buildArgs 에 {key} 가 없습니다. 빌드해도 supabase 미연결이 됩니다.")

print("▶ 배포 트리거 (GitHub main → Dockerfile 빌드)")
api('application.deploy', {"applicationId": AID})
PY

echo "▶ 반영 확인 (빌드에 수 분 소요 — 실패 시 잠시 후 다시 실행)"
for i in $(seq 1 40); do
  sleep 15
  body=$(curl -sk --max-time 15 --resolve hr.stek.kr:443:172.30.60.21 https://hr.stek.kr/ || true)
  # grep 미스는 정상 상황(빌드 중)이다. set -e 가 죽지 않게 || true 를 반드시 붙인다.
  asset=$(printf '%s' "$body" | grep -o 'assets/index-[A-Za-z0-9_-]*\.js' | head -1 || true)
  if [ -n "$asset" ]; then
    if curl -sk --max-time 30 --resolve hr.stek.kr:443:172.30.60.21 "https://hr.stek.kr/$asset" \
        | grep -q 'eyJhbGciOiJIUzI1NiI'; then
      echo "✅ https://hr.stek.kr 반영 완료 ($asset, supabase 연결됨)"
      exit 0
    fi
    echo "  ✗ $asset 에 anon key 가 없습니다 — buildArgs 주입 실패"
    exit 1
  fi
  printf '  ...대기 %d/40\n' "$i"
done
echo "✗ 시간 내 반영 확인 실패. Dokploy 에서 빌드 로그를 확인하세요."
exit 1
