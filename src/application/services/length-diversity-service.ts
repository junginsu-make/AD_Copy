import type { IntentData } from "./intent-extraction-service";

/**
 * 길이 다양성 관리 서비스
 * 사용자 의도에 따라 다양한 길이의 카피를 생성하도록 요청 분할
 */
export class LengthDiversityService {
  /**
   * 의도에 따라 길이별 생성 요청 분할
   */
  calculateLengthRequests(intent: IntentData, totalCount: number): LengthRequest[] {
    const variety = intent.lengthVariety ?? "mixed";
    
    // 사용자가 명시적으로 길이 선호도를 지정한 경우
    if (intent.lengthPreferences) {
      return this.fromExplicitPreferences(intent.lengthPreferences);
    }
    
    // lengthVariety에 따라 자동 분배
    switch (variety) {
      case "short-only":
        return [{ category: "short", minChars: 15, maxChars: 30, count: totalCount }];
      
      case "medium-only":
        return [{ category: "medium", minChars: 30, maxChars: 60, count: totalCount }];
      
      case "long-only":
        return [{ category: "long", minChars: 60, maxChars: 100, count: totalCount }];
      
      case "mixed":
      default:
        return this.createMixedDistribution(totalCount);
    }
  }
  
  /**
   * 명시적 선호도로부터 요청 생성
   */
  private fromExplicitPreferences(prefs: {
    short?: number;
    medium?: number;
    long?: number;
  }): LengthRequest[] {
    const requests: LengthRequest[] = [];
    
    if (prefs.short && prefs.short > 0) {
      requests.push({
        category: "short",
        minChars: 15,
        maxChars: 30,
        count: prefs.short,
      });
    }
    
    if (prefs.medium && prefs.medium > 0) {
      requests.push({
        category: "medium",
        minChars: 30,
        maxChars: 60,
        count: prefs.medium,
      });
    }
    
    if (prefs.long && prefs.long > 0) {
      requests.push({
        category: "long",
        minChars: 60,
        maxChars: 100,
        count: prefs.long,
      });
    }
    
    return requests;
  }
  
  /**
   * 혼합 분배 (짧은/중간/긴 골고루)
   */
  private createMixedDistribution(totalCount: number): LengthRequest[] {
    if (totalCount <= 3) {
      // 3개 이하: 짧은 1, 중간 1, 긴 1
      return [
        { category: "short", minChars: 15, maxChars: 30, count: 1 },
        { category: "medium", minChars: 30, maxChars: 60, count: 1 },
        { category: "long", minChars: 60, maxChars: 100, count: 1 },
      ].slice(0, totalCount);
    }
    
    // 4개 이상: 비율 분배
    const shortCount = Math.ceil(totalCount * 0.3);   // 30%
    const mediumCount = Math.ceil(totalCount * 0.4);  // 40%
    const longCount = totalCount - shortCount - mediumCount; // 나머지
    
    const requests: LengthRequest[] = [];
    
    if (shortCount > 0) {
      requests.push({ category: "short", minChars: 15, maxChars: 30, count: shortCount });
    }
    
    if (mediumCount > 0) {
      requests.push({ category: "medium", minChars: 30, maxChars: 60, count: mediumCount });
    }
    
    if (longCount > 0) {
      requests.push({ category: "long", minChars: 60, maxChars: 100, count: longCount });
    }
    
    return requests;
  }
  
  /**
   * 채널별 추천 길이 반환
   */
  getRecommendedChannel(charCount: number): string {
    if (charCount <= 30) {
      return "SNS (인스타그램, 트위터, 해시태그)";
    } else if (charCount <= 60) {
      return "배너 광고, 검색 광고, 페이스북";
    } else if (charCount <= 100) {
      return "블로그 제목, 뉴스레터, 카카오톡";
    } else {
      return "상세 페이지, 이메일 본문, 랜딩페이지";
    }
  }
}

export interface LengthRequest {
  category: "short" | "medium" | "long";
  minChars: number;
  maxChars: number;
  count: number;
}

