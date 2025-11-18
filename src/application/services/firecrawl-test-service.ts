/**
 * Firecrawl API 테스트 및 개선된 광고 수집 서비스
 * 실제 Firecrawl API 응답을 분석하여 광고 레퍼런스를 수집
 */

import axios from "axios";

export interface TestResult {
  platform: string;
  keyword: string;
  success: boolean;
  dataCollected: boolean;
  adCount: number;
  ads: AdReference[];
  rawResponse?: any;
  error?: string;
  analysis: {
    canParse: boolean;
    recommendation: string;
    dataStructure: any;
  };
}

export interface AdReference {
  id: string;
  platform: "meta" | "google" | "naver";
  headline: string;
  description: string;
  adCopy: string;
  url?: string;
  imageUrl?: string;
  collectedAt: Date;
}

export class FirecrawlTestService {
  private readonly apiKey: string;

  constructor() {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      throw new Error("FIRECRAWL_API_KEY가 설정되지 않았습니다.");
    }
    this.apiKey = apiKey;
  }

  /**
   * 모든 플랫폼 테스트
   */
  async testAllPlatforms(keyword: string): Promise<TestResult[]> {
    const results: TestResult[] = [];

    // Google 테스트
    try {
      const googleResult = await this.testGoogle(keyword);
      results.push(googleResult);
    } catch (error: any) {
      results.push({
        platform: "google",
        keyword,
        success: false,
        dataCollected: false,
        adCount: 0,
        ads: [],
        error: error.message,
        analysis: {
          canParse: false,
          recommendation: "API 호출 실패. API 키 및 네트워크 확인 필요",
          dataStructure: {},
        },
      });
    }

    // Meta 테스트
    try {
      const metaResult = await this.testMeta(keyword);
      results.push(metaResult);
    } catch (error: any) {
      results.push({
        platform: "meta",
        keyword,
        success: false,
        dataCollected: false,
        adCount: 0,
        ads: [],
        error: error.message,
        analysis: {
          canParse: false,
          recommendation: "API 호출 실패. API 키 및 네트워크 확인 필요",
          dataStructure: {},
        },
      });
    }

    // Naver 테스트
    try {
      const naverResult = await this.testNaver(keyword);
      results.push(naverResult);
    } catch (error: any) {
      results.push({
        platform: "naver",
        keyword,
        success: false,
        dataCollected: false,
        adCount: 0,
        ads: [],
        error: error.message,
        analysis: {
          canParse: false,
          recommendation: "API 호출 실패. API 키 및 네트워크 확인 필요",
          dataStructure: {},
        },
      });
    }

    return results;
  }

  /**
   * Google 광고 테스트 및 수집
   */
  async testGoogle(keyword: string): Promise<TestResult> {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(keyword)}`;

    try {
      console.log(`[Firecrawl Test] Google 검색 시작: ${keyword}`);

      const response = await axios.post(
        "https://api.firecrawl.dev/v0/scrape",
        {
          url: searchUrl,
          formats: ["markdown", "html"],
          onlyMainContent: false,
          waitFor: 3000,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          timeout: 30000,
        }
      );

      const responseData = response.data;
      const markdown = responseData?.data?.markdown || responseData?.markdown || "";
      const html = responseData?.data?.html || responseData?.html || "";

      console.log(`[Firecrawl Test] Google 응답 수신: ${markdown.length}자 마크다운, ${html.length}자 HTML`);

      // 광고 추출 시도
      const ads = this.parseGoogleAds(markdown, html);

      return {
        platform: "google",
        keyword,
        success: true,
        dataCollected: markdown.length > 0 || html.length > 0,
        adCount: ads.length,
        ads,
        rawResponse: responseData,
        analysis: {
          canParse: ads.length > 0 || markdown.length > 100,
          recommendation:
            ads.length > 0
              ? `${ads.length}개 광고 추출 성공. 파싱 로직 정상 작동`
              : markdown.length > 100
              ? "데이터 수집 성공했으나 광고 추출 실패. 파싱 로직 개선 필요"
              : "데이터 수집 실패. 다른 방법 검토 필요",
          dataStructure: {
            hasMarkdown: !!markdown,
            hasHtml: !!html,
            markdownLength: markdown.length,
            htmlLength: html.length,
          },
        },
      };
    } catch (error: any) {
      console.error("[Firecrawl Test] Google 실패:", error.message);
      return {
        platform: "google",
        keyword,
        success: false,
        dataCollected: false,
        adCount: 0,
        ads: [],
        error: error.message,
        rawResponse: error.response?.data,
        analysis: {
          canParse: false,
          recommendation: `API 호출 실패: ${error.message}`,
          dataStructure: {},
        },
      };
    }
  }

  /**
   * Meta 광고 테스트 및 수집
   */
  async testMeta(keyword: string): Promise<TestResult> {
    const adLibraryUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=KR&q=${encodeURIComponent(keyword)}`;

    try {
      console.log(`[Firecrawl Test] Meta 광고 라이브러리 검색 시작: ${keyword}`);

      const response = await axios.post(
        "https://api.firecrawl.dev/v0/scrape",
        {
          url: adLibraryUrl,
          formats: ["markdown", "html"],
          onlyMainContent: false,
          waitFor: 5000,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          timeout: 45000,
        }
      );

      const responseData = response.data;
      const markdown = responseData?.data?.markdown || responseData?.markdown || "";
      const html = responseData?.data?.html || responseData?.html || "";

      console.log(`[Firecrawl Test] Meta 응답 수신: ${markdown.length}자 마크다운, ${html.length}자 HTML`);

      // 광고 추출 시도
      const ads = this.parseMetaAds(markdown, html);

      return {
        platform: "meta",
        keyword,
        success: true,
        dataCollected: markdown.length > 0 || html.length > 0,
        adCount: ads.length,
        ads,
        rawResponse: responseData,
        analysis: {
          canParse: ads.length > 0 || markdown.length > 100,
          recommendation:
            ads.length > 0
              ? `${ads.length}개 광고 추출 성공. 파싱 로직 정상 작동`
              : markdown.length > 100
              ? "데이터 수집 성공했으나 광고 추출 실패. 파싱 로직 개선 필요"
              : "데이터 수집 실패. Facebook Ad Library 접근 제한 가능성",
          dataStructure: {
            hasMarkdown: !!markdown,
            hasHtml: !!html,
            markdownLength: markdown.length,
            htmlLength: html.length,
          },
        },
      };
    } catch (error: any) {
      console.error("[Firecrawl Test] Meta 실패:", error.message);
      return {
        platform: "meta",
        keyword,
        success: false,
        dataCollected: false,
        adCount: 0,
        ads: [],
        error: error.message,
        rawResponse: error.response?.data,
        analysis: {
          canParse: false,
          recommendation: `API 호출 실패: ${error.message}`,
          dataStructure: {},
        },
      };
    }
  }

  /**
   * Naver 광고 테스트 및 수집
   */
  async testNaver(keyword: string): Promise<TestResult> {
    const searchUrl = `https://search.naver.com/search.naver?query=${encodeURIComponent(keyword)}`;

    try {
      console.log(`[Firecrawl Test] Naver 검색 시작: ${keyword}`);

      const response = await axios.post(
        "https://api.firecrawl.dev/v0/scrape",
        {
          url: searchUrl,
          formats: ["markdown", "html"],
          onlyMainContent: false,
          waitFor: 3000,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          timeout: 30000,
        }
      );

      const responseData = response.data;
      const markdown = responseData?.data?.markdown || responseData?.markdown || "";
      const html = responseData?.data?.html || responseData?.html || "";

      console.log(`[Firecrawl Test] Naver 응답 수신: ${markdown.length}자 마크다운, ${html.length}자 HTML`);

      // 광고 추출 시도
      const ads = this.parseNaverAds(markdown, html);

      return {
        platform: "naver",
        keyword,
        success: true,
        dataCollected: markdown.length > 0 || html.length > 0,
        adCount: ads.length,
        ads,
        rawResponse: responseData,
        analysis: {
          canParse: ads.length > 0 || markdown.length > 100,
          recommendation:
            ads.length > 0
              ? `${ads.length}개 광고 추출 성공. 파싱 로직 정상 작동`
              : markdown.length > 100
              ? "데이터 수집 성공했으나 광고 추출 실패. 파싱 로직 개선 필요"
              : "데이터 수집 실패. 다른 방법 검토 필요",
          dataStructure: {
            hasMarkdown: !!markdown,
            hasHtml: !!html,
            markdownLength: markdown.length,
            htmlLength: html.length,
          },
        },
      };
    } catch (error: any) {
      console.error("[Firecrawl Test] Naver 실패:", error.message);
      return {
        platform: "naver",
        keyword,
        success: false,
        dataCollected: false,
        adCount: 0,
        ads: [],
        error: error.message,
        rawResponse: error.response?.data,
        analysis: {
          canParse: false,
          recommendation: `API 호출 실패: ${error.message}`,
          dataStructure: {},
        },
      };
    }
  }

  /**
   * Google 광고 파싱 (개선된 로직)
   */
  private parseGoogleAds(markdown: string, html: string): AdReference[] {
    const ads: AdReference[] = [];

    // 방법 1: 마크다운에서 광고 패턴 찾기
    const markdownLines = markdown.split("\n");
    let currentAd: Partial<AdReference> | null = null;

    for (let i = 0; i < markdownLines.length; i++) {
      const line = markdownLines[i].trim();

      // 광고 표시 식별
      if (
        line.includes("광고") ||
        line.includes("Ad") ||
        line.includes("Sponsored") ||
        line.includes("Advertisement")
      ) {
        // 이전 광고 저장
        if (currentAd && currentAd.headline) {
          ads.push(this.createAdReference(currentAd, "google"));
        }
        // 새 광고 시작
        currentAd = {};
      } else if (currentAd) {
        // 제목 추출 (헤더나 링크)
        if (
          line.startsWith("#") ||
          line.startsWith("##") ||
          line.match(/^\[.*\]\(http/)
        ) {
          const headline = line
            .replace(/^#+\s*/, "")
            .replace(/\[([^\]]+)\].*/, "$1")
            .substring(0, 60);
          if (headline.length > 5) {
            currentAd.headline = headline;
          }
        }
        // 설명 추출 (일반 텍스트)
        else if (
          line.length > 20 &&
          !line.startsWith("http") &&
          !line.startsWith("!") &&
          !line.match(/^[0-9]+\./)
        ) {
          currentAd.description = (
            (currentAd.description || "") + " " + line
          ).trim().substring(0, 150);
        }
        // URL 추출
        else if (line.match(/https?:\/\//)) {
          const urlMatch = line.match(/(https?:\/\/[^\s)]+)/);
          if (urlMatch) {
            currentAd.url = urlMatch[1];
          }
        }
      }
    }

    // 마지막 광고 저장
    if (currentAd && currentAd.headline) {
      ads.push(this.createAdReference(currentAd, "google"));
    }

    // 방법 2: HTML에서 광고 찾기 (마크다운으로 충분하지 않을 때)
    if (ads.length === 0 && html.length > 0) {
      // HTML에서 광고 영역 추출 시도
      const adMatches = html.match(
        /<div[^>]*class="[^"]*ad[^"]*"[^>]*>.*?<\/div>/gis
      );
      if (adMatches) {
        for (const match of adMatches.slice(0, 5)) {
          const textContent = match
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
          if (textContent.length > 10) {
            ads.push({
              id: `google-${Date.now()}-${ads.length}`,
              platform: "google",
              headline: textContent.substring(0, 60),
              description: textContent.substring(0, 150),
              adCopy: textContent.substring(0, 200),
              collectedAt: new Date(),
            });
          }
        }
      }
    }

    return ads.slice(0, 10); // 최대 10개
  }

  /**
   * Meta 광고 파싱 (개선된 로직)
   */
  private parseMetaAds(markdown: string, html: string): AdReference[] {
    const ads: AdReference[] = [];

    // 마크다운에서 광고 카드 추출
    const sections = markdown.split(/\n---+\n|\n##+\s/);

    for (const section of sections) {
      const lines = section.split("\n").filter((l) => l.trim().length > 0);

      if (lines.length < 2) continue;

      // 첫 번째 줄이 제목일 가능성
      const headline = lines[0]
        .replace(/^#+\s*/, "")
        .replace(/\[([^\]]+)\].*/, "$1")
        .trim()
        .substring(0, 60);

      if (headline.length < 5) continue;

      // 나머지 줄에서 설명 추출
      const description = lines
        .slice(1, 4)
        .filter((l) => !l.startsWith("!") && !l.match(/^https?:\/\//))
        .join(" ")
        .trim()
        .substring(0, 150);

      // 이미지 URL 추출
      const imageMatch = section.match(/!\[.*?\]\((https?:\/\/[^)]+)\)/);
      const imageUrl = imageMatch ? imageMatch[1] : undefined;

      // URL 추출
      const urlMatch = section.match(/https?:\/\/[^\s)]+/);
      const url = urlMatch ? urlMatch[0] : undefined;

      ads.push({
        id: `meta-${Date.now()}-${ads.length}`,
        platform: "meta",
        headline,
        description: description || headline.substring(0, 100),
        adCopy: `${headline} ${description}`.trim().substring(0, 200),
        url,
        imageUrl,
        collectedAt: new Date(),
      });

      if (ads.length >= 10) break;
    }

    return ads;
  }

  /**
   * Naver 광고 파싱 (개선된 로직)
   */
  private parseNaverAds(markdown: string, html: string): AdReference[] {
    const ads: AdReference[] = [];

    // 마크다운에서 파워링크 영역 찾기
    const markdownLines = markdown.split("\n");

    for (let i = 0; i < markdownLines.length; i++) {
      const line = markdownLines[i].trim();

      // 파워링크 관련 키워드 확인
      if (
        line.includes("파워링크") ||
        line.includes("광고") ||
        line.match(/^\[.*\]\(http.*naver/)
      ) {
        // 다음 몇 줄이 광고 내용일 가능성
        const headline = line
          .replace(/\[([^\]]+)\].*/, "$1")
          .replace(/파워링크|광고/g, "")
          .trim()
          .substring(0, 60);

        if (headline.length < 5) continue;

        // 다음 줄에서 설명 추출
        let description = "";
        for (let j = i + 1; j < Math.min(i + 3, markdownLines.length); j++) {
          const nextLine = markdownLines[j].trim();
          if (
            nextLine.length > 10 &&
            !nextLine.startsWith("http") &&
            !nextLine.startsWith("!")
          ) {
            description += " " + nextLine;
          }
        }

        // URL 추출
        const urlMatch = line.match(/\((https?:\/\/[^)]+)\)/);
        const url = urlMatch ? urlMatch[1] : undefined;

        ads.push({
          id: `naver-${Date.now()}-${ads.length}`,
          platform: "naver",
          headline,
          description: description.trim().substring(0, 150) || headline.substring(0, 100),
          adCopy: `${headline} ${description}`.trim().substring(0, 200),
          url,
          collectedAt: new Date(),
        });

        if (ads.length >= 10) break;
      }
    }

    return ads;
  }

  /**
   * AdReference 객체 생성
   */
  private createAdReference(
    partial: Partial<AdReference>,
    platform: AdReference["platform"]
  ): AdReference {
    const adCopy = partial.adCopy || `${partial.headline} ${partial.description}`.trim();
    const headline = partial.headline || adCopy.substring(0, 30);
    const description = partial.description || adCopy.substring(0, 100);

    return {
      id: `${platform}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      platform,
      headline: headline.substring(0, 60),
      description: description.substring(0, 150),
      adCopy: adCopy.substring(0, 200),
      url: partial.url,
      imageUrl: partial.imageUrl,
      collectedAt: new Date(),
    };
  }
}

