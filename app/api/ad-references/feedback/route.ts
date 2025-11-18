/**
 * 광고 레퍼런스 피드백 API
 * POST /api/ad-references/feedback
 * 사용자가 광고 레퍼런스에 평가를 남기는 엔드포인트
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/src/infrastructure/database/db";
import { adReferences } from "@/src/infrastructure/database/schema";
import { eq, sql } from "drizzle-orm";

// 광고 레퍼런스 피드백 스키마
const adReferenceFeedbackSchema = z.object({
  adReferenceId: z.number().int().positive(),
  rating: z.number().int().min(1).max(5), // 1~5점
  isUseful: z.boolean().optional(), // 유용한지 여부
  feedbackNote: z.string().optional(), // 피드백 메모
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = adReferenceFeedbackSchema.parse(body);

    console.log("광고 레퍼런스 피드백 받음:", {
      adReferenceId: validated.adReferenceId,
      rating: validated.rating,
    });

    // 광고 레퍼런스가 존재하는지 확인
    const [adRef] = await db
      .select({ id: adReferences.id })
      .from(adReferences)
      .where(eq(adReferences.id, validated.adReferenceId))
      .limit(1);

    if (!adRef) {
      return NextResponse.json(
        { error: "광고 레퍼런스를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 품질 평가 업데이트
    await db
      .update(adReferences)
      .set({
        qualityRating: validated.rating,
        updatedAt: new Date(),
      })
      .where(eq(adReferences.id, validated.adReferenceId));

    // 평점이 좋으면 (4점 이상) 성능 점수 상승
    if (validated.rating >= 4) {
      await db.execute(sql`
        UPDATE ad_references
        SET performance_score = LEAST(performance_score + 0.05, 1.0),
            success_count = success_count + 1
        WHERE id = ${validated.adReferenceId}
      `);
    }

    // 평점이 낮으면 (2점 이하) 성능 점수 하락
    if (validated.rating <= 2) {
      await db.execute(sql`
        UPDATE ad_references
        SET performance_score = GREATEST(performance_score - 0.05, 0.0)
        WHERE id = ${validated.adReferenceId}
      `);
    }

    console.log("광고 레퍼런스 피드백 저장 완료");

    return NextResponse.json({
      success: true,
      message: "피드백이 저장되었습니다.",
    });
  } catch (error) {
    console.error("광고 레퍼런스 피드백 오류:", error);

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

