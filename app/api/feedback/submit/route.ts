/**
 * 카피 피드백 제출 API
 * 사용자가 생성된 광고에 평가를 남기는 엔드포인트
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/src/infrastructure/database/db";
import { copyFeedback, fewshotLearningLog, adReferences, copies } from "@/src/infrastructure/database/schema";
import { eq, sql, and } from "drizzle-orm";

// 피드백 스키마
const feedbackSchema = z.object({
  copyId: z.number().int().positive(),
  userId: z.number().int().positive().optional().default(1), // 임시: 테스트용
  rating: z.number().int().min(1).max(5),
  isFavorite: z.boolean().optional(),
  isUsed: z.boolean().optional(),
  feedbackText: z.string().optional(),
  feedbackTags: z.array(z.string()).optional(),
  actualCtr: z.number().min(0).max(1).optional(),
  actualConversionRate: z.number().min(0).max(1).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = feedbackSchema.parse(body);

    console.log("📝 피드백 받음:", {
      copyId: validated.copyId,
      rating: validated.rating,
      tags: validated.feedbackTags,
    });

    // 1. 피드백 저장 (중복 시 업데이트)
    const [feedback] = await db
      .insert(copyFeedback)
      .values({
        copyId: validated.copyId,
        userId: validated.userId,
        rating: validated.rating,
        isFavorite: validated.isFavorite,
        isUsed: validated.isUsed,
        feedbackText: validated.feedbackText,
        feedbackTags: validated.feedbackTags,
        actualCtr: validated.actualCtr?.toString() as any,
        actualConversionRate: validated.actualConversionRate?.toString() as any,
      })
      .onConflictDoUpdate({
        target: [copyFeedback.copyId, copyFeedback.userId],
        set: {
          rating: validated.rating,
          isFavorite: validated.isFavorite,
          isUsed: validated.isUsed,
          feedbackText: validated.feedbackText,
          feedbackTags: validated.feedbackTags,
          actualCtr: validated.actualCtr?.toString() as any,
          actualConversionRate: validated.actualConversionRate?.toString() as any,
        },
      })
      .returning();

    console.log("✅ 피드백 저장 완료");

    // 2. Few-shot 학습 로그 업데이트
    await db.execute(sql`
      UPDATE fewshot_learning_log
      SET 
        user_satisfaction = ${validated.rating},
        result_quality = ${validated.rating / 5.0}
      WHERE copy_id = ${validated.copyId}
    `);

    console.log("✅ 학습 로그 업데이트 완료");

    // 3. 성공 카운트 증가 (평점 4 이상)
    if (validated.rating >= 4) {
      await db.execute(sql`
        UPDATE ad_references
        SET success_count = success_count + 1
        WHERE id IN (
          SELECT ad_reference_id 
          FROM fewshot_learning_log 
          WHERE copy_id = ${validated.copyId}
        )
      `);

      console.log("✅ 광고 레퍼런스 성공 카운트 증가");
    }

    // 4. 실제 성과 데이터가 있으면 레퍼런스 품질 점수 업데이트
    if (validated.actualCtr || validated.actualConversionRate) {
      const performanceScore = 
        (validated.actualCtr || 0) * 0.3 + 
        (validated.actualConversionRate || 0) * 0.7;

      await db.execute(sql`
        UPDATE ad_references
        SET performance_score = ${performanceScore}
        WHERE id IN (
          SELECT ad_reference_id 
          FROM fewshot_learning_log 
          WHERE copy_id = ${validated.copyId}
        )
      `);

      console.log("✅ 성과 기반 품질 점수 업데이트:", performanceScore);
    }

    return NextResponse.json({
      success: true,
      message: "피드백이 저장되었습니다.",
      feedback,
    });

  } catch (error) {
    console.error("피드백 저장 오류:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "입력 데이터가 유효하지 않습니다.", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "피드백 저장 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// 피드백 조회 API
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const copyId = searchParams.get("copyId");
    const userId = searchParams.get("userId") || "1";

    if (!copyId) {
      return NextResponse.json(
        { error: "copyId가 필요합니다." },
        { status: 400 }
      );
    }

    // 해당 카피의 피드백 조회
    const feedbacks = await db
      .select()
      .from(copyFeedback)
      .where(
        and(
          eq(copyFeedback.copyId, parseInt(copyId)),
          eq(copyFeedback.userId, parseInt(userId))
        )
      );

    return NextResponse.json({
      feedback: feedbacks[0] || null,
    });

  } catch (error) {
    console.error("피드백 조회 오류:", error);
    return NextResponse.json(
      { error: "피드백 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

