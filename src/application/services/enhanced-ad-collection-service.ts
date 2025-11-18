/**
 * 향상된 광고 수집 서비스
 * 퍼플렉시티 API를 활용한 실시간 멀티플랫폼 광고 수집
 * 
 * 핵심 기능:
 * 1. 실행할 때마다 충분한 광고 수집 (플랫폼별 20-30개)
 * 2. 네이버, 구글, 메타, 카카오 각각 수집
 * 3. 자동으로 슈퍼베이스에 저장
 * 4. 중복 제거 및 품질 검증
 */

import { db } from "@/src/infrastructure/database/db";
import { adReferences, adCollectionStats } from "@/src/infrastructure/database/schema";
import { eq, and, sql } from "drizzle-orm";

// 퍼플렉시티 API 타입
interface PerplexityMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface PerplexityAdResult {
  platform: string;
  adCopy: string;
  headline?: string;
  description?: string;
  brand?: string;
  category: string;
  keywords: string[];
  sourceUrl?: string;
}

export interface AdCollectionOptions {
  category: string;                    // 수집할 카테고리 (예: '화장품', '패션')
  platforms?: string[];                // 수집할 플랫폼 (기본: 모든 플랫폼)
  countPerPlatform?: number;          // 플랫폼당 수집 개수 (기본: 25개)
  freshnessDays?: number;             // 최근 며칠 광고만 (기본: 30일)
}

export class EnhancedAdCollectionService {
  private readonly perplexityApiKey: string;
  private readonly defaultPlatforms = ["naver", "google", "meta", "kakao"];
  private readonly defaultCountPerPlatform = 25; // 플랫폼당 25개 = 총 100개

  constructor() {
    this.perplexityApiKey = process.env.PERPLEXITY_API_KEY || "";
    
    if (!this.perplexityApiKey) {
      console.warn("⚠️ PERPLEXITY_API_KEY가 설정되지 않았습니다.");
    }
  }

  /**
   * 메인 수집 함수 - 모든 플랫폼에서 광고 수집
   */
  async collectAds(options: AdCollectionOptions): Promise<{
    totalCollected: number;
    totalSaved: number;
    totalDuplicates: number;
    byPlatform: Record<string, number>;
    sessionId: string;
  }> {
    const startTime = Date.now();
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log("\n" + "=".repeat(60));
    console.log("🚀 광고 수집 시작");
    console.log("=".repeat(60));
    console.log(`📅 세션 ID: ${sessionId}`);
    console.log(`📂 카테고리: ${options.category}`);
    console.log(`🎯 플랫폼: ${(options.platforms || this.defaultPlatforms).join(", ")}`);
    console.log(`📊 플랫폼당 목표: ${options.countPerPlatform || this.defaultCountPerPlatform}개`);
    console.log("=".repeat(60) + "\n");

    const platforms = options.platforms || this.defaultPlatforms;
    const countPerPlatform = options.countPerPlatform || this.defaultCountPerPlatform;
    
    let totalCollected = 0;
    let totalSaved = 0;
    let totalDuplicates = 0;
    const byPlatform: Record<string, number> = {};

    // 각 플랫폼별로 순차 수집
    for (const platform of platforms) {
      console.log(`\n🔍 [${platform.toUpperCase()}] 광고 수집 중...`);
      
      try {
        const platformAds = await this.collectFromPlatform(
          platform,
          options.category,
          countPerPlatform,
          options.freshnessDays
        );
        
        console.log(`   ✅ ${platformAds.length}개 수집 완료`);
        
        // 데이터베이스에 저장
        const saveResult = await this.saveAds(platformAds, sessionId);
        
        totalCollected += platformAds.length;
        totalSaved += saveResult.saved;
        totalDuplicates += saveResult.duplicates;
        byPlatform[platform] = saveResult.saved;
        
        console.log(`   💾 저장: ${saveResult.saved}개 | 중복: ${saveResult.duplicates}개`);
        
        // 수집 통계 기록
        await this.recordCollectionStats({
          sessionId,
          platform,
          category: options.category,
          totalCollected: platformAds.length,
          totalSaved: saveResult.saved,
          totalDuplicates: saveResult.duplicates,
          durationMs: Date.now() - startTime,
        });
        
      } catch (error) {
        console.error(`   ❌ [${platform}] 수집 실패:`, error);
        
        // 에러 기록
        await this.recordCollectionStats({
          sessionId,
          platform,
          category: options.category,
          totalCollected: 0,
          totalSaved: 0,
          totalDuplicates: 0,
          totalErrors: 1,
          durationMs: Date.now() - startTime,
        });
      }
    }

    const duration = Date.now() - startTime;
    
    console.log("\n" + "=".repeat(60));
    console.log("✅ 광고 수집 완료");
    console.log("=".repeat(60));
    console.log(`📊 총 수집: ${totalCollected}개`);
    console.log(`💾 저장 성공: ${totalSaved}개`);
    console.log(`🔄 중복 제거: ${totalDuplicates}개`);
    console.log(`⏱️ 소요 시간: ${(duration / 1000).toFixed(2)}초`);
    console.log("=".repeat(60) + "\n");

    return {
      totalCollected,
      totalSaved,
      totalDuplicates,
      byPlatform,
      sessionId,
    };
  }

  /**
   * 특정 플랫폼에서 광고 수집
   */
  private async collectFromPlatform(
    platform: string,
    category: string,
    count: number,
    freshnessDays: number = 30
  ): Promise<PerplexityAdResult[]> {
    // 플랫폼별 맞춤 검색 쿼리 생성
    const query = this.buildPlatformQuery(platform, category, freshnessDays);
    
    // 퍼플렉시티 API 호출
    const results = await this.callPerplexityAPI(query, count);
    
    // 결과 파싱 및 정제
    const ads = this.parsePerplexityResults(results, platform, category);
    
    return ads;
  }

  /**
   * 플랫폼별 최적화된 검색 쿼리 생성
   */
  private buildPlatformQuery(platform: string, category: string, freshnessDays: number): string {
    const queries: Record<string, string> = {
      naver: `
네이버 검색광고에서 최근 ${freshnessDays}일 이내 게재된 ${category} 관련 광고 문구를 찾아주세요.
다음 정보를 포함해주세요:
- 광고 제목 (헤드라인)
- 광고 설명
- 브랜드명
- 키워드

실제 게재된 광고만 수집하고, 성과가 좋았을 것으로 예상되는 광고를 우선적으로 선택해주세요.
`,

      google: `
구글 광고(Google Ads)에서 최근 ${freshnessDays}일 이내 게재된 ${category} 관련 광고 문구를 찾아주세요.
다음 정보를 포함해주세요:
- 광고 제목 (Headline)
- 광고 설명 (Description)
- 브랜드명
- 주요 키워드

실제 성과가 좋은 광고를 우선적으로 선택해주세요.
`,

      meta: `
메타 광고 라이브러리(Meta Ad Library)에서 최근 ${freshnessDays}일 이내 게재된 ${category} 관련 페이스북/인스타그램 광고를 찾아주세요.
다음 정보를 포함해주세요:
- 광고 문구
- 브랜드명
- 타겟 키워드
- 광고 설명

참여도가 높았을 것으로 예상되는 광고를 우선적으로 선택해주세요.
`,

      kakao: `
카카오 모먼트 광고에서 최근 ${freshnessDays}일 이내 게재된 ${category} 관련 광고 문구를 찾아주세요.
다음 정보를 포함해주세요:
- 광고 제목
- 광고 설명
- 브랜드명
- 키워드

실제 클릭률이 높았을 것으로 예상되는 광고를 우선적으로 선택해주세요.
`,
    };

    return queries[platform] || queries.naver;
  }

  /**
   * 퍼플렉시티 API 호출
   */
  private async callPerplexityAPI(query: string, targetCount: number): Promise<string> {
    if (!this.perplexityApiKey) {
      throw new Error("Perplexity API 키가 설정되지 않았습니다.");
    }

    const messages: PerplexityMessage[] = [
      {
        role: "system",
        content: `당신은 광고 마케팅 전문가입니다. 실제 게재된 성과 좋은 광고 문구를 ${targetCount}개 찾아서 JSON 배열 형식으로 반환하세요.

각 광고는 다음 형식을 따라야 합니다:
{
  "headline": "광고 제목",
  "description": "광고 설명",
  "brand": "브랜드명",
  "keywords": ["키워드1", "키워드2", "키워드3"]
}

반드시 유효한 JSON 배열만 반환하고, 다른 설명은 포함하지 마세요.`
      },
      {
        role: "user",
        content: query
      }
    ];

    try {
      const response = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.perplexityApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.1-sonar-large-128k-online",
          messages,
          temperature: 0.2,
          max_tokens: 4000,
        }),
      });

      if (!response.ok) {
        throw new Error(`Perplexity API 오류: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || "[]";
      
    } catch (error) {
      console.error("Perplexity API 호출 실패:", error);
      throw error;
    }
  }

  /**
   * 퍼플렉시티 결과 파싱
   */
  private parsePerplexityResults(
    rawResults: string,
    platform: string,
    category: string
  ): PerplexityAdResult[] {
    try {
      // JSON 추출 (마크다운 코드 블록 제거)
      const jsonMatch = rawResults.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/) || 
                       rawResults.match(/(\[[\s\S]*?\])/);
      
      const jsonStr = jsonMatch ? jsonMatch[1] : rawResults;
      const parsed = JSON.parse(jsonStr);

      if (!Array.isArray(parsed)) {
        throw new Error("결과가 배열이 아닙니다.");
      }

      // PerplexityAdResult 형식으로 변환
      return parsed.map((item: any) => ({
        platform,
        adCopy: item.headline || item.title || "",
        headline: item.headline || item.title,
        description: item.description || item.desc,
        brand: item.brand,
        category,
        keywords: Array.isArray(item.keywords) ? item.keywords : [],
        sourceUrl: item.url || item.source,
      })).filter(ad => ad.adCopy && ad.adCopy.length > 0);

    } catch (error) {
      console.error("결과 파싱 실패:", error);
      console.error("원본 결과:", rawResults);
      return [];
    }
  }

  /**
   * 광고 데이터베이스에 저장 (중복 제거 포함)
   */
  private async saveAds(
    ads: PerplexityAdResult[],
    sessionId: string
  ): Promise<{ saved: number; duplicates: number }> {
    let saved = 0;
    let duplicates = 0;

    for (const ad of ads) {
      try {
        // 중복 체크 (동일한 광고 문구가 이미 있는지)
        const existing = await db
          .select({ id: adReferences.id })
          .from(adReferences)
          .where(
            and(
              eq(adReferences.platform, ad.platform),
              eq(adReferences.adCopy, ad.adCopy)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          duplicates++;
          continue;
        }

        // AI 자동 분석 (간단한 분석)
        const analysis = this.analyzeAdCopy(ad.adCopy);

        // 데이터베이스에 저장
        await db.insert(adReferences).values({
          platform: ad.platform,
          adCopy: ad.adCopy,
          headline: ad.headline,
          description: ad.description,
          category: ad.category,
          brand: ad.brand,
          keywords: ad.keywords,
          sourceUrl: ad.sourceUrl,
          
          // AI 분석 결과
          copywritingFormula: analysis.formula,
          psychologicalTriggers: analysis.triggers,
          tone: analysis.tone,
          charCount: ad.adCopy.length,
          
          // 수집 정보
          collectedVia: "perplexity",
          performanceScore: 0.65, // 퍼플렉시티로 수집한 광고는 기본 65점
          status: "active",
        });

        saved++;

      } catch (error) {
        console.error("광고 저장 실패:", ad.adCopy.substring(0, 30), error);
      }
    }

    return { saved, duplicates };
  }

  /**
   * 광고 문구 자동 분석 (간단한 규칙 기반)
   */
  private analyzeAdCopy(adCopy: string): {
    formula: string;
    triggers: string[];
    tone: string;
  } {
    const triggers: string[] = [];
    
    // 심리 트리거 감지
    if (/\d+%|할인|세일|특가/.test(adCopy)) triggers.push("가격혜택");
    if (/오늘만|한정|마감|서둘러/.test(adCopy)) triggers.push("긴급성");
    if (/단 \d+개|선착순|한정판/.test(adCopy)) triggers.push("희소성");
    if (/\d+명|고객|만족도/.test(adCopy)) triggers.push("사회적증거");
    if (/무료|공짜|증정/.test(adCopy)) triggers.push("무료제공");
    if (/새로운|최초|혁신/.test(adCopy)) triggers.push("혁신성");
    
    // 공식 감지 (간단한 휴리스틱)
    let formula = "AIDA";
    if (adCopy.includes("문제") || adCopy.includes("고민")) {
      formula = "PAS"; // Problem-Agitate-Solution
    } else if (/\d+/.test(adCopy) && adCopy.length < 30) {
      formula = "USP"; // Unique Selling Proposition
    }
    
    // 톤 감지
    let tone = "neutral";
    if (/!|와|대박/.test(adCopy)) tone = "urgent";
    else if (/프리미엄|럭셔리|엘리트/.test(adCopy)) tone = "premium";
    else if (/요|해요|이에요/.test(adCopy)) tone = "casual";
    else if (/입니다|하십시오|드립니다/.test(adCopy)) tone = "formal";

    return {
      formula,
      triggers,
      tone,
    };
  }

  /**
   * 수집 통계 기록
   */
  private async recordCollectionStats(stats: {
    sessionId: string;
    platform: string;
    category: string;
    totalCollected: number;
    totalSaved: number;
    totalDuplicates: number;
    totalErrors?: number;
    durationMs: number;
  }) {
    try {
      await db.insert(adCollectionStats).values({
        collectionSessionId: stats.sessionId,
        platform: stats.platform,
        category: stats.category,
        totalCollected: stats.totalCollected,
        totalSaved: stats.totalSaved,
        totalDuplicates: stats.totalDuplicates,
        totalErrors: stats.totalErrors || 0,
        durationMs: stats.durationMs,
      });
    } catch (error) {
      console.error("통계 기록 실패:", error);
    }
  }

  /**
   * 저장된 광고 통계 조회
   */
  async getCollectionStatistics(): Promise<{
    totalAds: number;
    byPlatform: Record<string, number>;
    byCategory: Record<string, number>;
    recentCollections: number;
  }> {
    // 전체 광고 수
    const [totalResult] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(adReferences)
      .where(eq(adReferences.status, "active"));

    // 플랫폼별 통계
    const platformStats = await db
      .select({
        platform: adReferences.platform,
        count: sql<number>`COUNT(*)`
      })
      .from(adReferences)
      .where(eq(adReferences.status, "active"))
      .groupBy(adReferences.platform);

    // 카테고리별 통계
    const categoryStats = await db
      .select({
        category: adReferences.category,
        count: sql<number>`COUNT(*)`
      })
      .from(adReferences)
      .where(eq(adReferences.status, "active"))
      .groupBy(adReferences.category);

    // 최근 24시간 수집
    const [recentResult] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(adReferences)
      .where(
        sql`${adReferences.collectedAt} > NOW() - INTERVAL '24 hours'`
      );

    return {
      totalAds: Number(totalResult?.count || 0),
      byPlatform: platformStats.reduce((acc, stat) => {
        acc[stat.platform] = Number(stat.count);
        return acc;
      }, {} as Record<string, number>),
      byCategory: categoryStats.reduce((acc, stat) => {
        acc[stat.category] = Number(stat.count);
        return acc;
      }, {} as Record<string, number>),
      recentCollections: Number(recentResult?.count || 0),
    };
  }
}

