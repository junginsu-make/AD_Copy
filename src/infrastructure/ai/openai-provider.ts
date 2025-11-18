import type {
  GenerationRequest,
  GenerationResult,
  LLMProvider,
  TokenUsage,
} from "./types";

const OPENAI_API_URL =
  process.env.OPENAI_API_URL ?? "https://api.openai.com/v1/chat/completions";

// GPT-5 Provider (2025년 11월)
export class OpenAIGPT5Provider implements LLMProvider {
  readonly modelName = "gpt-5" as const;
  readonly isConfigured: boolean;

  constructor() {
    this.isConfigured = Boolean(process.env.OPENAI_API_KEY);
  }

  async generateCopies(request: GenerationRequest): Promise<GenerationResult> {
    if (!this.isConfigured) {
      throw new Error("OPENAI_API_KEY가 설정되지 않았습니다.");
    }

    const body = {
      model: "gpt-4o", // 안정적인 gpt-4o 사용 (GPT-5 폴백)
      temperature: 0.85,
      top_p: 0.9,
      max_completion_tokens: 4000, // 긴 응답과 상세한 분석을 위해 대폭 증가
      messages: [
        {
          role: "system",
          content:
            "You are an award-winning Korean copywriter specializing in high-converting ad headlines. Always respond in JSON format.",
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
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorPayload = await response.text();
      throw new Error(`OpenAI GPT-4o 호출 실패: ${errorPayload}`);
    }

    const data = (await response.json()) as OpenAIResponse;
    const text = data.choices?.[0]?.message?.content ?? "{\"copies\":[]}";
    const parsed = this.safeParse(text);

    return {
      copies: parsed.copies,
      tokenUsage: this.extractUsage(data.usage),
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

  private safeParse(payload: string): { copies: string[] } {
    try {
      // 마크다운 코드블록 제거
      let cleaned = payload.trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
      }
      
      const parsed = JSON.parse(cleaned) as { copies?: unknown };
      
      // copies가 배열인 경우
      if (Array.isArray(parsed.copies)) {
        return { copies: parsed.copies.map((c) => String(c).trim()).filter(Boolean) };
      }
      
      // copies가 없지만 JSON 객체인 경우 (Intent Extraction 등)
      // 전체 객체를 하나의 카피로 취급하지 않고, 다른 필드들을 확인
      if (typeof parsed === 'object' && parsed !== null) {
        // Intent Extraction용 JSON 객체인 경우 빈 배열 반환
        // (Intent Extraction은 별도 처리)
        if (!parsed.copies && Object.keys(parsed).length > 0) {
          // Intent Extraction용 JSON이므로 빈 배열 반환
          return { copies: [] };
        }
      }
      
      throw new Error("copies 필드가 배열이 아닙니다.");
    } catch (error) {
      console.error("GPT-5 응답 파싱 실패", error, payload.substring(0, 500));
      return { copies: [] };
    }
  }

  private extractUsage(usage: OpenAIUsage | undefined): TokenUsage {
    return {
      promptTokens: usage?.prompt_tokens ?? 0,
      completionTokens: usage?.completion_tokens ?? 0,
      totalTokens: usage?.total_tokens ?? 0,
    };
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
      const { prompt, minChars, maxChars, tone, count, creativeGuidelines } = request;

      const guidelineText = creativeGuidelines
        ?.map((g) => `- ${g.title}: ${g.description}`)
        .join("\n");

      return `다음 요구사항에 따라 한국어 광고 소제목을 작성해 주세요.

요구사항:
- 글자수: ${minChars}자 이상 ${maxChars}자 이하
- 톤: ${tone ?? "neutral"}
- 후보 개수: ${count ?? 1}
- 결과는 JSON 객체 {"copies": ["카피1", ...]} 로만 반환하세요. 추가 문장은 금지입니다.

추가 지침:
${guidelineText ?? "- 특별한 지침 없음"}

사용자 요청:
${prompt}`;
    }
  }

  private get schema() {
    return {
      name: "copy_response",
      schema: {
        type: "object",
        properties: {
          copies: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["copies"],
        additionalProperties: false,
      },
      strict: true,
    };
  }
}

type OpenAIUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

type OpenAIResponse = {
  choices?: Array<{
    message?: { content?: string };
  }>;
  usage?: OpenAIUsage;
};

