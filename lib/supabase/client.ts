// Supabase 클라이언트 설정 (브라우저용)
import { createBrowserClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Supabase URL 또는 Anon Key가 설정되지 않았습니다. .env.local 파일을 확인하세요."
  );
}

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

