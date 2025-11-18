/**
 * Perplexity API를 활용한 광고 레퍼런스 수집 서비스
 * 최신 광고 트렌드 및 실제 광고 문구를 실시간으로 검색
 */

import type { AdReference } from "./production-ad-reference-service";

export interface PerplexitySearchOptions {
  keywords?: string[];
  limit?: number;
  freshnessDays?: number;
  targetPlatform?: "naver" | "google" | "kakao" | "all";
}

export class PerplexityAdReferenceService {
  private readonly apiKey: string;
  private readonly baseUrl = "https://api.perplexity.ai/chat/completions";
  
  // Perplexity 모델 선택
  private readonly model = "sonar"; // sonar (빠름) 또는 sonar-pro (정확함)
  
  constructor() {
    const key = process.env.PERPLEXITY_API_KEY;
    if (!key || !key.trim()) {
      throw new Error("PERPLEXITY_API_KEY 환경변수가 설정되지 않았습니다.");
    }
    this.apiKey = key.trim();
  }

  /**
   * 키워드 기반 광고 레퍼런스 검색
   */
  async searchAdReferences(options: PerplexitySearchOptions): Promise<AdReference[]> {
    const { keywords = [], limit = 10, freshnessDays = 90, targetPlatform = "all" } = options;
    
    if (keywords.length === 0) {
      console.warn("Perplexity: 키워드가 없어 검색을 건너뜁니다.");
      return [];
    }
    
    console.log(`\nPerplexity 광고 레퍼런스 검색 시작`);
    console.log(`  - 키워드: ${keywords.join(", ")}`);
    console.log(`  - 제한: ${limit}개`);
    console.log(`  - 플랫폼: ${targetPlatform}`);
    
    try {
      // Perplexity 검색 쿼리 생성
      const searchQuery = this.buildSearchQuery(keywords, targetPlatform, freshnessDays);
      
      // Perplexity API 호출 (개선: return_citations, search_recency_filter 추가)
      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: "system",
              content: "당신은 광고 마케팅 전문 검색 어시스턴트입니다. 2024-2025년 기준 최근 1년간의 실제 광고 데이터만 수집하여 제공하세요. 항상 출처를 명시하고 신뢰할 수 있는 정보만 제공합니다. 광고 제목과 본문을 명확히 구분하여 상세하게 제공해주세요."
            },
            {
              role: "user",
              content: searchQuery
            }
          ],
          temperature: 0.2,
          max_tokens: 4000,
          return_citations: true,  // 출처 정보 반환 (중요!)
          search_recency_filter: "year",  // 최근 1년 데이터
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Perplexity API 오류 (${response.status}):`, errorText);
        return [];
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      
      if (!content) {
        console.warn("Perplexity: 응답 내용이 비어있습니다.");
        return [];
      }
      
      console.log(`Perplexity 응답 수신: ${content.length}자`);
      
      // 응답 파싱하여 AdReference 배열로 변환
      const adReferences = this.parsePerplexityResponse(content, targetPlatform);
      
      console.log(`Perplexity: ${adReferences.length}개 광고 추출 완료`);
      
      // 제한 개수만큼 반환
      return adReferences.slice(0, limit);
      
    } catch (error: any) {
      console.error("Perplexity 광고 검색 실패:", {
        message: error.message,
        keywords: keywords.join(", ")
      });
      return [];
    }
  }

  /**
   * Perplexity 검색 쿼리 생성
   */
  private buildSearchQuery(
    keywords: string[], 
    platform: string, 
    freshnessDays: number
  ): string {
    const keywordText = keywords.join(", ");
    const platformText = platform === "all" 
      ? "네이버, 구글, 카카오, 메타" 
      : platform === "naver" 
        ? "네이버" 
        : platform === "google" 
          ? "구글" 
          : "카카오";
    
    // Perplexity 독립 검색 쿼리 (네이버/구글이 아닌 독립적인 광고 트렌드)
    return `'${keywordText}'와 관련된 최신 광고 카피와 마케팅 트렌드를 조사해주세요:

다음 정보를 수집해주세요:

1. 최신 광고 카피 사례 TOP 20
   - 2024-2025년 최근 1년간 효과적이었던 광고
   - 성공적인 마케팅 캠페인 사례
   - 바이럴된 광고 문구
   - SNS에서 화제가 된 광고

2. 광고 문구 예시 (각 광고마다 다음 형식으로)
   ━━━━━━━━━━━━━━━
   광고 1:
   제목: [광고 제목 또는 헤드라인]
   본문: [광고 본문 또는 설명]
   출처: [출처 URL 또는 브랜드명]
   ━━━━━━━━━━━━━━━
   광고 2:
   제목: [광고 제목]
   본문: [광고 본문]
   출처: [출처 URL 또는 브랜드명]
   ━━━━━━━━━━━━━━━
   (최소 15개 이상 계속...)

요구사항:
- ${keywordText}와 직접 관련된 광고
- 실제로 사용된 광고 카피
- 효과적이고 창의적인 문구
- 최소 15개 이상의 광고 예시
- 구체적이고 실용적인 광고 문구
- 한국어 광고 우선
- 브랜드명이나 캠페인명 포함`;
  }

  /**
   * Perplexity 응답 파싱
   */
  private parsePerplexityResponse(content: string, targetPlatform: string): AdReference[] {
    const ads: AdReference[] = [];
    
    console.log(`Perplexity 응답 수신: ${content.length}자`);
    
    try {
      // 방법 1: 새로운 구분자 파싱 (━━━━━━ 형식) - 우선 시도
      const newSections = content.split(/━{5,}/);
      
      if (newSections.length > 2) {
        console.log(`Perplexity: 새 형식 감지, ${newSections.length}개 섹션 파싱 시도...`);
        
        for (const section of newSections) {
          if (section.trim().length < 10) continue;
          
          // "광고 N:" 형태 찾기
          if (!section.match(/광고\s*\d+/i)) continue;
          
          // 제목 추출
          const titleMatch = section.match(/제목[:\s]+(.+?)(?:\n|본문)/i);
          const headline = titleMatch ? titleMatch[1].trim().replace(/\[|\]/g, '') : "";
          
          // 본문 추출
          const bodyMatch = section.match(/본문[:\s]+(.+?)(?:\n|플랫폼|━|$)/is);
          const description = bodyMatch ? bodyMatch[1].trim().replace(/\[|\]/g, '') : "";
          
          // 플랫폼 추출
          const platformMatch = section.match(/플랫폼[:\s]+(naver|google|meta|kakao)/i);
          const platform = platformMatch ? platformMatch[1].toLowerCase() : targetPlatform;
          
          // URL 추출
          const urlMatch = section.match(/(?:URL|url|출처)[:\s]+(https?:\/\/[^\s]+)/i);
          const url = urlMatch ? urlMatch[1] : undefined;
          
          if (headline && headline.length >= 5) {
            const adCopy = description ? `${headline} ${description}` : headline;
            
            ads.push({
              id: `perplexity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              platform: this.normalizePlatform(platform),
              adCopy: adCopy.substring(0, 300),
              headline: headline.substring(0, 100),
              description: description ? description.substring(0, 200) : undefined,
              url,
              category: "Perplexity 검색",
              collectedAt: new Date(),
              analysis: {
                charCount: adCopy.length,
                triggers: this.extractTriggers(adCopy),
                tone: this.analyzeTone(adCopy),
              }
            });
          }
        }
        
        if (ads.length > 0) {
          console.log(`Perplexity: 새 형식 파싱 성공, ${ads.length}개 광고 추출`);
          return ads;
        }
      }
      
      // 방법 2: JSON 추출 시도
      const jsonMatch = content.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/) || 
                       content.match(/(\[[\s\S]*?\])/);
      
      if (jsonMatch) {
        console.log("Perplexity: JSON 형식 감지, 파싱 시도...");
        
        try {
          const jsonData = JSON.parse(jsonMatch[1]);
          
          if (Array.isArray(jsonData)) {
            console.log(`Perplexity: JSON 파싱 성공, ${jsonData.length}개 항목 발견`);
            
            for (const item of jsonData) {
              if (typeof item === 'object' && item !== null && item.headline) {
                const adCopy = item.description 
                  ? `${item.headline} ${item.description}` 
                  : item.headline;
                
                ads.push({
                  id: `perplexity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  platform: this.normalizePlatform(item.platform || targetPlatform),
                  adCopy: adCopy.substring(0, 300),
                  headline: item.headline.substring(0, 100),
                  description: item.description?.substring(0, 200),
                  url: item.url,
                  category: "Perplexity 검색",
                  collectedAt: new Date(),
                  analysis: {
                    charCount: adCopy.length,
                    triggers: this.extractTriggers(adCopy),
                    tone: this.analyzeTone(adCopy)
                  }
                });
              }
            }
            
            console.log(`Perplexity: 최종 ${ads.length}개 광고 추출 완료`);
            return ads;
          }
        } catch (jsonError) {
          console.warn("Perplexity: JSON 파싱 실패, 대체 방법 시도...");
        }
      }
      
      // 방법 3: 기존 구분자 파싱 (--- 형식)
      const sections = content.split(/---+/).filter(s => s.trim().length > 0);
      
      console.log(`Perplexity 파싱: ${sections.length}개 섹션 발견`);
      
      for (const section of sections) {
        const ad = this.parseAdSection(section.trim(), targetPlatform);
        if (ad) {
          ads.push(ad);
        }
      }
      
      // 방법 4: 여전히 실패한 경우 폴백 파싱
      if (ads.length === 0) {
        console.log("Perplexity: 구분자 파싱 실패, 대체 파싱 시도...");
        return this.parseFallback(content, targetPlatform);
      }
      
    } catch (error) {
      console.error("Perplexity 응답 파싱 오류:", error);
      return this.parseFallback(content, targetPlatform);
    }
    
    return ads;
  }
  
  /**
   * 플랫폼 이름 정규화
   */
  private normalizePlatform(platform: string): AdReference["platform"] {
    const normalized = platform.toLowerCase();
    if (normalized.includes("google") || normalized.includes("구글")) return "google";
    if (normalized.includes("kakao") || normalized.includes("카카오")) return "kakao";
    if (normalized.includes("meta") || normalized.includes("facebook") || 
        normalized.includes("instagram") || normalized.includes("페이스북")) return "meta";
    return "naver";
  }

  /**
   * 개별 광고 섹션 파싱
   */
  private parseAdSection(section: string, defaultPlatform: string): AdReference | null {
    try {
      // 필드 추출
      const titleMatch = section.match(/제목[:：]\s*(.+?)(?:\n|$)/i);
      const descMatch = section.match(/설명[:：]\s*(.+?)(?:\n|$)/i);
      const platformMatch = section.match(/플랫폼[:：]\s*(.+?)(?:\n|$)/i);
      const urlMatch = section.match(/URL[:：]\s*(.+?)(?:\n|$)/i);
      
      const headline = titleMatch?.[1]?.trim();
      const description = descMatch?.[1]?.trim();
      const platformText = platformMatch?.[1]?.trim().toLowerCase() || defaultPlatform;
      const url = urlMatch?.[1]?.trim();
      
      // 제목이 없으면 무효
      if (!headline || headline.length < 5) {
        return null;
      }
      
      // 플랫폼 매핑
      let platform: AdReference["platform"] = "naver";
      if (platformText.includes("google") || platformText.includes("구글")) {
        platform = "google";
      } else if (platformText.includes("kakao") || platformText.includes("카카오")) {
        platform = "kakao";
      } else if (platformText.includes("meta") || platformText.includes("facebook") || 
                 platformText.includes("instagram") || platformText.includes("페이스북")) {
        platform = "meta";
      }
      
      const adCopy = description ? `${headline}. ${description}` : headline;
      
      return {
        id: `perplexity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        platform,
        adCopy: adCopy.substring(0, 300),
        headline: headline.substring(0, 100),
        description: description?.substring(0, 200),
        url: url,
        category: "Perplexity 검색",
        collectedAt: new Date(),
        analysis: {
          charCount: adCopy.length,
          triggers: this.extractTriggers(adCopy),
          tone: this.analyzeTone(adCopy)
        }
      };
      
    } catch (error) {
      console.warn("섹션 파싱 실패:", section.substring(0, 50));
      return null;
    }
  }

  /**
   * 폴백 파싱: 구조화되지 않은 텍스트에서 광고 추출
   */
  private parseFallback(content: string, defaultPlatform: string): AdReference[] {
    const ads: AdReference[] = [];
    
    try {
      // 줄 단위로 분리
      const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 10);
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // 광고성 키워드가 포함된 줄 찾기
        if (this.looksLikeAd(line)) {
          // 다음 줄을 설명으로 사용 (선택적)
          const description = i + 1 < lines.length ? lines[i + 1] : "";
          
          const adCopy = description && description.length > 10 
            ? `${line}. ${description}` 
            : line;
          
          ads.push({
            id: `perplexity-fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            platform: defaultPlatform as AdReference["platform"],
            adCopy: adCopy.substring(0, 300),
            headline: line.substring(0, 100),
            description: description?.substring(0, 200),
            category: "Perplexity 검색",
            collectedAt: new Date(),
            analysis: {
              charCount: adCopy.length,
              triggers: this.extractTriggers(adCopy),
              tone: this.analyzeTone(adCopy)
            }
          });
          
          // 최대 20개까지만
          if (ads.length >= 20) break;
        }
      }
      
    } catch (error) {
      console.error("Perplexity 폴백 파싱 실패:", error);
    }
    
    return ads;
  }

  /**
   * 텍스트가 광고처럼 보이는지 판단
   */
  private looksLikeAd(text: string): boolean {
    // 너무 짧거나 긴 텍스트 제외
    if (text.length < 10 || text.length > 200) return false;
    
    // 광고성 키워드 체크
    const adKeywords = [
      '할인', '세일', '이벤트', '무료', '증정', '특가', '프로모션',
      '배송', '구매', '오픈', '런칭', '신제품', 'NEW', '베스트',
      '인기', '추천', '최저가', '파격', '한정', '품절임박'
    ];
    
    const lowerText = text.toLowerCase();
    
    // 최소 1개 이상의 광고 키워드 포함
    const hasAdKeyword = adKeywords.some(kw => lowerText.includes(kw.toLowerCase()));
    
    // 숫자나 가격 정보 포함
    const hasNumber = /\d/.test(text);
    
    // 느낌표나 강조 포함
    const hasEmphasis = text.includes('!') || text.includes('★') || text.includes('♥');
    
    // 광고 키워드가 있거나, (숫자 + 강조)가 있으면 광고로 판단
    return hasAdKeyword || (hasNumber && hasEmphasis);
  }

  /**
   * 심리적 트리거 추출
   */
  private extractTriggers(text: string): string[] {
    const triggers: string[] = [];
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('할인') || lowerText.includes('세일')) triggers.push('할인');
    if (lowerText.includes('무료') || lowerText.includes('공짜')) triggers.push('무료');
    if (lowerText.includes('한정') || lowerText.includes('품절')) triggers.push('희소성');
    if (lowerText.includes('인기') || lowerText.includes('베스트')) triggers.push('사회적증명');
    if (lowerText.includes('신제품') || lowerText.includes('new')) triggers.push('새로움');
    if (lowerText.includes('보장') || lowerText.includes('환불')) triggers.push('보장');
    if (lowerText.includes('긴급') || lowerText.includes('마감')) triggers.push('긴급성');
    if (lowerText.includes('%') || lowerText.includes('원')) triggers.push('가격');
    
    return triggers;
  }

  /**
   * 톤 분석
   */
  private analyzeTone(text: string): string {
    const lowerText = text.toLowerCase();
    
    if (text.includes('!') || lowerText.includes('지금') || lowerText.includes('긴급')) {
      return "urgent";
    }
    if (text.includes('♥') || lowerText.includes('사랑') || lowerText.includes('감성')) {
      return "emotional";
    }
    if (text.includes('%') || text.includes('원') || lowerText.includes('할인')) {
      return "promotional";
    }
    if (lowerText.includes('프리미엄') || lowerText.includes('명품') || lowerText.includes('럭셔리')) {
      return "premium";
    }
    if (lowerText.includes('친근') || lowerText.includes('편안')) {
      return "casual";
    }
    
    return "neutral";
  }

  /**
   * API 키 유효성 체크
   */
  isConfigured(): boolean {
    return !!this.apiKey && this.apiKey.length > 0;
  }
}

