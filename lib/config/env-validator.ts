/**
 * 환경 변수 검증 시스템
 * 필수 환경 변수 확인 및 에러 처리
 */

interface EnvConfig {
  // 데이터베이스
  DATABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  
  // AI 모델 (필수)
  OPENAI_API_KEY: string;
  
  // AI 모델 (선택)
  GEMINI_API_KEY_1?: string;
  GEMINI_API_KEY_2?: string;
  GEMINI_API_KEY_3?: string;
  GEMINI_API_KEY_4?: string;
  GEMINI_API_KEY_5?: string;
  ANTHROPIC_API_KEY?: string;
  
  // 광고 수집 (선택)
  PERPLEXITY_API_KEY?: string;
  
  // 보안
  JWT_SECRET?: string;
}

/**
 * 필수 환경 변수 목록
 */
const REQUIRED_ENV_VARS = [
  "DATABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "OPENAI_API_KEY",
] as const;

/**
 * 권장 환경 변수 목록
 */
const RECOMMENDED_ENV_VARS = [
  "PERPLEXITY_API_KEY",
  "GEMINI_API_KEY_1",
  "ANTHROPIC_API_KEY",
  "JWT_SECRET",
] as const;

/**
 * 환경 변수 검증
 */
export function validateEnv(): {
  valid: boolean;
  missing: string[];
  warnings: string[];
} {
  const missing: string[] = [];
  const warnings: string[] = [];
  
  // 필수 환경 변수 확인
  for (const key of REQUIRED_ENV_VARS) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }
  
  // 권장 환경 변수 확인
  for (const key of RECOMMENDED_ENV_VARS) {
    if (!process.env[key]) {
      warnings.push(key);
    }
  }
  
  return {
    valid: missing.length === 0,
    missing,
    warnings,
  };
}

/**
 * 환경 변수 검증 및 에러 출력
 */
export function checkEnvOrThrow(): void {
  const result = validateEnv();
  
  if (!result.valid) {
    console.error("\n" + "=".repeat(60));
    console.error("❌ 환경 변수 오류");
    console.error("=".repeat(60));
    console.error("\n필수 환경 변수가 설정되지 않았습니다:\n");
    
    result.missing.forEach(key => {
      console.error(`   ❌ ${key}`);
    });
    
    console.error("\n해결 방법:");
    console.error("   1. env.local.txt 파일 확인");
    console.error("   2. .env.local 파일 생성");
    console.error("   3. 서버 재시작\n");
    console.error("=".repeat(60) + "\n");
    
    throw new Error("필수 환경 변수가 설정되지 않았습니다.");
  }
  
  // 경고 출력
  if (result.warnings.length > 0) {
    console.warn("\n⚠️  권장 환경 변수가 설정되지 않았습니다:");
    result.warnings.forEach(key => {
      console.warn(`   ⚠️  ${key}`);
    });
    console.warn("\n일부 기능이 제한될 수 있습니다.\n");
  }
}

/**
 * 안전하게 환경 변수 가져오기
 */
export function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key];
  
  if (!value && !defaultValue) {
    throw new Error(`환경 변수 ${key}가 설정되지 않았습니다.`);
  }
  
  return value || defaultValue!;
}

/**
 * 환경 변수 마스킹 (로그 출력용)
 */
export function maskEnvValue(value: string): string {
  if (!value) return "미설정";
  
  if (value.length <= 8) {
    return "****";
  }
  
  // 앞 4자 + **** + 뒤 4자
  return `${value.substring(0, 4)}****${value.substring(value.length - 4)}`;
}

/**
 * 환경 정보 출력 (디버깅용)
 */
export function printEnvInfo(): void {
  console.log("\n" + "=".repeat(60));
  console.log("🔧 환경 변수 정보");
  console.log("=".repeat(60) + "\n");
  
  console.log("필수 환경 변수:");
  REQUIRED_ENV_VARS.forEach(key => {
    const value = process.env[key];
    console.log(`   ${value ? "✅" : "❌"} ${key}: ${maskEnvValue(value || "")}`);
  });
  
  console.log("\n권장 환경 변수:");
  RECOMMENDED_ENV_VARS.forEach(key => {
    const value = process.env[key];
    console.log(`   ${value ? "✅" : "⚠️ "} ${key}: ${maskEnvValue(value || "")}`);
  });
  
  console.log("\n" + "=".repeat(60) + "\n");
}

