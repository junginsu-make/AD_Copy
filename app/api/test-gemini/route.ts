// Gemini API 테스트 엔드포인트
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  console.log("\n=== Gemini API 테스트 시작 ===");
  
  // API 키 확인
  const keys: string[] = [];
  for (let i = 1; i <= 10; i++) {
    const key = process.env[`GEMINI_API_KEY_${i}`];
    if (key) {
      keys.push(key);
      console.log(`✓ GEMINI_API_KEY_${i} 발견`);
    }
  }
  
  if (process.env.GEMINI_API_KEY) {
    keys.push(process.env.GEMINI_API_KEY);
    console.log("✓ GEMINI_API_KEY 발견");
  }
  
  if (keys.length === 0) {
    console.error("❌ Gemini API 키를 찾을 수 없습니다!");
    return NextResponse.json(
      { error: "No Gemini API keys found" },
      { status: 500 }
    );
  }
  
  console.log(`총 ${keys.length}개의 API 키 발견`);
  
  // 첫 번째 키로 테스트
  const apiKey = keys[0];
  const model = request.nextUrl.searchParams.get("model") || "gemini-2.5-pro";
  
  console.log(`\n📌 ${model} 테스트...`);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: "혁신적인 AI 서비스를 소개하는 광고 카피 3개를 생성하세요. 각 카피는 30-60자 사이여야 합니다.",
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.8,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 1024,
        },
      }),
    });
    
    console.log(`응답 상태: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log("✅ 성공!");
      
      // 응답에서 텍스트 추출
      let generatedText = "";
      if (data.candidates && data.candidates[0]) {
        const content = data.candidates[0].content;
        if (content && content.parts && content.parts[0]) {
          generatedText = content.parts[0].text;
        }
      }
      
      return NextResponse.json({
        success: true,
        model,
        status: response.status,
        generatedText,
        fullResponse: data,
      });
    } else {
      const errorText = await response.text();
      console.error("❌ API 에러:", errorText);
      
      return NextResponse.json({
        success: false,
        model,
        status: response.status,
        error: errorText,
      });
    }
  } catch (error) {
    console.error("❌ 요청 실패:", error);
    return NextResponse.json({
      success: false,
      model,
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
