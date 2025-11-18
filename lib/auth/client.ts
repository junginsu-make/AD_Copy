// 클라이언트 측 인증 유틸리티

// sessionStorage 사용 (탭 닫으면 자동 로그아웃)
export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("token");
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem("token", token);
}

export function removeToken(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem("token");
  sessionStorage.removeItem("refreshToken");
  sessionStorage.removeItem("user");
  // 혹시 남아있을 localStorage도 정리
  localStorage.removeItem("token");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");
}

export function getUser(): any | null {
  if (typeof window === "undefined") return null;
  const userStr = sessionStorage.getItem("user");
  return userStr ? JSON.parse(userStr) : null;
}

export function getAuthHeaders(): HeadersInit {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

