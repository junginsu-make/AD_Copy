import { LLMProviderFactory } from "@/src/infrastructure/ai/llm-provider-factory";
import { GeminiVisionProvider } from "@/src/infrastructure/ai/gemini-vision-provider";
import type { IntentData } from "./intent-extraction-service";

/**
 * 고급 URL 분석 서비스
 * 
 * Playwright MCP를 활용하여 텍스트 + 이미지 + 스크린샷을 모두 수집하고
 * Gemini 2.5 Flash의 멀티모달 기능으로 종합 분석
 */
export class AdvancedUrlAnalysisService {
  private readonly providerFactory = LLMProviderFactory.getInstance();
  private readonly geminiVision = new GeminiVisionProvider();

  /**
   * URL 종합 분석 (텍스트 + 이미지 + 스크린샷)
   */
  async analyzeUrl(url: string): Promise<IntentData> {
    console.log(`\n🔍 고급 URL 분석 시작: ${url}`);
    
    try {
      // 1단계: Playwright MCP로 페이지 스크랩 (텍스트 + 이미지)
      const scrapedData = await this.scrapeUrlWithPlaywright(url);
      
      // 2단계: Gemini 2.5 Flash로 멀티모달 분석
      const intent = await this.analyzeWithGeminiVision(scrapedData, url);
      
      console.log(`✅ URL 분석 완료`);
      return intent;
      
    } catch (error) {
      console.error("고급 URL 분석 실패, 폴백 모드로 전환:", error);
      
      // 폴백: 기본 URL 분석
      return this.fallbackAnalysis(url);
    }
  }

  /**
   * Playwright MCP를 사용한 페이지 스크래핑
   * - 페이지 텍스트 추출
   * - 이미지 URL 수집
   * - 페이지 스크린샷 캡처
   */
  private async scrapeUrlWithPlaywright(url: string): Promise<{
    text: string;
    title: string;
    images: string[];
    screenshot?: string; // base64
  }> {
    console.log("  📄 Playwright로 페이지 스크래핑 중...");
    
    try {
      // Playwright MCP 사용 가능 여부 확인
      const playwrightAvailable = typeof (globalThis as any).mcp_Playwright_browser_navigate === "function";
      
      if (playwrightAvailable) {
        // Playwright MCP로 페이지 열기
        await (globalThis as any).mcp_Playwright_browser_navigate({ url });
        
        // 페이지 로딩 대기
        await (globalThis as any).mcp_Playwright_browser_wait_for({ time: 3 });
        
        // 페이지 스냅샷 (텍스트 추출)
        const snapshot = await (globalThis as any).mcp_Playwright_browser_snapshot();
        
        // 스크린샷 캡처
        const screenshotResult = await (globalThis as any).mcp_Playwright_browser_take_screenshot({
          filename: `url-analysis-${Date.now()}.png`,
          fullPage: false // 첫 화면만
        });
        
        // 이미지 추출 (JavaScript 실행)
        const imagesScript = `
          Array.from(document.querySelectorAll('img')).map(img => img.src)
        `;
        const imagesResult = await (globalThis as any).mcp_Playwright_browser_evaluate({
          function: imagesScript
        });
        
        // 페이지 닫기
        await (globalThis as any).mcp_Playwright_browser_close();
        
        console.log("  ✅ Playwright 스크래핑 완료");
        console.log(`    - 텍스트: ${snapshot.text?.length || 0}자`);
        console.log(`    - 이미지: ${imagesResult?.length || 0}개`);
        
        return {
          text: snapshot.text || "",
          title: snapshot.title || "",
          images: Array.isArray(imagesResult) ? imagesResult.filter(Boolean).slice(0, 5) : [],
          screenshot: screenshotResult?.base64
        };
      }
      
      // Playwright 없으면 Firecrawl MCP 시도
      return await this.scrapeWithFirecrawl(url);
      
    } catch (error) {
      console.warn("  ⚠️ Playwright 스크래핑 실패, Firecrawl로 폴백:", error);
      return await this.scrapeWithFirecrawl(url);
    }
  }

  /**
   * Firecrawl MCP를 사용한 스크래핑 (폴백)
   */
  private async scrapeWithFirecrawl(url: string): Promise<{
    text: string;
    title: string;
    images: string[];
    screenshot?: string;
  }> {
    console.log("  📄 Firecrawl로 페이지 스크래핑 중...");
    
    try {
      const firecrawlAvailable = typeof (globalThis as any).mcp_firecrawl_scrape === "function";
      
      if (firecrawlAvailable) {
        const result = await (globalThis as any).mcp_firecrawl_scrape({
          url,
          formats: ["markdown", "links"],
          onlyMainContent: true,
          maxAge: 3600000 // 1시간 캐시
        });
        
        // 이미지 URL 추출 (마크다운에서)
        const imageRegex = /!\[.*?\]\((.*?)\)/g;
        const images: string[] = [];
        let match;
        while ((match = imageRegex.exec(result.markdown || "")) !== null) {
          images.push(match[1]);
        }
        
        console.log("  ✅ Firecrawl 스크래핑 완료");
        console.log(`    - 텍스트: ${result.markdown?.length || 0}자`);
        console.log(`    - 이미지: ${images.length}개`);
        
        return {
          text: result.markdown || "",
          title: result.metadata?.title || "",
          images: images.slice(0, 5)
        };
      }
      
      // 둘 다 없으면 기본 fetch
      return await this.scrapeWithFetch(url);
      
    } catch (error) {
      console.warn("  ⚠️ Firecrawl 스크래핑 실패, fetch로 폴백:", error);
      return await this.scrapeWithFetch(url);
    }
  }

  /**
   * 기본 fetch를 사용한 스크래핑 (최종 폴백)
   */
  private async scrapeWithFetch(url: string): Promise<{
    text: string;
    title: string;
    images: string[];
    screenshot?: string;
  }> {
    console.log("  📄 기본 fetch로 페이지 가져오기...");
    
    const response = await fetch(url);
    const html = await response.text();
    
    // HTML에서 텍스트 추출
    const text = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    
    // 제목 추출
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : "";
    
    // 이미지 URL 추출
    const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
    const images: string[] = [];
    let match;
    while ((match = imgRegex.exec(html)) !== null) {
      images.push(match[1]);
    }
    
    console.log("  ✅ 기본 fetch 완료");
    console.log(`    - 텍스트: ${text.length}자`);
    console.log(`    - 이미지: ${images.length}개`);
    
    return {
      text,
      title,
      images: images.slice(0, 5)
    };
  }

  /**
   * Gemini 2.5 Flash 멀티모달 분석
   * 텍스트 + 이미지 + 스크린샷을 모두 활용하여 정확한 의도 파악
   */
  private async analyzeWithGeminiVision(
    scrapedData: {
      text: string;
      title: string;
      images: string[];
      screenshot?: string;
    },
    url: string
  ): Promise<IntentData> {
    console.log("  🤖 Gemini 2.5 Flash 멀티모달 분석 시작...");
    
    // 스크린샷이 있으면 이미지 분석, 없으면 텍스트만 분석
    if (scrapedData.screenshot) {
      console.log("    - 스크린샷 + 텍스트 통합 분석");
      
      const analysisResult = await this.geminiVision.analyzeImage({
        imageBase64: scrapedData.screenshot,
        mimeType: "image/png",
        additionalPrompt: `이 웹페이지 스크린샷과 함께 제공되는 텍스트를 분석하여 광고 카피 생성에 필요한 정보를 추출하세요.

**페이지 제목:** ${scrapedData.title}
**URL:** ${url}

**페이지 텍스트 내용:**
${scrapedData.text.slice(0, 4000)}

**추출할 정보 (JSON 형식):**
{
  "productName": "제품/서비스명",
  "targetAudience": "타겟 고객층 (연령, 성별, 특성)",
  "tone": "브랜드 톤 (casual/formal/luxury/professional)",
  "keyBenefits": ["핵심 베네핏1", "핵심 베네핏2", "핵심 베네핏3"],
  "callToAction": "주요 CTA",
  "keywords": ["핵심 키워드"],
  "emotionalTriggers": ["유발하려는 감정"],
  "visualImagery": ["시각적 이미지 키워드 - 스크린샷에서 추출"],
  "storytellingAngle": "브랜드 스토리 각도",
  "designStyle": "디자인 스타일 (스크린샷 기반)",
  "colorScheme": "주요 컬러 (스크린샷 기반)",
  "analyzedData": {
    "existingCopies": ["페이지의 실제 카피들"],
    "brandVoice": "브랜드 보이스 설명",
    "keyFeatures": ["제품 주요 특징"],
    "priceRange": "가격대"
  }
}

**특히 주목할 점:**
1. 스크린샷의 시각적 요소 (색상, 디자인, 이미지)
2. 페이지에 사용된 실제 카피 스타일
3. 타겟 고객층 (시각적 + 텍스트 종합 판단)
4. 브랜드의 차별화 포인트`
      });
      
      return this.parseGeminiAnalysis(analysisResult, url);
      
    } else {
      // 스크린샷 없으면 텍스트만 분석
      console.log("    - 텍스트 전용 분석");
      return await this.analyzeTextOnly(scrapedData, url);
    }
  }

  /**
   * 텍스트만으로 분석 (스크린샷 없을 때)
   */
  private async analyzeTextOnly(
    scrapedData: { text: string; title: string; images: string[] },
    url: string
  ): Promise<IntentData> {
    const provider = this.providerFactory.resolve("gemini-2.5-flash");
    
    const prompt = `웹페이지 내용을 분석하여 광고 카피 생성에 필요한 정보를 JSON으로 추출하세요.

**페이지 정보:**
- 제목: ${scrapedData.title}
- URL: ${url}
- 이미지 개수: ${scrapedData.images.length}개

**텍스트 내용:**
${scrapedData.text.slice(0, 6000)}

**출력 JSON 형식:**
{
  "productName": "제품/서비스명",
  "targetAudience": "타겟 고객",
  "tone": "casual|formal|luxury|professional",
  "keyBenefits": ["베네핏1", "베네핏2", "베네핏3"],
  "callToAction": "CTA",
  "keywords": ["키워드"],
  "emotionalTriggers": ["감정"],
  "visualImagery": ["시각 키워드"],
  "storytellingAngle": "스토리 각도",
  "analyzedData": {
    "existingCopies": ["실제 카피"],
    "brandVoice": "브랜드 보이스",
    "keyFeatures": ["특징"],
    "priceRange": "가격대"
  }
}`;

    const response = await provider.generateCopies({
      prompt,
      minChars: 100,
      maxChars: 2000,
      count: 1,
      creativeGuidelines: [],
    });
    
    const jsonText = response.copies[0] ?? "{}";
    return this.parseJsonAnalysis(jsonText, url);
  }

  /**
   * Gemini Vision 분석 결과 파싱
   */
  private parseGeminiAnalysis(analysisResult: any, url: string): IntentData {
    try {
      // Gemini Vision 응답에서 JSON 추출
      const jsonMatch = analysisResult.analysis?.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn("Gemini Vision 응답에 JSON 없음, 텍스트 분석 시도");
        return this.extractIntentFromText(analysisResult.analysis || "", url);
      }
      
      return this.parseJsonAnalysis(jsonMatch[0], url);
      
    } catch (error) {
      console.error("Gemini Vision 분석 파싱 실패:", error);
      return {
        sourceUrl: url,
        lengthVariety: "mixed"
      };
    }
  }

  /**
   * JSON 분석 결과 파싱
   */
  private parseJsonAnalysis(jsonText: string, url: string): IntentData {
    try {
      const cleaned = jsonText
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "")
        .trim();
      
      const parsed = JSON.parse(cleaned);
      
      const toStringArray = (value: unknown): string[] => {
        if (Array.isArray(value)) {
          return value.map((item) => String(item).trim()).filter(Boolean);
        }
        return [];
      };
      
      console.log("  ✅ 의도 분석 완료:");
      console.log(`    - 제품: ${parsed.productName}`);
      console.log(`    - 타겟: ${parsed.targetAudience}`);
      console.log(`    - 톤: ${parsed.tone}`);
      
      return {
        productName: parsed.productName,
        targetAudience: parsed.targetAudience,
        tone: parsed.tone,
        keyBenefits: toStringArray(parsed.keyBenefits),
        callToAction: parsed.callToAction,
        channel: parsed.channel,
        keywords: toStringArray(parsed.keywords),
        emotionalTriggers: toStringArray(parsed.emotionalTriggers),
        visualImagery: toStringArray(parsed.visualImagery),
        storytellingAngle: parsed.storytellingAngle,
        sourceUrl: url,
        analyzedData: parsed.analyzedData,
        lengthVariety: "mixed",
      };
    } catch (error) {
      console.error("JSON 파싱 실패:", error);
      console.error("원본 텍스트:", jsonText.substring(0, 500));
      
      return {
        sourceUrl: url,
        lengthVariety: "mixed"
      };
    }
  }

  /**
   * 텍스트에서 의도 추출 (JSON 파싱 실패 시)
   */
  private extractIntentFromText(text: string, url: string): IntentData {
    // 간단한 텍스트 분석으로 폴백
    return {
      sourceUrl: url,
      lengthVariety: "mixed",
      analyzedData: {
        rawAnalysis: text.substring(0, 1000)
      }
    };
  }

  /**
   * 폴백 분석 (모든 고급 방법 실패 시)
   */
  private async fallbackAnalysis(url: string): Promise<IntentData> {
    console.log("  🔄 폴백 모드: 기본 URL 분석");
    
    try {
      const response = await fetch(url);
      const html = await response.text();
      
      const text = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 2000);
      
      const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : "";
      
      return {
        productName: title,
        sourceUrl: url,
        lengthVariety: "mixed",
        analyzedData: {
          pagePreview: text
        }
      };
      
    } catch (error) {
      console.error("폴백 분석도 실패:", error);
      return {
        sourceUrl: url,
        lengthVariety: "mixed"
      };
    }
  }
}

