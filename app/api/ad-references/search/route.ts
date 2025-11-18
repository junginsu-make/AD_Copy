// 광고 레퍼런스 검색 API
// GET /api/ad-references/search?keywords=스킨케어&platform=meta,naver&limit=10

import { NextRequest, NextResponse } from "next/server";
import { AdReferenceService } from "@/src/application/services/ad-reference-service";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // 파라미터 추출
    const keywords = searchParams.get("keywords")?.split(",") ?? [];
    const platformsParam = searchParams.get("platform")?.split(",") ?? ["meta", "google", "naver"];
    const limit = parseInt(searchParams.get("limit") ?? "10");
    const category = searchParams.get("category") ?? undefined;

    if (keywords.length === 0) {
      return NextResponse.json(
        { error: "keywords 파라미터가 필요합니다." },
        { status: 400 }
      );
    }

    // 플랫폼 검증
    const validPlatforms = ["meta", "google", "naver", "kakao"];
    const platforms = platformsParam.filter((p) =>
      validPlatforms.includes(p)
    ) as Array<"meta" | "google" | "naver" | "kakao">;

    if (platforms.length === 0) {
      return NextResponse.json(
        { error: "유효한 플랫폼을 선택하세요." },
        { status: 400 }
      );
    }

    // 광고 레퍼런스 검색
    const adRefService = new AdReferenceService();
    const references = await adRefService.searchAllPlatforms({
      keywords,
      platform: platforms,
      category,
      limit,
    });

    return NextResponse.json({
      success: true,
      count: references.length,
      references,
      metadata: {
        keywords,
        platforms,
        limit,
        searchedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("광고 레퍼런스 검색 실패:", error);
    return NextResponse.json(
      {
        error: "광고 레퍼런스 검색에 실패했습니다.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * 사용 예시:
 * 
 * GET /api/ad-references/search?keywords=스킨케어,30대&platform=meta,naver&limit=10
 * 
 * 응답:
 * {
 *   "success": true,
 *   "count": 10,
 *   "references": [
 *     {
 *       "id": "meta-1",
 *       "platform": "meta",
 *       "adCopy": "지금 바로 시작하세요! 30대 여성을 위한 프리미엄 스킨케어",
 *       "analysis": {
 *         "formula": "AIDA",
 *         "triggers": ["긴급성", "구체성"],
 *         "charCount": 31
 *       },
 *       "engagement": {
 *         "ctr": 5.0
 *       }
 *     },
 *     ...
 *   ]
 * }
 */

