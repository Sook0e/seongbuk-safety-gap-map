"""화면·API·DB가 같이 쓰는 고정값. 값을 바꿀 때는 docs/api.md도 같이 고친다."""
from __future__ import annotations

from datetime import timedelta, timezone

# '오늘'·'이번 주' 계산용 한국 시간 (서머타임 없음. Windows에서 tzdata 없이 동작하도록 고정 오프셋)
KST = timezone(timedelta(hours=9), "KST")

# 처리 상태 (와이어프레임: 접수 → 검토 → 조치 → 완료)
STATUSES = {"received": "접수", "review": "검토", "action": "조치", "done": "완료"}
STATUS_ORDER = list(STATUSES)

# '나도 봤어요'가 이 인원 이상이면 '주민 교차확인' 표시 (AI 생성 사진·허위 제보를 걸러내는 보조 장치).
# 로그인이 없어 브라우저(localStorage) 기준이라 한 사람이 여러 브라우저로 누르면 늘 수 있음. 시연·설계 단계의 한계로 문서에 남김.
CROSS_CHECK_MIN = 3

# 제보 출처 (관리자 목록 필터)
SOURCES = {"resident": "주민", "gap": "공백 탐지", "cctv": "CCTV"}

# AI 결함 유형 (CLAUDE.md 2. 사진 분류). 허용값 밖은 '기타'로 보정한다.
CATEGORIES = ["콘크리트 균열", "박리", "백태/누수", "철근 노출", "기타"]
