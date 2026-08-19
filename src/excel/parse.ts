/**
 * xlsx 파서 — 외부 라이브러리 없이 브라우저 네이티브 API 만 사용.
 * zip 중앙 디렉터리 직독 + DecompressionStream('deflate-raw') + DOMParser.
 */

async function inflateRaw(buf: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream !== 'function') {
    throw new Error('이 브라우저는 xlsx 압축 해제를 지원하지 않습니다. Chrome/Edge/Safari 최신 버전을 사용하세요.');
  }
  const stream = new Blob([buf as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const out = new Uint8Array(await new Response(stream).arrayBuffer());
  if (out.length > 64e6) throw new Error('압축을 풀었을 때 파일이 너무 큽니다(64MB 초과).');
  return out;
}

async function unzipXml(arrayBuffer: ArrayBuffer): Promise<Record<string, string>> {
  const u8 = new Uint8Array(arrayBuffer);
  const dv = new DataView(arrayBuffer);
  let eocd = -1;
  for (let i = u8.length - 22; i >= 0 && i > u8.length - 65558; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('올바른 xlsx(zip) 파일이 아닙니다.');
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const entries: Record<string, { method: number; raw: Uint8Array }> = {};
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true);
    const elen = dv.getUint16(p + 30, true);
    const clen = dv.getUint16(p + 32, true);
    const lho = dv.getUint32(p + 42, true);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nlen));
    const lnlen = dv.getUint16(lho + 26, true);
    const lelen = dv.getUint16(lho + 28, true);
    const dstart = lho + 30 + lnlen + lelen;
    entries[name] = { method, raw: u8.subarray(dstart, dstart + csize) };
    p += 46 + nlen + elen + clen;
  }
  const out: Record<string, string> = {};
  for (const name in entries) {
    if (!/\.(xml|rels)$/i.test(name)) continue;
    const e = entries[name];
    out[name] = dec.decode(e.method === 0 ? e.raw : await inflateRaw(e.raw));
  }
  return out;
}

const colToNum = (ref: string): number => {
  let n = 0;
  for (const ch of ref) { if (ch < 'A' || ch > 'Z') break; n = n * 26 + (ch.charCodeAt(0) - 64); }
  return n;
};

/** Excel 1900 날짜 일련번호 → YYYY-MM-DD */
const serialToDate = (n: number): string | null => {
  const d = new Date(Math.round((n - 25569) * 86400000));
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

function parseSheetGrid(xml: string, shared: string[]): (string | null)[][] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('시트 XML을 해석할 수 없습니다.');
  const grid: (string | null)[][] = [];
  for (const row of Array.from(doc.getElementsByTagName('row'))) {
    const r = Number(row.getAttribute('r')) - 1;
    if (!(r >= 0 && r < 1e6)) continue;   // 조작된 행번호로 희소배열이 폭발하는 것을 막는다
    const arr = (grid[r] = grid[r] || []);
    for (const c of Array.from(row.getElementsByTagName('c'))) {
      const ref = c.getAttribute('r') || '';
      const ci = colToNum(ref.replace(/\d+/g, '')) - 1;
      if (ci < 0) continue;
      const t = c.getAttribute('t');
      let val: string | null = null;
      const is = c.getElementsByTagName('is')[0];
      if (is) val = Array.from(is.getElementsByTagName('t')).map((x) => x.textContent || '').join('');
      else {
        const v = c.getElementsByTagName('v')[0];
        if (v) val = t === 's' ? (shared[Number(v.textContent)] ?? '') : v.textContent;
      }
      arr[ci] = val;
    }
  }
  return grid;
}

export type RawRow = Record<string, string | null>;
export interface ParsedWorkbook {
  headers: string[];
  rows: RawRow[];
  sheetName: string;
}

/** File(.xlsx) → 헤더 + 행 객체 배열 */
export async function parseWorkbook(file: File): Promise<ParsedWorkbook> {
  const zip = await unzipXml(await file.arrayBuffer());
  const sheetKey =
    Object.keys(zip).find((k) => /^xl\/worksheets\/sheet1\.xml$/i.test(k)) ||
    Object.keys(zip).find((k) => /^xl\/worksheets\/.*\.xml$/i.test(k));
  if (!sheetKey) throw new Error('워크시트를 찾을 수 없습니다.');

  let shared: string[] = [];
  if (zip['xl/sharedStrings.xml']) {
    const sdoc = new DOMParser().parseFromString(zip['xl/sharedStrings.xml'], 'application/xml');
    shared = Array.from(sdoc.getElementsByTagName('si')).map((si) =>
      Array.from(si.getElementsByTagName('t')).map((t) => t.textContent || '').join('')
    );
  }
  let sheetName = '(sheet1)';
  if (zip['xl/workbook.xml']) {
    const wdoc = new DOMParser().parseFromString(zip['xl/workbook.xml'], 'application/xml');
    sheetName = wdoc.getElementsByTagName('sheet')[0]?.getAttribute('name') || sheetName;
  }

  const grid = parseSheetGrid(zip[sheetKey], shared);
  const headerRow = grid.find((r) => r && r.filter(Boolean).length > 3);
  if (!headerRow) throw new Error('헤더 행을 찾을 수 없습니다.');
  const hi = grid.indexOf(headerRow);
  const headers = headerRow.map((x, i) => (x || '').toString().trim() || `열${i + 1}`);

  const rows: RawRow[] = [];
  for (let i = hi + 1; i < grid.length; i++) {
    const g = grid[i];
    if (!g || !g.filter((x) => x != null && x !== '').length) continue;
    const o: RawRow = {};
    headers.forEach((hd, ci) => {
      let v = g[ci];
      if (v == null || v === '') { o[hd] = null; return; }
      v = String(v).trim();
      if (/일$|날짜|생년월일/.test(hd) && /^\d{5}(\.\d+)?$/.test(v)) v = serialToDate(Number(v)) || v;
      o[hd] = v;
    });
    rows.push(o);
  }
  if (!rows.length) throw new Error('데이터 행이 없습니다.');
  return { headers, rows, sheetName };
}

/** 표준 69컬럼 — 업로드 파일 검증에 사용 */
export const STANDARD_COLUMNS = [
  '성명', '법인', '소속', '직책', '직급', '주민번호', '생년월일', '나이(만)', '성별', '그룹사원번호',
  '그룹웨어ID', '영문성명', '고용구분', '근무지', '입사일', '그룹입사일', '퇴직일', '퇴직사유',
  '근속연수(그룹입사일)', '근속연수(입사일)', '음양구분', '생일', '결혼여부', '발령명', '입사경로',
  '추천인', '인정경력(년)', '인정경력(월)', '현 주소(우편번호)', '현 주소(주소)', '등본주소(우편번호)',
  '등본주소(주소)', '휴대폰번호', '비상연락망', '내/외국인', '국적', '거주지국', '체류자격',
  '체류시작일', '체류종료일', '급여계좌(은행)', '급여계좌(계좌번호)', '급여계좌(예금주)',
  '경비계좌(은행)', '경비계좌(계좌번호)', '경비계좌(예금주)', '근태기준일', '퇴직기준일',
  '최종이동일', '최종보임일', '직무변경일', '직종전환일', '계약시작일', '계약종료일', '수습종료일',
  '개인메일', '학력', '학교', '학위', '전공', '역종', '군별', '계급', '병역특례여부', '장애여부',
  '보훈대상자', '사번', '닉네임', '전체소속명',
];

export const REQUIRED_COLUMNS = ['성명', '입사일'];
