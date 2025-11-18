// 카피 목록 조회 API 엔드포인트
import { NextRequest } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/auth/middleware";
import { NextResponse } from "next/server";
import { db } from "@/src/infrastructure/database";
import { copies } from "@/src/infrastructure/database/schema";
import { eq, desc, asc } from "drizzle-orm";

async function handler(request: AuthenticatedRequest) {
  try {
    const userId = request.userId!;
    const { searchParams } = new URL(request.url);

    // 쿼리 파라미터 파싱
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const sort = searchParams.get("sort") || "created_at";
    const folder = searchParams.get("folder");

    const offset = (page - 1) * limit;

    // 기본 쿼리 생성
    let query = db
      .select()
      .from(copies)
      .where(eq(copies.userId, userId));

    // 폴더 필터
    if (folder) {
      query = query.where(eq(copies.folderName, folder));
    }

    // 정렬 적용
    const sortOrder = searchParams.get("order") === "asc" ? asc : desc;
    if (sort === "char_count") {
      query = query.orderBy(sortOrder(copies.charCount));
    } else if (sort === "content") {
      query = query.orderBy(sortOrder(copies.generatedContent));
    } else {
      query = query.orderBy(desc(copies.createdAt));
    }

    // 페이지네이션 적용
    const result = await query.limit(limit).offset(offset);

    // 전체 개수 조회 (수정)
    const countResult = await db
      .select({ count: copies.id })
      .from(copies)
      .where(eq(copies.userId, userId));

    const total = countResult.length;

    // 응답 반환
    return NextResponse.json({
      success: true,
      data: result.map((copy) => ({
        id: copy.id,
        prompt: copy.prompt,
        generatedContent: copy.generatedContent,
        charCount: copy.charCount,
        tone: copy.tone,
        modelUsed: copy.modelUsed,
        status: copy.status,
        isBookmarked: copy.isBookmarked,
        generationTimeMs: copy.generationTimeMs,
        apiCost: copy.apiCost,
        metadata: copy.metadata,
        createdAt: copy.createdAt,
      })),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit,
        hasNextPage: page < Math.ceil(total / limit),
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    console.error("카피 목록 조회 오류:", error);
    return NextResponse.json(
      { error: "카피 목록 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export const GET = withAuth(handler);

