"""주민 보상(포인트) API. 제보는 비로그인 그대로이고, 포인트를 쓸 때(기프티콘 교환)만 전화번호 인증을 한다.

- 주민: 내 포인트 보기, 전화번호 인증(인증번호 받기·확인), 기프티콘 교환 신청. 모두 브라우저 식별값(client_key)으로 본인을 가린다.
- 담당자: 제보 보상 승인(적립), 교환 신청 목록과 처리 완료.
- 문자 발송은 아직 연동하지 않았다. SMS_PROVIDER가 비어 있으면 '테스트 인증'으로 인증번호를 응답에 담아 준다 (배포 전 반드시 연동하거나 막아야 함).
"""
from __future__ import annotations

import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import rewards
from ..constants import (REWARD_CODE_MINUTES, REWARD_MIN_REDEEM, REWARD_MONTH_COUNT, REWARD_MONTH_POINTS,
                         REWARD_SESSION_HOURS)
from ..db import get_db
from ..models import Report, RewardCode, RewardPhone, RewardPoint, RewardRedeem, now

router = APIRouter(tags=["rewards"])
# 문자 발송을 연동하기 전에는 '테스트 인증'(인증번호를 응답에 담아 줌)만 가능하다. 누구나 인증을 통과할 수 있으므로 배포 환경(VERCEL)에서는
# 기본으로 막고, 시연이 필요하면 환경변수 ALLOW_TEST_SMS=1 로만 켠다.
SMS_PROVIDER = os.getenv("SMS_PROVIDER", "")
TEST_SMS = os.getenv("ALLOW_TEST_SMS") == "1" or not os.getenv("VERCEL")


class KeyIn(BaseModel):
    client_key: str = Field(min_length=8, max_length=40)


class PhoneIn(KeyIn):
    phone: str = Field(max_length=20, description="휴대전화 번호 (숫자나 하이픈)")


class VerifyIn(PhoneIn):
    code: str = Field(min_length=6, max_length=6)


class RedeemIn(KeyIn):
    amount: int = Field(gt=0, description="교환할 포인트 (1,000 단위)")


@router.get("/api/rewards/me")
def my_rewards(client_key: str, db: Session = Depends(get_db)):
    """내 포인트. 전화번호를 인증했고 유효 시간 안이면 열 때마다 유효 시간을 연장한다."""
    if not 8 <= len(client_key) <= 40:
        raise HTTPException(422, "client_key가 올바르지 않아요")
    p = rewards.phone_of(db, client_key)
    verified = rewards.session_ok(p)
    if verified:
        p.last_active_at = now()
        db.commit()
    keys = rewards.owner_keys(db, client_key)
    n, pts = rewards.month_usage(db, keys)
    entries = [{"public_id": r.public_id, "points": rp.points, "note": rp.note, "grade": rp.grade, "at": rewards.aware(rp.created_at)}
               for rp, r in db.execute(select(RewardPoint, Report).join(Report, Report.id == RewardPoint.report_id)
                                       .where(RewardPoint.client_key.in_(keys)).order_by(RewardPoint.created_at.desc()).limit(30))]
    redeems = ([{"id": x.id, "amount": x.amount, "status": x.status, "at": rewards.aware(x.created_at)}
                for x in db.scalars(select(RewardRedeem).where(RewardRedeem.phone_hash == p.phone_hash).order_by(RewardRedeem.created_at.desc()).limit(10))]
               if p else [])
    return {"verified": verified, "phone_linked": p is not None, "phone_last4": p.last4 if p else None,
            "balance": rewards.balance(db, client_key), "min_redeem": REWARD_MIN_REDEEM, "session_hours": REWARD_SESSION_HOURS,
            "month": {"count": n, "points": pts, "count_limit": REWARD_MONTH_COUNT, "points_limit": REWARD_MONTH_POINTS},
            "entries": entries, "redeems": redeems}


@router.post("/api/rewards/phone/request")
def request_code(body: PhoneIn, db: Session = Depends(get_db)):
    """전화번호 인증번호 받기. 브라우저 하나가 한 시간에 5번까지."""
    digits = rewards.normalize_phone(body.phone)
    if digits is None:
        raise HTTPException(422, "휴대전화 번호(010으로 시작)를 입력해 주세요")
    since = now() - timedelta(hours=1)
    recent = db.scalar(select(func.count(RewardCode.id)).where(RewardCode.client_key == body.client_key, RewardCode.created_at >= since)) or 0
    if recent >= 5:
        raise HTTPException(429, "인증번호를 너무 자주 요청했어요. 잠시 뒤에 다시 해 주세요")
    if SMS_PROVIDER or not TEST_SMS:
        raise HTTPException(501, "문자 발송 연동이 아직 없어서 전화번호 인증을 쓸 수 없어요")
    code = f"{secrets.randbelow(1_000_000):06d}"
    ph = rewards.hash_phone(digits)
    db.add(RewardCode(client_key=body.client_key, phone_hash=ph, code_hash=rewards.hash_code(body.client_key, ph, code),
                      expires_at=now() + timedelta(minutes=REWARD_CODE_MINUTES)))
    db.commit()
    return {"sent": True, "mock": True, "code": code, "expires_minutes": REWARD_CODE_MINUTES}  # 테스트 인증: 연동 전에는 번호를 그대로 알려 줌


@router.post("/api/rewards/phone/verify")
def verify_code(body: VerifyIn, db: Session = Depends(get_db)):
    """인증번호 확인. 성공하면 이 브라우저를 그 전화번호에 연결하고, 같은 번호의 다른 브라우저 적립분이 합쳐진다."""
    digits = rewards.normalize_phone(body.phone)
    if digits is None:
        raise HTTPException(422, "휴대전화 번호(010으로 시작)를 입력해 주세요")
    ph = rewards.hash_phone(digits)
    row = db.scalar(select(RewardCode).where(RewardCode.client_key == body.client_key, RewardCode.phone_hash == ph)
                    .order_by(RewardCode.created_at.desc()))
    if row is None or rewards.aware(row.expires_at) < datetime.now(timezone.utc) or row.tries >= 5:
        raise HTTPException(400, "인증번호가 없거나 만료됐어요. 다시 받아 주세요")
    if row.code_hash != rewards.hash_code(body.client_key, ph, body.code):
        row.tries += 1
        db.commit()
        raise HTTPException(400, "인증번호가 맞지 않아요")
    p = rewards.phone_of(db, body.client_key)
    if p is None:
        db.add(RewardPhone(client_key=body.client_key, phone_hash=ph, last4=digits[-4:]))
    else:
        p.phone_hash, p.last4, p.verified_at, p.last_active_at = ph, digits[-4:], now(), now()
    db.delete(row)
    db.commit()
    return {"verified": True, "phone_last4": digits[-4:], "balance": rewards.balance(db, body.client_key)}


@router.post("/api/rewards/redeem")
def redeem(body: RedeemIn, db: Session = Depends(get_db)):
    """기프티콘 교환 신청. 전화번호 인증이 유효한 동안(REWARD_SESSION_HOURS)만, 최소 단위·잔액 안에서."""
    p = rewards.phone_of(db, body.client_key)
    if not rewards.session_ok(p):
        raise HTTPException(403, "전화번호 인증이 필요해요 (인증은 2시간 동안 유효해요)")
    if body.amount < REWARD_MIN_REDEEM or body.amount % 1000:
        raise HTTPException(400, f"{REWARD_MIN_REDEEM:,}포인트 이상, 1,000포인트 단위로 교환할 수 있어요")
    if body.amount > rewards.balance(db, body.client_key):
        raise HTTPException(400, "포인트가 모자라요")
    p.last_active_at = now()
    db.add(RewardRedeem(phone_hash=p.phone_hash, last4=p.last4, amount=body.amount))
    db.commit()
    return {"ok": True, "balance": rewards.balance(db, body.client_key)}


# ---- 담당자 ----

@router.post("/api/admin/reports/{report_id}/reward")
def approve_reward(report_id: int, db: Session = Depends(get_db)):
    """제보 보상 승인(적립). 일반 1,000P·긴급 3,000P. 같은 곳 중복이나 월 한도 초과면 0점으로 기록한다."""
    r = db.get(Report, report_id)
    if r is None:
        raise HTTPException(404, "제보 없음")
    try:
        rp = rewards.award(db, r)
    except ValueError as e:
        raise HTTPException(409, str(e)) from e
    except PermissionError as e:
        raise HTTPException(400, str(e)) from e
    return {"points": rp.points, "grade": rp.grade, "note": rp.note}


@router.get("/api/admin/rewards/redeems")
def list_redeems(status: str | None = None, db: Session = Depends(get_db)):
    q = select(RewardRedeem).order_by(RewardRedeem.created_at.desc()).limit(100)
    if status:
        q = q.where(RewardRedeem.status == status)
    return [{"id": x.id, "amount": x.amount, "status": x.status, "phone_last4": x.last4,
             "created_at": rewards.aware(x.created_at), "handled_at": rewards.aware(x.handled_at) if x.handled_at else None}
            for x in db.scalars(q)]


@router.patch("/api/admin/rewards/redeems/{redeem_id}")
def finish_redeem(redeem_id: int, db: Session = Depends(get_db)):
    """기프티콘을 보낸 뒤 처리 완료로 바꾼다."""
    x = db.get(RewardRedeem, redeem_id)
    if x is None:
        raise HTTPException(404, "교환 신청 없음")
    x.status, x.handled_at = "done", now()
    db.commit()
    return {"id": x.id, "status": x.status}
