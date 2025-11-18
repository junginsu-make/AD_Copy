// 대화형 모드 컴포넌트 (generate 페이지 내부용)
"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  copies?: string[];
}

interface ConversationState {
  sessionId: number | null;
  messages: Message[];
  isLoading: boolean;
  suggestions: string[];
}

export function ConversationalModeComponent() {
  const [state, setState] = useState<ConversationState>({
    sessionId: null,
    messages: [],
    isLoading: false,
    suggestions: [],
  });
  
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.messages]);

  const sendMessage = async (message: string) => {
    if (!message.trim()) return;

    const userMessage: Message = {
      role: "user",
      content: message,
      timestamp: new Date(),
    };

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      isLoading: true,
    }));

    setInputValue("");

    try {
      const action = state.sessionId ? "continue" : "start";
      const payload = state.sessionId
        ? { action, sessionId: state.sessionId, message }
        : { action, initialMessage: message, context: {} };

      const response = await fetch("/api/copies/conversational", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "대화 생성 실패");
      }

      const { sessionId, message: assistantMessage, suggestions, copies } = result.data;

      const assistantMsg: Message = {
        role: "assistant",
        content: assistantMessage,
        timestamp: new Date(),
        copies: copies,
      };

      setState(prev => ({
        ...prev,
        sessionId: sessionId || prev.sessionId,
        messages: [...prev.messages, assistantMsg],
        isLoading: false,
        suggestions: suggestions || [],
      }));
    } catch (error: any) {
      console.error("메시지 전송 실패:", error);
      
      const errorMsg: Message = {
        role: "assistant",
        content: `오류가 발생했습니다: ${error.message}`,
        timestamp: new Date(),
      };

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, errorMsg],
        isLoading: false,
      }));
    }
  };

  const startNewConversation = () => {
    setState({
      sessionId: null,
      messages: [],
      isLoading: false,
      suggestions: [],
    });
    setInputValue("");
  };

  const handleSuggestionClick = (suggestion: string) => {
    sendMessage(suggestion);
  };

  return (
    <div>
      {/* 헤더 */}
      <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              🎭 대화형 카피 생성
            </h2>
            <p className="text-gray-600 mt-2">
              Claude Sonnet 4.5와 자연스러운 대화를 통해 완벽한 광고 카피를 만들어보세요
            </p>
          </div>
          {state.sessionId && (
            <button
              onClick={startNewConversation}
              className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg hover:from-indigo-600 hover:to-purple-600 transition-all"
            >
              새 대화 시작
            </button>
          )}
        </div>
        
        {state.sessionId && (
          <div className="mt-4 text-sm text-gray-500">
            세션 ID: {state.sessionId}
          </div>
        )}
      </div>

      {/* 메시지 영역 */}
      <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 min-h-[500px] max-h-[600px] overflow-y-auto">
        {state.messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-6xl mb-4">💬</div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2">
              대화를 시작해보세요
            </h3>
            <p className="text-gray-600 mb-6 max-w-md">
              제품, 타겟 고객, 원하는 톤 등을 자유롭게 말씀해주세요.
              Claude가 자연스러운 대화를 통해 최적의 카피를 만들어드립니다.
            </p>
            <div className="space-y-2">
              <p className="text-sm text-gray-500 font-medium">예시:</p>
              <button
                onClick={() => sendMessage("20대 여성을 위한 프리미엄 스킨케어 제품의 광고 카피를 만들고 싶어요")}
                className="block w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-left text-sm transition-colors"
              >
                "20대 여성을 위한 프리미엄 스킨케어 제품의 광고 카피를 만들고 싶어요"
              </button>
              <button
                onClick={() => sendMessage("감성적이고 임팩트 있는 SNS 광고 문구가 필요해요")}
                className="block w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-left text-sm transition-colors"
              >
                "감성적이고 임팩트 있는 SNS 광고 문구가 필요해요"
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {state.messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    message.role === "user"
                      ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  <div className="whitespace-pre-wrap">{message.content}</div>
                  
                  {message.copies && message.copies.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-300">
                      <p className="font-bold mb-2 text-sm">✨ 생성된 카피:</p>
                      <div className="space-y-2">
                        {message.copies.map((copy, idx) => (
                          <div
                            key={idx}
                            className="bg-white text-gray-800 rounded-lg px-3 py-2 text-sm shadow-sm"
                          >
                            {idx + 1}. {copy}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="text-xs mt-2 opacity-70">
                    {new Date(message.timestamp).toLocaleTimeString('ko-KR')}
                  </div>
                </div>
              </div>
            ))}
            
            {state.isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl px-4 py-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* 제안 버튼들 */}
      {state.suggestions.length > 0 && !state.isLoading && (
        <div className="bg-white rounded-2xl shadow-lg p-4 mb-6">
          <p className="text-sm font-medium text-gray-700 mb-3">💡 이렇게 말해보세요:</p>
          <div className="flex flex-wrap gap-2">
            {state.suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleSuggestionClick(suggestion)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 입력 영역 */}
      <div className="bg-white rounded-2xl shadow-lg p-4">
        <div className="flex space-x-3">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage(inputValue);
              }
            }}
            placeholder={
              state.sessionId
                ? "계속 대화하기..."
                : "무엇을 도와드릴까요? (예: 20대 여성을 위한 화장품 광고 카피를 만들고 싶어요)"
            }
            disabled={state.isLoading}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
          <button
            onClick={() => sendMessage(inputValue)}
            disabled={state.isLoading || !inputValue.trim()}
            className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
          >
            {state.isLoading ? "처리 중..." : "전송"}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Shift + Enter로 줄바꿈, Enter로 전송
        </p>
      </div>
    </div>
  );
}

