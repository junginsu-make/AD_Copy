/**
 * 통계 요약 API
 * GET /api/analytics/summary?userId=1
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/infrastructure/database/db";
import { 
  copies, 
  copyFeedback, 
  adReferences, 
  modelUsageLogs,
  conversationSessions 
} from "@/src/infrastructure/database/schema";
import { eq, sql, and, gte, desc, asc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = parseInt(searchParams.get("userId") || "1");
    const days = parseInt(searchParams.get("days") || "30"); // 최근 N일

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // 1. 카피 생성 통계
    const copyStats = await db
      .select({
        totalCopies: sql<number>`count(*)::int`,
        avgCharCount: sql<number>`avg(${copies.charCount})::int`,
        totalCost: sql<number>`sum(${copies.apiCost})::numeric`,
      })
      .from(copies)
      .where(
        and(
          eq(copies.userId, userId),
          gte(copies.createdAt, startDate)
        )
      );

    // 2. 모델별 사용 통계
    const modelStats = await db
      .select({
        model: copies.modelUsed,
        count: sql<number>`count(*)::int`,
      })
      .from(copies)
      .where(
        and(
          eq(copies.userId, userId),
          gte(copies.createdAt, startDate)
        )
      )
      .groupBy(copies.modelUsed)
      .orderBy(desc(sql<number>`count(*)::int`));

    // 3. 피드백 통계
    const feedbackStats = await db
      .select({
        avgRating: sql<number>`avg(${copyFeedback.rating})::numeric`,
        totalFeedbacks: sql<number>`count(*)::int`,
        favoriteCount: sql<number>`count(*) filter (where ${copyFeedback.isFavorite} = true)::int`,
        usedCount: sql<number>`count(*) filter (where ${copyFeedback.isUsed} = true)::int`,
      })
      .from(copyFeedback)
      .where(eq(copyFeedback.userId, userId));

    // 4. 대화 세션 통계
    const sessionStats = await db
      .select({
        totalSessions: sql<number>`count(*)::int`,
        completedSessions: sql<number>`count(*) filter (where ${conversationSessions.status} = 'completed')::int`,
      })
      .from(conversationSessions)
      .where(
        and(
          eq(conversationSessions.userId, userId),
          gte(conversationSessions.createdAt, startDate)
        )
      );

    // 5. 광고 레퍼런스 통계 (전체)
    const adRefStats = await db
      .select({
        totalAdRefs: sql<number>`count(*)::int`,
        avgPerformance: sql<number>`avg(${adReferences.performanceScore})::numeric`,
      })
      .from(adReferences)
      .where(eq(adReferences.status, "active"));
    
    // 6. 플랫폼별 광고 레퍼런스 개수 (별도 쿼리)
    const platformStats = await db
      .select({
        platform: adReferences.platform,
        count: sql<number>`count(*)::int`,
      })
      .from(adReferences)
      .where(eq(adReferences.status, "active"))
      .groupBy(adReferences.platform);

    // 7. 최근 활동 (일별)
    const dailyActivity = await db
      .select({
        date: sql<string>`date(${copies.createdAt})`,
        count: sql<number>`count(*)::int`,
        cost: sql<number>`sum(${copies.apiCost})::numeric`,
      })
      .from(copies)
      .where(
        and(
          eq(copies.userId, userId),
          gte(copies.createdAt, startDate)
        )
      )
      .groupBy(sql`date(${copies.createdAt})`)
      .orderBy(desc(sql<string>`date(${copies.createdAt})`))
      .limit(30);

    return NextResponse.json({
      success: true,
      period: {
        days,
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
      },
      copyStats: {
        totalCopies: copyStats[0]?.totalCopies || 0,
        avgCharCount: copyStats[0]?.avgCharCount || 0,
        totalCost: parseFloat(copyStats[0]?.totalCost || "0"),
      },
      modelStats: modelStats.map(m => ({
        model: m.model,
        count: m.count,
      })),
      feedbackStats: {
        avgRating: parseFloat(feedbackStats[0]?.avgRating || "0"),
        totalFeedbacks: feedbackStats[0]?.totalFeedbacks || 0,
        favoriteCount: feedbackStats[0]?.favoriteCount || 0,
        usedCount: feedbackStats[0]?.usedCount || 0,
      },
      sessionStats: {
        totalSessions: sessionStats[0]?.totalSessions || 0,
        completedSessions: sessionStats[0]?.completedSessions || 0,
      },
      adRefStats: {
        totalAdRefs: adRefStats[0]?.totalAdRefs || 0,
        avgPerformance: parseFloat(adRefStats[0]?.avgPerformance || "0"),
        platformCounts: platformStats.reduce((acc, p) => {
          acc[p.platform] = p.count;
          return acc;
        }, {} as Record<string, number>),
      },
      dailyActivity: dailyActivity.map(d => ({
        date: d.date,
        count: d.count,
        cost: parseFloat(d.cost || "0"),
      })),
    });
  } catch (error) {
    console.error("통계 조회 오류:", error);
    return NextResponse.json(
      {
        success: false,
        error: "통계 조회 중 오류가 발생했습니다.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

