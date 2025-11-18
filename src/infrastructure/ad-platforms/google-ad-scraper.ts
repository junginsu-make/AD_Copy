// Google Ads 스크래퍼
// Google 검색 결과에서 광고 수집

import type { AdReference } from "@/src/application/services/ad-reference-service";

export interface GoogleAdSearchParams {
  keywords: string;
  location?: string; // 기본: kr
  language?: string; // 기본: ko
  limit?: number;
}

export class GoogleAdScraper {
  private readonly searchUrl = "https://www.google.com/search";

  /**
   * Google 검색 결과에서 광고 수집
   */
  async search(params: GoogleAdSearchParams): Promise<AdReference[]> {
    const url = this.buildSearchUrl(params);

    try {
      // 실제 Google 검색 시도
      if (process.env.USE_REAL_SCRAPING === 'true' && process.env.FIRECRAWL_API_KEY) {
        try {
          // Firecrawl API 직접 호출
          const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`
            },
            body: JSON.stringify({
              url,
              formats: ['markdown'],
              onlyMainContent: false,  // 전체 페이지 수집
              waitFor: 3000,  // 광고 로드 대기
              actions: [
                { type: 'scroll', direction: 'down' },  // 스크롤로 추가 광고 로드
                { type: 'wait', milliseconds: 1000 }
              ]
            })
          });

          if (response.ok) {
            const data = await response.json();
            const markdown = data.data?.markdown || '';
            const parsedAds = this.parseGoogleAdsFromMarkdown(markdown, params.limit ?? 10);
            
            if (parsedAds.length > 0) {
              console.log(`Google 광고: 실제 수집 성공 - ${parsedAds.length}개`);
              return parsedAds;
            }
          }
        } catch (scrapeError) {
          console.warn("Google 실시간 스크래핑 실패, 샘플 데이터로 폴백:", scrapeError);
        }
      }

      // 폴백: 확장된 샘플 데이터
      return this.getEnhancedSampleData(params.keywords, params.limit ?? 10);
    } catch (error) {
      console.error("Google 광고 수집 실패:", error);
      return [];
    }
  }

  /**
   * 검색 URL 생성
   */
  private buildSearchUrl(params: GoogleAdSearchParams): string {
    const searchParams = new URLSearchParams({
      q: params.keywords,
      gl: params.location ?? "kr",
      hl: params.language ?? "ko",
    });

    return `${this.searchUrl}?${searchParams.toString()}`;
  }

  /**
   * Markdown에서 Google 광고 파싱
   */
  private parseGoogleAdsFromMarkdown(markdown: string, limit: number): AdReference[] {
    const ads: AdReference[] = [];
    
    // Google 광고 패턴 (마크다운에서)
    // 1. "광고" 레이블 찾기
    // 2. 제목과 설명 추출
    
    // 정규식 패턴들 (완화된 기준)
    const adPatterns = [
      /### ([^\n]+)\n([^\n]+(?:\n[^#][^\n]+)*)/g,  // 헤더와 내용
      /\*\*([^*]+)\*\*[\s\n]+([^\n]+)/g,           // 볼드 텍스트와 설명
      /\[([^\]]+)\]\([^)]+\)[\s\n]+([^\n]+)/g,    // 링크와 설명
      /광고[\s\S]{0,50}?([^\n]{10,100})/g,         // "광고" 키워드 근처 텍스트
    ];

    // 모든 패턴 시도
    for (const pattern of adPatterns) {
      let match;
      while ((match = pattern.exec(markdown)) !== null && ads.length < limit * 2) {
        const headline = match[1]?.trim();
        const description = match[2]?.trim() || '';
        
        // 기본 필터링 (매우 완화)
        if (headline && headline.length >= 5 && headline.length <= 100) {
          // UI 요소 제외 (최소한만)
          const isUIElement = /^(메뉴|로그인|도움말|Skip|About|Cookie)$/i.test(headline);
          
          if (!isUIElement) {
            ads.push({
              id: `google-${Date.now()}-${ads.length}`,
              platform: "google",
              adCopy: `${headline} ${description}`.substring(0, 100),
              headline,
              description: description.substring(0, 90),
              category: "general",
              collectedAt: new Date(),
              analysis: this.analyzeAdCopy(`${headline} ${description}`),
            });
          }
        }
      }
    }

    // 중복 제거
    const uniqueAds = this.removeDuplicates(ads);
    
    console.log(`Google 마크다운 파싱: ${uniqueAds.length}개 추가 추출`);
    return uniqueAds.slice(0, limit);
  }

  /**
   * 중복 광고 제거
   */
  private removeDuplicates(ads: AdReference[]): AdReference[] {
    const seen = new Set<string>();
    return ads.filter(ad => {
      const key = ad.headline.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * 광고 카피 분석
   */
  private analyzeAdCopy(adCopy: string): AdReference["analysis"] {
    const charCount = adCopy.length;
    const triggers: string[] = [];

    if (/지금|당장|빠른/.test(adCopy)) triggers.push("긴급성");
    if (/무료|할인|\d+%/.test(adCopy)) triggers.push("가치제공");
    if (/1위|최고|전문/.test(adCopy)) triggers.push("권위");
    if (/\d+/.test(adCopy)) triggers.push("구체성");

    return {
      formula: "AIDA",
      triggers,
      tone: "professional",
      charCount,
    };
  }

  /**
   * 확장된 샘플 데이터 (다양한 카테고리)
   */
  private getEnhancedSampleData(keywords: string, limit: number): AdReference[] {
    // 키워드 기반 다양한 샘플
    const keywordLower = keywords.toLowerCase();
    let samples: AdReference[];
    
    if (keywordLower.includes('it') || keywordLower.includes('기술') || keywordLower.includes('소프트웨어')) {
      samples = this.getITSamples();
    } else if (keywordLower.includes('패션') || keywordLower.includes('의류')) {
      samples = this.getFashionSamples();
    } else if (keywordLower.includes('음식') || keywordLower.includes('레스토랑')) {
      samples = this.getFoodSamples();
    } else {
      samples = this.getGeneralSamples();
    }
    
    return samples.slice(0, limit);
  }
  
  private getITSamples(): AdReference[] {
    return [
      {
        id: "google-it-1",
        platform: "google",
        adCopy: "혁신적인 AI 솔루션 | 비즈니스 성장 3배 보장",
        headline: "혁신적인 AI 솔루션",
        description: "비즈니스 성장 3배 보장. 무료 컨설팅. 지금 신청하세요",
        category: "tech",
        collectedAt: new Date(),
        engagement: { impressions: 10000, clicks: 500, ctr: 5.0 },
        analysis: {
          formula: "FAB",
          triggers: ["구체성", "가치제공", "긴급성"],
          tone: "professional",
          charCount: 32,
        },
      },
      {
        id: "google-it-2",
        platform: "google",
        adCopy: "클라우드 전환 전문가 | 90% 비용 절감 성공 사례",
        headline: "클라우드 전환 전문가",
        description: "90% 비용 절감 성공. 대기업 500개사 신뢰. 무료 상담",
        category: "tech",
        collectedAt: new Date(),
        engagement: { impressions: 8000, clicks: 400, ctr: 5.0 },
        analysis: {
          formula: "AIDA",
          triggers: ["숫자/데이터", "사회적증명", "전문성"],
          tone: "professional",
          charCount: 30,
        },
      },
    ];
  }
  
  private getFashionSamples(): AdReference[] {
    return [
      {
        id: "google-fashion-1",
        platform: "google",
        adCopy: "신상 콜렉션 50% 할인 | 오늘만 특가",
        headline: "신상 콜렉션 50% 할인",
        description: "오늘만 특가. 무료배송. 한정수량",
        category: "fashion",
        collectedAt: new Date(),
        engagement: { impressions: 12000, clicks: 720, ctr: 6.0 },
        analysis: {
          formula: "AIDA",
          triggers: ["긴급성", "가치제공", "희소성"],
          tone: "urgent",
          charCount: 25,
        },
      },
    ];
  }
  
  private getFoodSamples(): AdReference[] {
    return [
      {
        id: "google-food-1",
        platform: "google",
        adCopy: "오늘 주문하면 내일 도착 | 신선한 재료로 만든",
        headline: "오늘 주문하면 내일 도착",
        description: "신선한 재료. 전문 셰프 조리. 만족보장",
        category: "food",
        collectedAt: new Date(),
        engagement: { impressions: 9000, clicks: 450, ctr: 5.0 },
        analysis: {
          formula: "FAB",
          triggers: ["즉각만족", "품질보장", "전문성"],
          tone: "friendly",
          charCount: 28,
        },
      },
    ];
  }
  
  private getGeneralSamples(): AdReference[] {
    return [
      {
        id: "google-sample-1",
        platform: "google",
        adCopy: "프리미엄 스킨케어 - 30대 피부 전문 | 임상테스트 완료",
        headline: "프리미엄 스킨케어 - 30대 피부 전문",
        description: "임상 테스트 완료. 피부과 전문의 추천. 무료 배송 이벤트",
        category: "beauty",
        collectedAt: new Date(),
        engagement: {
          impressions: 5000,
          clicks: 200,
          ctr: 4.0,
        },
        analysis: {
          formula: "FAB",
          triggers: ["전문성", "가치제공"],
          tone: "professional",
          charCount: 21,
        },
      },
      {
        id: "google-sample-2",
        platform: "google",
        adCopy: "지금 주문하면 내일 도착 | 당일 발송",
        headline: "지금 주문하면 내일 도착",
        description: "당일 발송. 빠른 배송으로 내일 받아보세요",
        category: "beauty",
        collectedAt: new Date(),
        engagement: {
          impressions: 6000,
          clicks: 270,
          ctr: 4.5,
        },
        analysis: {
          formula: "AIDA",
          triggers: ["즉각만족", "긴급성"],
          tone: "casual",
          charCount: 22,
        },
      },
      {
        id: "google-sample-3",
        platform: "google",
        adCopy: "고객 만족도 98% | 7일 무료 체험 가능",
        headline: "고객 만족도 98%",
        description: "7일 무료 체험. 마음에 안 들면 100% 환불",
        category: "beauty",
        collectedAt: new Date(),
        engagement: {
          impressions: 8000,
          clicks: 360,
          ctr: 4.5,
        },
        analysis: {
          formula: "FAB",
          triggers: ["사회적증명", "구체성", "리스크감소"],
          tone: "professional",
          charCount: 23,
        },
      },
    ].slice(0, limit);
  }

  /**
   * Google Ads 특화 분석
   */
  analyzeGoogleAdFormat(adCopy: string): {
    isCompliant: boolean;
    headlineLength: number;
    descriptionLength: number;
    recommendations: string[];
  } {
    const recommendations: string[] = [];

    // Google Ads 제한사항
    const MAX_HEADLINE = 30; // 한글 기준
    const MAX_DESCRIPTION = 90;

    const lines = adCopy.split("|").map((l) => l.trim());
    const headlineLength = lines[0]?.length ?? 0;
    const descriptionLength = lines[1]?.length ?? 0;

    if (headlineLength > MAX_HEADLINE) {
      recommendations.push(`헤드라인이 너무 깁니다 (${headlineLength}자 > ${MAX_HEADLINE}자)`);
    }

    if (descriptionLength > MAX_DESCRIPTION) {
      recommendations.push(`설명이 너무 깁니다 (${descriptionLength}자 > ${MAX_DESCRIPTION}자)`);
    }

    return {
      isCompliant: recommendations.length === 0,
      headlineLength,
      descriptionLength,
      recommendations,
    };
  }
}

