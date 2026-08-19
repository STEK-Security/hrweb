/* hr-app.html 종단 검증: 로그인 → 엑셀 업로드 → 전 메뉴 순회 */
const LOG = [];
const errs = [];
const say = (s) => { LOG.push(s); render(); };
const ok = (n, c, got) => { LOG.push(`${c ? 'PASS' : 'FAIL'}  ${n}${c ? '' : `  → ${got}`}`); if (!c) errs.push(`${n} : ${got}`); render(); };
let pre;
function render() {
  if (!pre) { pre = document.createElement('pre'); pre.id = 'result'; document.body.appendChild(pre); }
  pre.textContent = LOG.join('\n') + (errs.length ? '\n\n=== ERRORS ===\n' + errs.join('\n') : '');
}
window.addEventListener('error', (e) => { errs.push('onerror: ' + e.message); render(); });
window.addEventListener('unhandledrejection', (e) => { errs.push('unhandled: ' + (e.reason && e.reason.message || e.reason)); render(); });
const origErr = console.error;
console.error = (...a) => { errs.push('console.error: ' + a.map(String).join(' ').slice(0, 300)); origErr(...a); render(); };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, label, timeout = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const v = fn();
    if (v) return v;
    await sleep(80);
  }
  throw new Error(`대기 실패: ${label}`);
}
const txt = () => document.getElementById('root').textContent || '';
function setNativeValue(el, value) {
  const setter = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set;
  setter.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

(async () => {
  try {
    localStorage.clear(); sessionStorage.clear();

    // 1. 로그인 화면
    await waitFor(() => txt().includes('STEK HR') && document.querySelector('input[type=password]'), '로그인 화면');
    say('PASS  로그인 화면 렌더');
    const chips = [...document.querySelectorAll('button')].filter((b) => /admin|hr|lead|user/.test(b.textContent || ''));
    say(`      데모 계정 버튼 ${chips.length}개`);

    // 2. 로그인 (폼 제출)
    const form = document.querySelector('form');
    const idInput = form.querySelector('input:not([type=password])');
    const pwInput = form.querySelector('input[type=password]');
    setNativeValue(idInput, 'hr');
    setNativeValue(pwInput, 'hr1234');
    form.querySelector('button[type=submit]').click();
    await waitFor(() => /업로드|끌어다|xlsx/i.test(txt()), '업로드 화면');
    say('PASS  로그인 → 데이터 업로드 화면 진입');

    // 3. 실제 엑셀 파일 드롭
    const res = await fetch('file:///home/stek/stek/hr/인사자료/인사기초정보_데모데이터.xlsx');
    const file = new File([await res.blob()], '인사기초정보_데모데이터.xlsx',
      { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const fileInput = await waitFor(() => document.querySelector('input[type=file]'), '파일 입력');
    const dt = new DataTransfer();
    dt.items.add(file);
    fileInput.files = dt.files;
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));

    // 4. 검토 단계
    await waitFor(() => /인사기초정보\(데모\)|시트/.test(txt()) && /적용/.test(txt()), '파싱 검토 단계', 15000);
    say('PASS  엑셀 파싱 → 적재 전 검토 화면');
    const review = txt();
    say(`      검토 화면에 "69" 포함: ${review.includes('69')} / "10" 포함: ${review.includes('10')}`);
    for (const name of ['김민준', '스텍오토모티브', 'AI인프라팀']) {
      say(`      미리보기에 ${name}: ${review.includes(name)}`);
    }

    // 5. 적용
    const applyBtn = [...document.querySelectorAll('button')].find((b) => /적용/.test(b.textContent || '') && !b.disabled);
    if (!applyBtn) throw new Error('[데이터 적용] 버튼을 찾을 수 없거나 비활성 상태');
    applyBtn.click();
    await waitFor(() => document.getElementById('nav-menu-대시보드'), '기존 대시보드 화면', 12000);
    say('PASS  데이터 적용 → 기존 대시보드 진입');

    // 6. 엑셀 값이 실제로 화면에 반영됐는지
    await sleep(600);
    const dash = txt();
    say(`      Navbar 파일명 표시: ${dash.includes('인사기초정보_데모데이터.xlsx')}`);
    say(`      로그인 사용자 표시: ${dash.includes('김인사')}`);
    const corpSel = document.querySelector('select[aria-label="법인 선택"]');
    say(`      법인 필터 옵션: ${corpSel ? [...corpSel.options].map((o) => o.value).join(' / ') : '없음'}`);
    // 총원 KPI 가 목데이터 648 이 아니라 엑셀 기준(9~10) 인지
    // 목데이터 잔존 검사 — 엑셀을 올렸는데 데모 숫자가 남아 있으면 실패
    for (const bad of ['648', '638', '2026.08.18', '632명']) {
      if (dash.includes(bad)) errs.push(`목데이터 잔존: 대시보드에 "${bad}" 표시됨`);
    }
    say(`${dash.includes('648') || dash.includes('638') ? 'FAIL' : 'PASS'}  목데이터 총원(648/638) 제거됨`);
    // 엑셀 기준 총원(재직 9명)이 실제로 표시되는지
    const okTotal = /\b9명\b/.test(dash) || /\b10명\b/.test(dash);
    say(`${okTotal ? 'PASS' : 'FAIL'}  엑셀 기준 총원 표시(9명 또는 10명)`);
    if (!okTotal) errs.push('엑셀 기준 총원이 화면에 없음');
    for (const t of ['경영지원본부', '생산본부', '영업본부']) {
      if (dash.includes(t)) say(`      대시보드에 엑셀 본부 "${t}" 표시됨`);
    }

    // 6-b. 퇴사자 생일은 캘린더에 나오지 않아야 한다 (오세영: 퇴직 2025-12-31, 생일 04-18)
    document.getElementById('nav-menu-캘린더').click();
    await sleep(900);
    const cal = txt();
    ok('퇴사자 생일 미표시 (오세영 생일)', !/오세영 생일/.test(cal), '오세영 생일 발견');
    ok('퇴사자 퇴사 일정은 유지', /오세영 퇴사/.test(cal), '오세영 퇴사 없음');
    ok('재직자 생일은 표시 (생일 항목 존재)', /생일/.test(cal), '생일 항목 없음');
    document.getElementById('nav-menu-대시보드').click();
    await sleep(500);

    // 7. 전 메뉴 순회
    const menus = ['대시보드', '캘린더', '인력현황', '휴직자관리', '인건비', '교육관리', '평가관리'];
    for (const m of menus) {
      const btn = document.getElementById('nav-menu-' + m);
      if (!btn) { errs.push(`메뉴 버튼 없음: ${m}`); continue; }
      const before = errs.length;
      btn.click();
      await sleep(500);
      const body = txt();
      const nodes = document.getElementById('root').querySelectorAll('*').length;
      const sample = /샘플 데이터|휴직 데이터가 없습니다/.test(body);
      // 샘플 배너가 붙은 화면(인건비·교육·휴직)은 목데이터가 정상이므로 검사 제외
      let stale = '';
      if (!sample && m !== '평가관리') {
        for (const bad of ['648', '638', '632명', '2026.08.18']) {
          if (body.includes(bad)) { stale = ` ⚠ 목데이터 "${bad}" 잔존`; errs.push(`${m}: 목데이터 "${bad}" 잔존`); }
        }
      }
      say(`${errs.length === before ? 'PASS' : 'FAIL'}  메뉴 ${m.padEnd(6)} nodes=${nodes}${sample ? ' (샘플 배너 표시)' : ''}${stale}`);
    }

    // 8. 새로고침 후 데이터 유지 확인용 저장 상태
    const saved = localStorage.getItem('stek-hr-data-v1');
    say(`${saved ? 'PASS' : 'FAIL'}  적재 데이터 localStorage 저장 (${saved ? Math.round(saved.length / 1024) + 'KB' : '없음'})`);
    say(`${sessionStorage.getItem('stek-hr-user-v1') ? 'PASS' : 'FAIL'}  세션 사용자 저장`);

    say('');
    say(errs.length ? `❌ 오류 ${errs.length}건` : '✅ 오류 0건');
  } catch (e) {
    errs.push('DRIVER: ' + (e && e.stack || e));
  }
  render();
  document.title = errs.length ? 'FAIL:' + errs.length : 'PASS';
})();
