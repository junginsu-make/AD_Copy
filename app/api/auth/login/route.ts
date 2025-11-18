// 로그인 API 엔드포인트
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/infrastructure/database";
import { users } from "@/src/infrastructure/database/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { generateAccessToken, generateRefreshToken } from "@/lib/auth/jwt";

// 로그인 요청 스키마 검증
const loginSchema = z.object({
  email: z.string().email("유효한 이메일 주소를 입력하세요."),
  password: z.string().min(1, "비밀번호를 입력하세요."),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log("🔐 로그인 시도:", { email: body.email });

    // 입력 검증
    const validatedData = loginSchema.parse(body);
    const { email, password } = validatedData;
    
    console.log("✅ 입력 검증 통과");

    // 사용자 조회
    console.log("🔍 슈퍼베이스에서 사용자 조회 중...");
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      console.log("❌ 사용자 없음:", email);
      return NextResponse.json(
        { error: "이메일 또는 비밀번호가 올바르지 않습니다." },
        { status: 401 }
      );
    }
    
    console.log("✅ 사용자 발견:", user.id);

    // 비밀번호 확인
    console.log("🔐 비밀번호 확인 중...");
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      console.log("❌ 비밀번호 불일치");
      return NextResponse.json(
        { error: "이메일 또는 비밀번호가 올바르지 않습니다." },
        { status: 401 }
      );
    }
    
    console.log("✅ 비밀번호 일치");

    // JWT 토큰 생성
    console.log("🔑 JWT 토큰 생성 중...");
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      tier: user.tier || "free",
    });

    const refreshToken = generateRefreshToken({
      userId: user.id,
      email: user.email,
      tier: user.tier || "free",
    });
    
    console.log("✅ 토큰 생성 완료");

    // 응답 반환 (비밀번호 해시 제외)
    const { passwordHash: _, ...userWithoutPassword } = user;
    
    console.log("✅ 로그인 성공! 사용자 ID:", user.id);

    return NextResponse.json({
      success: true,
      user: userWithoutPassword,
      token: accessToken,
      refreshToken: refreshToken,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("❌ 로그인 입력 검증 실패:", error.errors);
      return NextResponse.json(
        { 
          error: "입력 데이터가 유효하지 않습니다.", 
          details: error.errors,
          hint: "유효한 이메일과 비밀번호를 입력하세요."
        },
        { status: 400 }
      );
    }

    console.error("❌ 로그인 오류:", error);
    console.error("상세:", error instanceof Error ? error.message : error);
    
    return NextResponse.json(
      { 
        error: "로그인 중 오류가 발생했습니다.",
        details: error instanceof Error ? error.message : "알 수 없는 오류"
      },
      { status: 500 }
    );
  }
}

