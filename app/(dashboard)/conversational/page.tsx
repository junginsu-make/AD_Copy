"use client";

import { useState, useRef, useEffect } from "react";
import { Navbar } from "@/components/Navbar";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  copies?: string[];
}

interface ConversationPageState {
  sessionId: number | null;
  messages: Message[];
  isLoading: boolean;
  suggestions: string[];
}

export default function ConversationalPage() {
  const [state, setState] = useState<ConversationPageState>({
    sessionId: null,
    messages: [],
    isLoading: false,
    suggestions: [],
  });
  
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 메시지가 추가될 때마다 스크롤 하단으로
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.messages]);

  // 대화 시작 또는 계속
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

  // 새 대화 시작
  const startNewConversation = () => {
    setState({
      sessionId: null,
      messages: [],
      isLoading: false,
      suggestions: [],
    });
    setInputValue("");
  };

  // 제안 클릭
  const handleSuggestionClick = (suggestion: string) => {
    sendMessage(suggestion);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <Navbar />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">대화형 카피 생성</h1>
            <p className="text-gray-600">
              Claude Sonnet 4.5와 자연스러운 대화를 통해 완벽한 광고 카피를 만들어보세요
            </p>
            {state.sessionId && (
              <p className="text-xs text-gray-500 mt-2">
                세션 ID: {state.sessionId}
              </p>
            )}
          </div>
          {state.sessionId && (
            <button
              onClick={startNewConversation}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 text-sm font-medium"
            >
              새 대화 시작
            </button>
          )}
        </div>

        {/* 메시지 영역 */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 min-h-[500px] max-h-[600px] overflow-y-auto">
          {state.messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mb-6 text-white text-4xl font-bold">
                AI
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                대화를 시작해보세요
              </h2>
              <p className="text-gray-600 mb-6 max-w-md">
                제품, 타겟 고객, 원하는 톤 등을 자유롭게 말씀해주세요.
                Claude가 자연스러운 대화를 통해 최적의 카피를 만들어드립니다.
              </p>
              <div className="space-y-2 w-full max-w-lg">
                <p className="text-sm text-gray-500 font-medium mb-3">예시 질문</p>
                <button
                  onClick={() => sendMessage("20대 여성을 위한 프리미엄 스킨케어 제품의 광고 카피를 만들고 싶어요")}
                  className="block w-full px-4 py-3 bg-gradient-to-r from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 rounded-lg text-left text-sm transition-colors border-2 border-purple-200"
                >
                  "20대 여성을 위한 프리미엄 스킨케어 제품의 광고 카피를 만들고 싶어요"
                </button>
                <button
                  onClick={() => sendMessage("감성적이고 임팩트 있는 SNS 광고 문구가 필요해요")}
                  className="block w-full px-4 py-3 bg-gradient-to-r from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 rounded-lg text-left text-sm transition-colors border-2 border-purple-200"
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
                    {message.role === "assistant" ? (
                      <div className="space-y-2">
                        {(() => {
                          // ---카피--- 와 --------- 사이의 카피 블록 완전 제거
                          let cleanedContent = message.content;
                          
                          // 카피 블록 제거 (여러 패턴 시도)
                          cleanedContent = cleanedContent.replace(/---카피---[\s\S]*?-{5,}/g, '');
                          cleanedContent = cleanedContent.replace(/---카피---[\s\S]*?-{3,}/g, '');
                          
                          // 빈 줄 정리
                          const lines = cleanedContent.split('\n').filter(line => {
                            const trimmed = line.trim();
                            // 구분선만 있는 줄 제거
                            if (trimmed.match(/^-{3,}$/)) return false;
                            // 카피라는 단어만 있는 줄 제거
                            if (trimmed === '카피') return false;
                            return true;
                          });
                          
                          return lines.map((line, idx) => {
                            const trimmed = line.trim();
                            if (!trimmed) return <div key={idx} className="h-1" />;
                            
                            // 제목 (** 또는 ###)
                            if (trimmed.startsWith('**') || trimmed.startsWith('###')) {
                              const text = trimmed.replace(/^###\s*/, '').replace(/\*\*/g, '');
                              return <div key={idx} className="font-semibold text-sm mt-2 mb-1">{text}</div>;
                            }
                            
                            // 리스트
                            if (/^\d+\./.test(trimmed) || trimmed.startsWith('-')) {
                              const text = trimmed.replace(/^\d+\.\s*/, '').replace(/^-\s*/, '');
                              return (
                                <div key={idx} className="ml-3 flex items-start text-sm">
                                  <span className="mr-2 text-purple-500">•</span>
                                  <span>{text}</span>
                                </div>
                              );
                            }
                            
                            // 일반 텍스트
                            return <div key={idx} className="text-sm leading-relaxed">{line}</div>;
                          });
                        })()}
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap">{message.content}</div>
                    )}
                    
                    {/* 카피가 있는 경우 표시 */}
                    {message.copies && message.copies.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-300">
                        <p className="font-bold mb-2 text-sm">생성된 카피:</p>
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
          <div className="bg-white rounded-2xl shadow-lg p-4 mb-6 border-l-4 border-purple-500">
            <p className="text-sm font-semibold text-gray-700 mb-3">이렇게 말해보세요:</p>
            <div className="flex flex-wrap gap-2">
              {state.suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="px-4 py-2 bg-gradient-to-r from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 rounded-lg text-sm transition-colors border border-purple-200"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 입력 영역 */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
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
              className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500 disabled:bg-gray-100 disabled:cursor-not-allowed transition"
            />
            <button
              onClick={() => sendMessage(inputValue)}
              disabled={state.isLoading || !inputValue.trim()}
              className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-semibold shadow-lg"
            >
              {state.isLoading ? "처리 중..." : "전송"}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Enter로 전송, Shift + Enter로 줄바꿈
          </p>
        </div>
      </div>
    </div>
  );
}

