import { NextRequest, NextResponse } from "next/server";
import { GeminiVisionProvider } from "@/src/infrastructure/ai/gemini-vision-provider";

// 이미지 분석 API 엔드포인트
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get("image") as File | null;
    const additionalPrompt = formData.get("prompt") as string | null;

    // 이미지 파일 유효성 검사
    if (!imageFile) {
      return NextResponse.json(
        { error: "이미지 파일이 제공되지 않았습니다." },
        { status: 400 }
      );
    }

    // 파일 크기 체크 (20MB 제한)
    const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
    if (imageFile.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "이미지 파일 크기는 20MB를 초과할 수 없습니다." },
        { status: 400 }
      );
    }

    // MIME 타입 체크
    const allowedMimeTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif",
    ];
    
    if (!allowedMimeTypes.includes(imageFile.type)) {
      return NextResponse.json(
        { 
          error: "지원하지 않는 이미지 형식입니다. (지원: JPEG, PNG, WebP, HEIC, HEIF)" 
        },
        { status: 400 }
      );
    }

    // 이미지를 Base64로 인코딩
    const imageBytes = await imageFile.arrayBuffer();
    const imageBase64 = Buffer.from(imageBytes).toString("base64");

    // Gemini Vision Provider로 이미지 분석
    const visionProvider = new GeminiVisionProvider();
    
    if (!visionProvider.isConfigured) {
      return NextResponse.json(
        { error: "이미지 분석 서비스가 설정되지 않았습니다." },
        { status: 500 }
      );
    }

    const startTime = Date.now();
    const analysisResult = await visionProvider.analyzeImage({
      imageBase64,
      mimeType: imageFile.type,
      prompt: additionalPrompt || undefined,
    });
    const analysisTimeMs = Date.now() - startTime;

    // 비용 계산
    const apiCost = visionProvider.calculateCost(analysisResult.tokenUsage);

    return NextResponse.json({
      success: true,
      analysis: {
        description: analysisResult.description,
        suggestedKeywords: analysisResult.suggestedKeywords,
        visualElements: analysisResult.visualElements,
        productInfo: analysisResult.productInfo,
      },
      metadata: {
        fileName: imageFile.name,
        fileSize: imageFile.size,
        mimeType: imageFile.type,
        analysisTimeMs,
        tokenUsage: analysisResult.tokenUsage,
        apiCost,
      },
    });
  } catch (error) {
    console.error("이미지 분석 오류:", error);
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : "이미지 분석 중 오류가 발생했습니다.";
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// GET 메서드는 지원하지 않음
export async function GET() {
  return NextResponse.json(
    { error: "이 엔드포인트는 POST 메서드만 지원합니다." },
    { status: 405 }
  );
}

