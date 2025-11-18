"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuthHeaders, getUser, removeToken } from "@/lib/auth/client";
import { Navbar } from "@/components/Navbar";

interface AdReference {
  id: number;
  platform: string;
  adCopy: string;
  headline: string | null;
  description: string | null;
  category: string;
  brand: string | null;
  keywords: string[] | null;
  copywritingFormula: string | null;
  psychologicalTriggers: string[] | null;
  charCount: number | null;
  performanceScore: string | null;
  qualityRating: number | null;
  usageCount: number | null;
  successCount: number | null;
  collectedAt: Date | null;
  isPremium: boolean | null;      // 수동 입력 여부
  isSelected: boolean | null;     // 사용자가 체크한 여부
}

export default function AdReferencesPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [adReferences, setAdReferences] = useState<AdReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 필터 상태
  const [platform, setPlatform] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("collectedAt");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  
  // 피드백 모달
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [selectedAdRef, setSelectedAdRef] = useState<AdReference | null>(null);
  const [feedbackRating, setFeedbackRating] = useState(5);
  
  // 수동 카피 입력 모달
  const [manualCopyModalOpen, setManualCopyModalOpen] = useState(false);
  const [manualCopyHeadline, setManualCopyHeadline] = useState("");
  const [manualCopyDescription, setManualCopyDescription] = useState("");
  const [manualCopyPlatform, setManualCopyPlatform] = useState("naver");

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
      loadAdReferences();
    }
  }, [currentUser, platform, sortBy, page]);

  const loadAdReferences = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
        sortBy,
        order: "desc",
      });

      if (platform) {
        params.append("platform", platform);
      }

      const response = await fetch(`/api/ad-references/list?${params}`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error("광고 레퍼런스 조회 실패");
      }

      const result = await response.json();
      setAdReferences(result.data);
      setTotalPages(result.pagination.totalPages);
      setTotalItems(result.pagination.totalItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : "조회 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleFeedback = async () => {
    if (!selectedAdRef) return;

    try {
      const response = await fetch("/api/ad-references/feedback", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          adReferenceId: selectedAdRef.id,
          rating: feedbackRating,
          isUseful: feedbackRating >= 4,
        }),
      });

      if (!response.ok) {
        throw new Error("피드백 제출 실패");
      }

      alert("피드백이 저장되었습니다.");
      setFeedbackModalOpen(false);
      loadAdReferences();
    } catch (err) {
      alert(err instanceof Error ? err.message : "피드백 제출 중 오류가 발생했습니다.");
    }
  };

  const handleLogout = () => {
    removeToken();
    setCurrentUser(null);
    router.push("/login");
  };

  const openFeedbackModal = (adRef: AdReference) => {
    setSelectedAdRef(adRef);
    setFeedbackRating(adRef.qualityRating || 5);
    setFeedbackModalOpen(true);
  };

  const handleToggleSelection = async (adRef: AdReference) => {
    const newState = !adRef.isSelected;
    
    try {
      const response = await fetch("/api/ad-references/toggle-selection", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          adReferenceId: adRef.id,
          isSelected: newState,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "선택 상태 변경 실패");
      }

      const result = await response.json();
      
      // UI 즉시 업데이트 (낙관적 업데이트)
      setAdReferences(prev => 
        prev.map(ref => 
          ref.id === adRef.id 
            ? { ...ref, isSelected: newState }
            : ref
        )
      );
      
      console.log(result.message);
    } catch (err) {
      alert(err instanceof Error ? err.message : "선택 상태 변경 중 오류가 발생했습니다.");
      loadAdReferences(); // 실패 시 재로드
    }
  };

  const handleManualCopySubmit = async () => {
    if (!manualCopyHeadline.trim()) {
      alert("광고 제목을 입력해주세요.");
      return;
    }

    try {
      const response = await fetch("/api/ad-references/manual", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          headline: manualCopyHeadline.trim(),
          description: manualCopyDescription.trim(),
          platform: manualCopyPlatform,
        }),
      });

      if (!response.ok) {
        throw new Error("카피 저장 실패");
      }

      alert("카피가 저장되었습니다.");
      setManualCopyModalOpen(false);
      setManualCopyHeadline("");
      setManualCopyDescription("");
      setManualCopyPlatform("naver");
      loadAdReferences();
    } catch (err) {
      alert(err instanceof Error ? err.message : "카피 저장 중 오류가 발생했습니다.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <Navbar />

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">광고 레퍼런스 관리</h1>
            <p className="text-gray-600">수집된 광고 레퍼런스를 확인하고 품질을 평가하세요</p>
          </div>
          <button
            onClick={() => setManualCopyModalOpen(true)}
            className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 font-semibold shadow-lg"
          >
            + 수동 카피 추가
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                플랫폼 필터
              </label>
              <select
                value={platform}
                onChange={(e) => {
                  setPlatform(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="">전체 플랫폼</option>
                <option value="naver">네이버</option>
                <option value="google">구글</option>
                <option value="meta">메타</option>
                <option value="kakao">카카오</option>
              </select>
            </div>

            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                정렬 기준
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="collectedAt">최근 수집순</option>
                <option value="performanceScore">성능 점수순</option>
                <option value="successCount">성공 카운트순</option>
                <option value="usageCount">사용 빈도순</option>
              </select>
            </div>

            <button
              onClick={loadAdReferences}
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
            <span>총 {totalItems}개의 광고 레퍼런스</span>
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
            {adReferences.map((adRef) => (
              <div
                key={adRef.id}
                className={`bg-white rounded-lg shadow-md border-2 p-5 hover:shadow-lg transition ${
                  adRef.isSelected || adRef.isPremium 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    {/* 체크박스 (수동 입력은 비활성화) */}
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={adRef.isSelected || adRef.isPremium || false}
                        onChange={() => handleToggleSelection(adRef)}
                        disabled={adRef.isPremium || false}
                        className={`w-5 h-5 rounded border-2 focus:ring-2 focus:ring-blue-500 ${
                          adRef.isPremium 
                            ? 'text-green-600 border-green-500 cursor-not-allowed' 
                            : 'text-blue-600 border-gray-300 cursor-pointer'
                        }`}
                        title={adRef.isPremium ? "수동 입력 광고는 항상 반영됩니다" : "체크하면 카피 생성 시 우선 반영됩니다"}
                      />
                      {adRef.isPremium && (
                        <span className="ml-2 px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                          수동 입력
                        </span>
                      )}
                      {adRef.isSelected && !adRef.isPremium && (
                        <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                          선택됨
                        </span>
                      )}
                    </div>
                    
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      adRef.platform === "naver" ? "bg-green-100 text-green-700" :
                      adRef.platform === "google" ? "bg-blue-100 text-blue-700" :
                      adRef.platform === "meta" ? "bg-purple-100 text-purple-700" :
                      "bg-gray-100 text-gray-700"
                    }`}>
                      {adRef.platform.toUpperCase()}
                    </span>
                    <span className="text-xs text-gray-500">
                      ID: {adRef.id}
                    </span>
                  </div>
                  <button
                    onClick={() => openFeedbackModal(adRef)}
                    className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 text-sm font-medium"
                  >
                    평가하기
                  </button>
                </div>

                {adRef.headline && (
                  <h3 className="text-lg font-bold text-gray-900 mb-2">
                    {adRef.headline}
                  </h3>
                )}

                <p className="text-base text-gray-800 mb-3 leading-relaxed">
                  {adRef.adCopy}
                </p>

                {adRef.description && (
                  <p className="text-sm text-gray-600 mb-3">
                    {adRef.description}
                  </p>
                )}

                <div className="grid grid-cols-2 md:grid-cols-2 gap-3 mb-3">
                  {adRef.charCount && (
                    <div className="bg-gray-50 rounded px-3 py-2">
                      <span className="text-xs text-gray-500">글자수</span>
                      <p className="text-sm font-semibold text-gray-900">{adRef.charCount}자</p>
                    </div>
                  )}
                  {adRef.performanceScore !== null && (
                    <div className="bg-blue-50 rounded px-3 py-2">
                      <span className="text-xs text-gray-500">성능 점수</span>
                      <p className="text-sm font-semibold text-blue-900">
                        {(parseFloat(adRef.performanceScore) * 100).toFixed(0)}점
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        다음 카피 생성 시 우선 선택
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 mb-3">
                  {adRef.copywritingFormula && (
                    <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs">
                      공식: {adRef.copywritingFormula}
                    </span>
                  )}
                  {adRef.psychologicalTriggers && adRef.psychologicalTriggers.length > 0 && (
                    adRef.psychologicalTriggers.slice(0, 3).map((trigger, idx) => (
                      <span key={idx} className="px-2 py-1 bg-pink-100 text-pink-700 rounded text-xs">
                        {trigger}
                      </span>
                    ))
                  )}
                </div>

                {adRef.keywords && adRef.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {adRef.keywords.slice(0, 5).map((keyword, idx) => (
                      <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                        {keyword}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between">
                  <div className="flex items-center space-x-4 text-xs text-gray-500">
                    {adRef.category && <span>카테고리: {adRef.category}</span>}
                    {adRef.brand && <span>브랜드: {adRef.brand}</span>}
                    {adRef.collectedAt && (
                      <span>
                        수집: {new Date(adRef.collectedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  {adRef.qualityRating && (
                    <div className="flex items-center space-x-1">
                      <span className="text-xs text-gray-500">평가:</span>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span
                          key={star}
                          className={star <= adRef.qualityRating! ? "text-yellow-500" : "text-gray-300"}
                        >
                          ★
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && adReferences.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg shadow-md">
            <p className="text-gray-500">광고 레퍼런스가 없습니다.</p>
            <p className="text-sm text-gray-400 mt-2">
              카피 생성 시 자동으로 광고가 수집됩니다.
            </p>
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

      {feedbackModalOpen && selectedAdRef && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">광고 평가</h2>
            
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">평가할 광고:</p>
              <p className="text-base font-medium text-gray-900">{selectedAdRef.adCopy}</p>
            </div>

            <div className="mb-6">
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
              <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm font-medium text-blue-900 mb-2">평가 효과:</p>
                <ul className="text-xs text-blue-800 space-y-1">
                  {feedbackRating >= 4 ? (
                    <>
                      <li>• 성능 점수 +5점 상승</li>
                      <li>• 다음 카피 생성 시 우선 선택됨</li>
                      <li>• AI가 이 광고 스타일을 학습</li>
                    </>
                  ) : feedbackRating === 3 ? (
                    <>
                      <li>• 성능 점수 유지</li>
                      <li>• 현재 상태 유지</li>
                    </>
                  ) : (
                    <>
                      <li>• 성능 점수 -5점 하락</li>
                      <li>• 다음 카피 생성 시 사용 빈도 감소</li>
                      <li>• AI가 이 스타일 사용 자제</li>
                    </>
                  )}
                </ul>
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setFeedbackModalOpen(false)}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
              >
                취소
              </button>
              <button
                onClick={handleFeedback}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 font-medium"
              >
                평가 저장
              </button>
            </div>
          </div>
        </div>
      )}

      {manualCopyModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">수동 카피 추가</h2>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  광고 제목 (필수)
                </label>
                <input
                  type="text"
                  value={manualCopyHeadline}
                  onChange={(e) => setManualCopyHeadline(e.target.value)}
                  placeholder="예: 피부가 기억하는 자연의 힘"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 transition"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  광고 본문 (선택)
                </label>
                <textarea
                  value={manualCopyDescription}
                  onChange={(e) => setManualCopyDescription(e.target.value)}
                  placeholder="예: 제주 녹차밭에서 시작된 순수한 보습, 피부에 스며드는 자연의 에너지"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 transition resize-none"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  플랫폼
                </label>
                <select
                  value={manualCopyPlatform}
                  onChange={(e) => setManualCopyPlatform(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 transition"
                >
                  <option value="naver">네이버</option>
                  <option value="google">구글</option>
                  <option value="meta">메타</option>
                  <option value="kakao">카카오</option>
                </select>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-xs text-yellow-800">
                  직접 입력한 광고 카피는 Supabase에 저장되어 다음 카피 생성 시 참고 자료로 사용됩니다.
                </p>
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setManualCopyModalOpen(false)}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
              >
                취소
              </button>
              <button
                onClick={handleManualCopySubmit}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 font-medium"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

