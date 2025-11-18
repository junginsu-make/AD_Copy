/**
 * 현재 사용자 정보 조회 API
 * GET /api/auth/me
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth/middleware";
import { db } from "@/src/infrastructure/database";
import { users } from "@/src/infrastructure/database/schema";
import { eq } from "drizzle-orm";

async function handler(request: AuthenticatedRequest) {
  try {
    const userId = request.userId!;

    // 사용자 정보 조회
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        tier: users.tier,
        apiQuotaUsed: users.apiQuotaUsed,
        apiQuotaLimit: users.apiQuotaLimit,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return NextResponse.json(
        { error: "사용자를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        tier: user.tier,
        apiQuotaUsed: user.apiQuotaUsed || 0,
        apiQuotaLimit: user.apiQuotaLimit || 100,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("사용자 정보 조회 오류:", error);
    return NextResponse.json(
      { error: "사용자 정보 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export const GET = withAuth(handler);

