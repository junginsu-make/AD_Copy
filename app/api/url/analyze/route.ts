// URL 분석 API
// POST /api/url/analyze
// 경쟁사 또는 자사 제품 페이지 URL을 분석하여 광고 카피 생성

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AdvancedUrlAnalysisService } from "@/src/application/services/advanced-url-analysis-service";
import { CopyGenerationService } from "@/src/application/services/copy-generation-service";

const urlAnalysisSchema = z.object({
  url: z.string().url("유효한 URL을 입력해주세요"),
  additionalPrompt: z.string().optional(),
  
  // 생성 옵션 (선택)
  generateCopies: z.boolean().optional(), // true면 분석 후 바로 생성
  minChars: z.number().int().optional(),
  maxChars: z.number().int().optional(),
  count: z.number().int().optional(),
  generationMode: z.enum(["single", "variety"]).optional(),
  
  userId: z.number().int().optional(), // 임시
});

const urlAnalyzer = new AdvancedUrlAnalysisService();
const copyService = new CopyGenerationService();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = urlAnalysisSchema.safeParse(body);

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

    // URL 분석
    const startTime = Date.now();
    const intent = await urlAnalyzer.analyzeUrl(data.url);
    const analysisTimeMs = Date.now() - startTime;

    // 추가 프롬프트가 있으면 병합
    if (data.additionalPrompt) {
      intent.additionalNotes = [
        ...(intent.additionalNotes ?? []),
        data.additionalPrompt,
      ];
    }

    // 분석만 할지, 카피까지 생성할지
    if (data.generateCopies) {
      const result = await copyService.generate({
        userId,
        prompt: `URL 분석: ${data.url}\n\n${data.additionalPrompt ?? ""}`,
        intent,
        generationMode: data.generationMode ?? "variety",
        minChars: data.minChars,
        maxChars: data.maxChars,
        count: data.count,
        useCopywritingTheory: true,
        useAdReferences: true,
        promptStrategy: "comprehensive",
      });

      return NextResponse.json({
        success: true,
        inputType: "url",
        analysisTimeMs,
        intent,
        result,
      });
    } else {
      // 분석 결과만 반환
      return NextResponse.json({
        success: true,
        inputType: "url",
        analysisTimeMs,
        intent,
        analyzedData: intent.analyzedData,
        message: "URL 분석이 완료되었습니다. 이 정보로 카피를 생성하시겠어요?",
      });
    }
  } catch (error) {
    console.error("URL 분석 오류:", error);
    return NextResponse.json(
      {
        error: "URL 분석 중 오류가 발생했습니다.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * 사용 예시:
 * 
 * 1. 분석만:
 * POST /api/url/analyze
 * {
 *   "url": "https://example.com/product/skincare",
 *   "generateCopies": false
 * }
 * 
 * 2. 분석 + 생성:
 * POST /api/url/analyze
 * {
 *   "url": "https://example.com/product/skincare",
 *   "generateCopies": true,
 *   "additionalPrompt": "더 감성적으로",
 *   "count": 10
 * }
 */

