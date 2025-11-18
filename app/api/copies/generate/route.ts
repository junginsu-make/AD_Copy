// 카피 생성 API 엔드포인트
import { NextRequest, NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/auth/middleware";
import { CopyGenerationService } from "@/src/application/services/copy-generation-service";
import { z } from "zod";
import { ValidationError } from "@/src/application/services/validation-service";
import crypto from "crypto";

// 중복 요청 방지를 위한 메모리 캐시
const requestCache = new Map<string, {
  timestamp: number;
  result: any;
  status: "pending" | "completed" | "error";
  error?: any;
}>(); 

// 캐시 유효 시간 (5초)
const CACHE_TTL = 5000;

// 캐시 정리 (30초마다)
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of requestCache.entries()) {
    if (now - value.timestamp > CACHE_TTL * 6) { // 30초 이상 오래된 항목 제거
      requestCache.delete(key);
    }
  }
}, 30000);

// 요청 해시 생성
function generateRequestHash(data: any): string {
  const normalized = JSON.stringify({
    prompt: data.prompt,
    minChars: data.minChars,
    maxChars: data.maxChars,
    tone: data.tone,
    count: data.count,
    generationMode: data.generationMode,
    targetPlatform: data.targetPlatform,
    useAdReferences: data.useAdReferences,
    useCopywritingTheory: data.useCopywritingTheory,
  });
  return crypto.createHash('md5').update(normalized).digest('hex');
}

// 카피 생성 요청 스키마
const generateSchema = z.object({
  prompt: z.string().min(1, "프롬프트를 입력해주세요."),
  
  // 글자 수 설정 (새로운 시스템)
  targetCharCount: z.number().int().min(10).max(200).optional(),  // 사용자 지정 글자 수
  charCountMode: z.enum(["auto", "fixed"]).optional().default("auto"),  // auto: AI 결정, fixed: 사용자 지정
  
  // 기존 범위 설정 (charCountMode="auto"일 때 사용)
  minChars: z.number().int().min(10).max(500).optional().default(30),
  maxChars: z.number().int().min(10).max(500).optional().default(60),
  
  tone: z.string().optional(), // 모든 톤 허용 (빈 문자열 포함)
  count: z.number().int().min(1).max(50).optional(),  // 더 이상 기본값 없음 (모드별 고정)
  templateId: z.number().int().optional(),
  preferredModel: z.enum(["gpt-5", "gemini-2.5-pro", "gemini-2.5-flash", "claude-sonnet-4-5"]).optional(),
  model: z.enum(["gpt-5", "gemini-2.5-pro", "gemini-2.5-flash", "claude-sonnet-4-5"]).optional(), // model 필드도 지원
  creativeGuidelines: z
    .array(
      z.object({
        title: z.string().min(1),
        description: z.string().min(1),
      })
    )
    .optional(),
  sessionId: z.number().int().positive().optional(),
  
  // 생성 모드
  generationMode: z.enum(["single", "multi", "ensemble", "variety"]).optional().default("variety"),
  enableReranking: z.boolean().optional().default(false),
  
  // 입력 타입
  isUrlInput: z.boolean().optional().default(false),
  isImageInput: z.boolean().optional().default(false),
  imageAnalysis: z.object({
    description: z.string(),
    suggestedKeywords: z.array(z.string()).optional(),
    visualElements: z.array(z.string()).optional(),
    productInfo: z.object({
      category: z.string().optional(),
      features: z.array(z.string()).optional(),
      targetAudience: z.string().optional(),
    }).optional(),
  }).optional(),
  
  // 플랫폼 선택
  targetPlatform: z.enum(["naver", "google", "kakao"]).optional(),
  targetAdType: z.string().optional(),
  
  // 카피라이팅 이론 & 레퍼런스
  useCopywritingTheory: z.boolean().optional().default(true),
  useAdReferences: z.boolean().optional().default(false), // 기본값: false (사용자 선택)
  promptStrategy: z.enum(["focused", "comprehensive", "maximum"]).optional().default("comprehensive"),
  adReferenceFreshness: z.number().int().min(1).max(365).optional().default(90), // 최근 N일
});

async function handler(request: AuthenticatedRequest) {
  let validatedData: any;
  
  try {
    const body = await request.json();

    // 입력 검증
    validatedData = generateSchema.parse(body);
    const userId = request.userId!;
    
    // URL 자동 감지 (prompt가 URL 형식인 경우)
    if (!validatedData.isUrlInput && validatedData.prompt) {
      const urlPattern = /^https?:\/\/[^\s]+$/i;
      if (urlPattern.test(validatedData.prompt.trim())) {
        console.log(`🔗 URL 입력 감지: ${validatedData.prompt}`);
        validatedData.isUrlInput = true;
      }
    }
    
    // 중복 요청 체크
    const requestHash = generateRequestHash(validatedData);
    const cached = requestCache.get(requestHash);
    
    if (cached) {
      const age = Date.now() - cached.timestamp;
      
      // 캐시가 유효한 경우
      if (age < CACHE_TTL) {
        if (cached.status === "completed") {
          console.log("🔄 중복 요청 감지 - 캐시된 결과 반환");
          return NextResponse.json(cached.result, { status: 200 });
        } else if (cached.status === "pending") {
          console.log("⏳ 중복 요청 - 이미 처리 중");
          // 처리 중인 요청 대기 (최대 10초)
          const maxWait = 10000;
          const startWait = Date.now();
          
          while (Date.now() - startWait < maxWait) {
            await new Promise(resolve => setTimeout(resolve, 100));
            const updated = requestCache.get(requestHash);
            if (updated?.status === "completed") {
              return NextResponse.json(updated.result, { status: 200 });
            } else if (updated?.status === "error") {
              throw updated.error;
            }
          }
          
          // 대기 시간 초과
          return NextResponse.json(
            { error: "요청 처리 시간이 초과되었습니다. 다시 시도해주세요." },
            { status: 503 }
          );
        }
      }
    }
    
    // 새 요청 등록
    requestCache.set(requestHash, {
      timestamp: Date.now(),
      result: null,
      status: "pending"
    });

    // 카피 생성 서비스 호출
    // model 필드를 preferredModel로 매핑
    const requestData = {
      userId,
      ...validatedData,
      preferredModel: validatedData.preferredModel || validatedData.model,
    };
    
    const service = new CopyGenerationService();
    const result = await service.generate(requestData);
    
    // 캐시 업데이트
    requestCache.set(requestHash, {
      timestamp: Date.now(),
      result,
      status: "completed"
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    // 오류 발생 시 캐시 업데이트
    if (validatedData) {
      const requestHash = generateRequestHash(validatedData);
      if (requestCache.has(requestHash)) {
        requestCache.set(requestHash, {
          timestamp: Date.now(),
          result: null,
          status: "error",
          error
        });
      }
    }
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "입력 데이터가 유효하지 않습니다.",
          details: error.errors,
        },
        { status: 400 }
      );
    }

    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("카피 생성 오류:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "카피 생성 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}

// 이미지 분석 결과를 프롬프트로 변환하는 헬퍼 함수
function buildImageContext(analysis: any): string {
  const parts: string[] = [];
  
  parts.push(`[이미지 분석 결과]`);
  parts.push(`설명: ${analysis.description}`);
  
  if (analysis.suggestedKeywords?.length > 0) {
    parts.push(`키워드: ${analysis.suggestedKeywords.join(", ")}`);
  }
  
  if (analysis.visualElements?.length > 0) {
    parts.push(`시각적 요소: ${analysis.visualElements.join(", ")}`);
  }
  
  if (analysis.productInfo) {
    const { category, features, targetAudience } = analysis.productInfo;
    if (category) parts.push(`제품 카테고리: ${category}`);
    if (features?.length > 0) parts.push(`제품 특징: ${features.join(", ")}`);
    if (targetAudience) parts.push(`타겟 고객: ${targetAudience}`);
  }
  
  parts.push(`\n위 이미지 분석 결과를 바탕으로 창의적이고 효과적인 광고 카피를 작성해주세요.`);
  
  return parts.join("\n");
}

// 프로토타입 테스트용: 인증 우회
async function handlerNoAuth(request: NextRequest) {
  let validatedData: any;
  
  try {
    const body = await request.json();

    // 입력 검증
    validatedData = generateSchema.parse(body);
    const userId = 1; // 테스트용 고정 userId
    
    // URL 자동 감지 (prompt가 URL 형식인 경우)
    if (!validatedData.isUrlInput && validatedData.prompt) {
      const urlPattern = /^https?:\/\/[^\s]+$/i;
      if (urlPattern.test(validatedData.prompt.trim())) {
        console.log(`🔗 URL 입력 감지: ${validatedData.prompt}`);
        validatedData.isUrlInput = true;
      }
    }
    
    // 중복 요청 체크
    const requestHash = generateRequestHash(validatedData);
    const cached = requestCache.get(requestHash);
    
    if (cached) {
      const age = Date.now() - cached.timestamp;
      
      // 캐시가 유효한 경우
      if (age < CACHE_TTL) {
        if (cached.status === "completed") {
          console.log("🔄 중복 요청 감지 - 캐시된 결과 반환");
          return NextResponse.json(cached.result, { status: 200 });
        } else if (cached.status === "pending") {
          console.log("⏳ 중복 요청 - 이미 처리 중");
          // 처리 중인 요청 대기 (최대 10초)
          const maxWait = 10000;
          const startWait = Date.now();
          
          while (Date.now() - startWait < maxWait) {
            await new Promise(resolve => setTimeout(resolve, 100));
            const updated = requestCache.get(requestHash);
            if (updated?.status === "completed") {
              return NextResponse.json(updated.result, { status: 200 });
            } else if (updated?.status === "error") {
              throw updated.error;
            }
          }
          
          // 대기 시간 초과
          return NextResponse.json(
            { error: "요청 처리 시간이 초과되었습니다. 다시 시도해주세요." },
            { status: 503 }
          );
        }
      }
    }
    
    // 새 요청 등록
    requestCache.set(requestHash, {
      timestamp: Date.now(),
      result: null,
      status: "pending"
    });

    // URL 입력 모드 처리
    let finalRequest = { userId, ...validatedData };
    let urlAnalysisResult: any = null; // URL 분석 결과 저장
    
    if (validatedData.isUrlInput) {
      console.log(`\n🌐 URL 입력 모드 - 분석 시작`);
      
      // URL 분석 모듈 임포트
      const { UrlAnalysisService } = await import("@/src/application/services/url-analysis-service");
      const urlService = new UrlAnalysisService();
      
      // URL 분석하여 의도 추출 (스크래핑 결과 포함)
      console.log(`📊 URL 분석 시작: ${validatedData.prompt}`);
      const analyzedIntent = await urlService.analyzeUrl(validatedData.prompt);
      
      console.log(`✅ URL 분석 완료:`);
      console.log(`  - 제품명: ${analyzedIntent.productName || "없음"}`);
      console.log(`  - 타겟: ${analyzedIntent.targetAudience || "없음"}`);
      console.log(`  - 톤: ${analyzedIntent.tone || "없음"}`);
      console.log(`  - 키워드: ${analyzedIntent.keywords?.join(", ") || "없음"}`);
      console.log(`  - 브랜드 보이스: ${analyzedIntent.analyzedData?.brandVoice || "없음"}`);
      
      // URL 분석 결과 저장 (응답에 포함하기 위해)
      urlAnalysisResult = {
        url: validatedData.prompt,
        title: analyzedIntent.analyzedData?.title || analyzedIntent.sourceUrl || "",
        analyzedData: analyzedIntent.analyzedData || {},
        extractedInfo: {
          productName: analyzedIntent.productName,
          targetAudience: analyzedIntent.targetAudience,
          tone: analyzedIntent.tone,
          keyBenefits: analyzedIntent.keyBenefits || [],
          keywords: analyzedIntent.keywords || [],
          brandVoice: analyzedIntent.analyzedData?.brandVoice,
          existingCopies: analyzedIntent.analyzedData?.existingCopies || [],
          keyFeatures: analyzedIntent.analyzedData?.keyFeatures || [],
          priceRange: analyzedIntent.analyzedData?.priceRange,
        },
      };
      
      console.log(`📋 URL 분석 결과 저장 완료:`, {
        url: urlAnalysisResult.url,
        title: urlAnalysisResult.title,
        extractedInfoKeys: Object.keys(urlAnalysisResult.extractedInfo),
      });
      
      finalRequest = {
        ...finalRequest,
        intent: analyzedIntent,
      };
    }
    
    // 이미지 입력 모드 처리
    if (validatedData.isImageInput && validatedData.imageAnalysis) {
      // 이미지 분석 결과를 프롬프트에 통합
      const imageContext = buildImageContext(validatedData.imageAnalysis);
      finalRequest = {
        ...finalRequest,
        prompt: validatedData.prompt 
          ? `${imageContext}\n\n추가 요구사항: ${validatedData.prompt}`
          : imageContext,
      };
    }

    // 카피 생성 서비스 호출
    const service = new CopyGenerationService();
    
    // 기본값 설정 (중요!)
    const finalRequestWithDefaults = {
      ...finalRequest,
      useCopywritingTheory: finalRequest.useCopywritingTheory ?? true, // 기본: 활성화
      useAdReferences: finalRequest.useAdReferences ?? true, // 기본: 활성화
      promptStrategy: finalRequest.promptStrategy ?? "comprehensive", // 기본: comprehensive
      adReferenceFreshness: finalRequest.adReferenceFreshness ?? 90, // 기본: 90일
    };
    
    console.log("\n최종 요청 설정:", {
      useCopywritingTheory: finalRequestWithDefaults.useCopywritingTheory,
      useAdReferences: finalRequestWithDefaults.useAdReferences,
      promptStrategy: finalRequestWithDefaults.promptStrategy,
      adReferenceFreshness: finalRequestWithDefaults.adReferenceFreshness,
    });
    
    const result = await service.generate(finalRequestWithDefaults);
    
    // URL 분석 결과가 있으면 응답에 포함
    if (urlAnalysisResult) {
      (result as any).urlAnalysis = urlAnalysisResult;
      console.log(`✅ URL 분석 결과를 응답에 포함했습니다.`, {
        hasUrlAnalysis: !!(result as any).urlAnalysis,
        url: (result as any).urlAnalysis?.url,
      });
    }
    // URL 입력이 아닌 경우 경고 메시지 표시 안 함
    
    // 캐시 업데이트
    requestCache.set(requestHash, {
      timestamp: Date.now(),
      result,
      status: "completed"
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    // 오류 발생 시 캐시 업데이트
    if (validatedData) {
      const requestHash = generateRequestHash(validatedData);
      if (requestCache.has(requestHash)) {
        requestCache.set(requestHash, {
          timestamp: Date.now(),
          result: null,
          status: "error",
          error
        });
      }
    }
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "입력 데이터가 유효하지 않습니다.",
          details: error.errors,
        },
        { status: 400 }
      );
    }

    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("카피 생성 오류:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "카피 생성 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}

// 임시로 인증 없이 사용
export const POST = handlerNoAuth;