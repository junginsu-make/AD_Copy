import { LLMProviderFactory } from "@/src/infrastructure/ai/llm-provider-factory";
import Anthropic from "@anthropic-ai/sdk";

export interface IntentData {
  productName?: string;
  targetAudience?: string;
  tone?: string;
  keyBenefits?: string[];
  callToAction?: string;
  channel?: string;
  keywords?: string[];
  minChars?: number;
  maxChars?: number;
  desiredCopies?: number;
  additionalNotes?: string[];
  
  // 새로 추가: 길이 다양성
  lengthVariety?: "mixed" | "short-only" | "medium-only" | "long-only";
  lengthPreferences?: {
    short?: number;   // 15-30자 개수
    medium?: number;  // 30-60자 개수
    long?: number;    // 60-100자 개수
  };
  
  // 창의성 관련
  emotionalTriggers?: string[];  // 감정 키워드
  visualImagery?: string[];      // 시각적 이미지
  storytellingAngle?: string;    // 스토리텔링 각도
  
  // URL 분석 결과 (Phase 3)
  sourceUrl?: string;
  analyzedData?: {
    existingCopies?: string[];
    competitorCopies?: string[];
    brandVoice?: string;
    keyFeatures?: string[];
    priceRange?: string;
  };
  
  // 신뢰도 점수 (AI 분석 결과의 확신도)
  confidence?: number;
}

export class IntentExtractionService {
  private readonly providerFactory = LLMProviderFactory.getInstance();
  private claudeClient: Anthropic | null = null;

  constructor() {
    // Claude 클라이언트 초기화 (사용자 의도 파악을 위한 고성능 모델)
    if (process.env.ANTHROPIC_API_KEY) {
      this.claudeClient = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
    }
  }

  async extract(rawPrompt: string): Promise<IntentData> {
    try {
      // 먼저 휴리스틱으로 기본 의도 추출
      const heuristicResult = this.heuristicIntent(rawPrompt);
      
      // Claude Sonnet 4.5로 정확한 의도 파악 (성능 개선)
      try {
        if (!this.claudeClient) {
          console.warn("❌ Claude API 키가 없음, 휴리스틱 결과 사용");
          return heuristicResult;
        }
        
        console.log("\n🧠 사용자 의도 분석 중... (Claude Sonnet 4.5)");
        const startTime = Date.now();
        
        // Claude API 호출 (Intent Extraction용)
        const response = await this.claudeClient.messages.create({
          model: "claude-sonnet-4-5",
          max_tokens: 2048,
          temperature: 0.3,  // 정확한 분석을 위해 낮은 temperature
          messages: [
            {
              role: "user",
              content: this.buildEnhancedPrompt(rawPrompt)
            }
          ]
        });

        const content = response.content[0];
        if (content.type !== "text") {
          console.warn("⚠️ Claude 응답이 텍스트가 아님, 휴리스틱 결과 사용");
          return heuristicResult;
        }

        const text = content.text;
        const elapsedMs = Date.now() - startTime;
        
        console.log(`✅ 의도 분석 완료 (${elapsedMs}ms)`);
        console.log(`📊 토큰 사용량: ${response.usage.input_tokens} 입력, ${response.usage.output_tokens} 출력`);
        
        // JSON 파싱 시도
        let aiResult: IntentData;
        try {
          // 마크다운 코드블록 제거
          let jsonText = text.trim();
          if (jsonText.startsWith("```")) {
            jsonText = jsonText.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
          }
          
          // undefined를 null로 치환 (JSON 호환성)
          jsonText = jsonText.replace(/:\s*undefined\s*([,}])/g, ': null$1');
          
          // JSON 파싱
          aiResult = this.parseIntent(jsonText);
          
          console.log("🎯 분석 결과:");
          console.log(`  - 제품: ${aiResult.productName || "미지정"}`);
          console.log(`  - 타겟: ${aiResult.targetAudience || "미지정"}`);
          console.log(`  - 톤: ${aiResult.tone || "미지정"}`);
          console.log(`  - 키워드: ${aiResult.keywords?.join(", ") || "없음"}`);
          console.log(`  - 신뢰도: ${((aiResult.confidence || 0) * 100).toFixed(0)}%`);
          
        } catch (parseError) {
          console.warn("⚠️ Intent JSON 파싱 실패, 휴리스틱 결과 사용", parseError);
          // 파싱 실패 시 휴리스틱 결과만 사용
          return heuristicResult;
        }
        
        // AI 결과와 휴리스틱 결과 병합 (AI 우선)
        return {
          ...heuristicResult,
          ...aiResult,
          // 중요한 필드는 AI 결과가 있을 때만 덮어씀
          productName: aiResult.productName || heuristicResult.productName,
          targetAudience: aiResult.targetAudience || heuristicResult.targetAudience,
          tone: aiResult.tone || heuristicResult.tone,
          keyBenefits: aiResult.keyBenefits?.length ? aiResult.keyBenefits : heuristicResult.keyBenefits,
          keywords: aiResult.keywords?.length ? aiResult.keywords : heuristicResult.keywords,
          confidence: aiResult.confidence || 0.8,
        };
      } catch (aiError) {
        console.warn("⚠️ Claude 의도 추출 실패, 휴리스틱 결과 사용", aiError);
        return heuristicResult;
      }
    } catch (error) {
      console.error("❌ 의도 추출 완전 실패, 기본값 사용", error);
      return this.getDefaultIntent();
    }
  }

  private buildEnhancedPrompt(rawPrompt: string): string {
    return `당신은 20년 경력의 한국어 광고 카피 전략 분석가입니다.
사용자의 자연어 입력을 **정확히** 분석하여 카피 생성에 필요한 모든 정보를 추출하세요.

**중요 원칙:**
- 사용자가 명시한 내용을 **절대적으로 우선**하세요
- 추측하지 말고, 사용자 입력에서 **명확히 언급된 내용만** 추출하세요
- 사용자가 언급하지 않은 것은 null 또는 빈 배열로 두세요 (undefined 사용 금지!)
- **중요**: JSON에서 undefined는 사용 불가! 반드시 null 사용!

## 출력 형식 (순수 JSON만 반환, 다른 텍스트 절대 금지!)

**중요**: undefined 사용 금지! 값이 없으면 null 또는 빈 배열 사용!

{
  "productName": "제품명 또는 서비스명" 또는 null,
  "targetAudience": "타겟 고객층 (연령, 성별, 특성)" 또는 null,
  "tone": "casual|formal|urgent|humorous|professional|neutral" 또는 null,
  "keyBenefits": ["핵심 베네핏1", "핵심 베네핏2"] 또는 [],
  "callToAction": "행동 유도 문구" 또는 null,
  "channel": "SNS|배너|블로그|이메일" 또는 null,
  "keywords": ["핵심 키워드"] 또는 [],
  "minChars": 숫자 또는 null,
  "maxChars": 숫자 또는 null,
  "desiredCopies": 숫자 또는 null,
  "additionalNotes": ["기타 요구사항"] 또는 [],
  "lengthVariety": "mixed|short-only|medium-only|long-only" 또는 null,
  "emotionalTriggers": ["유발할 감정"] 또는 [],
  "visualImagery": ["시각적 이미지 키워드"] 또는 [],
  "storytellingAngle": "스토리텔링 각도" 또는 null,
  "confidence": 0.0~1.0 (분석 신뢰도 점수, 숫자로만)
}

## 분석 가이드
1. **정확성 우선:**
   - 사용자가 명시한 내용만 추출
   - "혁신적이고 전문적으로" → tone: "professional"
   - "30대 남성" → targetAudience: "30대 남성"
   - 추측하지 말 것

2. 길이 다양성 판단:
   - "다양하게", "여러 길이": lengthVariety = "mixed"
   - "짧게", "SNS용": lengthVariety = "short-only"
   - "길게", "상세하게": lengthVariety = "long-only"
   - 명시 없으면: "mixed"

3. 감정 트리거 추출:
   - 사용자가 **명시한** 감정 반응만 추출
   - 예: "동경", "안정감", "신뢰", "설렘", "안심"
   - 명시 없으면 빈 배열

4. 시각적 이미지:
   - 사용자가 **언급한** 시각적 요소만
   - 예: "자연", "빛", "부드러움", "세련됨"
   - 명시 없으면 빈 배열

5. 스토리텔링:
   - 사용자가 **원하는** 스토리 각도만
   - 예: "하루의 시작", "자기관리 루틴", "변화의 순간"
   - 명시 없으면 undefined

## 사용자 입력
${rawPrompt}

## 출력 규칙
1. 순수한 JSON만 반환 (코드블록 없이, 설명 없이)
2. undefined 절대 사용 금지! null 또는 빈 배열 사용
3. 모든 문자열 값은 쌍따옴표로 감싸기
4. 숫자는 따옴표 없이
5. confidence는 0.0~1.0 사이 숫자 (예: 0.95)

지금 바로 순수 JSON만 출력하세요:`;
  }

  private parseIntent(jsonPayload: string): IntentData {
    try {
      const parsed = JSON.parse(jsonPayload);
      const normalizeNumber = (value: unknown): number | undefined => {
        if (typeof value === "number") return value;
        if (typeof value === "string" && value.trim()) {
          const digits = value.match(/\d+/g);
          if (!digits) return undefined;
          const numbers = digits.map((num) => Number(num)).filter(Boolean);
          if (numbers.length === 1) return numbers[0];
          if (numbers.length >= 2) {
            return numbers[numbers.length - 1];
          }
        }
        return undefined;
      };

      const toStringArray = (value: unknown): string[] => {
        if (Array.isArray(value)) {
          return value.map((item) => String(item).trim()).filter(Boolean);
        }
        if (typeof value === "string") {
          return value
            .split(/[\n,]/)
            .map((v) => v.trim())
            .filter(Boolean);
        }
        return [];
      };

      const desiredCopies = normalizeNumber(parsed.desiredCopies);

      return {
        productName: this.stringOrUndefined(parsed.productName),
        targetAudience: this.stringOrUndefined(parsed.targetAudience),
        tone: this.stringOrUndefined(parsed.tone),
        keyBenefits: toStringArray(parsed.keyBenefits),
        callToAction: this.stringOrUndefined(parsed.callToAction),
        channel: this.stringOrUndefined(parsed.channel),
        keywords: toStringArray(parsed.keywords),
        minChars: normalizeNumber(parsed.minChars),
        maxChars: normalizeNumber(parsed.maxChars),
        desiredCopies: desiredCopies && desiredCopies >= 1 ? desiredCopies : undefined,
        additionalNotes: toStringArray(parsed.additionalNotes),
        
        // 새로 추가된 필드
        lengthVariety: this.stringOrUndefined(parsed.lengthVariety) as any,
        lengthPreferences: parsed.lengthPreferences,
        emotionalTriggers: toStringArray(parsed.emotionalTriggers),
        visualImagery: toStringArray(parsed.visualImagery),
        storytellingAngle: this.stringOrUndefined(parsed.storytellingAngle),
        sourceUrl: this.stringOrUndefined(parsed.sourceUrl),
        analyzedData: parsed.analyzedData,
      };
    } catch (error) {
      console.warn("JSON 파싱 실패, 휴리스틱 사용", error, jsonPayload);
      return this.heuristicIntent(jsonPayload);
    }
  }

  private getDefaultIntent(): IntentData {
    return {
      productName: undefined,
      targetAudience: undefined,
      tone: "neutral" as const,
      keyBenefits: [],
      callToAction: undefined,
      channel: undefined,
      keywords: [],
      minChars: 30,
      maxChars: 60,
      desiredCopies: 10,
      additionalNotes: [],
      lengthVariety: "mixed" as const,
      emotionalTriggers: [],
      visualImagery: [],
      storytellingAngle: undefined,
    };
  }

  private heuristicIntent(rawPrompt: string): IntentData {
    const lower = rawPrompt.toLowerCase();
    const toneMatch = this.detectTone(lower);
    const lengthMatch = rawPrompt.match(/(\d+)[^\d]+(\d+)\s*자/);
    const singleLength = rawPrompt.match(/(\d+)\s*자/);

    const minChars = lengthMatch ? Number(lengthMatch[1]) : undefined;
    const maxChars = lengthMatch ? Number(lengthMatch[2]) : singleLength ? Number(singleLength[1]) : undefined;

    return {
      productName: this.extractProduct(rawPrompt),
      targetAudience: this.extractAudience(rawPrompt),
      tone: toneMatch,
      keyBenefits: this.extractKeywords(rawPrompt),
      minChars,
      maxChars,
    };
  }

  private stringOrUndefined(value: unknown): string | undefined {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    return undefined;
  }

  private detectTone(lowerPrompt: string): string | undefined {
    if (lowerPrompt.includes("프리미엄") || lowerPrompt.includes("고급")) {
      return "formal";
    }
    if (lowerPrompt.includes("긴급") || lowerPrompt.includes("한정")) {
      return "urgent";
    }
    if (lowerPrompt.includes("재미") || lowerPrompt.includes("유머")) {
      return "humorous";
    }
    if (lowerPrompt.includes("친근") || lowerPrompt.includes("편안")) {
      return "casual";
    }
    return undefined;
  }

  private extractProduct(rawPrompt: string): string | undefined {
    const productMatch = rawPrompt.match(/(상품|제품|서비스|브랜드)[^\w]*(.+?)(?:\.|,|\n|입니다|이에요)/);
    if (productMatch && productMatch[2]) {
      return productMatch[2].trim();
    }
    return undefined;
  }

  private extractAudience(rawPrompt: string): string | undefined {
    const audienceMatch = rawPrompt.match(/(타겟|대상|고객)[^\w]*(.+?)(?:\.|,|\n)/);
    if (audienceMatch && audienceMatch[2]) {
      return audienceMatch[2].trim();
    }
    return undefined;
  }

  private extractKeywords(rawPrompt: string): string[] {
    const keywords: string[] = [];
    const lines = rawPrompt.split(/\n|,/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length > 2 && trimmed.length < 40) {
        keywords.push(trimmed);
      }
    }
    return keywords.slice(0, 5);
  }
}

