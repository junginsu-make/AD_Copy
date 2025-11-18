import type {
  GenerationRequest,
  GenerationResult,
  LLMProvider,
  TokenUsage,
} from "./types";

const GEMINI_API_URL =
  process.env.GEMINI_API_URL ??
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent";

export class Gemini25ProProvider implements LLMProvider {
  readonly modelName = "gemini-2.5-pro" as const;
  readonly isConfigured: boolean;
  private apiKeys: string[] = [];
  private currentKeyIndex = 0;

  constructor() {
    // 환경변수에서 모든 GEMINI_API_KEY_N 수집
    this.apiKeys = this.collectApiKeys();
    this.isConfigured = this.apiKeys.length > 0;
    console.log(`[Gemini Pro] API Keys loaded: ${this.apiKeys.length}, Configured: ${this.isConfigured}`);
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
    
    console.log(`[Gemini Pro] ${keys.length}개의 API 키 로드됨`);
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
    console.log(`Gemini API 키 전환: ${this.currentKeyIndex + 1}/${this.apiKeys.length}`);
  }

  async generateCopies(request: GenerationRequest): Promise<GenerationResult> {
    if (!this.isConfigured) {
      throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");
    }

    // 모든 키를 시도 (로테이션)
    const maxAttempts = this.apiKeys.length;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const currentKey = this.getCurrentApiKey();
      console.log(`[Gemini Pro] Attempt ${attempt + 1}/${maxAttempts} with key index ${this.currentKeyIndex}`);
      
      try {
        const response = await fetch(`${GEMINI_API_URL}?key=${currentKey}`, {
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
              maxOutputTokens: 3000,  // JSON 잘림 방지를 위해 증가
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
          console.error(`[Gemini Pro] API Error Response:`, {
            status: response.status,
            statusText: response.statusText,
            error: err,
            url: GEMINI_API_URL,
            keyIndex: this.currentKeyIndex
          });
          
          // 할당량 초과 또는 리소스 소진 오류 체크
          if (
            err.includes("RESOURCE_EXHAUSTED") || 
            err.includes("quota") || 
            err.includes("rate limit") ||
            response.status === 429
          ) {
            console.warn(`Gemini API 키 ${this.currentKeyIndex + 1} 할당량 초과, 다음 키로 전환...`);
            this.rotateToNextKey();
            lastError = new Error(`할당량 초과: ${err}`);
            continue; // 다음 키 시도
          }
          
          // 다른 오류는 즉시 throw
          throw new Error(`Gemini 2.5 Pro 호출 실패 (${response.status}): ${err}`);
        }

        const data = (await response.json()) as GeminiResponse;
        
        // 응답 구조 확인
        if (!data.candidates || data.candidates.length === 0) {
          console.error(`[Gemini 2.5 Pro] 응답에 candidates 없음:`, JSON.stringify(data).substring(0, 500));
          
          // 안전 필터에 의해 차단되었는지 확인
          if (data.promptFeedback) {
            console.error(`[Gemini 2.5 Pro] 프롬프트 피드백:`, data.promptFeedback);
          }
          
          return {
            copies: [],
            tokenUsage: this.extractUsage(data.usageMetadata),
          };
        }
        
        // 텍스트 추출 (responseSchema 사용 시 이미 파싱된 JSON)
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        
        console.log(`[Gemini 2.5 Pro] 원본 응답:`, text.substring(0, 500));
        
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
          console.warn(`[Gemini 2.5 Pro] JSON 파싱 실패:`, e);
          parsed = this.safeParse(text);
        }
        
        if (!parsed.copies || parsed.copies.length === 0) {
          console.warn(`[Gemini 2.5 Pro] ⚠️ 빈 응답 - 원본:`, text);
          return {
            copies: [],
            tokenUsage: this.extractUsage(data.usageMetadata),
          };
        } else {
          console.log(`[Gemini 2.5 Pro] ✅ 파싱 성공: ${parsed.copies.length}개`);
        }

        return {
          copies: parsed.copies,
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
      `모든 Gemini API 키(${this.apiKeys.length}개)의 할당량이 소진되었습니다. ${lastError?.message ?? ""}`
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
    const inputCost = (tokenUsage.promptTokens * 0.0025) / 1000;
    const outputCost = (tokenUsage.completionTokens * 0.0075) / 1000;
    return Number((inputCost + outputCost).toFixed(6));
  }

  private buildPrompt(request: GenerationRequest): string {
    const { prompt, minChars, maxChars, count, tone } = request;

    // Gemini Pro에 최적화된 상세 프롬프트
    // 데이터/숫자 기반 스타일에 특화
    const isDataDriven = prompt.includes('숫자') || prompt.includes('데이터') || 
                        prompt.includes('통계') || prompt.includes('ROI');
    
    const styleGuide = isDataDriven ? `
**스타일 가이드 (데이터 기반):**
- 구체적인 숫자나 통계 활용 (예: "90% 고객 만족", "3배 빠른 성장")
- 측정 가능한 혜택 제시 (예: "매출 30% 증가", "비용 50% 절감")
- 신뢰성 있는 근거 포함
- ROI와 가치 증명 중심` : `
**스타일 가이드:**
- 명확하고 논리적인 메시지
- 구체적인 혜택과 가치 제안
- 전문적이고 신뢰감 있는 톤
- 비교 우위 강조`;

    return `당신은 한국어 광고 카피 전문가입니다.

**작업 지시:**
${prompt}

**요구사항:**
- 개수: 정확히 ${count}개
- 글자 수: ${minChars}자 이상 ${maxChars}자 이하 (공백 포함)
- 톤: ${tone || '전문적이고 신뢰감 있는'}
- 언어: 한국어
${styleGuide}

**중요 규칙:**
1. 각 카피는 서로 다른 접근법과 메시지를 가져야 함
2. 실제 광고에서 바로 사용 가능한 완성도
3. 타겟 고객의 관심을 즉시 끌 수 있는 훅(hook) 포함
4. 행동 유도(CTA)를 자연스럽게 포함

지금 ${count}개의 광고 카피를 생성하세요:`;
  }

  private safeParse(payload: string): { copies: string[] } {
    try {
      // 빈 응답 체크
      if (!payload || payload.trim() === '') {
        console.warn("[Gemini 2.5 Pro] 빈 응답 받음");
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
      
      try {
        const parsed = JSON.parse(cleanedPayload) as { copies?: unknown };
        if (!Array.isArray(parsed.copies)) {
          console.warn(`[Gemini 2.5 Pro] copies 필드가 배열이 아님:`, parsed);
          return { copies: [] };
        }
        
        // 유효한 카피만 필터링
        const validCopies = parsed.copies
          .filter(c => c && typeof c === 'string' && c.trim().length > 0)
          .map(c => String(c).trim());
        
        if (validCopies.length < parsed.copies.length) {
          console.warn(`[Gemini 2.5 Pro] 일부 카피가 필터링됨: ${parsed.copies.length} -> ${validCopies.length}`);
        }
        
        if (validCopies.length > 0) {
          console.log(`[Gemini 2.5 Pro] ✅ 파싱 성공: ${validCopies.length}개`);
        }
        
        return { copies: validCopies };
      } catch (parseError) {
        // JSON이 잘린 경우 부분 파싱 시도
        if (parseError instanceof SyntaxError && parseError.message.includes('Unterminated')) {
          console.warn(`[Gemini 2.5 Pro] JSON이 잘림, 부분 파싱 시도...`);
          
          // "copies" 배열 부분만 추출
          const copiesMatch = cleanedPayload.match(/"copies"\s*:\s*\[(.*?)(?:\]|$)/s);
          if (copiesMatch) {
            const copiesContent = copiesMatch[1];
            // 각 문자열 추출
            const stringMatches = copiesContent.matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"/g);
            const extractedCopies: string[] = [];
            
            for (const match of stringMatches) {
              const copy = match[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').trim();
              if (copy.length > 0) {
                extractedCopies.push(copy);
              }
            }
            
            if (extractedCopies.length > 0) {
              console.log(`[Gemini 2.5 Pro] ✅ 부분 파싱 성공: ${extractedCopies.length}개`);
              return { copies: extractedCopies };
            }
          }
        }
        
        throw parseError;
      }
    } catch (error) {
      console.error("[Gemini 2.5 Pro] JSON 파싱 오류:", error);
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

