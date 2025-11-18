// Joseph Sugarman의 24가지 심리적 트리거
// 검증된 소비자 심리학 기반

export interface PsychologicalTrigger {
  id: number;
  number: number; // 1-24
  name: string;
  category: "emotional" | "value" | "urgency" | "trust" | "clarity" | "advanced";
  description: string;
  keywords: string[]; // 이 트리거를 활성화하는 키워드
  usageContext: string;
  effectiveness: number; // 1-5
  compatibleTriggers: number[]; // 잘 어울리는 다른 트리거들
  example: string;
  whenToUse: string;
}

export const PSYCHOLOGICAL_TRIGGERS: Record<number, PsychologicalTrigger> = {
  1: {
    id: 1,
    number: 1,
    name: "소유감/참여감",
    category: "emotional",
    description: "고객이 제품을 이미 소유한 것처럼 느끼게 만들기",
    keywords: ["당신의", "귀하의", "소유", "가지다", "경험하다"],
    usageContext: "제품 사용 경험을 상상하게 하거나, 이미 소유한 느낌 유도",
    effectiveness: 4.6,
    compatibleTriggers: [4, 9, 17],
    example: "당신의 새 차에서 첫 드라이브를 상상해보세요",
    whenToUse: "고객이 제품 사용을 상상하도록 유도할 때",
  },

  2: {
    id: 2,
    number: 2,
    name: "정직성",
    category: "trust",
    description: "솔직함으로 신뢰 구축. 단점도 언급",
    keywords: ["솔직히", "사실", "정직하게", "단점", "한계"],
    usageContext: "제품의 단점을 인정하면서 신뢰도 높이기",
    effectiveness: 4.8,
    compatibleTriggers: [3, 5, 12],
    example: "완벽하진 않지만, 이 부분에서는 최고입니다",
    whenToUse: "신뢰 구축이 중요한 고가 제품이나 서비스",
  },

  3: {
    id: 3,
    number: 3,
    name: "신뢰성",
    category: "trust",
    description: "일관된 메시지와 브랜드 이미지로 신뢰 형성",
    keywords: ["믿을 수 있는", "검증된", "보증", "안전한"],
    usageContext: "브랜드 신뢰도를 강조하고 일관성 유지",
    effectiveness: 4.7,
    compatibleTriggers: [2, 12, 13],
    example: "20년간 한결같은 품질을 지켜온 브랜드",
    whenToUse: "브랜드 인지도를 활용할 때",
  },

  4: {
    id: 4,
    number: 4,
    name: "만족 확신",
    category: "emotional",
    description: "기대를 충족할 것이라는 확신 전달",
    keywords: ["확실한", "보장", "만족", "기대 이상"],
    usageContext: "환불 보증, 만족 보장 등으로 위험 감소",
    effectiveness: 4.5,
    compatibleTriggers: [1, 21, 3],
    example: "100% 만족 보장. 아니면 전액 환불",
    whenToUse: "고객의 구매 주저를 해소할 때",
  },

  5: {
    id: 5,
    number: 5,
    name: "가치 증명",
    category: "value",
    description: "구체적 증거와 데이터로 가치 입증",
    keywords: ["증명된", "검증", "데이터", "결과", "수치"],
    usageContext: "객관적 데이터와 결과로 가치 입증",
    effectiveness: 4.9,
    compatibleTriggers: [12, 15, 22],
    example: "임상 시험 결과 97%가 효과 입증",
    whenToUse: "B2B나 논리적 설득이 필요할 때",
  },

  6: {
    id: 6,
    number: 6,
    name: "구매 정당화",
    category: "value",
    description: "구매 결정을 합리화할 근거 제공",
    keywords: ["왜냐하면", "이유", "투자", "가치", "합리적"],
    usageContext: "구매가 현명한 선택임을 논리적으로 설명",
    effectiveness: 4.4,
    compatibleTriggers: [5, 7, 15],
    example: "하루 1,000원으로 건강을 지키는 현명한 투자",
    whenToUse: "고가 제품이나 충동구매가 아닌 계획 구매 유도",
  },

  7: {
    id: 7,
    number: 7,
    name: "탐욕",
    category: "value",
    description: "더 많이 얻고 싶은 욕구 자극",
    keywords: ["더", "추가", "보너스", "덤", "플러스"],
    usageContext: "추가 혜택, 보너스로 욕구 자극",
    effectiveness: 4.3,
    compatibleTriggers: [8, 10, 6],
    example: "지금 구매하면 2개 더 드립니다",
    whenToUse: "프로모션이나 번들 제품 판매",
  },

  8: {
    id: 8,
    number: 8,
    name: "긴급성",
    category: "urgency",
    description: "지금 당장 행동해야 하는 이유 강조",
    keywords: ["긴급", "지금", "당장", "마지막", "오늘", "자정"],
    usageContext: "시간 제한으로 즉각 행동 유도",
    effectiveness: 4.9,
    compatibleTriggers: [10, 11, 9],
    example: "오늘 자정까지만 20% 할인",
    whenToUse: "캠페인 마감이나 재고 한정 상황",
  },

  9: {
    id: 9,
    number: 9,
    name: "즉각 만족",
    category: "urgency",
    description: "빠른 결과를 약속",
    keywords: ["즉시", "바로", "빠른", "신속한", "즉각"],
    usageContext: "빠른 배송, 즉각적 효과 강조",
    effectiveness: 4.6,
    compatibleTriggers: [8, 1, 18],
    example: "주문 후 24시간 내 배송",
    whenToUse: "빠른 결과가 경쟁력인 제품",
  },

  10: {
    id: 10,
    number: 10,
    name: "독점성/희소성",
    category: "urgency",
    description: "소수만 가능함을 강조",
    keywords: ["소수만", "한정", "독점", "VIP", "특별한"],
    usageContext: "제한된 수량이나 특별한 기회 강조",
    effectiveness: 4.8,
    compatibleTriggers: [8, 11, 23],
    example: "단 100명만을 위한 특별 초대",
    whenToUse: "프리미엄 제품이나 한정판",
  },

  11: {
    id: 11,
    number: 11,
    name: "제한된 시간/수량",
    category: "urgency",
    description: "FOMO(Fear Of Missing Out) 조성",
    keywords: ["남은", "마지막", "한정", "선착순", "품절 임박"],
    usageContext: "재고나 시간 제한으로 FOMO 유발",
    effectiveness: 4.7,
    compatibleTriggers: [8, 10, 18],
    example: "남은 자리 단 5개. 선착순 마감",
    whenToUse: "이벤트나 프로모션 종료 시점",
  },

  12: {
    id: 12,
    number: 12,
    name: "권위 확립",
    category: "trust",
    description: "전문성과 리더십 입증",
    keywords: ["전문가", "1위", "선두", "리더", "권위자"],
    usageContext: "전문성, 수상 경력, 인증으로 권위 입증",
    effectiveness: 4.8,
    compatibleTriggers: [3, 5, 13, 22],
    example: "업계 1위 브랜드가 선택한 기술",
    whenToUse: "전문성이 중요한 B2B나 전문 서비스",
  },

  13: {
    id: 13,
    number: 13,
    name: "사회적 증명",
    category: "trust",
    description: "다른 사람들의 성공 사례",
    keywords: ["고객", "사용자", "리뷰", "평가", "후기"],
    usageContext: "고객 리뷰, 평점, 사용자 수로 신뢰 구축",
    effectiveness: 4.9,
    compatibleTriggers: [3, 12, 16],
    example: "10만 명이 선택한 No.1 제품",
    whenToUse: "고객 리뷰나 평점이 좋을 때",
  },

  14: {
    id: 14,
    number: 14,
    name: "단순성",
    category: "clarity",
    description: "선택을 쉽게 만들기",
    keywords: ["간단한", "쉬운", "간편한", "3단계", "원클릭"],
    usageContext: "복잡성 제거, 간단한 프로세스 강조",
    effectiveness: 4.5,
    compatibleTriggers: [15, 9, 18],
    example: "클릭 한 번으로 끝. 3분이면 완료",
    whenToUse: "복잡한 제품을 쉽게 설명할 때",
  },

  15: {
    id: 15,
    number: 15,
    name: "구체성",
    category: "clarity",
    description: "정확한 숫자와 세부사항",
    keywords: ["정확히", "구체적으로", "숫자", "데이터"],
    usageContext: "모호함 제거, 구체적 수치 제시",
    effectiveness: 4.7,
    compatibleTriggers: [5, 12, 22],
    example: "정확히 3.7kg 감량, 7일 만에",
    whenToUse: "신뢰도와 명확성이 중요할 때",
  },

  16: {
    id: 16,
    number: 16,
    name: "친숙성",
    category: "clarity",
    description: "브랜드 인지도 활용",
    keywords: ["잘 알려진", "유명한", "익숙한", "친숙한"],
    usageContext: "알려진 브랜드나 제품 활용",
    effectiveness: 4.4,
    compatibleTriggers: [3, 13, 23],
    example: "여러분이 잘 아시는 그 브랜드",
    whenToUse: "브랜드 인지도가 높을 때",
  },

  17: {
    id: 17,
    number: 17,
    name: "스토리텔링",
    category: "advanced",
    description: "감정적 연결을 위한 이야기",
    keywords: ["이야기", "여정", "스토리", "경험"],
    usageContext: "브랜드 스토리나 고객 여정 공유",
    effectiveness: 4.9,
    compatibleTriggers: [1, 24, 18],
    example: "20년 전 작은 공방에서 시작된 이야기",
    whenToUse: "브랜드 감성이나 가치 전달",
  },

  18: {
    id: 18,
    number: 18,
    name: "호기심",
    category: "advanced",
    description: "궁금증을 자극해서 클릭 유도",
    keywords: ["궁금한", "비밀", "숨겨진", "알고 계셨나요"],
    usageContext: "호기심 유발로 참여 유도",
    effectiveness: 4.6,
    compatibleTriggers: [8, 10, 17],
    example: "95%가 모르는 피부 관리 비밀",
    whenToUse: "콘텐츠 클릭률을 높이고 싶을 때",
  },

  19: {
    id: 19,
    number: 19,
    name: "비교",
    category: "advanced",
    description: "경쟁사 대비 우위 강조",
    keywords: ["비교", "대비", "차이", "우위", "vs"],
    usageContext: "경쟁 제품과의 차별점 부각",
    effectiveness: 4.3,
    compatibleTriggers: [5, 12, 15],
    example: "기존 제품보다 2배 빠른 효과",
    whenToUse: "경쟁 우위가 명확할 때",
  },

  20: {
    id: 20,
    number: 20,
    name: "시각적 임팩트",
    category: "advanced",
    description: "강렬한 시각적 이미지 활용",
    keywords: ["보이는", "눈에 띄는", "시각적", "생생한"],
    usageContext: "이미지와 연계된 설명",
    effectiveness: 4.5,
    compatibleTriggers: [17, 18, 1],
    example: "눈에 보이는 변화, 7일 만에",
    whenToUse: "비주얼이 강한 제품",
  },

  21: {
    id: 21,
    number: 21,
    name: "리스크 감소",
    category: "advanced",
    description: "환불 보증 등으로 위험 제거",
    keywords: ["보증", "환불", "무료", "위험 없이"],
    usageContext: "구매 장벽 제거",
    effectiveness: 4.7,
    compatibleTriggers: [4, 3, 2],
    example: "30일 무조건 환불 보증",
    whenToUse: "고객의 구매 두려움 해소",
  },

  22: {
    id: 22,
    number: 22,
    name: "전문성 입증",
    category: "advanced",
    description: "데이터와 연구 기반 접근",
    keywords: ["연구", "임상", "과학적", "전문"],
    usageContext: "전문적 데이터와 연구 결과 제시",
    effectiveness: 4.6,
    compatibleTriggers: [5, 12, 15],
    example: "10년 연구 끝에 개발한 특허 기술",
    whenToUse: "과학적 근거가 중요한 제품",
  },

  23: {
    id: 23,
    number: 23,
    name: "공동체감",
    category: "advanced",
    description: "같은 가치관을 공유하는 느낌",
    keywords: ["우리", "함께", "커뮤니티", "같이"],
    usageContext: "소속감과 연대감 형성",
    effectiveness: 4.4,
    compatibleTriggers: [13, 16, 24],
    example: "지구를 생각하는 우리의 선택",
    whenToUse: "브랜드 가치나 미션 중심 마케팅",
  },

  24: {
    id: 24,
    number: 24,
    name: "감정적 연결",
    category: "emotional",
    description: "타겟의 감정을 반영하고 공감",
    keywords: ["공감", "이해", "느낌", "감정"],
    usageContext: "고객의 감정 상태에 공감하고 연결",
    effectiveness: 4.8,
    compatibleTriggers: [1, 17, 23],
    example: "지친 하루, 당신을 위한 휴식",
    whenToUse: "감성 마케팅이 효과적인 제품",
  },
};

/**
 * 카테고리별 트리거 조회
 */
export function getTriggersByCategory(
  category: PsychologicalTrigger["category"]
): PsychologicalTrigger[] {
  return Object.values(PSYCHOLOGICAL_TRIGGERS).filter(
    (trigger) => trigger.category === category
  );
}

/**
 * 효과도 높은 순으로 정렬
 */
export function getTopTriggers(count: number = 10): PsychologicalTrigger[] {
  return Object.values(PSYCHOLOGICAL_TRIGGERS)
    .sort((a, b) => b.effectiveness - a.effectiveness)
    .slice(0, count);
}

/**
 * 키워드 기반 트리거 추천
 */
export function recommendTriggers(
  keywords: string[],
  maxCount: number = 3
): PsychologicalTrigger[] {
  const matches = Object.values(PSYCHOLOGICAL_TRIGGERS).map((trigger) => {
    const matchCount = keywords.filter((kw) =>
      trigger.keywords.some((triggerKw) =>
        triggerKw.toLowerCase().includes(kw.toLowerCase())
      )
    ).length;
    return { trigger, matchCount };
  });

  return matches
    .filter((m) => m.matchCount > 0)
    .sort((a, b) => {
      if (b.matchCount !== a.matchCount) {
        return b.matchCount - a.matchCount;
      }
      return b.trigger.effectiveness - a.trigger.effectiveness;
    })
    .slice(0, maxCount)
    .map((m) => m.trigger);
}

/**
 * ID로 트리거 조회
 */
export function getTriggerById(id: number): PsychologicalTrigger | undefined {
  return PSYCHOLOGICAL_TRIGGERS[id];
}

/**
 * 모든 트리거 목록
 */
export function getAllTriggers(): PsychologicalTrigger[] {
  return Object.values(PSYCHOLOGICAL_TRIGGERS);
}

