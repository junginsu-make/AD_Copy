/**
 * Rate Limiting 시스템
 * API 요청 제한 및 DDoS 방지
 * 
 * 메모리 기반 (간단한 구현)
 * 프로덕션에서는 Redis 사용 권장
 */

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

// 사용자별 요청 기록 (메모리 저장)
const userRequests = new Map<string, RateLimitRecord>();

// 정리 주기 (5분마다)
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of userRequests.entries()) {
    if (now > record.resetTime) {
      userRequests.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  windowMs?: number;      // 시간 윈도우 (기본: 15분)
  maxRequests?: number;   // 최대 요청 수 (기본: 100)
  keyPrefix?: string;     // 키 접두사 (기본: "rate-limit")
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

/**
 * Rate Limit 체크
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = {}
): RateLimitResult {
  const {
    windowMs = 15 * 60 * 1000,     // 15분
    maxRequests = 100,              // 100회
    keyPrefix = "rate-limit",
  } = config;

  const key = `${keyPrefix}:${identifier}`;
  const now = Date.now();

  let record = userRequests.get(key);

  // 기록이 없거나 윈도우가 만료된 경우
  if (!record || now > record.resetTime) {
    record = {
      count: 1,
      resetTime: now + windowMs,
    };
    userRequests.set(key, record);

    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetTime: record.resetTime,
    };
  }

  // 요청 제한 초과
  if (record.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: record.resetTime,
      retryAfter: Math.ceil((record.resetTime - now) / 1000), // 초 단위
    };
  }

  // 요청 카운트 증가
  record.count++;
  userRequests.set(key, record);

  return {
    allowed: true,
    remaining: maxRequests - record.count,
    resetTime: record.resetTime,
  };
}

/**
 * IP 기반 Rate Limit
 */
export function checkIPRateLimit(
  request: Request,
  config?: RateLimitConfig
): RateLimitResult {
  const ip = getClientIP(request);
  return checkRateLimit(ip, config);
}

/**
 * 사용자 ID 기반 Rate Limit
 */
export function checkUserRateLimit(
  userId: number,
  config?: RateLimitConfig
): RateLimitResult {
  return checkRateLimit(`user:${userId}`, config);
}

/**
 * LLM API 요청 제한 (비용 관리)
 */
export function checkLLMRateLimit(
  userId: number
): RateLimitResult {
  return checkRateLimit(`llm:${userId}`, {
    windowMs: 60 * 60 * 1000,  // 1시간
    maxRequests: 50,            // 시간당 50회
    keyPrefix: "llm-limit",
  });
}

/**
 * 광고 수집 Rate Limit (퍼플렉시티 API 보호)
 */
export function checkCollectionRateLimit(
  userId: number
): RateLimitResult {
  return checkRateLimit(`collection:${userId}`, {
    windowMs: 24 * 60 * 60 * 1000,  // 24시간
    maxRequests: 10,                 // 하루 10회
    keyPrefix: "collection-limit",
  });
}

/**
 * 클라이언트 IP 추출
 */
function getClientIP(request: Request): string {
  // Vercel, Cloudflare 등의 프록시 헤더 확인
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  const realIP = request.headers.get("x-real-ip");
  if (realIP) {
    return realIP;
  }

  // 기본값
  return "unknown";
}

/**
 * Rate Limit 초과 응답 생성
 */
export function createRateLimitResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({
      error: "요청 제한을 초과했습니다.",
      retryAfter: result.retryAfter,
      resetTime: new Date(result.resetTime).toISOString(),
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": result.retryAfter?.toString() || "60",
        "X-RateLimit-Limit": "100",
        "X-RateLimit-Remaining": result.remaining.toString(),
        "X-RateLimit-Reset": result.resetTime.toString(),
      },
    }
  );
}

