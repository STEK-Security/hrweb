#!/usr/bin/env bash
# 사용법: ./test/shot.sh <메뉴명> <출력png>
# 첫 실행 시 로그인+엑셀업로드를 수행하고 프로필에 저장, 이후 실행은 해당 메뉴로 이동해 캡처
set -uo pipefail
cd "$(dirname "$0")/.."
MENU="${1:-대시보드}"; OUT="${2:-/tmp/shot.png}"
python3 - "$MENU" <<'PY'
import sys
menu = sys.argv[1]
src = open('hr-app.html').read()
drv = '''
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const wait = async (fn, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { const v = fn(); if (v) return v; await sleep(70); } return null; };
  const setNV = (el, v) => { Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
  if (!document.getElementById('nav-menu-대시보드')) {
    const pw = await wait(() => document.querySelector('input[type=password]'));
    if (pw) {
      const f = document.querySelector('form');
      setNV(f.querySelector('input:not([type=password])'), 'hr');
      setNV(pw, 'hr1234');
      f.querySelector('button[type=submit]').click();
    }
    const fi = await wait(() => document.querySelector('input[type=file]'));
    if (fi) {
      const res = await fetch('file:///home/stek/stek/hr/인사자료/인사기초정보_데모데이터.xlsx');
      const dt = new DataTransfer(); dt.items.add(new File([await res.blob()], '인사기초정보_데모데이터.xlsx'));
      fi.files = dt.files; fi.dispatchEvent(new Event('change', { bubbles: true }));
      const ab = await wait(() => [...document.querySelectorAll('button')].find((b) => /적용/.test(b.textContent) && !b.disabled));
      if (ab) ab.click();
    }
  }
  // 데이터 적용 후 셸이 리마운트되므로 대시보드 렌더 완료를 먼저 기다린다
  await wait(() => (document.getElementById('root') || document.body).textContent.includes('비율별 분포'));
  await sleep(500);
  const btn = await wait(() => document.getElementById('nav-menu-' + MENU_NAME));
  if (btn) btn.click();
  await sleep(1800);
})();
'''.replace('MENU_NAME', repr(menu).replace("'", '"'))
i = src.rfind('</body>')
open('/tmp/hr-shot.html','w').write(src[:i] + '<script type="module">\n' + drv + '\n</script>\n' + src[i:])
PY
google-chrome --headless=new --disable-gpu --no-sandbox --allow-file-access-from-files \
  --user-data-dir=${HR_PROFILE:-/tmp/hr-profile} --hide-scrollbars \
  --window-size=1600,1400 --virtual-time-budget=30000 \
  --screenshot="$OUT" "file:///tmp/hr-shot.html" 2>/dev/null
echo "→ $OUT ($(stat -c%s "$OUT" 2>/dev/null || echo 0) bytes)"
