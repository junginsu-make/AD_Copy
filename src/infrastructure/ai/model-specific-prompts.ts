/**
 * 모델별 특화 프롬프트 생성
 * 각 LLM의 강점을 최대한 활용
 */

import { LLMModel } from "./types";
import { CopywritingStrategy } from "@/src/application/services/copywriting-strategy-service";

export interface ModelSpecificPromptOptions {
  basePrompt: string;
  model: LLMModel;
  strategy?: CopywritingStrategy;
  tone?: string;
  count?: number;
}

/**
 * 모델별 프롬프트 커스터마이징
 */
export function customizePromptForModel(
  options: ModelSpecificPromptOptions
): string {
  const { basePrompt, model, strategy, tone, count } = options;
  
  switch (model) {
    case "gpt-5":
      return buildGPT5Prompt(basePrompt, strategy, tone, count);
    
    case "gemini-2.5-pro":
      return buildGeminiProPrompt(basePrompt, strategy, tone, count);
    
    case "gemini-2.5-flash":
      return buildGeminiFlashPrompt(basePrompt, strategy, tone, count);
    
    case "claude-sonnet-4-5":
      return buildClaudePrompt(basePrompt, strategy, tone, count);
    
    default:
      return basePrompt;
  }
}

/**
 * GPT-5: 창의성과 감성 중심
 */
function buildGPT5Prompt(
  basePrompt: string,
  strategy?: CopywritingStrategy,
  tone?: string,
  count?: number
): string {
  return `
[GPT-5 창의성 모드]

당신은 감성적이고 창의적인 카피를 만드는 전문가입니다.

**특별 지시:**
- 감정을 자극하는 표현 사용
- 은유와 비유를 활용
- 스토리텔링 요소 포함
- 독창적이고 기억에 남는 표현

${basePrompt}

**GPT-5 추가 요구사항:**
- 각 카피마다 다른 감정 톤 사용
- 시각적으로 상상 가능한 표현
- 브랜드 개성을 살린 톤
`.trim();
}

/**
 * Gemini Pro: 논리와 데이터 중심
 */
function buildGeminiProPrompt(
  basePrompt: string,
  strategy?: CopywritingStrategy,
  tone?: string,
  count?: number
): string {
  return `
[Gemini Pro 분석 모드]

당신은 데이터 기반의 논리적 카피를 만드는 전문가입니다.

**특별 지시:**
- 구체적 숫자와 통계 활용
- 논리적 근거 제시
- 명확한 가치 제안
- ROI 중심 메시지

${basePrompt}

**Gemini Pro 추가 요구사항:**
- 측정 가능한 혜택 강조
- 비교 우위 명시
- 신뢰할 수 있는 톤
`.trim();
}

/**
 * Gemini Flash: 직접적이고 빠른 메시지
 */
function buildGeminiFlashPrompt(
  basePrompt: string,
  strategy?: CopywritingStrategy,
  tone?: string,
  count?: number
): string {
  return `
[Gemini Flash 속도 모드]

당신은 즉각적이고 직접적인 카피를 만드는 전문가입니다.

**특별 지시:**
- 핵심만 간결하게
- 강력한 CTA
- 긴급성 강조
- 즉시 이해 가능한 메시지

${basePrompt}

**Flash 추가 요구사항:**
- 첫 3초 안에 주목
- 행동 유도 동사 사용
- 시간 제한 강조
`.trim();
}

/**
 * Claude: 스토리텔링과 프리미엄
 */
function buildClaudePrompt(
  basePrompt: string,
  strategy?: CopywritingStrategy,
  tone?: string,
  count?: number
): string {
  return `
[Claude 스토리텔링 모드]

당신은 프리미엄 브랜드 스토리를 만드는 전문가입니다.

**특별 지시:**
- 브랜드 내러티브 구축
- 고급스러운 어휘 선택
- 섬세한 감정 표현
- 장인정신 강조

${basePrompt}

**Claude 추가 요구사항:**
- 브랜드 헤리티지 암시
- 독점성과 희소성 표현
- 우아하고 세련된 톤
`.trim();
}

/**
 * 모델별 최적 톤 매핑
 */
export const MODEL_TONE_MAPPING: Record<LLMModel, string[]> = {
  "gpt-5": ["emotional", "creative", "inspiring", "playful"],
  "gemini-2.5-pro": ["professional", "analytical", "trustworthy", "informative"],
  "gemini-2.5-flash": ["urgent", "direct", "casual", "energetic"],
  "claude-sonnet-4-5": ["premium", "sophisticated", "storytelling", "exclusive"],
  "gpt-4o": ["balanced", "versatile", "adaptive"],
  "gpt-4.1": ["stable", "reliable", "consistent"],
};

/**
 * 모델별 최적 카피 길이
 */
export const MODEL_LENGTH_PREFERENCE: Record<LLMModel, { min: number; max: number }> = {
  "gpt-5": { min: 30, max: 80 },           // 중간-긴 카피
  "gemini-2.5-pro": { min: 40, max: 100 }, // 상세한 카피
  "gemini-2.5-flash": { min: 15, max: 40 }, // 짧은 카피
  "claude-sonnet-4-5": { min: 50, max: 120 }, // 긴 카피
  "gpt-4o": { min: 25, max: 70 },
  "gpt-4.1": { min: 25, max: 70 },
};
