#!/usr/bin/env python3
"""그룹웨어(groupware.pro) 인사자료 → 엑셀 내보내기.

HPE3000(인사관리>구성원) 화면에서 "퇴직자 포함" 체크 → 조회 → 엑셀로 저장 을 하는 것과
같은 결과를 만든다. 화면의 "엑셀로 저장"은 브라우저가 클라이언트에서 xlsx 를 만드는 방식이라
서버에 export API 가 없다. 그래서 조회 API(JSON)를 그대로 받아 여기서 xlsx 로 쓴다.

인증: 로그인 폼 POST 한 번. 세션쿠키 GPRO_STEK_SESSION 이 domain=.groupware.pro 로 발급돼
로그인 도메인(stek.api)과 HR API 도메인(stek.hr.api)에 함께 실린다 → Session 하나로 충분하다.

출력 컬럼은 화면 컬럼 순서(69개)와 같고, 이는 `인사자료/인사기초정보_데모데이터.xlsx` 의
A~BQ 헤더와 정확히 일치한다 → 기존 앱의 엑셀 업로드 파서에 그대로 넣을 수 있다.

사용:
    GW_EMAIL=... GW_PASSWORD=... python3 scripts/gw_export.py -o /data/hr.xlsx
    python3 scripts/gw_export.py --self-check      # 로그인 없이 매핑표만 검증

n8n: Execute Command 노드에서 위 명령을 실행하고, stdout 으로 나온 경로를 다음 노드로 넘긴다.
"""
from __future__ import annotations

import argparse
import datetime as dt
import os
import re
import sys

import requests
from openpyxl import Workbook

TENANT = os.environ.get("GW_TENANT", "stek")
LOGIN_URL = f"https://{TENANT}.api.groupware.pro/v1/common/local/login/proc"
MASTER_URL = f"https://{TENANT}.hr.api.groupware.pro/v1/per/master"

# HPE3000 화면이 조회 시 실제로 보내는 파라미터.
#  - inOffi=N            : "퇴직자 포함" 체크 상태(미체크면 대신 officeStatusSearchCode=58613 을 보낸다)
#  - visibilityRnYn/AnYn : 주민번호/계좌번호 표시 토글. N 이면 서버가 마스킹해서 내려준다.
#  - rows/limit/pageSize : 화면이 그대로 100000 을 보낸다(전건 조회).
BASE_PARAMS = {
    "authChkProgramId": "209",
    "showAllOrg": "false",
    "dateType": "E",
    "visibilityRnYn": "N",
    "visibilityAnYn": "N",
    "visibilityOrgYn": "N",
    "rows": "100000",
    "limit": "100000",
    "pageSize": "100000",
}
IN_OFFICE_ONLY_CODE = "58613"  # 퇴직자 미포함(재직+휴직)일 때 화면이 보내는 officeStatusSearchCode

# 한글 헤더 → 응답 JSON 키. 화면 컬럼 순서 그대로이며 엑셀 A~BQ 와 동일하다.
# 대부분 화면 셀 값과 JSON 값을 대조해 확정했고, 전 직원이 공란이라 대조 불가였던 항목은
# 키 이름으로 매핑했다(아래 UNVERIFIED 참고).
COLUMNS: list[tuple[str, str]] = [
    ("성명", "employeeName"),
    ("법인", "companyOriginalIdName"),
    ("소속", "organizationName"),
    ("직책", "dutyCodeName"),
    ("직급", "classCodeName"),
    ("주민번호", "registrationNumber"),
    ("생년월일", "birthYmd"),
    ("나이(만)", "age"),
    ("성별", "genderCodeName"),
    ("그룹사원번호", "groupEmployeeNumber"),
    ("그룹웨어ID", "groupwareId"),
    ("영문성명", "employeeNameEn"),
    ("고용구분", "employeeKindCodeName"),
    ("근무지", "locationCodeName"),
    ("입사일", "hireYmd"),
    ("그룹입사일", "groupHireYmd"),
    ("퇴직일", "retireYmd"),
    ("퇴직사유", "retireReasonCodeName"),
    ("근속연수(그룹입사일)", "groupHirePeriod"),
    ("근속연수(입사일)", "hirePeriod"),
    ("음양구분", "solarTypeName"),
    ("생일", "birthday"),
    ("결혼여부", "marryYn"),
    ("발령명", "assignmentCodeName"),
    ("입사경로", "hireRouteCodeName"),
    ("추천인", "recommender"),
    ("인정경력(년)", "careerYears"),
    ("인정경력(월)", "careerMonths"),
    ("현 주소(우편번호)", "zipNumber1"),
    ("현 주소(주소)", "address1"),
    ("등본주소(우편번호)", "zipNumber2"),
    ("등본주소(주소)", "address2"),
    ("휴대폰번호", "phoneNo1"),
    ("비상연락망", "phoneNo2"),
    ("내/외국인", "alienTypeCodeName"),
    ("국적", "nationalityCodeName"),
    ("거주지국", "residenceCodeName"),
    ("체류자격", "visaTypeCodeName"),
    ("체류시작일", "issueYmd"),
    ("체류종료일", "expiryYmd"),
    ("급여계좌(은행)", "bankCodeName1"),
    ("급여계좌(계좌번호)", "bankAccount1"),
    ("급여계좌(예금주)", "realDepositor1"),
    ("경비계좌(은행)", "bankCodeName2"),
    ("경비계좌(계좌번호)", "bankAccount2"),
    ("경비계좌(예금주)", "realDepositor2"),
    ("근태기준일", "attendStartYmd"),
    ("퇴직기준일", "retireStartYmd"),
    ("최종이동일", "lastMoveYmd"),
    ("최종보임일", "lastDutyYmd"),
    ("직무변경일", "lastJobYmd"),
    ("직종전환일", "lastKindYmd"),
    ("계약시작일", "contactRenewYmd"),
    ("계약종료일", "contractEndYmd"),
    ("수습종료일", "probationEndYmd"),
    ("개인메일", "individualEmail"),
    ("학력", "educationCodeName"),
    ("학교", "schoolName"),
    ("학위", "schoolGradeCodeName"),
    ("전공", "majorName"),
    ("역종", "armyServiceCodeName"),
    ("군별", "armyTypeCodeName"),
    ("계급", "armyClassCodeName"),
    ("병역특례여부", "armyRetireReasonCodeName"),
    ("장애여부", "handicapYn"),
    ("보훈대상자", "patriotYn"),
    ("사번", "employeeNumber"),
    ("닉네임", "nickname"),
    ("전체소속명", "organizationLineName"),
]

# 조회 시점에 전 직원 공란이라 화면-값 대조로 확정하지 못한 헤더.
# 값이 채워진 직원이 생기면 화면 표시값과 한 번 대조해볼 것.
UNVERIFIED = {
    "인정경력(년)", "인정경력(월)", "체류종료일", "직무변경일", "직종전환일",
    "계약시작일", "계약종료일", "계급", "병역특례여부",
}

# ★ 날짜 정규화는 "날짜 컬럼에만" 적용한다.
# 예전엔 8자리 숫자면 무조건 폈는데 사번(14050201)·그룹사원번호도 8자리라 1405-02-01 로
# 망가졌다. 사번은 employees upsert 의 충돌키라 이게 깨지면 매 실행마다 새 행이 생긴다.
DATE_LABELS = {
    "생년월일", "입사일", "그룹입사일", "퇴직일",
    "체류시작일", "체류종료일",
    "근태기준일", "퇴직기준일", "최종이동일", "최종보임일", "직무변경일", "직종전환일",
    "계약시작일", "계약종료일", "수습종료일",
}
# 숫자로 새면 앞의 0 이 날아가는 식별자 컬럼 — 무조건 문자열로 쓴다.
ID_LABELS = {"사번", "그룹사원번호"}

YMD8 = re.compile(r"^\d{8}$")


def norm(label: str, value: object) -> object:
    """날짜 컬럼의 YYYYMMDD 8자리만 YYYY-MM-DD 로 편다. 식별자 컬럼은 문자열로 고정."""
    if value is None:
        return None
    if label in ID_LABELS:
        return str(value).strip()
    if label in DATE_LABELS and isinstance(value, str) and YMD8.match(value):
        return f"{value[:4]}-{value[4:6]}-{value[6:]}"
    return value


def login(session: requests.Session, email: str, password: str) -> None:
    res = session.post(
        LOGIN_URL,
        data={"email": email, "password": password},
        timeout=30,
        allow_redirects=True,
    )
    res.raise_for_status()
    # 로그인 실패 시에도 200 으로 로그인 페이지(?error)를 돌려준다 → 쿠키 유무로 판정한다.
    if "GPRO_STEK_SESSION" not in session.cookies.get_dict(domain=".groupware.pro"):
        raise SystemExit("로그인 실패: 세션 쿠키가 발급되지 않았습니다. 이메일/비밀번호를 확인하세요.")


def fetch_master(
    session: requests.Session, effective_date: str, include_retired: bool
) -> list[dict]:
    params = dict(BASE_PARAMS, effectiveDate=effective_date)
    if include_retired:
        params["inOffi"] = "N"
    else:
        params["officeStatusSearchCode"] = IN_OFFICE_ONLY_CODE
    res = session.get(
        MASTER_URL,
        params=params,
        headers={
            "Accept": "application/json, text/plain, */*",
            "Lang": "ko",
            "Referer": f"https://{TENANT}.hr.groupware.pro/",
        },
        timeout=120,
    )
    res.raise_for_status()
    body = res.json()
    if not body.get("success"):
        raise SystemExit(f"조회 실패: {body!r}"[:500])
    return body.get("payload") or []


def save_xlsx(rows: list[dict], path: str) -> None:
    wb = Workbook()
    ws = wb.active
    ws.title = "인사기초정보"
    ws.append([label for label, _ in COLUMNS])
    for r in rows:
        ws.append([norm(label, r.get(key)) for label, key in COLUMNS])
    ws.freeze_panes = "A2"
    wb.save(path)


def self_check() -> None:
    """로그인 없이 매핑표 자체를 검증한다(컬럼 수·중복·날짜 정규화)."""
    labels = [c[0] for c in COLUMNS]
    keys = [c[1] for c in COLUMNS]
    assert len(labels) == 69, f"컬럼 수 {len(labels)} (기대 69)"
    assert len(set(labels)) == len(labels), "헤더 중복 있음"
    dup = {k for k in keys if keys.count(k) > 1}
    assert not dup, f"JSON 키 중복 매핑: {dup}"
    assert UNVERIFIED <= set(labels), "UNVERIFIED 에 없는 헤더가 있음"
    assert DATE_LABELS <= set(labels) and ID_LABELS <= set(labels), "DATE/ID 라벨이 헤더에 없음"
    assert norm("생년월일", "19731105") == "1973-11-05"
    assert norm("사번", "14050201") == "14050201"       # ← 예전 버그: 1405-02-01
    assert norm("사번", 14050201) == "14050201"
    assert norm("그룹사원번호", "00123456") == "00123456"
    assert norm("법인", "(주)스텍") == "(주)스텍"
    assert norm("성명", "20260101") == "20260101"       # 날짜 컬럼이 아니면 손대지 않는다
    assert norm("퇴직일", None) is None and norm("나이(만)", 52) == 52
    print(f"self-check OK — 컬럼 {len(labels)}개, 미검증 매핑 {len(UNVERIFIED)}개")


def main() -> None:
    ap = argparse.ArgumentParser(description="그룹웨어 인사자료 엑셀 내보내기")
    ap.add_argument("-o", "--out", default=os.environ.get("GW_OUT", "hr_export.xlsx"))
    ap.add_argument(
        "--effective-date",
        default=dt.date.today().strftime("%Y%m%d"),
        help="기준일 YYYYMMDD (기본: 오늘)",
    )
    ap.add_argument(
        "--exclude-retired",
        action="store_true",
        help="퇴직자 제외(기본은 화면의 '퇴직자 포함' 체크 상태와 동일하게 포함)",
    )
    ap.add_argument("--self-check", action="store_true", help="매핑표만 검증하고 종료")
    args = ap.parse_args()

    if args.self_check:
        self_check()
        return

    email = os.environ.get("GW_EMAIL")
    password = os.environ.get("GW_PASSWORD")
    if not email or not password:
        raise SystemExit("GW_EMAIL / GW_PASSWORD 환경변수가 필요합니다.")

    session = requests.Session()
    login(session, email, password)
    rows = fetch_master(session, args.effective_date, not args.exclude_retired)
    save_xlsx(rows, args.out)
    retired = sum(1 for r in rows if r.get("retireYmd"))
    print(
        f"{args.out} 저장 완료 — {len(rows)}건 "
        f"(재직 {len(rows) - retired} / 퇴직 {retired}), 기준일 {args.effective_date}",
        file=sys.stderr,
    )
    print(args.out)  # n8n 후속 노드가 경로를 받도록 stdout 에는 경로만


if __name__ == "__main__":
    main()
