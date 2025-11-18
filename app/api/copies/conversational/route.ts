/**
 * 대화형 카피 생성 API
 * POST /api/copies/conversational/start - 새 대화 시작
 * POST /api/copies/conversational/continue - 대화 계속
 * GET /api/copies/conversational/history - 대화 히스토리 조회
 */

import { NextResponse } from "next/server";
import {
  ConversationalCopyService,
  type StartConversationOptions,
} from "@/src/application/services/conversational-copy-service";
import { withAuth, AuthenticatedRequest } from "@/lib/auth/middleware";

async function handler(request: any) {
  try {
    const body = await request.json();
    const { action, ...payload } = body;

    const service = new ConversationalCopyService();
    const userId = request.userId || 1; // 테스트용 기본값

    // action에 따라 분기
    if (action === "start") {
      // 새 대화 시작
      const { initialMessage, context } = payload;

      if (!initialMessage || typeof initialMessage !== "string") {
        return NextResponse.json(
          { error: "initialMessage가 필요합니다." },
          { status: 400 }
        );
      }

      const options: StartConversationOptions = {
        userId,
        initialMessage,
        context: context || {},
      };

      const result = await service.startConversation(options);

      return NextResponse.json({
        success: true,
        data: result,
      });
    } else if (action === "continue") {
      // 대화 계속
      const { sessionId, message } = payload;

      if (!sessionId || !message) {
        return NextResponse.json(
          { error: "sessionId와 message가 필요합니다." },
          { status: 400 }
        );
      }

      const result = await service.continueConversation({
        sessionId,
        userId,
        message,
      });

      return NextResponse.json({
        success: true,
        data: result,
      });
    } else if (action === "history") {
      // 대화 히스토리 조회
      const { sessionId } = payload;

      if (!sessionId) {
        return NextResponse.json(
          { error: "sessionId가 필요합니다." },
          { status: 400 }
        );
      }

      const history = await service.getConversationHistory(sessionId, userId);

      return NextResponse.json({
        success: true,
        data: { history },
      });
    } else {
      return NextResponse.json(
        { error: "올바르지 않은 action입니다. (start, continue, history)" },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error("대화형 카피 생성 API 오류:", error);

    return NextResponse.json(
      {
        error: "대화형 카피 생성 중 오류가 발생했습니다.",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

// 인증 우회 (테스트용)
export const POST = handler;

