/**
 * 의존성 없는 xlsx 쓰기 — 산출물을 src/excel/parse.ts 로 다시 읽어 확인한다(Review Focus 5).
 * 실행: bun run test:unit
 */
import assert from 'node:assert/strict';
import { crc32, xlsxWrite } from '../../src/lib/xlsxWrite';
import { parseWorkbook } from '../../src/excel/parse';

// --- Node 에 없는 DOMParser 최소 대역: parse.ts 가 쓰는 getElementsByTagName·getAttribute·textContent·querySelector 만 ---
interface El { tag: string; attrs: Record<string, string>; kids: El[]; text: string }
const unesc = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const wrap = (e: El): unknown => ({
  getAttribute: (n: string) => e.attrs[n] ?? null,
  get textContent() { const all = (x: El): string => x.text + x.kids.map(all).join(''); return all(e); },
  getElementsByTagName: (n: string) => {
    const out: unknown[] = [];
    const walk = (x: El) => x.kids.forEach((k) => { if (k.tag === n) out.push(wrap(k)); walk(k); });
    walk(e);
    return out;
  },
  querySelector: () => null,
});
(globalThis as { DOMParser?: unknown }).DOMParser = class {
  parseFromString(xml: string) {
    const root: El = { tag: '#doc', attrs: {}, kids: [], text: '' };
    const stack = [root];
    for (const m of xml.replace(/<\?[^>]*\?>/g, '').matchAll(/<(\/?)([\w:]+)([^>]*?)(\/?)>|([^<]+)/g)) {
      const top = stack[stack.length - 1];
      if (m[5] !== undefined) { top.kids.push({ tag: '#text', attrs: {}, kids: [], text: unesc(m[5]) }); continue; }
      if (m[1]) { stack.pop(); continue; }
      const el: El = { tag: m[2], attrs: Object.fromEntries([...m[3].matchAll(/([\w:]+)="([^"]*)"/g)].map((a) => [a[1], unesc(a[2])])), kids: [], text: '' };
      top.kids.push(el);
      if (!m[4]) stack.push(el);
    }
    return wrap(root);
  }
};

// crc32 표준 검증값
assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
assert.equal(crc32(new Uint8Array()), 0);

const header = ['사번', '이름', '근무일', '인정시간', '비고'];
const rows: (string | number | null)[][] = [
  header,
  ['S001', '김철수', '2026-10-01', 8, '정상'],
  ['S002', '이영희 ', '2026-10-02', 9.5, 'a<b & "c" \'d\'>'],
  ['S003', '박\u0001민수', '2026-10-03', 0, null],
];
const bytes = xlsxWrite(rows, '근태');

// zip 시그니처(PK\3\4)와 끝의 중앙 디렉터리 종료(PK\5\6)
assert.deepEqual([...bytes.subarray(0, 4)], [0x50, 0x4b, 0x03, 0x04]);
const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
assert.equal(dv.getUint32(bytes.length - 22, true), 0x06054b50);

// 파일 목록(로컬 헤더 이름)과 각 항목의 crc32 일치
const names: string[] = [];
for (let p = 0; dv.getUint32(p, true) === 0x04034b50;) {
  const crc = dv.getUint32(p + 14, true), size = dv.getUint32(p + 18, true), nlen = dv.getUint16(p + 26, true), elen = dv.getUint16(p + 28, true);
  names.push(new TextDecoder().decode(bytes.subarray(p + 30, p + 30 + nlen)));
  const data = bytes.subarray(p + 30 + nlen + elen, p + 30 + nlen + elen + size);
  assert.equal(crc32(data), crc, `crc ${names.at(-1)}`);
  p += 30 + nlen + elen + size;
}
assert.deepEqual(names, ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/worksheets/sheet1.xml']);
assert.equal(dv.getUint16(bytes.length - 22 + 10, true), names.length, '중앙 디렉터리 항목 수');

// 숫자는 숫자 셀, 글자는 inlineStr
const sheet = new TextDecoder().decode(bytes);
assert.match(sheet, /<c r="D3"><v>9\.5<\/v><\/c>/);
assert.match(sheet, /<c r="A1" s="1" t="inlineStr"><is><t>사번<\/t><\/is><\/c>/);

// parse.ts 로 다시 읽기 — 한글·특수문자·숫자 값 그대로
const wb = await parseWorkbook(new File([bytes as BlobPart], 't.xlsx'));
assert.equal(wb.sheetName, '근태');
assert.deepEqual(wb.headers, header);
assert.equal(wb.rows.length, 3);
assert.deepEqual(wb.rows[0], { 사번: 'S001', 이름: '김철수', 근무일: '2026-10-01', 인정시간: '8', 비고: '정상' });
assert.equal(wb.rows[1].비고, 'a<b & "c" \'d\'>');
assert.equal(wb.rows[1].인정시간, '9.5');
assert.equal(wb.rows[2].이름, '박민수', 'XML 금지 제어문자는 뺀다');
assert.equal(wb.rows[2].인정시간, '0');
assert.equal(wb.rows[2].비고, null);
assert.match(sheet, /<t xml:space="preserve">이영희 <\/t>/, '끝 공백 보존');

// 26열 넘는 열 이름(AA)
const wide = xlsxWrite([Array.from({ length: 28 }, (_, i) => i)]);
assert.match(new TextDecoder().decode(wide), /<c r="AB1" s="1"><v>27<\/v><\/c>/);

console.log('xlsxWrite: ok');
