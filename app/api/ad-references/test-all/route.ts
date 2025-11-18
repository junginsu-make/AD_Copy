/**
 * Firecrawl 통합 테스트 엔드포인트
 * 모든 플랫폼에서 실제 광고 수집 가능 여부를 테스트
 */

import { NextRequest, NextResponse } from "next/server";
import { FirecrawlTestService } from "@/src/application/services/firecrawl-test-service";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const keyword = searchParams.get("keyword") || "스킨케어";

    console.log(`\n=== Firecrawl 통합 테스트 시작 ===`);
    console.log(`키워드: ${keyword}`);

    const testService = new FirecrawlTestService();
    const results = await testService.testAllPlatforms(keyword);

    // 전체 결과 요약
    const summary = {
      totalPlatforms: results.length,
      successCount: results.filter((r) => r.success).length,
      failedCount: results.filter((r) => !r.success).length,
      totalAdsCollected: results.reduce((sum, r) => sum + r.adCount, 0),
      platformsWithAds: results.filter((r) => r.adCount > 0).map((r) => r.platform),
    };

    console.log(`\n=== 테스트 결과 요약 ===`);
    console.log(`성공: ${summary.successCount}/${summary.totalPlatforms}`);
    console.log(`수집된 광고: ${summary.totalAdsCollected}개`);
    console.log(`광고 수집 성공 플랫폼: ${summary.platformsWithAds.join(", ")}`);

    return NextResponse.json({
      success: true,
      keyword,
      timestamp: new Date().toISOString(),
      summary,
      results: results.map((r) => ({
        platform: r.platform,
        success: r.success,
        dataCollected: r.dataCollected,
        adCount: r.adCount,
        ads: r.ads.map((ad) => ({
          id: ad.id,
          headline: ad.headline,
          description: ad.description,
          url: ad.url,
        })),
        analysis: r.analysis,
        error: r.error,
      })),
    });
  } catch (error: any) {
    console.error("통합 테스트 실패:", error);
    return NextResponse.json(
      {
        success: false,
        error: "통합 테스트 중 오류가 발생했습니다.",
        details: error.message,
        hint: error.message.includes("FIRECRAWL_API_KEY")
          ? ".env 또는 .env.local 파일에 FIRECRAWL_API_KEY를 확인하세요."
          : "서버 로그를 확인하세요.",
      },
      { status: 500 }
    );
  }
}

