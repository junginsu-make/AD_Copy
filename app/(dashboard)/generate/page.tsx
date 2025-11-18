"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuthHeaders, getUser, removeToken } from "@/lib/auth/client";
import { Navbar } from "@/components/Navbar";

// 모드 타입 정의 (모두 form 모드로 통합)
type GenerationMode = "form";

interface CopyResult {
  id: number;
  content: string;
  charCount: number;
  generatedAt: string | null;
  modelUsed?: string;
  lengthCategory?: "short" | "medium" | "long";
  recommendedChannel?: string;
  rank?: number;
  rankingReason?: string;
  variety?: string;
  varietyLabel?: string;
}

interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

interface IntentData {
  productName?: string;
  targetAudience?: string;
  tone?: string;
  keyBenefits?: string[];
  emotionalTriggers?: string[];
  visualImagery?: string[];
  storytellingAngle?: string;
}

interface GenerationPayload {
  copies: CopyResult[];
  generationTimeMs: number;
  apiCost: number;
  modelUsed: string;
  modelsUsed?: string[];
  tokenUsage: TokenUsage;
  intent: IntentData;
  urlAnalysis?: {
    url: string;
    title?: string;
    analyzedData?: any;
    extractedInfo?: {
      productName?: string;
      targetAudience?: string;
      tone?: string;
      keyBenefits?: string[];
      keywords?: string[];
      brandVoice?: string;
      existingCopies?: string[];
      keyFeatures?: string[];
      priceRange?: string;
    };
  };
}

type ConversationItem =
  | { id: string; variant: "user" | "assistant"; content: string }
  | { id: string; variant: "result"; content: string; data: GenerationPayload };

const createId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const tones = [
  { value: "neutral", label: "중립" },
  { value: "casual", label: "캐주얼" },
  { value: "formal", label: "공식적" },
  { value: "urgent", label: "긴급" },
  { value: "humorous", label: "유머러스" },
  { value: "professional", label: "전문적" },
];

const models = [
  { value: "", label: "자동 선택" },
  { value: "gpt-5", label: "OpenAI GPT-5" },
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { value: "claude-sonnet-4", label: "Claude Sonnet 4" },
];

const generationModes = [
  { 
    value: "single", 
    label: "단일 모델 (빠름, 일관성)", 
    description: "단일 모델로 빠르게 생성합니다. 속도가 빠르고 일관된 스타일의 카피를 제공합니다." 
  },
  {
    value: "multi",
    label: "멀티 모델 (다양함)",
    description: "3개 모델을 동시에 사용하여 다양한 스타일의 카피를 생성합니다. 각 모델의 강점을 활용한 최적의 결과를 제공합니다."
  },
  {
    value: "variety",
    label: "다양성 생성 (스타일)",
    description: "8가지 카피 스타일 생성합니다."
  },
];

// 8가지 다양성 스타일 정의
const varietyStyles = [
  { id: "ad_reference", label: "광고 레퍼런스" },
  { id: "emotional", label: "감성적" },
  { id: "data_driven", label: "숫자/데이터" },
  { id: "direct", label: "직관적" },
  { id: "trusted", label: "검증된" },
  { id: "storytelling", label: "스토리텔링" },
  { id: "urgent", label: "긴급성 강조" },
  { id: "premium", label: "프리미엄" },
];

// 광고 매체 옵션 (선택적)
const platformOptions = [
  { value: "", label: "플랫폼 무관 (일반 카피)" },
  { value: "naver", label: "네이버 광고 (규격 준수)" },
  { value: "google", label: "구글 광고 (규격 준수)" },
  { value: "kakao", label: "카카오 광고 (규격 준수)" },
];

export default function GeneratePage() {
  const router = useRouter();
  
  // 모드 상태
  const [currentMode, setCurrentMode] = useState<GenerationMode>("form");
  const [inputMode, setInputMode] = useState<"text" | "url" | "image" | "conversational">("text");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ConversationItem[]>([]);
  const [tone, setTone] = useState("");
  const [targetCharCount, setTargetCharCount] = useState<number | "">(""); 
  const [targetPlatform, setTargetPlatform] = useState("");
  const [generationMode, setGenerationMode] = useState<"variety" | "single" | "multi">("variety");
  const [enableReranking, setEnableReranking] = useState(false);
  const [useAdReferences, setUseAdReferences] = useState(true);
  const [loading, setLoading] = useState(false);
  const [systemMessage, setSystemMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  
  // 이미지 업로드 상태
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageAnalysis, setImageAnalysis] = useState<any>(null);
  const [analyzingImage, setAnalyzingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  
  // 대화형 개선 모드 상태
  const [followUpMode, setFollowUpMode] = useState(false);
  const [selectedCopy, setSelectedCopy] = useState<string | null>(null);
  const [followUpSessionId, setFollowUpSessionId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const syncUser = () => {
      setCurrentUser(getUser());
    };

    syncUser();
    window.addEventListener("storage", syncUser);
    return () => window.removeEventListener("storage", syncUser);
  }, []);

  const addMessage = (item: ConversationItem) => {
    setMessages((prev) => [...prev, item]);
  };

  const handleLogout = () => {
    removeToken();
    setCurrentUser(null);
    router.push("/login");
  };

  const buildConversationContext = (extra?: Record<string, unknown>) => {
    const resolvedCharCount =
      typeof targetCharCount === "number" ? targetCharCount : undefined;

    return {
      tone: tone || undefined,
      targetCharCount: resolvedCharCount,
      platform: targetPlatform || undefined,
      useAdReferences,
      ...extra,
    };
  };

  // 이미지 파일 선택 핸들러
  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      setError("이미지 파일은 20MB 이하여야 합니다.");
      return;
    }

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"];
    if (!allowedTypes.includes(file.type)) {
      setError("지원하지 않는 이미지 형식입니다. (JPEG, PNG, WebP, HEIC, HEIF만 가능)");
      return;
    }

    setSelectedImage(file);
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
    
    analyzeImage(file);
  };

  // 이미지 분석 함수
  const analyzeImage = async (file: File) => {
    setAnalyzingImage(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("image", file);
      if (input.trim()) {
        formData.append("prompt", input.trim());
      }

      const response = await fetch("/api/images/analyze", {
        method: "POST",
        headers: getAuthHeaders(),
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "이미지 분석 중 오류가 발생했습니다.");
      }

      const data = await response.json();
      setImageAnalysis(data.analysis);
      setSystemMessage("이미지 분석이 완료되었습니다. 카피를 생성하려면 '생성' 버튼을 클릭하세요.");
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "이미지 분석 중 오류가 발생했습니다.";
      setError(errorMsg);
      setImageAnalysis(null);
    } finally {
      setAnalyzingImage(false);
    }
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setImageAnalysis(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    
    const file = event.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      if (fileInputRef.current) {
        fileInputRef.current.files = dataTransfer.files;
        handleImageSelect({ target: fileInputRef.current } as any);
      }
    }
  };

  // 대화형 모드 전송 핸들러
  const handleConversationalSend = async () => {
    const message = input.trim();
    if (!message) return;

    setInput("");
    setError(null);
    setSystemMessage(null);
    setShowOnboarding(false);

    addMessage({ id: createId(), variant: "user", content: message });
    setLoading(true);

    try {
      const action = followUpSessionId ? "continue" : "start";
      const payload = followUpSessionId
        ? { action, sessionId: followUpSessionId, message }
        : {
            action,
            initialMessage: message,
            context: buildConversationContext(),
          };

      const response = await fetch("/api/copies/conversational", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "대화 생성 실패");
      }

      const { sessionId, message: assistantMessage, copies } = result.data;

      if (sessionId) {
        setFollowUpSessionId(sessionId);
      }

      addMessage({ id: createId(), variant: "assistant", content: assistantMessage });

      if (copies && copies.length > 0) {
        const conversationalResult: GenerationPayload = {
          copies: copies.map((copy: string, idx: number) => ({
            id: Date.now() + idx,
            content: copy,
            charCount: copy.length,
            generatedAt: new Date().toISOString(),
            modelUsed: "claude-sonnet-4-5",
            varietyLabel: "대화형 생성",
          })),
          generationTimeMs: 0,
          apiCost: 0,
          modelUsed: "claude-sonnet-4-5",
          tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          intent: {},
        };
        
        addMessage({
          id: createId(),
          variant: "result",
          content: "대화형 카피 생성",
          data: conversationalResult,
        });
      }

      setSystemMessage("대화를 계속 이어갈 수 있습니다.");
    } catch (err) {
      const messageText = err instanceof Error ? err.message : "대화 중 오류가 발생했습니다.";
      setError(messageText);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (inputMode === "conversational") {
      return handleConversationalSend();
    }
    
    if (inputMode === "image" && !selectedImage) {
      setError("이미지를 먼저 업로드해주세요.");
      return;
    }
    
    if (inputMode === "image" && !imageAnalysis) {
      setError("이미지 분석이 완료될 때까지 기다려주세요.");
      return;
    }

    const message = input.trim();
    if (!message && inputMode !== "image") return;

    setInput("");
    setError(null);
    setSystemMessage(null);
    setShowOnboarding(false);

    const messageId = createId();
    const displayMessage = inputMode === "image" 
      ? `[이미지 업로드] ${message || "이미지 기반 카피 생성"}`
      : message;
    addMessage({ id: messageId, variant: "user", content: displayMessage });
    setLoading(true);

    const payload = {
      prompt: message || (inputMode === "image" ? "이미지를 분석하여 카피를 생성해주세요" : ""),
      tone: tone || undefined,
      targetCharCount: targetCharCount || undefined,
      generationMode,
      targetPlatform: targetPlatform || undefined,
      isUrlInput: inputMode === "url",
      isImageInput: inputMode === "image",
      imageAnalysis: inputMode === "image" ? imageAnalysis : undefined,
      useCopywritingTheory: true,
      useAdReferences: useAdReferences,
      promptStrategy: "comprehensive",
      adReferenceFreshness: 90,
    };

    try {
      const response = await fetch("/api/copies/generate", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "카피 생성 중 오류가 발생했습니다.");
      }

      const data = await response.json();

      addMessage({
        id: createId(),
        variant: "result",
        content: "카피가 생성되었습니다.",
        data: normalizeGenerationPayload(data),
      });
      setSystemMessage("다른 조건으로 다시 생성하려면 새로운 요청을 입력하세요.");
      
      if (inputMode === "image") {
        handleRemoveImage();
      }
    } catch (err) {
      const messageText =
        err instanceof Error ? err.message : "카피 생성 중 오류가 발생했습니다.";
      setError(messageText);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setSystemMessage("클립보드에 복사되었습니다.");
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!loading) {
        handleSend();
      }
    }
  };

  const fillExample = (example: string) => {
    setInput(example);
    setShowOnboarding(false);
  };

  const handleSelectCopy = (copyContent: string) => {
    setSelectedCopy(copyContent);
    setFollowUpMode(true);
    setFollowUpSessionId(null);
    
    // 선택한 카피를 메시지로 추가 (자연스러운 흐름)
    addMessage({
      id: createId(),
      variant: "user",
      content: `이 카피를 개선하고 싶습니다: "${copyContent}"`,
    });
    
    setSystemMessage("카피 개선 모드입니다. 어떻게 개선할지 말씀해주세요.");
    scrollToBottom();
  };

  const handleFollowUpSend = async () => {
    if (!input.trim() || !selectedCopy) return;

    const userMessage = input.trim();
    setInput("");
    setError(null);
    setSystemMessage(null);

    // 사용자 메시지를 일반 메시지에 추가
    addMessage({ id: createId(), variant: "user", content: userMessage });
    setLoading(true);

    try {
      const action = followUpSessionId ? "continue" : "start";
      const payload = followUpSessionId
        ? { 
            action, 
            sessionId: followUpSessionId, 
            message: userMessage 
          }
        : { 
            action, 
            initialMessage: userMessage, 
            context: buildConversationContext({
              selectedCopy,
              improvementRequest: true,
            }),
          };

      const response = await fetch("/api/copies/conversational", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "대화형 개선 실패");
      }

      const { sessionId, message: assistantMessage, copies } = result.data;

      if (sessionId) {
        setFollowUpSessionId(sessionId);
      }

      // 어시스턴트 메시지를 일반 메시지에 추가
      addMessage({ id: createId(), variant: "assistant", content: assistantMessage });

      // 카피가 있으면 결과로 추가
      if (copies && copies.length > 0) {
        const improvementResult: GenerationPayload = {
          copies: copies.map((copy: string, idx: number) => ({
            id: Date.now() + idx,
            content: copy,
            charCount: copy.length,
            generatedAt: new Date().toISOString(),
            modelUsed: "claude-sonnet-4-5",
            variety: "improvement",
            varietyLabel: "개선된 카피",
          })),
          generationTimeMs: 0,
          apiCost: 0,
          modelUsed: "claude-sonnet-4-5",
          tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          intent: {},
        };
        
        addMessage({
          id: createId(),
          variant: "result",
          content: "개선된 카피",
          data: improvementResult,
        });
      }

      setSystemMessage("개선된 카피가 생성되었습니다. 계속 대화를 이어갈 수 있습니다.");
    } catch (err) {
      const messageText =
        err instanceof Error ? err.message : "대화형 개선 중 오류가 발생했습니다.";
      setError(messageText);
    } finally {
      setLoading(false);
    }
  };

  const handleExitFollowUpMode = () => {
    setFollowUpMode(false);
    setSelectedCopy(null);
    setFollowUpSessionId(null);
    setSystemMessage("대화형 개선 모드를 종료했습니다.");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-500 px-3 py-1 bg-blue-50 rounded-full">
              AI 카피라이터
            </span>
          </div>
          <button
            onClick={() => setShowOnboarding((prev) => !prev)}
            className="text-xs font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-full px-3 py-1 transition"
          >
            {showOnboarding ? "가이드 닫기" : "가이드 보기"}
          </button>
        </div>
      </div>

      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div>
        {showOnboarding && (
          <div className="mb-6 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl shadow-xl p-8 text-white">
            <div className="flex items-start space-x-4">
              <div className="flex-1">
                <h2 className="text-2xl font-bold mb-2">Pltt. AD Copy에 오신 것을 환영합니다!</h2>
                <p className="text-blue-100 mb-4">
                  AI가 창의적이고 효과적인 광고 카피를 자동으로 생성합니다. 자연어로 설명하거나 URL만 입력하세요.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                  <button
                    onClick={() => {
                      setInputMode("text");
                      setInput("30대 여성을 위한 프리미엄 안티에이징 크림. 감성적이고 고급스럽게");
                      setShowOnboarding(false);
                    }}
                    className="text-left bg-white/10 hover:bg-white/20 rounded-lg p-3 transition cursor-pointer"
                  >
                    <div className="text-sm font-medium">예시 1: 자연어 입력</div>
                    <div className="text-xs text-blue-100 mt-1">클릭하면 입력창에 예시가 채워집니다</div>
                  </button>
                  <button
                    onClick={() => {
                      setInputMode("conversational");
                      setInput("20대 여성용 화장품 광고를 만들고 싶어요");
                      setShowOnboarding(false);
                    }}
                    className="text-left bg-white/10 hover:bg-white/20 rounded-lg p-3 transition cursor-pointer"
                  >
                    <div className="text-sm font-medium">예시 2: 대화형</div>
                    <div className="text-xs text-blue-100 mt-1">AI와 대화하며 카피 생성</div>
                  </button>
                  <button
                    onClick={() => {
                      setInputMode("url");
                      setInput("https://www.innisfree.com");
                      setShowOnboarding(false);
                    }}
                    className="text-left bg-white/10 hover:bg-white/20 rounded-lg p-3 transition cursor-pointer"
                  >
                    <div className="text-sm font-medium">예시 3: URL 분석</div>
                    <div className="text-xs text-blue-100 mt-1">클릭하면 URL 모드로 전환됩니다</div>
                  </button>
                </div>
                <button
                  onClick={() => setShowOnboarding(false)}
                  className="mt-4 text-sm text-blue-100 hover:text-white underline"
                >
                  건너뛰기
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(300px,1fr)]">
          <section className="bg-white rounded-2xl shadow-lg flex flex-col" style={{ minHeight: "600px" }}>
            <header className="border-b border-gray-100 px-6 py-4">
              <div className="flex items-center justify-between mb-3">
                <h1 className="text-2xl font-bold text-gray-900">카피 생성</h1>
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      setCurrentMode("form");
                      setInputMode("text");
                    }}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
                      currentMode === "form" && inputMode === "text"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    자연어 입력
                  </button>
                  <button
                    onClick={() => {
                      setCurrentMode("form");
                      setInputMode("conversational");
                    }}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
                      inputMode === "conversational"
                        ? "bg-purple-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    대화형
                  </button>
                  <button
                    onClick={() => {
                      setCurrentMode("form");
                      setInputMode("url");
                    }}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
                      currentMode === "form" && inputMode === "url"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    URL 분석
                  </button>
                  <button
                    onClick={() => {
                      setCurrentMode("form");
                      setInputMode("image");
                    }}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
                      currentMode === "form" && inputMode === "image"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    이미지 분석
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-500">
                {inputMode === "text"
                  ? "원하는 카피 방향을 자유롭게 설명해 주세요."
                  : inputMode === "url"
                  ? "제품 페이지 URL을 입력하면 자동으로 분석하여 최적의 카피를 생성합니다."
                  : inputMode === "image"
                  ? "제품 이미지를 업로드하면 AI가 분석하여 맞춤형 카피를 생성합니다."
                  : "AI와 대화하며 카피를 생성하고 개선합니다. 자연스러운 대화로 최적의 카피를 만들어보세요."}
              </p>
            </header>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
              {messages.length === 0 && !showOnboarding && (
                <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-8 text-center">
                  <p className="font-medium text-gray-700 mb-2">시작 팁</p>
                  <div className="text-sm text-gray-600 space-y-2">
                    {inputMode === "text" || inputMode === "conversational" ? (
                      <>
                        <p>• "감성적인 화장품 광고 카피 만들어줘"</p>
                        <p>• "30대 남성용 프리미엄 시계 광고, 짧고 임팩트 있게"</p>
                        <p>• "IT 스타트업 홈페이지 슬로건, 혁신적이고 전문적으로"</p>
                      </>
                    ) : inputMode === "url" ? (
                      <>
                        <p>• 제품 상세 페이지 URL 입력</p>
                        <p>• AI가 자동으로 제품 정보, 타겟, 브랜드 톤 분석</p>
                        <p>• 분석 결과를 바탕으로 최적화된 카피 생성</p>
                      </>
                    ) : (
                      <>
                        <p>• 제품 이미지를 드래그하거나 클릭하여 업로드</p>
                        <p>• AI가 이미지를 분석하여 시각적 요소 파악</p>
                        <p>• 이미지에 맞는 카피 자동 생성</p>
                      </>
                    )}
                  </div>
                </div>
              )}

              {messages.map((item) => {
                if (item.variant === "result") {
                  return <ResultMessage key={item.id} data={item.data} onCopy={handleCopy} onSelectCopy={handleSelectCopy} />;
                }
                const isUser = item.variant === "user";
                return (
                  <div key={item.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-2xl rounded-2xl px-5 py-3 text-sm leading-relaxed shadow-md ${
                        isUser
                          ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                          : "bg-white text-gray-800 border border-gray-200"
                      }`}
                    >
                      {item.content}
                    </div>
                  </div>
                );
              })}

              {loading && (
                <div className="flex justify-center">
                  <div className="flex items-center space-x-3 bg-white rounded-full px-6 py-3 shadow-md border border-gray-100">
                    <div className="flex space-x-1">
                      <span className="inline-flex h-2 w-2 animate-bounce rounded-full bg-blue-500" style={{ animationDelay: "0ms" }} />
                      <span className="inline-flex h-2 w-2 animate-bounce rounded-full bg-purple-500" style={{ animationDelay: "150ms" }} />
                      <span className="inline-flex h-2 w-2 animate-bounce rounded-full bg-pink-500" style={{ animationDelay: "300ms" }} />
                    </div>
                    <span className="text-sm text-gray-600 font-medium">
                      {inputMode === "url" ? "페이지 분석 및 카피 생성 중..." : "창의적인 카피를 생성하고 있습니다..."}
                    </span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            <footer className="border-t border-gray-100 p-4 bg-gray-50">
              {followUpMode && (
                <div className="mb-3 text-xs bg-purple-50 border border-purple-200 rounded-lg px-4 py-2 flex items-center justify-between">
                  <div className="flex items-center">
                    <span className="mr-2 text-purple-600 font-bold">대화형 개선 모드</span>
                    <span className="text-purple-700">선택한 카피를 개선하는 중입니다</span>
                  </div>
                  <button
                    onClick={handleExitFollowUpMode}
                    className="text-xs text-purple-600 hover:text-purple-800 font-medium px-3 py-1 bg-white rounded-lg border border-purple-200 hover:border-purple-300 transition"
                  >
                    종료
                  </button>
                </div>
              )}
              {systemMessage && (
                <div className="mb-3 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 flex items-center">
                  <span className="mr-2">ℹ️</span>
                  {systemMessage}
                </div>
              )}
              {error && (
                <div className="mb-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2 flex items-center">
                  <span className="mr-2">⚠️</span>
                  {error}
                </div>
              )}
              
              {inputMode === "image" && (
                <div className="mb-3">
                  {!selectedImage ? (
                    <div
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition"
                    >
                      <p className="text-sm font-medium text-gray-700 mb-1">
                        이미지를 드래그하거나 클릭하여 업로드
                      </p>
                      <p className="text-xs text-gray-500">
                        JPEG, PNG, WebP, HEIC, HEIF (최대 20MB)
                      </p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif"
                        onChange={handleImageSelect}
                        className="hidden"
                      />
                    </div>
                  ) : (
                    <div className="border-2 border-blue-500 rounded-xl p-4 bg-blue-50">
                      <div className="flex items-start space-x-4">
                        {imagePreview && (
                          <img
                            src={imagePreview}
                            alt="업로드된 이미지"
                            className="w-24 h-24 object-cover rounded-lg"
                          />
                        )}
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium text-gray-900">
                              {selectedImage.name}
                            </p>
                            <button
                              onClick={handleRemoveImage}
                              className="text-red-600 hover:text-red-700 text-sm font-medium"
                            >
                              제거
                            </button>
                          </div>
                          <p className="text-xs text-gray-600 mb-2">
                            {(selectedImage.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                          {analyzingImage && (
                            <div className="flex items-center space-x-2 text-xs text-blue-600">
                              <div className="animate-spin h-3 w-3 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                              <span>이미지 분석 중...</span>
                            </div>
                          )}
                          {imageAnalysis && (
                            <div className="mt-2 text-xs text-green-600 bg-green-50 border border-green-200 rounded px-2 py-1">
                              ✓ 분석 완료
                            </div>
                          )}
                        </div>
                      </div>
                      {imageAnalysis && (
                        <div className="mt-3 pt-3 border-t border-blue-200">
                          <p className="text-xs text-gray-700 mb-2">
                            <strong>AI 분석:</strong> {imageAnalysis.description?.substring(0, 100)}...
                          </p>
                          {imageAnalysis.suggestedKeywords?.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {imageAnalysis.suggestedKeywords.slice(0, 5).map((keyword: string, idx: number) => (
                                <span key={idx} className="text-xs bg-white px-2 py-1 rounded border border-blue-200">
                                  {keyword}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex items-end space-x-3">
                <div className="flex-1">
                  <textarea
                    className="w-full resize-none rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition"
                    rows={3}
                    placeholder={
                      followUpMode
                        ? "카피를 어떻게 개선할까요? (예: 더 감성적으로, 짧게 줄여줘, 가격 정보 추가)"
                        : inputMode === "url"
                        ? "제품 페이지 URL을 입력하세요 (예: https://www.innisfree.com/...)"
                        : inputMode === "image"
                        ? "추가 요구사항을 입력하세요 (선택사항)"
                        : "원하는 카피의 방향을 설명하세요 (Enter 전송, Shift+Enter 줄바꿈)"
                    }
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (!loading) {
                          followUpMode ? handleFollowUpSend() : handleSend();
                        }
                      }
                    }}
                    disabled={loading || analyzingImage}
                  />
                </div>
                <button
                  onClick={followUpMode ? handleFollowUpSend : handleSend}
                  disabled={
                    loading || 
                    analyzingImage || 
                    (followUpMode ? input.trim().length === 0 : (inputMode === "image" ? !imageAnalysis : input.trim().length === 0))
                  }
                  className={`h-12 rounded-xl px-6 text-sm font-medium text-white shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all ${
                    followUpMode
                      ? "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                      : "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  }`}
                >
                  {loading ? "처리 중..." : analyzingImage ? "분석 중..." : followUpMode ? "개선" : "생성"}
                </button>
              </div>
            </footer>
          </section>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-lg">
              <h2 className="text-lg font-bold text-gray-900 mb-1">
                {inputMode === "conversational" ? "대화 설정" : "생성 옵션"}
              </h2>
              <p className="text-xs text-gray-500 mb-4">
                {inputMode === "conversational" 
                  ? "대화형 모드는 AI와 자연스럽게 대화하며 카피를 생성합니다" 
                  : "생성 모드와 기본 조건을 설정하세요"}
              </p>
              
              <div className="space-y-4 text-sm">
                {inputMode !== "conversational" && (
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    생성 모드 
                    <span className="ml-1 text-xs font-normal text-gray-500">(중요)</span>
                  </label>
                  <div className="space-y-2">
                    {generationModes.map((mode) => (
                      <button
                        key={mode.value}
                        onClick={() => setGenerationMode(mode.value as any)}
                        className={`w-full text-left px-4 py-3 rounded-lg border-2 transition relative ${
                          generationMode === mode.value
                            ? "border-blue-500 bg-blue-50 shadow-md"
                            : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        {mode.value === "multi" && (
                          <span className="absolute top-2 right-2 text-xs bg-blue-500 text-white px-2 py-0.5 rounded">
                            추천
                          </span>
                        )}
                        <div className="font-medium text-gray-900">
                          {mode.label}
                          {generationMode === mode.value && " ✓"}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">{mode.description}</div>
                      </button>
                    ))}
                  </div>
                  {generationMode === "variety" && (
                    <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-xs font-semibold text-blue-900 mb-2">8가지 다양성 스타일:</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {varietyStyles.map((style) => (
                      <div key={style.id} className="flex items-start space-x-1">
                        <span className="text-blue-600">•</span>
                        <div>
                          <span className="font-medium text-blue-900">{style.label}</span>
                        </div>
                      </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                )}

                <div className="relative">
                  <label className="mb-2 block text-sm font-semibold text-gray-700">생성 글자수</label>
                  <input
                    type="number"
                    value={targetCharCount}
                    min={5}
                    max={50}
                    placeholder="자동"
                    onChange={(e) => {
                      const value = e.target.value;
                      setTargetCharCount(value === "" ? "" : Number(value));
                    }}
                    className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none transition"
                  />
                  {targetCharCount === "" && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 mt-3">
                      AI가 결정
                    </span>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    목표 글자수를 입력하거나 비워두면 AI가 자동으로 결정합니다 (추천: 30자)
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    톤 (선택사항)
                  </label>
                  <select
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none transition"
                  >
                    <option value="">자동 (AI가 결정)</option>
                    {tones.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    선택하지 않으면 AI가 내용에 맞는 톤을 자동으로 결정합니다
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    광고 매체 (선택사항)
                  </label>
                  <select
                    value={targetPlatform}
                    onChange={(e) => setTargetPlatform(e.target.value)}
                    className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none transition"
                  >
                    {platformOptions.map((platform) => (
                      <option key={platform.value} value={platform.value}>
                        {platform.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    플랫폼 선택 시 해당 규격을 준수한 카피 생성 (글자수, 금지어 등)
                  </p>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <label className="flex items-center space-x-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={useAdReferences}
                      onChange={(e) => setUseAdReferences(e.target.checked)}
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-gray-900">
                        실제 광고 레퍼런스 사용
                        {useAdReferences && (
                          <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                            활성화됨
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {useAdReferences
                          ? "Google/Naver/Perplexity에서 실제 집행 중인 광고를 수집하여 카피 품질을 향상시킵니다. (추천)"
                          : "실제 광고 레퍼런스 없이 기존 시스템으로만 카피를 생성합니다."}
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-md">
              <div className="flex items-center space-x-2 mb-3">
                <h3 className="text-sm font-bold text-amber-900">프로 팁</h3>
              </div>
              <ul className="space-y-2 text-xs text-amber-900">
                <li className="flex items-start">
                  <span className="mr-2 font-bold">•</span>
                  <span><strong>구체적으로</strong> 설명할수록 더 정확한 결과를 얻습니다. 제품 특징, 타겟 고객, 원하는 분위기를 명확히 하세요.</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2 font-bold">•</span>
                  <span><strong>멀티 모델</strong>을 사용하면 3개 모델에서 각각 다른 스타일로 생성하여 더 다양한 후보를 얻을 수 있습니다.</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2 font-bold">•</span>
                  <span><strong>URL 모드</strong>에서는 경쟁사 제품 URL도 입력 가능합니다. AI가 자동으로 분석하여 차별화된 카피를 제안합니다.</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2 font-bold">•</span>
                  <span><strong>이미지 모드</strong>에서는 첨부한 이미지를 상세히 분석하여 시각적 요소에 맞는 카피를 생성합니다.</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2 font-bold">•</span>
                  <span><strong>길이 다양성</strong>: 시스템이 자동으로 짧은/중간/긴 카피를 믹스하여 제공합니다.</span>
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border border-green-200 bg-green-50 p-5 shadow-md">
              <div className="flex items-center space-x-2 mb-3">
                <h3 className="text-sm font-bold text-green-900">창의성 강화 방법</h3>
              </div>
              <ul className="space-y-2 text-xs text-green-900">
                <li className="flex items-start">
                  <span className="mr-2 font-bold">✓</span>
                  <span>감정 키워드 추가: "설렘", "신뢰", "동경" 등</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2 font-bold">✓</span>
                  <span>시각적 이미지: "햇살", "부드러움", "빛나는"</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2 font-bold">✓</span>
                  <span>스토리 각도: "하루의 시작", "변화의 순간"</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2 font-bold">✓</span>
                  <span>금지 요청: "진부한 표현 피해줘", "숫자 없이"</span>
                </li>
              </ul>
            </div>
          </aside>
        </div>
        </div>
      </main>
    </div>
  );
}

function ResultMessage({
  data,
  onCopy,
  onSelectCopy,
}: {
  data: GenerationPayload;
  onCopy: (text: string) => void;
  onSelectCopy: (copyContent: string) => void;
}) {
  const groupedByLength = useMemo(() => {
    const groups: {
      short: CopyResult[];
      medium: CopyResult[];
      long: CopyResult[];
    } = { short: [], medium: [], long: [] };

    for (const copy of data.copies) {
      if (copy.charCount <= 30) {
        groups.short.push(copy);
      } else if (copy.charCount <= 60) {
        groups.medium.push(copy);
      } else {
        groups.long.push(copy);
      }
    }

    return groups;
  }, [data.copies]);

  const hasMultipleModels = data.modelsUsed && data.modelsUsed.length > 1;

  return (
    <div className="space-y-4">
      {data.urlAnalysis && (
        <div className="rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 p-5 shadow-lg">
          <div className="flex items-center space-x-2 mb-3">
            <span className="text-2xl">🌐</span>
            <h3 className="text-lg font-bold text-gray-800">페이지 분석 결과</h3>
          </div>
          
          <div className="space-y-3">
            <div>
              <span className="text-sm font-semibold text-gray-700">URL:</span>
              <a 
                href={data.urlAnalysis.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="ml-2 text-sm text-blue-600 hover:underline break-all"
              >
                {data.urlAnalysis.url}
              </a>
            </div>
            
            {data.urlAnalysis.title && (
              <div>
                <span className="text-sm font-semibold text-gray-700">페이지 제목:</span>
                <p className="mt-1 text-sm text-gray-800">{data.urlAnalysis.title}</p>
              </div>
            )}
            
            {data.urlAnalysis.extractedInfo && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                {data.urlAnalysis.extractedInfo.productName && (
                  <div className="bg-white rounded-lg p-3 border border-green-200">
                    <span className="text-xs font-semibold text-gray-600">제품/서비스명</span>
                    <p className="text-sm text-gray-800 mt-1">{data.urlAnalysis.extractedInfo.productName}</p>
                  </div>
                )}
                
                {data.urlAnalysis.extractedInfo.targetAudience && (
                  <div className="bg-white rounded-lg p-3 border border-green-200">
                    <span className="text-xs font-semibold text-gray-600">타겟 고객</span>
                    <p className="text-sm text-gray-800 mt-1">{data.urlAnalysis.extractedInfo.targetAudience}</p>
                  </div>
                )}
                
                {data.urlAnalysis.extractedInfo.tone && (
                  <div className="bg-white rounded-lg p-3 border border-green-200">
                    <span className="text-xs font-semibold text-gray-600">톤</span>
                    <p className="text-sm text-gray-800 mt-1">{data.urlAnalysis.extractedInfo.tone}</p>
                  </div>
                )}
                
                {data.urlAnalysis.extractedInfo.brandVoice && (
                  <div className="bg-white rounded-lg p-3 border border-green-200">
                    <span className="text-xs font-semibold text-gray-600">브랜드 보이스</span>
                    <p className="text-sm text-gray-800 mt-1">{data.urlAnalysis.extractedInfo.brandVoice}</p>
                  </div>
                )}
                
                {data.urlAnalysis.extractedInfo.keyBenefits && data.urlAnalysis.extractedInfo.keyBenefits.length > 0 && (
                  <div className="bg-white rounded-lg p-3 border border-green-200 md:col-span-2">
                    <span className="text-xs font-semibold text-gray-600">핵심 혜택</span>
                    <ul className="mt-1 text-sm text-gray-800 list-disc list-inside">
                      {data.urlAnalysis.extractedInfo.keyBenefits.map((benefit, idx) => (
                        <li key={idx}>{benefit}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {data.urlAnalysis.extractedInfo.keywords && data.urlAnalysis.extractedInfo.keywords.length > 0 && (
                  <div className="bg-white rounded-lg p-3 border border-green-200 md:col-span-2">
                    <span className="text-xs font-semibold text-gray-600">키워드</span>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {data.urlAnalysis.extractedInfo.keywords.map((keyword, idx) => (
                        <span key={idx} className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {data.urlAnalysis.extractedInfo.keyFeatures && data.urlAnalysis.extractedInfo.keyFeatures.length > 0 && (
                  <div className="bg-white rounded-lg p-3 border border-green-200 md:col-span-2">
                    <span className="text-xs font-semibold text-gray-600">주요 특징</span>
                    <ul className="mt-1 text-sm text-gray-800 list-disc list-inside">
                      {data.urlAnalysis.extractedInfo.keyFeatures.map((feature, idx) => (
                        <li key={idx}>{feature}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {data.urlAnalysis.extractedInfo.existingCopies && data.urlAnalysis.extractedInfo.existingCopies.length > 0 && (
                  <div className="bg-white rounded-lg p-3 border border-green-200 md:col-span-2">
                    <span className="text-xs font-semibold text-gray-600">기존 카피</span>
                    <ul className="mt-1 text-sm text-gray-800 space-y-1">
                      {data.urlAnalysis.extractedInfo.existingCopies.map((copy, idx) => (
                        <li key={idx} className="italic">"{copy}"</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 px-5 py-4 text-white shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-4 text-sm">
            <span className="font-semibold">
              {hasMultipleModels ? `${data.modelsUsed!.length}개 모델 사용` : modelLabel(data.modelUsed)}
            </span>
            <span>토큰 {data.tokenUsage.totalTokens.toLocaleString()}개</span>
            <span>비용 ${data.apiCost.toFixed(4)}</span>
            <span>{(data.generationTimeMs / 1000).toFixed(1)}초</span>
          </div>
        </div>
        {data.intent && (
          <div className="mt-3 text-xs text-blue-100 flex flex-wrap gap-2">
            {data.intent.targetAudience && (
              <span className="bg-white/20 px-2 py-1 rounded">타겟: {data.intent.targetAudience}</span>
            )}
            {data.intent.tone && (
              <span className="bg-white/20 px-2 py-1 rounded">톤: {data.intent.tone}</span>
            )}
            {data.intent.emotionalTriggers && data.intent.emotionalTriggers.length > 0 && (
              <span className="bg-white/20 px-2 py-1 rounded">
                감정: {data.intent.emotionalTriggers.join(", ")}
              </span>
            )}
          </div>
        )}
      </div>

      {groupedByLength.short.length > 0 && (
        <LengthGroup
          title="짧은 카피 (SNS/해시태그용)"
          icon=""
          copies={groupedByLength.short}
          color="blue"
          onCopy={onCopy}
          onSelectCopy={onSelectCopy}
        />
      )}

      {groupedByLength.medium.length > 0 && (
        <LengthGroup
          title="중간 카피 (배너/광고용)"
          icon=""
          copies={groupedByLength.medium}
          color="purple"
          onCopy={onCopy}
          onSelectCopy={onSelectCopy}
        />
      )}

      {groupedByLength.long.length > 0 && (
        <LengthGroup
          title="긴 카피 (블로그/상세설명용)"
          icon="📝"
          copies={groupedByLength.long}
          color="pink"
          onCopy={onCopy}
          onSelectCopy={onSelectCopy}
        />
      )}
    </div>
  );
}

function LengthGroup({
  title,
  icon,
  copies,
  color,
  onCopy,
  onSelectCopy,
}: {
  title: string;
  icon: string;
  copies: CopyResult[];
  color: "blue" | "purple" | "pink";
  onCopy: (text: string) => void;
  onSelectCopy: (copyContent: string) => void;
}) {
  const colorClasses = {
    blue: "border-blue-200 bg-blue-50",
    purple: "border-purple-200 bg-purple-50",
    pink: "border-pink-200 bg-pink-50",
  };

  const badgeColors = {
    blue: "bg-blue-100 text-blue-700",
    purple: "bg-purple-100 text-purple-700",
    pink: "bg-pink-100 text-pink-700",
  };

  return (
    <div className={`rounded-xl border-2 ${colorClasses[color]} p-4`}>
      <div className="flex items-center space-x-2 mb-3">
        <span className="text-xl">{icon}</span>
        <h3 className="font-bold text-gray-900">{title}</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full ${badgeColors[color]}`}>
          {copies.length}개
        </span>
      </div>
      <div className="space-y-3">
        {copies.map((copy, idx) => (
          <div
            key={copy.id ?? idx}
            className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center space-x-2 text-xs flex-wrap gap-1">
                <span className="font-bold text-gray-700">#{copy.rank ?? idx + 1}</span>
                <span className="text-gray-500">{copy.charCount}자</span>
                {copy.modelUsed && (
                  <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">
                    {modelLabel(copy.modelUsed)}
                  </span>
                )}
                {copy.varietyLabel && (
                  <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">
                    {copy.varietyLabel}
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onSelectCopy(copy.content)}
                  className="text-xs font-medium text-purple-600 hover:text-purple-700 hover:underline"
                  title="이 카피를 대화형으로 개선하기"
                >
                  개선하기
                </button>
                <button
                  onClick={() => onCopy(copy.content)}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
                >
                  복사
                </button>
              </div>
            </div>
            <p className="text-base text-gray-900 leading-relaxed mb-2">{copy.content}</p>
            {copy.recommendedChannel && (
              <div className="text-xs text-gray-500">
                추천 채널: {copy.recommendedChannel}
              </div>
            )}
            {copy.rankingReason && (
              <div className="mt-2 text-xs text-purple-700 bg-purple-50 border border-purple-200 rounded px-2 py-1">
                {copy.rankingReason}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function modelLabel(model: string) {
  const labels: Record<string, string> = {
    "gpt-5": "GPT-5",
    "gpt-4o": "GPT-4o",
    "gpt-4.1": "GPT-4.1",
    "gemini-2.5-pro": "Gemini Pro",
    "gemini-2.5-flash": "Gemini Flash",
    "claude-sonnet-4": "Claude",
    "claude-sonnet-4-5": "Claude 4.5",
    "claude-3-5-sonnet": "Claude 3.5",
    "claude-opus-4-1": "Claude Opus 4.1",
    "claude-haiku-4-5": "Claude Haiku 4.5",
    "multi-model": "멀티모델",
  };
  return labels[model] ?? model;
}

function normalizeGenerationPayload(raw: any): GenerationPayload {
  return {
    copies: Array.isArray(raw?.copies)
      ? raw.copies.map((copy: any, idx: number) => ({
          id: typeof copy?.id === "number" ? copy.id : idx,
          content: String(copy?.content ?? "").trim(),
          charCount:
            typeof copy?.charCount === "number"
              ? copy.charCount
              : String(copy?.content ?? "").trim().length,
          generatedAt: copy?.generatedAt ?? null,
          modelUsed: copy?.modelUsed,
          lengthCategory: copy?.lengthCategory,
          recommendedChannel: copy?.recommendedChannel,
          rank: copy?.rank,
          rankingReason: copy?.rankingReason,
          variety: copy?.variety,
          varietyLabel: copy?.varietyLabel,
        }))
      : [],
    generationTimeMs: Number(raw?.generationTimeMs ?? 0),
    apiCost: Number(raw?.apiCost ?? 0),
    modelUsed: raw?.modelUsed ?? "unknown",
    modelsUsed: raw?.modelsUsed,
    tokenUsage: {
      promptTokens: Number(raw?.tokenUsage?.promptTokens ?? 0),
      completionTokens: Number(raw?.tokenUsage?.completionTokens ?? 0),
      totalTokens: Number(raw?.tokenUsage?.totalTokens ?? 0),
    },
    urlAnalysis: raw?.urlAnalysis,
    intent: normalizeIntent(raw?.intent),
  };
}

function normalizeIntent(raw: any): IntentData {
  if (!raw || typeof raw !== "object") {
    return {};
  }

  const toStringArray = (value: unknown): string[] => {
    if (Array.isArray(value)) {
      return value.map((item) => String(item).trim()).filter(Boolean);
    }
    return [];
  };

  return {
    productName: typeof raw.productName === "string" ? raw.productName : undefined,
    targetAudience: typeof raw.targetAudience === "string" ? raw.targetAudience : undefined,
    tone: typeof raw.tone === "string" ? raw.tone : undefined,
    keyBenefits: toStringArray(raw.keyBenefits),
    emotionalTriggers: toStringArray(raw.emotionalTriggers),
    visualImagery: toStringArray(raw.visualImagery),
    storytellingAngle: typeof raw.storytellingAngle === "string" ? raw.storytellingAngle : undefined,
  };
}

