// JWT 토큰 생성 및 검증 유틸리티
import jwt from "jsonwebtoken";

// JWT Secret 검증 (프로덕션에서는 필수)
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET && process.env.NODE_ENV === "production") {
  throw new Error(
    "JWT_SECRET 환경 변수가 설정되지 않았습니다. 프로덕션에서는 필수입니다."
  );
}

// 개발 환경에서만 기본값 사용
const SECRET = JWT_SECRET || "pltt-ad-copy-secret-key-please-change-in-production-23kj4h2k3j4h";

export interface JWTPayload {
  userId: number;
  email: string;
  tier?: string;
}

// Access Token 생성 (90일 유효 - 사용자 편의성 우선)
export function generateAccessToken(payload: JWTPayload): string {
  // 페이로드 검증
  if (!payload.userId || !payload.email) {
    throw new Error("유효하지 않은 페이로드입니다.");
  }
  
  return jwt.sign(payload, SECRET, {
    expiresIn: "90d", // 90일로 변경 (사용자 불편 최소화)
    algorithm: "HS256",
    issuer: "pltt-ad-copy",
    audience: "pltt-ad-copy-api",
  });
}

// Refresh Token 생성 (365일 유효)
export function generateRefreshToken(payload: JWTPayload): string {
  // 페이로드 검증
  if (!payload.userId || !payload.email) {
    throw new Error("유효하지 않은 페이로드입니다.");
  }
  
  return jwt.sign(payload, SECRET, {
    expiresIn: "365d", // 1년으로 변경
    algorithm: "HS256",
    issuer: "pltt-ad-copy",
    audience: "pltt-ad-copy-api",
  });
}

// 토큰 검증 (강화)
export function verifyToken(token: string): JWTPayload {
  try {
    // 토큰 형식 검증
    if (!token || typeof token !== "string") {
      throw new Error("토큰이 제공되지 않았습니다.");
    }
    
    // JWT 형식 확인 (3부분으로 구성)
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new Error("유효하지 않은 토큰 형식입니다.");
    }
    
    // 토큰 검증 (생성 시와 동일한 설정 사용)
    const decoded = jwt.verify(token, SECRET, {
      algorithms: ["HS256"],
      issuer: "pltt-ad-copy",
      audience: "pltt-ad-copy-api",
    }) as JWTPayload;
    
    // 페이로드 검증
    if (!decoded.userId || !decoded.email) {
      throw new Error("유효하지 않은 토큰 페이로드입니다.");
    }
    
    return decoded;
    
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error("토큰이 만료되었습니다.");
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new Error("유효하지 않은 토큰입니다.");
    } else {
      throw error;
    }
  }
}

// 토큰에서 사용자 ID 추출
export function getUserIdFromToken(token: string): number {
  const payload = verifyToken(token);
  return payload.userId;
}

