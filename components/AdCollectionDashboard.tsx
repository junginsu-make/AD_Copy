/**
 * 광고 수집 대시보드 컴포넌트
 * 관리자가 광고를 수집하고 통계를 확인하는 UI
 */

"use client";

import { useState, useEffect } from "react";

interface CollectionStats {
  totalAds: number;
  byPlatform: Record<string, number>;
  byCategory: Record<string, number>;
  recentCollections: number;
}

export function AdCollectionDashboard() {
  const [category, setCategory] = useState("화장품");
  const [countPerPlatform, setCountPerPlatform] = useState(25);
  const [isCollecting, setIsCollecting] = useState(false);
  const [stats, setStats] = useState<CollectionStats | null>(null);
  const [collectionResult, setCollectionResult] = useState<any>(null);

  const categories = [
    "화장품",
    "패션",
    "IT/소프트웨어",
    "식품",
    "금융",
    "부동산",
    "교육",
    "헬스케어",
    "여행",
    "자동차",
  ];

  // 통계 로드
  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const response = await fetch("/api/ad-collection/collect");
      const data = await response.json();
      if (data.success) {
        setStats(data.statistics);
      }
    } catch (error) {
      console.error("통계 로드 실패:", error);
    }
  };

  const handleCollect = async () => {
    setIsCollecting(true);
    setCollectionResult(null);

    try {
      const response = await fetch("/api/ad-collection/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          countPerPlatform,
          platforms: ["naver", "google", "meta", "kakao"],
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setCollectionResult(data.data);
        await loadStats(); // 통계 새로고침
      } else {
        alert("광고 수집 실패: " + data.error);
      }

    } catch (error) {
      console.error("광고 수집 오류:", error);
      alert("광고 수집 중 오류가 발생했습니다.");
    } finally {
      setIsCollecting(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">광고 수집 대시보드</h2>

      {/* 현재 통계 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="text-sm text-gray-600">총 광고 수</div>
            <div className="text-2xl font-bold text-blue-600">
              {stats.totalAds.toLocaleString()}
            </div>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <div className="text-sm text-gray-600">최근 24시간</div>
            <div className="text-2xl font-bold text-green-600">
              +{stats.recentCollections.toLocaleString()}
            </div>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg">
            <div className="text-sm text-gray-600">플랫폼 수</div>
            <div className="text-2xl font-bold text-purple-600">
              {Object.keys(stats.byPlatform).length}
            </div>
          </div>
          <div className="p-4 bg-orange-50 rounded-lg">
            <div className="text-sm text-gray-600">카테고리 수</div>
            <div className="text-2xl font-bold text-orange-600">
              {Object.keys(stats.byCategory).length}
            </div>
          </div>
        </div>
      )}

      {/* 수집 설정 */}
      <div className="p-4 border border-gray-200 rounded-lg space-y-4">
        <h3 className="font-semibold text-gray-700">새 광고 수집</h3>
        
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              카테고리
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              disabled={isCollecting}
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              플랫폼당 수집 개수
            </label>
            <input
              type="number"
              value={countPerPlatform}
              onChange={(e) => setCountPerPlatform(parseInt(e.target.value))}
              min={5}
              max={50}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              disabled={isCollecting}
            />
            <p className="text-xs text-gray-500 mt-1">
              총 {countPerPlatform * 4}개 수집 (네이버, 구글, 메타, 카카오)
            </p>
          </div>
        </div>

        <button
          onClick={handleCollect}
          disabled={isCollecting}
          className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {isCollecting ? "수집 중..." : "🚀 광고 수집 시작"}
        </button>
      </div>

      {/* 수집 결과 */}
      {collectionResult && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-3">
          <h3 className="font-semibold text-green-800">✅ 수집 완료!</h3>
          
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-600">총 수집:</span>
              <span className="ml-2 font-bold">{collectionResult.totalCollected}개</span>
            </div>
            <div>
              <span className="text-gray-600">저장 성공:</span>
              <span className="ml-2 font-bold text-green-600">{collectionResult.totalSaved}개</span>
            </div>
            <div>
              <span className="text-gray-600">중복 제거:</span>
              <span className="ml-2 font-bold text-orange-600">{collectionResult.totalDuplicates}개</span>
            </div>
          </div>

          <div>
            <div className="text-sm font-medium text-gray-700 mb-2">플랫폼별 수집:</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {Object.entries(collectionResult.byPlatform).map(([platform, count]) => (
                <div key={platform} className="flex justify-between">
                  <span className="text-gray-600">{platform}:</span>
                  <span className="font-medium">{count}개</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 플랫폼별 통계 */}
      {stats && Object.keys(stats.byPlatform).length > 0 && (
        <div className="p-4 border border-gray-200 rounded-lg">
          <h3 className="font-semibold text-gray-700 mb-3">플랫폼별 광고 수</h3>
          <div className="space-y-2">
            {Object.entries(stats.byPlatform).map(([platform, count]) => (
              <div key={platform} className="flex items-center justify-between">
                <span className="text-gray-700 capitalize">{platform}</span>
                <div className="flex items-center gap-3">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${(count / stats.totalAds) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-16 text-right">
                    {count.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

