"""점검 대장 엑셀, 주민 교차확인 표시(나도 봤어요 3명 이상)."""
import io
import re
import zipfile
from xml.etree import ElementTree as ET

from backend.app import constants

from .test_features import admin, client, report

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def sheet_rows(content: bytes) -> list[list[str]]:
    z = zipfile.ZipFile(io.BytesIO(content))
    for name in z.namelist():  # 모든 부품이 올바른 XML이어야 엑셀이 연다
        if name.endswith((".xml", ".rels")):
            ET.fromstring(z.read(name))
    root = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
    out = []
    for row in root.find("m:sheetData", NS):
        out.append(["".join(t.text or "" for t in c.iter("{%s}t" % NS["m"])) or ((c.find("m:v", NS).text) if c.find("m:v", NS) is not None else "")
                    for c in row])
    return out


def test_cross_checked_needs_three_confirms():
    r = report()
    assert admin(r["public_id"])["cross_checked"] is False
    for _ in range(constants.CROSS_CHECK_MIN - 1):
        client.post(f"/api/reports/{r['public_id']}/confirm")
    assert admin(r["public_id"])["cross_checked"] is False
    out = client.post(f"/api/reports/{r['public_id']}/confirm").json()
    assert out["confirm_count"] == constants.CROSS_CHECK_MIN and out["cross_checked"] is True


def test_ledger_xlsx_downloads_and_matches_list():
    r = report(memo="개인 메모")
    client.patch(f"/api/admin/reports/{admin(r['public_id'])['id']}", json={"status": "review", "note": "현장 확인 예정"})
    res = client.get("/api/admin/ledger.xlsx", params={"source": "resident"})
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    assert re.search(r"filename=ledger_\d{8}\.xlsx", res.headers["content-disposition"])
    rows = sheet_rows(res.content)
    assert rows[0][0] == "접수번호" and "처리 상태" in rows[0]
    mine = next(x for x in rows[1:] if x[0] == r["public_id"])
    assert mine[rows[0].index("처리 상태")] == "검토"
    assert "현장 확인 예정" in mine[rows[0].index("담당자 메모")]
    assert all(x[rows[0].index("출처")] == "주민" for x in rows[1:])  # 필터가 목록과 같게 적용됨
    assert "개인 메모" not in "".join("".join(x) for x in rows)  # 주민 메모는 대장에 넣지 않음


def test_ledger_excludes_demo_by_default():
    demo = report(is_demo=True)
    ids = [x[0] for x in sheet_rows(client.get("/api/admin/ledger.xlsx").content)[1:]]
    assert demo["public_id"] not in ids
    ids = [x[0] for x in sheet_rows(client.get("/api/admin/ledger.xlsx", params={"include_demo": True}).content)[1:]]
    assert demo["public_id"] in ids
