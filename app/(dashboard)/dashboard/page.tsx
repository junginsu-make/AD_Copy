"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getUser, removeToken } from "@/lib/auth/client";
import { Navbar } from "@/components/Navbar";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const currentUser = getUser();
    if (!currentUser) {
      router.push("/login");
      return;
    }
    setUser(currentUser);
    loadDashboardData(currentUser.id);
  }, [router]);

  const loadDashboardData = async (userId: number) => {
    setLoading(true);
    try {
      // 사용자 정보 최신화
      const userResponse = await fetch(`/api/auth/me`, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem("token")}` },
      });
      
      if (userResponse.ok) {
        const userData = await userResponse.json();
        setUser(userData.user);
        sessionStorage.setItem("user", JSON.stringify(userData.user));
      }

      // 통계 데이터 조회
      const statsResponse = await fetch(`/api/analytics/summary?userId=${userId}&days=7`, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem("token")}` },
      });
      
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }
    } catch (error) {
      console.error("대시보드 데이터 로딩 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    removeToken();
    router.push("/login");
  };

  if (!user) {
    return <div className="min-h-screen flex items-center justify-center">로딩 중...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <Navbar />

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">대시보드</h2>
          <p className="text-gray-600">환영합니다, {user.name}님! Pltt. AD Copy의 모든 기능을 이용하세요.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Link
            href="/generate"
            className="group block bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1 overflow-hidden"
          >
            <div className="h-2 bg-gradient-to-r from-blue-500 to-blue-600"></div>
            <div className="p-6">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-4 text-white font-bold text-xl">
                AI
              </div>
              <h3 className="text-xl font-bold mb-2 text-gray-900 group-hover:text-blue-600 transition">
                카피 생성
              </h3>
              <p className="text-gray-600 text-sm">
                자연어, URL, 이미지, 대화형 모든 방식으로 카피를 생성하세요
              </p>
            </div>
          </Link>

          <Link
            href="/history"
            className="group block bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1 overflow-hidden"
          >
            <div className="h-2 bg-gradient-to-r from-green-500 to-green-600"></div>
            <div className="p-6">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center mb-4 text-white font-bold text-xl">
                H
              </div>
              <h3 className="text-xl font-bold mb-2 text-gray-900 group-hover:text-green-600 transition">
                생성 이력
              </h3>
              <p className="text-gray-600 text-sm">
                이전에 생성한 카피를 확인하고 피드백을 남기세요
              </p>
            </div>
          </Link>

          <Link
            href="/admin/ad-references"
            className="group block bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1 overflow-hidden"
          >
            <div className="h-2 bg-gradient-to-r from-purple-500 to-purple-600"></div>
            <div className="p-6">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mb-4 text-white font-bold text-xl">
                AD
              </div>
              <h3 className="text-xl font-bold mb-2 text-gray-900 group-hover:text-purple-600 transition">
                광고 레퍼런스 관리
              </h3>
              <p className="text-gray-600 text-sm">
                수집된 광고를 평가하고 품질을 관리하세요
              </p>
            </div>
          </Link>

          <Link
            href="/admin/statistics"
            className="group block bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1 overflow-hidden"
          >
            <div className="h-2 bg-gradient-to-r from-pink-500 to-pink-600"></div>
            <div className="p-6">
              <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl flex items-center justify-center mb-4 text-white font-bold text-xl">
                ST
              </div>
              <h3 className="text-xl font-bold mb-2 text-gray-900 group-hover:text-pink-600 transition">
                통계 대시보드
              </h3>
              <p className="text-gray-600 text-sm">
                성과 분석 및 상세 통계를 확인하세요
              </p>
            </div>
          </Link>

          <Link
            href="/conversational"
            className="group block bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1 overflow-hidden"
          >
            <div className="h-2 bg-gradient-to-r from-indigo-500 to-indigo-600"></div>
            <div className="p-6">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center mb-4 text-white font-bold text-xl">
                CH
              </div>
              <h3 className="text-xl font-bold mb-2 text-gray-900 group-hover:text-indigo-600 transition">
                대화형 생성 (전용)
              </h3>
              <p className="text-gray-600 text-sm">
                대화 전용 페이지에서 깊이있는 대화를 나누세요
              </p>
            </div>
          </Link>
        </div>


        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
            <h3 className="text-lg font-bold text-gray-900 mb-4">계정 정보</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">이메일</span>
                <span className="text-sm font-medium text-gray-900">{user.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">이름</span>
                <span className="text-sm font-medium text-gray-900">{user.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">등급</span>
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                  {user.tier?.toUpperCase() || "FREE"}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
            <h3 className="text-lg font-bold text-gray-900 mb-4">API 사용량</h3>
            {loading ? (
              <div className="text-center py-4">
                <div className="inline-block animate-spin h-6 w-6 border-2 border-green-600 border-t-transparent rounded-full"></div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">사용량</span>
                  <span className="text-sm font-medium text-gray-900">
                    {user?.apiQuotaUsed || 0} / {user?.apiQuotaLimit || 100}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full transition-all"
                    style={{
                      width: `${Math.min(((user?.apiQuotaUsed || 0) / (user?.apiQuotaLimit || 100)) * 100, 100)}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-gray-500">
                  {((user?.apiQuotaLimit || 100) - (user?.apiQuotaUsed || 0))}개 남음
                </p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-purple-500">
            <h3 className="text-lg font-bold text-gray-900 mb-4">최근 7일 통계</h3>
            {loading || !stats ? (
              <div className="text-center py-4">
                <div className="inline-block animate-spin h-6 w-6 border-2 border-purple-600 border-t-transparent rounded-full"></div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">생성 카피</span>
                  <span className="text-lg font-bold text-gray-900">
                    {stats.copyStats?.totalCopies || 0}개
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">총 비용</span>
                  <span className="text-lg font-bold text-green-900">
                    ${(stats.copyStats?.totalCost || 0).toFixed(4)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">평균 평점</span>
                  <span className="text-lg font-bold text-yellow-600">
                    {(stats.feedbackStats?.avgRating || 0).toFixed(1)}점
                  </span>
                </div>
                <button
                  onClick={() => router.push("/admin/statistics")}
                  className="block w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-center font-medium text-sm mt-2"
                >
                  상세 통계 보기
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

