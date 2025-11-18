/**
 * 고품질 광고 카피 데이터베이스
 * 실제 성공한 광고들을 카테고리별로 정리
 */

export interface PremiumAdExample {
  id: string;
  category: string;
  brand: string;
  headline: string;
  description?: string;
  style: "emotional" | "data_driven" | "urgent" | "premium" | "storytelling";
  triggers: string[];
  formula: string;
  performance?: {
    ctr?: number;
    conversionRate?: number;
  };
}

export const PREMIUM_AD_DATABASE: PremiumAdExample[] = [
  // 화장품/뷰티
  {
    id: "beauty-1",
    category: "화장품",
    brand: "SK-II",
    headline: "7일 만에 피부가 기억하는 투명함",
    description: "97.3% 피부 개선 임상 실험 완료",
    style: "data_driven",
    triggers: ["구체적 숫자", "시간 제한", "과학적 근거"],
    formula: "PAS",
  },
  {
    id: "beauty-2",
    category: "화장품",
    brand: "Estée Lauder",
    headline: "당신이 잠든 사이, 10년이 되돌아갑니다",
    style: "emotional",
    triggers: ["변화", "시간 역행", "프리미엄"],
    formula: "AIDA",
  },
  {
    id: "beauty-3",
    category: "화장품",
    brand: "Sulwhasoo",
    headline: "3,912번의 실패 끝에 찾은 단 하나의 포뮬러",
    style: "storytelling",
    triggers: ["희소성", "노력", "독점성"],
    formula: "Story",
  },

  // 패션
  {
    id: "fashion-1",
    category: "패션",
    brand: "Zara",
    headline: "월요일 입고, 금요일 품절",
    style: "urgent",
    triggers: ["긴급성", "희소성", "FOMO"],
    formula: "AIDA",
  },
  {
    id: "fashion-2",
    category: "패션",
    brand: "Chanel",
    headline: "스타일은 변해도, 품격은 영원하다",
    style: "premium",
    triggers: ["권위", "영원성", "품격"],
    formula: "FAB",
  },

  // 테크/전자제품
  {
    id: "tech-1",
    category: "전자제품",
    brand: "Apple",
    headline: "생각의 속도로 작동하는 유일한 도구",
    style: "premium",
    triggers: ["혁신", "유일함", "속도"],
    formula: "USP",
  },
  {
    id: "tech-2",
    category: "전자제품",
    brand: "Samsung",
    headline: "0.003초, 당신의 일상이 바뀌는 시간",
    description: "AI가 당신보다 먼저 알아차립니다",
    style: "data_driven",
    triggers: ["정확한 수치", "AI", "변화"],
    formula: "PAS",
  },

  // 식품/음료
  {
    id: "food-1",
    category: "식품",
    brand: "Nespresso",
    headline: "아침을 깨우는 23초의 의식",
    style: "premium",
    triggers: ["루틴", "감각", "시간"],
    formula: "AIDA",
  },
  {
    id: "food-2",
    category: "식품",
    brand: "Coca-Cola",
    headline: "127년째 같은 레시피, 매일 다른 행복",
    style: "emotional",
    triggers: ["전통", "일관성", "감정"],
    formula: "Story",
  },

  // 금융/보험
  {
    id: "finance-1",
    category: "금융",
    brand: "KB국민카드",
    headline: "쓸 때마다 2.7% 돌아오는 유일한 선택",
    style: "data_driven",
    triggers: ["혜택", "수치", "유일함"],
    formula: "FAB",
  },
  {
    id: "finance-2",
    category: "금융",
    brand: "삼성생명",
    headline: "30년 후 당신이 감사할 오늘의 10분",
    style: "emotional",
    triggers: ["미래", "안전", "투자"],
    formula: "Future Pacing",
  },

  // 자동차
  {
    id: "auto-1",
    category: "자동차",
    brand: "Mercedes-Benz",
    headline: "도로 위의 철학, 130년의 진화",
    style: "premium",
    triggers: ["역사", "권위", "진화"],
    formula: "Heritage",
  },
  {
    id: "auto-2",
    category: "자동차",
    brand: "Tesla",
    headline: "주유소를 지나칠 때마다 미소 짓는 이유",
    style: "emotional",
    triggers: ["변화", "만족", "혁신"],
    formula: "Problem-Solution",
  },

  // 교육
  {
    id: "edu-1",
    category: "교육",
    brand: "뤼이드",
    headline: "AI가 찾은 당신만의 합격 공식",
    description: "평균 47점 상승, 3개월의 기적",
    style: "data_driven",
    triggers: ["개인화", "성과", "AI"],
    formula: "Before-After",
  },

  // 부동산
  {
    id: "realestate-1",
    category: "부동산",
    brand: "래미안",
    headline: "강남까지 7분, 하지만 숲속에 산다",
    style: "emotional",
    triggers: ["위치", "자연", "모순의 해결"],
    formula: "Contrast",
  },

  // 헬스케어
  {
    id: "health-1",
    category: "헬스케어",
    brand: "센트룸",
    headline: "하루 한 알로 채우는 23가지 부족함",
    style: "data_driven",
    triggers: ["편의성", "완전함", "숫자"],
    formula: "Problem-Solution",
  },

  // 여행
  {
    id: "travel-1",
    category: "여행",
    brand: "에어비앤비",
    headline: "호텔이 아닌, 당신의 파리 집",
    style: "emotional",
    triggers: ["소속감", "경험", "차별화"],
    formula: "Belonging",
  },
];

/**
 * 카테고리별 광고 예시 검색
 */
export function getAdExamplesByCategory(
  category: string,
  limit: number = 3
): PremiumAdExample[] {
  const keywords = category.toLowerCase().split(" ");
  
  const filtered = PREMIUM_AD_DATABASE.filter(ad => 
    keywords.some(keyword => 
      ad.category.includes(keyword) || 
      ad.headline.toLowerCase().includes(keyword) ||
      ad.brand.toLowerCase().includes(keyword)
    )
  );

  // 카테고리 매칭이 없으면 스타일 다양성 있게 랜덤 선택
  if (filtered.length === 0) {
    const styles = ["emotional", "data_driven", "premium", "storytelling", "urgent"];
    const diverse: PremiumAdExample[] = [];
    
    for (const style of styles) {
      const styleAds = PREMIUM_AD_DATABASE.filter(ad => ad.style === style);
      if (styleAds.length > 0) {
        diverse.push(styleAds[Math.floor(Math.random() * styleAds.length)]);
      }
      if (diverse.length >= limit) break;
    }
    
    return diverse.slice(0, limit);
  }

  return filtered.slice(0, limit);
}

/**
 * 스타일별 광고 예시 검색
 */
export function getAdExamplesByStyle(
  style: string,
  limit: number = 3
): PremiumAdExample[] {
  return PREMIUM_AD_DATABASE
    .filter(ad => ad.style === style)
    .slice(0, limit);
}

/**
 * 트리거별 광고 예시 검색
 */
export function getAdExamplesByTriggers(
  triggers: string[],
  limit: number = 3
): PremiumAdExample[] {
  return PREMIUM_AD_DATABASE
    .filter(ad => 
      triggers.some(trigger => 
        ad.triggers.some(adTrigger => 
          adTrigger.includes(trigger)
        )
      )
    )
    .slice(0, limit);
}
