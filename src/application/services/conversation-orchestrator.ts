import { LLMProviderFactory } from "@/src/infrastructure/ai/llm-provider-factory";
import type { LLMModel } from "@/src/infrastructure/ai/types";
import { db } from "@/src/infrastructure/database";
import {
  conversationSessions,
  conversationTurns,
  type ConversationSession,
  type ConversationTurn,
} from "@/src/infrastructure/database/schema";
import { eq, asc, and } from "drizzle-orm";
import {
  CopyGenerationService,
  type CopyGenerationRequest,
  type CopyGenerationResponse,
} from "./copy-generation-service";

interface StartConversationOptions {
  preferredModel?: LLMModel;
  minChars?: number;
  maxChars?: number;
  tone?: string;
  count?: number;
}

interface FollowupPayload extends StartConversationOptions {
  message: string;
}

export type ConversationResult =
  | {
      type: "followup";
      sessionId: number;
      question: string;
    }
  | {
      type: "completion";
      sessionId: number;
      result: CopyGenerationResponse;
    };

export class ConversationOrchestrator {
  private readonly providerFactory = LLMProviderFactory.getInstance();
  private readonly copyService = new CopyGenerationService();

  async startConversation(
    userId: number,
    message: string,
    options: StartConversationOptions = {}
  ): Promise<ConversationResult> {
    const sessionId = await this.createSession(userId, options.preferredModel);
    await this.appendTurn(sessionId, "user", message);

    if (this.shouldClarify(message)) {
      const question = await this.generateClarifyingQuestion(message, options);
      await this.appendTurn(sessionId, "assistant", question);
      await this.updateSessionStatus(sessionId, "awaiting-info");
      return { type: "followup", sessionId, question };
    }

    const result = await this.generateCopies(sessionId, userId, options);
    await this.appendTurn(
      sessionId,
      "assistant",
      this.summarizeResult(result)
    );
    return { type: "completion", sessionId, result };
  }

  async continueConversation(
    sessionId: number,
    userId: number,
    payload: FollowupPayload
  ): Promise<ConversationResult> {
    await this.ensureSessionOwnership(sessionId, userId);
    await this.appendTurn(sessionId, "user", payload.message);

    if (this.shouldClarify(payload.message)) {
      const question = await this.generateClarifyingQuestion(payload.message, payload);
      await this.appendTurn(sessionId, "assistant", question);
      await this.updateSessionStatus(sessionId, "awaiting-info");
      return { type: "followup", sessionId, question };
    }

    const result = await this.generateCopies(sessionId, userId, payload);
    await this.appendTurn(
      sessionId,
      "assistant",
      this.summarizeResult(result)
    );
    return { type: "completion", sessionId, result };
  }

  async finalizeConversation(
    sessionId: number,
    userId: number,
    options: StartConversationOptions = {}
  ): Promise<ConversationResult> {
    await this.ensureSessionOwnership(sessionId, userId);
    const result = await this.generateCopies(sessionId, userId, options);
    await this.appendTurn(
      sessionId,
      "assistant",
      this.summarizeResult(result)
    );
    return { type: "completion", sessionId, result };
  }

  private async createSession(
    userId: number,
    preferredModel?: LLMModel
  ): Promise<number> {
    const [session] = await db
      .insert(conversationSessions)
      .values({
        userId,
        preferredModel: preferredModel ?? null,
        status: "draft",
      })
      .returning({ id: conversationSessions.id });

    return session.id;
  }

  private async updateSessionStatus(
    sessionId: number,
    status: "draft" | "awaiting-info" | "completed"
  ) {
    await db
      .update(conversationSessions)
      .set({ status, updatedAt: new Date() })
      .where(eq(conversationSessions.id, sessionId));
  }

  private async appendTurn(
    sessionId: number,
    role: "user" | "assistant" | "system",
    message: string,
    metadata?: Record<string, unknown>
  ) {
    await db.insert(conversationTurns).values({
      sessionId,
      role,
      message,
      metadata: metadata ?? null,
    });
  }

  private async ensureSessionOwnership(sessionId: number, userId: number) {
    const [session] = await db
      .select({ id: conversationSessions.id })
      .from(conversationSessions)
      .where(
        and(
          eq(conversationSessions.id, sessionId),
          eq(conversationSessions.userId, userId)
        )
      )
      .limit(1);

    if (!session) {
      throw new Error("세션을 찾을 수 없거나 권한이 없습니다.");
    }
  }

  private async generateCopies(
    sessionId: number,
    userId: number,
    options: StartConversationOptions
  ): Promise<CopyGenerationResponse> {
    const turns = await this.getConversationTurns(sessionId);
    const prompt = this.composePrompt(turns);

    const request: CopyGenerationRequest = {
      userId,
      prompt,
      minChars: options.minChars ?? 30,
      maxChars: options.maxChars ?? 50,
      tone: options.tone,
      count: options.count,
      preferredModel: options.preferredModel,
      sessionId,
    };

    const result = await this.copyService.generate(request);

    await db
      .update(conversationSessions)
      .set({
        recommendedModel: result.modelUsed,
        status: "completed",
        context: {
          minChars: request.minChars,
          maxChars: request.maxChars,
          tone: request.tone,
          count: request.count,
        },
        updatedAt: new Date(),
      })
      .where(eq(conversationSessions.id, sessionId));

    return result;
  }

  private async getConversationTurns(sessionId: number) {
    return db
      .select()
      .from(conversationTurns)
      .where(eq(conversationTurns.sessionId, sessionId))
      .orderBy(asc(conversationTurns.createdAt));
  }

  private composePrompt(turns: ConversationTurn[]): string {
    const userMessages = turns.filter((turn) => turn.role === "user");
    return userMessages.map((turn) => turn.message.trim()).join("\n\n");
  }

  private shouldClarify(message: string): boolean {
    if (message.length < 30) {
      return true;
    }

    const mustHave = ["타겟", "제품", "카피", "광고"];
    const hit = mustHave.some((keyword) => message.includes(keyword));
    return !hit;
  }

  private async generateClarifyingQuestion(
    message: string,
    options: StartConversationOptions
  ): Promise<string> {
    try {
      const provider = this.providerFactory.resolve("gpt-5");
      const prompt = `당신은 광고 카피 제작을 위한 어시스턴트입니다.
사용자의 입력: "${message}"

부족한 정보를 보완하기 위해 한 가지 질문만 하세요. 질문은 한국어로 작성하고, 가능한 한 구체적이어야 합니다.
JSON 객체 {"question": "..."} 형태로만 반환하세요.`;

      const result = await provider.generateCopies({
        prompt,
        minChars: 5,
        maxChars: 100,
        count: 1,
        creativeGuidelines: [
          {
            title: "Output Format",
            description: "JSON 객체 하나만 반환",
          },
        ],
      });

      const text = result.copies[0];
      if (text) {
        return text.trim();
      }
    } catch (error) {
      console.warn("Clarifying question 생성 실패, 기본 질문 사용", error);
    }

    return "조금 더 자세히 알려주세요. 어떤 상품을 어떤 타겟에게 홍보하고 싶은가요?";
  }

  private summarizeResult(result: CopyGenerationResponse): string {
    return JSON.stringify({
      model: result.modelUsed,
      copies: result.copies.map((copy) => ({
        id: copy.id,
        content: copy.content,
      })),
      tokenUsage: result.tokenUsage,
    });
  }
}

