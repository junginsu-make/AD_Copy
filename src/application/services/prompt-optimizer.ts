import type { IntentData } from "./intent-extraction-service";
import { getExamplesByCategory, buildFewShotPrompt, COPY_PRINCIPLES } from "./few-shot-examples";
import { CopywritingStrategyService, type CopywritingStrategy } from "./copywriting-strategy-service";
// import { AdReferenceService, type AdReference } from "./ad-reference-service";
import { ProductionAdReferenceService as AdReferenceService, type AdReference } from "./production-ad-reference-service";
import { buildPlatformCompliancePrompt } from "@/src/domain/ad-platforms/platform-specs";

export type PromptStrategy = "focused" | "comprehensive" | "maximum";

interface BuildPromptOptions {
  rawPrompt: string;
  intent: IntentData;
  minChars: number;
  maxChars: number;
  tone: string;
  count: number;
  customTemplate?: string | null;
  useCopywritingTheory?: boolean; // 카피라이팅 이론 사용 여부
  useAdReferences?: boolean; // 실제 광고 레퍼런스 사용 여부
  promptStrategy?: PromptStrategy; // 프롬프트 전략 (focused/comprehensive/maximum)
  adReferenceFreshness?: number; // 광고 신선도 (일 단위)
  targetPlatform?: "naver" | "google" | "kakao"; // 광고매체 (선택적)
  targetAdType?: string; // 광고 유형 (선택적)
}

export class PromptOptimizer {
  readonly defaults = {
    minChars: 30,
    maxChars: 60,
    freshnessDays: 90, // 기본 90일 (3개월)
  } as const;

  /**
   * 프롬프트 전략별 설정
   */
  private readonly PROMPT_STRATEGY_CONFIG = {
    focused: {
      targetSize: 1200,
      includes: ["페르소나", "핵심전략", "요구사항"],
      adReferences: 0, // 레퍼런스 미포함
      description: "빠른 생성 (3초, 품질 85점)",
    },
    comprehensive: {
      targetSize: 2000,
      includes: ["페르소나", "전략상세", "레퍼런스3개", "요구사항"],
      adReferences: 3,
      description: "균형잡힌 기본값 (5초, 품질 92점)",
    },
    maximum: {
      targetSize: 3500,
      includes: ["페르소나", "전략상세", "레퍼런스5개", "Few-shot", "요구사항"],
      adReferences: 5,
      description: "최고 품질 (8초, 품질 95점)",
    },
  } as const;

  private strategyService = new CopywritingStrategyService();
  private adReferenceService = new AdReferenceService();

  async build(options: BuildPromptOptions): Promise<string> {
    // 카피라이팅 이론 사용 여부 (기본값: true)
    const useCopywritingTheory = options.useCopywritingTheory ?? true;

    if (useCopywritingTheory) {
      return this.buildWithCopywritingTheory(options);
    } else {
      return this.buildLegacy(options);
    }
  }

  /**
   * 새로운 방식: 카피라이팅 이론 통합
   */
  private async buildWithCopywritingTheory(options: BuildPromptOptions): Promise<string> {
    console.log("\n프롬프트 최적화 시작");
    
    // 프롬프트 전략 결정
    const promptStrategy = options.promptStrategy ?? "comprehensive";
    const strategyConfig = this.PROMPT_STRATEGY_CONFIG[promptStrategy];
    
    console.log("  - 전략:", promptStrategy, `(목표: ${strategyConfig.targetSize}자)`);
    
    // URL 분석 결과 확인 및 로깅
    if (options.intent.sourceUrl) {
      console.log(`\n🌐 URL 기반 카피 생성`);
      console.log(`  - 원본 URL: ${options.intent.sourceUrl}`);
      console.log(`  - 추출된 제품명: ${options.intent.productName || "없음"}`);
      console.log(`  - 추출된 타겟: ${options.intent.targetAudience || "없음"}`);
      console.log(`  - 추출된 키워드 수: ${options.intent.keywords?.length || 0}개`);
      console.log(`  - 기존 카피 수: ${options.intent.analyzedData?.existingCopies?.length || 0}개`);
      
      // 기존 카피 로깅
      if (options.intent.analyzedData?.existingCopies && options.intent.analyzedData.existingCopies.length > 0) {
        console.log(`  - 기존 카피 예시:`);
        options.intent.analyzedData.existingCopies.slice(0, 3).forEach((copy, idx) => {
          console.log(`    ${idx + 1}. "${copy.substring(0, 80)}${copy.length > 80 ? '...' : ''}"`);
        });
      }
    }

    // 1. 카피라이팅 전략 분석
    const strategy = this.strategyService.analyze(options.intent);
    
    console.log("\n  - 선택된 공식:", strategy.formula.name);
    console.log("  - 선택된 트리거:", strategy.triggers.map(t => t.name).join(", "));
    console.log("  - 선택된 스타일:", strategy.style.name);

    // 2. Few-shot 예시 (maximum 전략일 때만)
    let fewShotSection = "";
    if (promptStrategy === "maximum") {
      const category = options.intent.productName ?? options.rawPrompt;
      const examples = getExamplesByCategory(category);
      fewShotSection = buildFewShotPrompt(examples);
    }

    // 3. 실제 광고 레퍼런스 수집 (개선된 시스템)
    let adReferenceSection = "";
    const shouldIncludeAdRefs = 
      options.useAdReferences !== false && strategyConfig.adReferences > 0;
    
    console.log("  - 광고 레퍼런스:", shouldIncludeAdRefs ? "사용" : "미사용");
    
    if (shouldIncludeAdRefs) {
      try {
        // 실제 광고 레퍼런스 수집 (하드코딩 DB 폴백 제거)
        const adReferences = await this.adReferenceService.findSimilarAds(
          options.intent,
          {
            limit: 30, // 더 많이 수집하여 DB에 누적 (프롬프트엔 5개만 사용)
            freshnessDays: options.adReferenceFreshness ?? 90
          }
        );
        
        if (adReferences.length > 0) {
          adReferenceSection = this.buildAdReferenceSection(adReferences);
          console.log(`  ✅ 실제 광고 레퍼런스 ${adReferences.length}개 수집 완료`);
          console.log(`  📋 레퍼런스 플랫폼: ${adReferences.map(r => r.platform).join(", ")}`);
        } else {
          console.log("  ⚠️ 광고 레퍼런스 수집 실패 (레퍼런스 없이 진행)");
          // 하드코딩 DB 폴백 제거 - 레퍼런스 없이 진행
        }
      } catch (error) {
        console.warn("  ⚠️ 광고 레퍼런스 수집 실패 (레퍼런스 없이 진행):", error);
        // 하드코딩 DB 폴백 제거 - 레퍼런스 없이 진행
      }
    }
    
    // 4. 플랫폼 규격 확인
    if (options.targetPlatform) {
      console.log("  - 플랫폼 규격:", options.targetPlatform.toUpperCase(), "준수");
    }

    // 4. 전략 프롬프트 생성 (전략에 따라 간소화 또는 상세화)
    const strategyPrompt = this.buildStrategyPrompt(strategy, promptStrategy);

    // 5. 카피라이터 마스터 템플릿
    const masterTemplate = strategy.style.masterPromptTemplate;

    // 6. 최종 프롬프트 조합
    const sections = [masterTemplate];

    // 전략 섹션 (항상 포함)
    sections.push("---");
    sections.push(strategyPrompt);

    // 광고 레퍼런스 섹션 (있으면 포함)
    if (adReferenceSection) {
      sections.push("---");
      sections.push(adReferenceSection);
    }

    // Few-shot 예시 (comprehensive 이상일 때 포함)
    if (fewShotSection || promptStrategy !== "focused") {
      if (fewShotSection) {
        sections.push("---");
        sections.push(fewShotSection);
      } else {
        // Few-shot이 없으면 카테고리별 예시 2개 추가
        const category = options.intent.productName ?? options.rawPrompt;
        const quickExamples = getExamplesByCategory(category);
        if (quickExamples.length > 0) {
          sections.push("---");
          sections.push(this.buildQuickExamplesSection(quickExamples.slice(0, 2)));
        }
      }
    }

    // 플랫폼 규격 섹션 (선택했을 때만 추가) ✨
    if (options.targetPlatform) {
      sections.push("---");
      const platformPrompt = buildPlatformCompliancePrompt(
        options.targetPlatform,
        options.targetAdType
      );
      sections.push(platformPrompt);
    }

    // 요구사항 섹션 (전략에 따라 상세도 조절)
    sections.push("---");
    
    const instructionSection = promptStrategy === "focused" 
      ? this.buildFocusedInstructions(options, strategy)
      : this.buildDetailedInstructions(options, strategy);
    
    sections.push(instructionSection);

    const finalPrompt = sections.join("\n\n");
    
    // 광고 레퍼런스 포함 여부 확인 및 로깅 (LLM 전달 검증)
    const hasAdReferences = adReferenceSection.length > 0;
    const adRefCount = hasAdReferences 
      ? (adReferenceSection.match(/예시 \d+ \[실제/g) || []).length 
      : 0;
    
    console.log("\n=====================================");
    console.log("최종 프롬프트 검증");
    console.log("=====================================");
    console.log("프롬프트 크기:", finalPrompt.length, "자");
    console.log("광고 레퍼런스 포함:", hasAdReferences ? `✅ ${adRefCount}개 포함` : "❌ 없음");
    
    if (hasAdReferences) {
      // 레퍼런스 섹션이 프롬프트에 포함되었는지 확인
      const includesReferenceSection = finalPrompt.includes("실제 집행 중인 광고 레퍼런스");
      const includesReferenceExamples = finalPrompt.includes("예시 1 [실제");
      
      console.log("레퍼런스 섹션 포함:", includesReferenceSection ? "✅ 확인됨" : "❌ 누락됨");
      console.log("레퍼런스 예시 포함:", includesReferenceExamples ? "✅ 확인됨" : "❌ 누락됨");
      
      if (!includesReferenceSection || !includesReferenceExamples) {
        console.error("⚠️ 경고: 레퍼런스가 프롬프트에 포함되지 않았습니다!");
        console.error("   프롬프트를 확인하세요.");
      } else {
        console.log("✅ 레퍼런스가 프롬프트에 정확히 포함되어 LLM 모델에 전달됩니다.");
      }
      
      // 레퍼런스 내용 샘플 출력 (디버깅용)
      const refSample = adReferenceSection.substring(0, 300);
      console.log("\n레퍼런스 샘플 (처음 300자):");
      console.log(refSample + "...");
      
      // 플랫폼 정보 확인
      const platforms = adReferenceSection.match(/\[실제 (\w+) 광고\]/g) || [];
      const uniquePlatforms = [...new Set(platforms.map(p => p.match(/\[실제 (\w+) 광고\]/)?.[1]))];
      console.log(`레퍼런스 플랫폼: ${uniquePlatforms.join(", ")}`);
    } else if (shouldIncludeAdRefs) {
      console.log("⚠️ 레퍼런스 사용이 요청되었으나 수집되지 않았습니다.");
      console.log("   레퍼런스 없이 프롬프트가 생성됩니다.");
    }
    
    console.log("=====================================\n");
    
    return finalPrompt;
  }

  private getFormulaInstructionText(formulaName: string): string {
    switch (formulaName) {
      case "AIDA":
        return "1) 주목(Attention): 강렬한 첫 문장\n2) 관심(Interest): 호기심 유발\n3) 욕구(Desire): 혜택 강조\n4) 행동(Action): CTA";
      case "PAS":
        return "1) 문제(Problem): 고객 고민 언급\n2) 자극(Agitate): 문제 심화\n3) 해결(Solution): 우리 제품이 답";
      case "FAB":
        return "1) 기능(Feature): 핵심 기능\n2) 장점(Advantage): 경쟁 우위\n3) 혜택(Benefit): 고객 이득";
      case "4P":
        return "1) 약속(Promise): 큰 약속\n2) 그림(Picture): 생생한 묘사\n3) 증명(Proof): 근거 제시\n4) 압박(Push): 행동 유도";
      case "Before-After":
        return "이전: 불편한 현재 → 이후: 개선된 미래";
      case "USP":
        return "우리만의 독특한 가치 제안 강조";
      case "Story":
        return "짧은 스토리로 감정 이입 유도";
      case "STAR":
        return "상황-과제-행동-결과 순서로 전개";
      case "Problem-Solution":
        return "문제 제시 → 즉각적 해결책";
      case "Contrast":
        return "대조를 통한 차별화 (예: 작지만 강력한)";
      case "Future Pacing":
        return "미래의 성공한 모습 그리기";
      case "Heritage":
        return "역사와 전통의 가치 강조";
      default:
        return "명확하고 설득력 있게 작성";
    }
  }

  /**
   * 전략 프롬프트 생성 (전략에 따라 간소화)
   */
  private buildStrategyPrompt(
    strategy: CopywritingStrategy,
    promptStrategy: PromptStrategy
  ): string {
    if (promptStrategy === "focused") {
      // 간소화 버전: 핵심만
      return `## 카피라이팅 전략

공식: ${strategy.formula.name}
트리거: ${strategy.triggers.map(t => t.name).join(", ")}
스타일: ${strategy.style.name}`;
    }

    // comprehensive 또는 maximum: 전체 버전
    return this.strategyService.buildStrategyPrompt(strategy);
  }

  /**
   * 기존 방식: 레거시 템플릿
   */
  private buildLegacy(options: BuildPromptOptions): string {
    const category = options.intent.productName ?? options.rawPrompt;
    const examples = getExamplesByCategory(category);
    const fewShotSection = buildFewShotPrompt(examples);
    
    // 감정/시각 키워드 추가
    const emotionalSection = this.buildEmotionalGuidance(options.intent);
    
    const template = options.customTemplate ?? this.defaultTemplate;
    
    return template
      .replace(/{{\s*raw_prompt\s*}}/gi, options.rawPrompt)
      .replace(/{{\s*product_name\s*}}/gi, options.intent.productName ?? "")
      .replace(
        /{{\s*target_audience\s*}}/gi,
        options.intent.targetAudience ?? ""
      )
      .replace(/{{\s*tone\s*}}/gi, options.tone ?? "neutral")
      .replace(
        /{{\s*key_benefits\s*}}/gi,
        (options.intent.keyBenefits ?? []).join(", ")
      )
      .replace(
        /{{\s*call_to_action\s*}}/gi,
        options.intent.callToAction ?? ""
      )
      .replace(/{{\s*channel\s*}}/gi, options.intent.channel ?? "온라인 광고")
      .replace(/{{\s*min_chars\s*}}/gi, String(options.minChars))
      .replace(/{{\s*max_chars\s*}}/gi, String(options.maxChars))
      .replace(/{{\s*count\s*}}/gi, String(options.count))
      .replace(/{{\s*few_shot_examples\s*}}/gi, fewShotSection)
      .replace(/{{\s*emotional_guidance\s*}}/gi, emotionalSection)
      .replace(/{{\s*copy_principles\s*}}/gi, COPY_PRINCIPLES);
  }
  
  /**
   * 빠른 Few-shot 예시 섹션 생성
   */
  private buildQuickExamplesSection(examples: any[]): string {
    if (examples.length === 0) return "";
    
    let section = "\n## 참고 예시\n\n";
    examples.slice(0, 2).forEach((ex, idx) => {
      section += `예시 ${idx + 1}: "${ex.headline || ex.copy}"\n`;
      if (ex.description) {
        section += `→ ${ex.description}\n`;
      }
      section += "\n";
    });
    
    return section;
  }

  /**
   * 간결한 지시 (focused 모드)
   */
  private buildFocusedInstructions(
    options: BuildPromptOptions,
    strategy: any
  ): string {
    return `
## 작성 지시

제품: ${options.intent.productName ?? options.rawPrompt}
타겟: ${options.intent.targetAudience ?? "일반"}

**${strategy.formula.name} 공식:**
${this.getFormulaInstructionText(strategy.formula.name)}

**필수:**
- ${strategy.triggers[0]?.name ?? "감정"} 트리거
- 구체적 숫자/시간
- ${options.minChars}-${options.maxChars}자, ${options.count}개

{"copies": ["카피1", "카피2", ...]}
`.trim();
  }

  /**
   * 상세한 지시 (comprehensive/maximum 모드)
   */
  private buildDetailedInstructions(
    options: BuildPromptOptions,
    strategy: any
  ): string {
    // URL 분석 결과 섹션 추가
    let urlSection = "";
    if (options.intent.sourceUrl && options.intent.analyzedData) {
      urlSection = `

## 🌐 URL 분석 결과 (반드시 준수)

**원본 페이지:** ${options.intent.sourceUrl}
**제품/서비스:** ${options.intent.productName || "분석 필요"}
**타겟 고객:** ${options.intent.targetAudience || "분석 필요"}
**브랜드 톤:** ${options.intent.tone || "professional"}
**브랜드 보이스:** ${options.intent.analyzedData.brandVoice || "전문적"}

**페이지의 기존 카피 스타일 (이 톤을 유지하세요):**
${options.intent.analyzedData.existingCopies?.slice(0, 5).map((c, i) => `${i + 1}. "${c}"`).join('\n') || '분석된 카피 없음'}

**중요 지침:**
- 위 기존 카피들의 톤과 스타일을 분석하고 유지하세요
- 제품명 "${options.intent.productName || ''}"을 정확히 사용하세요
- 브랜드 보이스 "${options.intent.analyzedData.brandVoice || ''}"를 반영하세요
- 레퍼런스가 제공되더라도 URL 분석 결과를 우선시하세요
`;
    }
    
    return `
## 작성 지시
${urlSection}

제품: ${options.intent.productName ?? options.rawPrompt}
타겟: ${options.intent.targetAudience ?? "일반"}
USP: ${(options.intent.keyBenefits ?? []).slice(0, 3).join(", ")}

**${strategy.formula.name} 공식 적용:**
${this.getFormulaInstructionText(strategy.formula.name)}

**필수 요소:**
- ${strategy.triggers[0]?.name ?? "감정"} 트리거 활용
${strategy.triggers[1] ? `- ${strategy.triggers[1].name} 트리거 활용` : ""}
- 구체적 숫자/시간 포함 (예: "7일", "92%", "3분")
- 감각적 표현 사용
- ${strategy.style.name} 스타일 철학 반영
- ${options.minChars}-${options.maxChars}자, ${options.count}개

**금지:**
- "최고의", "완벽한", "놀라운" 등 진부한 표현
- 추상적 표현
- 과장

원본 요청: ${options.rawPrompt}

{"copies": ["카피1", "카피2", ...]} 형식만
`.trim();
  }


  /**
   * 실제 광고 레퍼런스 섹션 생성 (LLM 모델에 정확히 전달)
   */
  private buildAdReferenceSection(references: AdReference[]): string {
    const top5 = references.slice(0, 5); // 상위 5개만 사용

    const referenceExamples = top5
      .map((ref, idx) => {
        // 제목과 설명을 명확히 구분하여 전달
        const headline = ref.headline || ref.adCopy?.substring(0, 60) || "";
        const description = ref.description || "";
        const fullCopy = ref.adCopy || `${headline} ${description}`.trim();
        
        return `
예시 ${idx + 1} [실제 ${ref.platform.toUpperCase()} 광고]:
- 제목: "${headline}"
${description ? `- 설명: "${description}"` : ""}
- 전체 카피: "${fullCopy}"
- 플랫폼: ${ref.platform}
- 분석: ${ref.analysis?.formula ?? "AIDA"} 공식, 트리거: ${ref.analysis?.triggers?.join(", ") ?? "없음"}
- 글자수: ${ref.analysis?.charCount ?? fullCopy.length}자
- 톤: ${ref.analysis?.tone ?? "neutral"}
${ref.url ? `- URL: ${ref.url}` : ""}
`.trim();
      })
      .join("\n\n");

    const section = `
## 실제 집행 중인 광고 레퍼런스 (최근 90일 이내 - 참고용)

**⚠️ 중요: 아래 레퍼런스는 참고용입니다. 사용자가 명시한 요구사항을 절대적으로 우선시하세요.**

다음은 현재 실제로 집행되고 있는 유사한 광고들입니다:

${referenceExamples}

### 레퍼런스 활용 가이드 (필수 준수)
**절대적 우선순위:**
1. ✅ 사용자가 명시한 제품명, 타겟, 톤, 키워드 등을 **그대로 반영**
2. ✅ 사용자 요구사항이 레퍼런스와 다르면 **사용자 요구사항 우선**

**레퍼런스 활용 방법:**
3. ✅ 성과가 좋은 광고의 **구조와 트리거**를 참고하여 유사한 패턴 적용
4. ✅ 레퍼런스의 **구조나 스타일**을 창의적으로 응용
5. ✅ 동일한 카테고리에서 효과적인 표현 방식 학습
6. ❌ 레퍼런스의 **내용을 그대로 복사하지 않음**
7. ❌ 사용자 요구사항과 **무관한 레퍼런스는 무시**

**핵심 원칙: 사용자 입력(100%) > 레퍼런스(참고용)**
`.trim();
    
    // 디버깅: 생성된 섹션 확인
    console.log(`  📝 레퍼런스 섹션 생성 완료 (${section.length}자)`);
    console.log(`  📊 레퍼런스 개수: ${top5.length}개`);
    
    return section;
  }

  /**
   * 감정/시각 키워드 가이던스 생성
   */
  private buildEmotionalGuidance(intent: IntentData): string {
    const sections: string[] = [];
    
    if (intent.emotionalTriggers && intent.emotionalTriggers.length > 0) {
      sections.push(`감정 유발: ${intent.emotionalTriggers.join(", ")}`);
    }
    
    if (intent.visualImagery && intent.visualImagery.length > 0) {
      sections.push(`시각적 이미지: ${intent.visualImagery.join(", ")}`);
    }
    
    if (intent.storytellingAngle) {
      sections.push(`스토리텔링 각도: ${intent.storytellingAngle}`);
    }
    
    return sections.length > 0 ? sections.join("\n") : "창의적이고 감성적으로 작성";
  }

  buildGuidelines(intent: IntentData, tone: string): Array<{
    title: string;
    description: string;
  }> {
    const guidelines: Array<{ title: string; description: string }> = [];

    if (intent.keyBenefits?.length) {
      guidelines.push({
        title: "상품 강점 강조",
        description: intent.keyBenefits.join(", "),
      });
    }

    if (intent.keywords?.length) {
      guidelines.push({
        title: "핵심 키워드",
        description: intent.keywords.join(", "),
      });
    }

    if (intent.callToAction) {
      guidelines.push({
        title: "CTA",
        description: intent.callToAction,
      });
    }

    if (intent.additionalNotes?.length) {
      guidelines.push({
        title: "추가 참고 사항",
        description: intent.additionalNotes.join(", "),
      });
    }

    guidelines.push({
      title: "톤 & 스타일",
      description: `전체적인 톤은 ${tone} 의도를 반영합니다.`,
    });

    return guidelines;
  }

  private get defaultTemplate(): string {
    return `당신은 20년 경력의 세계 최고 수준 한국어 광고 카피라이터입니다.

{{copy_principles}}

{{few_shot_examples}}

[카피 생성 목표]
- 아래 정보를 바탕으로 창의적이고 효과적인 광고 카피를 작성합니다.
- 각 카피는 {{min_chars}}자 이상 {{max_chars}}자 이하로 작성합니다.
- 총 {{count}}개의 서로 다른 스타일의 카피를 생성합니다.
- 진부한 표현("최고의", "완벽한", "혁신적")을 절대 사용하지 않습니다.

[핵심 정보]
- 제품/서비스: {{product_name}}
- 타겟 고객: {{target_audience}}
- 원하는 톤: {{tone}}
- 주요 USP: {{key_benefits}}
- 추천 CTA: {{call_to_action}}
- 광고 채널: {{channel}}

[창의성 가이던스]
{{emotional_guidance}}

[사용자 원본 요청]
{{raw_prompt}}

[작성 시 필수 사항]
1. 각 카피는 서로 다른 관점과 메시지를 가져야 합니다
2. 구체적인 베네핏과 감정을 표현합니다
3. 한 번에 이해 가능하고 행동을 유도합니다
4. 브랜드 톤과 타겟에 정확히 맞춥니다

[출력 형식]
{"copies": ["카피1", "카피2", ...]}

JSON 객체만 반환하고, 추가 설명이나 마크다운은 금지합니다.`;
  }
}

