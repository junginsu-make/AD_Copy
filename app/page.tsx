import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <h1 className="text-6xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-6">
            Pltt. AD Copy
          </h1>
          <p className="text-2xl text-gray-800 mb-3 font-semibold">
            AI 기반 창의적 광고 카피 생성 플랫폼
          </p>
          <p className="text-lg text-gray-600 mb-8">
            100년 검증된 카피라이팅 이론 + 실제 광고 데이터 + 최신 AI 모델
          </p>
          
          <Link href="/generate">
            <button className="px-12 py-5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl hover:from-blue-700 hover:to-purple-700 shadow-2xl hover:shadow-3xl transition-all transform hover:-translate-y-1 text-xl font-bold">
              지금 바로 시작하기
            </button>
          </Link>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mb-4 text-white text-3xl">
              AI
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">멀티 AI 모델</h3>
            <p className="text-sm text-gray-600">
              GPT-5, Gemini 2.5, Claude 4.5 등 최신 AI 모델 통합
            </p>
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mb-4 text-white text-3xl">
              DB
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">실제 광고 레퍼런스</h3>
            <p className="text-sm text-gray-600">
              네이버·구글에서 실시간 광고 데이터 수집 및 분석
            </p>
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition">
            <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-pink-600 rounded-2xl flex items-center justify-center mb-4 text-white text-3xl">
              8
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">8가지 스타일</h3>
            <p className="text-sm text-gray-600">
              감성적, 데이터 기반, 스토리텔링 등 다양한 카피 스타일
            </p>
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition">
            <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center mb-4 text-white text-3xl">
              4
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">4가지 입력 방식</h3>
            <p className="text-sm text-gray-600">
              자연어, URL, 이미지, 대화형 모두 지원
            </p>
          </div>
        </div>

        <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-3xl shadow-2xl p-12 mb-16 text-white">
          <h2 className="text-3xl font-bold mb-6 text-center">주요 기능</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white/10 backdrop-blur rounded-xl p-6">
              <h3 className="text-xl font-bold mb-3">자연어 입력</h3>
              <p className="text-blue-100 text-sm leading-relaxed">
                "30대 여성용 화장품, 감성적으로"처럼 자유롭게 설명하면 AI가 이해하고 최적화된 카피를 생성합니다.
              </p>
            </div>
            
            <div className="bg-white/10 backdrop-blur rounded-xl p-6">
              <h3 className="text-xl font-bold mb-3">URL 분석</h3>
              <p className="text-blue-100 text-sm leading-relaxed">
                제품 페이지 URL만 입력하면 AI가 자동으로 분석하여 브랜드 톤에 맞는 카피를 생성합니다.
              </p>
            </div>
            
            <div className="bg-white/10 backdrop-blur rounded-xl p-6">
              <h3 className="text-xl font-bold mb-3">이미지 분석</h3>
              <p className="text-blue-100 text-sm leading-relaxed">
                제품 이미지를 업로드하면 AI가 시각적 요소를 분석하여 이미지에 어울리는 카피를 작성합니다.
              </p>
            </div>
            
            <div className="bg-white/10 backdrop-blur rounded-xl p-6">
              <h3 className="text-xl font-bold mb-3">대화형 생성</h3>
              <p className="text-blue-100 text-sm leading-relaxed">
                AI와 대화하며 카피를 점진적으로 개선하고 완성도를 높일 수 있습니다.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-12 mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">강력한 기능</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4 text-white text-2xl font-bold">
                8
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">8가지 카피 스타일</h3>
              <p className="text-sm text-gray-600">
                광고 레퍼런스, 감성적, 데이터 기반, 직관적, 검증된, 스토리텔링, 긴급성, 프리미엄
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4 text-white text-2xl font-bold">
                3
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">3가지 생성 모드</h3>
              <p className="text-sm text-gray-600">
                단일 모델(빠름), 멀티 모델(다양함), 다양성 생성(스타일별)
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-pink-500 to-red-500 rounded-full flex items-center justify-center mx-auto mb-4 text-white text-2xl font-bold">
                AI
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">피드백 기반 학습</h3>
              <p className="text-sm text-gray-600">
                사용자 평가를 학습하여 점점 더 나은 카피를 생성합니다
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-3xl shadow-lg p-12 text-center border-2 border-blue-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            더 많은 기능을 원하시나요?
          </h2>
          <p className="text-gray-600 mb-6">
            회원가입하고 생성 이력, 피드백, 통계 등 고급 기능을 이용하세요
          </p>
          <div className="flex justify-center space-x-4">
            <Link
              href="/login"
              className="px-8 py-3 bg-white text-gray-800 rounded-xl hover:bg-gray-100 transition font-semibold shadow-md border-2 border-gray-200"
            >
              로그인
            </Link>
            <Link
              href="/signup"
              className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition font-semibold shadow-md"
            >
              회원가입
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

