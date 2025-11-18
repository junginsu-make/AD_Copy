"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuthHeaders, getUser, removeToken } from "@/lib/auth/client";
import { Navbar } from "@/components/Navbar";

interface Copy {
  id: number;
  prompt: string;
  generatedContent: string;
  charCount: number;
  tone: string | null;
  modelUsed: string;
  status: string;
  isBookmarked: boolean;
  generationTimeMs: number | null;
  apiCost: string | null;
  metadata: any;
  createdAt: Date;
}

interface CopyFeedback {
  rating: number;
  isFavorite: boolean;
  isUsed: boolean;
  feedbackText: string | null;
}

export default function HistoryPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [copies, setCopies] = useState<Copy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 필터
  const [sortBy, setSortBy] = useState<string>("createdAt");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  
  // 피드백 모달
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [selectedCopy, setSelectedCopy] = useState<Copy | null>(null);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackText, setFeedbackText] = useState("");
  const [isFavorite, setIsFavorite] = useState(false);
  const [isUsed, setIsUsed] = useState(false);

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
      loadCopies();
    }
  }, [currentUser, sortBy, page]);

  const loadCopies = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
        sortBy,
      });

      const response = await fetch(`/api/copies/list?${params}`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error("카피 조회 실패");
      }

      const result = await response.json();
      setCopies(result.data || []);
      setTotalPages(result.pagination?.totalPages || 1);
      setTotalItems(result.pagination?.totalItems || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "조회 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!selectedCopy) return;

    try {
      const response = await fetch("/api/feedback/submit", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          copyId: selectedCopy.id,
          userId: currentUser.id,
          rating: feedbackRating,
          isFavorite,
          isUsed,
          feedbackText: feedbackText || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("피드백 제출 실패");
      }

      alert("피드백이 저장되었습니다.");
      setFeedbackModalOpen(false);
      loadCopies();
    } catch (err) {
      alert(err instanceof Error ? err.message : "피드백 제출 중 오류가 발생했습니다.");
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("클립보드에 복사되었습니다.");
  };

  const handleLogout = () => {
    removeToken();
    setCurrentUser(null);
    router.push("/login");
  };

  const openFeedbackModal = (copy: Copy) => {
    setSelectedCopy(copy);
    setFeedbackRating(5);
    setFeedbackText("");
    setIsFavorite(false);
    setIsUsed(false);
    setFeedbackModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <Navbar />

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">생성 이력</h1>
          <p className="text-gray-600">이전에 생성한 카피를 확인하고 피드백을 남기세요</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                정렬 기준
              </label>
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setPage(1);
                }}
                className="w-64 rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="createdAt">최근 생성순</option>
                <option value="charCount">글자수순</option>
                <option value="apiCost">비용순</option>
              </select>
            </div>

            <button
              onClick={loadCopies}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
            >
              {loading ? "로딩 중..." : "새로고침"}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>총 {totalItems}개의 카피</span>
            <span>페이지 {page} / {totalPages}</span>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
            <p className="mt-4 text-gray-600">로딩 중...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {copies.map((copy) => (
              <div
                key={copy.id}
                className="bg-white rounded-lg shadow-md border border-gray-200 p-6 hover:shadow-lg transition"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                        {copy.modelUsed}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(copy.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">
                      입력: {copy.prompt.substring(0, 100)}
                      {copy.prompt.length > 100 ? "..." : ""}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => openFeedbackModal(copy)}
                      className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 text-sm font-medium"
                    >
                      평가하기
                    </button>
                    <button
                      onClick={() => handleCopy(copy.generatedContent)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                    >
                      복사
                    </button>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-4 mb-3">
                  <p className="text-lg text-gray-900 font-medium leading-relaxed">
                    {copy.generatedContent}
                  </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-gray-50 rounded px-3 py-2">
                    <span className="text-xs text-gray-500">글자수</span>
                    <p className="text-sm font-semibold text-gray-900">{copy.charCount}자</p>
                  </div>
                  {copy.tone && (
                    <div className="bg-blue-50 rounded px-3 py-2">
                      <span className="text-xs text-gray-500">톤</span>
                      <p className="text-sm font-semibold text-blue-900">{copy.tone}</p>
                    </div>
                  )}
                  {copy.apiCost && (
                    <div className="bg-green-50 rounded px-3 py-2">
                      <span className="text-xs text-gray-500">비용</span>
                      <p className="text-sm font-semibold text-green-900">
                        ${parseFloat(copy.apiCost).toFixed(4)}
                      </p>
                    </div>
                  )}
                  {copy.generationTimeMs && (
                    <div className="bg-purple-50 rounded px-3 py-2">
                      <span className="text-xs text-gray-500">생성 시간</span>
                      <p className="text-sm font-semibold text-purple-900">
                        {(copy.generationTimeMs / 1000).toFixed(1)}초
                      </p>
                    </div>
                  )}
                </div>

                {copy.metadata && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="flex flex-wrap gap-2">
                      {copy.metadata.lengthCategory && (
                        <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs">
                          {copy.metadata.lengthCategory === "short" ? "짧은 카피" :
                           copy.metadata.lengthCategory === "medium" ? "중간 카피" : "긴 카피"}
                        </span>
                      )}
                      {copy.metadata.rank && (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs">
                          랭킹: #{copy.metadata.rank}
                        </span>
                      )}
                      {copy.metadata.rankingReason && (
                        <span className="px-2 py-1 bg-pink-100 text-pink-700 rounded text-xs">
                          {copy.metadata.rankingReason}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {!loading && copies.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg shadow-md">
            <p className="text-gray-500">생성된 카피가 없습니다.</p>
            <button
              onClick={() => router.push("/generate")}
              className="mt-4 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 font-medium"
            >
              카피 생성하러 가기
            </button>
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-6 flex justify-center items-center space-x-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              이전
            </button>
            <span className="text-sm text-gray-600">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              다음
            </button>
          </div>
        )}
      </main>

      {feedbackModalOpen && selectedCopy && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">카피 평가</h2>
            
            <div className="mb-4 p-4 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">평가할 카피:</p>
              <p className="text-base font-medium text-gray-900">{selectedCopy.generatedContent}</p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                품질 평가 (1-5점)
              </label>
              <div className="flex items-center space-x-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setFeedbackRating(star)}
                    className={`text-4xl transition ${
                      star <= feedbackRating ? "text-yellow-500" : "text-gray-300"
                    } hover:text-yellow-400`}
                  >
                    ★
                  </button>
                ))}
                <span className="ml-3 text-lg font-semibold text-gray-700">
                  {feedbackRating}점
                </span>
              </div>
            </div>

            <div className="mb-4 flex items-center space-x-6">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isFavorite}
                  onChange={(e) => setIsFavorite(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm text-gray-700">즐겨찾기</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isUsed}
                  onChange={(e) => setIsUsed(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm text-gray-700">실제 사용함</span>
              </label>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                피드백 (선택사항)
              </label>
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="이 카피에 대한 의견을 자유롭게 작성하세요"
                className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none resize-none"
                rows={3}
              />
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setFeedbackModalOpen(false)}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
              >
                취소
              </button>
              <button
                onClick={handleSubmitFeedback}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 font-medium"
              >
                평가 저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

