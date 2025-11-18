/**
 * 수동 광고 카피 추가 API
 * POST /api/ad-references/manual
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth/middleware";
import { db } from "@/src/infrastructure/database";
import { adReferences } from "@/src/infrastructure/database/schema";

const manualCopySchema = z.object({
  headline: z.string().min(5, "제목은 최소 5자 이상이어야 합니다."),
  description: z.string().optional(),
  platform: z.enum(["naver", "google", "meta", "kakao"]),
});

async function handler(request: AuthenticatedRequest) {
  try {
    const body = await request.json();
    const validated = manualCopySchema.parse(body);

    const adCopy = validated.description
      ? `${validated.headline} ${validated.description}`
      : validated.headline;

    // 자동 분석
    const analysis = analyzeAdCopy(adCopy);

    // DB에 저장 (수동 입력 광고는 무조건 선택 상태로 저장)
    const [savedAd] = await db
      .insert(adReferences)
      .values({
        platform: validated.platform,
        adCopy: adCopy.trim(),
        headline: validated.headline,
        description: validated.description || null,
        category: "사용자 입력",
        industry: null,
        targetAudience: null,
        brand: null,
        keywords: [],
        copywritingFormula: analysis.formula,
        psychologicalTriggers: analysis.triggers,
        tone: analysis.tone,
        charCount: adCopy.length,
        performanceScore: "0.7", // 수동 입력은 기본 70점
        qualityRating: 5, // 사용자가 직접 입력했으므로 5점
        usageCount: 0,
        successCount: 0,
        sourceUrl: null,
        collectedVia: "manual-input",
        collectedAt: new Date(),
        status: "active",
        isPremium: true, // 수동 입력은 프리미엄
        isSelected: true, // 수동 입력은 자동으로 선택 (무조건 카피 생성 시 반영)
      })
      .returning();

    console.log("수동 카피 저장 완료:", savedAd.id);

    return NextResponse.json({
      success: true,
      message: "카피가 저장되었습니다.",
      data: savedAd,
    });
  } catch (error) {
    console.error("수동 카피 저장 오류:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "입력 데이터가 유효하지 않습니다.", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "카피 저장 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

function analyzeAdCopy(adCopy: string): {
  formula: string;
  triggers: string[];
  tone: string;
} {
  const triggers: string[] = [];

  // 긴급성
  if (/오늘|지금|마감|한정|품절/i.test(adCopy)) {
    triggers.push("긴급성");
  }

  // 희소성
  if (/단\s*\d+|한정|독점|특별/i.test(adCopy)) {
    triggers.push("희소성");
  }

  // 사회적 증명
  if (/\d+만|\d+%|1위|베스트|인기/i.test(adCopy)) {
    triggers.push("사회적 증명");
  }

  // 감성
  if (/느껴|경험|특별|소중|행복/i.test(adCopy)) {
    triggers.push("감정적 연결");
  }

  // 톤 분석
  let tone = "neutral";
  if (/느껴보세요|경험|특별한|소중한/i.test(adCopy)) {
    tone = "emotional";
  } else if (/할인|특가|이벤트/i.test(adCopy)) {
    tone = "urgent";
  } else if (/프리미엄|럭셔리|품격/i.test(adCopy)) {
    tone = "premium";
  }

  // 공식 추정
  let formula = "AIDA";
  if (/\d+%|\d+배/i.test(adCopy)) {
    formula = "FAB";
  } else if (/예전|처음|지금/i.test(adCopy)) {
    formula = "BAB";
  }

  return { formula, triggers, tone };
}

export const POST = withAuth(handler);

