// Meta 광고 라이브러리 스크래퍼
// https://www.facebook.com/ads/library/ 활용

import type { AdReference } from "@/src/application/services/ad-reference-service";

export interface MetaAdLibrarySearchParams {
  keywords: string;
  country?: string; // 기본: KR
  adType?: "all" | "political" | "housing" | "employment" | "credit";
  activeStatus?: "active" | "inactive" | "all";
  limit?: number;
}

export class MetaAdScraper {
  private readonly baseUrl = "https://www.facebook.com/ads/library/";

  /**
   * Meta 광고 라이브러리 검색
   * 
   * 방법 1: Firecrawl MCP 사용 (권장)
   * 방법 2: 브라우저 자동화 (Puppeteer 등)
   * 방법 3: Meta Ad Library API (정치 광고만 제한적)
   */
  async search(params: MetaAdLibrarySearchParams): Promise<AdReference[]> {
    const url = this.buildSearchUrl(params);

    try {
      // Firecrawl MCP를 사용한 스크래핑
      // 실제 구현 시 아래 주석 해제
      /*
      const scrapedData = await mcp_firecrawl_scrape({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
        waitFor: 3000 // 광고 로딩 대기
      });

      return this.parseAdLibraryPage(scrapedData.markdown, params.limit ?? 10);
      */

      // 임시: 샘플 데이터 반환
      return this.getSampleData(params.keywords, params.limit ?? 10);
    } catch (error) {
      console.error("Meta 광고 수집 실패:", error);
      return [];
    }
  }

  /**
   * 검색 URL 생성
   */
  private buildSearchUrl(params: MetaAdLibrarySearchParams): string {
    const searchParams = new URLSearchParams({
      active_status: params.activeStatus ?? "active",
      ad_type: params.adType ?? "all",
      country: params.country ?? "KR",
      media_type: "all",
      search_type: "keyword_unordered",
      q: params.keywords,
    });

    return `${this.baseUrl}?${searchParams.toString()}`;
  }

  /**
   * 광고 라이브러리 페이지 파싱
   */
  private parseAdLibraryPage(markdown: string, limit: number): AdReference[] {
    const ads: AdReference[] = [];

    // 마크다운에서 광고 정보 추출
    // Meta Ad Library 구조:
    // - 광고 제목 (h3 또는 strong)
    // - 광고 설명 (p)
    // - 이미지 URL
    // - 게시 기간

    // 정규식 패턴 예시
    const adPattern = /\*\*(.+?)\*\*\s*\n(.+?)\n/g;
    let match;

    while ((match = adPattern.exec(markdown)) !== null && ads.length < limit) {
      const headline = match[1];
      const description = match[2];
      const fullCopy = `${headline} ${description}`;

      ads.push({
        id: `meta-${Date.now()}-${ads.length}`,
        platform: "meta",
        adCopy: fullCopy,
        headline,
        description,
        category: "beauty", // 카테고리 추론 필요
        collectedAt: new Date(),
        analysis: this.analyzeAdCopy(fullCopy),
      });
    }

    return ads;
  }

  /**
   * 광고 카피 간단 분석
   */
  private analyzeAdCopy(adCopy: string): AdReference["analysis"] {
    const charCount = adCopy.length;
    const triggers: string[] = [];

    if (/지금|당장|오늘|자정/.test(adCopy)) triggers.push("긴급성");
    if (/소수|한정|VIP/.test(adCopy)) triggers.push("희소성");
    if (/\d+%/.test(adCopy)) triggers.push("구체성");
    if (/무료|할인/.test(adCopy)) triggers.push("가치제공");

    let formula = "AIDA";
    if (/문제|고민/.test(adCopy)) formula = "PAS";
    if (/이전|이후/.test(adCopy)) formula = "BAB";

    return {
      formula,
      triggers,
      tone: /당신/.test(adCopy) ? "personal" : "neutral",
      charCount,
    };
  }

  /**
   * 샘플 데이터 (개발/테스트용)
   */
  private getSampleData(keywords: string, limit: number): AdReference[] {
    return [
      {
        id: "meta-sample-1",
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
          triggers: ["긴급성", "구체성", "소유감"],
          tone: "personal",
          charCount: 31,
        },
      },
      {
        id: "meta-sample-2",
        platform: "meta",
        adCopy: "소수만 누리는 특별한 혜택. 지금 신청하세요",
        headline: "VIP 한정 특가",
        description: "선착순 100명",
        category: "beauty",
        collectedAt: new Date(),
        engagement: {
          impressions: 12000,
          clicks: 480,
          ctr: 4.0,
        },
        analysis: {
          formula: "AIDA",
          triggers: ["희소성", "긴급성"],
          tone: "casual",
          charCount: 25,
        },
      },
      {
        id: "meta-sample-3",
        platform: "meta",
        adCopy: "97% 고객이 만족한 피부 솔루션. 7일 무료 체험",
        headline: "고객 만족도 1위",
        category: "beauty",
        collectedAt: new Date(),
        engagement: {
          impressions: 20000,
          clicks: 1000,
          ctr: 5.0,
        },
        analysis: {
          formula: "FAB",
          triggers: ["사회적증명", "구체성", "가치제공"],
          tone: "professional",
          charCount: 28,
        },
      },
    ].slice(0, limit);
  }
}

