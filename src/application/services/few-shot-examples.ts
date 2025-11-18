/**
 * Few-shot 예시 데이터베이스
 * 카피 작성 시 참고할 좋은 예시와 나쁜 예시
 */

export interface FewShotExample {
  category: string;
  bad: string;
  good: string;
  reason: string;
}

/**
 * 업종별 카피 예시
 */
export const COPY_EXAMPLES: Record<string, FewShotExample[]> = {
  // 화장품/뷰티
  beauty: [
    {
      category: "화장품",
      bad: "최고의 수분 크림으로 완벽한 피부를 만드세요",
      good: "거울 속 내 얼굴이, 오늘따라 환하게 웃는다",
      reason: "감성적 표현 + 구체적 이미지, 진부한 표현 회피",
    },
    {
      category: "화장품",
      bad: "프리미엄 스킨케어 제품",
      good: "피부가 기억하는 자연, 시간이 멈춘 아침",
      reason: "시각적 이미지 + 운율, 감각적 표현",
    },
    {
      category: "화장품",
      bad: "20대 여성을 위한 화장품",
      good: "서른 앞, 스무살 피부로 돌아가는 비밀",
      reason: "구체적 타겟 + 베네핏, 호기심 유발",
    },
  ],

  // IT/소프트웨어
  tech: [
    {
      category: "IT",
      bad: "혁신적인 솔루션으로 업무 효율 증대",
      good: "퇴근 시간 1시간이 빨라지는 마법",
      reason: "구체적 베네핏 (시간 절약) + 감각적 표현",
    },
    {
      category: "IT",
      bad: "최첨단 AI 기술",
      good: "사람처럼 생각하는 AI, 당신의 일은 더 즐거워집니다",
      reason: "의인화 + 감정적 베네핏",
    },
    {
      category: "IT",
      bad: "클라우드 기반 협업 툴",
      good: "서울과 부산이 한 사무실처럼, 3초 만에 아이디어 공유",
      reason: "구체적 시나리오 + 속도 강조",
    },
  ],

  // 패션
  fashion: [
    {
      category: "패션",
      bad: "트렌디한 스타일의 옷",
      good: "출근길, 모두의 시선이 머무는 그 순간",
      reason: "상황 묘사 + 감정 (자신감)",
    },
    {
      category: "패션",
      bad: "편안하고 세련된 디자인",
      good: "집처럼 편안한데, 런웨이처럼 세련된",
      reason: "대조 + 비유, 리듬감",
    },
  ],

  // 식품
  food: [
    {
      category: "식품",
      bad: "신선한 재료로 만든 건강식",
      good: "새벽 5시 농장에서 시작된, 오후 3시 당신의 식탁",
      reason: "스토리텔링 + 시간적 흐름",
    },
    {
      category: "식품",
      bad: "맛있는 프리미엄 커피",
      good: "첫 모금, 하루가 달라집니다",
      reason: "간결함 + 변화 암시",
    },
  ],

  // 부동산
  realestate: [
    {
      category: "부동산",
      bad: "좋은 입지의 아파트",
      good: "출근 15분, 퇴근 후 공원 5분 - 시간이 선물하는 여유",
      reason: "구체적 숫자 + 라이프스타일 베네핏",
    },
  ],

  // 금융
  finance: [
    {
      category: "금융",
      bad: "낮은 금리의 대출 상품",
      good: "1%가 만드는 차이, 5년 후 500만원",
      reason: "구체적 숫자 + 장기 베네핏",
    },
  ],
};

/**
 * 카피 작성 원칙
 */
export const COPY_PRINCIPLES = `
[카피 작성 핵심 원칙]

1. 진부한 표현 금지
   ❌ 피해야 할 단어: 최고, 완벽, 혁신적, 최첨단, 프리미엄
   ✅ 대신 사용: 구체적 베네핏, 감각적 표현, 숫자, 시나리오

2. 감각 활용
   - 시각: "햇살이 스며든", "빛나는"
   - 청각: "속삭이는", "울려 퍼지는"
   - 촉각: "부드러운", "포근한"
   - 후각: "은은한", "상큼한"

3. 구조 원칙
   - Hook (첫 3초): 시선 사로잡기
   - Benefit (가치): 구체적 이득
   - CTA (행동): 자연스러운 유도

4. 창의성 테크닉
   - 은유/비유 활용
   - 반전 요소 삽입
   - 리듬감 있는 문장
   - 스토리텔링

5. 숫자의 힘
   - 구체적 수치: "1시간 절약", "87% 만족"
   - 시간: "3초 만에", "하루 10분"
   - 금액: "5천원으로", "30% 할인"

6. 감정 유발
   - 공감: "당신도 알잖아요"
   - 동경: "꿈꿔왔던 그 순간"
   - 안정: "이제 걱정 없이"
   - 긴급: "오늘만", "마지막 기회"

7. 검증 기준
   - 5초 안에 이해 가능한가?
   - 행동을 유도하는가?
   - 브랜드와 어울리는가?
   - 경쟁사와 차별화되는가?
`;

/**
 * 업종별 예시 가져오기
 */
export function getExamplesByCategory(category?: string): FewShotExample[] {
  if (!category) {
    // 전체 예시 반환
    return Object.values(COPY_EXAMPLES).flat();
  }

  const normalized = category.toLowerCase();

  // 키워드 매칭
  if (normalized.includes("화장품") || normalized.includes("뷰티") || normalized.includes("스킨")) {
    return COPY_EXAMPLES.beauty;
  }
  if (normalized.includes("IT") || normalized.includes("소프트웨어") || normalized.includes("앱")) {
    return COPY_EXAMPLES.tech;
  }
  if (normalized.includes("패션") || normalized.includes("의류")) {
    return COPY_EXAMPLES.fashion;
  }
  if (normalized.includes("식품") || normalized.includes("음식") || normalized.includes("커피")) {
    return COPY_EXAMPLES.food;
  }
  if (normalized.includes("부동산") || normalized.includes("아파트")) {
    return COPY_EXAMPLES.realestate;
  }
  if (normalized.includes("금융") || normalized.includes("대출") || normalized.includes("투자")) {
    return COPY_EXAMPLES.finance;
  }

  // 기본값: 모든 예시
  return Object.values(COPY_EXAMPLES).flat().slice(0, 5);
}

/**
 * Few-shot 프롬프트 생성
 */
export function buildFewShotPrompt(examples: FewShotExample[]): string {
  if (examples.length === 0) {
    return "";
  }

  const examplesText = examples
    .map(
      (ex) => `
업종: ${ex.category}
❌ 나쁜 예: "${ex.bad}"
✅ 좋은 예: "${ex.good}"
💡 이유: ${ex.reason}
`
    )
    .join("\n");

  return `
[참고할 좋은 카피 예시]
${examplesText}

위 예시처럼 진부한 표현을 피하고, 감성적이고 구체적인 카피를 작성하세요.
`;
}

