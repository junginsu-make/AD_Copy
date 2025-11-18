import { LLMProviderFactory } from "@/src/infrastructure/ai/llm-provider-factory";
import type { CopyWithMetadata } from "./multi-model-generation-service";
import type { IntentData } from "./intent-extraction-service";

/**
 * 카피 품질 평가 및 리랭킹 서비스
 * GPT-4o를 심사위원으로 사용하여 최고의 카피 선택
 */
export class CopyRerankingService {
  private readonly providerFactory = LLMProviderFactory.getInstance();

  /**
   * 생성된 카피들을 품질 평가하여 상위 N개 선택
   */
  async rankAndSelect(
    copies: CopyWithMetadata[],
    intent: IntentData,
    topN: number = 10
  ): Promise<CopyWithMetadata[]> {
    if (copies.length <= topN) {
      return copies; // 이미 적은 수면 그대로 반환
    }

    try {
      // GPT-4o를 심사위원으로 사용
      const provider = this.providerFactory.resolve("gpt-5");
      
      const prompt = this.buildRankingPrompt(copies, intent, topN);
      
      const response = await provider.generateCopies({
        prompt,
        minChars: 50,
        maxChars: 2000,
        count: 1,
        creativeGuidelines: [
          {
            title: "Output Format",
            description: "반드시 JSON 배열만 반환. 추가 설명 금지.",
          },
        ],
      });

      const jsonText = response.copies[0] ?? "[]";
      const rankings = this.parseRankings(jsonText);

      // 순위에 따라 카피 정렬 및 메타데이터 추가
      const rankedCopies: CopyWithMetadata[] = [];
      
      for (const ranking of rankings.slice(0, topN)) {
        const copy = copies.find((c) => c.content === ranking.copy);
        if (copy) {
          rankedCopies.push({
            ...copy,
            rank: ranking.rank,
            rankingReason: ranking.reason,
          });
        }
      }

      return rankedCopies;
    } catch (error) {
      console.warn("리랭킹 실패, 원본 순서 유지:", error);
      return copies.slice(0, topN);
    }
  }

  /**
   * 리랭킹 프롬프트 생성
   */
  private buildRankingPrompt(
    copies: CopyWithMetadata[],
    intent: IntentData,
    topN: number
  ): string {
    const copiesList = copies
      .map((c, idx) => `${idx + 1}. "${c.content}" (${c.charCount}자, ${c.modelUsed})`)
      .join("\n");

    return `당신은 광고 카피 품질 심사 전문가입니다.
다음 카피들을 평가하여 가장 효과적인 상위 ${topN}개를 선택하세요.

## 평가 기준
1. **창의성** (30점): 진부하지 않은 표현, 참신한 각도
2. **감정 임팩트** (30점): 타겟 고객의 감정을 움직이는가
3. **명확성** (20점): 한 번에 이해 가능한가
4. **행동 유도** (20점): 구매/클릭/문의를 유도하는가

## 제품 정보
- 제품: ${intent.productName ?? "정보 없음"}
- 타겟: ${intent.targetAudience ?? "정보 없음"}
- 톤: ${intent.tone ?? "중립"}
- 핵심 베네핏: ${intent.keyBenefits?.join(", ") ?? "정보 없음"}

## 카피 목록
${copiesList}

## 출력 형식 (JSON 배열만 반환)
[
  {
    "rank": 1,
    "copy": "정확한 카피 텍스트",
    "reason": "선택 이유 (창의성/감정/명확성/행동유도 측면에서 한 줄로)"
  },
  ...
]

상위 ${topN}개만 반환하세요.`;
  }

  /**
   * 리랭킹 결과 파싱
   */
  private parseRankings(jsonText: string): Array<{
    rank: number;
    copy: string;
    reason: string;
  }> {
    try {
      // JSON 코드블록 제거
      const cleaned = jsonText
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "")
        .trim();

      const parsed = JSON.parse(cleaned);

      if (!Array.isArray(parsed)) {
        throw new Error("배열이 아닙니다.");
      }

      return parsed.map((item) => ({
        rank: Number(item.rank) || 0,
        copy: String(item.copy || "").trim(),
        reason: String(item.reason || "").trim(),
      }));
    } catch (error) {
      console.error("리랭킹 JSON 파싱 실패:", error, jsonText);
      return [];
    }
  }
}

