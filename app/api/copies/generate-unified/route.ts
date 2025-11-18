// 통합 입력 API
// POST /api/copies/generate-unified
// 모든 입력 방식을 하나의 엔드포인트로 처리 (자연어, URL, 이미지, 구조화)

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CopyGenerationService, type CopyVariety } from "@/src/application/services/copy-generation-service";
import { IntentExtractionService, type IntentData } from "@/src/application/services/intent-extraction-service";
import { UrlAnalysisService } from "@/src/application/services/url-analysis-service";
import { GeminiVisionProvider } from "@/src/infrastructure/ai/gemini-vision-provider";

const unifiedSchema = z.object({
  // 입력 타입 (자동 감지 또는 명시)
  inputType: z.enum(["auto", "text", "url", "image", "structured"]).optional(),
  
  // 입력 데이터 (하나 또는 조합)
  message: z.string().optional(),
  url: z.string().url().optional(),
  imageBase64: z.string().optional(),
  imageMimeType: z.string().optional(),
  
  // 구조화된 데이터 (폼 입력)
  structured: z.object({
    productName: z.string(),
    targetAudience: z.string(),
    tone: z.string().optional(),
    varieties: z.array(z.string()).optional(),
    selectedTriggers: z.array(z.string()).optional(),
    keyBenefits: z.array(z.string()).optional(),
    callToAction: z.string().optional(),
    additionalNotes: z.string().optional(),
  }).optional(),
  
  // 생성 옵션
  generationMode: z.enum(["single", "multi", "variety"]).optional(),
  promptStrategy: z.enum(["focused", "comprehensive", "maximum"]).optional(),
  adReferenceFreshness: z.number().int().optional(),
  minChars: z.number().int().optional(),
  maxChars: z.number().int().optional(),
  count: z.number().int().optional(),
  tone: z.string().optional(),
  
  // 플랫폼 선택
  targetPlatform: z.enum(["naver", "google", "kakao"]).optional(),
  targetAdType: z.string().optional(),
  
  // UI 옵션
  skipConfirmation: z.boolean().optional(), // true면 확인 단계 생략
  
  userId: z.number().int().optional(), // 임시
});

const copyService = new CopyGenerationService();
const intentExtractor = new IntentExtractionService();
const urlAnalyzer = new UrlAnalysisService();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = unifiedSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "입력 값이 유효하지 않습니다.",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const userId = data.userId ?? 1;

    // 입력 타입 자동 감지
    const inputType = data.inputType ?? detectInputType(data);

    let intent: IntentData;
    let analysisTimeMs = 0;
    const startTime = Date.now();

    // 입력 타입별 의도 추출
    switch (inputType) {
      case "text":
        intent = await intentExtractor.extract(data.message!);
        break;
        
      case "url":
        intent = await urlAnalyzer.analyzeUrl(data.url!);
        break;
        
      case "image":
        const visionProvider = new GeminiVisionProvider();
        const imageResult = await visionProvider.analyzeImage({
          imageBase64: data.imageBase64!,
          mimeType: data.imageMimeType!,
        });
        intent = mapImageAnalysisToIntent(imageResult);
        break;
        
      case "structured":
        // 구조화된 데이터는 의도 추출 생략
        intent = mapStructuredToIntent(data.structured!);
        break;
        
      default:
        return NextResponse.json(
          { error: "유효한 입력을 제공해주세요." },
          { status: 400 }
        );
    }

    analysisTimeMs = Date.now() - startTime;

    // 구조화된 데이터로 의도 덮어쓰기 (하이브리드: 자연어 + 폼)
    if (data.structured) {
      intent = mergeIntents(intent, data.structured);
    }

    // 확인 단계 (skipConfirmation이 false일 때)
    if (!data.skipConfirmation) {
      return NextResponse.json({
        success: true,
        step: "confirmation",
        inputType,
        analysisTimeMs,
        extractedIntent: intent,
        suggestions: generateSuggestions(intent),
        message: "이렇게 이해했습니다. 수정하실 부분이 있나요?",
      });
    }

    // 바로 생성 (skipConfirmation이 true일 때)
    const result = await copyService.generate({
      userId,
      prompt: buildPromptFromIntent(intent, data.message),
      intent,
      
      varieties: data.structured?.varieties as CopyVariety[] ?? undefined,
      generationMode: data.generationMode ?? "variety",
      promptStrategy: data.promptStrategy ?? "comprehensive",
      adReferenceFreshness: data.adReferenceFreshness ?? 90,
      minChars: data.minChars ?? 30,
      maxChars: data.maxChars ?? 50,
      count: data.count ?? 10,
      
      useCopywritingTheory: true,
      useAdReferences: true,
    });

    return NextResponse.json({
      success: true,
      step: "completion",
      inputType,
      analysisTimeMs,
      result,
    });
  } catch (error) {
    console.error("통합 생성 오류:", error);
    return NextResponse.json(
      {
        error: "카피 생성 중 오류가 발생했습니다.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * 입력 타입 자동 감지
 */
function detectInputType(data: {
  message?: string;
  url?: string;
  imageBase64?: string;
  structured?: unknown;
}): "text" | "url" | "image" | "structured" {
  if (data.structured) return "structured";
  if (data.url) return "url";
  if (data.imageBase64) return "image";
  return "text";
}

/**
 * 구조화된 데이터를 IntentData로 변환
 */
function mapStructuredToIntent(structured: {
  productName: string;
  targetAudience: string;
  tone?: string;
  keyBenefits?: string[];
  callToAction?: string;
  selectedTriggers?: string[];
  additionalNotes?: string;
}): IntentData {
  return {
    productName: structured.productName,
    targetAudience: structured.targetAudience,
    tone: structured.tone ?? "neutral",
    keyBenefits: structured.keyBenefits,
    callToAction: structured.callToAction,
    keywords: structured.selectedTriggers,
    additionalNotes: structured.additionalNotes ? [structured.additionalNotes] : undefined,
    confidence: 1.0, // 사용자 직접 입력 = 100% 확신
  };
}

/**
 * 이미지 분석 결과를 IntentData로 변환
 */
function mapImageAnalysisToIntent(imageResult: {
  description: string;
  suggestedKeywords?: string[];
  visualElements?: string[];
  productInfo?: { name?: string; targetAudience?: string };
}): IntentData {
  return {
    productName: imageResult.productInfo?.name,
    targetAudience: imageResult.productInfo?.targetAudience,
    keywords: imageResult.suggestedKeywords,
    visualImagery: imageResult.visualElements,
    additionalNotes: [imageResult.description],
  };
}

/**
 * 두 Intent 병합 (구조화된 데이터 우선)
 */
function mergeIntents(
  baseIntent: IntentData,
  structured: NonNullable<typeof unifiedSchema._type.structured>
): IntentData {
  return {
    ...baseIntent,
    productName: structured.productName ?? baseIntent.productName,
    targetAudience: structured.targetAudience ?? baseIntent.targetAudience,
    tone: structured.tone ?? baseIntent.tone,
    keyBenefits: structured.keyBenefits ?? baseIntent.keyBenefits,
    callToAction: structured.callToAction ?? baseIntent.callToAction,
    keywords: structured.selectedTriggers ?? baseIntent.keywords,
    confidence: 1.0, // 사용자가 수정함 = 확신
  };
}

/**
 * AI 추천 생성
 */
function generateSuggestions(intent: IntentData) {
  // 간단한 추천 로직
  const suggestions: {
    varieties: string[];
    triggers: string[];
    promptStrategy: string;
  } = {
    varieties: ["emotional", "ad_reference", "data_driven"],
    triggers: [],
    promptStrategy: "comprehensive",
  };

  // 톤 기반 추천
  if (intent.tone === "emotional" || intent.tone === "casual") {
    suggestions.varieties.push("storytelling");
  }
  if (intent.tone === "luxury" || intent.tone === "professional") {
    suggestions.varieties.push("premium");
  }

  // 키워드 기반 트리거 추천
  if (intent.keywords?.some(k => /긴급|지금|당장/.test(k))) {
    suggestions.triggers.push("긴급성");
  }
  if (intent.keywords?.some(k => /한정|소수|VIP/.test(k))) {
    suggestions.triggers.push("희소성");
  }

  return suggestions;
}

/**
 * IntentData로부터 프롬프트 생성
 */
function buildPromptFromIntent(intent: IntentData, originalMessage?: string): string {
  if (originalMessage) {
    return originalMessage;
  }
  
  return `${intent.productName ?? ""}을(를) ${intent.targetAudience ?? ""}에게 홍보하는 광고 카피${intent.additionalNotes ? ` (${intent.additionalNotes.join(", ")})` : ""}`;
}

/**
 * 사용 예시:
 * 
 * 1. 자연어만:
 * POST /api/copies/generate-unified
 * {
 *   "message": "30대 여성 스킨케어",
 *   "skipConfirmation": false
 * }
 * 
 * 2. 자연어 + 폼 (하이브리드):
 * {
 *   "message": "스킨케어 광고",
 *   "structured": {
 *     "targetAudience": "30대 여성",
 *     "varieties": ["emotional", "premium"]
 *   },
 *   "skipConfirmation": true
 * }
 * 
 * 3. URL:
 * {
 *   "url": "https://example.com/product",
 *   "skipConfirmation": true
 * }
 */

