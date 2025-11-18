// 로그아웃 API 엔드포인트
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // 클라이언트에서 토큰을 삭제하도록 함
    // 서버 측에서는 특별한 작업이 필요 없음 (stateless JWT 사용)
    
    return NextResponse.json(
      { message: "로그아웃되었습니다." },
      { status: 200 }
    );
  } catch (error) {
    console.error("로그아웃 오류:", error);
    return NextResponse.json(
      { error: "로그아웃 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

