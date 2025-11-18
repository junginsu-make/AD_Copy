import type { TokenUsage } from "./types";

// Gemini Vision API URL (2.5 Pro로 업그레이드)
const GEMINI_VISION_API_URL =
  process.env.GEMINI_VISION_API_URL ??
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent";

// 이미지 분석 요청 인터페이스
export interface ImageAnalysisRequest {
  imageBase64: string; // Base64로 인코딩된 이미지
  mimeType: string; // 이미지 MIME 타입 (예: image/jpeg, image/png)
  prompt?: string; // 추가 프롬프트 (선택 사항)
}

// 이미지 분석 결과 인터페이스
export interface ImageAnalysisResult {
  description: string; // 이미지에 대한 상세 설명
  suggestedKeywords: string[]; // 추출된 키워드
  visualElements: string[]; // 시각적 요소 (색상, 분위기 등)
  productInfo?: {
    category?: string; // 제품 카테고리
    features?: string[]; // 제품 특징
    targetAudience?: string; // 예상 타겟 고객
  };
  tokenUsage: TokenUsage;
}

export class GeminiVisionProvider {
  readonly isConfigured: boolean;
  private apiKeys: string[] = [];
  private currentKeyIndex = 0;

  constructor() {
    // 환경변수에서 모든 GEMINI_API_KEY_N 수집
    this.apiKeys = this.collectApiKeys();
    this.isConfigured = this.apiKeys.length > 0;
  }

  // API 키 수집
  private collectApiKeys(): string[] {
    const keys: string[] = [];
    
    // GEMINI_API_KEY_1 ~ GEMINI_API_KEY_10 확인
    for (let i = 1; i <= 10; i++) {
      const key = process.env[`GEMINI_API_KEY_${i}`];
      if (key && key.trim()) {
        keys.push(key.trim());
      }
    }
    
    // GEMINI_API_KEY도 확인
    const singleKey = process.env.GEMINI_API_KEY;
    if (singleKey && singleKey.trim() && !keys.includes(singleKey.trim())) {
      keys.push(singleKey.trim());
    }
    
    return keys;
  }

  // 현재 API 키 가져오기
  private getCurrentApiKey(): string {
    if (this.apiKeys.length === 0) {
      throw new Error("사용 가능한 GEMINI_API_KEY가 없습니다.");
    }
    return this.apiKeys[this.currentKeyIndex];
  }

  // 다음 API 키로 로테이션
  private rotateToNextKey(): void {
    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
    console.log(`Gemini Vision API 키 전환: ${this.currentKeyIndex + 1}/${this.apiKeys.length}`);
  }

  // 이미지 분석 메인 메서드
  async analyzeImage(request: ImageAnalysisRequest): Promise<ImageAnalysisResult> {
    if (!this.isConfigured) {
      throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");
    }

    // 모든 키를 시도 (로테이션)
    const maxAttempts = this.apiKeys.length;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const currentKey = this.getCurrentApiKey();
      
      try {
        const response = await fetch(`${GEMINI_VISION_API_URL}?key=${currentKey}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  {
                    inlineData: {
                      mimeType: request.mimeType,
                      data: request.imageBase64,
                    },
                  },
                  {
                    text: this.buildAnalysisPrompt(request.prompt),
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.4, // 이미지 분석은 더 정확성을 위해 낮은 temperature
              topP: 0.95,
              maxOutputTokens: 2048,
            },
          }),
        });

        if (!response.ok) {
          const err = await response.text();
          
          // 할당량 초과 또는 리소스 소진 오류 체크
          if (
            err.includes("RESOURCE_EXHAUSTED") || 
            err.includes("quota") || 
            err.includes("rate limit") ||
            response.status === 429
          ) {
            console.warn(`Gemini Vision API 키 ${this.currentKeyIndex + 1} 할당량 초과, 다음 키로 전환...`);
            this.rotateToNextKey();
            lastError = new Error(`할당량 초과: ${err}`);
            continue; // 다음 키 시도
          }
          
          // 다른 오류는 즉시 throw
          throw new Error(`Gemini Vision API 호출 실패: ${err}`);
        }

        const data = (await response.json()) as GeminiVisionResponse;
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
        const parsed = this.safeParse(text);

        return {
          description: parsed.description || "",
          suggestedKeywords: parsed.suggestedKeywords || [],
          visualElements: parsed.visualElements || [],
          productInfo: parsed.productInfo,
          tokenUsage: this.extractUsage(data.usageMetadata),
        };
      } catch (error) {
        // 할당량 오류가 아닌 경우 즉시 throw
        if (error instanceof Error && !error.message.includes("할당량")) {
          throw error;
        }
        lastError = error as Error;
        // 다음 키로 전환
        if (attempt < maxAttempts - 1) {
          this.rotateToNextKey();
        }
      }
    }

    // 모든 키를 시도했지만 실패
    throw new Error(
      `모든 Gemini Vision API 키(${this.apiKeys.length}개)의 할당량이 소진되었습니다. ${lastError?.message ?? ""}`
    );
  }

  // 이미지 분석 프롬프트 생성
  private buildAnalysisPrompt(additionalPrompt?: string): string {
    const basePrompt = `이 이미지를 상세히 분석하여 광고 카피 작성에 필요한 정보를 추출해주세요.

다음 정보를 JSON 형식으로 반환하세요:
{
  "description": "이미지에 대한 상세한 설명 (제품, 분위기, 구성 요소 등)",
  "suggestedKeywords": ["키워드1", "키워드2", "키워드3"],
  "visualElements": ["색상 분위기", "디자인 스타일", "감성적 요소"],
  "productInfo": {
    "category": "제품 카테고리 (추정)",
    "features": ["특징1", "특징2"],
    "targetAudience": "예상 타겟 고객층"
  }
}

주의사항:
- description은 구체적이고 상세하게 작성
- suggestedKeywords는 광고 카피에 활용 가능한 키워드
- visualElements는 이미지의 시각적 특징과 감성
- productInfo는 이미지에서 제품이 보이는 경우에만 포함
- 반드시 유효한 JSON 형식으로만 반환`;

    if (additionalPrompt) {
      return `${basePrompt}\n\n추가 요구사항: ${additionalPrompt}`;
    }

    return basePrompt;
  }

  // JSON 파싱 (안전하게)
  private safeParse(payload: string): Partial<ImageAnalysisResult> {
    try {
      // JSON 블록 추출 시도
      const jsonMatch = payload.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed;
      }
      
      // JSON이 아닌 경우 기본 구조 반환
      return {
        description: payload,
        suggestedKeywords: [],
        visualElements: [],
      };
    } catch (error) {
      console.error("Gemini Vision 응답 파싱 실패", error, payload);
      return {
        description: payload || "이미지 분석에 실패했습니다.",
        suggestedKeywords: [],
        visualElements: [],
      };
    }
  }

  // 토큰 사용량 추출
  private extractUsage(usage: GeminiUsage | undefined): TokenUsage {
    return {
      promptTokens: usage?.promptTokenCount ?? 0,
      completionTokens: usage?.candidatesTokenCount ?? 0,
      totalTokens:
        (usage?.promptTokenCount ?? 0) + (usage?.candidatesTokenCount ?? 0),
    };
  }

  // 비용 계산 (Gemini 2.5 Pro 가격 기준)
  calculateCost(tokenUsage: TokenUsage): number {
    // Gemini 2.5 Pro: $2.50/1M input tokens, $10.00/1M output tokens
    const inputCost = (tokenUsage.promptTokens * 2.5) / 1000000;
    const outputCost = (tokenUsage.completionTokens * 10.0) / 1000000;
    return Number((inputCost + outputCost).toFixed(6));
  }
}

// Gemini API 응답 타입 정의
type GeminiUsage = {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
};

type GeminiVisionResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  usageMetadata?: GeminiUsage;
};

