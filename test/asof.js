/* 기준일 변경 시 총원·입사자·퇴사자가 다시 계산되는지 검증 */
(function () {
  const R = []; let pre;
  const flush = () => { if (!pre) { pre = document.createElement('pre'); pre.id = 'result'; document.body.appendChild(pre); } pre.textContent = R.join('\n'); };
  const ok = (n, c, got) => { R.push(`${c ? 'PASS' : 'FAIL'}  ${n}${c ? '' : `  → ${got}`}`); flush(); };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const wait = async (fn, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { const v = fn(); if (v) return v; await sleep(70); } return null; };
  const setNV = (el, v) => { Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
  const cardVal = (label) => {
    const ps = [...document.querySelectorAll('p')].filter((p) => (p.textContent || '').trim() === label);
    if (!ps.length) return null;
    const card = ps[0].parentElement;
    const span = card.querySelector('.text-2xl');
    return span ? span.textContent.trim() : null;
  };
  const monthLabel = () => {
    const p = [...document.querySelectorAll('p')].find((x) => /월 입사자$/.test((x.textContent || '').trim()));
    return p ? p.textContent.trim() : '?';
  };

  (async () => {
    try {
      localStorage.clear(); sessionStorage.clear();
      const pw = await wait(() => document.querySelector('input[type=password]'));
      const f = document.querySelector('form');
      setNV(f.querySelector('input:not([type=password])'), 'hr'); setNV(pw, 'hr1234');
      f.querySelector('button[type=submit]').click();
      const fi = await wait(() => document.querySelector('input[type=file]'));
      const res = await fetch('file:///home/stek/stek/hr/인사자료/인사기초정보_데모데이터.xlsx');
      const dt = new DataTransfer(); dt.items.add(new File([await res.blob()], 'demo.xlsx'));
      fi.files = dt.files; fi.dispatchEvent(new Event('change', { bubbles: true }));
      const ab = await wait(() => [...document.querySelectorAll('button')].find((b) => /적용/.test(b.textContent) && !b.disabled));
      ab.click();
      await wait(() => document.body.textContent.includes('비율별 분포'));
      await sleep(700);

      const base = { total: cardVal('총 재직 인원'), hires: cardVal(monthLabel()), label: monthLabel() };
      R.push(`기준 2026-08 → 총원 ${base.total} / ${base.label} ${base.hires}`); flush();
      ok('기준일 총원 9명', base.total === '9', base.total);

      // 기준일 팝오버 열기
      const asOfBtn = [...document.querySelectorAll('button')].find((b) => /기준$/.test((b.textContent || '').trim()));
      if (!asOfBtn) throw new Error('기준일 버튼을 찾을 수 없음');
      asOfBtn.click();
      await sleep(400);

      // 이전 달 버튼을 8번 눌러 2025-12 로 이동
      const findPrev = () => {
        const pop = document.querySelector('.absolute.z-50, [class*="absolute"][class*="z-"]');
        const btns = [...(pop || document).querySelectorAll('button')];
        return btns.find((b) => b.querySelector('svg') && b.getBoundingClientRect().width < 40);
      };
      let moved = 0;
      for (let i = 0; i < 8; i++) {
        const prev = findPrev();
        if (!prev) break;
        prev.click(); moved++; await sleep(120);
      }
      R.push(`이전 달 클릭 ${moved}회`); flush();

      // 15일 클릭
      const dayBtn = [...document.querySelectorAll('button')].filter((b) => (b.textContent || '').trim() === '15').pop();
      if (!dayBtn) throw new Error('15일 버튼을 찾을 수 없음');
      dayBtn.click();
      await sleep(700);

      const after = { total: cardVal('총 재직 인원'), label: monthLabel() };
      const leaveLabel = after.label.replace('입사자', '퇴사자');
      after.hires = cardVal(after.label);
      after.leavers = cardVal(leaveLabel);
      R.push(`변경 후 → ${after.label} / 총원 ${after.total} / 입사 ${after.hires} / 퇴사 ${after.leavers}`); flush();

      ok('기준일 변경으로 라벨이 12월로 바뀜', /12월/.test(after.label), after.label);
      ok('12월 퇴사자 1명 (오세영 2025-12-31)', after.leavers === '1', after.leavers);
      ok('2025-12-15 기준 총원 10명 (퇴직 전)', after.total === '10', after.total);
      ok('값이 8월 고정이 아님', after.total !== base.total || after.leavers !== '0', `총원 ${after.total}, 퇴사 ${after.leavers}`);
    } catch (e) {
      R.push('THREW: ' + (e && e.message || e));
    }
    flush();
    document.title = R.some((x) => x.startsWith('FAIL') || x.startsWith('THREW')) ? 'FAIL' : 'PASS';
  })();
})();
