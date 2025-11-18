/**
 * 환경 변수 테스트 API
 * 실제로 어떤 값이 로드되었는지 확인
 */

import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  // 민감한 정보는 마스킹
  const maskValue = (value: string | undefined) => {
    if (!value) return "❌ 미설정";
    if (value.length <= 8) return "****";
    return `${value.substring(0, 4)}****${value.substring(value.length - 4)}`;
  };

  const envStatus = {
    // Supabase
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "❌ 미설정",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: maskValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    DATABASE_URL: maskValue(process.env.DATABASE_URL),
    
    // JWT
    JWT_SECRET: maskValue(process.env.JWT_SECRET),
    
    // AI Keys
    OPENAI_API_KEY: maskValue(process.env.OPENAI_API_KEY),
    ANTHROPIC_API_KEY: maskValue(process.env.ANTHROPIC_API_KEY),
    PERPLEXITY_API_KEY: maskValue(process.env.PERPLEXITY_API_KEY),
    
    // Gemini (두 가지 방식 모두 확인)
    GEMINI_API_KEY: maskValue(process.env.GEMINI_API_KEY),
    GEMINI_API_KEY_1: maskValue(process.env.GEMINI_API_KEY_1),
    GEMINI_API_KEY_2: maskValue(process.env.GEMINI_API_KEY_2),
    GEMINI_API_KEY_3: maskValue(process.env.GEMINI_API_KEY_3),
    GEMINI_API_KEY_4: maskValue(process.env.GEMINI_API_KEY_4),
    GEMINI_API_KEY_5: maskValue(process.env.GEMINI_API_KEY_5),
  };

  const summary = {
    totalEnvVars: Object.keys(process.env).length,
    loadedFiles: [
      process.env.NEXT_PUBLIC_SUPABASE_URL ? ".env.local 또는 .env" : "없음"
    ],
    status: {
      supabase: !!(process.env.DATABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL),
      openai: !!process.env.OPENAI_API_KEY,
      gemini: !!(process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_1),
      perplexity: !!process.env.PERPLEXITY_API_KEY,
      claude: !!process.env.ANTHROPIC_API_KEY,
    }
  };

  console.log("\n" + "=".repeat(60));
  console.log("🔍 환경 변수 현황");
  console.log("=".repeat(60));
  console.log("전체 환경 변수:", summary.totalEnvVars);
  console.log("\n필수 환경 변수:");
  console.log("  Supabase:", summary.status.supabase ? "✅" : "❌");
  console.log("  OpenAI:", summary.status.openai ? "✅" : "❌");
  console.log("  Gemini:", summary.status.gemini ? "✅" : "❌");
  console.log("  Perplexity:", summary.status.perplexity ? "✅" : "❌");
  console.log("  Claude:", summary.status.claude ? "✅" : "❌");
  console.log("=".repeat(60) + "\n");

  return NextResponse.json({
    summary,
    envStatus,
    note: "민감한 정보는 마스킹되어 표시됩니다."
  });
}

