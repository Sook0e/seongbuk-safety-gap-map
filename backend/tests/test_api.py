import io
from datetime import datetime

from fastapi.testclient import TestClient
from PIL import Image

from backend.app.main import app

client = TestClient(app)


def jpeg(w=3000, h=2000) -> bytes:
    b = io.BytesIO()
    Image.new("RGB", (w, h), (120, 120, 120)).save(b, "JPEG")
    return b.getvalue()


def upload(**params):
    r = client.post("/api/photos", params=params, files={"file": ("a.jpg", jpeg(), "image/jpeg")})
    assert r.status_code == 200, r.text
    return r.json()


def test_health_and_meta():
    h = client.get("/api/health").json()
    assert h["ok"] and h["db_ok"] and h["vision_provider"] == "mock" and h["db"] == "sqlite"
    assert "gap_items.json" in h["data_files"]  # 배포에서도 backend/data 가 같이 올라갔는지 확인용
    m = client.get("/api/meta").json()
    assert m["statuses"]["received"] == "접수" and "철근 노출" in m["categories"]


def test_map_endpoints_return_geojson():
    for path in ("/api/facilities", "/api/gaps", "/api/admin/integrated", "/api/reports/map"):
        assert client.get(path).json()["type"] == "FeatureCollection"


def test_photo_is_resized_and_classified():
    p = upload()
    assert max(p["width"], p["height"]) == 1600
    assert p["ai"]["mock"] is True and p["ai"]["category"] == "콘크리트 균열"
    img = client.get(p["url"])
    assert img.status_code == 200 and img.headers["content-type"] == "image/jpeg"
    assert upload(classify="false")["ai"] is None


def test_rejects_non_image():
    r = client.post("/api/photos", files={"file": ("a.txt", b"hello", "text/plain")})
    assert r.status_code == 400


def test_demo_flow_resident_to_admin_and_back():
    """시연 흐름: 주민 제보 → 관리자 목록 → 상세에서 조치 완료 → 주민 내 제보에 새 소식"""
    p = upload()
    rep = client.post("/api/reports", json={"photo_key": p["key"], "lat": 37.589, "lon": 127.016,
                                            "memo": "옹벽 금"}).json()
    pid, first_news = rep["public_id"], rep["news_at"]
    assert rep["status"] == "received" and rep["ai"]["category"] == "콘크리트 균열"
    assert rep["news_at"].endswith(("Z", "+00:00")), "시간대 없는 시각은 브라우저가 한국 시간으로 잘못 읽음"

    lst = client.get("/api/admin/reports", params={"source": "resident"}).json()
    item = next(x for x in lst if x["public_id"] == pid)

    after = upload(classify="false")
    d = client.patch(f"/api/admin/reports/{item['id']}",
                     json={"status": "done", "note": "보수 완료", "after_photo_key": after["key"],
                           "dept_note": "도로과 보수"}).json()
    assert d["status_label"] == "완료" and [h["to_status"] for h in d["history"]] == ["received", "done"]

    mine = client.get("/api/reports", params={"ids": pid}).json()[0]
    assert mine["after_photo_url"] and mine["dept_note"] == "도로과 보수"
    t = lambda s: datetime.fromisoformat(s.replace("Z", "+00:00"))  # noqa: E731  (3.10 호환)
    assert t(mine["news_at"]) > t(first_news)

    feats = client.get("/api/reports/map").json()["features"]
    assert any(f["properties"]["public_id"] == pid for f in feats)


def test_bad_inputs():
    assert client.post("/api/reports", json={"photo_key": "없음.jpg"}).status_code == 400
    assert client.patch("/api/admin/reports/99999", json={"status": "done"}).status_code == 404
    p = upload()
    rid = client.post("/api/admin/reports", json={"photo_key": p["key"], "source": "cctv"}).json()["id"]
    assert client.patch(f"/api/admin/reports/{rid}", json={"status": "끝"}).status_code == 400
    assert client.get("/api/photos/..%2F..%2Fetc%2Fpasswd").status_code in (400, 404)


def test_nearby_reports_and_not_target_flag():
    """같은 곳 근처 제보만 나오고(체험·오탐 제외), 처리 대상 아님은 내 제보에서 구분된다."""
    from .test_priority import make
    base = (37.5900, 127.0200)
    a = make(*base)
    far = make(base[0] + 0.01, base[1])  # 약 1.1km 떨어짐
    demo = make(*base, is_demo=True)
    near = client.get("/api/reports/nearby", params={"lat": base[0], "lon": base[1] + 0.0002}).json()
    ids = [x["public_id"] for x in near]
    assert a["public_id"] in ids and far["public_id"] not in ids and demo["public_id"] not in ids
    assert {"public_id", "category", "status", "status_label", "distance_m", "confirm_count"} <= set(near[0])
    assert "memo" not in near[0] and "photo_url" not in near[0]
    # 분류가 다르면 거른다
    assert client.get("/api/reports/nearby", params={"lat": base[0], "lon": base[1], "category": "없는분류"}).json() == []
    # 처리 대상 아님: 주민 내 제보에서는 구분돼 보이고, 근처 목록에서는 빠진다
    rid = next(x["id"] for x in client.get("/api/admin/reports").json() if x["public_id"] == a["public_id"])
    client.patch(f"/api/admin/reports/{rid}", json={"false_positive": True, "dept_note": "공사 중인 구간이라 대상이 아닙니다"})
    mine = client.get("/api/reports", params={"ids": a["public_id"]}).json()[0]
    assert mine["not_target"] is True and "공사" in mine["dept_note"]
    assert a["public_id"] not in [x["public_id"] for x in client.get("/api/reports/nearby", params={"lat": base[0], "lon": base[1]}).json()]
