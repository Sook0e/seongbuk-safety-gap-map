"""담당자가 고친 AI 분류를 모아 내보낸다 (AI 분류 개선용 평가 세트·프롬프트 예시 후보).

- 대상: 주민 제보(source=resident) 중 담당자가 '실제 유형'을 골랐거나 'AI 오탐'으로 표시한 건
- 열: 접수번호, 접수일시, AI가 고른 유형, AI 신뢰도, 담당자가 고른 실제 유형, 오탐 여부, 사진 키
- 사진 키로 저장소에서 주민 제보 사진을 찾을 수 있다. 주민 이름·연락처·식별값·위치·메모는 넣지 않는다.
- AI와 실제 유형이 같으면 '일치'로 센다(정답 표본으로도 쓸 수 있음). 오탐은 실제 유형이 '해당 없음'이라는 뜻이라 따로 표시한다.
"""
from __future__ import annotations

import csv
import io
from collections import Counter

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from .constants import KST
from .models import Report

HEADERS = ["접수번호", "접수일시", "AI 유형", "AI 신뢰도(%)", "담당자가 고른 실제 유형", "AI 오탐", "AI와 일치", "사진 키"]


def rows(db: Session) -> list[list]:
    q = select(Report).where(Report.source == "resident", Report.is_demo.is_(False),
                             or_(Report.true_category.is_not(None), Report.false_positive.is_(True))).order_by(Report.created_at)
    out = []
    for r in db.scalars(q):
        true = r.true_category or ""
        out.append([r.id, r.created_at.astimezone(KST).strftime("%Y-%m-%d %H:%M") if r.created_at.tzinfo else r.created_at.strftime("%Y-%m-%d %H:%M"),
                    r.ai_category or "", r.ai_confidence if r.ai_confidence is not None else "", true,
                    "예" if r.false_positive else "", ("예" if true and true == r.ai_category else ("아니오" if true else "")), r.photo_key or ""])
    return out


def confusion(db: Session) -> Counter:
    """(AI 유형 → 담당자가 고른 유형) 쌍별 건수. 어떤 유형을 어떻게 자주 틀리는지 한눈에 보려는 용도."""
    c: Counter = Counter()
    for r in rows(db):
        if r[4]:
            c[(r[2] or "없음", r[4])] += 1
    return c


def to_csv(db: Session) -> bytes:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(HEADERS)
    w.writerows(rows(db))
    return buf.getvalue().encode("utf-8-sig")  # 엑셀에서 한글이 깨지지 않게
