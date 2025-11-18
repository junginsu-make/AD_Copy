import { LLMProviderFactory } from "@/src/infrastructure/ai/llm-provider-factory";
import type { IntentData } from "./intent-extraction-service";

/**
 * 경쟁사 분석 서비스
 * 웹 검색을 통해 경쟁 제품의 카피를 수집하고 차별화 포인트 도출
 */
export class CompetitorAnalysisService {
  private readonly providerFactory = LLMProviderFactory.getInstance();

  /**
   * 제품명으로 경쟁사 검색 및 분석
   */
  async analyzeCompetitors(productName: string, intent: IntentData): Promise<{
    competitorCopies: string[];
    differentiationPoints: string[];
    recommendations: string[];
  }> {
    try {
      // 1. 웹 검색으로 경쟁사 카피 수집
      const competitorCopies = await this.searchCompetitorCopies(productName);

      // 2. Gemini Flash로 차별화 포인트 분석
      const analysis = await this.analyzeDifferentiation(
        productName,
        competitorCopies,
        intent
      );

      return analysis;
    } catch (error) {
      console.warn("경쟁사 분석 실패:", error);
      return {
        competitorCopies: [],
        differentiationPoints: [],
        recommendations: [],
      };
    }
  }

  /**
   * 웹 검색으로 경쟁사 카피 수집
   */
  private async searchCompetitorCopies(productName: string): Promise<string[]> {
    try {
      // Tavily Search MCP 사용 시도
      if (typeof (globalThis as any).tavily_search === "function") {
        const results = await (globalThis as any).tavily_search({
          query: `${productName} 광고 카피 슬로건`,
          max_results: 5,
          include_raw_content: true,
        });

        const copies: string[] = [];
        for (const result of results.results || []) {
          const content = result.content ?? result.raw_content ?? "";
          const extracted = this.extractCopiesFromText(content);
          copies.push(...extracted);
        }

        return copies.slice(0, 10);
      }

      // 폴백: 빈 배열 반환
      console.warn("Tavily MCP 사용 불가, 경쟁사 검색 스킵");
      return [];
    } catch (error) {
      console.error("경쟁사 카피 검색 실패:", error);
      return [];
    }
  }

  /**
   * 텍스트에서 카피 추출
   */
  private extractCopiesFromText(text: string): string[] {
    const lines = text.split(/\n/).map((line) => line.trim()).filter(Boolean);
    const copies: string[] = [];

    for (const line of lines) {
      if (line.length >= 10 && line.length <= 100) {
        if (!line.startsWith("http") && !line.includes("@")) {
          copies.push(line);
        }
      }
    }

    return copies.slice(0, 5);
  }

  /**
   * 차별화 포인트 분석
   */
  private async analyzeDifferentiation(
    productName: string,
    competitorCopies: string[],
    intent: IntentData
  ): Promise<{
    competitorCopies: string[];
    differentiationPoints: string[];
    recommendations: string[];
  }> {
    const provider = this.providerFactory.resolve("gemini-2.5-flash");

    const competitorList =
      competitorCopies.length > 0
        ? competitorCopies.map((copy, idx) => `${idx + 1}. "${copy}"`).join("\n")
        : "경쟁사 카피 정보 없음";

    const prompt = `당신은 마케팅 전략 분석가입니다.
다음 정보를 바탕으로 차별화 전략을 제시하세요.

## 우리 제품
- 제품명: ${productName}
- 타겟: ${intent.targetAudience ?? "정보 없음"}
- 핵심 베네핏: ${intent.keyBenefits?.join(", ") ?? "정보 없음"}

## 경쟁사 카피
${competitorList}

## 분석 요청
1. 경쟁사 카피의 공통 패턴과 한계점
2. 우리가 차별화할 수 있는 3가지 포인트
3. 카피 작성 시 피해야 할 표현
4. 추천하는 독특한 각도/메시지

## 출력 형식 (JSON만)
{
  "competitorCopies": ["수집된 경쟁사 카피"],
  "differentiationPoints": ["차별화 포인트1", "차별화 포인트2", "차별화 포인트3"],
  "recommendations": ["추천 사항1", "추천 사항2", "추천 사항3"]
}`;

    const response = await provider.generateCopies({
      prompt,
      minChars: 100,
      maxChars: 1000,
      count: 1,
      creativeGuidelines: [
        {
          title: "JSON 출력",
          description: "유효한 JSON만 반환",
        },
      ],
    });

    const jsonText = response.copies[0] ?? "{}";
    return this.parseAnalysis(jsonText, competitorCopies);
  }

  /**
   * 분석 결과 파싱
   */
  private parseAnalysis(
    jsonText: string,
    fallbackCompetitors: string[]
  ): {
    competitorCopies: string[];
    differentiationPoints: string[];
    recommendations: string[];
  } {
    try {
      const cleaned = jsonText
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "")
        .trim();

      const parsed = JSON.parse(cleaned);

      const toStringArray = (value: unknown): string[] => {
        if (Array.isArray(value)) {
          return value.map((item) => String(item).trim()).filter(Boolean);
        }
        return [];
      };

      return {
        competitorCopies: toStringArray(parsed.competitorCopies) || fallbackCompetitors,
        differentiationPoints: toStringArray(parsed.differentiationPoints),
        recommendations: toStringArray(parsed.recommendations),
      };
    } catch (error) {
      console.error("경쟁사 분석 파싱 실패:", error);
      return {
        competitorCopies: fallbackCompetitors,
        differentiationPoints: [],
        recommendations: [],
      };
    }
  }
}

