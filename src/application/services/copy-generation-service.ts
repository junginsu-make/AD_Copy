// 카피 생성 서비스 (비즈니스 로직)
import { LLMProviderFactory } from "@/src/infrastructure/ai/llm-provider-factory";
import type {
  CreativeGuideline,
  GenerationRequest,
  TokenUsage,
  LLMModel,
  LLMProvider,
} from "@/src/infrastructure/ai/types";
import { ValidationService } from "./validation-service";
import { db } from "@/src/infrastructure/database";
import { copies, users, analytics } from "@/src/infrastructure/database/schema";
import { eq, sql, and, gte } from "drizzle-orm";
import { ModelUsageLogger } from "./model-usage-logger";
import {
  IntentExtractionService,
  type IntentData,
} from "./intent-extraction-service";
import { PromptOptimizer } from "./prompt-optimizer";
import { LengthDiversityService } from "./length-diversity-service";
import { MultiModelGenerationService } from "./multi-model-generation-service";
import { CopyRerankingService } from "./copy-reranking-service";
import { CopyVarietyGenerator } from "./copy-variety-generator";

export type CopyVariety =
  | "ad_reference" // 실제 광고 레퍼런스 기반
  | "emotional" // 감성적
  | "data_driven" // 숫자/데이터 기반
  | "direct" // 직관적/짧은
  | "trusted" // 검증된/신뢰
  | "storytelling" // 스토리텔링
  | "urgent" // 긴급성 강조
  | "premium"; // 프리미엄

export interface CopyGenerationRequest {
  userId: number;
  prompt: string;
  minChars?: number;
  maxChars?: number;
  tone?: string;
  count?: number;  // 더 이상 사용 안함 (모드별 고정)
  templateId?: number;
  preferredModel?: LLMModel;
  creativeGuidelines?: CreativeGuideline[];
  sessionId?: number;
  intent?: IntentData;
  
  // 생성 모드
  generationMode?: "single" | "multi" | "ensemble" | "variety"; // variety 추가
  enableReranking?: boolean;
  
  // 글자 수 설정 (새로운 시스템)
  targetCharCount?: number;  // 사용자 지정 글자 수
  charCountMode?: "auto" | "fixed";  // auto: AI 결정, fixed: 사용자 지정
  
  // 카피라이팅 이론 & 레퍼런스
  useCopywritingTheory?: boolean; // 기본값: true
  useAdReferences?: boolean; // 기본값: false (속도 고려)
  
  // 다양성 모드
  varieties?: CopyVariety[]; // 원하는 스타일들
  autoDistribute?: boolean; // 자동으로 다양성 분배 (기본값: true)
  
  // 프롬프트 전략 (✨ NEW!)
  promptStrategy?: "focused" | "comprehensive" | "maximum"; // 기본값: comprehensive
  
  // 광고 신선도
  adReferenceFreshness?: number; // 최근 N일 이내 (기본값: 90일)
  
  // 광고매체 선택 (✨ 선택적 옵션!)
  targetPlatform?: "naver" | "google" | "kakao"; // 선택 시에만 해당 플랫폼 규격 준수
  targetAdType?: string; // 광고 유형 (파워링크, 검색광고 등)
}

export interface GeneratedCopy {
  id: number;
  content: string;
  charCount: number;
  generatedAt: Date;
  
  // 메타데이터
  modelUsed?: string;
  lengthCategory?: "short" | "medium" | "long";
  recommendedChannel?: string;
  rank?: number;
  rankingReason?: string;
  
  // 다양성 메타데이터 (✨ NEW!)
  variety?: CopyVariety;
  varietyLabel?: string;
  strategy?: {
    formula: string;
    triggers: string[];
    style: string;
  };
}

export interface CopyGenerationResponse {
  copies: GeneratedCopy[];
  generationTimeMs: number;
  apiCost: number;
  modelUsed: LLMModel | string;
  tokenUsage: TokenUsage;
  intent: IntentData;
  modelsUsed?: string[]; // 멀티모델 모드에서 사용
}

export class CopyGenerationService {
  private readonly validationService = new ValidationService();
  private readonly providerFactory = LLMProviderFactory.getInstance();
  private readonly usageLogger = new ModelUsageLogger();
  private readonly intentExtractor = new IntentExtractionService();
  private readonly promptOptimizer = new PromptOptimizer();
  private readonly lengthDiversityService = new LengthDiversityService();
  private readonly multiModelService = new MultiModelGenerationService();
  private readonly rerankingService = new CopyRerankingService();
  private readonly varietyGenerator = new CopyVarietyGenerator();

  async generate(request: CopyGenerationRequest): Promise<CopyGenerationResponse> {
    // 생성 모드에 따라 분기 (기본값: variety)
    const mode = request.generationMode ?? "variety";
    
    console.log("\n" + "=".repeat(60));
    console.log(`🚀 Pltt. AD Copy - 카피 생성 시작 - 모드: ${mode.toUpperCase()}`);
    console.log("=".repeat(60));
    console.log(`📝 사용자 입력: ${request.prompt.substring(0, 100)}${request.prompt.length > 100 ? '...' : ''}`);
    console.log(`⚙️  요청 옵션:`);
    console.log(`   - 생성 개수: ${request.count ?? 10}개`);
    console.log(`   - 생성 모드: ${mode}`);
    console.log(`   - 톤: ${request.tone || '자동'}`);
    console.log(`   - 광고 레퍼런스: ${request.useAdReferences ? '사용' : '미사용'}`);
    console.log(`   - 카피라이팅 이론: ${request.useCopywritingTheory !== false ? '사용' : '미사용'}`);
    console.log(`   - 프롬프트 전략: ${request.promptStrategy || 'comprehensive'}`);
    console.log("=".repeat(60) + "\n");
    
    if (mode === "variety") {
      return this.generateWithVariety(request);
    }
    
    if (mode === "multi" || mode === "ensemble") {
      return this.generateWithMultiModel(request);
    }
    
    return this.generateWithSingleModel(request);
  }
  
  /**
   * 다양성 기반 생성 (✨ NEW!)
   * 여러 스타일의 카피를 병렬로 생성
   */
  private async generateWithVariety(request: CopyGenerationRequest): Promise<CopyGenerationResponse> {
    const startTime = Date.now();
    
    console.log("🎨 다양성 생성 모드 시작");
    console.log("=".repeat(60));
    
    // 1. 의도 추출 (토큰 사용량 추적)
    let intentExtractionTokens = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    let intent = request.intent;
    
    if (!intent) {
      console.log(`\n🧠 의도 추출 시작 (Gemini 2.5 Flash)...`);
      intent = await this.intentExtractor.extract(request.prompt);
      // Intent Extraction은 약 500-1000 토큰 사용 (추정)
      intentExtractionTokens = { promptTokens: 500, completionTokens: 300, totalTokens: 800 };
      console.log(`  - 추정 토큰: ${intentExtractionTokens.totalTokens}개`);
    }
    
    // 글자 수 설정 (새로운 시스템)
    let resolvedMin: number;
    let resolvedMax: number;
    
    if (request.charCountMode === "fixed" && request.targetCharCount) {
      // 사용자 지정 글자 수 (±5자 범위)
      resolvedMin = Math.max(10, request.targetCharCount - 5);
      resolvedMax = Math.min(200, request.targetCharCount + 5);
      console.log(`📏 글자 수: ${request.targetCharCount}자 고정 (범위: ${resolvedMin}~${resolvedMax}자)`);
    } else {
      // AI가 자동 결정 (기존 방식)
      resolvedMin = request.minChars ?? intent.minChars ?? 15;
      resolvedMax = request.maxChars ?? intent.maxChars ?? 100;
      console.log(`📏 글자 수: AI 자동 결정 (범위: ${resolvedMin}~${resolvedMax}자)`);
    }
    
    const resolvedTone = request.tone ?? intent.tone ?? "neutral";
    
    // Variety 모드는 고정 개수: 8개 스타일 × 3개 = 24개
    const COPIES_PER_VARIETY = 3;
    const requestedCount = 24;  // 고정
    
    console.log(`📊 Variety 모드: 스타일당 ${COPIES_PER_VARIETY}개씩 생성 (총 ${requestedCount}개 예상)`);
    
    // 2. 다양성 분배
    const varietyDistribution = this.varietyGenerator.distributeVarieties(
      requestedCount,
      request.varieties ?? undefined
    );
    
    console.log(`📊 스타일별 분배:`);
    varietyDistribution.forEach((dist, idx) => {
      console.log(`  ${idx + 1}. ${dist.variety}: ${dist.count}개`);
    });
    
    // 3. 병렬 생성 (각 variety별)
    // 각 variety별로 개별적으로 개수 지정
    const varietyPromises = varietyDistribution.map(dist => 
      this.varietyGenerator.generateVarieties({
        intent,
        minChars: resolvedMin,
        maxChars: resolvedMax,
        tone: resolvedTone,
        varieties: [dist.variety],
        copiesPerVariety: dist.count,
        preferredModel: request.preferredModel,
        prompt: request.prompt,
        useCopywritingTheory: request.useCopywritingTheory,
        useAdReferences: request.useAdReferences,
        promptStrategy: request.promptStrategy,
        adReferenceFreshness: request.adReferenceFreshness,
        targetPlatform: request.targetPlatform,
        targetAdType: request.targetAdType,
      })
    );
    
    console.log(`⏳ 8가지 스타일별 병렬 생성 시작...\n`);
    const allVarietyResults = await Promise.all(varietyPromises);
    
    console.log(`\n${"=".repeat(60)}`);
    console.log(`📊 스타일별 생성 결과:`);
    console.log(`${"=".repeat(60)}`);
    
    // 결과 병합 및 토큰/비용 집계
    const varietyResults = {
      varieties: allVarietyResults.flatMap(r => r.varieties),
      totalGenerated: allVarietyResults.reduce((sum, r) => sum + r.totalGenerated, 0),
      totalTimeMs: Math.max(...allVarietyResults.map(r => r.totalTimeMs)),
      // 모든 variety 결과의 토큰 사용량 합산
      totalTokenUsage: {
        promptTokens: allVarietyResults.reduce((sum, r) => sum + (r.totalTokenUsage?.promptTokens ?? 0), 0),
        completionTokens: allVarietyResults.reduce((sum, r) => sum + (r.totalTokenUsage?.completionTokens ?? 0), 0),
        totalTokens: allVarietyResults.reduce((sum, r) => sum + (r.totalTokenUsage?.totalTokens ?? 0), 0),
      },
      // 모든 variety 결과의 비용 합산
      totalCost: allVarietyResults.reduce((sum, r) => sum + (r.totalCost ?? 0), 0),
    };
    
    // 각 스타일별 결과 출력
    varietyResults.varieties.forEach((result, idx) => {
      console.log(`\n${idx + 1}. [${result.label}] (${result.variety})`);
      console.log(`   - 생성 개수: ${result.copies.length}개`);
      console.log(`   - 사용 모델: ${result.modelUsed || "N/A"}`);
      console.log(`   - 공식: ${result.strategy?.formula || "N/A"}`);
      console.log(`   - 스타일: ${result.strategy?.style || "N/A"}`);
      if (result.copies.length > 0) {
        console.log(`   - 카피 미리보기:`);
        result.copies.slice(0, 2).forEach((copy, cidx) => {
          console.log(`     ${cidx + 1}. [${copy.length}자] ${copy.substring(0, 40)}${copy.length > 40 ? '...' : ''}`);
        });
      } else {
        console.log(`   ⚠️  생성된 카피가 없습니다.`);
      }
    });
    
    // 4. 결과 병합 및 저장
    const allCopies: GeneratedCopy[] = [];
    
    for (const varietyResult of varietyResults.varieties) {
      for (const copy of varietyResult.copies) {
        allCopies.push({
          id: Date.now() + allCopies.length,
          content: copy,
          charCount: copy.length,
          generatedAt: new Date(),
          variety: varietyResult.variety,
          varietyLabel: varietyResult.label,
          strategy: varietyResult.strategy,
        });
      }
    }
    
    console.log(`\n${"=".repeat(60)}`);
    console.log(`✅ 다양성 생성 완료`);
    console.log(`${"=".repeat(60)}`);
    console.log(`📊 최종 결과:`);
    console.log(`  - 총 카피: ${allCopies.length}개`);
    console.log(`  - 사용된 스타일: ${varietyResults.varieties.length}가지`);
    console.log(`  - 생성 시간: ${((Date.now() - startTime) / 1000).toFixed(1)}초`);
    console.log(`\n📝 생성된 카피 미리보기 (전체):`);
    allCopies.slice(0, 10).forEach((copy, idx) => {
      console.log(`  ${idx + 1}. [${copy.varietyLabel || copy.variety}] [${copy.charCount}자] ${copy.content.substring(0, 50)}${copy.content.length > 50 ? '...' : ''}`);
    });
    if (allCopies.length > 10) {
      console.log(`  ... 외 ${allCopies.length - 10}개`);
    }
    console.log(`${"=".repeat(60)}\n`);
    
    // 토큰 사용량 및 비용 계산
    const modelsUsed = new Set<string>();
    
    // 각 variety 결과에서 모델 정보 수집
    varietyResults.varieties.forEach(varietyResult => {
      if (varietyResult.modelUsed) {
        modelsUsed.add(varietyResult.modelUsed);
      }
    });
    
    // varietyResults에서 이미 집계된 토큰 정보 사용 + Intent Extraction 토큰 추가
    const totalPromptTokens = (varietyResults.totalTokenUsage?.promptTokens ?? 0) + intentExtractionTokens.promptTokens;
    const totalCompletionTokens = (varietyResults.totalTokenUsage?.completionTokens ?? 0) + intentExtractionTokens.completionTokens;
    let totalApiCost = varietyResults.totalCost ?? 0;
    
    // Intent Extraction 비용 추가 (Gemini Flash: 매우 저렴)
    if (intentExtractionTokens.totalTokens > 0) {
      const intentCost = (intentExtractionTokens.promptTokens * 0.0001 / 1000) + (intentExtractionTokens.completionTokens * 0.0002 / 1000);
      totalApiCost += intentCost;
    }
    
    console.log(`\n💰 Variety 모드 최종 집계:`);
    console.log(`  - 총 입력 토큰: ${totalPromptTokens.toLocaleString()}`);
    console.log(`  - 총 출력 토큰: ${totalCompletionTokens.toLocaleString()}`);
    console.log(`  - 총 토큰: ${(totalPromptTokens + totalCompletionTokens).toLocaleString()}`);
    console.log(`  - 총 비용: $${totalApiCost.toFixed(4)}`);
    
    // 토큰이 0이면 경고
    if (totalPromptTokens === 0 && totalCompletionTokens === 0) {
      console.warn(`  ⚠️ 경고: 토큰 사용량이 0입니다. LLM Provider의 tokenUsage 반환 확인 필요`);
    }
    
    // DB에 저장 (실시간 업데이트를 위해)
    console.log(`\n💾 데이터베이스 저장 시작...`);
    const savedCopies = await this.saveCopies(
      allCopies.map(copy => ({
        content: copy.content,
        charCount: copy.charCount,
        modelUsed: copy.variety || "variety-mode",
        lengthCategory: copy.charCount <= 30 ? "short" : copy.charCount <= 60 ? "medium" : "long",
        recommendedChannel: undefined,
        rank: undefined,
        rankingReason: copy.varietyLabel,
      })),
      request,
      intent,
      totalApiCost
    );
    console.log(`✅ 데이터베이스 저장 완료: ${savedCopies.length}개`);
    
    // API 사용량 업데이트
    try {
      await db
        .update(users)
        .set({
          apiQuotaUsed: sql`${users.apiQuotaUsed} + ${savedCopies.length}`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, request.userId));
      console.log(`✅ API 사용량 업데이트: +${savedCopies.length}개`);
    } catch (error) {
      console.warn("API 사용량 업데이트 실패:", error);
    }
    
    // Analytics 테이블 업데이트 (슈퍼베이스 통계 연동)
    const finalGenerationTime = Date.now() - startTime;
    await this.updateAnalytics(
      request.userId,
      savedCopies.length,           // 생성된 카피 수
      savedCopies.length,           // 성공한 카피 수
      0,                            // 실패한 카피 수
      modelsUsed.size,              // API 호출 수 (모델 개수)
      finalGenerationTime,          // 평균 생성 시간
      totalApiCost                  // 총 비용
    );
    
    return {
      copies: allCopies,
      generationTimeMs: finalGenerationTime,
      apiCost: totalApiCost,
      modelUsed: "variety-mode",
      modelsUsed: Array.from(modelsUsed),
      tokenUsage: { 
        promptTokens: totalPromptTokens, 
        completionTokens: totalCompletionTokens, 
        totalTokens: totalPromptTokens + totalCompletionTokens 
      },
      intent,
    };
  }
  
  /**
   * 멀티모델 병렬 생성
   * 고정: 각 모델당 5개씩 생성하여 총 15개 반환
   */
  private async generateWithMultiModel(request: CopyGenerationRequest): Promise<CopyGenerationResponse> {
    const startTime = Date.now();
    
    // Multi 모드 고정 설정
    const COPIES_PER_MODEL = 5;
    const requestedCount = 15;  // 3개 모델 × 5개 = 15개 고정
    
    console.log(`🎯 Multi 모드 시작: 모델당 ${COPIES_PER_MODEL}개씩 생성 (총 ${requestedCount}개)`);
    
    // 1단계: 의도 추출 (Gemini Flash)
    const intent =
      request.intent ?? (await this.intentExtractor.extract(request.prompt));
    
    // 2단계: 3개 모델 준비
    const providers = this.providerFactory.getGenerationProviders().slice(0, 3);
    
    console.log("\n🌐 멀티모델 생성 모드");
    console.log(`  - 각 모델당 ${COPIES_PER_MODEL}개씩 생성`);
    console.log(`  - 총 목표: ${requestedCount}개`);
    console.log(`  - 사용 모델: ${providers.map(p => p.modelName).join(", ")}`);
    
    // 글자 수 설정
    let resolvedMin: number;
    let resolvedMax: number;
    
    if (request.charCountMode === "fixed" && request.targetCharCount) {
      resolvedMin = Math.max(10, request.targetCharCount - 5);
      resolvedMax = Math.min(200, request.targetCharCount + 5);
      console.log(`📏 글자 수: ${request.targetCharCount}자 고정`);
    } else {
      resolvedMin = request.minChars ?? intent.minChars ?? 15;
      resolvedMax = request.maxChars ?? intent.maxChars ?? 100;
      console.log(`📏 글자 수: AI 자동 결정`);
    }
    
    // 3단계: 프롬프트 최적화
    let optimizedPrompt = await this.promptOptimizer.build({
      rawPrompt: request.prompt,
      intent,
      minChars: resolvedMin,
      maxChars: resolvedMax,
      tone: request.tone ?? intent.tone ?? "neutral",
      count: COPIES_PER_MODEL,
      customTemplate: process.env.COPY_PROMPT_TEMPLATE,
      useCopywritingTheory: request.useCopywritingTheory,
      useAdReferences: request.useAdReferences,
      promptStrategy: request.promptStrategy,
      adReferenceFreshness: request.adReferenceFreshness,
      targetPlatform: request.targetPlatform,
      targetAdType: request.targetAdType,
    });
    
    // 글자 수가 고정 모드이면 프롬프트에 강조
    if (request.charCountMode === "fixed" && request.targetCharCount) {
      optimizedPrompt = `**중요: 모든 카피는 정확히 ${request.targetCharCount}자(±3자)로 작성하세요.**\n\n` + optimizedPrompt;
    }
    
    // 4단계: 멀티모델 병렬 생성 (각 모델당 더 많이 요청)
    const modelPromises = providers.map((provider) => {
      // Gemini 모델은 생성률이 낮으므로 더 많이 요청
      const isGemini = provider.modelName.toLowerCase().includes('gemini');
      const requestCount = isGemini ? COPIES_PER_MODEL + 3 : COPIES_PER_MODEL + 1;
      
      console.log(`  - ${provider.modelName}: ${requestCount}개 요청`);
      
      return provider.generateCopies({
        prompt: optimizedPrompt,
        minChars: resolvedMin,
        maxChars: resolvedMax,
        tone: request.tone ?? intent.tone ?? "neutral",
        count: requestCount,
        creativeGuidelines: [],
      });
    });
    
    const modelResults = await Promise.allSettled(modelPromises);
    
    // 결과 취합
    const allCopies: any[] = [];
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    
    let totalCost = 0;
    
    modelResults.forEach((result, idx) => {
      if (result.status === 'fulfilled') {
        const provider = providers[idx];
        const value = result.value;
        
        // 각 카피에 모델명 할당
        value.copies.forEach(copy => {
          allCopies.push({
            content: copy,
            modelUsed: provider.modelName, // 정확한 모델명 사용
            charCount: copy.length,
          });
        });
        
        // 토큰 필드명 수정 (inputTokens/outputTokens → promptTokens/completionTokens)
        const promptTokens = value.tokenUsage?.promptTokens || 0;
        const completionTokens = value.tokenUsage?.completionTokens || 0;
        
        totalPromptTokens += promptTokens;
        totalCompletionTokens += completionTokens;
        
        // 비용 계산 (Provider의 calculateCost 메서드 사용)
        const providerCost = provider.calculateCost({
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
        });
        totalCost += providerCost;
        
        console.log(`  ✅ ${provider.modelName}: ${value.copies.length}개 생성, ${promptTokens + completionTokens} 토큰, $${providerCost.toFixed(4)}`);
      } else {
        console.warn(`  ⚠️ ${providers[idx]?.modelName || 'Unknown'}: 생성 실패`, result.reason?.message || result.reason);
      }
    });
    
    // 5단계: 각 모델별로 최대 5개씩 선택
    const modelGroups: Record<string, any[]> = {};
    
    // 모델별로 그룹화
    allCopies.forEach(copy => {
      const model = copy.modelUsed;
      if (!modelGroups[model]) {
        modelGroups[model] = [];
      }
      modelGroups[model].push(copy);
    });
    
    // 각 모델에서 5개씩 선택 (공평하게 분배)
    const trimmedCopies: any[] = [];
    const modelNames = Object.keys(modelGroups);
    
    // 각 모델별로 정확히 5개씩 선택
    for (const model of modelNames) {
      const copies = modelGroups[model];
      const selected = copies.slice(0, COPIES_PER_MODEL);
      trimmedCopies.push(...selected);
      console.log(`  ✓ ${model}: ${selected.length}/${COPIES_PER_MODEL}개 선택`);
      
      // 부족한 경우 경고
      if (selected.length < COPIES_PER_MODEL) {
        console.warn(`  ⚠️ ${model}: ${COPIES_PER_MODEL - selected.length}개 부족`);
      }
    }
    
    // 전체적으로 부족한 경우 남은 카피에서 추가
    if (trimmedCopies.length < requestedCount) {
      const remaining = allCopies.filter(c => !trimmedCopies.includes(c));
      const needed = requestedCount - trimmedCopies.length;
      
      if (remaining.length > 0 && needed > 0) {
        // 각 모델별로 공평하게 추가 분배
        const additionalPerModel = Math.ceil(needed / modelNames.length);
        let addedCount = 0;
        
        for (const model of modelNames) {
          if (addedCount >= needed) break;
          
          const modelRemaining = remaining.filter(c => c.modelUsed === model);
          const toAdd = Math.min(additionalPerModel, modelRemaining.length, needed - addedCount);
          
          if (toAdd > 0) {
            trimmedCopies.push(...modelRemaining.slice(0, toAdd));
            addedCount += toAdd;
            console.log(`  + ${model}: ${toAdd}개 추가 보충`);
          }
        }
        
        // 그래도 부족하면 남은 것 모두 추가
        if (addedCount < needed) {
          const finalRemaining = remaining.slice(addedCount, needed);
          trimmedCopies.push(...finalRemaining);
          console.log(`  + 최종 보충: ${finalRemaining.length}개`);
        }
      }
    }
    
    // 6단계: DB 저장용 포맷
    const formattedCopies = trimmedCopies.map((copy, idx) => ({
      id: Date.now() + idx,
      content: copy.content,
      charCount: copy.charCount,
      generatedAt: new Date(),
      modelUsed: copy.modelUsed,
    }));
    
    // DB 저장 시도
    try {
      const saved = await this.saveCopies(
        formattedCopies.map(c => ({
          content: c.content,
          charCount: c.charCount,
          modelUsed: c.modelUsed,
        })),
        request,
        intent,
        totalCost
      );
      
      // API 사용량 업데이트
      await db
        .update(users)
        .set({
          apiQuotaUsed: sql`${users.apiQuotaUsed} + ${saved.length}`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, request.userId));
      console.log(`✅ API 사용량 업데이트: +${saved.length}개`);
      
      // Analytics 테이블 업데이트 (슈퍼베이스 통계 연동)
      const finalGenerationTime = Date.now() - startTime;
      await this.updateAnalytics(
        request.userId,
        saved.length,                // 생성된 카피 수
        saved.length,                // 성공한 카피 수
        0,                           // 실패한 카피 수
        providers.length,            // API 호출 수 (모델 개수)
        finalGenerationTime,         // 평균 생성 시간
        totalCost                    // 총 비용
      );
    } catch (error) {
      console.log("DB 저장 실패, 메모리 모드 사용");
    }
    
    const finalTime = Date.now() - startTime;
    
    console.log(`\n${"=".repeat(60)}`);
    console.log(`✅ 멀티모델 생성 완료`);
    console.log(`${"=".repeat(60)}`);
    console.log(`📊 최종 결과:`);
    console.log(`  - 총 카피: ${formattedCopies.length}개 (목표: ${requestedCount}개)`);
    console.log(`  - 사용된 모델: ${providers.map(p => p.modelName).join(", ")}`);
    
    // 모델별 개수 표시
    const modelStats: Record<string, number> = {};
    formattedCopies.forEach(c => {
      modelStats[c.modelUsed] = (modelStats[c.modelUsed] || 0) + 1;
    });
    console.log(`  - 모델별 분포:`);
    Object.entries(modelStats).forEach(([model, count]) => {
      console.log(`    * ${model}: ${count}개`);
    });
    
    console.log(`  - 총 토큰: ${totalPromptTokens + totalCompletionTokens}개`);
    console.log(`    * 프롬프트: ${totalPromptTokens}개`);
    console.log(`    * 완성: ${totalCompletionTokens}개`);
    console.log(`  - 총 비용: $${totalCost.toFixed(4)}`);
    console.log(`  - 생성 시간: ${(finalTime / 1000).toFixed(1)}초`);
    
    console.log(`\n📝 생성된 카피 미리보기 (모델별):`);
    let previewIdx = 0;
    Object.entries(modelStats).forEach(([model, count]) => {
      console.log(`  [${model}]`);
      const modelCopies = formattedCopies.filter(c => c.modelUsed === model);
      modelCopies.slice(0, 2).forEach(copy => {
        previewIdx++;
        console.log(`    ${previewIdx}. [${copy.charCount}자] ${copy.content.substring(0, 40)}${copy.content.length > 40 ? '...' : ''}`);
      });
    });
    if (formattedCopies.length > previewIdx) {
      console.log(`  ... 외 ${formattedCopies.length - previewIdx}개`);
    }
    console.log(`${"=".repeat(60)}\n`);
    
    return {
      copies: formattedCopies,
      generationTimeMs: finalTime,
      apiCost: totalCost, // 실제 비용 계산
      modelUsed: "multi-model",
      modelsUsed: providers.map(p => p.modelName),
      tokenUsage: {
        promptTokens: totalPromptTokens,
        completionTokens: totalCompletionTokens,
        totalTokens: totalPromptTokens + totalCompletionTokens,
      },
      intent,
    };
  }
  
  /**
   * 단일 모델 생성
   * 고정: 10개 생성
   */
  private async generateWithSingleModel(request: CopyGenerationRequest): Promise<CopyGenerationResponse> {
    const overallStartTime = Date.now();
    
    // Single 모드 고정 설정
    const requestedCount = 10;  // 고정
    
    console.log("\n=====================================");
    console.log("Pltt. AD Copy 단일 생성 모드 시작");
    console.log("=====================================");
    console.log(`📝 Single 모드: ${requestedCount}개 생성`);
    console.log("\n사용자 입력:", request.prompt);
    console.log("요청 옵션:", {
      tone: request.tone,
      targetPlatform: request.targetPlatform,
      useCopywritingTheory: request.useCopywritingTheory,
      useAdReferences: request.useAdReferences,
      promptStrategy: request.promptStrategy,
    });
    
    const intent =
      request.intent ?? (await this.intentExtractor.extract(request.prompt));
    
    console.log("\n의도 분석 결과:");
    console.log("  - 제품:", intent.productName);
    console.log("  - 타겟:", intent.targetAudience);
    console.log("  - 톤:", intent.tone);
    console.log("  - 키워드:", intent.keywords);

    // 글자 수 설정
    let resolvedMin: number;
    let resolvedMax: number;
    
    if (request.charCountMode === "fixed" && request.targetCharCount) {
      resolvedMin = Math.max(10, request.targetCharCount - 5);
      resolvedMax = Math.min(200, request.targetCharCount + 5);
      console.log(`📏 글자 수: ${request.targetCharCount}자 고정`);
    } else {
      resolvedMin = request.minChars ?? intent.minChars ?? this.promptOptimizer.defaults.minChars;
      resolvedMax = request.maxChars ?? intent.maxChars ?? this.promptOptimizer.defaults.maxChars;
      console.log(`📏 글자 수: AI 자동 결정`);
    }
    
    const resolvedTone = request.tone ?? intent.tone ?? "neutral";
    
    console.log("\n생성 설정:");
    console.log("  - 글자수 범위:", `${resolvedMin}~${resolvedMax}자`);
    console.log("  - 톤:", resolvedTone);
    console.log("  - 개수:", requestedCount);

    this.validationService.validateCopyRequest({
      ...request,
      minChars: resolvedMin,
      maxChars: resolvedMax,
      tone: resolvedTone,
      count: requestedCount,
    });

    const user = await this.getUserQuota(request.userId);
    if (!user) {
      throw new Error("사용자를 찾을 수 없습니다.");
    }
    if ((user.apiQuotaUsed ?? 0) + requestedCount > (user.apiQuotaLimit ?? 0)) {
      throw new Error("API 할당량을 초과했습니다.");
    }

    console.log("요청된 모델:", request.preferredModel);
    const provider = this.providerFactory.resolve(request.preferredModel);
    
    console.log("\n선택된 LLM 모델:", provider.modelName);
    
    const guidelines =
      request.creativeGuidelines ??
      this.promptOptimizer.buildGuidelines(intent, resolvedTone);
      
    console.log("\n카피라이팅 전략 수립 중...");
    
    const generationPayload: GenerationRequest = {
      prompt: await this.promptOptimizer.build({
        rawPrompt: request.prompt,
        intent,
        minChars: resolvedMin,
        maxChars: resolvedMax,
        tone: resolvedTone,
        count: requestedCount,
        customTemplate: process.env.COPY_PROMPT_TEMPLATE,
        useCopywritingTheory: request.useCopywritingTheory,
        useAdReferences: request.useAdReferences,
        promptStrategy: request.promptStrategy,
        adReferenceFreshness: request.adReferenceFreshness,
        targetPlatform: request.targetPlatform, // 선택적 옵션
        targetAdType: request.targetAdType, // 선택적 옵션
      }),
      minChars: resolvedMin,
      maxChars: resolvedMax,
      tone: resolvedTone,
      count: requestedCount,
      creativeGuidelines: guidelines,
    };

    console.log("\nLLM 호출 중...");
    
    const llmStartTime = Date.now();
    const generation = await provider.generateCopies(generationPayload);
    const generationTime = Date.now() - llmStartTime;
    
    console.log("LLM 응답 완료:", generationTime, "ms");
    console.log("생성된 카피 개수:", generation.copies.length);
    console.log("토큰 사용량:", generation.tokenUsage.totalTokens);

    const validatedCopies = await this.ensureValidLength(
      generation.copies,
      generationPayload,
      provider
    );
    
    console.log("검증 완료:", validatedCopies.length, "개");
    validatedCopies.forEach((copy, idx) => {
      console.log(`  ${idx + 1}. [${copy.length}자] ${copy.substring(0, 30)}...`);
    });

    if (validatedCopies.length === 0) {
      throw new Error("유효한 카피를 생성하지 못했습니다.");
    }

    const apiCost = provider.calculateCost(generation.tokenUsage);

    // 프로토타입 테스트: DB 저장 우회 가능하도록 try-catch 추가
    let savedCopies: GeneratedCopy[];
    try {
      savedCopies = await Promise.all(
        validatedCopies.map(async (content) => {
          const [savedCopy] = await db
            .insert(copies)
            .values({
              userId: request.userId,
              templateId: request.templateId ?? null,
              prompt: request.prompt,
              generatedContent: content,
              charCount: content.length,
              minChars: resolvedMin,
              maxChars: resolvedMax,
              tone: resolvedTone,
              language: "ko-KR",
              modelUsed: provider.modelName,
              status: "success",
              generationTimeMs: generationTime,
              apiCost: apiCost.toString(),
              metadata: {
                creativeGuidelines: guidelines,
                sessionId: request.sessionId,
                intent,
              },
            })
            .returning();

          return {
            id: savedCopy.id,
            content: savedCopy.generatedContent,
            charCount: savedCopy.charCount,
            generatedAt: savedCopy.createdAt,
          } satisfies GeneratedCopy;
        })
      );

      await db
        .update(users)
        .set({
          apiQuotaUsed: (user.apiQuotaUsed ?? 0) + savedCopies.length,
          updatedAt: new Date(),
        })
        .where(eq(users.id, request.userId));

      await this.usageLogger.log({
        userId: request.userId,
        sessionId: request.sessionId ?? null,
        copyId: savedCopies.length === 1 ? savedCopies[0].id : null,
        modelName: provider.modelName,
        promptTokens: generation.tokenUsage.promptTokens,
        completionTokens: generation.tokenUsage.completionTokens,
        totalTokens: generation.tokenUsage.totalTokens,
        cost: apiCost.toString(),
        metadata: {
          copyIds: savedCopies.map((copy) => copy.id),
          creativeGuidelines: guidelines,
          intent,
        },
      });
      
      // Analytics 테이블 업데이트 (슈퍼베이스 통계 연동)
      await this.updateAnalytics(
        request.userId,
        savedCopies.length,          // 생성된 카피 수
        savedCopies.length,          // 성공한 카피 수
        0,                           // 실패한 카피 수
        1,                           // API 호출 수
        generationTime,              // 평균 생성 시간
        apiCost                      // 총 비용
      );
    } catch (dbError) {
      // DB 연결 실패 시 메모리에만 저장
      console.warn("DB 저장 실패, 메모리 모드로 전환:", dbError);
      savedCopies = validatedCopies.map((content, index) => ({
        id: Date.now() + index,
        content,
        charCount: content.length,
        generatedAt: new Date(),
      }));
    }

    console.log(`\n${"=".repeat(60)}`);
    console.log(`✅ 단일 모델 생성 완료`);
    console.log(`${"=".repeat(60)}`);
    console.log(`📊 최종 결과:`);
    console.log(`  - 총 카피: ${savedCopies.length}개`);
    console.log(`  - 사용 모델: ${provider.modelName}`);
    console.log(`  - 총 토큰: ${generation.tokenUsage.totalTokens.toLocaleString()}개`);
    console.log(`    * 입력: ${generation.tokenUsage.promptTokens.toLocaleString()}개`);
    console.log(`    * 출력: ${generation.tokenUsage.completionTokens.toLocaleString()}개`);
    console.log(`  - 총 비용: $${apiCost.toFixed(6)}`);
    console.log(`  - 생성 시간: ${(generationTime / 1000).toFixed(1)}초`);
    console.log(`${"=".repeat(60)}\n`);
    
    return {
      copies: savedCopies,
      generationTimeMs: generationTime,
      apiCost,
      modelUsed: provider.modelName,
      tokenUsage: generation.tokenUsage,
      intent,
    };
  }

  private async ensureValidLength(
    copies: string[],
    request: GenerationRequest,
    provider: LLMProvider
  ): Promise<string[]> {
    const results: string[] = [];
    let invalidCount = 0;
    
    console.log(`\n📏 글자수 검증 시작 (범위: ${request.minChars}~${request.maxChars}자)`);
    
    for (let i = 0; i < copies.length; i++) {
      const copy = copies[i];
      const charCount = copy.length;
      
      if (this.isValidCharCount(copy, request.minChars, request.maxChars)) {
        console.log(`  ✅ ${i + 1}. [${charCount}자] 통과 - "${copy.substring(0, 30)}..."`);
        results.push(copy);
        continue;
      }
      
      console.warn(`  ⚠️ ${i + 1}. [${charCount}자] 범위 벗어남 - "${copy.substring(0, 50)}..."`);
      invalidCount++;
      
      // 범위를 많이 벗어나지 않으면 허용 (±20% 여유)
      const tolerance = (request.maxChars - request.minChars) * 0.2;
      if (charCount >= request.minChars - tolerance && 
          charCount <= request.maxChars + tolerance) {
        console.log(`    → 허용 범위 내로 포함 (±20% 여유)`);
        results.push(copy);
        invalidCount--;
      }
    }
    
    console.log(`검증 결과: ${results.length}/${copies.length}개 통과, ${invalidCount}개 제외\n`);
    
    return results;
  }

  private isValidCharCount(text: string, minChars: number, maxChars: number) {
    const length = text.length;
    return length >= minChars && length <= maxChars;
  }

  private async getUserQuota(userId: number) {
    // 프로토타입 테스트: DB 조회 우회, 무제한 할당량으로 반환
    try {
      const [user] = await db
        .select({
          id: users.id,
          apiQuotaUsed: users.apiQuotaUsed,
          apiQuotaLimit: users.apiQuotaLimit,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      return user ?? null;
    } catch (error) {
      // DB 연결 실패 시 기본 값 반환
      console.warn("DB 연결 실패, 기본 할당량 사용:", error);
      return {
        id: userId,
        apiQuotaUsed: 0,
        apiQuotaLimit: 999999,
      };
    }
  }
  
  /**
   * 카피 DB 저장 헬퍼 (멀티모델 지원)
   */
  private async saveCopies(
    copiesData: Array<{
      content: string;
      charCount: number;
      modelUsed?: string;
      lengthCategory?: "short" | "medium" | "long";
      recommendedChannel?: string;
      rank?: number;
      rankingReason?: string;
    }>,
    request: CopyGenerationRequest,
    intent: IntentData,
    totalCost: number
  ): Promise<GeneratedCopy[]> {
    try {
      const savedCopies = await Promise.all(
        copiesData.map(async (copyData) => {
          const [savedCopy] = await db
            .insert(copies)
            .values({
              userId: request.userId,
              templateId: request.templateId ?? null,
              prompt: request.prompt,
              generatedContent: copyData.content,
              charCount: copyData.charCount,
              minChars: 15,
              maxChars: 100,
              tone: request.tone ?? intent.tone,
              language: "ko-KR",
              modelUsed: copyData.modelUsed ?? "multi-model",
              status: "success",
              generationTimeMs: 0,
              apiCost: totalCost.toString(),
              metadata: {
                intent,
                lengthCategory: copyData.lengthCategory,
                recommendedChannel: copyData.recommendedChannel,
                rank: copyData.rank,
                rankingReason: copyData.rankingReason,
              },
            })
            .returning();

          return {
            id: savedCopy.id,
            content: savedCopy.generatedContent,
            charCount: savedCopy.charCount,
            generatedAt: savedCopy.createdAt,
            modelUsed: copyData.modelUsed,
            lengthCategory: copyData.lengthCategory,
            recommendedChannel: copyData.recommendedChannel,
            rank: copyData.rank,
            rankingReason: copyData.rankingReason,
          } satisfies GeneratedCopy;
        })
      );

      return savedCopies;
    } catch (dbError) {
      console.warn("DB 저장 실패, 메모리 모드:", dbError);
      return copiesData.map((copyData, index) => ({
        id: Date.now() + index,
        content: copyData.content,
        charCount: copyData.charCount,
        generatedAt: new Date(),
        modelUsed: copyData.modelUsed,
        lengthCategory: copyData.lengthCategory,
        recommendedChannel: copyData.recommendedChannel,
        rank: copyData.rank,
        rankingReason: copyData.rankingReason,
      }));
    }
  }
  
  /**
   * Analytics 테이블에 통계 업데이트 (슈퍼베이스 연동)
   * 오늘 날짜의 통계를 업데이트하거나 생성
   */
  private async updateAnalytics(
    userId: number,
    copiesGenerated: number,
    successfulCopies: number,
    failedCopies: number,
    apiCalls: number,
    generationTimeMs: number,
    apiCost: number
  ): Promise<void> {
    try {
      // 오늘 날짜 (시작 시간)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // 오늘 날짜의 기존 통계 조회
      const existing = await db
        .select()
        .from(analytics)
        .where(
          and(
            eq(analytics.userId, userId),
            gte(analytics.date, today)
          )
        )
        .limit(1);
      
      if (existing.length > 0) {
        // 기존 통계 업데이트
        const current = existing[0];
        const totalCopies = (current.copiesGenerated || 0) + copiesGenerated;
        const totalSuccessful = (current.successfulCopies || 0) + successfulCopies;
        const totalFailed = (current.failedCopies || 0) + failedCopies;
        const totalApiCalls = (current.apiCalls || 0) + apiCalls;
        const totalCost = parseFloat(current.totalApiCost || "0") + apiCost;
        
        // 평균 생성 시간 계산 (가중 평균)
        const currentAvgTime = current.avgGenerationTimeMs || 0;
        const currentCount = current.copiesGenerated || 0;
        const newAvgTime = Math.round(
          (currentAvgTime * currentCount + generationTimeMs * copiesGenerated) /
          totalCopies
        );
        
        await db
          .update(analytics)
          .set({
            copiesGenerated: totalCopies,
            successfulCopies: totalSuccessful,
            failedCopies: totalFailed,
            apiCalls: totalApiCalls,
            avgGenerationTimeMs: newAvgTime,
            totalApiCost: totalCost.toString(),
          })
          .where(eq(analytics.id, current.id));
        
        console.log(`📊 Analytics 업데이트 완료: 오늘 총 ${totalCopies}개 카피 생성`);
      } else {
        // 새로운 통계 생성
        await db.insert(analytics).values({
          userId,
          date: today,
          copiesGenerated,
          successfulCopies,
          failedCopies,
          apiCalls,
          avgGenerationTimeMs: Math.round(generationTimeMs),
          totalApiCost: apiCost.toString(),
        });
        
        console.log(`📊 Analytics 생성 완료: 오늘 첫 카피 ${copiesGenerated}개 생성`);
      }
    } catch (error) {
      console.error("❌ Analytics 업데이트 실패:", error);
      // Analytics 실패는 카피 생성 자체를 막지 않음
    }
  }
}