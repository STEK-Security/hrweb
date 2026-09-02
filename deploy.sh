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

BEFORE=$(curl -sk --max-time 15 --resolve hr.stek.kr:443:172.30.60.21 https://hr.stek.kr/ 2>/dev/null \
  | grep -o 'assets/index-[A-Za-z0-9_-]*\.js' | head -1 || true)
echo "▶ 현재 번들: ${BEFORE:-없음}"

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

echo "▶ 반영 확인 (빌드에 수 분 소요)"
# 배포 전 번들 해시를 먼저 잡아둔다. 해시가 "바뀐" 뒤에 검사해야 한다 —
# 바로 검사하면 아직 살아있는 이전 번들(또는 교체 중 404)을 새 빌드로 착각한다.
live_asset() {
  curl -sk --max-time 15 --resolve hr.stek.kr:443:172.30.60.21 https://hr.stek.kr/ 2>/dev/null \
    | grep -o 'assets/index-[A-Za-z0-9_-]*\.js' | head -1 || true
}
before="$BEFORE"
for i in $(seq 1 40); do
  sleep 15
  asset=$(live_asset)
  if [ -n "$asset" ] && [ "$asset" != "$before" ]; then
    if curl -sk --max-time 60 --resolve hr.stek.kr:443:172.30.60.21 "https://hr.stek.kr/$asset" \
        | grep -q 'eyJhbGciOiJIUzI1NiI'; then
      echo "✅ https://hr.stek.kr 반영 완료 ($asset, supabase 연결됨)"
      exit 0
    fi
    echo "✗ $asset 에 anon key 가 없습니다 — Dokploy buildArgs 주입 실패"
    exit 1
  fi
  printf '  ...빌드 대기 %d/40 (현재 %s)\n' "$i" "${asset:-없음}"
done
echo "✗ 시간 내 번들 교체를 확인하지 못했습니다. Dokploy 빌드 로그를 확인하세요."
exit 1
