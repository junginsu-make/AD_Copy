/**
 * 광고 레퍼런스 전체 조회 API
 * GET /api/ad-references/list?page=1&limit=20&platform=naver&sortBy=performanceScore
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/infrastructure/database/db";
import { adReferences } from "@/src/infrastructure/database/schema";
import { eq, desc, asc, sql, and } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // 파라미터 추출
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const platform = searchParams.get("platform");
    const sortBy = searchParams.get("sortBy") || "collectedAt";
    const order = searchParams.get("order") || "desc";
    const category = searchParams.get("category");
    const minPerformance = parseFloat(searchParams.get("minPerformance") || "0");

    // 필터 조건 구성
    const conditions = [];
    
    if (platform) {
      conditions.push(eq(adReferences.platform, platform));
    }
    
    if (category) {
      conditions.push(eq(adReferences.category, category));
    }
    
    if (minPerformance > 0) {
      conditions.push(sql`${adReferences.performanceScore} >= ${minPerformance}`);
    }
    
    // 활성 상태만
    conditions.push(eq(adReferences.status, "active"));

    // 정렬 컬럼 결정
    let orderByColumn;
    switch (sortBy) {
      case "performanceScore":
        orderByColumn = adReferences.performanceScore;
        break;
      case "successCount":
        orderByColumn = adReferences.successCount;
        break;
      case "usageCount":
        orderByColumn = adReferences.usageCount;
        break;
      case "collectedAt":
      default:
        orderByColumn = adReferences.collectedAt;
        break;
    }

    // 총 개수 조회
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(adReferences)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    // 데이터 조회
    const offset = (page - 1) * limit;
    const references = await db
      .select({
        id: adReferences.id,
        platform: adReferences.platform,
        adCopy: adReferences.adCopy,
        headline: adReferences.headline,
        description: adReferences.description,
        category: adReferences.category,
        industry: adReferences.industry,
        targetAudience: adReferences.targetAudience,
        brand: adReferences.brand,
        keywords: adReferences.keywords,
        copywritingFormula: adReferences.copywritingFormula,
        psychologicalTriggers: adReferences.psychologicalTriggers,
        tone: adReferences.tone,
        charCount: adReferences.charCount,
        performanceScore: adReferences.performanceScore,
        qualityRating: adReferences.qualityRating,
        usageCount: adReferences.usageCount,
        successCount: adReferences.successCount,
        sourceUrl: adReferences.sourceUrl,
        collectedVia: adReferences.collectedVia,
        collectedAt: adReferences.collectedAt,
        isPremium: adReferences.isPremium,
        isSelected: adReferences.isSelected, // 체크박스 선택 상태
      })
      .from(adReferences)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(order === "asc" ? asc(orderByColumn) : desc(orderByColumn))
      .limit(limit)
      .offset(offset);

    // 페이지네이션 정보
    const totalPages = Math.ceil(count / limit);

    return NextResponse.json({
      success: true,
      data: references,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: count,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
      filters: {
        platform,
        category,
        minPerformance,
        sortBy,
        order,
      },
    });
  } catch (error) {
    console.error("광고 레퍼런스 조회 오류:", error);
    return NextResponse.json(
      {
        success: false,
        error: "광고 레퍼런스 조회 중 오류가 발생했습니다.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

