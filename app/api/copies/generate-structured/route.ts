// 구조화된 폼 입력 API
// POST /api/copies/generate-structured
// 사용자가 명확한 의도로 각 항목을 직접 선택하는 경우

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CopyGenerationService, type CopyVariety } from "@/src/application/services/copy-generation-service";
import type { IntentData } from "@/src/application/services/intent-extraction-service";

const structuredInputSchema = z.object({
  // 필수 항목
  productName: z.string().min(1, "제품/서비스명을 입력해주세요"),
  targetAudience: z.string().min(1, "타겟 고객을 입력해주세요"),
  
  // 선택 항목
  tone: z.enum(["casual", "formal", "emotional", "professional", "luxury", "neutral"]).optional(),
  
  // 카피 스타일 (다중 선택 가능)
  varieties: z.array(
    z.enum([
      "ad_reference",
      "emotional",
      "data_driven",
      "direct",
      "trusted",
      "storytelling",
      "urgent",
      "premium",
    ])
  ).optional(),
  
  // 심리 트리거 (다중 선택 가능)
  selectedTriggers: z.array(z.string()).optional(),
  
  // 카피 설정
  minChars: z.number().int().min(10).max(200).optional(),
  maxChars: z.number().int().min(10).max(200).optional(),
  count: z.number().int().min(1).max(20).optional(),
  
  // 추가 정보
  keyBenefits: z.array(z.string()).optional(),
  callToAction: z.string().optional(),
  channel: z.string().optional(),
  additionalNotes: z.string().optional(),
  
  // 생성 옵션
  promptStrategy: z.enum(["focused", "comprehensive", "maximum"]).optional(),
  adReferenceFreshness: z.number().int().min(1).max(365).optional(),
  useAdReferences: z.boolean().optional(),
  
  // 플랫폼 선택
  targetPlatform: z.enum(["naver", "google", "kakao"]).optional(),
  targetAdType: z.string().optional(),
  
  // 사용자 ID
  userId: z.number().int().optional(), // 임시: 인증 구현 시 제거
});

const copyService = new CopyGenerationService();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = structuredInputSchema.safeParse(body);
    
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
    const userId = data.userId ?? 1; // 임시: 테스트용

    // 구조화된 데이터를 IntentData로 변환
    // 의도 추출 과정 생략! (사용자가 직접 입력함)
    const intent: IntentData = {
      productName: data.productName,
      targetAudience: data.targetAudience,
      tone: data.tone ?? "neutral",
      keyBenefits: data.keyBenefits,
      callToAction: data.callToAction,
      channel: data.channel,
      keywords: data.selectedTriggers, // 트리거를 키워드로
      additionalNotes: data.additionalNotes ? [data.additionalNotes] : undefined,
      confidence: 1.0, // 100% 확신 (사용자 직접 입력)
      minChars: data.minChars,
      maxChars: data.maxChars,
      desiredCopies: data.count,
    };

    // 카피 생성
    const result = await copyService.generate({
      userId,
      prompt: `${data.productName} - ${data.targetAudience}${data.additionalNotes ? ` (${data.additionalNotes})` : ""}`,
      intent, // 이미 구조화된 의도 전달
      
      // 사용자 선택 옵션
      varieties: data.varieties,
      generationMode: data.varieties ? "variety" : "single",
      
      minChars: data.minChars ?? 30,
      maxChars: data.maxChars ?? 50,
      count: data.count ?? 10,
      tone: data.tone,
      
      // 고급 옵션
      promptStrategy: data.promptStrategy ?? "comprehensive",
      adReferenceFreshness: data.adReferenceFreshness ?? 90,
      useAdReferences: data.useAdReferences ?? true,
      useCopywritingTheory: true,
    });

    return NextResponse.json({
      success: true,
      result,
      metadata: {
        inputType: "structured",
        intentExtractionSkipped: true, // 의도 추출 생략됨
        userSpecified: {
          varieties: data.varieties,
          triggers: data.selectedTriggers,
        },
      },
    });
  } catch (error) {
    console.error("구조화된 카피 생성 오류:", error);
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
 * 사용 예시:
 * 
 * POST /api/copies/generate-structured
 * {
 *   "productName": "프리미엄 스킨케어",
 *   "targetAudience": "30대 여성",
 *   "tone": "emotional",
 *   "varieties": ["emotional", "ad_reference", "premium"],
 *   "selectedTriggers": ["긴급성", "희소성", "소유감"],
 *   "minChars": 30,
 *   "maxChars": 50,
 *   "count": 10,
 *   "additionalNotes": "오늘만 특별 할인 이벤트"
 * }
 */

