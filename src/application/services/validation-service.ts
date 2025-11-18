// 입력 검증 서비스
export interface CopyGenerationRequest {
  userId: number;
  prompt: string;
  minChars: number;
  maxChars: number;
  tone?: string;
  count?: number;
  templateId?: number;
  preferredModel?: string;
  creativeGuidelines?: Array<{
    title: string;
    description: string;
  }>;
}

export class ValidationService {
  // 카피 생성 요청 검증
  validateCopyRequest(request: CopyGenerationRequest): void {
    // 프롬프트 검증
    if (!request.prompt || request.prompt.length < 5) {
      throw new ValidationError("프롬프트는 최소 5자 이상이어야 합니다.");
    }
    if (request.prompt.length > 2000) {
      throw new ValidationError("프롬프트는 2000자를 초과할 수 없습니다.");
    }

    // 글자수 범위 검증
    if (request.minChars < 10 || request.minChars > 500) {
      throw new ValidationError("최소 글자수는 10자 이상 500자 이하여야 합니다.");
    }
    if (request.maxChars < request.minChars || request.maxChars > 500) {
      throw new ValidationError(
        "최대 글자수는 최소 글자수 이상이고 500자 이하여야 합니다."
      );
    }

    // 생성 개수 검증
    const count = request.count || 1;
    if (count < 1 || count > 10) {
      throw new ValidationError("생성 개수는 1개 이상 10개 이하여야 합니다.");
    }

    // Tone 검증
    const validTones = [
      "casual",
      "formal",
      "urgent",
      "humorous",
      "professional",
      "neutral",
    ];
    if (request.tone && !validTones.includes(request.tone)) {
      throw new ValidationError(
        `유효하지 않은 톤입니다. 사용 가능한 톤: ${validTones.join(", ")}`
      );
    }

    if (request.preferredModel) {
      const validModels = ["gpt-5", "gpt-4.1", "gpt-4o", "gemini-2.5-pro", "gemini-2.5-flash", "claude-sonnet-4-5"];
      if (!validModels.includes(request.preferredModel)) {
        throw new ValidationError(
          `지원하지 않는 모델입니다. 사용 가능한 모델: ${validModels.join(", ")}`
        );
      }
    }

    if (request.creativeGuidelines) {
      request.creativeGuidelines.forEach((guideline, idx) => {
        if (!guideline.title || !guideline.description) {
          throw new ValidationError(
            `창의 가이드라인 ${idx + 1}번의 title/description을 확인하세요.`
          );
        }
      });
    }
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

