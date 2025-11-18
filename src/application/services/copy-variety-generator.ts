// 다양성 기반 카피 생성 서비스
// 여러 스타일의 카피를 병렬로 생성하여 사용자에게 선택권 제공

import type { IntentData } from "./intent-extraction-service";
import { CopywritingStrategyService } from "./copywriting-strategy-service";
// import { AdReferenceService } from "./ad-reference-service";
import { ProductionAdReferenceService as AdReferenceService } from "./production-ad-reference-service";
import { LLMProviderFactory } from "@/src/infrastructure/ai/llm-provider-factory";
import type { LLMModel } from "@/src/infrastructure/ai/types";
import {
  COPYWRITING_FORMULAS,
  type CopywritingFormula,
} from "@/src/domain/copywriting/formulas";
import {
  COPYWRITER_STYLES,
  type CopywriterStyle,
} from "@/src/domain/copywriting/copywriter-styles";
import {
  getTriggerById,
  type PsychologicalTrigger,
} from "@/src/domain/copywriting/psychological-triggers";

export type CopyVariety =
  | "ad_reference" // 실제 광고 레퍼런스 기반
  | "emotional" // 감성적 (Gary Halbert)
  | "data_driven" // 숫자/데이터 기반 (David Ogilvy)
  | "direct" // 직관적/짧은 (4U's)
  | "trusted" // 검증된/신뢰 (사회적 증명)
  | "storytelling" // 스토리텔링
  | "urgent" // 긴급성 강조
  | "premium"; // 프리미엄/고급

export interface VarietyGenerationRequest {
  prompt: string; // 원본 프롬프트 추가
  intent: IntentData;
  minChars: number;
  maxChars: number;
  tone: string;
  varieties?: CopyVariety[]; // 선택적으로 변경
  copiesPerVariety: number; // 각 스타일당 개수
  preferredModel?: LLMModel;
  // 핵심 옵션 추가
  useCopywritingTheory?: boolean;
  useAdReferences?: boolean;
  promptStrategy?: "focused" | "comprehensive" | "maximum";
  adReferenceFreshness?: number;
  targetPlatform?: "naver" | "google" | "kakao";
  targetAdType?: string;
}

export interface VarietyGenerationResult {
  varieties: Array<{
    variety: CopyVariety;
    label: string;
    description: string;
    copies: string[];
    modelUsed?: string;
    strategy: {
      formula: string;
      triggers: string[];
      style: string;
    };
    tokenUsage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
    cost?: number;  // 개별 variety 비용
  }>;
  totalGenerated: number;
  totalTimeMs: number;
  totalTokenUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  totalCost?: number;
}

export class CopyVarietyGenerator {
  private readonly strategyService = new CopywritingStrategyService();
  private readonly adRefService = new AdReferenceService();
  private readonly providerFactory = LLMProviderFactory.getInstance();

  /**
   * Variety별 최적 LLM 모델 매핑
   * 각 모델의 강점을 활용하여 최고 품질 보장
   */
  private readonly VARIETY_MODEL_MAPPING: Record<CopyVariety, LLMModel> = {
    emotional: "gpt-5", // GPT-5: 창의적, 감성적 표현
    storytelling: "claude-sonnet-4-5", // Claude: 스토리텔링
    data_driven: "gemini-2.5-pro", // Gemini: 논리적, 데이터
    trusted: "gpt-5", // GPT-5: 신뢰성 있는 표현
    direct: "gemini-2.5-flash", // Gemini Flash: 빠르고 직접적
    urgent: "gemini-2.5-flash", // Gemini Flash: 긴급성
    premium: "claude-sonnet-4-5", // Claude: 프리미엄 톤
    ad_reference: "gpt-5", // GPT-5: 광고 패턴
  };

  /**
   * 다양성 기반 카피 생성 (병렬 처리)
   */
  async generateVarieties(
    request: VarietyGenerationRequest
  ): Promise<VarietyGenerationResult> {
    const startTime = Date.now();
    
    // varieties가 없으면 기본 8개 모두 사용
    const varieties = request.varieties ?? [
      "ad_reference",    // 광고 레퍼런스 기반
      "emotional",       // 감성적
      "data_driven",     // 숫자/데이터 기반
      "direct",          // 직관적
      "trusted",         // 검증된
      "storytelling",    // 스토리텔링
      "urgent",          // 긴급성 강조
      "premium",         // 프리미엄
    ];
    
    console.log("\nVariety 생성 시작:", varieties);
    console.log("  - 스타일 개수:", varieties.length, "가지");

    // 각 variety를 병렬로 생성
    const varietyPromises = varieties.map((variety) =>
      this.generateForVariety(variety, request)
    );

    const varietyResults = await Promise.all(varietyPromises);

    // 토큰 사용량 및 비용 집계
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalCost = 0;

    varietyResults.forEach(varietyResult => {
      // generateForVariety는 단일 객체를 반환 (배열이 아님)
      if (varietyResult.tokenUsage) {
        const promptTokens = varietyResult.tokenUsage.promptTokens || 0;
        const completionTokens = varietyResult.tokenUsage.completionTokens || 0;
        totalPromptTokens += promptTokens;
        totalCompletionTokens += completionTokens;
        
        console.log(`  [${varietyResult.label}] 토큰: ${promptTokens + completionTokens} (입력: ${promptTokens}, 출력: ${completionTokens})`);
      }
      if (varietyResult.cost) {
        totalCost += varietyResult.cost;
        console.log(`  [${varietyResult.label}] 비용: $${varietyResult.cost.toFixed(6)}`);
      }
    });
    
    console.log(`\n합계:`);
    console.log(`  - 전체 토큰: ${(totalPromptTokens + totalCompletionTokens).toLocaleString()}`);
    console.log(`  - 전체 비용: $${totalCost.toFixed(6)}`);
    
    // totalCost가 여전히 0이면 토큰 기반으로 계산
    if (totalCost === 0 && (totalPromptTokens > 0 || totalCompletionTokens > 0)) {
      console.log(`  ⚠️ 비용 정보 없음, 토큰 기반으로 추정...`);
      
      // 사용된 모델별 비용 계산
      const modelCosts: Record<string, { input: number; output: number }> = {
        "gpt-5": { input: 0.003 / 1000, output: 0.015 / 1000 },
        "gemini-2.5-pro": { input: 0.0025 / 1000, output: 0.0075 / 1000 },
        "gemini-2.5-flash": { input: 0.0001 / 1000, output: 0.0002 / 1000 },
        "claude-sonnet-4-5": { input: 0.003 / 1000, output: 0.015 / 1000 },
      };
      
      // 평균 비용으로 추정 (GPT-4o 기준)
      const avgInputCost = 0.0025 / 1000;
      const avgOutputCost = 0.01 / 1000;
      totalCost = (totalPromptTokens * avgInputCost) + (totalCompletionTokens * avgOutputCost);
    }
    
    console.log(`\n💰 토큰 사용량 집계:`);
    console.log(`  - 입력 토큰: ${totalPromptTokens.toLocaleString()}`);
    console.log(`  - 출력 토큰: ${totalCompletionTokens.toLocaleString()}`);
    console.log(`  - 총 토큰: ${(totalPromptTokens + totalCompletionTokens).toLocaleString()}`);
    console.log(`  - 총 비용: $${totalCost.toFixed(4)}`);

    // 목표 개수 확인 및 추가 생성
    const totalGenerated = varietyResults.reduce((sum, r) => r.copies.length + sum, 0);
    const targetCount = request.copiesPerVariety * varieties.length;
    
    if (totalGenerated < targetCount) {
      console.log(`\n⚠️ 목표 개수 미달: ${totalGenerated}/${targetCount}`);
      console.log(`🔄 추가 생성 시작...`);
      
      const shortfall = targetCount - totalGenerated;
      const additionalResult = await this.generateAdditionalCopies(
        request,
        shortfall,
        varietyResults
      );
      
      if (additionalResult && additionalResult.copies.length > 0) {
        // 추가 생성된 카피를 가장 적은 variety에 할당
        const minVariety = varietyResults.reduce((min, curr) => 
          curr.copies.length < min.copies.length ? curr : min
        );
        minVariety.copies.push(...additionalResult.copies);
        
        totalPromptTokens += additionalResult.tokenUsage?.promptTokens ?? 0;
        totalCompletionTokens += additionalResult.tokenUsage?.completionTokens ?? 0;
        
        if (additionalResult.tokenUsage) {
          const provider = this.providerFactory.resolve(additionalResult.modelUsed || "gpt-5");
          const additionalCost = provider.calculateCost(additionalResult.tokenUsage);
          totalCost += additionalCost;
        }
        
        console.log(`✅ 추가 생성 완료: ${additionalResult.copies.length}개`);
      }
    }

    return {
      varieties: varietyResults,  // varietyResults는 단일 객체 배열
      totalGenerated: varietyResults.reduce((sum, r) => sum + r.copies.length, 0),
      totalTimeMs: Date.now() - startTime,
      totalTokenUsage: {
        promptTokens: totalPromptTokens,
        completionTokens: totalCompletionTokens,
        totalTokens: totalPromptTokens + totalCompletionTokens
      },
      totalCost
    };
  }
  
  /**
   * 목표 개수 미달 시 추가 생성
   */
  private async generateAdditionalCopies(
    request: VarietyGenerationRequest,
    shortfall: number,
    previousResults: any[]
  ): Promise<{
    copies: string[];
    tokenUsage?: any;
    modelUsed?: LLMModel;
  } | null> {
    // GPT-5를 우선 사용
    const modelsToTry: LLMModel[] = ["gpt-5", "claude-sonnet-4-5"];
    
    // 가장 성공적이었던 variety 찾기
    const successfulVariety = previousResults
      .filter(r => r.copies.length > 0)
      .sort((a, b) => b.copies.length - a.copies.length)[0];
    
    if (!successfulVariety) {
      console.warn("성공한 variety가 없어 추가 생성 불가");
      return null;
    }
    
    const variety = successfulVariety.variety;
    const config = this.getVarietyConfig(variety);
    
    console.log(`  - 사용 스타일: ${config.label}`);
    console.log(`  - 요청 개수: ${shortfall}개`);
    
    for (const model of modelsToTry) {
      try {
        console.log(`  - ${model} 모델로 시도...`);
        
        const prompt = await this.buildVarietyPrompt(
          variety,
          config,
          request.intent,
          request.minChars,
          request.maxChars,
          shortfall
        );
        
        const provider = this.providerFactory.resolve(model);
        const result = await provider.generateCopies({
          prompt,
          minChars: request.minChars,
          maxChars: request.maxChars,
          tone: request.tone,
          count: shortfall,
          creativeGuidelines: [],
        });
        
        if (result.copies && result.copies.length > 0) {
          return {
            copies: result.copies,
            tokenUsage: result.tokenUsage,
            modelUsed: model
          };
        }
      } catch (error) {
        console.warn(`  - ${model} 실패:`, error);
      }
    }
    
    return null;
  }

  /**
   * 특정 variety의 카피 생성 (폴백 메커니즘 포함)
   * 반환값: 단일 variety 객체 (배열이 아님)
   */
  private async generateForVariety(
    variety: CopyVariety,
    request: VarietyGenerationRequest
  ): Promise<{
    variety: CopyVariety;
    label: string;
    description: string;
    copies: string[];
    modelUsed?: string;
    strategy: {
      formula: string;
      triggers: string[];
      style: string;
    };
    tokenUsage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
    cost?: number;
  }> {
    const varietyStartTime = Date.now();
    const config = this.getVarietyConfig(variety);
    
    console.log(`  🔄 [${config.label}] 생성 시작...`);

    // variety별 맞춤 프롬프트 생성
    const prompt = await this.buildVarietyPrompt(
      variety,
      config,
      request.intent,
      request.minChars,
      request.maxChars,
      request.copiesPerVariety
    );

    // ✨ Variety별 최적 모델 자동 선택 및 폴백 준비
    const optimalModel = this.VARIETY_MODEL_MAPPING[variety];
    let selectedModel = request.preferredModel ?? optimalModel;
    
    // 폴백 모델 정의 (Gemini 실패 시 다른 모델로)
    const fallbackModels = this.getFallbackModels(selectedModel, variety);
    
    console.log(`    - 사용 모델: ${selectedModel} (${config.label} 스타일 최적화)`);
    console.log(`    - 요청 개수: ${request.copiesPerVariety}개`);
    console.log(`    - 공식: ${config.formula.name}`);
    console.log(`    - 트리거: ${config.triggers.map(t => t.name).join(", ")}`);
    console.log(`    - 스타일: ${config.style.koreanName}`);
    
    // LLM 호출 (폴백 메커니즘 포함)
    let result: any = null;
    let actualModelUsed = selectedModel;
    let attemptCount = 0;
    
    // 메인 모델 + 폴백 모델들 시도
    const modelsToTry = [selectedModel, ...fallbackModels];
    
    for (const modelToTry of modelsToTry) {
      attemptCount++;
      try {
        if (attemptCount > 1) {
          console.log(`    ⚠️ [${config.label}] ${modelToTry} 모델로 폴백 시도...`);
        }
        
        const provider = this.providerFactory.resolve(modelToTry);
        const llmStartTime = Date.now();
        
        result = await provider.generateCopies({
          prompt,
          minChars: request.minChars,
          maxChars: request.maxChars,
          tone: request.tone,
          count: request.copiesPerVariety,
          creativeGuidelines: [],
        });
        
        const llmDuration = Date.now() - llmStartTime;
        
        // 성공적인 결과 확인 (빈 배열이 아니면 성공)
        if (result.copies && result.copies.length > 0) {
          actualModelUsed = modelToTry;
          console.log(`    ✅ [${config.label}] 생성 완료: ${result.copies.length}개 (${(llmDuration / 1000).toFixed(1)}초)`);
          if (attemptCount > 1) {
            console.log(`    🔄 폴백 성공: ${selectedModel} → ${actualModelUsed}`);
          }
          break;
        } else {
          // 빈 결과인 경우 다음 모델 시도
          console.warn(`    ⚠️ [${config.label}] ${modelToTry} 모델에서 빈 결과, 다음 모델 시도...`);
        }
      } catch (error) {
        console.error(`    ❌ [${config.label}] ${modelToTry} 모델 오류:`, error);
        if (attemptCount === modelsToTry.length) {
          // 모든 모델 실패 시
          console.error(`    🚫 [${config.label}] 모든 모델 실패`);
          return {
            variety,
            label: config.label,
            description: config.description,
            copies: [],
            modelUsed: selectedModel,
            strategy: {
              formula: config.formula.name,
              triggers: config.triggers.map((t) => t.name),
              style: config.style.name,
            },
            // 실패 시에도 시도한 API 호출의 토큰 사용량이 있을 수 있음
            tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
          };
        }
      }
    }
    
    // 결과가 없는 경우 기본값 반환 (토큰은 실제 사용량 반영)
    if (!result || !result.copies || result.copies.length === 0) {
      console.warn(`    ⚠️ [${config.label}] 모든 시도 후에도 결과 없음`);
      return {
        variety,
        label: config.label,
        description: config.description,
        copies: [],
        modelUsed: actualModelUsed,
        strategy: {
          formula: config.formula.name,
          triggers: config.triggers.map((t) => t.name),
          style: config.style.name,
        },
        // 실패했어도 API 호출이 있었다면 토큰 사용량 반영
        tokenUsage: result?.tokenUsage || { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
      };
    }
    
    if (result.copies.length > 0) {
      console.log(`    - 미리보기: "${result.copies[0].substring(0, 40)}${result.copies[0].length > 40 ? '...' : ''}"`);
    }

    // 비용 계산
    const provider = this.providerFactory.resolve(actualModelUsed);
    const cost = provider.calculateCost(result.tokenUsage);
    
    console.log(`    💰 비용: $${cost.toFixed(6)} (${result.tokenUsage.totalTokens} tokens)`);
    
    return {
      variety,
      label: config.label,
      description: config.description,
      copies: result.copies,
      modelUsed: actualModelUsed,
      strategy: {
        formula: config.formula.name,
        triggers: config.triggers.map((t) => t.name),
        style: config.style.name,
      },
      tokenUsage: result.tokenUsage,
      cost: cost  // 비용 추가
    };
  }

  /**
   * 폴백 모델 정의
   */
  private getFallbackModels(primaryModel: LLMModel, variety: CopyVariety): LLMModel[] {
    // Gemini 모델 실패 시 다른 모델로 폴백
    const fallbackMap: Record<LLMModel, LLMModel[]> = {
      "gemini-2.5-pro": ["gpt-5", "claude-sonnet-4-5"],
      "gemini-2.5-flash": ["gpt-5", "gemini-2.5-pro"],
      "gpt-5": ["claude-sonnet-4-5", "gemini-2.5-pro"],
      "claude-sonnet-4-5": ["gpt-5", "gemini-2.5-pro"],
      "gpt-4o": ["gpt-5", "claude-sonnet-4-5"],
      "gpt-4.1": ["gpt-5", "claude-sonnet-4-5"],
    };

    // variety별 특화 폴백
    if (variety === "data_driven" && primaryModel === "gemini-2.5-pro") {
      return ["gpt-5", "claude-sonnet-4-5"]; // 데이터 기반은 GPT-5로 폴백
    }
    if (variety === "direct" && primaryModel === "gemini-2.5-flash") {
      return ["gpt-5", "gemini-2.5-pro"]; // 직관적은 GPT-5로 폴백
    }

    return fallbackMap[primaryModel] || ["gpt-5"]; // 기본 폴백은 GPT-5
  }

  /**
   * Variety별 설정 정의
   */
  private getVarietyConfig(variety: CopyVariety): {
    label: string;
    description: string;
    formula: CopywritingFormula;
    triggers: PsychologicalTrigger[];
    style: CopywriterStyle;
  } {
    const configs: Record<
      CopyVariety,
      {
        label: string;
        description: string;
        formulaId: string;
        triggerIds: number[];
        styleId: string;
      }
    > = {
      ad_reference: {
        label: "광고 레퍼런스 기반",
        description: "실제 집행 중인 광고를 참고한 검증된 스타일",
        formulaId: "AIDA",
        triggerIds: [8, 10, 13], // 긴급성, 희소성, 사회적증명
        styleId: "JOSEPH_SUGARMAN",
      },
      emotional: {
        label: "감성적",
        description: "감정에 호소하는 친밀하고 공감적인 메시지",
        formulaId: "AIDA",
        triggerIds: [1, 17, 24], // 소유감, 스토리텔링, 감정연결
        styleId: "GARY_HALBERT",
      },
      data_driven: {
        label: "숫자/데이터 기반",
        description: "구체적 수치와 증거로 신뢰를 구축",
        formulaId: "FAB",
        triggerIds: [5, 12, 15], // 가치증명, 권위, 구체성
        styleId: "DAVID_OGILVY",
      },
      direct: {
        label: "직관적",
        description: "짧고 강렬하게 핵심만 전달",
        formulaId: "FOUR_U",
        triggerIds: [8, 15, 18], // 긴급성, 구체성, 호기심
        styleId: "JOHN_CAPLES",
      },
      trusted: {
        label: "검증된",
        description: "사회적 증명과 권위로 신뢰 구축",
        formulaId: "ACCA",
        triggerIds: [12, 13, 22], // 권위, 사회적증명, 전문성
        styleId: "DAVID_OGILVY",
      },
      storytelling: {
        label: "스토리텔링",
        description: "이야기로 감정적 연결 형성",
        formulaId: "BAB",
        triggerIds: [17, 24, 1], // 스토리텔링, 감정연결, 소유감
        styleId: "GARY_HALBERT",
      },
      urgent: {
        label: "긴급성 강조",
        description: "지금 당장 행동하게 만드는 강력한 메시지",
        formulaId: "AIDA",
        triggerIds: [8, 10, 11], // 긴급성, 희소성, 제한
        styleId: "DAN_KENNEDY",
      },
      premium: {
        label: "프리미엄",
        description: "고급스럽고 품격 있는 메시지",
        formulaId: "OGILVY_5",
        triggerIds: [3, 12, 16], // 신뢰성, 권위, 친숙성
        styleId: "DAVID_OGILVY",
      },
    };

    const config = configs[variety];

    return {
      label: config.label,
      description: config.description,
      formula: COPYWRITING_FORMULAS[config.formulaId],
      triggers: config.triggerIds
        .map((id) => getTriggerById(id))
        .filter((t): t is PsychologicalTrigger => t !== undefined),
      style: COPYWRITER_STYLES[config.styleId],
    };
  }

  /**
   * Variety별 맞춤 프롬프트 생성
   */
  private async buildVarietyPrompt(
    variety: CopyVariety,
    config: ReturnType<typeof this.getVarietyConfig>,
    intent: IntentData,
    minChars: number,
    maxChars: number,
    count: number
  ): Promise<string> {
    let specialSection = "";

    // 광고 레퍼런스 variety면 실제 광고 추가
    if (variety === "ad_reference") {
      const adRefs = await this.adRefService.findSimilarAds(intent, { limit: 30 }); // 30개로 증가 (DB 누적)
      if (adRefs.length > 0) {
        const top3 = adRefs.slice(0, 3);
        specialSection = `
## 📺 실제 광고 레퍼런스 (참고용 - 절대적 우선순위 아님)

**⚠️ 중요: 아래 레퍼런스는 참고용입니다. 사용자가 명시한 요구사항을 절대적으로 우선시하세요.**

${top3
  .map(
    (ref, idx) => `
${idx + 1}. [${ref.platform.toUpperCase()}] "${ref.adCopy}"
   - 성과: CTR ${ref.engagement?.ctr?.toFixed(1) ?? "N/A"}%
   - 트리거: ${ref.analysis?.triggers?.join(", ") ?? "없음"}
`
  )
  .join("\n")}

### 레퍼런스 활용 가이드
- ✅ 사용자가 명시한 제품명, 타겟, 톤, 키워드를 **그대로 반영**
- ✅ 레퍼런스의 **구조나 패턴**을 창의적으로 응용
- ❌ 레퍼런스의 **내용을 그대로 복사하지 않음**
- ❌ 사용자 요구사항과 **무관한 레퍼런스는 무시**

**핵심 원칙: 사용자 입력(100%) > 레퍼런스(참고용)**
`;
      }
    }

    // Gemini 모델용 극단적으로 단순한 프롬프트
    const isGemini = variety === 'data_driven' || variety === 'direct' || variety === 'urgent';
    
    if (isGemini) {
      // 제품/타겟 정보 구성
      const productInfo = intent.productName || "IT 스타트업";
      const targetInfo = intent.targetAudience || "비즈니스 고객";
      
      // 스타일별 간단한 지침
      let styleGuide = "";
      if (variety === 'data_driven') {
        styleGuide = "숫자나 퍼센트를 포함하여 신뢰성을 높이세요. (예: 95%, 10배, 1위)";
      } else if (variety === 'direct') {
        styleGuide = "짧고 강렬하게, 핵심만 전달하세요.";
      } else if (variety === 'urgent') {
        styleGuide = "긴급성을 강조하세요. (예: 오늘까지, 지금, 마감임박)";
      }
      
      return `${productInfo} 광고 카피 ${count}개를 작성하세요.

고객: ${targetInfo}
스타일: ${styleGuide}

조건:
- ${minChars}-${maxChars}자
- ${count}개 생성
- 이모지/이모티콘 절대 사용 금지 (🌟, ✨, 💎 등)

출력:
{"copies": ["카피1"]}`;
    }
    
    // 기본 프롬프트 (GPT, Claude용)
    // 제품/타겟 정보 구성
    const productInfo = intent.productName || "IT 스타트업 홈페이지";
    const targetInfo = intent.targetAudience || "일반 고객";
    const benefitsInfo = intent.keyBenefits?.join(", ") || "혁신적이고 전문적인 서비스";
    
    return `당신은 ${config.style.koreanName}(${config.style.name}) 스타일의 카피라이터입니다.

## 스타일 철학
${config.style.philosophy}

## 이번 생성 목표: ${config.label}
${config.description}

## 적용 공식: ${config.formula.name}
${config.formula.steps.map((s, i) => `${i + 1}. ${s.name}: ${s.focus}`).join("\n")}

## 적용 심리 트리거
${config.triggers
  .map(
    (t) => `
- **${t.name}** (효과도: ${t.effectiveness}/5)
  사용법: ${t.usageContext}
  키워드: ${t.keywords.slice(0, 3).join(", ")}
`
  )
  .join("\n")}

${specialSection}

## 생성 요구사항
- 제품: ${productInfo}
- 타겟: ${targetInfo}
- 주요 베네핏: ${benefitsInfo}
- 글자수: ${minChars}-${maxChars}자
- 개수: ${count}개
- 톤: ${config.style.writingStyle}

## 작성 원칙 (이번 스타일 집중)
${this.getVarietyPrinciples(variety)}

## 출력 형식 (중요!)
반드시 아래 JSON 객체 형식으로만 응답하세요:
{"copies": ["첫 번째 카피", "두 번째 카피"]}

주의사항:
- JSON 외에 설명이나 다른 텍스트 절대 금지
- 정확히 ${count}개 생성
- 각 카피는 ${minChars}-${maxChars}자 범위 준수
- 실제 광고 카피만 작성 (안내문 금지)
- 이모지/이모티콘 절대 사용 금지 (🌟, ✨, 💎 등 모든 이모지)`;
  }

  /**
   * Variety별 작성 원칙
   */
  private getVarietyPrinciples(variety: CopyVariety): string {
    const principles: Record<CopyVariety, string> = {
      ad_reference: `
핵심: 실제 광고처럼 프로모션 언어를 적극 사용하세요!
1. 광고성 키워드 필수: "특가", "할인", "이벤트", "한정", "오늘만"
2. 명확한 CTA 포함: "지금 구매", "바로 확인", "놓치지 마세요"
3. 혜택 중심 메시지: 할인율, 무료배송, 사은품 강조
4. 긴급성 표현: "단 3일", "선착순", "품절임박"
5. 프로모션 톤 유지
6. 이모지/이모티콘 절대 사용 금지`,

      emotional: `
핵심: 감정에 호소하는 따뜻한 문체를 사용하세요!
1. 감성적 형용사 필수: "따뜻한", "소중한", "특별한", "행복한"
2. 공감 표현: "~하시죠?", "~하셨나요?", "우리 모두"
3. 스토리텔링: 경험과 감정 공유
4. 부드러운 어조: 친근하고 다정한 말투
5. 마음을 움직이는 메시지
6. 이모지/이모티콘 절대 사용 금지`,

      data_driven: `
핵심: 숫자나 데이터를 활용하여 신뢰성을 높이세요!
1. 가능하면 숫자 포함: "95%", "10,000명", "3배"
2. 통계적 표현: "연구결과", "실험", "데이터"
3. 비교 표현: "기존 대비", "경쟁사보다"
4. 객관적 근거: 인증, 특허, 수상
5. 논리적 설득
6. 이모지/이모티콘 절대 사용 금지`,

      direct: `
핵심: 최대한 짧고 강렬하게! 핵심만!
1. 15자 이내 문장
2. 단어 최소화
3. 즉각적 이해
4. 강한 동사 사용
5. 군더더기 제로
6. 이모지/이모티콘 절대 사용 금지`,

      trusted: `
핵심: 신뢰와 권위를 강조하세요!
1. 사회적 증명 필수: "100만 고객", "별점 4.9", "1위"
2. 인증/수상: "특허받은", "대상 수상", "정부인증"
3. 전문가 추천: "의사 추천", "전문가 선택"
4. 고객 후기: "98% 만족", "재구매율 90%"
5. 검증된 품질
6. 이모지/이모티콘 절대 사용 금지`,

      storytelling: `
핵심: 이야기 형식으로 서사 구조를 만드세요!
1. 시작: "처음엔..." / "예전엔..."
2. 갈등: "하지만..." / "문제는..."
3. 전환: "그러던 중..." / "드디어..."
4. 해결: "이제는..." / "결과적으로..."
5. 변화의 여정 묘사
6. 이모지/이모티콘 절대 사용 금지`,

      urgent: `
핵심: 긴급성 키워드를 반드시 사용하세요!
1. 시간 제한 필수: "오늘까지", "24시간", "마감임박"
2. 수량 제한: "단 10개", "품절임박", "재고소진"
3. FOMO 자극: "놓치면 후회", "다시없는 기회"
4. 즉시 행동: "지금 바로", "곧 종료", "서두르세요"
5. 카운트다운 느낌
6. 이모지/이모티콘 절대 사용 금지`,

      premium: `
핵심: 고급스럽고 품격있는 어조를 사용하세요!
1. 프리미엄 어휘: "럭셔리", "프레스티지", "익스클루시브"
2. 격조 높은 문체: 경어체, 품격있는 표현
3. 배타성: "특별한 분들께", "선별된 고객님"
4. 디테일: 섬세한 묘사, 감각적 표현
5. 절제된 우아함
6. 이모지/이모티콘 절대 사용 금지`,
    };

    return principles[variety];
  }

  /**
   * 자동 분배: 요청 개수를 8가지 스타일로 자동 분배
   */
  distributeVarieties(totalCount: number, requestedVarieties?: CopyVariety[]): Array<{
    variety: CopyVariety;
    count: number;
  }> {
    // varieties가 제공되면 그것을 사용, 없으면 8가지 모두 사용
    // 개수가 적으면 각 스타일당 최소 1개씩, 많으면 균등 분배

    const distribution: Array<{ variety: CopyVariety; count: number }> = [];

    // varieties 결정: 요청된 것이 있으면 사용, 없으면 8가지 모두 포함
    const allVarieties: CopyVariety[] = requestedVarieties ?? [
      "ad_reference",    // 광고 레퍼런스 기반
      "emotional",        // 감성적
      "data_driven",      // 숫자/데이터 기반
      "direct",           // 직관적
      "trusted",          // 검증된
      "storytelling",     // 스토리텔링
      "urgent",           // 긴급성 강조
      "premium",          // 프리미엄
    ];

    // 요청 개수가 8개 미만이면 각 스타일당 1개씩 (8개 생성)
    if (totalCount < 8) {
      allVarieties.forEach((variety) => {
        distribution.push({
          variety,
          count: 1,
        });
      });
    } else {
      // 8개 이상이면 균등 분배
      const countPerVariety = Math.floor(totalCount / allVarieties.length);
      const remainder = totalCount % allVarieties.length;

      allVarieties.forEach((variety, idx) => {
        distribution.push({
          variety,
          count: countPerVariety + (idx < remainder ? 1 : 0),
        });
      });
    }

    return distribution.filter((d) => d.count > 0);
  }
}

