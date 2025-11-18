// 카피라이팅 전략 서비스
// 공식, 트리거, 스타일을 분석하고 최적의 전략 추천

import type { IntentData } from "./intent-extraction-service";
import {
  COPYWRITING_FORMULAS,
  recommendFormula,
  type CopywritingFormula,
} from "@/src/domain/copywriting/formulas";
import {
  recommendTriggers,
  getTriggerById,
  type PsychologicalTrigger,
} from "@/src/domain/copywriting/psychological-triggers";
import {
  COPYWRITER_STYLES,
  recommendStyleByAudience,
  recommendStyleByTone,
  type CopywriterStyle,
} from "@/src/domain/copywriting/copywriter-styles";

export interface CopywritingStrategy {
  formula: CopywritingFormula;
  triggers: PsychologicalTrigger[];
  style: CopywriterStyle;
  reasoning: {
    formulaReason: string;
    triggersReason: string;
    styleReason: string;
  };
  promptEnhancements: {
    openingHook: string;
    emotionalAngle: string;
    proofPoints: string[];
    callToAction: string;
  };
}

export class CopywritingStrategyService {
  /**
   * 사용자 의도 기반으로 최적의 카피라이팅 전략 수립
   */
  analyze(intent: IntentData): CopywritingStrategy {
    // 1. 공식 선택
    const formula = this.selectFormula(intent);

    // 2. 심리 트리거 선택
    const triggers = this.selectTriggers(intent, formula);

    // 3. 카피라이터 스타일 선택
    const style = this.selectStyle(intent);

    // 4. 추론 근거
    const reasoning = this.generateReasoning(formula, triggers, style, intent);

    // 5. 프롬프트 강화 요소
    const promptEnhancements = this.generateEnhancements(
      intent,
      formula,
      triggers,
      style
    );

    return {
      formula,
      triggers,
      style,
      reasoning,
      promptEnhancements,
    };
  }

  /**
   * 공식 선택 로직
   */
  private selectFormula(intent: IntentData): CopywritingFormula {
    // 우선순위 1: 사용자가 직접 지정한 공식
    if (intent.preferredFormula) {
      const customFormula = COPYWRITING_FORMULAS[intent.preferredFormula];
      if (customFormula) return customFormula;
    }

    // 우선순위 2: 키워드 기반 추천
    const keywords = [
      ...(intent.keywords ?? []),
      ...(intent.emotionalTriggers ?? []),
    ];

    // 긴급성 키워드
    const urgencyKeywords = ["긴급", "지금", "당장", "즉시", "할인"];
    const hasUrgency = keywords.some((kw) =>
      urgencyKeywords.some((uk) => kw.includes(uk))
    );

    if (hasUrgency) {
      return COPYWRITING_FORMULAS.AIDA;
    }

    // 문제 해결 키워드
    const problemKeywords = ["문제", "고민", "해결", "걱정"];
    const hasProblem = keywords.some((kw) =>
      problemKeywords.some((pk) => kw.includes(pk))
    );

    if (hasProblem) {
      return COPYWRITING_FORMULAS.PAS;
    }

    // 변화 키워드
    const transformKeywords = ["변화", "달라진", "이전", "이후"];
    const hasTransform = keywords.some((kw) =>
      transformKeywords.some((tk) => kw.includes(tk))
    );

    if (hasTransform) {
      return COPYWRITING_FORMULAS.BAB;
    }

    // 우선순위 3: 길이 기반
    const avgLength = ((intent.minChars ?? 30) + (intent.maxChars ?? 60)) / 2;

    if (avgLength <= 40) {
      return COPYWRITING_FORMULAS.FOUR_U; // 짧은 카피
    }

    // 기본값: AIDA (가장 범용적)
    return COPYWRITING_FORMULAS.AIDA;
  }

  /**
   * 심리 트리거 선택 로직
   */
  private selectTriggers(
    intent: IntentData,
    formula: CopywritingFormula
  ): PsychologicalTrigger[] {
    const selectedTriggers: PsychologicalTrigger[] = [];

    // 1. 공식의 추천 트리거 우선 사용
    const formulaPreferredTriggers = formula.compatibleTriggers
      .map((id) => getTriggerById(id))
      .filter((t): t is PsychologicalTrigger => t !== undefined);

    // 2. 의도 키워드 기반 트리거 추가
    const keywords = [
      ...(intent.keywords ?? []),
      ...(intent.emotionalTriggers ?? []),
    ];
    const keywordBasedTriggers = recommendTriggers(keywords, 5);

    // 3. 중복 제거 및 병합
    const allTriggers = [...formulaPreferredTriggers, ...keywordBasedTriggers];
    const uniqueTriggerIds = new Set<number>();

    for (const trigger of allTriggers) {
      if (!uniqueTriggerIds.has(trigger.id) && selectedTriggers.length < 3) {
        uniqueTriggerIds.add(trigger.id);
        selectedTriggers.push(trigger);
      }
    }

    // 최소 1개 보장
    if (selectedTriggers.length === 0 && formulaPreferredTriggers.length > 0) {
      selectedTriggers.push(formulaPreferredTriggers[0]);
    }

    return selectedTriggers.slice(0, 3); // 최대 3개
  }

  /**
   * 카피라이터 스타일 선택 로직
   */
  private selectStyle(intent: IntentData): CopywriterStyle {
    // 1. 타겟 오디언스 기반
    if (intent.targetAudience) {
      const audienceStyle = recommendStyleByAudience(intent.targetAudience);
      if (audienceStyle) return audienceStyle;
    }

    // 2. 톤 기반
    const tone = intent.tone ?? "neutral";
    const toneStyles = recommendStyleByTone(
      this.mapToneToStyleTone(tone)
    );

    if (toneStyles.length > 0) {
      return toneStyles[0];
    }

    // 기본값: Gary Halbert (가장 범용적, 감성적)
    return COPYWRITER_STYLES.GARY_HALBERT;
  }

  /**
   * 톤 매핑
   */
  private mapToneToStyleTone(
    tone: string
  ): "emotional" | "logical" | "personal" | "formal" {
    const toneLower = tone.toLowerCase();

    if (toneLower.includes("감성") || toneLower.includes("emotional")) {
      return "emotional";
    }
    if (toneLower.includes("논리") || toneLower.includes("logical")) {
      return "logical";
    }
    if (toneLower.includes("친근") || toneLower.includes("personal")) {
      return "personal";
    }
    if (toneLower.includes("공식") || toneLower.includes("formal")) {
      return "formal";
    }

    return "emotional"; // 기본값
  }

  /**
   * 전략 선택 이유 생성
   */
  private generateReasoning(
    formula: CopywritingFormula,
    triggers: PsychologicalTrigger[],
    style: CopywriterStyle,
    intent: IntentData
  ): CopywritingStrategy["reasoning"] {
    return {
      formulaReason: `${formula.name} 공식을 선택한 이유: ${formula.bestFor.join(", ")}에 최적화되어 있으며, 효과도 ${formula.effectiveness}/5입니다.`,
      triggersReason: `선택된 심리 트리거: ${triggers.map((t) => t.name).join(", ")}. 이들은 ${formula.name} 공식과 높은 호환성을 가지며, 타겟 오디언스의 감정을 효과적으로 자극합니다.`,
      styleReason: `${style.koreanName}(${style.name}) 스타일 적용: ${style.philosophy}. ${style.bestForAudience.join(", ")}에 가장 효과적입니다.`,
    };
  }

  /**
   * 프롬프트 강화 요소 생성
   */
  private generateEnhancements(
    intent: IntentData,
    formula: CopywritingFormula,
    triggers: PsychologicalTrigger[],
    style: CopywriterStyle
  ): CopywritingStrategy["promptEnhancements"] {
    // 첫 훅 (공식의 첫 단계 활용)
    const openingHook =
      formula.steps[0]
        ? `${formula.steps[0].name} 단계: ${formula.steps[0].focus}`
        : "강력한 오프닝으로 즉시 관심 끌기";

    // 감정적 각도 (스타일 특성 활용)
    const emotionalAngle = `${style.name} 스타일: ${style.writingStyle}. 감정도 ${style.tone.emotion}/5, 개인적 연결 ${style.tone.personal}/5`;

    // 증명 포인트 (트리거 활용)
    const proofPoints = triggers.map((trigger) => {
      return `${trigger.name} 트리거 활용: ${trigger.example}`;
    });

    // CTA (공식의 마지막 단계)
    const lastStep = formula.steps[formula.steps.length - 1];
    const callToAction = lastStep
      ? `${lastStep.name}: ${lastStep.focus}`
      : "명확하고 강력한 행동 유도";

    return {
      openingHook,
      emotionalAngle,
      proofPoints,
      callToAction,
    };
  }

  /**
   * 전략을 프롬프트 문자열로 변환
   */
  buildStrategyPrompt(strategy: CopywritingStrategy): string {
    return `
## 카피라이팅 전략

### 선택된 공식: ${strategy.formula.name}
${strategy.reasoning.formulaReason}

구조:
${strategy.formula.steps
  .map(
    (step, idx) =>
      `${idx + 1}. ${step.name}: ${step.focus}${step.percentage ? ` (비중: ${step.percentage}%)` : ""}`
  )
  .join("\n")}

### 선택된 심리 트리거
${strategy.reasoning.triggersReason}

${strategy.triggers
  .map(
    (trigger) => `
- **${trigger.name}** (효과도: ${trigger.effectiveness}/5)
  사용법: ${trigger.usageContext}
  예시: "${trigger.example}"
`
  )
  .join("\n")}

### 카피라이터 스타일: ${strategy.style.name}
${strategy.reasoning.styleReason}

핵심 철학: "${strategy.style.philosophy}"

작성 스타일: ${strategy.style.writingStyle}

### 프롬프트 강화 요소

**오프닝 훅:**
${strategy.promptEnhancements.openingHook}

**감정적 각도:**
${strategy.promptEnhancements.emotionalAngle}

**증명 포인트:**
${strategy.promptEnhancements.proofPoints.join("\n")}

**CTA 전략:**
${strategy.promptEnhancements.callToAction}

---

위 전략을 모두 반영하여 카피를 작성하세요.
`.trim();
  }
}

