// 카피라이팅 공식 데이터베이스
// 100년간 검증된 12가지 카피라이팅 공식

export interface CopywritingFormula {
  id: string;
  name: string;
  category: string;
  steps: Array<{
    name: string;
    focus: string;
    percentage?: number; // 전체 카피에서 차지하는 비중
  }>;
  bestFor: string[];
  difficulty: number; // 1-5
  effectiveness: number; // 1-5
  description: string;
  example: string;
  compatibleTriggers: number[]; // 심리 트리거 ID
  keywords: string[]; // 이 공식을 활성화하는 키워드
}

export const COPYWRITING_FORMULAS: Record<string, CopywritingFormula> = {
  AIDA: {
    id: "AIDA",
    name: "AIDA",
    category: "classic",
    steps: [
      { name: "Attention", focus: "주목 - 강력한 훅으로 관심 끌기", percentage: 20 },
      { name: "Interest", focus: "흥미 - 관련성과 호기심 유지", percentage: 30 },
      { name: "Desire", focus: "욕구 - 혜택으로 감정 자극", percentage: 30 },
      { name: "Action", focus: "행동 - 명확한 CTA", percentage: 20 },
    ],
    bestFor: ["모든 마케팅", "B2C", "상품 판매", "긴급성 필요"],
    difficulty: 2,
    effectiveness: 4.8,
    description: "가장 보편적이고 검증된 공식. Attention-Interest-Desire-Action 순서로 진행",
    example: "지금 주목! [주목] 30대 여성만을 위한 [흥미] 피부 고민 해결 [욕구] 오늘만 50% 할인 [행동]",
    compatibleTriggers: [8, 10, 11, 1, 17], // 긴급성, 희소성, 제한된 수량, 소유감, 스토리텔링
    keywords: ["긴급", "지금", "당장", "즉시", "할인", "특별"],
  },

  PAS: {
    id: "PAS",
    name: "PAS (Problem-Agitate-Solution)",
    category: "emotional",
    steps: [
      { name: "Problem", focus: "문제 - 고통점 명확히 인식", percentage: 20 },
      { name: "Agitate", focus: "자극 - 문제의 심각성 강조", percentage: 50 },
      { name: "Solution", focus: "해결책 - 제품이 해결 방법", percentage: 30 },
    ],
    bestFor: ["통증점 강조", "문제 해결", "B2B", "서비스"],
    difficulty: 3,
    effectiveness: 4.7,
    description: "문제를 인식시키고, 감정적으로 자극한 후 해결책 제시",
    example: "피부 트러블로 고민? [문제] 방치하면 평생 후회합니다 [자극] 이제 해결하세요 [해결책]",
    compatibleTriggers: [1, 2, 5, 7, 24], // 소유감, 정직성, 가치 증명, 탐욕, 감정적 연결
    keywords: ["고민", "문제", "해결", "걱정", "두려움"],
  },

  BAB: {
    id: "BAB",
    name: "BAB (Before-After-Bridge)",
    category: "transformation",
    steps: [
      { name: "Before", focus: "이전 - 현재 고통 상태", percentage: 25 },
      { name: "After", focus: "이후 - 이상적인 미래", percentage: 50 },
      { name: "Bridge", focus: "다리 - 제품이 연결고리", percentage: 25 },
    ],
    bestFor: ["변화/변신 강조", "다이어트", "교육", "자기계발"],
    difficulty: 2,
    effectiveness: 4.6,
    description: "현재 상태와 이상적 미래를 대비하고, 제품이 그 다리 역할",
    example: "지금 피곤한 당신 [이전] → 활력 넘치는 당신 [이후] = 우리 제품 [다리]",
    compatibleTriggers: [1, 4, 9, 17, 18], // 소유감, 만족 확신, 즉각 만족, 스토리텔링, 호기심
    keywords: ["변화", "전후", "달라진", "이전", "이후"],
  },

  FAB: {
    id: "FAB",
    name: "FAB (Features-Advantages-Benefits)",
    category: "logical",
    steps: [
      { name: "Features", focus: "기능 - 제품 특징", percentage: 20 },
      { name: "Advantages", focus: "장점 - 경쟁 우위", percentage: 30 },
      { name: "Benefits", focus: "혜택 - 고객이 얻는 것", percentage: 50 },
    ],
    bestFor: ["제품 중심", "B2B", "기술 제품", "사실 기반"],
    difficulty: 2,
    effectiveness: 4.3,
    description: "기능보다 혜택을 강조. Features → Advantages → Benefits 순서",
    example: "AI 기반 [기능] → 50% 더 빠름 [장점] → 시간 절약으로 매출 증가 [혜택]",
    compatibleTriggers: [2, 5, 12, 15, 22], // 정직성, 가치 증명, 권위, 구체성, 전문성
    keywords: ["기능", "장점", "혜택", "특징", "우위"],
  },

  FOUR_U: {
    id: "FOUR_U",
    name: "4U's (Useful-Urgent-Unique-Ultra-specific)",
    category: "headline",
    steps: [
      { name: "Useful", focus: "유용성 - 실질적 가치", percentage: 25 },
      { name: "Urgent", focus: "긴급성 - 지금 행동", percentage: 25 },
      { name: "Unique", focus: "독특함 - 차별화 요소", percentage: 25 },
      { name: "Ultra-specific", focus: "초구체성 - 명확한 숫자", percentage: 25 },
    ],
    bestFor: ["헤드라인", "짧은 카피", "소셜미디어"],
    difficulty: 3,
    effectiveness: 4.9,
    description: "강력한 헤드라인 작성 공식. 4가지 U 요소 포함",
    example: "7일만에 [구체성] 5kg 감량 [유용성] 오늘만 [긴급성] 세계 최초 [독특함]",
    compatibleTriggers: [8, 10, 11, 15, 18], // 긴급성, 희소성, 제한, 구체성, 호기심
    keywords: ["유용", "긴급", "독특", "구체적", "숫자"],
  },

  FOUR_C: {
    id: "FOUR_C",
    name: "4C's (Clear-Concise-Compelling-Credible)",
    category: "principle",
    steps: [
      { name: "Clear", focus: "명확함 - 이해하기 쉽게", percentage: 25 },
      { name: "Concise", focus: "간결함 - 핵심만 전달", percentage: 25 },
      { name: "Compelling", focus: "설득력 - 감정 자극", percentage: 25 },
      { name: "Credible", focus: "신뢰성 - 증거 제시", percentage: 25 },
    ],
    bestFor: ["모든 카피의 기본 원칙", "B2B", "전문 서비스"],
    difficulty: 2,
    effectiveness: 4.5,
    description: "모든 좋은 카피의 기본 원칙 4가지",
    example: "99%가 선택 [신뢰] 간단한 [명확] 3단계로 [간결] 당신도 성공 [설득력]",
    compatibleTriggers: [2, 3, 5, 12, 14], // 정직성, 신뢰성, 가치, 권위, 단순성
    keywords: ["명확", "간결", "설득", "신뢰", "증거"],
  },

  ACCA: {
    id: "ACCA",
    name: "ACCA (Awareness-Comprehension-Conviction-Action)",
    category: "educational",
    steps: [
      { name: "Awareness", focus: "인지 - 문제 깨닫기", percentage: 20 },
      { name: "Comprehension", focus: "이해 - 해결 방법 이해", percentage: 30 },
      { name: "Conviction", focus: "확신 - 이것이 정답임을 확신", percentage: 30 },
      { name: "Action", focus: "행동 - 즉시 행동", percentage: 20 },
    ],
    bestFor: ["교육적 콘텐츠", "상세 세일즈", "B2B"],
    difficulty: 4,
    effectiveness: 4.4,
    description: "인지부터 행동까지 교육적 접근",
    example: "알고 계셨나요? [인지] 이렇게 해결합니다 [이해] 검증됨 [확신] 지금 시작 [행동]",
    compatibleTriggers: [2, 5, 12, 13, 22], // 정직성, 가치, 권위, 사회적 증명, 전문성
    keywords: ["알고", "이해", "확신", "검증", "교육"],
  },

  PASTOR: {
    id: "PASTOR",
    name: "PASTOR",
    category: "advanced",
    steps: [
      { name: "Problem", focus: "문제 인식", percentage: 15 },
      { name: "Amplify", focus: "문제 증폭", percentage: 20 },
      { name: "Solution", focus: "해결책 제시", percentage: 20 },
      { name: "Transformation", focus: "변화 약속", percentage: 20 },
      { name: "Offer", focus: "구체적 제안", percentage: 15 },
      { name: "Response", focus: "즉각 반응 유도", percentage: 10 },
    ],
    bestFor: ["장문 카피", "세일즈 레터", "랜딩 페이지"],
    difficulty: 5,
    effectiveness: 4.8,
    description: "Ray Edwards의 현대적 공식. 6단계 체계적 접근",
    example: "고민 [문제] → 심각해요 [증폭] → 해결법 [솔루션] → 달라짐 [변화] → 특가 [제안] → 지금 [반응]",
    compatibleTriggers: [1, 2, 4, 7, 8, 9, 10], // 소유감, 정직성, 만족, 탐욕, 긴급성, 즉각만족, 희소성
    keywords: ["문제", "증폭", "해결", "변화", "제안", "반응"],
  },

  QUEST: {
    id: "QUEST",
    name: "QUEST",
    category: "comprehensive",
    steps: [
      { name: "Qualify", focus: "자격 - 타겟 선별", percentage: 15 },
      { name: "Understand", focus: "이해 - 공감 표현", percentage: 20 },
      { name: "Educate", focus: "교육 - 정보 제공", percentage: 25 },
      { name: "Stimulate", focus: "자극 - 욕구 유발", percentage: 25 },
      { name: "Transition", focus: "전환 - 구매 유도", percentage: 15 },
    ],
    bestFor: ["전체 고객 여정", "복합 제품", "B2B"],
    difficulty: 5,
    effectiveness: 4.6,
    description: "전체 고객 여정을 커버하는 종합 공식",
    example: "30대 직장인 [자격] → 이해합니다 [이해] → 이렇게요 [교육] → 원하시죠? [자극] → 구매 [전환]",
    compatibleTriggers: [2, 3, 5, 12, 13, 14, 23], // 정직성, 신뢰, 가치, 권위, 사회적증명, 단순성, 공동체
    keywords: ["타겟", "공감", "교육", "자극", "전환"],
  },

  OGILVY_5: {
    id: "OGILVY_5",
    name: "Ogilvy 5단계",
    category: "master",
    steps: [
      { name: "Headline", focus: "헤드라인 - 80% 중요", percentage: 30 },
      { name: "Visual", focus: "시각 - 이미지 설명", percentage: 20 },
      { name: "Body", focus: "본문 - 상세 설명", percentage: 25 },
      { name: "Proof", focus: "증명 - 사실 제시", percentage: 15 },
      { name: "CTA", focus: "행동 유도", percentage: 10 },
    ],
    bestFor: ["종합 광고", "프린트 광고", "브랜드 캠페인"],
    difficulty: 4,
    effectiveness: 4.9,
    description: "David Ogilvy의 검증된 5단계. 리서치 기반",
    example: "놀라운 결과 [헤드라인] → (이미지) [시각] → 상세히 [본문] → 증명됨 [증거] → 지금 [CTA]",
    compatibleTriggers: [2, 3, 5, 12, 13, 15, 22], // 정직성, 신뢰, 가치, 권위, 사회적증명, 구체성, 전문성
    keywords: ["헤드라인", "사실", "증명", "리서치", "신뢰"],
  },

  COLLIER_5: {
    id: "COLLIER_5",
    name: "Collier 5단계",
    category: "letter",
    steps: [
      { name: "Opening", focus: "오프닝 - 독자 현재 위치", percentage: 20 },
      { name: "Description", focus: "설명 - 동기 부여", percentage: 25 },
      { name: "Proof", focus: "증명 - 믿을만한 증거", percentage: 25 },
      { name: "Hook", focus: "훅 - 독특한 제안", percentage: 20 },
      { name: "Close", focus: "클로징 - 행동 유도", percentage: 10 },
    ],
    bestFor: ["세일즈 레터", "이메일", "DM"],
    difficulty: 4,
    effectiveness: 4.7,
    description: "Robert Collier의 레터 라이팅 공식",
    example: "당신은 지금 [오프닝] → 왜냐하면 [설명] → 증거 [증명] → 특별한 [훅] → 지금 [클로징]",
    compatibleTriggers: [1, 2, 3, 4, 10, 17], // 소유감, 정직성, 신뢰, 만족, 희소성, 스토리텔링
    keywords: ["레터", "개인적", "증거", "제안", "클로징"],
  },

  THREE_STAGE: {
    id: "THREE_STAGE",
    name: "3단계 접근법",
    category: "simple",
    steps: [
      { name: "Attention", focus: "주목 - 강력한 훅", percentage: 30 },
      { name: "Interest", focus: "관심 - 유지", percentage: 40 },
      { name: "Action", focus: "행동 - CTA", percentage: 30 },
    ],
    bestFor: ["짧은 카피", "소셜미디어", "배너 광고"],
    difficulty: 1,
    effectiveness: 4.2,
    description: "가장 단순하고 빠른 공식. 짧은 카피에 최적",
    example: "주목! [주목] 이것만 보세요 [관심] 지금 클릭 [행동]",
    compatibleTriggers: [8, 10, 18], // 긴급성, 희소성, 호기심
    keywords: ["짧은", "간단", "빠른", "소셜"],
  },
};

/**
 * 사용자 입력을 분석해서 적합한 공식 추천
 */
export function recommendFormula(
  intent: {
    urgency?: "high" | "medium" | "low";
    length?: "short" | "medium" | "long";
    tone?: string;
    keywords?: string[];
  }
): CopywritingFormula {
  const { urgency, length, keywords = [] } = intent;

  // 긴급성이 높으면 AIDA
  if (urgency === "high") {
    return COPYWRITING_FORMULAS.AIDA;
  }

  // 짧은 카피면 4U's 또는 3단계
  if (length === "short") {
    return COPYWRITING_FORMULAS.FOUR_U;
  }

  // 문제 해결 키워드가 있으면 PAS
  const problemKeywords = ["문제", "고민", "해결", "걱정", "두려움"];
  if (keywords.some(kw => problemKeywords.includes(kw))) {
    return COPYWRITING_FORMULAS.PAS;
  }

  // 변화/변신 키워드가 있으면 BAB
  const transformKeywords = ["변화", "전후", "달라진", "이전", "이후"];
  if (keywords.some(kw => transformKeywords.includes(kw))) {
    return COPYWRITING_FORMULAS.BAB;
  }

  // 기본값: AIDA (가장 보편적)
  return COPYWRITING_FORMULAS.AIDA;
}

/**
 * 공식 ID로 조회
 */
export function getFormulaById(id: string): CopywritingFormula | undefined {
  return COPYWRITING_FORMULAS[id];
}

/**
 * 모든 공식 목록
 */
export function getAllFormulas(): CopywritingFormula[] {
  return Object.values(COPYWRITING_FORMULAS);
}

