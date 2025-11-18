/**
 * Firecrawl API 테스트용 엔드포인트
 * 실제 Firecrawl API 호출 결과를 확인하여 레퍼런스 수집 가능 여부 판단
 */

import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const platform = searchParams.get("platform") || "google"; // google, meta, naver
    const keyword = searchParams.get("keyword") || "스킨케어";
    const verbose = searchParams.get("verbose") === "true"; // 상세 로그 여부

    const firecrawlApiKey = process.env.FIRECRAWL_API_KEY;

    if (!firecrawlApiKey) {
      return NextResponse.json(
        {
          success: false,
          error: "FIRECRAWL_API_KEY가 설정되지 않았습니다.",
          hint: ".env 또는 .env.local 파일에 FIRECRAWL_API_KEY를 확인하세요."
        },
        { status: 400 }
      );
    }

    console.log(`\n=== Firecrawl 테스트 시작 ===`);
    console.log(`플랫폼: ${platform}`);
    console.log(`키워드: ${keyword}`);
    console.log(`API 키: ${firecrawlApiKey.substring(0, 10)}...`);

    let result: any = {};

    switch (platform) {
      case "google":
        result = await testGoogleAds(firecrawlApiKey, keyword, verbose);
        break;
      case "meta":
        result = await testMetaAds(firecrawlApiKey, keyword, verbose);
        break;
      case "naver":
        result = await testNaverAds(firecrawlApiKey, keyword, verbose);
        break;
      default:
        return NextResponse.json(
          {
            success: false,
            error: "지원하지 않는 플랫폼입니다. (google, meta, naver 중 선택)",
          },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      platform,
      keyword,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (error: any) {
    console.error("Firecrawl 테스트 실패:", error);
    return NextResponse.json(
      {
        success: false,
        error: "테스트 중 오류가 발생했습니다.",
        details: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * Google 광고 테스트
 */
async function testGoogleAds(
  apiKey: string,
  keyword: string,
  verbose: boolean
) {
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(keyword)}`;
  
  console.log(`\n[Google] 검색 URL: ${searchUrl}`);

  try {
    const response = await axios.post(
      "https://api.firecrawl.dev/v0/scrape",
      {
        url: searchUrl,
        formats: ["markdown", "html"],
        onlyMainContent: false, // 전체 내용 확인
        waitFor: 3000, // 광고 로딩 대기
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 30000, // 30초 타임아웃
      }
    );

    console.log(`[Google] 응답 상태: ${response.status}`);
    console.log(`[Google] 응답 데이터 키:`, Object.keys(response.data || {}));

    // 응답 구조 확인
    const responseData = response.data;
    const markdown = responseData?.data?.markdown || responseData?.markdown || "";
    const html = responseData?.data?.html || responseData?.html || "";
    const rawContent = responseData?.data?.content || responseData?.content || "";

    console.log(`[Google] 마크다운 길이: ${markdown.length}자`);
    console.log(`[Google] HTML 길이: ${html.length}자`);

    // 광고 관련 키워드 검색
    const adKeywords = ["광고", "Ad", "Sponsored", "Advertisement", "추천"];
    const foundKeywords = adKeywords.filter((kw) => 
      markdown.toLowerCase().includes(kw.toLowerCase()) ||
      html.toLowerCase().includes(kw.toLowerCase())
    );

    // 마크다운 샘플 추출 (처음 500자)
    const markdownSample = markdown.substring(0, 500);
    const htmlSample = html.substring(0, 500);

    return {
      apiCall: "success",
      url: searchUrl,
      responseStatus: response.status,
      dataStructure: {
        hasData: !!responseData,
        hasMarkdown: !!markdown,
        hasHtml: !!html,
        markdownLength: markdown.length,
        htmlLength: html.length,
        dataKeys: responseData ? Object.keys(responseData) : [],
      },
      adDetection: {
        foundKeywords,
        adKeywordCount: foundKeywords.length,
        hasAdContent: foundKeywords.length > 0,
      },
      samples: verbose
        ? {
            markdown: markdownSample,
            html: htmlSample,
            fullResponse: responseData,
          }
        : {
            markdown: markdownSample,
            html: htmlSample,
          },
      analysis: {
        canParse: markdown.length > 100,
        recommendation: markdown.length > 100 
          ? "마크다운 파싱 가능. 광고 추출 로직 구현 필요"
          : "마크다운 데이터 부족. 다른 형식 확인 필요",
      },
    };
  } catch (error: any) {
    console.error("[Google] API 호출 실패:", error.message);
    return {
      apiCall: "failed",
      error: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      responseData: error.response?.data,
    };
  }
}

/**
 * Meta 광고 테스트
 */
async function testMetaAds(
  apiKey: string,
  keyword: string,
  verbose: boolean
) {
  const adLibraryUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=KR&q=${encodeURIComponent(keyword)}`;
  
  console.log(`\n[Meta] 광고 라이브러리 URL: ${adLibraryUrl}`);

  try {
    const response = await axios.post(
      "https://api.firecrawl.dev/v0/scrape",
      {
        url: adLibraryUrl,
        formats: ["markdown", "html"],
        onlyMainContent: false,
        waitFor: 5000, // Meta는 더 오래 로딩됨
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 45000, // 45초 타임아웃
      }
    );

    console.log(`[Meta] 응답 상태: ${response.status}`);
    console.log(`[Meta] 응답 데이터 키:`, Object.keys(response.data || {}));

    const responseData = response.data;
    const markdown = responseData?.data?.markdown || responseData?.markdown || "";
    const html = responseData?.data?.html || responseData?.html || "";

    console.log(`[Meta] 마크다운 길이: ${markdown.length}자`);
    console.log(`[Meta] HTML 길이: ${html.length}자`);

    // 광고 관련 키워드 검색
    const adKeywords = ["광고", "Ad", "Sponsored", "Advertisement", "라이브러리"];
    const foundKeywords = adKeywords.filter((kw) => 
      markdown.toLowerCase().includes(kw.toLowerCase()) ||
      html.toLowerCase().includes(kw.toLowerCase())
    );

    const markdownSample = markdown.substring(0, 500);
    const htmlSample = html.substring(0, 500);

    return {
      apiCall: "success",
      url: adLibraryUrl,
      responseStatus: response.status,
      dataStructure: {
        hasData: !!responseData,
        hasMarkdown: !!markdown,
        hasHtml: !!html,
        markdownLength: markdown.length,
        htmlLength: html.length,
        dataKeys: responseData ? Object.keys(responseData) : [],
      },
      adDetection: {
        foundKeywords,
        adKeywordCount: foundKeywords.length,
        hasAdContent: foundKeywords.length > 0,
      },
      samples: verbose
        ? {
            markdown: markdownSample,
            html: htmlSample,
            fullResponse: responseData,
          }
        : {
            markdown: markdownSample,
            html: htmlSample,
          },
      analysis: {
        canParse: markdown.length > 100,
        recommendation: markdown.length > 100 
          ? "마크다운 파싱 가능. 광고 추출 로직 구현 필요"
          : "마크다운 데이터 부족. HTML 파싱 고려 필요",
      },
    };
  } catch (error: any) {
    console.error("[Meta] API 호출 실패:", error.message);
    return {
      apiCall: "failed",
      error: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      responseData: error.response?.data,
    };
  }
}

/**
 * Naver 광고 테스트
 */
async function testNaverAds(
  apiKey: string,
  keyword: string,
  verbose: boolean
) {
  const searchUrl = `https://search.naver.com/search.naver?query=${encodeURIComponent(keyword)}`;
  
  console.log(`\n[Naver] 검색 URL: ${searchUrl}`);

  try {
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
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    console.log(`[Naver] 응답 상태: ${response.status}`);
    console.log(`[Naver] 응답 데이터 키:`, Object.keys(response.data || {}));

    const responseData = response.data;
    const markdown = responseData?.data?.markdown || responseData?.markdown || "";
    const html = responseData?.data?.html || responseData?.html || "";

    console.log(`[Naver] 마크다운 길이: ${markdown.length}자`);
    console.log(`[Naver] HTML 길이: ${html.length}자`);

    // 파워링크 관련 키워드 검색
    const adKeywords = ["파워링크", "광고", "Ad", "Sponsored", "추천"];
    const foundKeywords = adKeywords.filter((kw) => 
      markdown.toLowerCase().includes(kw.toLowerCase()) ||
      html.toLowerCase().includes(kw.toLowerCase())
    );

    const markdownSample = markdown.substring(0, 500);
    const htmlSample = html.substring(0, 500);

    return {
      apiCall: "success",
      url: searchUrl,
      responseStatus: response.status,
      dataStructure: {
        hasData: !!responseData,
        hasMarkdown: !!markdown,
        hasHtml: !!html,
        markdownLength: markdown.length,
        htmlLength: html.length,
        dataKeys: responseData ? Object.keys(responseData) : [],
      },
      adDetection: {
        foundKeywords,
        adKeywordCount: foundKeywords.length,
        hasAdContent: foundKeywords.length > 0,
      },
      samples: verbose
        ? {
            markdown: markdownSample,
            html: htmlSample,
            fullResponse: responseData,
          }
        : {
            markdown: markdownSample,
            html: htmlSample,
          },
      analysis: {
        canParse: markdown.length > 100,
        recommendation: markdown.length > 100 
          ? "마크다운 파싱 가능. 파워링크 영역 추출 로직 구현 필요"
          : "마크다운 데이터 부족. HTML 파싱 고려 필요",
      },
    };
  } catch (error: any) {
    console.error("[Naver] API 호출 실패:", error.message);
    return {
      apiCall: "failed",
      error: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      responseData: error.response?.data,
    };
  }
}

