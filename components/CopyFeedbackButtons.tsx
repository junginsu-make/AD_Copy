/**
 * 카피 피드백 버튼 컴포넌트
 * 생성된 광고에 대한 사용자 평가를 받는 UI
 */

"use client";

import { useState } from "react";

interface CopyFeedbackButtonsProps {
  copyId: number;
  onFeedbackSubmitted?: () => void;
}

export function CopyFeedbackButtons({ copyId, onFeedbackSubmitted }: CopyFeedbackButtonsProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDetailedFeedback, setShowDetailedFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const feedbackTags = [
    "창의적",
    "감성적",
    "설득력있음",
    "기억에 남음",
    "너무 길어요",
    "너무 짧아요",
    "진부해요",
    "이해하기 어려워요",
  ];

  const handleQuickRating = async (stars: number) => {
    setRating(stars);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/feedback/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          copyId,
          rating: stars,
        }),
      });

      if (!response.ok) {
        throw new Error("피드백 제출 실패");
      }

      console.log("✅ 피드백 제출 완료:", stars, "점");
      onFeedbackSubmitted?.();

    } catch (error) {
      console.error("피드백 제출 오류:", error);
      alert("피드백 제출 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDetailedFeedback = async () => {
    if (!rating) return;
    
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/feedback/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          copyId,
          rating,
          feedbackText: feedbackText || undefined,
          feedbackTags: selectedTags.length > 0 ? selectedTags : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("피드백 제출 실패");
      }

      console.log("✅ 상세 피드백 제출 완료");
      setShowDetailedFeedback(false);
      setFeedbackText("");
      setSelectedTags([]);
      onFeedbackSubmitted?.();

    } catch (error) {
      console.error("피드백 제출 오류:", error);
      alert("피드백 제출 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  return (
    <div className="mt-4 space-y-3">
      {/* 빠른 평가 */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-600">이 광고 어때요?</span>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((stars) => (
            <button
              key={stars}
              onClick={() => handleQuickRating(stars)}
              disabled={isSubmitting}
              className={`text-2xl transition-all ${
                rating && rating >= stars
                  ? "text-yellow-400"
                  : "text-gray-300 hover:text-yellow-300"
              } ${isSubmitting ? "opacity-50 cursor-not-allowed" : "hover:scale-110"}`}
              title={`${stars}점`}
            >
              ⭐
            </button>
          ))}
        </div>
        
        {rating && !showDetailedFeedback && (
          <button
            onClick={() => setShowDetailedFeedback(true)}
            className="text-sm text-blue-600 hover:text-blue-700 underline"
          >
            상세 피드백 추가
          </button>
        )}
      </div>

      {/* 상세 피드백 */}
      {showDetailedFeedback && (
        <div className="p-4 bg-gray-50 rounded-lg space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              이 광고의 특징을 선택해주세요
            </label>
            <div className="flex flex-wrap gap-2">
              {feedbackTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    selectedTags.includes(tag)
                      ? "bg-blue-500 text-white"
                      : "bg-white text-gray-700 border border-gray-300 hover:border-blue-400"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              추가 의견 (선택사항)
            </label>
            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="이 광고에 대한 의견을 자유롭게 작성해주세요..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleDetailedFeedback}
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "제출 중..." : "피드백 제출"}
            </button>
            <button
              onClick={() => setShowDetailedFeedback(false)}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 피드백 완료 메시지 */}
      {rating && !showDetailedFeedback && !isSubmitting && (
        <p className="text-sm text-green-600">
          ✓ 피드백이 저장되었습니다. 품질 향상에 활용됩니다!
        </p>
      )}
    </div>
  );
}

