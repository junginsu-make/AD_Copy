import { ClaudeSonnet45Provider } from "./claude-provider";
import { Gemini25ProProvider } from "./gemini-provider";
import { Gemini25FlashProvider } from "./gemini-flash-provider";
import { OpenAIGPT5Provider } from "./openai-provider";
import { OpenAIGPT41Provider } from "./openai-gpt41-provider";
import type { LLMModel, LLMProvider, ProviderContext } from "./types";

export class LLMProviderFactory {
  private static instance: LLMProviderFactory;
  private providers: Map<LLMModel, LLMProvider> = new Map();

  private constructor() {
    const gpt5 = new OpenAIGPT5Provider();
    const gpt41 = new OpenAIGPT41Provider();
    const geminiPro = new Gemini25ProProvider();
    const geminiFlash = new Gemini25FlashProvider();
    const claude = new ClaudeSonnet45Provider();

    this.providers.set("gpt-5", gpt5);
    this.providers.set("gpt-4.1", gpt41); // 별도 GPT-4.1 Provider
    this.providers.set("gpt-4o", gpt5); // GPT-4o는 GPT-5 provider 사용 (폴백)
    this.providers.set("gemini-2.5-pro", geminiPro);
    this.providers.set("gemini-2.5-flash", geminiFlash);
    this.providers.set("claude-sonnet-4-5", claude);
    this.providers.set("claude-sonnet-4", claude); // Sonnet 4도 같은 provider
  }

  static getInstance(): LLMProviderFactory {
    if (!LLMProviderFactory.instance) {
      LLMProviderFactory.instance = new LLMProviderFactory();
    }
    return LLMProviderFactory.instance;
  }

  resolve(preferredModel?: LLMModel, _context?: ProviderContext): LLMProvider {
    if (preferredModel) {
      const provider = this.providers.get(preferredModel);
      if (provider && provider.isConfigured) {
        return provider;
      }
    }

    const priority = this.getPriorityOrder();
    for (const model of priority) {
      const provider = this.providers.get(model);
      if (provider?.isConfigured) {
        return provider;
      }
    }

    throw new Error("사용 가능한 LLM Provider가 없습니다. 환경 변수를 확인하세요.");
  }

  private getPriorityOrder(): LLMModel[] {
    const configuredDefault = process.env.DEFAULT_LLM_MODEL as LLMModel | undefined;
    const baseOrder: LLMModel[] = ["gpt-5", "gemini-2.5-pro", "gemini-2.5-flash", "claude-sonnet-4-5"];

    if (configuredDefault && baseOrder.includes(configuredDefault)) {
      return [configuredDefault, ...baseOrder.filter((model) => model !== configuredDefault)];
    }

    return baseOrder;
  }
  
  /**
   * 모든 구성된 Provider 반환 (멀티모델 병렬 생성용)
   */
  getAllConfiguredProviders(): LLMProvider[] {
    const all: LLMProvider[] = [];
    for (const provider of this.providers.values()) {
      if (provider.isConfigured) {
        all.push(provider);
      }
    }
    return all;
  }
  
  /**
   * 카피 생성용 주요 모델만 반환 (Flash 제외)
   */
  getGenerationProviders(): LLMProvider[] {
    const generationModels: LLMModel[] = ["gpt-5", "gemini-2.5-pro", "claude-sonnet-4-5"]; // 멀티모델 3개 복원
    const providers: LLMProvider[] = [];
    
    for (const model of generationModels) {
      const provider = this.providers.get(model);
      if (provider?.isConfigured) {
        providers.push(provider);
      }
    }
    
    return providers;
  }
}

