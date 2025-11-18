// Claude Sonnet 4.5 Provider 구현 (2025년 11월 최신)
import Anthropic from "@anthropic-ai/sdk";
import type {
  GenerationRequest,
  GenerationResult,
  LLMProvider,
  TokenUsage,
} from "./types";

export class ClaudeSonnet45Provider implements LLMProvider {
  readonly modelName = "claude-sonnet-4-5" as const;
  readonly isConfigured: boolean;
  private client: Anthropic | null = null;

  constructor() {
    this.isConfigured = Boolean(process.env.ANTHROPIC_API_KEY);
    if (this.isConfigured) {
      this.client = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
    }
  }

  async generateCopies(request: GenerationRequest): Promise<GenerationResult> {
    if (!this.client) {
      throw new Error("Anthropic API 클라이언트가 초기화되지 않았습니다.");
    }

    const body = {
      model: "claude-sonnet-4-5", // Claude Sonnet 4.5 공식 alias
      max_tokens: 1024,
      temperature: 0.75,
      messages: [
        {
          role: "user" as const,
          content: this.buildPrompt(request),
        },
      ],
    };

    const response = await this.client.messages.create(body);
    const first = response.content[0];
    const text = first?.type === "text" ? first.text : "[]";
    return {
      copies: this.parseResponse(text),
      tokenUsage: this.extractUsage(response.usage),
    };
  }

  async generateSingleCopy(
    request: GenerationRequest,
    options?: { maxRetries?: number }
  ): Promise<string | null> {
    const retries = options?.maxRetries ?? 1;
    for (let i = 0; i < retries; i++) {
      const { copies } = await this.generateCopies({
        ...request,
        count: 1,
      });
      if (copies?.[0]) {
        return copies[0];
      }
    }
    return null;
  }

  calculateCost(tokenUsage: TokenUsage): number {
    const inputCost = (tokenUsage.promptTokens * 0.003) / 1000;
    const outputCost = (tokenUsage.completionTokens * 0.015) / 1000;
    return Number((inputCost + outputCost).toFixed(6));
  }

  private buildPrompt(request: GenerationRequest): string {
    // 모델별 프롬프트 커스터마이징 시도
    try {
      const { customizePromptForModel } = require("./model-specific-prompts");
      
      return customizePromptForModel({
        basePrompt: request.prompt,
        model: this.modelName,
        tone: request.tone,
        count: request.count
      });
    } catch (error) {
      // 폴백: 기존 프롬프트 사용
    const { prompt, minChars, maxChars, tone, count, creativeGuidelines } =
      request;

    const guidelines = creativeGuidelines
      ?.map((g) => `- ${g.title}: ${g.description}`)
      .join("\n");

    return `당신은 창의적인 광고 카피라이터입니다.

사용자 입력:
${prompt}

요구사항:
- 글자수: ${minChars}~${maxChars}자 범위 준수
- 톤: ${tone ?? "neutral"}
- 정확히 ${count ?? 1}개 생성
- 출력 형식: JSON 배열만 반환 ["카피1", "카피2", "카피3"]

${guidelines ? `\n추가 지침:\n${guidelines}\n` : ''}

중요:
- JSON 배열 형식 외에 다른 텍스트 절대 금지
- 각 카피는 ${minChars}-${maxChars}자 범위 내
- ${count}개 모두 생성
- 실제 광고 카피만 작성 (설명 금지)`;
    }
  }

  private parseResponse(text: string): string[] {
    try {
      // JSON 배열 추출 시도
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) {
        console.warn("[Claude] JSON 배열 형식 없음, 텍스트에서 추출 시도");
        console.warn("[Claude] 원본 응답:", text.substring(0, 200));
        
        // JSON 객체 형식일 수도 있음
        const jsonObjectMatch = text.match(/\{[\s\S]*"copies"[\s\S]*\[[\s\S]*\][\s\S]*\}/);
        if (jsonObjectMatch) {
          const parsed = JSON.parse(jsonObjectMatch[0]);
          if (Array.isArray(parsed.copies)) {
            return parsed.copies.map((item: any) => String(item).trim()).filter(Boolean);
          }
        }
        
        // 완전히 실패하면 빈 배열 반환
        return [];
      }
      
      const parsed = JSON.parse(match[0]);
      if (!Array.isArray(parsed)) {
        console.warn("[Claude] 배열이 아닌 형식:", typeof parsed);
        return [];
      }
      
      return parsed
        .map((item) => String(item).trim())
        .filter((item) => item.length > 0);
        
    } catch (error) {
      console.error("[Claude] JSON 파싱 실패:", error);
      console.error("[Claude] 원본 텍스트:", text.substring(0, 500));
      
      // 완전 실패 시 빈 배열 (오류 카피 반환 방지)
      return [];
    }
  }

  private extractUsage(usage: any): TokenUsage {
    return {
      promptTokens: usage?.input_tokens ?? 0,
      completionTokens: usage?.output_tokens ?? 0,
      totalTokens: (usage?.input_tokens ?? 0) + (usage?.output_tokens ?? 0),
    };
  }
}

