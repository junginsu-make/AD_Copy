// 카피 삭제 API 엔드포인트
import { NextRequest, NextResponse } from "next/server";
import { AuthenticatedRequest, authenticateRequest } from "@/lib/auth/middleware";
import { db } from "@/src/infrastructure/database";
import { copies } from "@/src/infrastructure/database/schema";
import { eq, and } from "drizzle-orm";

// DELETE: 카피 삭제
async function deleteHandler(
  request: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = request.userId!;
    const { id } = await params;
    const copyId = parseInt(id);

    if (isNaN(copyId)) {
      return NextResponse.json(
        { error: "유효하지 않은 카피 ID입니다." },
        { status: 400 }
      );
    }

    // 카피 존재 및 소유권 확인
    const [copy] = await db
      .select()
      .from(copies)
      .where(and(eq(copies.id, copyId), eq(copies.userId, userId)))
      .limit(1);

    if (!copy) {
      return NextResponse.json(
        { error: "카피를 찾을 수 없거나 삭제할 권한이 없습니다." },
        { status: 404 }
      );
    }

    // 삭제 (soft delete)
    await db
      .update(copies)
      .set({ deletedAt: new Date() })
      .where(eq(copies.id, copyId));

    return NextResponse.json(
      { message: "카피가 삭제되었습니다." },
      { status: 200 }
    );
  } catch (error) {
    console.error("카피 삭제 오류:", error);
    return NextResponse.json(
      { error: "카피 삭제 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const authResult = authenticateRequest(request);
  if (!authResult.authenticated || !authResult.userId) {
    return NextResponse.json(
      { error: authResult.error || "인증이 필요합니다." },
      { status: 401 }
    );
  }
  const authRequest = request as AuthenticatedRequest;
  authRequest.userId = authResult.userId;
  return deleteHandler(authRequest, context);
}

