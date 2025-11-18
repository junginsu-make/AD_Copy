import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth/middleware";
import { z } from "zod";
import { ConversationOrchestrator } from "@/src/application/services/conversation-orchestrator";

const bodySchema = z.object({
  sessionId: z.number().int().positive(),
  preferredModel: z.enum(["gpt-5", "gemini-2.5-pro", "claude-sonnet-4"]).optional(),
  minChars: z.number().int().min(10).max(500).optional(),
  maxChars: z.number().int().min(10).max(500).optional(),
  tone: z
    .enum(["casual", "formal", "urgent", "humorous", "professional", "neutral"])
    .optional(),
  count: z.number().int().min(1).max(10).optional(),
});

const orchestrator = new ConversationOrchestrator();

async function handler(request: AuthenticatedRequest) {
  try {
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "입력 값이 유효하지 않습니다.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { sessionId, ...options } = parsed.data;
    const userId = request.userId!;

    const result = await orchestrator.finalizeConversation(
      sessionId,
      userId,
      options
    );

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("대화 마무리 오류:", error);
    return NextResponse.json(
      { error: "대화를 마무리하는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// 프로토타입 테스트용: 인증 우회
async function handlerNoAuth(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "입력 값이 유효하지 않습니다.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { sessionId, ...options } = parsed.data;
    const userId = 1; // 테스트용 고정 userId

    const result = await orchestrator.finalizeConversation(
      sessionId,
      userId,
      options
    );

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("대화 마무리 오류:", error);
    return NextResponse.json(
      { error: "대화를 마무리하는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export const POST = handlerNoAuth; // 임시로 인증 없이 사용

