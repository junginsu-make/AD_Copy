/**
 * Input Sanitization 유틸리티
 * XSS, SQL Injection 등 보안 위협 방지
 */

/**
 * HTML 태그 제거 (XSS 방지)
 */
export function sanitizeHTML(input: string): string {
  if (!input) return "";
  
  // HTML 태그 제거
  let sanitized = input.replace(/<[^>]*>/g, "");
  
  // HTML 엔티티 디코딩 방지
  sanitized = sanitized
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&");
  
  // 다시 태그 제거 (이중 인코딩 대응)
  sanitized = sanitized.replace(/<[^>]*>/g, "");
  
  return sanitized.trim();
}

/**
 * SQL Injection 위험 문자 제거
 */
export function sanitizeSQL(input: string): string {
  if (!input) return "";
  
  // 위험한 SQL 키워드 및 문자 제거
  const dangerous = [
    /;\s*(DROP|DELETE|UPDATE|INSERT|ALTER|CREATE|TRUNCATE)\s+/gi,
    /--/g,
    /\/\*/g,
    /\*\//g,
    /xp_/gi,
    /sp_/gi,
  ];
  
  let sanitized = input;
  dangerous.forEach(pattern => {
    sanitized = sanitized.replace(pattern, "");
  });
  
  return sanitized.trim();
}

/**
 * URL 검증 및 정제
 */
export function sanitizeURL(input: string): string {
  if (!input) return "";
  
  try {
    const url = new URL(input);
    
    // 허용된 프로토콜만
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error("허용되지 않은 프로토콜입니다.");
    }
    
    // localhost 제외 (프로덕션에서)
    if (process.env.NODE_ENV === "production") {
      if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
        throw new Error("localhost는 허용되지 않습니다.");
      }
    }
    
    return url.toString();
  } catch (error) {
    throw new Error("유효하지 않은 URL입니다.");
  }
}

/**
 * 이메일 검증
 */
export function validateEmail(email: string): boolean {
  if (!email) return false;
  
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

/**
 * 프롬프트 길이 제한 및 정제
 */
export function sanitizePrompt(input: string, maxLength: number = 5000): string {
  if (!input) return "";
  
  // HTML 태그 제거
  let sanitized = sanitizeHTML(input);
  
  // 길이 제한
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  // 제어 문자 제거
  sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, "");
  
  return sanitized.trim();
}

/**
 * 파일 업로드 검증
 */
export function validateImageUpload(file: File): {
  valid: boolean;
  error?: string;
} {
  // 파일 타입 검증
  const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: "허용되지 않은 파일 형식입니다. (JPEG, PNG, GIF, WebP만 가능)",
    };
  }
  
  // 파일 크기 제한 (10MB)
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    return {
      valid: false,
      error: "파일 크기는 10MB 이하여야 합니다.",
    };
  }
  
  // 파일명 검증 (경로 순회 공격 방지)
  if (file.name.includes("..") || file.name.includes("/") || file.name.includes("\\")) {
    return {
      valid: false,
      error: "유효하지 않은 파일명입니다.",
    };
  }
  
  return { valid: true };
}

/**
 * 숫자 범위 검증
 */
export function validateNumberRange(
  value: number,
  min: number,
  max: number,
  fieldName: string = "값"
): { valid: boolean; error?: string } {
  if (typeof value !== "number" || isNaN(value)) {
    return {
      valid: false,
      error: `${fieldName}은(는) 숫자여야 합니다.`,
    };
  }
  
  if (value < min || value > max) {
    return {
      valid: false,
      error: `${fieldName}은(는) ${min}과 ${max} 사이여야 합니다.`,
    };
  }
  
  return { valid: true };
}

/**
 * 위험한 키워드 감지 (프롬프트 인젝션 방지)
 */
export function detectPromptInjection(input: string): {
  safe: boolean;
  warning?: string;
} {
  const dangerousPatterns = [
    /ignore\s+(previous|all)\s+instructions/i,
    /system\s*:\s*/i,
    /you\s+are\s+now/i,
    /forget\s+(everything|all)/i,
    /new\s+instructions/i,
    /<script[^>]*>/i,
    /javascript:/i,
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(input)) {
      return {
        safe: false,
        warning: "위험한 패턴이 감지되었습니다.",
      };
    }
  }
  
  return { safe: true };
}

/**
 * 종합 입력 검증 및 정제
 */
export function sanitizeInput(input: string, options: {
  maxLength?: number;
  allowHTML?: boolean;
  checkInjection?: boolean;
} = {}): string {
  const {
    maxLength = 5000,
    allowHTML = false,
    checkInjection = true,
  } = options;
  
  if (!input) return "";
  
  let sanitized = input;
  
  // HTML 제거
  if (!allowHTML) {
    sanitized = sanitizeHTML(sanitized);
  }
  
  // SQL Injection 방지
  sanitized = sanitizeSQL(sanitized);
  
  // Prompt Injection 감지
  if (checkInjection) {
    const injectionCheck = detectPromptInjection(sanitized);
    if (!injectionCheck.safe) {
      throw new Error(injectionCheck.warning);
    }
  }
  
  // 길이 제한
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  return sanitized.trim();
}

