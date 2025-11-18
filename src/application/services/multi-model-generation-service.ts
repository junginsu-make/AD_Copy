import { LLMProviderFactory } from "@/src/infrastructure/ai/llm-provider-factory";
import type {
  GenerationRequest,
  LLMProvider,
  TokenUsage,
} from "@/src/infrastructure/ai/types";
import type { IntentData } from "./intent-extraction-service";
import type { LengthRequest } from "./length-diversity-service";

/**
 * 멀티모델 병렬 생성 결과
 */
export interface MultiModelGenerationResult {
  copies: CopyWithMetadata[];
  totalTokenUsage: TokenUsage;
  totalCost: number;
  modelsUsed: string[];
  generationTimeMs: number;
}

/**
 * 메타데이터가 포함된 카피
 */
export interface CopyWithMetadata {
  content: string;
  charCount: number;
  modelUsed: string;
  lengthCategory: "short" | "medium" | "long";
  recommendedChannel: string;
  tokenUsage: TokenUsage;
  cost: number;
  rank?: number;
  rankingReason?: string;
}

/**
 * 멀티모델 병렬 생성 서비스
 * 여러 LLM을 동시에 호출하여 다양한 카피 생성
 */
export class MultiModelGenerationService {
  private readonly providerFactory = LLMProviderFactory.getInstance();

  /**
   * 여러 모델을 병렬로 호출하여 카피 생성
   */
  async generateWithMultipleModels(
    intent: IntentData,
    lengthRequests: LengthRequest[],
    basePrompt: string
  ): Promise<MultiModelGenerationResult> {
    const startTime = Date.now();
    const providers = this.providerFactory.getGenerationProviders();

    if (providers.length === 0) {
      throw new Error("사용 가능한 LLM Provider가 없습니다.");
    }

    // 각 Provider와 길이 요청의 조합으로 병렬 호출
    const allPromises: Promise<ProviderResult>[] = [];

    for (const provider of providers) {
      for (const lengthReq of lengthRequests) {
        const promise = this.generateFromProvider(
          provider,
          basePrompt,
          lengthReq,
          intent
        );
        allPromises.push(promise);
      }
    }

    // 모든 호출 병렬 실행
    const results = await Promise.allSettled(allPromises);

    // 성공한 결과만 수집
    const successfulResults: ProviderResult[] = [];
    for (const result of results) {
      if (result.status === "fulfilled") {
        successfulResults.push(result.value);
      } else {
        console.warn("모델 호출 실패:", result.reason);
      }
    }

    if (successfulResults.length === 0) {
      throw new Error("모든 모델 호출이 실패했습니다.");
    }

    // 결과 취합
    const allCopies: CopyWithMetadata[] = [];
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalCost = 0;
    const modelsUsed = new Set<string>();

    for (const providerResult of successfulResults) {
      modelsUsed.add(providerResult.modelName);
      totalPromptTokens += providerResult.tokenUsage.promptTokens;
      totalCompletionTokens += providerResult.tokenUsage.completionTokens;
      totalCost += providerResult.cost;

      for (const copy of providerResult.copies) {
        allCopies.push({
          content: copy,
          charCount: copy.length,
          modelUsed: providerResult.modelName,
          lengthCategory: providerResult.lengthCategory,
          recommendedChannel: this.getRecommendedChannel(copy.length),
          tokenUsage: providerResult.tokenUsage,
          cost: providerResult.cost,
        });
      }
    }

    // 중복 제거 (유사도 기반)
    const uniqueCopies = this.deduplicateCopies(allCopies);

    return {
      copies: uniqueCopies,
      totalTokenUsage: {
        promptTokens: totalPromptTokens,
        completionTokens: totalCompletionTokens,
        totalTokens: totalPromptTokens + totalCompletionTokens,
      },
      totalCost,
      modelsUsed: Array.from(modelsUsed),
      generationTimeMs: Date.now() - startTime,
    };
  }

  /**
   * 단일 Provider로부터 카피 생성
   */
  private async generateFromProvider(
    provider: LLMProvider,
    basePrompt: string,
    lengthReq: LengthRequest,
    intent: IntentData
  ): Promise<ProviderResult> {
    const request: GenerationRequest = {
      prompt: basePrompt,
      minChars: lengthReq.minChars,
      maxChars: lengthReq.maxChars,
      count: lengthReq.count,
      tone: intent.tone,
      creativeGuidelines: this.buildCreativeGuidelines(intent, lengthReq.category),
    };

    const result = await provider.generateCopies(request);
    const cost = provider.calculateCost(result.tokenUsage);

    return {
      modelName: provider.modelName,
      copies: result.copies,
      tokenUsage: result.tokenUsage,
      cost,
      lengthCategory: lengthReq.category,
    };
  }

  /**
   * 창의성 가이드라인 생성
   */
  private buildCreativeGuidelines(
    intent: IntentData,
    lengthCategory: "short" | "medium" | "long"
  ) {
    const guidelines = [];

    // 길이별 가이드라인
    if (lengthCategory === "short") {
      guidelines.push({
        title: "짧은 카피 전략",
        description: "임팩트 있는 단어 선택, 리듬감, 한 번에 이해 가능",
      });
    } else if (lengthCategory === "medium") {
      guidelines.push({
        title: "중간 카피 전략",
        description: "베네핏 명확히 제시, 감정 유발 + 논리",
      });
    } else {
      guidelines.push({
        title: "긴 카피 전략",
        description: "스토리텔링, 구체적 시나리오, 설득력 있는 근거",
      });
    }

    // 감정 트리거
    if (intent.emotionalTriggers && intent.emotionalTriggers.length > 0) {
      guidelines.push({
        title: "감정 유발",
        description: `다음 감정을 자연스럽게 표현: ${intent.emotionalTriggers.join(", ")}`,
      });
    }

    // 시각적 이미지
    if (intent.visualImagery && intent.visualImagery.length > 0) {
      guidelines.push({
        title: "시각적 표현",
        description: `다음 이미지를 연상시키는 표현 사용: ${intent.visualImagery.join(", ")}`,
      });
    }

    // 스토리텔링
    if (intent.storytellingAngle) {
      guidelines.push({
        title: "스토리텔링",
        description: `"${intent.storytellingAngle}" 각도로 이야기 전개`,
      });
    }

    return guidelines;
  }

  /**
   * 채널 추천
   */
  private getRecommendedChannel(charCount: number): string {
    if (charCount <= 30) {
      return "SNS (인스타그램, 트위터)";
    } else if (charCount <= 60) {
      return "배너 광고, 검색 광고";
    } else if (charCount <= 100) {
      return "블로그 제목, 뉴스레터";
    } else {
      return "랜딩페이지, 상세 설명";
    }
  }

  /**
   * 유사 카피 중복 제거
   */
  private deduplicateCopies(copies: CopyWithMetadata[]): CopyWithMetadata[] {
    const unique: CopyWithMetadata[] = [];

    for (const copy of copies) {
      const isDuplicate = unique.some((existing) =>
        this.calculateSimilarity(existing.content, copy.content) > 0.85
      );

      if (!isDuplicate) {
        unique.push(copy);
      }
    }

    return unique;
  }

  /**
   * 문자열 유사도 계산 (간단한 토큰 기반)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const tokens1 = new Set(str1.split(/\s+/));
    const tokens2 = new Set(str2.split(/\s+/));

    const intersection = new Set([...tokens1].filter((x) => tokens2.has(x)));
    const union = new Set([...tokens1, ...tokens2]);

    return intersection.size / union.size;
  }
}

interface ProviderResult {
  modelName: string;
  copies: string[];
  tokenUsage: TokenUsage;
  cost: number;
  lengthCategory: "short" | "medium" | "long";
}

