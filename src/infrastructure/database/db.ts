// 데이터베이스 연결 설정
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// DATABASE_URL 환경 변수에서 연결 문자열 가져오기
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL 환경 변수가 설정되지 않았습니다.");
}

// PostgreSQL 클라이언트 생성
const client = postgres(connectionString);

// Drizzle ORM 인스턴스 생성
export const db = drizzle(client, { schema });

// 데이터베이스 연결 종료 함수 (테스트 시 사용)
export async function closeDbConnection() {
  await client.end();
}

