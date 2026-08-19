/* 운영자 지정 규칙 검증: 테스트/GPRO 제외 · 미지정 제외 · 총괄→TBS · 생산(생산/품질/물류) · 수습평가 +30/+55 */
(function () {
  const R = []; let pre;
  const flush = () => { if (!pre) { pre = document.createElement('pre'); pre.id = 'result'; document.body.appendChild(pre); } pre.textContent = R.join('\n'); };
  const ok = (n, c, got) => { R.push(`${c ? 'PASS' : 'FAIL'}  ${n}${c ? '' : `  → ${got}`}`); flush(); };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const wait = async (fn, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { const v = fn(); if (v) return v; await sleep(70); } return null; };
  const setNV = (el, v) => { Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
  const body = () => (document.getElementById('root') || document.body).textContent || '';

  (async () => {
    try {
      localStorage.clear(); sessionStorage.clear();
      const pw = await wait(() => document.querySelector('input[type=password]'));
      const f = document.querySelector('form');
      setNV(f.querySelector('input:not([type=password])'), 'hr'); setNV(pw, 'hr1234');
      f.querySelector('button[type=submit]').click();
      const fi = await wait(() => document.querySelector('input[type=file]'));
      const res = await fetch('file:///tmp/' + encodeURIComponent('규칙검증데이터.xlsx'));
      if (!res.ok) throw new Error('검증 엑셀을 읽지 못했습니다: ' + res.status);
      const dt = new DataTransfer(); dt.items.add(new File([await res.blob()], '규칙검증데이터.xlsx'));
      fi.files = dt.files; fi.dispatchEvent(new Event('change', { bubbles: true }));
      const ab = await wait(() => [...document.querySelectorAll('button')].find((b) => /적용/.test(b.textContent) && !b.disabled));
      ab.click();
      await wait(() => body().includes('비율별 분포'));
      await sleep(900);

      const dash = body();
      // 1) 테스트·GPRO 제외
      const roster = dash.replace(/규칙검증데이터\.xlsx/g, '');
      ok('테스트 인원 미표시', !roster.includes('테스트'), '테스트 문자열 발견');
      // 픽스처 18행 − 테스트·GPRO 2행 = 16명 적재 (상단바 칩 기준)
      const chip = document.querySelector('button[title*="제외"]') || document.querySelector('button[title*="xlsx"]');
      const chipTxt = chip ? chip.textContent || '' : '';
      ok('적재 인원 16명 (18행 − 테스트·GPRO 2행)', /16명/.test(chipTxt), chipTxt);
      ok('상단바에 제외 건수 2건 표기', /2건 제외/.test(chip ? chip.getAttribute('title') || '' : ''), chip ? chip.getAttribute('title') : '칩 없음');
      ok('GPRO 인원 미표시', !/GPRO/i.test(dash), 'GPRO 발견');
      // 2) 총괄 → TBS
      const corpSel = document.querySelector('select[aria-label="법인 선택"]');
      const opts = corpSel ? [...corpSel.options].map((o) => o.value) : [];
      ok('법인 목록에 TBS 표기', opts.includes('TBS'), opts.join(' / '));
      ok('법인 목록에 총괄 없음', !opts.includes('총괄'), opts.join(' / '));
      // 3) 부서별 분포에 미지정·테스트본부 없음
      const deptBox = [...document.querySelectorAll('div')].find((d) => (d.textContent || '').startsWith('부서별 인원 분포'));
      const deptTxt = deptBox ? deptBox.textContent : '';
      ok('부서별에 미지정 없음', !deptTxt.includes('미지정'), deptTxt.slice(0, 120));
      ok('부서별에 테스트본부 없음', !deptTxt.includes('테스트'), deptTxt.slice(0, 120));
      ok('부서별에 생산본부 있음', deptTxt.includes('생산본부'), deptTxt.slice(0, 160));
      // 4) 현장직 = 생산+품질+물류 3명
      const jobBox = [...document.querySelectorAll('div')].find((d) => (d.textContent || '').startsWith('직군별 비율'));
      const jobTxt = jobBox ? jobBox.textContent : '';
      R.push('직군별: ' + jobTxt.replace(/\s+/g, ' ').slice(0, 120)); flush();
      // 원본 데모(생산관리팀 2 + 품질관리팀 1) + 추가(생산·품질·물류 3) = 6명
      ok('현장직 6명 (생산·품질·물류 소속만)', /현장직 \d+% \(6명\)/.test(jobTxt), jobTxt.slice(0, 120));
      ok('사무직 7명', /사무직 \d+% \(7명\)/.test(jobTxt), jobTxt.slice(0, 120));
      ok('사무직/현장직에 382·266 없음', !/382|266/.test(jobTxt), jobTxt.slice(0, 120));

      // 4-b) 생일은 "그 날짜에 재직 중" 인 경우만 (퇴직일 8/10 기준)
      document.getElementById('nav-menu-캘린더').click();
      await sleep(1300);
      const cal = body();
      ok('퇴직(8/10) 이전 생일(8/5) 은 표시', /생일이전퇴사 생일/.test(cal), '없음');
      ok('퇴직(8/10) 이후 생일(8/11) 은 제외', !/생일이후퇴사 생일/.test(cal), '표시됨');
      ok('두 사람의 퇴사 일정은 모두 유지', /생일이전퇴사 퇴사/.test(cal) && /생일이후퇴사 퇴사/.test(cal), '퇴사 일정 누락');

      // 5) 수습평가 +30 / +55
      document.getElementById('nav-menu-평가관리').click();
      await sleep(1200);
      const ev = body();
      // 김생산 입사 2026-08-05 → 1차 09-04, 최종 09-29
      ok('1차 수습평가일 = 입사 +30일 (2026-09-04)', ev.includes('2026-09-04'), '없음');
      ok('최종 수습평가일 = 입사 +55일 (2026-09-29)', ev.includes('2026-09-29'), '없음');
      ok('1차/최종 두 단계 모두 생성', ev.includes('1차 수습') && ev.includes('최종 수습'), '단계 누락');
      ok('평가 대상에 테스트·GPRO 없음', !/테스트|GPRO/i.test(ev.replace(/규칙검증데이터\.xlsx/g, '')), '발견');

      // 6) 인력현황에도 테스트 없음
      document.getElementById('nav-menu-인력현황').click();
      await sleep(1200);
      const hc = body();
      ok('인력현황에 테스트 없음', !hc.replace(/규칙검증데이터\.xlsx/g, '').includes('테스트'), '발견');
      ok('인력현황에 382/266 없음', !/382|266/.test(hc), '발견');
    } catch (e) {
      R.push('THREW: ' + (e && e.message || e));
    }
    flush();
    document.title = R.some((x) => x.startsWith('FAIL') || x.startsWith('THREW')) ? 'FAIL' : 'PASS';
  })();
})();
