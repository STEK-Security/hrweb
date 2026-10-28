/**
 * 의존성 없는 최소 xlsx 쓰기 — 시트 1개, 글자(inlineStr)·숫자 셀. 무압축(stored) zip + crc32.
 * 읽기는 src/excel/parse.ts. 급여 엑셀(근태관리 확정·마감 탭)용.
 */

export type XlsxCell = string | number | null | undefined;

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** 무압축 zip. 이름은 ASCII, 날짜는 1980-01-01 고정. */
function zip(files: [string, string][]): Uint8Array {
  const enc = new TextEncoder();
  const entries = files.map(([name, text]) => ({ name: enc.encode(name), data: enc.encode(text) }));
  const size = entries.reduce((s, e) => s + 30 + e.name.length + e.data.length + 46 + e.name.length, 22);
  const out = new Uint8Array(size), dv = new DataView(out.buffer);
  const central: { off: number; crc: number; e: (typeof entries)[number] }[] = [];
  let p = 0;
  // 로컬 헤더와 중앙 디렉터리 공통 필드: 버전 20, 플래그 0x0800(UTF-8), 방식 0(stored), 시각 0, 날짜 1980-01-01
  const common = (at: number, crc: number, len: number, nlen: number) => {
    dv.setUint16(at, 20, true); dv.setUint16(at + 2, 0x0800, true); dv.setUint16(at + 4, 0, true);
    dv.setUint16(at + 6, 0, true); dv.setUint16(at + 8, 0x21, true);
    dv.setUint32(at + 10, crc, true); dv.setUint32(at + 14, len, true); dv.setUint32(at + 18, len, true);
    dv.setUint16(at + 22, nlen, true); dv.setUint16(at + 24, 0, true);
  };
  for (const e of entries) {
    const crc = crc32(e.data);
    central.push({ off: p, crc, e });
    dv.setUint32(p, 0x04034b50, true);
    common(p + 4, crc, e.data.length, e.name.length);
    out.set(e.name, p + 30);
    out.set(e.data, p + 30 + e.name.length);
    p += 30 + e.name.length + e.data.length;
  }
  const cdStart = p;
  for (const { off, crc, e } of central) {
    dv.setUint32(p, 0x02014b50, true);
    dv.setUint16(p + 4, 20, true); // made by
    common(p + 6, crc, e.data.length, e.name.length);
    // +32 주석 길이, +34 디스크, +36 내부 속성, +38 외부 속성 = 0
    dv.setUint32(p + 42, off, true);
    out.set(e.name, p + 46);
    p += 46 + e.name.length;
  }
  dv.setUint32(p, 0x06054b50, true);
  dv.setUint16(p + 8, entries.length, true);
  dv.setUint16(p + 10, entries.length, true);
  dv.setUint32(p + 12, p - cdStart, true);
  dv.setUint32(p + 16, cdStart, true);
  return out;
}

// XML 1.0 에 넣을 수 없는 제어문자는 뺀다(탭·줄바꿈 제외).
const esc = (s: string) => s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const colName = (i: number): string => (i >= 26 ? colName(Math.floor(i / 26) - 1) : '') + String.fromCharCode(65 + (i % 26));

function cell(v: XlsxCell, ref: string, bold: boolean): string {
  if (v === null || v === undefined || v === '') return '';
  const r = `r="${ref}"${bold ? ' s="1"' : ''}`; // s=1: styles cellXfs 의 굵은 글꼴
  if (typeof v === 'number') return Number.isFinite(v) ? `<c ${r}><v>${v}</v></c>` : '';
  const t = esc(v);
  return `<c ${r} t="inlineStr"><is><t${/^\s|\s$/.test(t) ? ' xml:space="preserve"' : ''}>${t}</t></is></c>`;
}

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

/** 행 배열(첫 행을 머리글로 굵게) → .xlsx 바이트. 시트 이름은 31자·금지문자 제거. */
export function xlsxWrite(rows: XlsxCell[][], sheetName = 'Sheet1'): Uint8Array {
  const name = esc(sheetName.replace(/[[\]:*?/\\]/g, '').slice(0, 31) || 'Sheet1');
  const body = rows.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => cell(v, `${colName(ci)}${ri + 1}`, ri === 0)).join('')}</row>`).join('');
  return zip([
    ['[Content_Types].xml', `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
      + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
      + '<Default Extension="xml" ContentType="application/xml"/>'
      + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
      + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
      + '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
      + '</Types>'],
    ['_rels/.rels', `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
      + `<Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ['xl/workbook.xml', `${XML}<workbook xmlns="${NS}" xmlns:r="${REL}"><sheets><sheet name="${name}" sheetId="1" r:id="rId1"/></sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
      + `<Relationship Id="rId1" Type="${REL}/worksheet" Target="worksheets/sheet1.xml"/>`
      + `<Relationship Id="rId2" Type="${REL}/styles" Target="styles.xml"/></Relationships>`],
    ['xl/styles.xml', `${XML}<styleSheet xmlns="${NS}">`
      + '<fonts count="2"><font><sz val="11"/><name val="맑은 고딕"/></font><font><b/><sz val="11"/><name val="맑은 고딕"/></font></fonts>'
      + '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'
      + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
      + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
      + '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>'
      + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
      + '</styleSheet>'],
    ['xl/worksheets/sheet1.xml', `${XML}<worksheet xmlns="${NS}">`
      + (rows.length > 1 ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' : '')
      + `<sheetData>${body}</sheetData></worksheet>`],
  ]);
}

/** 브라우저에서 바이트를 .xlsx 파일로 내려받게 한다. */
export function downloadXlsx(bytes: Uint8Array, filename: string): void {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
