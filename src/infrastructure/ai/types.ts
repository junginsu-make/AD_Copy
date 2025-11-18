// 2025년 11월 기준 최신 모델명
export type LLMModel = 
  | "gpt-5"           // OpenAI 플래그십 (최신)
  | "gpt-4.1"         // OpenAI 안정적 모델
  | "gpt-4o"          // OpenAI 멀티모달
  | "gemini-2.5-pro"  // Gemini 고급 추론
  | "gemini-2.5-flash" // Gemini 빠른 응답
  | "claude-sonnet-4-5"; // Claude 최신

export interface CreativeGuideline {
  title: string;
  description: string;
}

export interface GenerationRequest {
  prompt: string;
  minChars: number;
  maxChars: number;
  tone?: string;
  count: number;
  creativeGuidelines?: CreativeGuideline[];
}

export interface GenerationResult {
  copies: string[];
  tokenUsage: TokenUsage;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ProviderContext {
  preferredModel?: LLMModel;
  domain?: string;
}

export interface LLMProvider {
  readonly modelName: LLMModel;
  readonly isConfigured: boolean;
  generateCopies(request: GenerationRequest): Promise<GenerationResult>;
  generateSingleCopy(
    request: GenerationRequest,
    options?: { maxRetries?: number }
  ): Promise<string | null>;
  calculateCost(tokenUsage: TokenUsage): number;
}

