// 의도 추출 API (확인용)
// POST /api/intent/extract
// 사용자 입력을 분석하여 의도만 추출 (생성하지 않음)

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { IntentExtractionService } from "@/src/application/services/intent-extraction-service";
import { UrlAnalysisService } from "@/src/application/services/url-analysis-service";
import { GeminiVisionProvider } from "@/src/infrastructure/ai/gemini-vision-provider";
import { CopywritingStrategyService } from "@/src/application/services/copywriting-strategy-service";

const extractSchema = z.object({
  // 입력 타입 (자동 감지 또는 명시)
  inputType: z.enum(["auto", "text", "url", "image"]).optional(),
  
  // 입력 데이터 (하나만 제공)
  message: z.string().optional(),
  url: z.string().url().optional(),
  imageBase64: z.string().optional(),
  imageMimeType: z.string().optional(),
});

const intentExtractor = new IntentExtractionService();
const urlAnalyzer = new UrlAnalysisService();
const strategyService = new CopywritingStrategyService();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = extractSchema.safeParse(body);

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

    // 입력 타입 결정
    const inputType = data.inputType ?? detectInputType(data);

    let intent;
    let analysisTimeMs = 0;
    const startTime = Date.now();

    // 입력 타입별 처리
    switch (inputType) {
      case "text":
        if (!data.message) {
          return NextResponse.json(
            { error: "message 필드가 필요합니다." },
            { status: 400 }
          );
        }
        intent = await intentExtractor.extract(data.message);
        break;

      case "url":
        if (!data.url) {
          return NextResponse.json(
            { error: "url 필드가 필요합니다." },
            { status: 400 }
          );
        }
        intent = await urlAnalyzer.analyzeUrl(data.url);
        break;

      case "image":
        if (!data.imageBase64 || !data.imageMimeType) {
          return NextResponse.json(
            { error: "imageBase64와 imageMimeType 필드가 필요합니다." },
            { status: 400 }
          );
        }
        const visionProvider = new GeminiVisionProvider();
        const imageResult = await visionProvider.analyzeImage({
          imageBase64: data.imageBase64,
          mimeType: data.imageMimeType,
        });
        
        // Vision 결과를 IntentData로 변환
        intent = {
          productName: imageResult.productInfo?.name,
          targetAudience: imageResult.productInfo?.targetAudience,
          keywords: imageResult.suggestedKeywords,
          visualImagery: imageResult.visualElements,
          additionalNotes: [imageResult.description],
        };
        break;

      default:
        return NextResponse.json(
          { error: "유효한 입력을 제공해주세요." },
          { status: 400 }
        );
    }

    analysisTimeMs = Date.now() - startTime;

    // 전략 분석 (추천 제공)
    const strategy = strategyService.analyze(intent);

    return NextResponse.json({
      success: true,
      inputType,
      analysisTimeMs,
      
      // 추출된 의도
      extractedIntent: intent,
      
      // AI 추천
      suggestions: {
        varieties: [
          strategy.style.id === "GARY_HALBERT" ? "emotional" : "premium",
          "ad_reference",
          strategy.formula.id === "PAS" ? "storytelling" : "data_driven",
        ],
        triggers: strategy.triggers.map(t => t.name),
        promptStrategy: "comprehensive",
        formula: strategy.formula.name,
        style: strategy.style.name,
      },
      
      // 사용자 확인 메시지
      message: `이렇게 이해했습니다:\n제품: ${intent.productName ?? "미지정"}\n타겟: ${intent.targetAudience ?? "미지정"}\n톤: ${intent.tone ?? "중립"}\n\n수정하실 부분이 있나요?`,
    });
  } catch (error) {
    console.error("의도 추출 오류:", error);
    return NextResponse.json(
      {
        error: "의도 추출 중 오류가 발생했습니다.",
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
}): "text" | "url" | "image" {
  if (data.url) return "url";
  if (data.imageBase64) return "image";
  return "text";
}

/**
 * 사용 예시:
 * 
 * POST /api/intent/extract
 * {
 *   "message": "30대 여성을 위한 프리미엄 스킨케어 광고"
 * }
 * 
 * 응답:
 * {
 *   "success": true,
 *   "extractedIntent": {
 *     "productName": "프리미엄 스킨케어",
 *     "targetAudience": "30대 여성",
 *     "tone": "premium"
 *   },
 *   "suggestions": {
 *     "varieties": ["emotional", "ad_reference", "premium"],
 *     "triggers": ["소유감", "희소성"],
 *     "promptStrategy": "comprehensive"
 *   },
 *   "message": "이렇게 이해했습니다..."
 * }
 */

