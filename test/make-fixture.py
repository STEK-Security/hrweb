#!/usr/bin/env python3
"""규칙 검증용 엑셀 생성: 데모 10명 + 테스트/GPRO/총괄/생산·품질·물류/무소속 6행"""
import zipfile, xml.etree.ElementTree as ET, html, sys, os
NS = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
SRC = os.path.join(os.path.dirname(__file__), '..', '인사자료', '인사기초정보_데모데이터.xlsx')
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/규칙검증데이터.xlsx'

z = zipfile.ZipFile(SRC)
root = ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
grid = {}
for r in root.iter(NS + 'row'):
    cells = {}
    for c in r.iter(NS + 'c'):
        ref = c.get('r'); v = c.find(NS + 'v'); isx = c.find(NS + 'is'); val = None
        if isx is not None: val = ''.join(x.text or '' for x in isx.iter(NS + 't'))
        elif v is not None: val = v.text
        cells[''.join(ch for ch in ref if ch.isalpha())] = val
    grid[int(r.get('r'))] = cells
hdr = grid[1]; cols = list(hdr.keys()); headers = [hdr[c] for c in cols]
rows = [[grid[rr].get(c) for c in cols] for rr in sorted(grid) if rr > 1]

def mk(**kw):
    row = [None] * len(headers)
    for k, v in kw.items(): row[headers.index(k)] = v
    return row

rows += [
    mk(성명='홍길동테스트', 법인='총괄', 소속='테스트팀', 전체소속명='총괄 > 테스트본부 > 테스트팀', 직급='사원', 성별='남', 입사일='2026-08-03', 사번='90001', 근무지='천안 본사'),
    mk(성명='GPRO관리자', 법인='GPRO', 소속='GPRO운영', 전체소속명='GPRO > 운영본부 > GPRO운영', 직급='과장', 성별='여', 입사일='2026-07-01', 사번='90002', 근무지='서울'),
    mk(성명='김생산', 법인='총괄', 소속='생산팀', 전체소속명='총괄 > 생산본부 > 생산팀', 직급='사원', 성별='남', 입사일='2026-08-05', 사번='90003', 근무지='천안 공장'),
    mk(성명='이품질', 법인='총괄', 소속='품질팀', 전체소속명='총괄 > 생산본부 > 품질팀', 직급='주임', 성별='여', 입사일='2026-08-06', 사번='90004', 근무지='천안 공장'),
    mk(성명='박물류', 법인='총괄', 소속='물류팀', 전체소속명='총괄 > 생산본부 > 물류팀', 직급='대리', 성별='남', 입사일='2026-08-07', 사번='90005', 근무지='천안 공장'),
    mk(성명='최무소속', 법인='총괄', 소속='', 전체소속명='', 직급='사원', 성별='여', 입사일='2026-08-08', 사번='90006', 근무지='서울'),
    # 퇴직일 8/10 · 생일 8/5 → 그날은 재직 중이므로 생일 표시되어야 함
    mk(성명='생일이전퇴사', 법인='스텍오토모티브', 소속='영업팀', 전체소속명='스텍오토모티브 > 영업본부 > 영업팀',
       직급='대리', 성별='남', 생년월일='1990-08-05', 입사일='2020-01-02', 퇴직일='2026-08-10',
       퇴직사유='개인사정', 사번='90007', 근무지='서울'),
    # 퇴직일 8/10 · 생일 8/11 → 퇴사 이후이므로 생일 제외되어야 함
    mk(성명='생일이후퇴사', 법인='스텍오토모티브', 소속='영업팀', 전체소속명='스텍오토모티브 > 영업본부 > 영업팀',
       직급='대리', 성별='여', 생년월일='1991-08-11', 입사일='2020-01-02', 퇴직일='2026-08-10',
       퇴직사유='개인사정', 사번='90008', 근무지='서울'),
]

def col_ref(i):
    s = ''; i += 1
    while i: i, r = divmod(i - 1, 26); s = chr(65 + r) + s
    return s
def cell(ci, ri, val):
    if val is None: return ''
    return f'<c r="{col_ref(ci)}{ri}" t="inlineStr"><is><t>{html.escape(str(val))}</t></is></c>'

xml = ['<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>']
xml.append('<row r="1">' + ''.join(cell(i, 1, h) for i, h in enumerate(headers)) + '</row>')
for ri, row in enumerate(rows, start=2):
    xml.append(f'<row r="{ri}">' + ''.join(cell(i, ri, v) for i, v in enumerate(row)) + '</row>')
xml.append('</sheetData></worksheet>')

with zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED) as z2:
    z2.writestr('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>')
    z2.writestr('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>')
    z2.writestr('xl/workbook.xml', '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="인사기초정보(검증)" sheetId="1" r:id="rId1"/></sheets></workbook>')
    z2.writestr('xl/_rels/workbook.xml.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>')
    z2.writestr('xl/worksheets/sheet1.xml', ''.join(xml))
print(f'{OUT} 생성 ({len(rows)}행)')
