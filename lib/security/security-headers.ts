/**
 * 보안 HTTP 헤더 설정
 * OWASP 권장사항 적용
 */

import { NextResponse } from "next/server";

/**
 * 보안 헤더 추가
 */
export function addSecurityHeaders(response: NextResponse): NextResponse {
  // XSS 방지
  response.headers.set(
    "X-Content-Type-Options",
    "nosniff"
  );
  
  // Clickjacking 방지
  response.headers.set(
    "X-Frame-Options",
    "DENY"
  );
  
  // XSS 필터 활성화
  response.headers.set(
    "X-XSS-Protection",
    "1; mode=block"
  );
  
  // Content Security Policy
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Next.js 필요
      "style-src 'self' 'unsafe-inline'",                // Tailwind 필요
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co https://api.perplexity.ai https://api.openai.com",
      "frame-ancestors 'none'",
    ].join("; ")
  );
  
  // Referrer 정책
  response.headers.set(
    "Referrer-Policy",
    "strict-origin-when-cross-origin"
  );
  
  // Permissions Policy
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );
  
  // HSTS (프로덕션에서 HTTPS 사용 시)
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );
  }
  
  return response;
}

/**
 * CORS 헤더 설정
 */
export function addCORSHeaders(
  response: NextResponse,
  allowedOrigins: string[] = []
): NextResponse {
  const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  
  // 허용된 origin만
  const allowed = allowedOrigins.length > 0 
    ? allowedOrigins 
    : [origin];
  
  response.headers.set(
    "Access-Control-Allow-Origin",
    allowed.join(", ")
  );
  
  response.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
  
  response.headers.set(
    "Access-Control-Max-Age",
    "86400" // 24시간
  );
  
  return response;
}

/**
 * 보안 응답 생성 헬퍼
 */
export function createSecureResponse(
  data: any,
  status: number = 200
): NextResponse {
  const response = NextResponse.json(data, { status });
  return addSecurityHeaders(response);
}

