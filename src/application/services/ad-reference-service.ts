// 광고 레퍼런스 수집 서비스
// 메타, 구글 애즈, 네이버 광고 등 실제 집행 중인 광고 소제 수집 및 분석

import type { IntentData } from "./intent-extraction-service";

export interface AdReference {
  id: string;
  platform: "meta" | "google" | "naver" | "kakao";
  adCopy: string;
  headline?: string;
  description?: string;
  url?: string;
  imageUrl?: string;
  category: string;
  targetAudience?: string;
  collectedAt: Date;
  engagement?: {
    impressions?: number;
    clicks?: number;
    ctr?: number;
  };
  analysis?: {
    formula?: string;
    triggers?: string[];
    tone?: string;
    charCount: number;
  };
}

export interface AdReferenceSearchOptions {
  keywords?: string[]; // 카테고리 제거, 키워드만 사용
  platform?: AdReference["platform"][];
  limit?: number;
  freshnessDays?: number; // 최근 N일 이내 광고만 (기본: 90일)
}

export class AdReferenceService {
  // 기본 신선도: 90일 (3개월)
  private readonly DEFAULT_FRESHNESS_DAYS = 90;

  /**
   * Meta 광고 라이브러리에서 광고 수집
   * https://www.facebook.com/ads/library/
   */
  async searchMetaAds(options: AdReferenceSearchOptions): Promise<AdReference[]> {
    const { keywords = [], limit = 10, freshnessDays = this.DEFAULT_FRESHNESS_DAYS } = options;

    // Meta Ad Library API는 공식적으로 제한적이므로
    // Firecrawl MCP를 사용한 웹 스크래핑 방식 제안
    
    const searchQuery = keywords.join(" ");
    const metaAdLibraryUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=political_and_issue_ads&country=KR&media_type=all&search_type=keyword_unordered&q=${encodeURIComponent(searchQuery)}`;

    try {
      // Firecrawl MCP로 스크래핑 (MCP 사용 가능 시)
      // const scrapedData = await firecrawl.scrape(metaAdLibraryUrl);
      
      // 임시: 샘플 데이터 반환
      return this.getSampleMetaAds(keywords, limit);
    } catch (error) {
      console.error("Meta 광고 수집 실패:", error);
      return [];
    }
  }

  /**
   * 네이버 광고 검색 (키워드 검색 시 노출되는 광고)
   */
  async searchNaverAds(options: AdReferenceSearchOptions): Promise<AdReference[]> {
    const { keywords = [], limit = 10 } = options;

    try {
      // 네이버 검색 결과에서 파워링크 광고 수집
      const searchQuery = keywords.join(" ");
      const naverSearchUrl = `https://search.naver.com/search.naver?query=${encodeURIComponent(searchQuery)}`;

      // Firecrawl MCP로 스크래핑
      // const scrapedData = await firecrawl.scrape(naverSearchUrl);
      // const ads = this.extractNaverPowerLinks(scrapedData);

      // 임시: 샘플 데이터 반환
      return this.getSampleNaverAds(keywords, limit);
    } catch (error) {
      console.error("네이버 광고 수집 실패:", error);
      return [];
    }
  }

  /**
   * 구글 애즈 검색 (Google 검색 결과의 광고)
   */
  async searchGoogleAds(options: AdReferenceSearchOptions): Promise<AdReference[]> {
    const { keywords = [], limit = 10 } = options;

    try {
      // Google 검색 결과에서 광고 수집
      const searchQuery = keywords.join(" ");
      const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;

      // Firecrawl MCP로 스크래핑
      // const scrapedData = await firecrawl.scrape(googleSearchUrl);
      // const ads = this.extractGoogleAds(scrapedData);

      // 임시: 샘플 데이터 반환
      return this.getSampleGoogleAds(keywords, limit);
    } catch (error) {
      console.error("구글 광고 수집 실패:", error);
      return [];
    }
  }

  /**
   * 카카오 광고 (카카오톡 채널, 비즈보드 등)
   * 접근이 제한적이므로 공개 자료 기반
   */
  async searchKakaoAds(options: AdReferenceSearchOptions): Promise<AdReference[]> {
    // 카카오 광고는 API 접근이 제한적
    // 공개된 광고 사례나 크리에이티브 센터 활용
    return [];
  }

  /**
   * 모든 플랫폼 통합 검색 (병렬 처리 + 신선도 필터링)
   */
  async searchAllPlatforms(options: AdReferenceSearchOptions): Promise<AdReference[]> {
    const platforms = options.platform ?? ["meta", "google", "naver"];
    const freshnessDays = options.freshnessDays ?? this.DEFAULT_FRESHNESS_DAYS;
    const results: AdReference[] = [];

    // 병렬로 모든 플랫폼 검색
    const promises = platforms.map(async (platform) => {
      switch (platform) {
        case "meta":
          return this.searchMetaAds(options);
        case "google":
          return this.searchGoogleAds(options);
        case "naver":
          return this.searchNaverAds(options);
        case "kakao":
          return this.searchKakaoAds(options);
        default:
          return [];
      }
    });

    const allResults = await Promise.all(promises);
    allResults.forEach((platformResults) => {
      results.push(...platformResults);
    });

    // 신선도 필터링 적용
    const freshAds = this.filterByFreshness(results, freshnessDays);

    // 성과순 정렬 (CTR 높은 순)
    const sortedAds = freshAds.sort((a, b) => {
      const ctrA = a.engagement?.ctr ?? 0;
      const ctrB = b.engagement?.ctr ?? 0;
      return ctrB - ctrA;
    });

    return sortedAds.slice(0, options.limit ?? 20);
  }

  /**
   * 레퍼런스 광고 분석
   */
  analyzeAdCopy(adCopy: string): AdReference["analysis"] {
    const charCount = adCopy.length;

    // 간단한 패턴 기반 분석
    const triggers: string[] = [];

    // 긴급성 키워드
    if (/지금|당장|오늘|자정|마지막/.test(adCopy)) {
      triggers.push("긴급성");
    }

    // 희소성 키워드
    if (/소수|한정|선착순|VIP|독점/.test(adCopy)) {
      triggers.push("희소성");
    }

    // 숫자/구체성
    if (/\d+/.test(adCopy)) {
      triggers.push("구체성");
    }

    // 할인/혜택
    if (/할인|무료|이벤트|특가/.test(adCopy)) {
      triggers.push("가치제공");
    }

    // AIDA 구조 추정
    let formula = "AIDA";
    if (/문제|고민|걱정/.test(adCopy)) {
      formula = "PAS";
    }

    // 톤 추정
    let tone = "neutral";
    if (/당신|귀하/.test(adCopy)) {
      tone = "personal";
    }
    if (/합니다|드립니다/.test(adCopy)) {
      tone = "formal";
    }

    return {
      formula,
      triggers,
      tone,
      charCount,
    };
  }

  /**
   * 레퍼런스를 Few-shot 예시로 변환
   */
  convertToFewShotExamples(references: AdReference[]): Array<{
    input: string;
    output: string;
    analysis: string;
  }> {
    return references.map((ref) => ({
      input: `플랫폼: ${ref.platform}, 카테고리: ${ref.category}`,
      output: ref.adCopy,
      analysis: `공식: ${ref.analysis?.formula ?? "AIDA"}, 트리거: ${ref.analysis?.triggers?.join(", ") ?? "없음"}, 글자수: ${ref.analysis?.charCount ?? 0}자`,
    }));
  }

  /**
   * 의도 기반 유사 광고 검색
   */
  async findSimilarAds(
    intent: IntentData,
    options?: { freshnessDays?: number; limit?: number }
  ): Promise<AdReference[]> {
    const keywords = [
      intent.productName,
      intent.targetAudience,
      ...(intent.keywords ?? []),
    ].filter(Boolean) as string[];

    return this.searchAllPlatforms({
      keywords,
      limit: options?.limit ?? 10,
      freshnessDays: options?.freshnessDays ?? this.DEFAULT_FRESHNESS_DAYS,
    });
  }

  /**
   * 광고 신선도 필터링 (수집된 날짜 기준)
   */
  private filterByFreshness(
    ads: AdReference[],
    freshnessDays: number
  ): AdReference[] {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - freshnessDays);

    return ads.filter((ad) => ad.collectedAt >= cutoffDate);
  }

  /**
   * 카테고리 추론 (더 이상 사용하지 않음, 하위 호환성만 유지)
   * 키워드 기반 검색으로 대체됨
   */
  private inferCategory(productName: string): string {
    // 카테고리 개념 제거됨
    // 키워드만으로 충분히 정확한 검색 가능
    return "general";
  }

  // ==================== 샘플 데이터 (실제 구현 시 제거) ====================

  private getSampleMetaAds(keywords: string[], limit: number): AdReference[] {
    const samples: AdReference[] = [
      {
        id: "meta-1",
        platform: "meta",
        adCopy: "지금 바로 시작하세요! 30대 여성을 위한 프리미엄 스킨케어",
        headline: "특별 할인 이벤트",
        description: "오늘만 50% 할인",
        category: "beauty",
        targetAudience: "30대 여성",
        collectedAt: new Date(),
        engagement: {
          impressions: 15000,
          clicks: 750,
          ctr: 5.0,
        },
        analysis: {
          formula: "AIDA",
          triggers: ["긴급성", "구체성"],
          tone: "casual",
          charCount: 31,
        },
      },
      {
        id: "meta-2",
        platform: "meta",
        adCopy: "소수만 누리는 특별한 혜택. 지금 신청하세요",
        headline: "VIP 한정 특가",
        category: "beauty",
        collectedAt: new Date(),
        analysis: {
          formula: "AIDA",
          triggers: ["희소성", "긴급성"],
          tone: "personal",
          charCount: 25,
        },
      },
    ];

    return samples.slice(0, limit);
  }

  private getSampleNaverAds(keywords: string[], limit: number): AdReference[] {
    const samples: AdReference[] = [
      {
        id: "naver-1",
        platform: "naver",
        adCopy: "피부 고민 해결! 전문가 추천 스킨케어",
        description: "7일 무료 체험, 만족도 98%",
        category: "beauty",
        collectedAt: new Date(),
        analysis: {
          formula: "PAS",
          triggers: ["가치제공", "구체성"],
          tone: "professional",
          charCount: 21,
        },
      },
      {
        id: "naver-2",
        platform: "naver",
        adCopy: "오늘만 특가! 30% 할인된 가격으로 만나보세요",
        category: "beauty",
        collectedAt: new Date(),
        analysis: {
          formula: "AIDA",
          triggers: ["긴급성", "가치제공"],
          tone: "casual",
          charCount: 25,
        },
      },
    ];

    return samples.slice(0, limit);
  }

  private getSampleGoogleAds(keywords: string[], limit: number): AdReference[] {
    const samples: AdReference[] = [
      {
        id: "google-1",
        platform: "google",
        adCopy: "프리미엄 스킨케어 - 30대 피부 전문",
        description: "임상 테스트 완료. 무료 배송",
        category: "beauty",
        collectedAt: new Date(),
        analysis: {
          formula: "FAB",
          triggers: ["전문성", "가치제공"],
          tone: "professional",
          charCount: 21,
        },
      },
      {
        id: "google-2",
        platform: "google",
        adCopy: "지금 주문하면 내일 도착 | 당일 발송",
        category: "beauty",
        collectedAt: new Date(),
        analysis: {
          formula: "AIDA",
          triggers: ["즉각만족", "긴급성"],
          tone: "casual",
          charCount: 22,
        },
      },
    ];

    return samples.slice(0, limit);
  }
}

