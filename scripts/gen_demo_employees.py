#!/usr/bin/env python3
"""데모 임직원 250명 + 휴직 시드 SQL 생성기.

2024-01 ~ 2026-08 무작위 입/퇴사, 기준일(2026-08-24) 현재 재직 120명.
출력: supabase/migrations/0026_demo_seed_employees.sql
재실행하면 동일 결과(random.seed 고정).
"""
import random
from datetime import date, timedelta

random.seed(20260824)
TODAY = date(2026, 8, 24)
HIRE_FROM, HIRE_TO = date(2024, 1, 2), date(2026, 8, 20)
TOTAL, ACTIVE_NOW, PENDING = 250, 120, 2
RETIRED = TOTAL - ACTIVE_NOW          # 130
NO_QUIT = ACTIVE_NOW - PENDING        # 118

CORP = '스텍오토모티브'
# (본부, 팀, 근무지, 가중치)
ORG = [
    ('경영지원본부', '인사총무팀',   '천안 본사',     6),
    ('경영지원본부', '재무회계팀',   '천안 본사',     6),
    ('경영지원본부', '경영기획팀',   '천안 본사',     5),
    ('경영지원본부', 'AI인프라팀',   '천안 본사',     5),
    ('경영지원본부', '네트워크보안팀','천안 본사',     4),
    ('생산본부',     '생산관리팀',   '천안 공장',    18),
    ('생산본부',     '품질관리팀',   '천안 공장',    11),
    ('생산본부',     '물류팀',       '천안 공장',     9),
    ('생산본부',     '설비기술팀',   '천안 공장',     7),
    ('영업본부',     '국내영업팀',   '천안 본사',     8),
    ('영업본부',     '해외영업팀',   '천안 본사',     6),
    ('영업본부',     '영업지원팀',   '서울 사무소',   4),
    ('기술연구본부', '연구개발팀',   '천안 R&D센터', 10),
    ('기술연구본부', '선행개발팀',   '천안 R&D센터',  5),
]
USA = ('Sales Division', 'North America Sales', '미국 법인')

SUR = [('김','Kim'),('이','Lee'),('박','Park'),('최','Choi'),('정','Jung'),('강','Kang'),('조','Cho'),
       ('윤','Yoon'),('장','Jang'),('임','Lim'),('한','Han'),('오','Oh'),('서','Seo'),('신','Shin'),
       ('권','Kwon'),('황','Hwang'),('안','Ahn'),('송','Song'),('전','Jeon'),('홍','Hong'),('문','Moon'),('배','Bae')]
GIV_M = [('민준','Minjun'),('서준','Seojun'),('도윤','Doyun'),('예준','Yejun'),('시우','Siwoo'),('하준','Hajun'),
         ('지호','Jiho'),('준서','Junseo'),('건우','Gunwoo'),('현우','Hyunwoo'),('우진','Woojin'),('선호','Sunho'),
         ('태윤','Taeyoon'),('상현','Sanghyun'),('영수','Youngsoo'),('정훈','Junghoon'),('대호','Daeho'),('진석','Jinseok')]
GIV_F = [('서연','Seoyeon'),('지우','Jiwoo'),('하은','Haeun'),('민서','Minseo'),('수아','Sooah'),('지민','Jimin'),
         ('예린','Yerin'),('채원','Chaewon'),('다은','Daeun'),('유진','Yujin'),('소연','Soyeon'),('혜진','Hyejin'),
         ('은영','Eunyoung'),('미경','Mikyung'),('정아','Junga'),('보람','Boram')]

EMP_TYPE = [('정규직', 70), ('계약직', 15), ('인턴', 8), ('파견', 7)]
EDU = [('대졸', 52), ('전문대졸', 18), ('고졸', 16), ('대학원졸', 14)]
SCHOOL = {'대졸': ['충남대학교','한양대학교','성균관대학교','인하대학교','아주대학교','국민대학교','건국대학교','이화여자대학교'],
          '전문대졸': ['연암대학교','천안연암대학','인덕대학교','유한대학교'],
          '고졸': ['천안공업고등학교','아산고등학교','북일고등학교','천안여자고등학교'],
          '대학원졸': ['KAIST','성균관대학교 대학원','한양대학교 대학원','충남대학교 대학원']}
MAJOR = ['기계공학','전기전자공학','컴퓨터공학','산업공학','경영학','회계학','신소재공학','화학공학','무역학','통계학','법학','디자인']
PATHS = [('공개채용', 44), ('경력채용', 33), ('추천', 10), ('헤드헌팅', 8), ('산학협력', 5)]
QUIT_REASON = [('개인사정(이직)', 34), ('계약만료', 20), ('개인사정(건강)', 8), ('권고사직', 8),
               ('수습 미통과', 7), ('육아/가사', 6), ('학업', 5), ('근무조건 불만족', 7), ('무단결근', 3), ('정년퇴직', 2)]
FOREIGN = [('베트남','E-9','베트남'),('우즈베키스탄','E-9','우즈베키스탄'),('중국','F-4','중국'),
           ('필리핀','E-9','필리핀'),('미국','E-7','미국'),('인도','E-7','인도')]

def wpick(pairs):
    return random.choices([p[0] for p in pairs], weights=[p[1] for p in pairs])[0]

def rdate(a, b):
    return a + timedelta(days=random.randint(0, (b - a).days))

def workday(d):
    while d.weekday() >= 5:
        d += timedelta(days=1)
    return d

def addm(d, m):
    y, mo = divmod(d.month - 1 + m, 12)
    return date(d.year + y, mo + 1, min(d.day, 28))

def q(v):
    if v is None or v == '':
        return 'null'
    if isinstance(v, (int, float)):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"

# ---------- 입사일 생성: 1·3·7·9월 채용 성수기 가중 ----------
MONTH_W = {1: 1.6, 2: 0.9, 3: 1.7, 4: 1.0, 5: 0.9, 6: 1.0, 7: 1.5, 8: 1.0, 9: 1.4, 10: 1.0, 11: 0.8, 12: 0.7}
hire_pool = []
d = HIRE_FROM
while d <= HIRE_TO:
    if d.weekday() < 5:
        hire_pool.append(d)
    d += timedelta(days=1)
hires = sorted(random.choices(hire_pool, weights=[MONTH_W[x.month] for x in hire_pool], k=TOTAL))

# ---------- 퇴직자 선정: 최소 1개월 근속 여유가 있는 사람 중에서 ----------
idx_eligible = [i for i, h in enumerate(hires) if h <= date(2026, 6, 15)]
retired_idx = set(random.sample(idx_eligible, RETIRED))
pending_idx = set(random.sample([i for i in range(TOTAL) if i not in retired_idx], PENDING))

# ---------- 팀 배정 ----------
teams = [(div, t, site) for div, t, site, w in ORG for _ in range(w)]
rows, leaves = [], []
grade_order = ['사원', '주임', '대리', '과장', '차장', '부장']
# 그룹웨어 직급 개편(2026-08): 현장직은 사원(기능)/리더/책임 3단계. 이 직급인 사람만 현장직으로 집계된다.
FIELD_GRADES = ['사원(기능)', '리더', '책임']
FIELD_DIVISIONS = {'생산본부'}  # 이 본부 소속은 현장직 직급 체계를 쓴다
team_leader_done = set()

for i, hire in enumerate(hires):
    retired, pending = i in retired_idx, i in pending_idx
    usa = (i % 47 == 0)  # 약 5명 미국법인
    if usa:
        corp, div, team, site = 'STEK Automotive USA', USA[0], USA[1], USA[2]
    else:
        corp = CORP
        div, team, site = random.choice(teams)

    sex = '남' if random.random() < 0.62 else '여'
    sur, sur_en = random.choice(SUR)
    giv, giv_en = random.choice(GIV_M if sex == '남' else GIV_F)
    name, name_en = sur + giv, f'{sur_en} {giv_en}'

    # 나이: 20대~50대 + 정년 임박 소수
    if i % 83 == 0:
        age = random.choice([57, 58, 59])
    else:
        age = random.choices([random.randint(23, 29), random.randint(30, 39), random.randint(40, 49), random.randint(50, 56)],
                             weights=[30, 38, 22, 10])[0]
    birth = date(TODAY.year - age, random.randint(1, 12), random.randint(1, 28))
    if (birth.month, birth.day) > (TODAY.month, TODAY.day):
        birth = date(birth.year - 1, birth.month, birth.day)

    emp_type = wpick(EMP_TYPE)
    if age >= 45 and emp_type == '인턴':
        emp_type = '정규직'
    career_y = 0 if age < 26 else min(age - 24, random.randint(0, 14))
    career_m = random.randint(0, 11)

    # 직급: 나이·경력 기반
    gi = min(5, max(0, (age - 25) // 5 + (1 if career_y >= 8 else 0)))
    if emp_type == '인턴':
        gi = 0
    is_field = div in FIELD_DIVISIONS
    if is_field:
        # 연차·나이 기반: 대부분 사원(기능), 중간관리 리더, 상위 책임
        grade = FIELD_GRADES[0] if gi <= 3 else (FIELD_GRADES[1] if gi == 4 else FIELD_GRADES[2])
    else:
        grade = grade_order[gi]
    title = grade
    if team.startswith('연구') or team.startswith('선행'):
        title = '연구원' if gi <= 1 else ('선임' if gi == 2 else grade)
    if emp_type == '인턴':
        title = '인턴'
    # 팀별 팀장 1명(재직·과장 이상)
    if not retired and not pending and gi >= 3 and team not in team_leader_done:
        title = '팀장'
        team_leader_done.add(team)

    edu = wpick(EDU)
    if age < 26 and edu == '대학원졸':
        edu = '대졸'
    school = random.choice(SCHOOL[edu])
    degree = {'대학원졸': '석사', '대졸': '학사', '전문대졸': '전문학사', '고졸': None}[edu]
    major = None if edu == '고졸' else random.choice(MAJOR)

    foreign = (i % 31 == 0 and emp_type in ('계약직', '파견', '정규직'))
    if foreign:
        nat, visa, resid = random.choice(FOREIGN)
        stay_from = hire
        stay_to = addm(hire, random.choice([24, 30, 36, 13, 14]))  # 일부는 만료 임박
    else:
        nat, visa, resid, stay_from, stay_to = '대한민국', None, '대한민국', None, None

    # 퇴직일
    quit_d = None
    if retired:
        lo = min(hire + timedelta(days=random.randint(25, 90)), TODAY - timedelta(days=1))
        quit_d = rdate(lo, TODAY - timedelta(days=1))
    elif pending:
        quit_d = rdate(TODAY + timedelta(days=3), date(2026, 9, 30))
    reason = wpick(QUIT_REASON) if quit_d else None
    if reason == '정년퇴직' and age < 57:
        reason = '개인사정(이직)'
    if reason == '수습 미통과' and quit_d and (quit_d - hire).days > 120:
        reason = '근무조건 불만족'

    end_ref = quit_d if (quit_d and quit_d <= TODAY) else TODAY
    tenure = round((end_ref - hire).days / 365.25, 1)

    # 계약직/파견/인턴 계약기간
    if emp_type == '정규직':
        c_from = c_to = None
    else:
        c_from = hire
        months = 6 if emp_type == '인턴' else random.choice([12, 12, 24])
        c_to = addm(hire, months)
        if i % 29 == 0 and not quit_d:   # 계약만료 임박 알림용
            c_to = rdate(date(2026, 9, 1), date(2026, 11, 30))
    prob_end = None if emp_type == '인턴' else addm(hire, 3)

    empno = f'{hire.year}{9000 + i:04d}'
    rows.append({
        '성명': name, '영문성명': name_en, '닉네임': None,
        '사번': empno, '그룹사원번호': 'G' + empno,
        '법인': corp, '소속': team, '전체소속명': f'{corp} > {div} > {team}',
        '직책': title, '직급': grade, '고용구분': emp_type, '근무지': site,
        '입사일': hire, '그룹입사일': hire, '퇴직일': quit_d, '퇴직사유': reason,
        '근속연수(그룹입사일)': tenure, '근속연수(입사일)': tenure,
        '발령명': f'{team} {title} 발령', '입사경로': wpick(PATHS),
        '추천인': None, '인정경력(년)': career_y, '인정경력(월)': career_m,
        '성별': sex, '생년월일': birth, '나이(만)': age,
        '결혼여부': ('기혼' if age >= 33 and random.random() < 0.62 else '미혼'),
        '음양구분': ('음력' if random.random() < 0.12 else '양력'),
        '생일': f'{birth.month:02d}-{birth.day:02d}',
        '학력': edu, '학교': school, '학위': degree, '전공': major,
        '역종': ('해당없음' if sex == '여' else random.choices(['예비역', '면제', '미필'], weights=[80, 12, 8])[0]),
        '군별': (None if sex == '여' else random.choice(['육군', '해군', '공군', '해병대'])),
        '계급': (None if sex == '여' else random.choice(['병장', '상병', '병장', '중사', '중위'])),
        '병역특례여부': ('Y' if i % 61 == 0 and sex == '남' else 'N'),
        '장애여부': ('Y' if i % 71 == 0 else 'N'),
        '보훈대상자': ('Y' if i % 97 == 0 else 'N'),
        '국적': nat, '내/외국인': ('외국인' if foreign else '내국인'), '거주지국': resid,
        '체류자격': visa, '체류시작일': stay_from, '체류종료일': stay_to,
        '근태기준일': hire, '퇴직기준일': (quit_d or None),
        '최종이동일': (addm(hire, random.choice([12, 18, 24])) if tenure >= 1.5 and random.random() < 0.35 else None),
        '최종보임일': (addm(hire, 12) if title == '팀장' else None),
        '직무변경일': None, '직종전환일': None,
        '계약시작일': c_from, '계약종료일': c_to, '수습종료일': prob_end,
    })
# 입사경로 '추천'이면 추천인 채우기
for r in rows:
    if r['입사경로'] == '추천':
        r['추천인'] = random.choice(rows)['성명']

# ---------- 검증 ----------
active_now = [r for r in rows if not r['퇴직일'] or r['퇴직일'] > TODAY]
assert len(rows) == TOTAL, len(rows)
assert len(active_now) == ACTIVE_NOW, len(active_now)
assert len([r for r in rows if r['퇴직일'] and r['퇴직일'] <= TODAY]) == RETIRED
assert len([r for r in rows if r['퇴직일'] and r['퇴직일'] > TODAY]) == PENDING
assert len({r['사번'] for r in rows}) == TOTAL
assert all(r['퇴직일'] is None or r['퇴직일'] > r['입사일'] for r in rows)
assert all(HIRE_FROM <= r['입사일'] <= HIRE_TO for r in rows)
# 직군 분류: 현장직 직급은 생산본부에만, 생산본부는 현장직 직급만
field_rows = [r for r in rows if r['직급'] in FIELD_GRADES]
prod_rows = [r for r in rows if '생산본부' in r['전체소속명']]
assert field_rows, '현장직(사원(기능)/리더/책임) 인원이 0명 — 직군 비율 검증 불가'
assert {r['사번'] for r in field_rows} == {r['사번'] for r in prod_rows}, '현장직 직급과 생산본부 소속이 불일치'
assert len([r for r in active_now if r['직급'] in FIELD_GRADES]) > 0, '재직 현장직 0명'

# ---------- 휴직: 재직자 중 11명 ----------
LEAVE_SPEC = [
    ('육아휴직',       date(2026, 5, 1),  date(2027, 4, 30), '휴직중',   True),
    ('육아휴직',       date(2026, 2, 3),  date(2027, 2, 2),  '휴직중',   True),
    ('질병휴직',       date(2026, 6, 15), date(2026, 12, 14),'휴직중',   False),
    ('가족돌봄휴직',   date(2026, 7, 1),  date(2026, 10, 31),'휴직중',   False),
    ('유학휴직',       date(2026, 3, 1),  date(2027, 2, 28), '휴직중',   True),
    ('군복무',         date(2025, 11, 3), date(2027, 5, 2),  '휴직중',   False),
    ('육아휴직',       date(2025, 9, 1),  date(2026, 8, 31), '복직예정', True),
    ('질병휴직',       date(2026, 3, 9),  date(2026, 9, 8),  '복직예정', False),
    ('육아휴직',       date(2025, 1, 6),  date(2025, 12, 31),'복직완료', True),
    ('가족돌봄휴직',   date(2025, 4, 1),  date(2025, 9, 30), '복직완료', False),
    ('질병휴직',       date(2024, 10, 7), date(2025, 4, 6),  '복직완료', False),
]
# 휴직 대상: 재직·퇴직예정 아님·휴직 시작일보다 먼저 입사한 사람
cands = [r for r in active_now if not r['퇴직일'] and r['직책'] != '팀장']
used = set()
for reason, s, e, status, sub in LEAVE_SPEC:
    pick = next(r for r in cands if r['사번'] not in used and r['입사일'] < s)
    used.add(pick['사번'])
    leaves.append({
        '사번': pick['사번'], 'reason': reason, 'start': s, 'ret': e, 'status': status,
        'sub': sub, 'sub_name': (random.choice(cands)['성명'] + ' (대체)') if sub else None,
        'contact': f'010-{random.randint(2000,9999)}-{random.randint(1000,9999)}',
    })
assert len(leaves) == len(LEAVE_SPEC)

# ---------- SQL 출력 ----------
COLS = list(rows[0].keys())
out = []
out.append("""-- 0026_demo_seed_employees.sql
-- DEMO SEED — 임직원 250명(2024-01~2026-08 무작위 입/퇴사) + 휴직 11건.
-- 기준일 2026-08-24 현재: 재직 120명(퇴직예정 2명 포함) / 퇴직완료 130명.
-- 생성기: scripts/gen_demo_employees.py (random.seed 고정 → 재생성 시 동일 결과)
--
-- !! 주의: employees 를 전량 삭제하고 다시 채운다(데모 DB 전제).
--    employee_sensitive / employee_transfers / training_records / evaluations 는
--    employees FK cascade 로 함께 지워지므로, 이 파일 실행 후
--    0023_demo_seed_training_eval.sql, 0025_demo_seed_more.sql 를 다시 실행할 것.
-- Supabase Studio(관리자, RLS 우회)에서 실행 전제.

begin;

delete from public.leave_records;
delete from public.employees;
""")
out.append('insert into public.employees (' + ', '.join(f'"{c}"' for c in COLS) + ') values')
vals = []
for r in rows:
    vals.append('  (' + ', '.join(q(r[c] if not isinstance(r[c], date) else r[c].isoformat()) for c in COLS) + ')')
out.append(',\n'.join(vals) + ';\n')

out.append('-- 휴직(leave_records) — employee_id 는 사번으로 employees 참조')
for lv in leaves:
    out.append(
        'insert into public.leave_records (employee_id, name, dept, position, reason, start_date, '
        'expected_return_date, substitute_assigned, substitute_name, contact, status)\n'
        f'select id, "성명", "소속", "직책", {q(lv["reason"])}, {q(lv["start"].isoformat())}, '
        f'{q(lv["ret"].isoformat())}, {str(lv["sub"]).lower()}, {q(lv["sub_name"])}, {q(lv["contact"])}, '
        f'{q(lv["status"])}\n  from public.employees where "사번" = {q(lv["사번"])};')
out.append('\ncommit;')
out.append(f"""
-- 검증용 쿼리
-- select count(*) total,
--        count(*) filter (where "퇴직일" is null or "퇴직일" > '2026-08-24') active_now,
--        count(*) filter (where "퇴직일" <= '2026-08-24') retired,
--        count(*) filter (where "퇴직일" > '2026-08-24') pending
--   from public.employees;   -- 기대: {TOTAL} / {ACTIVE_NOW} / {RETIRED} / {PENDING}
""")

path = 'supabase/migrations/0026_demo_seed_employees.sql'
open(path, 'w').write('\n'.join(out))
print(f'wrote {path}')
print('total', len(rows), 'active_now', len(active_now),
      'retired', TOTAL - len(active_now), 'pending', PENDING, 'leaves', len(leaves))
from collections import Counter
print('부서:', Counter(r['전체소속명'].split('>')[1].strip() for r in active_now))
print('고용구분:', Counter(r['고용구분'] for r in active_now))
print('직군(재직):', '현장직', len([r for r in active_now if r['직급'] in FIELD_GRADES]),
      '/ 사무직', len([r for r in active_now if r['직급'] not in FIELD_GRADES]))
print('직급(재직):', Counter(r['직급'] for r in active_now))
print('입사연도:', sorted(Counter(r['입사일'].year for r in rows).items()))
print('연령대:', Counter(('20대' if r['나이(만)']<30 else '30대' if r['나이(만)']<40 else '40대' if r['나이(만)']<50 else '50대+') for r in active_now))
print('외국인', sum(1 for r in rows if r['내/외국인']=='외국인'), '| 계약종료 2026Q4임박',
      sum(1 for r in active_now if r['계약종료일'] and date(2026,8,24) <= r['계약종료일'] <= date(2026,12,31)))
