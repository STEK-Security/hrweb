#!/usr/bin/env bash
# hr-app.html 을 헤드리스 크롬에서 실제 엑셀로 종단 검증
#   e2e   — 로그인 → 엑셀 업로드 → 전 메뉴 순회 + 목데이터 잔존 검사
#   asof  — 기준일 변경 시 총원·입사자·퇴사자 재계산 검사
set -uo pipefail
cd "$(dirname "$0")"

run() {
  local name="$1" drv="$2"
  python3 - "$drv" "$name" <<'PY'
import sys
drv, name = sys.argv[1], sys.argv[2]
src = open('hr-app.html').read()
d = open(drv).read()
i = src.rfind('</body>')
open(f'/tmp/hr-{name}.html','w').write(src[:i] + '<script type="module">\n' + d + '\n</script>\n' + src[i:])
PY
  echo "───── $name ─────"
  google-chrome --headless=new --disable-gpu --no-sandbox --allow-file-access-from-files \
    --window-size=1600,1400 --virtual-time-budget=45000 --dump-dom "file:///tmp/hr-$name.html" 2>/dev/null \
  | python3 -c "
import sys,re,html
d=sys.stdin.read()
m=re.search(r'<pre id=\"result\">(.*?)</pre>', d, re.S)
t=re.search(r'<title>(.*?)</title>', d)
print(html.unescape(m.group(1)) if m else '!! 결과 노드 없음 — 스크립트 미실행')
print('==> ' + (t.group(1) if t else '?'))
"
}

python3 test/make-fixture.py /tmp/규칙검증데이터.xlsx >/dev/null

FAIL=0
for pair in "e2e:test/e2e.js" "asof:test/asof.js" "rules:test/rules.js"; do
  out=$(run "${pair%%:*}" "${pair##*:}")
  echo "$out"
  grep -qE '==> PASS|오류 0건' <<<"$out" || FAIL=1
  grep -q 'FAIL' <<<"$out" && FAIL=1
done
echo
[[ $FAIL -eq 0 ]] && echo "✅ 전체 통과" || echo "❌ 실패 있음"
exit $FAIL
