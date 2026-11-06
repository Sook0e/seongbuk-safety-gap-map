"""주민 보상(포인트): 적립 규칙(등급·같은 곳 중복·월 한도), 전화번호 인증(테스트 인증)과 2시간 세션, 기프티콘 교환 신청."""
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from backend.app import constants
from backend.app.db import SessionLocal
from backend.app.main import app
from backend.app.models import Report, RewardPhone

from .test_priority import admin_item, make

client = TestClient(app)


def approve(public_id: str):
    return client.post(f"/api/admin/reports/{admin_item(public_id)['id']}/reward")


def me(key: str):
    return client.get("/api/rewards/me", params={"client_key": key}).json()


def verify_phone(key: str, phone: str = "010-1234-5678"):
    code = client.post("/api/rewards/phone/request", json={"client_key": key, "phone": phone}).json()["code"]
    return client.post("/api/rewards/phone/verify", json={"client_key": key, "phone": phone, "code": code})


def test_award_grades_duplicates_and_guards():
    k = "reward-key-aaaa0001"
    a = make(37.8000, 127.3000, client_key=k)
    ra = approve(a["public_id"])
    assert ra.status_code == 200 and ra.json() == {"points": constants.REWARD_NORMAL_POINTS, "grade": "normal", "note": None}
    assert admin_item(a["public_id"])["reward_points"] == constants.REWARD_NORMAL_POINTS
    assert approve(a["public_id"]).status_code == 409                       # 두 번 승인 못 함

    # 긴급: 철근 노출(40) + 확인 4명(+20) = 60 이상
    u = make(37.8100, 127.3100, client_key=k)
    with SessionLocal() as db:
        r = db.query(Report).filter(Report.public_id == u["public_id"]).one()
        r.ai_category, r.confirm_count = "철근 노출", 4
        db.commit()
    ru = approve(u["public_id"]).json()
    assert ru["grade"] == "urgent" and ru["points"] == constants.REWARD_URGENT_POINTS

    # 같은 곳(약 22m)·같은 유형은 0점 (5cm만 옮겨 다시 찍은 경우 포함)
    d = make(37.8000 + 0.0002, 127.3000, client_key="reward-key-bbbb0002")
    rd = approve(d["public_id"]).json()
    assert rd["points"] == 0 and "같은 곳" in rd["note"]
    assert admin_item(d["public_id"])["reward_note"] == rd["note"]

    # 식별값이 없는 제보, 오탐은 승인 불가
    old = make(37.8200, 127.3200)
    assert approve(old["public_id"]).status_code == 400
    fp = make(37.8300, 127.3300, client_key="reward-key-cccc0003")
    assert client.patch(f"/api/admin/reports/{admin_item(fp['public_id'])['id']}", json={"false_positive": True}).status_code == 200
    assert approve(fp["public_id"]).status_code == 400


def test_month_limit_by_count():
    k = "reward-key-dddd0004"
    got = []
    for i in range(constants.REWARD_MONTH_COUNT + 1):
        r = make(37.9000 + i * 0.002, 127.4000, client_key=k)           # 서로 먼 곳 11곳
        got.append(approve(r["public_id"]).json())
    assert [g["points"] for g in got[:-1]] == [constants.REWARD_NORMAL_POINTS] * constants.REWARD_MONTH_COUNT
    assert got[-1]["points"] == 0 and got[-1]["note"] == "월 적립 한도 초과"
    m = me(k)["month"]
    assert m["count"] == constants.REWARD_MONTH_COUNT and m["points"] == constants.REWARD_MONTH_COUNT * constants.REWARD_NORMAL_POINTS


def test_phone_verify_merge_redeem_and_session():
    k1, k2 = "reward-key-eeee0005", "reward-key-ffff0006"
    for key, lat in ((k1, 38.0000), (k2, 38.0100)):
        for j in range(2):                                              # 브라우저마다 2건 승인 (4건, 4,000P)
            assert approve(make(lat + j * 0.002, 127.5000, client_key=key)["public_id"]).status_code == 200
    assert me(k1)["balance"] == 2000 and me(k1)["verified"] is False

    # 인증 전에는 교환 불가
    assert client.post("/api/rewards/redeem", json={"client_key": k1, "amount": 3000}).status_code == 403
    # 잘못된 번호·틀린 인증번호
    assert client.post("/api/rewards/phone/request", json={"client_key": k1, "phone": "02-123-4567"}).status_code == 422
    code = client.post("/api/rewards/phone/request", json={"client_key": k1, "phone": "010-9999-0001"}).json()["code"]
    bad = "000000" if code != "000000" else "111111"
    assert client.post("/api/rewards/phone/verify", json={"client_key": k1, "phone": "010-9999-0001", "code": bad}).status_code == 400

    assert verify_phone(k1, "010-9999-0001").json()["verified"] is True
    assert verify_phone(k2, "01099990001").status_code == 200           # 같은 번호(하이픈 없이)로 다른 브라우저를 인증 → 합산
    for key in (k1, k2):
        m = me(key)
        assert m["verified"] is True and m["phone_last4"] == "0001" and m["balance"] == 4000

    # 교환: 최소 단위·잔액·1,000 단위
    assert client.post("/api/rewards/redeem", json={"client_key": k1, "amount": 2000}).status_code == 400
    assert client.post("/api/rewards/redeem", json={"client_key": k1, "amount": 3500}).status_code == 400
    assert client.post("/api/rewards/redeem", json={"client_key": k1, "amount": 5000}).status_code == 400
    ok = client.post("/api/rewards/redeem", json={"client_key": k2, "amount": 3000})
    assert ok.status_code == 200 and ok.json()["balance"] == 1000
    assert me(k1)["balance"] == 1000 and me(k1)["redeems"][0]["amount"] == 3000

    # 담당자: 교환 신청 목록과 처리 완료
    reqs = [x for x in client.get("/api/admin/rewards/redeems", params={"status": "requested"}).json() if x["phone_last4"] == "0001"]
    assert reqs and reqs[0]["amount"] == 3000
    assert client.patch(f"/api/admin/rewards/redeems/{reqs[0]['id']}").json()["status"] == "done"
    assert "0001" in str(client.get("/api/admin/rewards/redeems").json()) and "01099990001" not in str(client.get("/api/admin/rewards/redeems").json())

    # 2시간이 지나면 다시 인증해야 하고, 포인트 화면을 열면 유효 시간이 연장된다
    with SessionLocal() as db:
        p = db.query(RewardPhone).filter(RewardPhone.client_key == k1).one()
        p.last_active_at = datetime.now(timezone.utc) - timedelta(hours=constants.REWARD_SESSION_HOURS, minutes=1)
        db.commit()
    assert me(k1)["verified"] is False
    assert client.post("/api/rewards/redeem", json={"client_key": k1, "amount": 1000}).status_code in (400, 403)
    with SessionLocal() as db:
        p = db.query(RewardPhone).filter(RewardPhone.client_key == k2).one()
        p.last_active_at = datetime.now(timezone.utc) - timedelta(hours=constants.REWARD_SESSION_HOURS - 1)
        db.commit()
    assert me(k2)["verified"] is True
    with SessionLocal() as db:
        again = db.query(RewardPhone).filter(RewardPhone.client_key == k2).one()
        assert datetime.now(timezone.utc) - again.last_active_at.replace(tzinfo=timezone.utc) < timedelta(minutes=5)  # 열었더니 연장됨


def test_code_rate_limit_and_phone_not_stored_raw():
    k = "reward-key-gggg0007"
    for _ in range(5):
        assert client.post("/api/rewards/phone/request", json={"client_key": k, "phone": "010-1111-2222"}).status_code == 200
    assert client.post("/api/rewards/phone/request", json={"client_key": k, "phone": "010-1111-2222"}).status_code == 429
    code = None
    k2 = "reward-key-hhhh0008"
    code = client.post("/api/rewards/phone/request", json={"client_key": k2, "phone": "010-3333-4444"}).json()["code"]
    assert client.post("/api/rewards/phone/verify", json={"client_key": k2, "phone": "010-3333-4444", "code": code}).status_code == 200
    with SessionLocal() as db:
        p = db.query(RewardPhone).filter(RewardPhone.client_key == k2).one()
        assert "3333" not in p.phone_hash and p.last4 == "4444" and len(p.phone_hash) == 64   # 번호 원문은 저장하지 않음
