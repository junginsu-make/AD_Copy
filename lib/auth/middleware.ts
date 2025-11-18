// 인증 미들웨어
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "./jwt";

export interface AuthenticatedRequest extends NextRequest {
  userId?: number;
  user?: {
    id: number;
    email: string;
    tier?: string;
  };
}

// JWT 토큰 인증 미들웨어 (보안 강화)
export function authenticateRequest(
  request: NextRequest
): { authenticated: boolean; userId?: number; user?: any; error?: string } {
  try {
    // Authorization 헤더에서 토큰 추출
    const authHeader = request.headers.get("authorization");
    
    if (!authHeader) {
      return { authenticated: false, error: "인증 토큰이 필요합니다." };
    }
    
    if (!authHeader.startsWith("Bearer ")) {
      return { authenticated: false, error: "유효하지 않은 인증 형식입니다. Bearer 토큰을 사용하세요." };
    }

    const token = authHeader.substring(7); // "Bearer " 제거
    
    // 토큰 길이 검증 (비정상적으로 긴 토큰 차단)
    if (token.length > 1000) {
      return { authenticated: false, error: "토큰이 너무 깁니다." };
    }
    
    // 토큰 검증
    const payload = verifyToken(token);

    return {
      authenticated: true,
      userId: payload.userId,
      user: {
        id: payload.userId,
        email: payload.email,
        tier: payload.tier,
      },
    };
  } catch (error) {
    // 에러 로깅 (프로덕션에서는 구조화된 로거 사용)
    console.error("인증 실패:", {
      error: error instanceof Error ? error.message : "알 수 없는 오류",
      timestamp: new Date().toISOString(),
      ip: request.headers.get("x-forwarded-for") || "unknown",
    });
    
    return {
      authenticated: false,
      error: error instanceof Error ? error.message : "인증 실패",
    };
  }
}

// API 라우트에서 사용할 인증 래퍼 (보안 강화)
export function withAuth(
  handler: (request: AuthenticatedRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest) => {
    // 인증 검증
    const authResult = authenticateRequest(request);

    if (!authResult.authenticated || !authResult.userId) {
      // 인증 실패 로깅
      console.warn("인증 실패 시도:", {
        path: request.nextUrl.pathname,
        method: request.method,
        error: authResult.error,
        ip: request.headers.get("x-forwarded-for") || "unknown",
        userAgent: request.headers.get("user-agent"),
        timestamp: new Date().toISOString(),
      });
      
      return NextResponse.json(
        { 
          error: authResult.error || "인증이 필요합니다.",
          code: "UNAUTHORIZED",
        },
        { 
          status: 401,
          headers: {
            "WWW-Authenticate": 'Bearer realm="Pltt. AD Copy API"',
          },
        }
      );
    }

    // 인증된 요청 생성
    const authenticatedRequest = request as AuthenticatedRequest;
    authenticatedRequest.userId = authResult.userId;
    authenticatedRequest.user = authResult.user;

    try {
      // 핸들러 실행
      return await handler(authenticatedRequest);
    } catch (error) {
      // 핸들러 에러 로깅
      console.error("API 핸들러 에러:", {
        path: request.nextUrl.pathname,
        method: request.method,
        userId: authResult.userId,
        error: error instanceof Error ? error.message : "알 수 없는 오류",
        timestamp: new Date().toISOString(),
      });
      
      return NextResponse.json(
        {
          error: "서버 오류가 발생했습니다.",
          code: "INTERNAL_SERVER_ERROR",
        },
        { status: 500 }
      );
    }
  };
}

/**
 * 개발/테스트 전용: 인증 우회 (프로덕션에서는 사용 금지)
 * 
 * 주의: 이 함수는 프로토타입 테스트용입니다.
 * 프로덕션 배포 전에 반드시 withAuth로 교체해야 합니다.
 */
export function withAuthBypass(
  handler: (request: AuthenticatedRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest) => {
    // 프로덕션에서는 사용 금지
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "프로덕션에서는 인증이 필요합니다." },
        { status: 401 }
      );
    }
    
    // 개발 환경에서만 고정 사용자 사용
    console.warn("⚠️ 인증 우회 모드 (개발 전용)");
    
    const authenticatedRequest = request as AuthenticatedRequest;
    authenticatedRequest.userId = 1;
    authenticatedRequest.user = {
      id: 1,
      email: "test@example.com",
      tier: "free",
    };

    return handler(authenticatedRequest);
  };
}

