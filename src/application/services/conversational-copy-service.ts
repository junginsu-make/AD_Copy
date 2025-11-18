/**
 * 대화형 카피 생성 서비스
 * Claude Sonnet 4.5를 사용하여 사용자와 자연스러운 대화를 통해 카피를 생성하고 개선
 */

import { ClaudeSonnet45Provider } from "@/src/infrastructure/ai/claude-provider";
import { db } from "@/src/infrastructure/database";
import {
  conversationSessions,
  conversationTurns,
  copies,
  type ConversationSession,
  type ConversationTurn,
} from "@/src/infrastructure/database/schema";
import { eq } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { IntentExtractionService } from "./intent-extraction-service";
import {
  ProductionAdReferenceService,
  type AdReference,
} from "./production-ad-reference-service";

// 대화 메시지 형식
export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

// 대화 시작 옵션
export interface StartConversationOptions {
  userId: number;
  initialMessage: string;
  context?: ConversationContext;
}

// 대화 계속 옵션
export interface ContinueConversationOptions {
  sessionId: number;
  userId: number;
  message: string;
}

// 대화 응답
export interface ConversationResponse {
  sessionId: number;
  message: string;
  suggestions?: string[]; // 다음에 할 수 있는 질문/요청 제안
  copies?: string[];      // 생성된 카피들 (있는 경우)
  conversationHistory: ConversationMessage[];
}

export interface ConversationContext {
  targetAudience?: string;
  productName?: string;
  tone?: string;
  platform?: string;
  targetCharCount?: number;
  selectedCopy?: string;
  improvementRequest?: boolean;
  useAdReferences?: boolean;
  adReferenceSection?: string;
  adReferenceMetadata?: Array<{
    platform: string;
    headline?: string | null;
    description?: string | null;
    url?: string | null;
  }>;
}

export class ConversationalCopyService {
  private readonly claudeProvider: ClaudeSonnet45Provider;
  private readonly anthropic: Anthropic;
  private readonly intentExtractor: IntentExtractionService;
  private readonly adReferenceService: ProductionAdReferenceService;

  constructor() {
    this.claudeProvider = new ClaudeSonnet45Provider();
    this.intentExtractor = new IntentExtractionService();
    this.adReferenceService = new ProductionAdReferenceService();
    
    // Anthropic SDK 직접 사용 (대화형 API를 위해)
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.");
    }
    
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  /**
   * 새로운 대화 세션 시작
   */
  async startConversation(
    options: StartConversationOptions
  ): Promise<ConversationResponse> {
    const { userId, initialMessage, context } = options;

    console.log('\n🎭 대화형 카피 생성 시작');
    console.log(`  - 사용자: ${userId}`);
    console.log(`  - 초기 메시지: ${initialMessage.substring(0, 50)}...`);

    const sessionContext = await this.prepareSessionContext(
      initialMessage,
      context
    );
    
    // 세션 생성
    const [session] = await db
      .insert(conversationSessions)
      .values({
        userId,
        preferredModel: "claude-sonnet-4-5",
        status: "draft",
        context: sessionContext,
      })
      .returning({ id: conversationSessions.id });

    const sessionId = session.id;
    console.log(`  - 세션 ID: ${sessionId}`);

    // 사용자 메시지 저장
    await this.saveTurn(sessionId, "user", initialMessage);

    // 시스템 프롬프트 구성
    const systemPrompt = this.buildSystemPrompt(sessionContext);

    // Claude와 대화
    const response = await this.anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      temperature: 0.8,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: initialMessage,
        },
      ],
    });

    const assistantMessage = this.extractTextFromResponse(response);
    
    // 어시스턴트 응답 저장
    await this.saveTurn(sessionId, "assistant", assistantMessage);

    // 카피 추출 (있는 경우)
    const copies = this.extractCopiesFromMessage(assistantMessage);

    // 카피가 생성되었으면 copies 테이블에 저장 (실시간 업데이트용)
    if (copies.length > 0) {
      await this.saveCopies(userId, sessionId, initialMessage, copies, 0.01);
      console.log(`  - 데이터베이스 저장: ${copies.length}개`);
    }

    // 제안 생성
    const suggestions = this.generateSuggestions(assistantMessage, copies.length > 0);

    // 대화 히스토리
    const conversationHistory: ConversationMessage[] = [
      { role: "user", content: initialMessage, timestamp: new Date() },
      { role: "assistant", content: assistantMessage, timestamp: new Date() },
    ];

    console.log(`  - 응답 길이: ${assistantMessage.length}자`);
    console.log(`  - 추출된 카피: ${copies.length}개`);
    console.log('✅ 대화 시작 완료\n');

    return {
      sessionId,
      message: assistantMessage,
      suggestions,
      copies: copies.length > 0 ? copies : undefined,
      conversationHistory,
    };
  }

  /**
   * 기존 대화 계속하기
   */
  async continueConversation(
    options: ContinueConversationOptions
  ): Promise<ConversationResponse> {
    const { sessionId, userId, message } = options;

    console.log('\n💬 대화 계속하기');
    console.log(`  - 세션 ID: ${sessionId}`);
    console.log(`  - 메시지: ${message.substring(0, 50)}...`);

    // 세션 권한 확인
    await this.ensureSessionOwnership(sessionId, userId);

    // 기존 대화 히스토리 로드
    const history = await this.loadConversationHistory(sessionId);
    let context = await this.getSessionContext(sessionId);

    // 개선 요청 시 광고 레퍼런스 재수집 하지 않음 (이미 있는 것 사용)
    console.log(`  - 기존 광고 레퍼런스: ${context.adReferenceSection ? '있음 (재사용)' : '없음'}`);
    
    // 첫 대화일 때만 광고 레퍼런스 수집
    if ((context.useAdReferences ?? true) && !context.adReferenceSection) {
      console.log(`  - 광고 레퍼런스 수집 시작...`);
      context = await this.prepareSessionContext(message, context);
      await db
        .update(conversationSessions)
        .set({ context })
        .where(eq(conversationSessions.id, sessionId));
      console.log(`  - 광고 레퍼런스 수집 완료`);
    }

    // 사용자 메시지 저장
    await this.saveTurn(sessionId, "user", message);

    // 대화 히스토리를 Claude API 형식으로 변환
    const messages = this.convertHistoryToMessages(history);
    messages.push({
      role: "user",
      content: message,
    });

    // 시스템 프롬프트
    const systemPrompt = this.buildSystemPrompt(context);

    // Claude와 대화
    const response = await this.anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      temperature: 0.8,
      system: systemPrompt,
      messages: messages as Anthropic.Messages.MessageParam[],
    });

    const assistantMessage = this.extractTextFromResponse(response);

    // 어시스턴트 응답 저장
    await this.saveTurn(sessionId, "assistant", assistantMessage);

    // 카피 추출
    const copies = this.extractCopiesFromMessage(assistantMessage);

    // 카피가 생성되었으면 copies 테이블에 저장 (실시간 업데이트용)
    if (copies.length > 0) {
      await this.saveCopies(userId, sessionId, message, copies, 0.01);
      console.log(`  - 데이터베이스 저장: ${copies.length}개`);
    }

    // 제안 생성
    const suggestions = this.generateSuggestions(assistantMessage, copies.length > 0);

    // 전체 대화 히스토리 반환
    const fullHistory = await this.loadConversationHistory(sessionId);
    const conversationHistory = fullHistory.map(turn => ({
      role: turn.role as "user" | "assistant",
      content: turn.message,
      timestamp: turn.createdAt,
    }));

    console.log(`  - 응답 길이: ${assistantMessage.length}자`);
    console.log(`  - 추출된 카피: ${copies.length}개`);
    console.log('✅ 대화 계속 완료\n');

    return {
      sessionId,
      message: assistantMessage,
      suggestions,
      copies: copies.length > 0 ? copies : undefined,
      conversationHistory,
    };
  }

  /**
   * 대화 히스토리 조회
   */
  async getConversationHistory(
    sessionId: number,
    userId: number
  ): Promise<ConversationMessage[]> {
    await this.ensureSessionOwnership(sessionId, userId);
    
    const history = await this.loadConversationHistory(sessionId);
    
    return history.map(turn => ({
      role: turn.role as "user" | "assistant",
      content: turn.message,
      timestamp: turn.createdAt,
    }));
  }

  /**
   * 시스템 프롬프트 구성
   */
  private buildSystemPrompt(context?: ConversationContext): string {
    const basePrompt = `당신은 세계 최고 수준의 광고 카피라이터입니다. 20년 이상의 경험을 가지고 있으며, 감성적이고 창의적인 광고 문구를 만드는 데 특화되어 있습니다.

**역할:**
- 사용자와 자연스러운 대화를 통해 광고 카피를 생성하고 개선합니다
- 사용자의 의도를 정확히 파악하고, 필요한 정보를 부드럽게 물어봅니다
- 여러 버전의 카피를 제시하고, 사용자 피드백을 바탕으로 계속 개선합니다

**대화 스타일:**
- 친근하고 전문적인 톤
- 이모지/이모티콘 절대 사용 금지
- 명확하고 구체적인 설명
- 사용자의 의견을 존중하고 반영

**카피 생성 시:**
1. 카피를 생성할 준비가 되면, 다음 형식으로 제시하세요:

---카피---
1. [카피 내용]
2. [카피 내용]
3. [카피 내용]
---------

2. 각 카피에 대한 간단한 설명이나 의도를 함께 제공하세요
3. 사용자가 수정을 요청하면, 구체적인 피드백을 바탕으로 개선하세요

**중요:**
- 사용자가 원하는 것을 정확히 파악하기 전까지는 무리하게 카피를 생성하지 마세요
- 필요한 정보 (제품명, 타겟 고객, 톤, 주요 메시지 등)를 자연스럽게 수집하세요
- 대화를 통해 점진적으로 최적의 카피를 만들어가세요`;

    if (context) {
      let contextInfo = '\n\n**현재 컨텍스트:**';
      
      // 선택된 카피가 있는 경우 (가장 중요!)
      if (context.selectedCopy) {
        contextInfo += `\n\n**사용자가 선택한 기존 카피:**\n"${context.selectedCopy}"\n`;
        contextInfo += `\n사용자는 이 카피를 개선하거나 변형하고 싶어합니다.`;
        contextInfo += `\n기존 카피의 좋은 점은 유지하면서, 사용자의 요청에 맞게 개선하세요.`;
      }
      
      // 개선 요청 모드
      if (context.improvementRequest) {
        contextInfo += `\n\n**중요:** 카피 개선 모드입니다. 기존 카피를 참고하여 더 나은 버전을 만들어주세요.`;
      }
      
      // 기타 컨텍스트 정보
      if (context.productName) contextInfo += `\n- 제품: ${context.productName}`;
      if (context.targetAudience) contextInfo += `\n- 타겟: ${context.targetAudience}`;
      if (context.tone) contextInfo += `\n- 톤: ${context.tone}`;
      if (context.platform) contextInfo += `\n- 집중 플랫폼: ${context.platform}`;
      if (typeof context.targetCharCount === "number") {
        contextInfo += `\n- 목표 글자수: 약 ${context.targetCharCount}자`;
      }
      if (context.improvementRequest) {
        contextInfo += `\n- 모드: 기존 카피 개선`;
      }
      if (context.useAdReferences === false) {
        contextInfo += `\n- 실제 광고 레퍼런스를 사용하지 말고 사용자 정보만 활용하세요.`;
      }
      if (context.adReferenceSection) {
        contextInfo += `\n\n${context.adReferenceSection}`;
        contextInfo += `\n\n위 실제 광고 레퍼런스를 참고하여 최신 표현과 기조를 반영하세요.`;
      }
      
      return basePrompt + contextInfo;
    }

    return basePrompt;
  }

  private async prepareSessionContext(
    initialMessage: string,
    baseContext?: ConversationContext
  ): Promise<ConversationContext> {
    // 개선하기 요청인 경우 광고 레퍼런스 수집 스킵 (이미 1차에서 수집했음)
    const isImprovement = baseContext?.improvementRequest === true;
    
    const context: ConversationContext = {
      ...baseContext,
      useAdReferences: isImprovement ? false : (baseContext?.useAdReferences ?? true),
    };

    // 광고 레퍼런스 수집 스킵 조건:
    // 1. useAdReferences가 false인 경우
    // 2. 이미 adReferenceSection이 있는 경우
    // 3. 개선하기 요청인 경우 (improvementRequest = true)
    if (context.useAdReferences === false || context.adReferenceSection || isImprovement) {
      if (isImprovement) {
        console.log("  ⚡ 개선하기 모드: 광고 레퍼런스 수집 스킵 (1차에서 이미 수집)");
      }
      return context;
    }

    try {
      const intentSource = [
        initialMessage,
        context.productName,
        context.targetAudience,
        context.selectedCopy,
      ]
        .filter(Boolean)
        .join("\n\n");

      const intent = await this.intentExtractor.extract(
        intentSource || initialMessage
      );

      if (context.productName) intent.productName = context.productName;
      if (context.targetAudience) intent.targetAudience = context.targetAudience;
      if (context.tone) intent.tone = context.tone;
      if (context.platform) intent.channel = context.platform;

      const adReferences = await this.adReferenceService.findSimilarAds(intent, {
        limit: 30, // 더 많이 수집 (프롬프트엔 5개만 사용, DB엔 모두 저장)
        freshnessDays: 90,
      });

      if (adReferences.length > 0) {
        context.adReferenceSection = this.buildAdReferenceSection(adReferences);
        context.adReferenceMetadata = adReferences.slice(0, 5).map((ref) => ({
          platform: ref.platform,
          headline: ref.headline,
          description: ref.description,
          url: ref.url,
        }));
      }
    } catch (error) {
      console.warn("대화형 광고 레퍼런스 준비 실패:", error);
    }

    return context;
  }

  private buildAdReferenceSection(adReferences: AdReference[]): string {
    const lines: string[] = [
      "실제 집행 중인 광고 레퍼런스 (Google/Naver/Perplexity)",
      "이 섹션은 최신 표현, 톤, 길이를 파악하기 위한 참고용입니다.",
    ];

    adReferences.slice(0, 5).forEach((ref, index) => {
      const headline = ref.headline || ref.adCopy.slice(0, 60);
      const description = ref.description || ref.adCopy.slice(0, 140);
      lines.push(
        `\n예시 ${index + 1} [실제 ${ref.platform} 광고]`,
        `- 제목: ${headline}`,
        `- 본문: ${description}`,
        ref.url ? `- URL: ${ref.url}` : ""
      );
    });

    return lines.join("\n").trim();
  }

  /**
   * Claude 응답에서 텍스트 추출
   */
  private extractTextFromResponse(response: any): string {
    if (response.content && Array.isArray(response.content)) {
      const textContent = response.content.find((block: any) => block.type === "text");
      return textContent?.text || "";
    }
    return "";
  }

  /**
   * 메시지에서 카피 추출
   */
  private extractCopiesFromMessage(message: string): string[] {
    const copies: string[] = [];
    
    // "---카피---" 형식 찾기
    const copyBlockMatch = message.match(/---카피---\s*([\s\S]*?)\s*---------/);
    if (copyBlockMatch) {
      const copyBlock = copyBlockMatch[1];
      const lines = copyBlock.split('\n').filter(l => l.trim());
      
      for (const line of lines) {
        // 숫자. 형식 제거
        const cleaned = line.replace(/^\d+\.\s*/, '').trim();
        if (cleaned.length > 0) {
          copies.push(cleaned);
        }
      }
    }

    return copies;
  }

  /**
   * 다음 행동 제안 생성
   */
  private generateSuggestions(message: string, hasCopies: boolean): string[] {
    if (hasCopies) {
      // 카피가 생성된 경우
      return [
        "특정 카피를 수정하고 싶어요",
        "더 감성적으로 만들어주세요",
        "다른 스타일로 다시 생성해주세요",
        "글자수를 조정해주세요",
        "이 카피가 마음에 들어요",
      ];
    } else {
      // 아직 정보 수집 중
      return [
        "제품에 대해 더 알려드릴게요",
        "타겟 고객을 설명할게요",
        "원하는 톤을 말씀드릴게요",
        "바로 카피를 만들어주세요",
      ];
    }
  }

  /**
   * 대화 턴 저장
   */
  private async saveTurn(
    sessionId: number,
    role: "user" | "assistant",
    message: string
  ): Promise<void> {
    await db.insert(conversationTurns).values({
      sessionId,
      role,
      message,
      metadata: {},
    });
  }

  /**
   * 세션 권한 확인
   */
  private async ensureSessionOwnership(
    sessionId: number,
    userId: number
  ): Promise<void> {
    const [session] = await db
      .select({ userId: conversationSessions.userId })
      .from(conversationSessions)
      .where(eq(conversationSessions.id, sessionId))
      .limit(1);

    if (!session || session.userId !== userId) {
      throw new Error("세션을 찾을 수 없거나 권한이 없습니다.");
    }
  }

  /**
   * 대화 히스토리 로드
   */
  private async loadConversationHistory(sessionId: number): Promise<ConversationTurn[]> {
    return db
      .select()
      .from(conversationTurns)
      .where(eq(conversationTurns.sessionId, sessionId))
      .orderBy(conversationTurns.createdAt);
  }

  /**
   * 세션 컨텍스트 조회
   */
  private async getSessionContext(
    sessionId: number
  ): Promise<ConversationContext> {
    const [session] = await db
      .select({ context: conversationSessions.context })
      .from(conversationSessions)
      .where(eq(conversationSessions.id, sessionId))
      .limit(1);

    const storedContext = (session?.context as ConversationContext) || {};
    return {
      ...storedContext,
      useAdReferences: storedContext.useAdReferences ?? true,
    };
  }

  /**
   * 대화 히스토리를 Claude API 메시지 형식으로 변환
   */
  private convertHistoryToMessages(
    history: ConversationTurn[]
  ): Array<{ role: "user" | "assistant"; content: string }> {
    return history
      .filter(turn => turn.role === "user" || turn.role === "assistant")
      .map(turn => ({
        role: turn.role as "user" | "assistant",
        content: turn.message,
      }));
  }

  /**
   * 생성된 카피를 copies 테이블에 저장 (실시간 업데이트용)
   */
  private async saveCopies(
    userId: number,
    sessionId: number,
    prompt: string,
    copiesArray: string[],
    estimatedCost: number
  ): Promise<void> {
    try {
      await Promise.all(
        copiesArray.map(async (copyContent) => {
          await db.insert(copies).values({
            userId,
            templateId: null,
            prompt,
            generatedContent: copyContent,
            charCount: copyContent.length,
            minChars: 15,
            maxChars: 100,
            tone: "conversational",
            language: "ko-KR",
            modelUsed: "claude-sonnet-4-5",
            status: "success",
            generationTimeMs: 0,
            apiCost: estimatedCost.toString(),
            metadata: {
              sessionId,
              mode: "conversational",
              source: "chat",
            },
          });
        })
      );
    } catch (error) {
      console.warn("대화형 카피 저장 실패:", error);
    }
  }
}

