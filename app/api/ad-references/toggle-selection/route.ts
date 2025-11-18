/**
 * 광고 레퍼런스 선택 토글 API
 * POST /api/ad-references/toggle-selection
 * 
 * 사용자가 체크박스를 클릭하면 isSelected 값을 토글
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth/middleware";
import { db } from "@/src/infrastructure/database";
import { adReferences } from "@/src/infrastructure/database/schema";
import { eq, sql } from "drizzle-orm";

const toggleSchema = z.object({
  adReferenceId: z.number().int().positive(),
  isSelected: z.boolean(),
});

async function handler(request: AuthenticatedRequest) {
  try {
    const body = await request.json();
    const validated = toggleSchema.parse(body);

    console.log(`광고 레퍼런스 선택 토글: ID ${validated.adReferenceId} → ${validated.isSelected}`);

    // 광고 레퍼런스 존재 확인
    const [adRef] = await db
      .select({ 
        id: adReferences.id,
        isPremium: adReferences.isPremium,
      })
      .from(adReferences)
      .where(eq(adReferences.id, validated.adReferenceId))
      .limit(1);

    if (!adRef) {
      return NextResponse.json(
        { error: "광고 레퍼런스를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 수동 입력(isPremium)은 선택 해제 불가
    if (adRef.isPremium && !validated.isSelected) {
      return NextResponse.json(
        { 
          error: "수동 입력한 광고는 선택 해제할 수 없습니다.",
          message: "수동 입력 광고는 항상 카피 생성에 반영됩니다."
        },
        { status: 400 }
      );
    }

    // isSelected 업데이트
    await db
      .update(adReferences)
      .set({
        isSelected: validated.isSelected,
        updatedAt: new Date(),
      })
      .where(eq(adReferences.id, validated.adReferenceId));

    console.log(`✅ 선택 상태 업데이트 완료: ${validated.isSelected ? "선택" : "선택 해제"}`);

    return NextResponse.json({
      success: true,
      message: validated.isSelected 
        ? "이 광고가 카피 생성 시 우선 반영됩니다." 
        : "카피 생성 시 반영되지 않습니다.",
      data: {
        id: validated.adReferenceId,
        isSelected: validated.isSelected,
      },
    });
  } catch (error) {
    console.error("선택 토글 오류:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "입력 데이터가 유효하지 않습니다.", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "선택 상태 업데이트 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export const POST = withAuth(handler);

