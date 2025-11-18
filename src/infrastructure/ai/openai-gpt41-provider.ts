import {
  GenerationRequest,
  GenerationResponse,
  LLMProvider,
  TokenUsage,
} from "./types";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

// GPT-4.1 Provider (안정적인 모델)
export class OpenAIGPT41Provider implements LLMProvider {
  readonly modelName = "gpt-4.1" as const;
  readonly isConfigured: boolean;
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY ?? "";
    this.isConfigured = !!this.apiKey;
  }

  async generateCopies(request: GenerationRequest): Promise<GenerationResponse> {
    if (!this.isConfigured) {
      throw new Error("OPENAI_API_KEY가 설정되지 않았습니다.");
    }

    const body = {
      model: "gpt-4.1", // 안정적인 GPT-4.1
      temperature: 0.85,
      top_p: 0.9,
      max_completion_tokens: 800,
      messages: [
        {
          role: "system",
          content:
            "You are an award-winning Korean copywriter specializing in high-converting ad headlines.",
        },
        {
          role: "user",
          content: this.buildPrompt(request),
        },
      ],
      response_format: { type: "json_object" },
    };

    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI GPT-4.1 호출 실패: ${errorText}`);
    }

    const data = await response.json();
    const payload = data.choices[0].message.content;

    try {
      const parsed = JSON.parse(payload);
      return {
        copies: parsed.copies || [],
        tokenUsage: {
          inputTokens: data.usage?.prompt_tokens || 0,
          outputTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        },
        modelUsed: this.modelName,
        generationTime: Date.now(),
      };
    } catch (error) {
      console.error("GPT-4.1 응답 파싱 실패", error, payload);
      return {
        copies: [],
        tokenUsage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
        },
        modelUsed: this.modelName,
        generationTime: Date.now(),
      };
    }
  }

  private buildPrompt(request: GenerationRequest): string {
    return `한국어 광고 카피를 생성해주세요.

요구사항:
- 최소 ${request.minChars}자, 최대 ${request.maxChars}자
- 톤: ${request.tone}
- 개수: ${request.count}개
- 창의적 가이드라인: ${request.creativeGuidelines?.map((g) => g.description).join(", ") || "없음"}

프롬프트: ${request.prompt}

다음 JSON 형식으로 응답해주세요:
{
  "copies": ["카피1", "카피2", ...]
}`;
  }

  calculateCost(tokenUsage: TokenUsage): number {
    // GPT-4.1 가격 (2025년 기준)
    const inputCost = (tokenUsage.inputTokens / 1_000_000) * 2.0; // $2/1M tokens
    const outputCost = (tokenUsage.outputTokens / 1_000_000) * 8.0; // $8/1M tokens
    return inputCost + outputCost;
  }
}
