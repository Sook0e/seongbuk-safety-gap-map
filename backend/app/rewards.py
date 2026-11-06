"""주민 보상(포인트) 규칙. 담당자가 승인한 제보에만 적립하고, 한도와 중복을 여기서 걸러낸다. 숫자는 constants.py (팀 가정).

- 적립 단위: 전화번호를 인증했으면 그 번호에 연결된 모든 브라우저, 인증 전에는 제보를 보낸 브라우저 하나
- 한도: 한 달 10건·3만 포인트 (한국 시간 기준 달). 넘으면 승인은 되지만 0점으로 기록한다
- 중복: 같은 곳(반경 AFTERCARE_RADIUS_M)·같은 AI 유형에 이미 적립된 제보가 있으면 0점
- 오탐·체험·공백 항목·식별값 없는 옛 제보는 적립하지 않는다
"""
from __future__ import annotations

import hashlib
import os
import re
from datetime import datetime, timedelta, timezone
from math import asin, cos, radians, sin, sqrt

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import scoring
from .constants import (AFTERCARE_RADIUS_M, KST, REWARD_MONTH_COUNT, REWARD_MONTH_POINTS, REWARD_NORMAL_POINTS,
                        REWARD_SESSION_HOURS, REWARD_URGENT_POINTS)
from .models import Report, RewardPhone, RewardPoint, RewardRedeem

SALT = os.getenv("REWARD_SALT", "sbgap-dev-salt")  # 배포 때는 환경변수로 바꾼다 (전화번호 해시용)


def aware(dt: datetime) -> datetime:
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


def normalize_phone(raw: str) -> str | None:
    """휴대전화 번호(01로 시작, 10~11자리)만 받는다. 숫자만 남겨 돌려주고, 아니면 None."""
    d = re.sub(r"\D", "", raw or "")
    return d if re.fullmatch(r"01\d{8,9}", d) else None


def hash_phone(digits: str) -> str:
    return hashlib.sha256((SALT + digits).encode()).hexdigest()


def hash_code(client_key: str, phone_hash: str, code: str) -> str:
    return hashlib.sha256(f"{client_key}:{phone_hash}:{code}".encode()).hexdigest()


def phone_of(db: Session, client_key: str) -> RewardPhone | None:
    return db.scalar(select(RewardPhone).where(RewardPhone.client_key == client_key))


def session_ok(p: RewardPhone | None) -> bool:
    return bool(p and datetime.now(timezone.utc) - aware(p.last_active_at) <= timedelta(hours=REWARD_SESSION_HOURS))


def owner_keys(db: Session, client_key: str) -> list[str]:
    """같은 전화번호에 연결된 브라우저 전부 (인증 전이면 자기 자신뿐)."""
    p = phone_of(db, client_key)
    if p is None:
        return [client_key]
    return list(db.scalars(select(RewardPhone.client_key).where(RewardPhone.phone_hash == p.phone_hash))) or [client_key]


def month_usage(db: Session, keys: list[str]) -> tuple[int, int]:
    """이번 달(한국 시간) 적립 건수와 포인트."""
    start = datetime.now(KST).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    n = pts = 0
    for rp in db.scalars(select(RewardPoint).where(RewardPoint.client_key.in_(keys), RewardPoint.points > 0)):
        if aware(rp.created_at).astimezone(KST) >= start:
            n += 1
            pts += rp.points
    return n, pts


def balance(db: Session, client_key: str) -> int:
    keys = owner_keys(db, client_key)
    earned = sum(db.scalars(select(RewardPoint.points).where(RewardPoint.client_key.in_(keys))))
    p = phone_of(db, client_key)
    spent = sum(db.scalars(select(RewardRedeem.amount).where(RewardRedeem.phone_hash == p.phone_hash))) if p else 0
    return earned - spent


def _meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    a = sin(radians(lat2 - lat1) / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(radians(lon2 - lon1) / 2) ** 2
    return 2 * 6371000 * asin(sqrt(a))


def award(db: Session, r: Report) -> RewardPoint:
    """제보 하나를 승인해 적립한다. 이미 처리한 제보면 ValueError, 적립 대상이 아니면 PermissionError."""
    if r.reward is not None:
        raise ValueError("이미 보상을 처리한 제보예요")
    if r.source != "resident" or r.is_demo or r.false_positive:
        raise PermissionError("주민 제보 중 오탐·체험이 아닌 건만 보상할 수 있어요")
    if r.client is None:
        raise PermissionError("브라우저 식별값이 없는 옛 제보는 보상할 수 없어요")
    key = r.client.client_key
    urgent = bool(scoring.score(r)["urgent"])
    points, note = (REWARD_URGENT_POINTS if urgent else REWARD_NORMAL_POINTS), None

    # 같은 곳·같은 유형에 이미 적립된 제보가 있으면 0점 (5cm만 옮겨 다시 찍은 제보 등)
    if r.lat is not None and r.lon is not None and r.ai_category:
        q = (select(Report).join(RewardPoint, RewardPoint.report_id == Report.id)
             .where(RewardPoint.points > 0, Report.ai_category == r.ai_category, Report.id != r.id,
                    Report.lat.is_not(None), Report.lon.is_not(None)))
        if any(_meters(r.lat, r.lon, p.lat, p.lon) <= AFTERCARE_RADIUS_M for p in db.scalars(q)):
            points, note = 0, "같은 곳에서 이미 적립된 제보"
    if points:
        n, pts = month_usage(db, owner_keys(db, key))
        if n >= REWARD_MONTH_COUNT or pts + points > REWARD_MONTH_POINTS:
            points, note = 0, "월 적립 한도 초과"
    rp = RewardPoint(report_id=r.id, client_key=key, points=points, grade="urgent" if urgent else "normal", note=note)
    db.add(rp)
    db.commit()
    db.refresh(rp)
    return rp
