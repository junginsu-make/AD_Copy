/**
 * 동적 Few-shot 예시 선택 서비스
 * 슈퍼베이스에 저장된 광고 레퍼런스를 활용한 똑똑한 예시 선택
 */

import { db } from "@/src/infrastructure/database/db";
import { adReferences, fewshotLearningLog, copyFeedback } from "@/src/infrastructure/database/schema";
import { eq, and, gte, desc, sql, isNotNull, or } from "drizzle-orm";
import type { IntentData } from "@/src/application/services/intent-extraction-service";

export interface AdReferenceExample {
  id: number;
  adCopy: string;
  headline?: string;
  description?: string;
  category: string;
  brand?: string;
  copywritingFormula?: string;
  psychologicalTriggers: string[];
  performanceScore: number;
  qualityRating: number;
  isPremium?: boolean;    // 수동 입력 여부
  isSelected?: boolean;   // 사용자가 체크한 여부
}

export class DynamicFewShotService {
  /**
   * 의도 기반 최적 Few-shot 예시 선택
   * 
   * 🎯 개선된 선택 기준 (우선순위):
   * 1. 수동 입력 (isPremium = true) - 최우선 반영
   * 2. 사용자가 체크한 것 (isSelected = true)
   * 3. 카테고리 일치 + 고성과
   * 4. 다양성 확보 (같은 공식 반복 방지)
   */
  async selectBestExamples(
    intent: IntentData,
    limit: number = 5
  ): Promise<AdReferenceExample[]> {
    console.log("\n🎯 Few-shot 예시 선택 시작 (개선된 우선순위)");
    console.log(`   카테고리: ${intent.productName || "미지정"}`);
    console.log(`   목표 개수: ${limit}개`);

    try {
      // 1순위: 수동 입력 + 체크된 레퍼런스 (무조건 포함)
      const selectedRefs = await this.getSelectedReferences(limit);
      console.log(`   ⭐ 우선 선택 (수동 입력 + 체크): ${selectedRefs.length}개`);

      // 2순위: 카테고리 매칭 + 고성과 (선택되지 않은 것 중)
      const remainingLimit = Math.max(0, limit - selectedRefs.length);
      let additionalRefs: AdReferenceExample[] = [];
      
      if (remainingLimit > 0) {
        const topPerformers = await this.getTopPerformers(intent, remainingLimit * 2);
        const recentSuccess = await this.getRecentSuccessStories(intent, remainingLimit);
        
        // 합치고 중복 제거
        const combined = this.deduplicateExamples([...topPerformers, ...recentSuccess]);
        
        // 다양성 확보
        additionalRefs = this.ensureFormulaDiversity(combined, remainingLimit);
        
        console.log(`   ✅ 추가 선택 (카테고리 매칭): ${additionalRefs.length}개`);
      }

      // 최종 결합 (선택된 것 우선)
      const finalExamples = [...selectedRefs, ...additionalRefs].slice(0, limit);

      console.log(`   ✅ 최종 선택: ${finalExamples.length}개`);
      console.log(`     - 수동 입력/체크: ${selectedRefs.length}개`);
      console.log(`     - 자동 선택: ${additionalRefs.length}개`);
      console.log(`   공식 분포: ${this.getFormulaDist(finalExamples)}\n`);

      return finalExamples;

    } catch (error) {
      console.warn("⚠️ 동적 Few-shot 선택 실패, 기본 예시 사용:", error);
      return [];
    }
  }
  
  /**
   * 선택된 레퍼런스 가져오기 (최우선)
   * - isPremium = true (수동 입력)
   * - isSelected = true (사용자가 체크한 것)
   */
  private async getSelectedReferences(limit: number): Promise<AdReferenceExample[]> {
    const results = await db
      .select({
        id: adReferences.id,
        adCopy: adReferences.adCopy,
        headline: adReferences.headline,
        description: adReferences.description,
        category: adReferences.category,
        brand: adReferences.brand,
        copywritingFormula: adReferences.copywritingFormula,
        psychologicalTriggers: adReferences.psychologicalTriggers,
        performanceScore: adReferences.performanceScore,
        qualityRating: adReferences.qualityRating,
        isPremium: adReferences.isPremium,
        isSelected: adReferences.isSelected,
      })
      .from(adReferences)
      .where(
        and(
          eq(adReferences.status, "active"),
          or(
            eq(adReferences.isPremium, true),    // 수동 입력
            eq(adReferences.isSelected, true)    // 체크된 것
          )
        )
      )
      .orderBy(
        desc(adReferences.isPremium),           // 수동 입력 최우선
        desc(adReferences.performanceScore),
        desc(adReferences.qualityRating)
      )
      .limit(limit);

    return results.map((r) => ({
      id: r.id,
      adCopy: r.adCopy,
      headline: r.headline || undefined,
      description: r.description || undefined,
      category: r.category,
      brand: r.brand || undefined,
      copywritingFormula: r.copywritingFormula || undefined,
      psychologicalTriggers: (r.psychologicalTriggers as any) || [],
      performanceScore: parseFloat(r.performanceScore as any) || 0.5,
      qualityRating: r.qualityRating || 0,
      isPremium: r.isPremium || false,
      isSelected: r.isSelected || false,
    }));
  }

  /**
   * 성과 좋은 광고 레퍼런스 조회
   */
  private async getTopPerformers(
    intent: IntentData,
    limit: number
  ): Promise<AdReferenceExample[]> {
    // 카테고리 키워드 추출
    const categoryKeywords = this.extractCategoryKeywords(intent);

    const results = await db
      .select({
        id: adReferences.id,
        adCopy: adReferences.adCopy,
        headline: adReferences.headline,
        description: adReferences.description,
        category: adReferences.category,
        brand: adReferences.brand,
        copywritingFormula: adReferences.copywritingFormula,
        psychologicalTriggers: adReferences.psychologicalTriggers,
        performanceScore: adReferences.performanceScore,
        qualityRating: adReferences.qualityRating,
      })
      .from(adReferences)
      .where(
        and(
          eq(adReferences.status, "active"),
          eq(adReferences.isPremium, false),    // 수동 입력 제외 (이미 선택됨)
          eq(adReferences.isSelected, false),   // 체크된 것 제외 (이미 선택됨)
          gte(adReferences.performanceScore, "0.6"), // 성과 60% 이상
          gte(adReferences.qualityRating, 3)         // 평점 3점 이상
        )
      )
      .orderBy(
        desc(adReferences.performanceScore),
        desc(adReferences.qualityRating),
        desc(adReferences.usageCount)
      )
      .limit(limit);

    return results.map(r => ({
      ...r,
      psychologicalTriggers: r.psychologicalTriggers || [],
      performanceScore: parseFloat(r.performanceScore as any) || 0.5,
      isPremium: r.isPremium || false,
      isSelected: r.isSelected || false,
    }));
  }

  /**
   * 최근 성공 사례 조회 (사용자 피드백 기반)
   */
  private async getRecentSuccessStories(
    intent: IntentData,
    limit: number
  ): Promise<AdReferenceExample[]> {
    try {
      const results = await db
        .select({
          id: adReferences.id,
          adCopy: adReferences.adCopy,
          headline: adReferences.headline,
          description: adReferences.description,
          category: adReferences.category,
          brand: adReferences.brand,
          copywritingFormula: adReferences.copywritingFormula,
          psychologicalTriggers: adReferences.psychologicalTriggers,
          performanceScore: adReferences.performanceScore,
          qualityRating: adReferences.qualityRating,
          avgRating: sql<number>`AVG(${copyFeedback.rating})`,
        })
        .from(adReferences)
        .innerJoin(
          fewshotLearningLog,
          eq(adReferences.id, fewshotLearningLog.adReferenceId)
        )
        .innerJoin(
          copyFeedback,
          eq(fewshotLearningLog.copyId, copyFeedback.copyId)
        )
        .where(
          and(
            eq(adReferences.status, "active"),
            eq(adReferences.isPremium, false),  // 수동 입력 제외
            eq(adReferences.isSelected, false), // 체크된 것 제외
            gte(copyFeedback.rating, 4) // 평점 4 이상
          )
        )
        .groupBy(adReferences.id)
        .orderBy(desc(sql`AVG(${copyFeedback.rating})`))
        .limit(limit);

      return results.map(r => ({
        id: r.id,
        adCopy: r.adCopy,
        headline: r.headline,
        description: r.description,
        category: r.category,
        brand: r.brand,
        copywritingFormula: r.copywritingFormula,
        psychologicalTriggers: r.psychologicalTriggers || [],
        performanceScore: parseFloat(r.performanceScore as any) || 0.5,
        qualityRating: r.qualityRating,
      }));

    } catch (error) {
      console.warn("최근 성공 사례 조회 실패:", error);
      return [];
    }
  }

  /**
   * 중복 제거
   */
  private deduplicateExamples(examples: AdReferenceExample[]): AdReferenceExample[] {
    const seen = new Set<number>();
    return examples.filter(ex => {
      if (seen.has(ex.id)) return false;
      seen.add(ex.id);
      return true;
    });
  }

  /**
   * 공식 다양성 확보 (같은 공식 반복 방지)
   */
  private ensureFormulaDiversity(
    examples: AdReferenceExample[],
    limit: number
  ): AdReferenceExample[] {
    const seen = new Map<string, number>(); // formula -> count
    const result: AdReferenceExample[] = [];

    for (const ex of examples) {
      if (result.length >= limit) break;

      const formula = ex.copywritingFormula || "unknown";
      const count = seen.get(formula) || 0;

      // 같은 공식은 최대 2개까지만
      if (count < 2) {
        result.push(ex);
        seen.set(formula, count + 1);
      }
    }

    // 아직 부족하면 나머지 추가
    if (result.length < limit) {
      for (const ex of examples) {
        if (result.length >= limit) break;
        if (!result.includes(ex)) {
          result.push(ex);
        }
      }
    }

    return result;
  }

  /**
   * 카테고리 키워드 추출
   */
  private extractCategoryKeywords(intent: IntentData): string[] {
    const keywords: string[] = [];
    
    if (intent.productName) {
      keywords.push(intent.productName);
    }
    
    if (intent.keywords) {
      keywords.push(...intent.keywords);
    }

    return keywords;
  }

  /**
   * 공식 분포 문자열 생성 (로깅용)
   */
  private getFormulaDist(examples: AdReferenceExample[]): string {
    const dist = new Map<string, number>();
    examples.forEach(ex => {
      const formula = ex.copywritingFormula || "unknown";
      dist.set(formula, (dist.get(formula) || 0) + 1);
    });
    
    return Array.from(dist.entries())
      .map(([formula, count]) => `${formula}(${count})`)
      .join(", ");
  }

  /**
   * Few-shot 프롬프트 텍스트 생성
   */
  buildFewShotPrompt(examples: AdReferenceExample[]): string {
    if (examples.length === 0) {
      return "";
    }

    const examplesText = examples
      .map((ex, index) => {
        return `
[예시 ${index + 1}] ${ex.category}
광고: "${ex.adCopy}"
${ex.headline ? `제목: "${ex.headline}"` : ""}
공식: ${ex.copywritingFormula || "AIDA"}
트리거: ${ex.psychologicalTriggers.join(", ") || "없음"}
성과 점수: ${(ex.performanceScore * 100).toFixed(0)}점
`;
      })
      .join("\n");

    return `
[참고할 고성과 광고 예시]

다음은 실제로 성과가 좋았던 광고들입니다. 이 예시들의 스타일과 기법을 참고하되, 
그대로 복사하지 말고 창의적으로 변형하여 새로운 광고를 만들어주세요.

${examplesText}

위 예시들처럼:
- 구체적이고 감각적인 표현 사용
- 검증된 카피라이팅 공식 활용
- 심리적 트리거 적절히 배치
- 타겟 고객에게 맞는 톤 유지
`;
  }

  /**
   * 사용된 레퍼런스 기록 (학습 로그)
   */
  async recordUsedReferences(
    copyId: number,
    referenceIds: number[]
  ): Promise<void> {
    try {
      for (const refId of referenceIds) {
        // 학습 로그 저장
        await db.insert(fewshotLearningLog).values({
          copyId,
          adReferenceId: refId,
        });

        // 사용 횟수 증가
        await db
          .update(adReferences)
          .set({ usageCount: sql`${adReferences.usageCount} + 1` })
          .where(eq(adReferences.id, refId));
      }

      console.log(`✅ ${referenceIds.length}개 레퍼런스 사용 기록 완료`);

    } catch (error) {
      console.error("레퍼런스 기록 실패:", error);
    }
  }
}

