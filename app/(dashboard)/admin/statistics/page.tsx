"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuthHeaders, getUser, removeToken } from "@/lib/auth/client";
import { Navbar } from "@/components/Navbar";

interface StatisticsSummary {
  period: {
    days: number;
    startDate: string;
    endDate: string;
  };
  copyStats: {
    totalCopies: number;
    avgCharCount: number;
    totalCost: number;
  };
  modelStats: Array<{
    model: string;
    count: number;
  }>;
  feedbackStats: {
    avgRating: number;
    totalFeedbacks: number;
    favoriteCount: number;
    usedCount: number;
  };
  sessionStats: {
    totalSessions: number;
    completedSessions: number;
  };
  adRefStats: {
    totalAdRefs: number;
    avgPerformance: number;
    platformCounts: Record<string, number>;
  };
  dailyActivity: Array<{
    date: string;
    count: number;
    cost: number;
  }>;
}

export default function StatisticsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [stats, setStats] = useState<StatisticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState(30);

  useEffect(() => {
    const user = getUser();
    if (!user) {
      router.push("/login");
      return;
    }
    setCurrentUser(user);
  }, [router]);

  useEffect(() => {
    if (currentUser) {
      loadStatistics();
    }
  }, [currentUser, period]);

  const loadStatistics = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/analytics/summary?userId=${currentUser.id}&days=${period}`,
        {
          headers: getAuthHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error("통계 조회 실패");
      }

      const result = await response.json();
      setStats(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "조회 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    removeToken();
    setCurrentUser(null);
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push("/dashboard")}
                className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent hover:from-blue-700 hover:to-purple-700"
              >
                Pltt. AD Copy
              </button>
            </div>
            <div className="flex items-center space-x-3">
              {currentUser && (
                <>
                  <span className="text-sm text-gray-700">{currentUser.name}님</span>
                  <button
                    onClick={handleLogout}
                    className="text-xs font-medium text-blue-600 hover:text-blue-700"
                  >
                    로그아웃
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">통계 대시보드</h1>
            <p className="text-gray-600">카피 생성 및 성과 분석 통계를 확인하세요</p>
          </div>
          <div className="flex items-center space-x-3">
            <select
              value={period}
              onChange={(e) => setPeriod(parseInt(e.target.value))}
              className="rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="7">최근 7일</option>
              <option value="30">최근 30일</option>
              <option value="90">최근 90일</option>
            </select>
            <button
              onClick={loadStatistics}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
            >
              새로고침
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
            <p className="mt-4 text-gray-600">로딩 중...</p>
          </div>
        ) : stats ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
                <p className="text-sm text-gray-600 mb-1">총 생성 카피</p>
                <p className="text-3xl font-bold text-gray-900">
                  {stats.copyStats.totalCopies}개
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  평균 {stats.copyStats.avgCharCount}자
                </p>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
                <p className="text-sm text-gray-600 mb-1">총 비용</p>
                <p className="text-3xl font-bold text-gray-900">
                  ${stats.copyStats.totalCost.toFixed(4)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  평균 ${(stats.copyStats.totalCost / Math.max(stats.copyStats.totalCopies, 1)).toFixed(4)}/개
                </p>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500">
                <p className="text-sm text-gray-600 mb-1">평균 평점</p>
                <p className="text-3xl font-bold text-gray-900">
                  {stats.feedbackStats.avgRating.toFixed(1)}점
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {stats.feedbackStats.totalFeedbacks}개 피드백
                </p>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-pink-500">
                <p className="text-sm text-gray-600 mb-1">실제 사용</p>
                <p className="text-3xl font-bold text-gray-900">
                  {stats.feedbackStats.usedCount}개
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  즐겨찾기 {stats.feedbackStats.favoriteCount}개
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">모델별 사용 통계</h2>
                <div className="space-y-3">
                  {stats.modelStats.map((model, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">{model.model}</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-48 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full"
                            style={{
                              width: `${(model.count / stats.copyStats.totalCopies) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="text-sm font-semibold text-gray-900 w-12 text-right">
                          {model.count}개
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">광고 레퍼런스 현황</h2>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-700">총 레퍼런스</span>
                    <span className="text-lg font-bold text-gray-900">
                      {stats.adRefStats.totalAdRefs}개
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <span className="text-sm text-gray-700">평균 성능 점수</span>
                    <span className="text-lg font-bold text-blue-900">
                      {(stats.adRefStats.avgPerformance * 100).toFixed(0)}점
                    </span>
                  </div>
                  <div className="pt-3 border-t border-gray-200">
                    <p className="text-xs text-gray-600 mb-2">플랫폼별 분포</p>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(stats.adRefStats.platformCounts).map(([platform, count]) => (
                        <div key={platform} className="flex items-center justify-between text-xs">
                          <span className="text-gray-600">{platform.toUpperCase()}</span>
                          <span className="font-semibold text-gray-900">{count}개</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">대화 세션 통계</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">총 세션</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats.sessionStats.totalSessions}개
                  </p>
                </div>
                <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">완료된 세션</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats.sessionStats.completedSessions}개
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    완료율{" "}
                    {stats.sessionStats.totalSessions > 0
                      ? ((stats.sessionStats.completedSessions / stats.sessionStats.totalSessions) * 100).toFixed(0)
                      : 0}
                    %
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">일별 활동 ({period}일)</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-gray-700 font-semibold">날짜</th>
                      <th className="text-right py-3 px-4 text-gray-700 font-semibold">생성 개수</th>
                      <th className="text-right py-3 px-4 text-gray-700 font-semibold">비용</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.dailyActivity.slice(0, 10).map((day, idx) => (
                      <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 text-gray-900">
                          {new Date(day.date).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-gray-900">
                          {day.count}개
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-gray-900">
                          ${day.cost.toFixed(4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 font-bold">
                      <td className="py-3 px-4 text-gray-900">합계</td>
                      <td className="py-3 px-4 text-right text-gray-900">
                        {stats.copyStats.totalCopies}개
                      </td>
                      <td className="py-3 px-4 text-right text-gray-900">
                        ${stats.copyStats.totalCost.toFixed(4)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

