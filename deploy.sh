#!/usr/bin/env bash
# hr-app.html 을 빌드해 사내 Dokploy(hr.stek.kr, frontend)에 배포한다.
# 사내망(172.30.60.21 도달 가능)에서 실행. .env 에 DOKPLOY_URL / DOKPLOY_API_KEY 필요.
set -euo pipefail
cd "$(dirname "$0")"
[ -f .env ] && { set -a; . ./.env; set +a; }
: "${DOKPLOY_URL:?.env 에 DOKPLOY_URL 필요}"
: "${DOKPLOY_API_KEY:?.env 에 DOKPLOY_API_KEY 필요}"
AID="${DOKPLOY_APP_ID:-kmatO1BdLPi0Sg_gibUbz}"

echo "▶ 빌드"
bun install --frozen-lockfile >/dev/null 2>&1 || bun install >/dev/null
bun run build:single >/dev/null
[ -f hr-app.html ] || { echo "빌드 실패: hr-app.html 없음"; exit 1; }
echo "  hr-app.html $(wc -c < hr-app.html) bytes"

echo "▶ Dokploy 파일 마운트 갱신 + 재배포"
DOKPLOY_URL="$DOKPLOY_URL" DOKPLOY_API_KEY="$DOKPLOY_API_KEY" AID="$AID" python3 - <<'PY'
import json, os, subprocess, sys
U, K, AID = os.environ['DOKPLOY_URL'], os.environ['DOKPLOY_API_KEY'], os.environ['AID']
def api(path, body=None):
    cmd = ['curl','-sS','-H',f'x-api-key:{K}','-H','content-type:application/json', f'{U}/api/{path}']
    if body is not None:
        cmd[1:1] = ['-X','POST','--data-binary','@-']
    r = subprocess.run(cmd, input=(json.dumps(body) if body is not None else None),
                       capture_output=True, text=True, timeout=60)
    try: return json.loads(r.stdout)
    except: return r.stdout

app = api(f'application.one?applicationId={AID}')
app = app.get('result') or app
mount = next((m for m in (app.get('mounts') or []) if m.get('mountPath','').endswith('index.html')), None)
html = open('hr-app.html').read()
if mount:
    api('mounts.update', {"mountId": mount['mountId'], "type": "file",
        "mountPath": mount['mountPath'], "content": html, "filePath": mount.get('filePath') or 'index.html'})
    print(f"  마운트 갱신: {mount['mountId']} ({len(html)} bytes)")
else:
    api('mounts.create', {"type": "file", "serviceId": AID, "serviceType": "application",
        "mountPath": "/usr/share/nginx/html/index.html", "content": html, "filePath": "index.html"})
    print("  마운트 신규 생성")
api('application.deploy', {"applicationId": AID})
print("  배포 트리거 완료")
PY
echo "✅ https://hr.stek.kr 반영 (Let's Encrypt/전파에 잠시 소요)"
