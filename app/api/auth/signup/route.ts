// 회원가입 API 엔드포인트
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/infrastructure/database";
import { users } from "@/src/infrastructure/database/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { generateAccessToken, generateRefreshToken } from "@/lib/auth/jwt";

// 회원가입 요청 스키마 검증
const signupSchema = z.object({
  email: z.string().email("유효한 이메일 주소를 입력하세요."),
  name: z.string().min(2, "이름은 최소 2자 이상이어야 합니다."),
  password: z.string().min(8, "비밀번호는 최소 8자 이상이어야 합니다."),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log("📝 회원가입 요청:", {
      email: body.email,
      name: body.name,
      passwordLength: body.password?.length,
    });

    // 입력 검증
    const validatedData = signupSchema.parse(body);
    const { email, name, password } = validatedData;
    
    console.log("✅ 입력 검증 통과");

    // 이메일 중복 확인
    console.log("🔍 이메일 중복 확인 중...");
    
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser.length > 0) {
      console.log("❌ 이메일 중복:", email);
      return NextResponse.json(
        { error: "이미 사용 중인 이메일입니다." },
        { status: 409 }
      );
    }
    
    console.log("✅ 이메일 사용 가능");

    // 비밀번호 해싱
    console.log("🔐 비밀번호 해싱 중...");
    const passwordHash = await bcrypt.hash(password, 12);
    console.log("✅ 비밀번호 해싱 완료");

    // 사용자 생성
    console.log("💾 슈퍼베이스에 사용자 저장 중...");
    const [newUser] = await db
      .insert(users)
      .values({
        email,
        name,
        passwordHash,
        authProvider: "local",
        tier: "free",
        apiQuotaLimit: 100,
        apiQuotaUsed: 0,
      })
      .returning();
    
    console.log("✅ 사용자 생성 완료:", {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
    });

    // JWT 토큰 생성
    console.log("🔑 JWT 토큰 생성 중...");
    const accessToken = generateAccessToken({
      userId: newUser.id,
      email: newUser.email,
      tier: newUser.tier || "free",
    });

    const refreshToken = generateRefreshToken({
      userId: newUser.id,
      email: newUser.email,
      tier: newUser.tier || "free",
    });
    
    console.log("✅ 토큰 생성 완료");

    // 응답 반환 (비밀번호 해시 제외)
    const { passwordHash: _, ...userWithoutPassword } = newUser;

    console.log("✅ 회원가입 완료! 사용자 ID:", newUser.id);

    return NextResponse.json(
      {
        success: true,
        user: userWithoutPassword,
        token: accessToken,
        refreshToken: refreshToken,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("❌ 입력 검증 실패:", error.errors);
      return NextResponse.json(
        { 
          error: "입력 데이터가 유효하지 않습니다.", 
          details: error.errors,
          hint: "이름은 2자 이상, 비밀번호는 8자 이상이어야 합니다."
        },
        { status: 400 }
      );
    }

    console.error("❌ 회원가입 오류:", error);
    console.error("상세:", error instanceof Error ? error.message : error);
    
    return NextResponse.json(
      { 
        error: "회원가입 중 오류가 발생했습니다.",
        details: error instanceof Error ? error.message : "알 수 없는 오류"
      },
      { status: 500 }
    );
  }
}

