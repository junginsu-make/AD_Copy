/**
 * 광고 수집 API
 * 퍼플렉시티를 통해 실시간으로 광고 수집
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { EnhancedAdCollectionService } from "@/src/application/services/enhanced-ad-collection-service";

// 수집 요청 스키마
const collectionSchema = z.object({
  category: z.string().min(1, "카테고리를 입력해주세요."),
  platforms: z.array(z.string()).optional(),
  countPerPlatform: z.number().int().min(5).max(50).optional(),
  freshnessDays: z.number().int().min(1).max(90).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = collectionSchema.parse(body);

    console.log("🚀 광고 수집 시작:", validated);

    // 광고 수집 서비스 실행
    const collectionService = new EnhancedAdCollectionService();
    const result = await collectionService.collectAds({
      category: validated.category,
      platforms: validated.platforms,
      countPerPlatform: validated.countPerPlatform,
      freshnessDays: validated.freshnessDays,
    });

    console.log("✅ 광고 수집 완료:", result);

    return NextResponse.json({
      success: true,
      message: `총 ${result.totalSaved}개의 광고가 수집되었습니다.`,
      data: result,
    });

  } catch (error) {
    console.error("광고 수집 오류:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "입력 데이터가 유효하지 않습니다.", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "광고 수집 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}

// 수집 통계 조회
export async function GET(request: NextRequest) {
  try {
    const collectionService = new EnhancedAdCollectionService();
    const stats = await collectionService.getCollectionStatistics();

    return NextResponse.json({
      success: true,
      statistics: stats,
    });

  } catch (error) {
    console.error("통계 조회 오류:", error);
    return NextResponse.json(
      { error: "통계 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

