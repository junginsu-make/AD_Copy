/**
 * 프로덕션 환경용 광고 레퍼런스 수집 서비스
 * MCP 없이 직접 API 호출로 실제 광고 데이터 수집
 * 개선: HTML 파싱 추가, 품질 필터링 강화, Perplexity 통합
 */

// Node.js 환경에서 File 객체 polyfill
if (typeof global !== 'undefined' && typeof global.File === 'undefined') {
  (global as any).File = class File {
    constructor(bits: any[], name: string, options?: any) {
      return new Blob(bits, options);
    }
  };
}

import axios from 'axios';
import * as cheerio from 'cheerio';
import type { IntentData } from "./intent-extraction-service";
import { PerplexityAdReferenceService } from "./perplexity-ad-reference-service";
import { db } from "@/src/infrastructure/database";
import { adReferences as adReferencesTable } from "@/src/infrastructure/database/schema";
import { eq, and } from "drizzle-orm";

export interface AdReference {
  id: string;
  platform: "meta" | "google" | "naver" | "kakao";
  adCopy: string;
  headline?: string;
  description?: string;
  url?: string;
  imageUrl?: string;
  category: string;
  targetAudience?: string;
  collectedAt: Date;
  engagement?: {
    impressions?: number;
    clicks?: number;
    ctr?: number;
  };
  analysis?: {
    formula?: string;
    triggers?: string[];
    tone?: string;
    charCount: number;
  };
}

export interface AdReferenceSearchOptions {
  keywords?: string[];
  platform?: AdReference["platform"][];
  limit?: number;
  freshnessDays?: number;
}

export class ProductionAdReferenceService {
  private readonly DEFAULT_FRESHNESS_DAYS = 90;
  private readonly firecrawlApiKey = process.env.FIRECRAWL_API_KEY;
  private readonly naverClientId = process.env.NAVER_CLIENT_ID || process.env.NAVER_ACCESS_LICENSE;
  private readonly naverClientSecret = process.env.NAVER_CLIENT_SECRET || process.env.NAVER_SECRET_KEY;
  private readonly googleAdsClientId = process.env.GOOGLE_ADS_INSTALLED_CLIENT_ID;
  
  // Perplexity 서비스 (지연 초기화)
  private perplexityService: PerplexityAdReferenceService | null = null;

  /**
   * 의도 기반 유사 광고 검색 (병렬 수집: 네이버 + 구글 + Perplexity)
   */
  async findSimilarAds(
    intent: IntentData,
    options?: { freshnessDays?: number; limit?: number }
  ): Promise<AdReference[]> {
    // 키워드 추출 개선: intent에서 키워드 추출 + 프롬프트에서도 추출
    const keywords = [
      intent.productName,
      intent.targetAudience,
      ...(intent.keywords ?? []),
    ].filter(Boolean) as string[];
    
    // 키워드가 없으면 프롬프트에서 추출 시도
    if (keywords.length === 0) {
      // 제품명이나 타겟에서 키워드 추출
      if (intent.productName) {
        // 제품명에서 주요 단어 추출
        const productWords = intent.productName.split(/[\s,，、]/).filter(w => w.length > 1);
        keywords.push(...productWords.slice(0, 3));
      }
      // 분석된 데이터에서 키워드 추출
      if (intent.analyzedData?.keyFeatures) {
        keywords.push(...intent.analyzedData.keyFeatures.slice(0, 3));
      }
    }
    
    console.log("\n🔍 광고 레퍼런스 병렬 수집 시작 (네이버 + 구글 + Perplexity)");
    console.log("  - 제품명:", intent.productName || "없음");
    console.log("  - 타겟:", intent.targetAudience || "없음");
    console.log("  - 키워드:", keywords.length > 0 ? keywords : "없음 - 전체 검색 진행");
    console.log("  - 신선도:", options?.freshnessDays ?? this.DEFAULT_FRESHNESS_DAYS, "일");
    console.log("  - 수집 목표:", Math.max(options?.limit ?? 50, 50), "개");
    
    // 키워드가 없어도 검색 진행 (전체 검색)
    let ads: AdReference[] = [];
    try {
      ads = await this.searchAllPlatformsParallel({
        keywords: keywords.length > 0 ? keywords : ["광고", "프로모션"], // 키워드 없으면 일반 검색
        limit: Math.max(options?.limit ?? 50, 50), // 최소 50개 이상 수집
        freshnessDays: options?.freshnessDays ?? this.DEFAULT_FRESHNESS_DAYS,
      });
      
      console.log("  - 총 수집:", ads.length, "개");
    } catch (error) {
      console.error("  - 실시간 수집 실패:", error);
      // 실패 시 빈 배열 반환
      return [];
    }
    
    // 의도 기반 필터링 (사용자 의도에 맞는 광고만 선택)
    const relevantAds = this.filterByIntent(ads, intent, keywords);
    console.log("  - 의도 필터링 후:", relevantAds.length, "개");
    
    // 중복 제거
    const uniqueAds = this.deduplicateAds(relevantAds);
    
    // 프롬프트용은 적게, DB 저장용은 많이
    const displayLimit = Math.min(options?.limit ?? 20, 20); // 프롬프트에는 최대 20개
    const finalAds = uniqueAds.slice(0, displayLimit);
    
    console.log("  - 최종 결과:", finalAds.length, "개 (중복 제거 후)");
    if (finalAds.length > 0) {
      // 플랫폼별 개수 표시
      const platformCount = finalAds.reduce((acc, ad) => {
        acc[ad.platform] = (acc[ad.platform] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      console.log("  - 플랫폼별:");
      Object.entries(platformCount).forEach(([platform, count]) => {
        console.log(`    * ${platform}: ${count}개`);
      });
      
      // 샘플 출력
      console.log("  - 샘플 광고:");
      finalAds.slice(0, 3).forEach((ad, idx) => {
        console.log(`    ${idx + 1}. [${ad.platform}] ${ad.headline?.substring(0, 40)}...`);
      });

      // DB에 저장 (실시간 업데이트용 - uniqueAds 전체 저장)
      // 프롬프트에는 적게 사용하지만, DB에는 많이 저장하여 누적
      await this.saveAdsToDatabase(uniqueAds, intent);
    } else {
      console.log("    ⚠️ 광고 레퍼런스를 수집하지 못했습니다.");
    }
    
    return finalAds;
  }

  /**
   * 의도 기반 필터링 - 사용자 의도에 맞는 광고만 선택
   */
  private filterByIntent(
    ads: AdReference[],
    intent: IntentData,
    keywords: string[]
  ): AdReference[] {
    if (keywords.length === 0) {
      // 키워드가 없으면 모두 반환
      return ads;
    }

    return ads.filter(ad => {
      const adText = `${ad.headline || ''} ${ad.adCopy} ${ad.description || ''}`.toLowerCase();
      
      // 키워드 중 하나라도 포함하면 관련성 있음
      const hasKeyword = keywords.some(keyword => 
        adText.includes(keyword.toLowerCase())
      );
      
      if (hasKeyword) {
        return true;
      }
      
      // 타겟 고객이 일치하면 관련성 있음
      if (intent.targetAudience) {
        const targetWords = intent.targetAudience.split(/[\s,，、]/);
        const hasTarget = targetWords.some(word => 
          word.length > 1 && adText.includes(word.toLowerCase())
        );
        if (hasTarget) {
          return true;
        }
      }
      
      // 톤이 일치하면 관련성 있음
      if (intent.tone) {
        const toneKeywords: Record<string, string[]> = {
          emotional: ['감성', '특별', '소중', '행복', '느껴'],
          urgent: ['오늘', '지금', '마감', '한정', '특가'],
          premium: ['프리미엄', '럭셔리', '품격', '고급'],
          professional: ['전문', '신뢰', '검증', '인증'],
        };
        
        const toneKws = toneKeywords[intent.tone] || [];
        const hasTone = toneKws.some(kw => adText.includes(kw));
        if (hasTone) {
          return true;
        }
      }
      
      return false;
    });
  }

  /**
   * 중복 광고 제거
   */
  private deduplicateAds(ads: AdReference[]): AdReference[] {
    const seen = new Set<string>();
    return ads.filter(ad => {
      const key = ad.headline?.toLowerCase() || ad.adCopy.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * 모든 플랫폼에서 광고 검색 (병렬: 네이버 + 구글 + Perplexity)
   */
  async searchAllPlatformsParallel(
    options: AdReferenceSearchOptions
  ): Promise<AdReference[]> {
    const allAds: AdReference[] = [];
    
    // Perplexity 서비스 초기화 (지연 초기화)
    if (!this.perplexityService) {
      try {
        this.perplexityService = new PerplexityAdReferenceService();
        console.log("✅ Perplexity 서비스 초기화 완료");
      } catch (error) {
        console.warn("⚠️ Perplexity 서비스 초기화 실패 (API 키 없음):", error);
        this.perplexityService = null;
      }
    }

    // 병렬로 각 플랫폼 검색 (네이버, 구글, Perplexity)
    const searchPromises: Promise<AdReference[]>[] = [];
    
    // 네이버 검색
    searchPromises.push(
      this.searchNaverAds(options).catch(error => {
        console.error("네이버 광고 수집 실패:", error);
        return [];
      })
    );
    
    // 구글 검색
    searchPromises.push(
      this.searchGoogleAds(options).catch(error => {
        console.error("구글 광고 수집 실패:", error);
        return [];
      })
    );
    
    // Perplexity 검색 (API 키가 있는 경우만) - 독립적인 광고 소스
    if (this.perplexityService && this.perplexityService.isConfigured()) {
      // Perplexity는 독립적인 광고 소스 (최신 트렌드와 사례)
      searchPromises.push(
        this.perplexityService.searchAdReferences({
          keywords: options.keywords,
          limit: 30, // Perplexity만의 독립 수집
          freshnessDays: options.freshnessDays,
          targetPlatform: "all" // 독립적인 검색
        }).catch(error => {
          console.error(`Perplexity 광고 수집 실패:`, error);
          return [];
        })
      );
    } else {
      console.log("⚠️ Perplexity 검색 건너뜀 (API 키 없음 또는 초기화 실패)");
    }

    // 모든 검색 결과를 병렬로 대기
    const results = await Promise.all(searchPromises);
    
    // 플랫폼별 수집 결과 로그
    console.log("\n📊 플랫폼별 수집 결과:");
    console.log(`  - 네이버 직접: ${results[0]?.length || 0}개`);
    console.log(`  - 구글 직접: ${results[1]?.length || 0}개`);
    console.log(`  - Perplexity 독립: ${results[2]?.length || 0}개`);
    
    // 모든 결과 병합
    for (const platformAds of results) {
      if (platformAds && platformAds.length > 0) {
        allAds.push(...platformAds);
      }
    }

    console.log(`  - 병합 전 총합: ${allAds.length}개\n`);

    // 품질 필터링 (너무 짧거나 UI 요소 제외)
    const qualityFiltered = this.filterByQuality(allAds);

    // 신선도 필터링
    const freshAds = this.filterByFreshness(
      qualityFiltered,
      options.freshnessDays ?? this.DEFAULT_FRESHNESS_DAYS
    );

    return freshAds;
  }
  
  /**
   * 모든 플랫폼에서 광고 검색 (레거시 메서드 - 호환성 유지)
   */
  async searchAllPlatforms(
    options: AdReferenceSearchOptions
  ): Promise<AdReference[]> {
    // 새로운 병렬 수집 메서드로 위임
    return this.searchAllPlatformsParallel(options);
  }

  /**
   * Naver 검색광고 수집 (Firecrawl 사용 - 개선: HTML 파싱 추가)
   */
  async searchNaverAds(options: AdReferenceSearchOptions): Promise<AdReference[]> {
    const { keywords = [], limit = 30 } = options; // 기본 30개로 증가
    
    if (!this.firecrawlApiKey) {
      console.warn("Firecrawl API 키가 설정되지 않았습니다.");
      return [];
    }

    try {
      const searchQuery = keywords.join(" ");
      const searchUrl = `https://search.naver.com/search.naver?query=${encodeURIComponent(searchQuery)}`;
      
      // Firecrawl API로 Naver 검색 결과 스크래핑 (HTML 포함)
      const response = await axios.post(
        'https://api.firecrawl.dev/v0/scrape',
        {
          url: searchUrl,
          formats: ['markdown', 'html'],
          onlyMainContent: false, // 파워링크는 사이드에 있을 수 있음
          waitFor: 3000
        },
        {
          headers: {
            'Authorization': `Bearer ${this.firecrawlApiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      // 응답 구조 확인
      if (!response.data) {
        console.warn("Naver 광고: 응답 데이터 없음");
        return [];
      }

      const markdown = response.data?.data?.markdown || response.data?.markdown || "";
      const html = response.data?.data?.html || response.data?.html || "";
      
      if (!markdown && !html) {
        console.warn("Naver 광고: 마크다운/HTML 데이터 없음");
        return [];
      }

      console.log(`Naver 광고: 마크다운 ${markdown.length}자, HTML ${html.length}자 수집`);

      // HTML 우선 파싱 (더 정확함), 없으면 마크다운
      let ads: AdReference[] = [];
      if (html && html.length > 1000) {
        ads = this.parseNaverAdsFromHTML(html, limit * 3); // 더 많이 수집
        console.log(`Naver HTML 파싱: ${ads.length}개 추출`);
      }
      
      // 마크다운 파싱도 시도 (HTML이 부족하거나 실패한 경우)
      if (ads.length < limit && markdown && markdown.length > 100) {
        const markdownAds = this.parseNaverAdsFromMarkdown(markdown, (limit * 3) - ads.length);
        console.log(`Naver 마크다운 파싱: ${markdownAds.length}개 추가 추출`);
        ads.push(...markdownAds);
      }

      // 품질 필터링 적용 (더 관대한 필터링)
      const qualityAds = this.filterByQuality(ads);
      
      console.log(`Naver 광고: 원본 ${ads.length}개 → 품질 필터링 후 ${qualityAds.length}개`);
      
      // 필터링 결과가 너무 적으면 필터링 완화
      if (qualityAds.length === 0 && ads.length > 0) {
        console.log(`  ⚠️ 품질 필터링이 너무 엄격함. 필터링 완화 적용...`);
        const relaxedAds = this.filterByQualityRelaxed(ads);
        console.log(`  ✅ 완화된 필터링: ${relaxedAds.length}개`);
        return relaxedAds.slice(0, limit);
      }
      
      return qualityAds.slice(0, limit);
    } catch (error: any) {
      console.error("Naver 광고 수집 실패:", {
        message: error.message,
        status: error.response?.status
      });
      return [];
    }
  }

  /**
   * Google 광고 수집 (Firecrawl 사용 - 개선: HTML 파싱 추가)
   */
  async searchGoogleAds(options: AdReferenceSearchOptions): Promise<AdReference[]> {
    const { keywords = [], limit = 30 } = options; // 기본 30개로 증가
    
    if (!this.firecrawlApiKey) {
      console.warn("Firecrawl API 키가 설정되지 않았습니다.");
      return [];
    }

    try {
      // 검색 쿼리 개선: 광고 관련 키워드 추가
      const baseKeywords = keywords.join(" ");
      const searchQuery = `${baseKeywords} 광고 마케팅 홍보`;
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}&num=30`; // 결과 30개 요청
      
      console.log(`  Google 검색 쿼리: "${searchQuery}"`);
      
      // Firecrawl API로 Google 검색 결과 스크래핑 (HTML 포함)
      const response = await axios.post(
        'https://api.firecrawl.dev/v0/scrape',
        {
          url: searchUrl,
          formats: ['markdown', 'html'],
          onlyMainContent: false, // 광고는 사이드에 있을 수 있음
          waitFor: 5000, // 광고 로딩 충분히 대기
          includeTags: ['div', 'span', 'a'], // 광고 관련 태그 포함
        },
        {
          headers: {
            'Authorization': `Bearer ${this.firecrawlApiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      // 응답 구조 확인
      if (!response.data) {
        console.warn("Google 광고: 응답 데이터 없음");
        return [];
      }

      const markdown = response.data?.data?.markdown || response.data?.markdown || "";
      const html = response.data?.data?.html || response.data?.html || "";
      
      if (!markdown && !html) {
        console.warn("Google 광고: 마크다운/HTML 데이터 없음");
        return [];
      }

      console.log(`Google 광고: 마크다운 ${markdown.length}자, HTML ${html.length}자 수집`);

      // HTML 우선 파싱 (더 정확함), 없으면 마크다운
      let ads: AdReference[] = [];
      if (html && html.length > 1000) {
        ads = this.parseGoogleAdsFromHTML(html, limit * 3); // 더 많이 수집
        console.log(`Google HTML 파싱: ${ads.length}개 추출`);
      }
      
      // 마크다운 파싱도 시도 (HTML이 부족하거나 실패한 경우)
      if (ads.length < limit && markdown && markdown.length > 100) {
        const markdownAds = this.parseGoogleAdsFromMarkdown(markdown, (limit * 3) - ads.length);
        console.log(`Google 마크다운 파싱: ${markdownAds.length}개 추가 추출`);
        ads.push(...markdownAds);
      }

      // 품질 필터링 적용 (더 관대한 필터링)
      const qualityAds = this.filterByQuality(ads);
      
      console.log(`Google 광고: 원본 ${ads.length}개 → 품질 필터링 후 ${qualityAds.length}개`);
      
      // 필터링 결과가 너무 적으면 필터링 완화
      if (qualityAds.length === 0 && ads.length > 0) {
        console.log(`  ⚠️ 품질 필터링이 너무 엄격함. 필터링 완화 적용...`);
        const relaxedAds = this.filterByQualityRelaxed(ads);
        console.log(`  ✅ 완화된 필터링: ${relaxedAds.length}개`);
        return relaxedAds.slice(0, limit);
      }
      
      return qualityAds.slice(0, limit);
    } catch (error: any) {
      console.error("Google 광고 수집 실패:", {
        message: error.message,
        status: error.response?.status
      });
      return [];
    }
  }

  /**
   * Meta 광고 수집 (중단됨)
   * Meta Ad Library는 Firecrawl로 실제 광고 콘텐츠를 수집하지 못함 (UI만 수집됨)
   */
  async searchMetaAds(options: AdReferenceSearchOptions): Promise<AdReference[]> {
    // Meta 수집 중단 - 실제 광고 콘텐츠 수집 불가
    console.log("Meta 광고 수집 중단: 실제 광고 콘텐츠 수집 불가");
    return [];
  }

  /**
   * Google 광고 HTML 파싱 (개선: Cheerio 사용)
   */
  private parseGoogleAdsFromHTML(html: string, limit: number): AdReference[] {
    const ads: AdReference[] = [];
    
    try {
      const $ = cheerio.load(html);
      
      // Google 광고 영역 선택자들
      // 광고는 "Ad" 라벨이 있는 영역에 있음
      $('[data-text-ad], .uEierd, .commercial-unit').each((idx, elem) => {
        if (ads.length >= limit) return false;
        
        const $elem = $(elem);
        const headline = $elem.find('.v5yQqb, .LC20lb, h3').first().text().trim();
        const description = $elem.find('.MUxGbd, .VwiC3b, .s').first().text().trim();
        const url = $elem.find('a').first().attr('href') || '';
        
        // 광고 라벨 확인
        const hasAdLabel = $elem.text().includes('Ad') || 
                          $elem.text().includes('광고') || 
                          $elem.closest('[data-text-ad]').length > 0;
        
        if (hasAdLabel && headline.length > 5) {
          ads.push(this.createAdReference({
            headline: headline.substring(0, 60),
            description: description.substring(0, 150),
            url: url.startsWith('http') ? url : `https://www.google.com${url}`
          }, 'google'));
        }
      });
      
      // 마크다운에서도 추가 시도 (HTML 파싱이 부족한 경우)
      if (ads.length < limit) {
        const markdown = this.htmlToMarkdown(html);
        const markdownAds = this.parseGoogleAdsFromMarkdown(markdown, limit - ads.length);
        ads.push(...markdownAds);
      }
    } catch (error) {
      console.warn("Google HTML 파싱 실패, 마크다운으로 폴백:", error);
      const markdown = this.htmlToMarkdown(html);
      return this.parseGoogleAdsFromMarkdown(markdown, limit);
    }
    
    return ads;
  }

  /**
   * Google 광고 마크다운 파싱 (개선: 더 강화된 패턴 매칭)
   */
  private parseGoogleAdsFromMarkdown(markdown: string, limit: number): AdReference[] {
    const ads: AdReference[] = [];
    const lines = markdown.split('\n');
    
    // 패턴 1: "Ad" 또는 "광고" 라벨이 있는 섹션 찾기
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // 광고 라벨 확인 (더 다양한 패턴)
      const hasAdLabel = line.includes('Ad') || 
                         line.includes('광고') || 
                         line.includes('Sponsored') ||
                         line.includes('스폰서') ||
                         /^Ad\s*$/i.test(line);
      
      if (hasAdLabel) {
        // 다음 몇 줄에서 광고 정보 추출
        for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
          const nextLine = lines[j].trim();
          
          // 링크 패턴 찾기
          const linkMatch = nextLine.match(/\[([^\]]+)\]\(([^)]+)\)/);
          if (linkMatch) {
            const title = linkMatch[1].trim();
            const url = linkMatch[2];
            
            // 기본 필터링
            if (title.length > 5 && 
                !title.includes('YouTube') && 
                !title.includes('나무위키') &&
                !title.includes('answers') &&
                !title.includes('Wikipedia') &&
                !title.includes('위키백과')) {
              
              // 설명 찾기
              let description = '';
              for (let k = j + 1; k < Math.min(j + 5, lines.length); k++) {
                const descLine = lines[k].trim();
                if (descLine.length > 10 && 
                    !descLine.startsWith('http') && 
                    !descLine.startsWith('!') &&
                    !descLine.includes('About') &&
                    !descLine.includes('results') &&
                    !descLine.includes('People also')) {
                  description = descLine.substring(0, 150);
                  break;
                }
              }
              
              // 중복 확인
              const existing = ads.find(a => 
                a.headline?.toLowerCase() === title.toLowerCase() ||
                a.url === url
              );
              
              if (!existing) {
                ads.push(this.createAdReference({
                  headline: title.substring(0, 60),
                  description: description || '',
                  url: url
                }, 'google'));
                
                if (ads.length >= limit) break;
              }
              
              break; // 이 광고 처리 완료
            }
          }
        }
      }
      
      if (ads.length >= limit) break;
    }
    
    // 패턴 2: "Ad" 라벨 없이도 링크 패턴에서 광고 추출 (더 관대)
    if (ads.length < limit) {
      const linkPattern = /\[([^\]]{10,60})\]\(https?:\/\/(?!.*(youtube|wikipedia|naver|daum))[^)]+\)/g;
      let match;
      let matchCount = 0;
      
      while ((match = linkPattern.exec(markdown)) !== null && matchCount < limit * 2) {
        const title = match[1].trim();
        const url = match[2];
        
        // 기본 필터링
        if (title.length > 10 && 
            !title.includes('YouTube') && 
            !title.includes('나무위키') &&
            !title.includes('Wikipedia')) {
          
          // 중복 확인
          const existing = ads.find(a => 
            a.headline?.toLowerCase() === title.toLowerCase() ||
            a.url === url
          );
          
          if (!existing) {
            ads.push(this.createAdReference({
              headline: title.substring(0, 60),
              description: '',
              url: url
            }, 'google'));
            
            matchCount++;
            if (ads.length >= limit) break;
          }
        }
      }
    }
    
    return ads.slice(0, limit);
  }

  /**
   * Naver 광고 HTML 파싱 (개선: Cheerio 사용)
   */
  private parseNaverAdsFromHTML(html: string, limit: number): AdReference[] {
    const ads: AdReference[] = [];
    
    try {
      const $ = cheerio.load(html);
      
      // Naver 파워링크 광고 영역 선택
      $('.ad_area, .power_link, [class*="ad"]').each((idx, elem) => {
        if (ads.length >= limit) return false;
        
        const $elem = $(elem);
        const headline = $elem.find('.ad_tit, .power_link_title, a').first().text().trim();
        const description = $elem.find('.ad_dsc, .power_link_desc, .desc').first().text().trim();
        const url = $elem.find('a').first().attr('href') || '';
        
        // 파워링크 확인 (광고 키워드 포함)
        const isAd = $elem.text().includes('파워링크') || 
                    $elem.text().includes('광고') ||
                    $elem.hasClass('ad_area') ||
                    $elem.attr('class')?.includes('ad');
        
        // UI 요소 제외
        const isUIElement = headline.includes('메뉴') || 
                           headline.includes('도움말') ||
                           headline.includes('자동저장') ||
                           headline.includes('자세히') ||
                           headline.includes('로그인');
        
        if (isAd && !isUIElement && headline.length > 10) {
          ads.push(this.createAdReference({
            headline: headline.substring(0, 60),
            description: description.substring(0, 150),
            url: url.startsWith('http') ? url : `https://search.naver.com${url}`
          }, 'naver'));
        }
      });
      
      // 마크다운에서도 추가 시도
      if (ads.length < limit) {
        const markdown = this.htmlToMarkdown(html);
        const markdownAds = this.parseNaverAdsFromMarkdown(markdown, limit - ads.length);
        ads.push(...markdownAds);
      }
    } catch (error) {
      console.warn("Naver HTML 파싱 실패, 마크다운으로 폴백:", error);
      const markdown = this.htmlToMarkdown(html);
      return this.parseNaverAdsFromMarkdown(markdown, limit);
    }
    
    return ads;
  }

  /**
   * Naver 광고 마크다운 파싱 (개선: 더 강화된 패턴 매칭)
   */
  private parseNaverAdsFromMarkdown(markdown: string, limit: number): AdReference[] {
    const ads: AdReference[] = [];
    const lines = markdown.split('\n');
    
    // 패턴 1: 파워링크 관련 키워드 찾기
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // 파워링크 관련 키워드 (더 다양한 패턴)
      const hasPowerLink = line.includes('파워링크') || 
                          line.includes('파워 링크') ||
                          (line.includes('광고') && line.includes('naver.com')) ||
                          line.includes('네이버 광고');
      
      if (hasPowerLink) {
        // 다음 몇 줄에서 광고 정보 추출
        for (let j = i + 1; j < Math.min(i + 20, lines.length); j++) {
          const nextLine = lines[j].trim();
          
          // 링크 패턴 찾기
          const linkMatch = nextLine.match(/\[([^\]]+)\]\(([^)]+)\)/);
          if (linkMatch) {
            const title = linkMatch[1].trim();
            const url = linkMatch[2];
            
            // 기본 필터링 (더 관대)
            if (title.length > 5 && 
                !title.includes('메뉴') && 
                !title.includes('도움말') &&
                !title.includes('자동저장') &&
                !title.includes('자세히') &&
                !title.includes('로그인') &&
                !title.includes('레이어') &&
                !title.includes('영역') &&
                !title.includes('추천 검색어') &&
                url.includes('naver.com')) {
              
              // 설명 찾기
              let description = '';
              for (let k = j + 1; k < Math.min(j + 5, lines.length); k++) {
                const descLine = lines[k].trim();
                if (descLine.length > 10 && 
                    !descLine.startsWith('http') && 
                    !descLine.includes('메뉴') &&
                    !descLine.includes('도움말')) {
                  description = descLine.substring(0, 150);
                  break;
                }
              }
              
              // 중복 확인
              const existing = ads.find(a => 
                a.headline?.toLowerCase() === title.toLowerCase() ||
                a.url === url
              );
              
              if (!existing) {
                ads.push(this.createAdReference({
                  headline: title.substring(0, 60),
                  description: description || '',
                  url: url
                }, 'naver'));
                
                if (ads.length >= limit) break;
              }
              
              break; // 이 광고 처리 완료
            }
          }
        }
      }
      
      if (ads.length >= limit) break;
    }
    
    // 패턴 2: naver.com 링크에서 직접 추출 (더 관대)
    if (ads.length < limit) {
      const naverLinkPattern = /\[([^\]]{5,60})\]\((https?:\/\/[^)]*naver\.com[^)]*)\)/g;
      let match;
      let matchCount = 0;
      
      while ((match = naverLinkPattern.exec(markdown)) !== null && matchCount < limit * 2) {
        const title = match[1].trim();
        const url = match[2];
        
        // 기본 필터링
        if (title.length > 5 && 
            !title.includes('메뉴') && 
            !title.includes('도움말') &&
            !title.includes('자동저장')) {
          
          // 중복 확인
          const existing = ads.find(a => 
            a.headline?.toLowerCase() === title.toLowerCase() ||
            a.url === url
          );
          
          if (!existing) {
            ads.push(this.createAdReference({
              headline: title.substring(0, 60),
              description: '',
              url: url
            }, 'naver'));
            
            matchCount++;
            if (ads.length >= limit) break;
          }
        }
      }
    }
    
    return ads.slice(0, limit);
  }

  /**
   * HTML을 간단한 마크다운으로 변환 (폴백용)
   */
  private htmlToMarkdown(html: string): string {
    try {
      const $ = cheerio.load(html);
      // 간단한 변환: 텍스트만 추출
      return $('body').text();
    } catch {
      return '';
    }
  }

  /**
   * Meta 광고 마크다운 파싱
   */
  private parseMetaAdsFromMarkdown(markdown: string, limit: number): AdReference[] {
    const ads: AdReference[] = [];
    const sections = markdown.split(/\n---+\n/); // 섹션 구분
    
    for (const section of sections) {
      const lines = section.split('\n').filter(line => line.trim());
      if (lines.length < 2) continue;
      
      const ad: Partial<AdReference> = {
        headline: lines[0].substring(0, 60),
        description: lines.slice(1, 3).join(' ').substring(0, 150),
        adCopy: lines.join(' ').substring(0, 200)
      };
      
      // 이미지 URL 추출
      const imageMatch = section.match(/!\[.*?\]\((.*?)\)/);
      if (imageMatch) {
        ad.imageUrl = imageMatch[1];
      }
      
      ads.push(this.createAdReference(ad, 'meta'));
      
      if (ads.length >= limit) break;
    }
    
    return ads;
  }

  /**
   * AdReference 객체 생성 헬퍼
   */
  private createAdReference(
    partial: Partial<AdReference>,
    platform: AdReference['platform']
  ): AdReference {
    const adCopy = partial.adCopy || `${partial.headline} ${partial.description}`.trim();
    
    return {
      id: `${platform}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      platform,
      adCopy,
      headline: partial.headline || adCopy.substring(0, 30),
      description: partial.description || adCopy.substring(0, 100),
      url: partial.url,
      imageUrl: partial.imageUrl,
      category: "일반",
      targetAudience: this.inferTargetAudience(adCopy),
      collectedAt: new Date(),
      analysis: {
        charCount: adCopy.length,
        triggers: this.extractTriggers(adCopy),
        tone: this.analyzeTone(adCopy)
      }
    };
  }

  /**
   * 타겟 고객 추론
   */
  private inferTargetAudience(text: string): string {
    if (text.includes('여성') || text.includes('여자')) return "여성";
    if (text.includes('남성') || text.includes('남자')) return "남성";
    if (text.includes('아기') || text.includes('유아')) return "부모";
    if (text.includes('학생') || text.includes('수험')) return "학생";
    if (text.includes('시니어') || text.includes('노인')) return "시니어";
    return "일반";
  }

  /**
   * 심리적 트리거 추출
   */
  private extractTriggers(text: string): string[] {
    const triggers: string[] = [];
    
    if (text.includes('할인') || text.includes('세일')) triggers.push('할인');
    if (text.includes('무료') || text.includes('공짜')) triggers.push('무료');
    if (text.includes('한정') || text.includes('품절')) triggers.push('희소성');
    if (text.includes('인기') || text.includes('베스트')) triggers.push('사회적증명');
    if (text.includes('신제품') || text.includes('NEW')) triggers.push('새로움');
    if (text.includes('보장') || text.includes('환불')) triggers.push('보장');
    
    return triggers;
  }

  /**
   * 톤 분석
   */
  private analyzeTone(text: string): string {
    if (text.includes('!') || text.includes('지금')) return "urgent";
    if (text.includes('♥') || text.includes('사랑')) return "emotional";
    if (text.includes('%') || text.includes('원')) return "promotional";
    if (text.includes('프리미엄') || text.includes('명품')) return "premium";
    return "neutral";
  }

  /**
   * 광고 품질 필터링 완화 버전 (필터링이 너무 엄격할 때 사용)
   */
  private filterByQualityRelaxed(ads: AdReference[]): AdReference[] {
    return ads.filter((ad) => {
      const headline = ad.headline || '';
      const adCopy = ad.adCopy || '';
      
      // 최소 길이만 체크 (매우 완화: 2자 이상)
      if (headline.length < 2 || adCopy.length < 3) {
        return false;
      }
      
      // 명확한 UI 요소만 제외
      const criticalUIKeywords = ['메뉴', '도움말', '자동저장', '로그인'];
      const lowerHeadline = headline.toLowerCase();
      
      for (const keyword of criticalUIKeywords) {
        if (lowerHeadline.includes(keyword.toLowerCase())) {
          return false;
        }
      }
      
      return true;
    });
  }

  /**
   * 광고 품질 필터링 (개선: UI 요소 제외, 최소 길이, 이모지 제외 등)
   */
  private filterByQuality(ads: AdReference[]): AdReference[] {
    return ads.filter((ad) => {
      const headline = ad.headline || '';
      const description = ad.description || '';
      const adCopy = ad.adCopy || '';
      
      // 이모지 제거 (사용자 규칙 준수)
      const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F64F}\u{1F680}-\u{1F6FF}]/gu;
      
      if (emojiRegex.test(headline) || emojiRegex.test(adCopy)) {
        return false; // 이모지 포함 광고 제외
      }
      
      // 최소 길이 체크 (완화: 5자 → 3자)
      if (headline.length < 3 || adCopy.length < 5) {
        return false;
      }
      
      // UI 요소 제외 (핵심만)
      const uiKeywords = [
        '로그인', '레이어', '영역', 'Skip to', 'Accessibility',
        '자동저장', '메뉴', '도움말'
      ];
      
      const lowerHeadline = headline.toLowerCase();
      const lowerAdCopy = adCopy.toLowerCase();
      
      for (const keyword of uiKeywords) {
        if (lowerHeadline.includes(keyword.toLowerCase()) || 
            lowerAdCopy.includes(keyword.toLowerCase())) {
          return false;
        }
      }
      
      // "광고" 단어만 있는 경우만 제외 (다른 내용 있으면 OK)
      if (headline.trim() === '광고' || headline.trim() === 'Ad' || headline.trim() === '광고 더보기') {
        return false;
      }
      
      // 광고일 가능성이 있는 텍스트는 모두 허용 (완화)
      // 너무 짧은 텍스트 (3자 미만)만 제외
      return true; // 일단 모든 광고 허용 (UI 키워드 및 이모지만 제외)
    });
  }

  /**
   * 광고 신선도 필터링
   */
  private filterByFreshness(
    ads: AdReference[],
    freshnessDays: number
  ): AdReference[] {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - freshnessDays);
    
    return ads.filter((ad) => {
      return ad.collectedAt >= cutoffDate;
    });
  }

  /**
   * 수집한 광고를 adReferences 테이블에 저장 (실시간 업데이트용)
   */
  private async saveAdsToDatabase(
    ads: AdReference[],
    intent: IntentData
  ): Promise<void> {
    let saved = 0;
    let duplicates = 0;
    let errors = 0;

    console.log(`\n  💾 광고 레퍼런스 DB 저장 시작 (${ads.length}개 처리)...`);

    for (const ad of ads) {
      try {
        // 중복 체크
        const existing = await db
          .select({ id: adReferencesTable.id })
          .from(adReferencesTable)
          .where(
            and(
              eq(adReferencesTable.platform, ad.platform),
              eq(adReferencesTable.adCopy, ad.adCopy)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          duplicates++;
          continue;
        }

        // 자동 분석
        const analysis = this.analyzeAdCopy(ad.adCopy);

        // DB에 저장
        await db.insert(adReferencesTable).values({
          platform: ad.platform,
          adCopy: ad.adCopy,
          headline: ad.headline || null,
          description: ad.description || null,
          category: ad.category || intent.productName || "일반",
          industry: null,
          targetAudience: intent.targetAudience || null,
          brand: null,
          keywords: [
            ...(intent.keywords || []),
            intent.productName,
            intent.targetAudience
          ].filter(Boolean),
          copywritingFormula: analysis.formula,
          psychologicalTriggers: analysis.triggers,
          tone: analysis.tone,
          charCount: ad.adCopy.length,
          performanceScore: "0.5",
          qualityRating: 0,
          usageCount: 0,
          successCount: 0,
          sourceUrl: ad.url || null,
          collectedVia: "auto-collection",
          collectedAt: ad.collectedAt,
          status: "active",
          isPremium: false,
        });

        saved++;
      } catch (error) {
        errors++;
        // 에러는 로그만 남기고 계속 진행
        if (errors <= 3) { // 처음 3개 에러만 표시
          console.warn(`    광고 저장 실패: ${ad.adCopy.substring(0, 30)}`);
        }
      }
    }

    console.log(`  ✅ DB 저장 완료: ${saved}개 저장, ${duplicates}개 중복, ${errors}개 오류`);
    console.log(`  📊 누적 광고 레퍼런스: 기존 + ${saved}개`);
  }

  /**
   * 광고 문구 자동 분석
   */
  private analyzeAdCopy(adCopy: string): {
    formula: string;
    triggers: string[];
    tone: string;
  } {
    const triggers: string[] = [];
    
    // 긴급성
    if (/오늘|지금|마감|한정|품절/i.test(adCopy)) {
      triggers.push("긴급성");
    }
    
    // 희소성
    if (/단\s*\d+|한정|독점|특별/i.test(adCopy)) {
      triggers.push("희소성");
    }
    
    // 사회적 증명
    if (/\d+만|\d+%|1위|베스트|인기/i.test(adCopy)) {
      triggers.push("사회적 증명");
    }
    
    // 톤 분석
    let tone = "neutral";
    if (/느껴보세요|경험|특별한|소중한/i.test(adCopy)) {
      tone = "emotional";
    } else if (/할인|특가|이벤트/i.test(adCopy)) {
      tone = "urgent";
    } else if (/프리미엄|럭셔리|품격/i.test(adCopy)) {
      tone = "premium";
    }
    
    // 공식 추정
    let formula = "AIDA";
    if (/\d+%|\d+배/i.test(adCopy)) {
      formula = "FAB";
    }
    
    return { formula, triggers, tone };
  }
}
