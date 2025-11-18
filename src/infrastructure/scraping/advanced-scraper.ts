import * as cheerio from 'cheerio';

/**
 * 고급 웹 스크래핑 서비스
 * Playwright, Puppeteer, Firecrawl 등 다양한 방법을 사용
 */
export class AdvancedWebScraper {
  /**
   * URL을 스크래핑하여 텍스트와 이미지 정보 추출
   */
  async scrapeUrl(url: string): Promise<{
    markdown: string;
    html: string;
    title: string;
    images: Array<{
      src: string;
      alt: string;
      text?: string; // OCR로 추출된 텍스트
    }>;
    metadata: {
      description?: string;
      keywords?: string;
      ogImage?: string;
      author?: string;
    };
  }> {
    console.log(`🔍 고급 스크래핑 시작: ${url}`);
    
    // 1. Playwright MCP 시도
    const playwrightResult = await this.tryPlaywright(url);
    if (playwrightResult) {
      return playwrightResult;
    }
    
    // 2. Firecrawl API 시도
    const firecrawlResult = await this.tryFirecrawl(url);
    if (firecrawlResult) {
      return firecrawlResult;
    }
    
    // 3. Puppeteer Chrome DevTools 시도
    const puppeteerResult = await this.tryPuppeteer(url);
    if (puppeteerResult) {
      return puppeteerResult;
    }
    
    // 4. 기본 fetch 폴백
    return await this.basicFetch(url);
  }
  
  /**
   * Playwright MCP를 사용한 스크래핑
   */
  private async tryPlaywright(url: string): Promise<any> {
    try {
      // Playwright MCP가 사용 가능한지 확인
      if (typeof (globalThis as any).mcp_Playwright_browser_navigate === "function") {
        console.log("  📱 Playwright MCP 사용");
        
        // 페이지 이동
        await (globalThis as any).mcp_Playwright_browser_navigate({ url });
        
        // 페이지 로드 대기
        await (globalThis as any).mcp_Playwright_browser_wait_for({ time: 3 });
        
        // 페이지 스냅샷 가져오기
        const snapshot = await (globalThis as any).mcp_Playwright_browser_snapshot();
        
        // JavaScript로 추가 정보 추출
        const pageData = await (globalThis as any).mcp_Playwright_browser_evaluate({
          function: `() => {
            const images = Array.from(document.images).map(img => ({
              src: img.src,
              alt: img.alt || '',
              naturalWidth: img.naturalWidth,
              naturalHeight: img.naturalHeight
            }));
            
            const texts = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, div'))
              .map(el => el.textContent?.trim())
              .filter(text => text && text.length > 10);
            
            return {
              title: document.title,
              description: document.querySelector('meta[name="description"]')?.content || '',
              keywords: document.querySelector('meta[name="keywords"]')?.content || '',
              ogImage: document.querySelector('meta[property="og:image"]')?.content || '',
              images,
              texts,
              html: document.documentElement.outerHTML
            };
          }`
        });
        
        return {
          markdown: this.convertToMarkdown(pageData.texts, pageData.title),
          html: pageData.html || '',
          title: pageData.title || '',
          images: pageData.images || [],
          metadata: {
            description: pageData.description,
            keywords: pageData.keywords,
            ogImage: pageData.ogImage
          }
        };
      }
    } catch (error) {
      console.warn("  ⚠️ Playwright 실패:", error);
    }
    return null;
  }
  
  /**
   * Firecrawl API를 사용한 스크래핑 (최대 정보 수집)
   */
  private async tryFirecrawl(url: string): Promise<any> {
    try {
      if (process.env.FIRECRAWL_API_KEY) {
        console.log("  🔥 Firecrawl API 사용 (최대 정보 수집 모드)");
        
        const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`
          },
          body: JSON.stringify({
            url,
            formats: ['markdown', 'html', 'links', 'screenshot'],  // links 추가
            onlyMainContent: false,  // 전체 페이지 수집
            includeRawHtml: true,
            includeTags: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'div', 'a', 'img', 'button', 'meta'],  // 모든 태그 수집
            waitFor: 5000,
            actions: [
              { type: 'wait', milliseconds: 2000 },  // 페이지 로드 대기
              { type: 'scroll', direction: 'down' },  // 스크롤 다운
              { type: 'wait', milliseconds: 1000 },
              { type: 'scroll', direction: 'down' },  // 한번 더 스크롤
              { type: 'wait', milliseconds: 1000 },
              { type: 'screenshot', fullPage: true }  // 전체 스크린샷
            ],
            mobile: false,  // 데스크톱 뷰
            removeBase64Images: false  // 이미지 데이터 유지
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          
          // HTML에서 이미지 추출 (더 상세하게)
          const images = this.extractImagesDetailed(data.data?.html || '');
          
          // 메타데이터 최대한 수집
          const metadata = {
            description: data.data?.metadata?.description || data.data?.metadata?.ogDescription,
            keywords: data.data?.metadata?.keywords,
            ogImage: data.data?.metadata?.ogImage,
            ogTitle: data.data?.metadata?.ogTitle,
            ogSiteName: data.data?.metadata?.ogSiteName,
            author: data.data?.metadata?.author,
            language: data.data?.metadata?.language,
            ...data.data?.metadata  // 모든 메타데이터 포함
          };
          
          console.log(`  ✅ Firecrawl 수집 완료:`);
          console.log(`    - Markdown: ${data.data?.markdown?.length || 0}자`);
          console.log(`    - HTML: ${data.data?.html?.length || 0}자`);
          console.log(`    - Images: ${images.length}개`);
          console.log(`    - Links: ${data.data?.links?.length || 0}개`);
          
          return {
            markdown: data.data?.markdown || '',
            html: data.data?.html || '',
            title: data.data?.metadata?.title || data.data?.metadata?.ogTitle || '',
            images,
            links: data.data?.links || [],  // 링크 정보 추가
            metadata
          };
        }
      }
    } catch (error) {
      console.warn("  ⚠️ Firecrawl 실패:", error);
    }
    return null;
  }
  
  /**
   * Puppeteer Chrome DevTools를 사용한 스크래핑
   */
  private async tryPuppeteer(url: string): Promise<any> {
    try {
      // Chrome DevTools MCP가 사용 가능한지 확인
      if (typeof (globalThis as any).mcp_chrome_devtools_puppeteer_navigate === "function") {
        console.log("  🎭 Puppeteer Chrome DevTools 사용");
        
        // Chrome 연결
        await (globalThis as any).mcp_chrome_devtools_puppeteer_connect_active_tab();
        
        // 페이지 이동
        await (globalThis as any).mcp_chrome_devtools_puppeteer_navigate({ url });
        
        // JavaScript 실행으로 데이터 추출
        const pageData = await (globalThis as any).mcp_chrome_devtools_puppeteer_evaluate({
          script: `
            (() => {
              const images = Array.from(document.images).map(img => ({
                src: img.src,
                alt: img.alt || '',
                width: img.width,
                height: img.height
              }));
              
              const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
                .map(el => ({ level: el.tagName, text: el.textContent?.trim() }));
              
              const paragraphs = Array.from(document.querySelectorAll('p'))
                .map(el => el.textContent?.trim())
                .filter(text => text && text.length > 20);
              
              return {
                title: document.title,
                url: window.location.href,
                description: document.querySelector('meta[name="description"]')?.content,
                images,
                headings,
                paragraphs,
                html: document.documentElement.innerHTML
              };
            })()
          `
        });
        
        return {
          markdown: this.createMarkdownFromData(pageData),
          html: pageData.html || '',
          title: pageData.title || '',
          images: pageData.images || [],
          metadata: {
            description: pageData.description
          }
        };
      }
    } catch (error) {
      console.warn("  ⚠️ Puppeteer 실패:", error);
    }
    return null;
  }
  
  /**
   * 기본 fetch를 사용한 스크래핑
   */
  private async basicFetch(url: string): Promise<any> {
    try {
      console.log("  📡 기본 fetch 사용");
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      const html = await response.text();
      const $ = cheerio.load(html);
      
      // 메타데이터 추출
      const title = $('title').text() || $('h1').first().text();
      const description = $('meta[name="description"]').attr('content') || '';
      const keywords = $('meta[name="keywords"]').attr('content') || '';
      const ogImage = $('meta[property="og:image"]').attr('content') || '';
      
      // 텍스트 추출
      const texts: string[] = [];
      $('h1, h2, h3, h4, h5, h6, p').each((_, el) => {
        const text = $(el).text().trim();
        if (text && text.length > 10) {
          texts.push(text);
        }
      });
      
      // 이미지 추출
      const images = this.extractImages(html);
      
      return {
        markdown: texts.join('\n\n'),
        html,
        title,
        images,
        metadata: {
          description,
          keywords,
          ogImage
        }
      };
    } catch (error) {
      console.error("  ❌ 기본 fetch 실패:", error);
      throw error;
    }
  }
  
  /**
   * HTML에서 이미지 정보 추출
   */
  private extractImages(html: string): Array<{ src: string; alt: string }> {
    const $ = cheerio.load(html);
    const images: Array<{ src: string; alt: string }> = [];
    
    $('img').each((_, img) => {
      const src = $(img).attr('src');
      if (src) {
        images.push({
          src: src.startsWith('http') ? src : '',
          alt: $(img).attr('alt') || ''
        });
      }
    });
    
    return images;
  }
  
  /**
   * HTML에서 이미지 정보를 더 상세하게 추출
   */
  private extractImagesDetailed(html: string): Array<{ src: string; alt: string; title?: string; context?: string }> {
    const $ = cheerio.load(html);
    const images: Array<{ src: string; alt: string; title?: string; context?: string }> = [];
    
    $('img').each((_, img) => {
      const src = $(img).attr('src');
      if (src) {
        // 부모 요소의 텍스트로 컨텍스트 수집
        const parent = $(img).parent();
        const context = parent.text()?.trim().substring(0, 200) || '';
        
        images.push({
          src: src.startsWith('http') ? src : (src.startsWith('/') ? '' : src),
          alt: $(img).attr('alt') || '',
          title: $(img).attr('title') || '',
          context: context
        });
      }
    });
    
    return images;
  }
  
  /**
   * 텍스트 배열을 마크다운으로 변환
   */
  private convertToMarkdown(texts: string[], title: string): string {
    let markdown = `# ${title}\n\n`;
    
    texts.forEach(text => {
      if (text.length > 100) {
        markdown += `${text}\n\n`;
      } else if (text.length > 50) {
        markdown += `## ${text}\n\n`;
      } else {
        markdown += `**${text}**\n\n`;
      }
    });
    
    return markdown;
  }
  
  /**
   * 구조화된 데이터를 마크다운으로 변환
   */
  private createMarkdownFromData(data: any): string {
    let markdown = `# ${data.title || 'Untitled'}\n\n`;
    
    if (data.headings) {
      data.headings.forEach((h: any) => {
        const level = parseInt(h.level.charAt(1));
        markdown += `${'#'.repeat(level)} ${h.text}\n\n`;
      });
    }
    
    if (data.paragraphs) {
      data.paragraphs.forEach((p: string) => {
        markdown += `${p}\n\n`;
      });
    }
    
    return markdown;
  }
}
