import type {
  GenerationRequest,
  GenerationResult,
  LLMProvider,
  TokenUsage,
} from "./types";

const GEMINI_FLASH_API_URL =
  process.env.GEMINI_API_URL ??
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

/**
 * Gemini 2.5 Flash Provider
 * 빠른 응답, 저렴한 비용 - 의도 추출 및 간단한 분석에 최적
 */
export class Gemini25FlashProvider implements LLMProvider {
  readonly modelName = "gemini-2.5-flash" as const;
  readonly isConfigured: boolean;
  private apiKeys: string[] = [];
  private currentKeyIndex = 0;

  constructor() {
    this.apiKeys = this.collectApiKeys();
    this.isConfigured = this.apiKeys.length > 0;
    console.log(`[Gemini Flash] API Keys loaded: ${this.apiKeys.length}, Configured: ${this.isConfigured}`);
  }

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
    
    console.log(`[Gemini Flash] ${keys.length}개의 API 키 로드됨`);
    return keys;
  }

  private getCurrentApiKey(): string {
    if (this.apiKeys.length === 0) {
      throw new Error("사용 가능한 GEMINI_API_KEY가 없습니다.");
    }
    return this.apiKeys[this.currentKeyIndex];
  }

  private rotateToNextKey(): void {
    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
    console.log(`Gemini Flash API 키 전환: ${this.currentKeyIndex + 1}/${this.apiKeys.length}`);
  }

  async generateCopies(request: GenerationRequest): Promise<GenerationResult> {
    if (!this.isConfigured) {
      throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");
    }

    const maxAttempts = this.apiKeys.length;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const currentKey = this.getCurrentApiKey();
      console.log(`[Gemini Flash] Attempt ${attempt + 1}/${maxAttempts} with key index ${this.currentKeyIndex}`);
      
      try {
        const response = await fetch(`${GEMINI_FLASH_API_URL}?key=${currentKey}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: this.buildPrompt(request) }],
              },
            ],
            generationConfig: {
              temperature: 0.7,
              topP: 0.9,
              maxOutputTokens: 4000,  // Intent Extraction과 긴 응답을 위해 대폭 증가
              candidateCount: 1,
              stopSequences: [],
              responseMimeType: "application/json",  // JSON 응답 형식 지정
              responseSchema: {  // JSON 스키마 정의
                type: "object",
                properties: {
                  copies: {
                    type: "array",
                    items: {
                      type: "string"
                    }
                  }
                },
                required: ["copies"]
              }
            },
            safetySettings: [
              {
                category: "HARM_CATEGORY_HARASSMENT",
                threshold: "BLOCK_NONE"
              },
              {
                category: "HARM_CATEGORY_HATE_SPEECH",
                threshold: "BLOCK_NONE"
              },
              {
                category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                threshold: "BLOCK_NONE"
              },
              {
                category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                threshold: "BLOCK_NONE"
              }
            ]
          }),
        });

        if (!response.ok) {
          const err = await response.text();
          console.error(`[Gemini Flash] API Error Response:`, {
            status: response.status,
            statusText: response.statusText,
            error: err,
            url: GEMINI_FLASH_API_URL,
            keyIndex: this.currentKeyIndex
          });
          
          if (
            err.includes("RESOURCE_EXHAUSTED") || 
            err.includes("quota") || 
            err.includes("rate limit") ||
            response.status === 429
          ) {
            console.warn(`Gemini Flash API 키 ${this.currentKeyIndex + 1} 할당량 초과, 다음 키로 전환...`);
            this.rotateToNextKey();
            lastError = new Error(`할당량 초과: ${err}`);
            continue;
          }
          
          throw new Error(`Gemini 2.5 Flash 호출 실패 (${response.status}): ${err}`);
        }

        const data = (await response.json()) as GeminiResponse;
        
        // 응답 구조 확인
        if (!data.candidates || data.candidates.length === 0) {
          console.error(`[Gemini 2.5 Flash] 응답에 candidates 없음:`, JSON.stringify(data).substring(0, 500));
          
          // 안전 필터에 의해 차단되었는지 확인
          if (data.promptFeedback) {
            console.error(`[Gemini 2.5 Flash] 프롬프트 피드백:`, data.promptFeedback);
          }
          
          return {
            copies: [],
            tokenUsage: this.extractUsage(data.usageMetadata),
          };
        }
        
        // 텍스트 추출 (responseSchema 사용 시 이미 파싱된 JSON)
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        
        console.log(`[Gemini 2.5 Flash] 원본 응답:`, text.substring(0, 500));
        
        // responseSchema를 사용하면 text가 이미 JSON 문자열
        let parsed: { copies: string[] };
        
        try {
          // 이미 JSON 문자열이므로 직접 파싱
          if (typeof text === 'string' && text.trim().startsWith('{')) {
            parsed = JSON.parse(text);
          } else {
            // 폴백: safeParse 사용
            parsed = this.safeParse(text);
          }
        } catch (e) {
          console.warn(`[Gemini 2.5 Flash] JSON 파싱 실패:`, e);
          parsed = this.safeParse(text);
        }
        
        if (!parsed.copies || parsed.copies.length === 0) {
          console.warn(`[Gemini 2.5 Flash] ⚠️ 빈 응답 - 원본:`, text);
          return {
            copies: [],
            tokenUsage: this.extractUsage(data.usageMetadata),
          };
        } else {
          console.log(`[Gemini 2.5 Flash] ✅ 파싱 성공: ${parsed.copies.length}개`);
        }

        return {
          copies: parsed.copies,
          tokenUsage: this.extractUsage(data.usageMetadata),
        };
      } catch (error) {
        if (error instanceof Error && !error.message.includes("할당량")) {
          throw error;
        }
        lastError = error as Error;
        if (attempt < maxAttempts - 1) {
          this.rotateToNextKey();
        }
      }
    }

    throw new Error(
      `모든 Gemini Flash API 키(${this.apiKeys.length}개)의 할당량이 소진되었습니다. ${lastError?.message ?? ""}`
    );
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
    // Gemini 2.5 Flash 가격 (2025년 기준 예상)
    const inputCost = (tokenUsage.promptTokens * 0.0001) / 1000;
    const outputCost = (tokenUsage.completionTokens * 0.0002) / 1000;
    return Number((inputCost + outputCost).toFixed(6));
  }

  private buildPrompt(request: GenerationRequest): string {
    const { prompt, minChars, maxChars, count, tone } = request;

    // Gemini Flash에 최적화된 직관적 프롬프트
    // 직접적/긴급성 스타일에 특화
    const isDirect = prompt.includes('직접') || prompt.includes('즉시') || 
                    prompt.includes('긴급') || prompt.includes('할인');
    const isUrgent = prompt.includes('오늘') || prompt.includes('한정') || 
                    prompt.includes('마감') || prompt.includes('특가');

    const styleGuide = isDirect || isUrgent ? `
**스타일 가이드 (직접적/긴급성):**
- 간결하고 핵심만 전달
- 강력한 행동 유도 동사 사용 ("지금 클릭", "오늘만 특가")
- 시간 제한과 희소성 강조
- 첫 3초 안에 주목도 확보` : `
**스타일 가이드:**
- 명확하고 직접적인 메시지
- 즉시 이해 가능한 표현
- 행동 중심의 카피
- 간결하고 힘 있는 문장`;

    return `빠르고 효과적인 한국어 광고 카피를 생성하세요.

**작업 지시:**
${prompt}

**요구사항:**
- 개수: 정확히 ${count}개
- 글자 수: ${minChars}-${maxChars}자
- 톤: ${tone || '직접적이고 명확한'}
${styleGuide}

**핵심 규칙:**
1. 각 카피는 다른 접근법 사용
2. 즉시 행동을 유도하는 메시지
3. 복잡한 설명 없이 핵심만
4. 강력하고 기억에 남는 표현

지금 ${count}개의 카피를 생성하세요:`;
  }

  private safeParse(payload: string): { copies: string[] } {
    try {
      // 빈 응답 체크
      if (!payload || payload.trim() === '') {
        console.warn("[Gemini 2.5 Flash] 빈 응답 받음");
        return { copies: [] };
      }
      
      // 마크다운 코드블록 제거 (```json ... ```)
      let cleanedPayload = payload
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim();
      
      // JSON 객체 추출 시도
      const jsonMatch = cleanedPayload.match(/\{[\s\S]*"copies"[\s\S]*\}/);
      if (jsonMatch) {
        cleanedPayload = jsonMatch[0];
      }
      
      const parsed = JSON.parse(cleanedPayload) as { copies?: unknown };
      if (!Array.isArray(parsed.copies)) {
        console.warn(`[Gemini 2.5 Flash] copies 필드가 배열이 아님:`, parsed);
        return { copies: [] };
      }
      
      // 유효한 카피만 필터링
      const validCopies = parsed.copies
        .filter(c => c && typeof c === 'string' && c.trim().length > 0)
        .map(c => String(c).trim());
      
      if (validCopies.length < parsed.copies.length) {
        console.warn(`[Gemini 2.5 Flash] 일부 카피가 필터링됨: ${parsed.copies.length} -> ${validCopies.length}`);
      }
      
      if (validCopies.length > 0) {
        console.log(`[Gemini 2.5 Flash] ✅ 파싱 성공: ${validCopies.length}개`);
      }
      
      return { copies: validCopies };
    } catch (error) {
      console.error("[Gemini 2.5 Flash] JSON 파싱 오류:", error);
      console.error("원본 payload:", payload.substring(0, 500));
      return { copies: [] };
    }
  }

  private extractUsage(usage: GeminiUsage | undefined): TokenUsage {
    return {
      promptTokens: usage?.promptTokenCount ?? 0,
      completionTokens: usage?.candidatesTokenCount ?? 0,
      totalTokens:
        (usage?.promptTokenCount ?? 0) + (usage?.candidatesTokenCount ?? 0),
    };
  }
}

type GeminiUsage = {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
      text?: string;
    };
    text?: string;
  }>;
  usageMetadata?: GeminiUsage;
  promptFeedback?: {
    blockReason?: string;
    safetyRatings?: Array<{
      category: string;
      probability: string;
    }>;
  };
};

