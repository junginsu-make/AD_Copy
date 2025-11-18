import { LLMProviderFactory } from "@/src/infrastructure/ai/llm-provider-factory";
import type { IntentData } from "./intent-extraction-service";
import { AdvancedWebScraper } from "@/src/infrastructure/scraping/advanced-scraper";
import Anthropic from "@anthropic-ai/sdk";

/**
 * URL 분석 서비스
 * 웹페이지를 크롤링하고 분석하여 광고 카피 생성에 필요한 정보 추출
 * 
 * 핵심 개선: Claude Sonnet 4.5 사용으로 정확도 대폭 향상
 */
export class UrlAnalysisService {
  private readonly providerFactory = LLMProviderFactory.getInstance();
  private readonly scraper = new AdvancedWebScraper();
  private claudeClient: Anthropic | null = null;

  constructor() {
    // Claude 클라이언트 초기화 (URL 분석용 고성능 모델)
    if (process.env.ANTHROPIC_API_KEY) {
      this.claudeClient = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
    }
  }

  /**
   * URL로부터 제품/서비스 정보 추출
   */
  async analyzeUrl(url: string): Promise<IntentData> {
    // 1. 웹페이지 크롤링
    const pageContent = await this.scrapeUrl(url);

    // 2. GPT-5로 페이지 분석
    const analysisIntent = await this.extractFromPage(pageContent, url);
    
    // 3. 스크래핑된 제목을 analyzedData에 포함
    if (!analysisIntent.analyzedData) {
      analysisIntent.analyzedData = {};
    }
    analysisIntent.analyzedData.title = pageContent.title;

    return analysisIntent;
  }

  /**
   * 고급 스크래퍼를 사용한 웹페이지 크롤링
   */
  private async scrapeUrl(url: string): Promise<{
    markdown: string;
    html: string;
    title: string;
    images?: Array<{ src: string; alt: string; text?: string }>;
    metadata?: any;
  }> {
    try {
      console.log(`\n🌐 URL 분석 시작: ${url}`);
      
      // 고급 스크래퍼 사용
      const result = await this.scraper.scrapeUrl(url);
      
      console.log(`  ✅ 스크래핑 완료:`);
      console.log(`    - 제목: ${result.title}`);
      console.log(`    - 마크다운: ${result.markdown.length}자`);
      console.log(`    - HTML: ${result.html.length}자`);
      console.log(`    - 이미지: ${result.images?.length || 0}개`);
      
      // 이미지에서 텍스트 추출 (alt 텍스트 활용)
      let imageTexts = '';
      if (result.images && result.images.length > 0) {
        const altTexts = result.images
          .map(img => img.alt)
          .filter(alt => alt && alt.length > 5);
        
        if (altTexts.length > 0) {
          imageTexts = '\n\n## 이미지 설명\n' + altTexts.join('\n');
        }
      }
      
      return {
        markdown: result.markdown + imageTexts,
        html: result.html,
        title: result.title,
        images: result.images,
        metadata: result.metadata
      };
    } catch (error) {
      console.error("❌ URL 크롤링 실패:", error);
      
      // 최후의 폴백: 기본 fetch
      try {
        console.log("  🔄 기본 fetch로 재시도...");
        const response = await fetch(url);
        const html = await response.text();
        
        return {
          markdown: this.htmlToSimpleMarkdown(html),
          html,
          title: this.extractTitle(html),
        };
      } catch (fetchError) {
        throw new Error(
          `웹페이지를 불러올 수 없습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`
        );
      }
    }
  }

  /**
   * 페이지 내용으로부터 의도 추출 (Claude Sonnet 4.5 사용 - 정확도 대폭 향상)
   */
  private async extractFromPage(
    pageContent: { 
      markdown: string; 
      title: string;
      images?: Array<{ src: string; alt: string; title?: string; context?: string }>;
      links?: Array<string>;
      metadata?: any;
    },
    url: string
  ): Promise<IntentData> {
    // Claude Sonnet 4.5로 정확한 URL 분석
    console.log(`\n📊 URL 페이지 분석 시작 (Claude Sonnet 4.5)`);
    
    if (!this.claudeClient) {
      console.warn("❌ Claude API 키 없음, 폴백 분석 사용");
      return this.fallbackAnalysis(url, pageContent);
    }

    // 메타데이터에서 추가 정보 추출
    const metaDescription = pageContent.metadata?.description || pageContent.metadata?.ogDescription || '';
    const metaKeywords = pageContent.metadata?.keywords || '';
    const siteName = pageContent.metadata?.ogSiteName || '';
    
    // 크롤링 데이터 제한 해제 (더 많은 데이터 수집)
    const fullMarkdown = pageContent.markdown.slice(0, 30000); // 12,000 → 30,000자로 증가
    const allImages = pageContent.images?.slice(0, 30) || []; // 10개 → 30개로 증가
    
    console.log(`  - 본문 텍스트: ${fullMarkdown.length}자`);
    console.log(`  - 이미지: ${allImages.length}개`);
    console.log(`  - 메타데이터: ${Object.keys(pageContent.metadata || {}).length}개 필드`);
    
    const prompt = `당신은 20년 경력의 웹페이지 분석 및 광고 전략 전문가입니다.
다음 웹페이지의 **모든 정보**를 **빠짐없이** 종합하여 광고 카피 생성에 필요한 **매우 상세한** 정보를 추출하세요.

**핵심 원칙:**
1. 페이지에 실제로 존재하는 정보만 추출 (절대 추측 금지)
2. 모든 헤드라인, 슬로건, CTA, 버튼 텍스트를 빠짐없이 수집
3. 메타데이터, 본문, 이미지 alt 텍스트를 모두 활용
4. 브랜드 보이스와 톤을 정확히 파악
5. 경쟁사 대비 차별화 포인트 파악

## 📄 페이지 기본 정보
- **URL:** ${url}
- **제목:** ${pageContent.title}
- **사이트명:** ${siteName}
- **메타 설명:** ${metaDescription}
- **메타 키워드:** ${metaKeywords}

## 📝 페이지 전체 본문 내용 (${fullMarkdown.length}자)
${fullMarkdown}

## 🖼️ 이미지 정보 (총 ${allImages.length}개)
${allImages.map((img, idx) => 
  `${idx + 1}. Alt: "${img.alt || 'N/A'}" | Title: "${img.title || 'N/A'}" | Context: "${img.context?.substring(0, 150) || 'N/A'}"`
).join('\n') || '이미지 없음'}

## 🎯 추출할 정보 (JSON 형식으로 반환)

다음 구조로 **매우 상세하게** 추출하세요:

\`\`\`json
{
  "productName": "회사명 또는 주력 제품/서비스명",
  "targetAudience": "타겟 고객층 (연령, 성별, 직업, 관심사 등 구체적으로)",
  "tone": "professional|casual|formal|luxury|innovative (페이지 전반적인 톤)",
  "keyBenefits": [
    "핵심 혜택 1 - 페이지에서 강조하는 주요 가치",
    "핵심 혜택 2",
    "핵심 혜택 3",
    "... 최소 5개 이상"
  ],
  "callToAction": "페이지의 주요 CTA 문구 (버튼, 링크 텍스트)",
  "channel": "웹사이트 유형 (예: 기업 홈페이지, SaaS 랜딩페이지, 이커머스 등)",
  "keywords": [
    "핵심 키워드 1 - 페이지에서 반복되는 단어",
    "핵심 키워드 2",
    "... 최소 10개 이상"
  ],
  "emotionalTriggers": [
    "유발하려는 감정 1 (예: 혁신, 신뢰, 성장, 안정)",
    "감정 2",
    "... 최소 3개"
  ],
  "visualImagery": [
    "시각적 컨셉 1 (예: AI, 기술, 자연, 미래)",
    "컨셉 2",
    "... 최소 3개"
  ],
  "storytellingAngle": "브랜드가 전달하려는 스토리 각도 (상세히)",
  "analyzedData": {
    "existingCopies": [
      "페이지의 실제 헤드라인 1",
      "슬로건 2",
      "CTA 3",
      "... 모든 카피 수집 (최소 10개 이상)"
    ],
    "brandVoice": "브랜드 보이스 매우 상세 설명 (톤, 스타일, 특징 등)",
    "keyFeatures": [
      "제품/서비스 특징 1",
      "특징 2",
      "... 최소 7개 이상"
    ],
    "priceRange": "가격 정보 (있으면, 없으면 '정보 없음')",
    "competitorDifferentiation": "경쟁사 대비 차별화 포인트 (있으면)",
    "technicalDetails": "기술적 세부사항 (있으면)"
  }
}
\`\`\`

**분석 시 특히 주의할 점:**
- 모든 헤드라인, 서브헤드라인, 버튼 텍스트를 수집
- 페이지의 "어떻게" 설득하는지 톤 분석
- 타겟 고객이 "누구"인지 명확히 파악
- 브랜드가 "왜" 다른지 차별점 파악

## 출력 규칙 (매우 중요!)
1. 순수한 JSON만 반환 (코드블록 없이, 설명 없이)
2. **undefined 절대 사용 금지!** null 또는 빈 배열 사용
3. 모든 문자열 값은 쌍따옴표로 감싸기
4. confidence는 0.0~1.0 사이 숫자 (예: 0.95)

지금 바로 순수 JSON만 출력하세요:`;

    try {
      const startTime = Date.now();
      
      // Claude Sonnet 4.5 API 호출
      const response = await this.claudeClient.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 4096, // 상세한 분석을 위해 증가
        temperature: 0.3, // 정확한 분석
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      });

      const content = response.content[0];
      if (content.type !== "text") {
        console.warn("⚠️ Claude 응답이 텍스트가 아님");
        return this.fallbackAnalysis(url, pageContent);
      }

      let jsonText = content.text;
      const elapsedMs = Date.now() - startTime;
      
      console.log(`✅ URL 분석 완료 (${elapsedMs}ms)`);
      console.log(`📊 토큰 사용량: ${response.usage.input_tokens} 입력, ${response.usage.output_tokens} 출력`);
      
      // undefined를 null로 치환 (JSON 호환성)
      jsonText = jsonText.replace(/:\s*undefined\s*([,}])/g, ': null$1');
      
      const parsed = this.parseAnalysisResult(jsonText, url);
      
      // 분석 결과 상세 로깅
      console.log(`🎯 분석 결과 상세:`);
      console.log(`  - 제품명: ${parsed.productName || 'N/A'}`);
      console.log(`  - 타겟: ${parsed.targetAudience || 'N/A'}`);
      console.log(`  - 톤: ${parsed.tone || 'N/A'}`);
      console.log(`  - 키워드: ${parsed.keywords?.length || 0}개`);
      console.log(`  - 핵심 혜택: ${parsed.keyBenefits?.length || 0}개`);
      console.log(`  - 기존 카피: ${parsed.analyzedData?.existingCopies?.length || 0}개`);
      console.log(`  - 주요 특징: ${parsed.analyzedData?.keyFeatures?.length || 0}개`);
      
      return parsed;
      
    } catch (error) {
      console.error("❌ Claude URL 분석 실패:", error);
      return this.fallbackAnalysis(url, pageContent);
    }
  }

  /**
   * 분석 결과 파싱
   */
  private parseAnalysisResult(jsonText: string, url: string): IntentData {
    try {
      // 마크다운 코드블록 제거
      let cleaned = jsonText
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "")
        .trim();
      
      // JSON 객체 추출 시도 (전체 텍스트가 JSON이 아닐 수 있음)
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleaned = jsonMatch[0];
      }

      const parsed = JSON.parse(cleaned);

      const toStringArray = (value: unknown): string[] => {
        if (Array.isArray(value)) {
          return value.map((item) => String(item).trim()).filter(Boolean);
        }
        if (typeof value === "string" && value.trim()) {
          return value.split(/[\n,]/).map((v) => v.trim()).filter(Boolean);
        }
        return [];
      };

      const result: IntentData = {
        productName: parsed.productName || undefined,
        targetAudience: parsed.targetAudience || undefined,
        tone: parsed.tone || undefined,
        keyBenefits: toStringArray(parsed.keyBenefits),
        callToAction: parsed.callToAction || undefined,
        channel: parsed.channel || undefined,
        keywords: toStringArray(parsed.keywords),
        emotionalTriggers: toStringArray(parsed.emotionalTriggers),
        visualImagery: toStringArray(parsed.visualImagery),
        storytellingAngle: parsed.storytellingAngle || undefined,
        sourceUrl: url,
        analyzedData: parsed.analyzedData || {},
        lengthVariety: "mixed", // URL 분석 시 기본값
      };
      
      return result;
    } catch (error) {
      console.error("❌ URL 분석 결과 파싱 실패:", error);
      console.error("원본 응답:", jsonText.substring(0, 1000));
      return {
        sourceUrl: url,
        lengthVariety: "mixed",
        analyzedData: {},
      };
    }
  }

  /**
   * 간단한 HTML → Markdown 변환
   */
  private htmlToSimpleMarkdown(html: string): string {
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * HTML에서 title 추출
   */
  private extractTitle(html: string): string {
    const match = html.match(/<title[^>]*>(.*?)<\/title>/i);
    return match ? match[1].trim() : "";
  }
  
  /**
   * 폴백 분석 (Gemini 실패 시)
   */
  private fallbackAnalysis(url: string, pageContent: any): IntentData {
    console.log(`⚠️ 폴백 분석 사용`);
    
    // 메타데이터에서 최대한 추출
    const siteName = pageContent.metadata?.ogSiteName || pageContent.metadata?.siteName || pageContent.title;
    const description = pageContent.metadata?.description || pageContent.metadata?.ogDescription || '';
    const keywords = pageContent.metadata?.keywords?.split(',').map((k: string) => k.trim()) || [];
    
    // 마크다운에서 헤드라인 추출
    const headlines = pageContent.markdown.match(/^#{1,3}\s+(.+)$/gm)?.map((h: string) => h.replace(/^#+\s+/, '')) || [];
    
    return {
      productName: siteName,
      targetAudience: "기업 및 브랜드 마케터",  // 기본값
      tone: "professional",
      keyBenefits: description ? [description] : [],
      keywords: keywords.length > 0 ? keywords : ["마케팅", "브랜드"],
      sourceUrl: url,
      analyzedData: {
        title: pageContent.title,
        existingCopies: headlines.slice(0, 5),
        brandVoice: "전문적이고 혁신적인",
        keyFeatures: [],
      },
      lengthVariety: "mixed",
    };
  }
}

