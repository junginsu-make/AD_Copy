# Pltt. AD Copy

**AI 기반 창의적 광고 카피 생성 플랫폼**

자연어 입력, URL 분석, 이미지 분석, 대화형 모드로 다양하고 창의적인 광고 카피를 자동 생성합니다.

---

## 주요 기능

### 멀티 AI 모델
- **GPT-5**: 논리적이고 명확한 카피
- **Gemini 2.5 Pro/Flash**: 창의적이고 감성적인 카피
- **Claude Sonnet 4.5**: 문학적이고 세련된 카피, 대화형 전용

### 3가지 생성 모드
1. **단일 모델** - 빠르고 일관된 스타일 (10개)
2. **멀티 모델** - 다양한 스타일 (15개, 모델당 5개)
3. **다양성 생성** - 8가지 카피 스타일 (24개, 스타일당 3개)

### 8가지 카피 스타일
- 광고 레퍼런스 기반
- 감성적
- 숫자/데이터 기반
- 직관적
- 검증된 (사회적 증명)
- 스토리텔링
- 긴급성 강조
- 프리미엄

### 4가지 입력 방식
1. **자연어 입력** - 자유롭게 설명
2. **URL 분석** - 제품 페이지 URL 입력 시 자동 분석
3. **이미지 분석** - 제품 이미지 업로드 시 AI가 분석
4. **대화형** - AI와 대화하며 점진적으로 개선

### 3가지 독립적인 광고 레퍼런스 수집
1. **네이버 광고**: Firecrawl로 실시간 수집 (최대 30개)
   - 네이버 검색 광고 직접 스크래핑
   
2. **구글 광고**: Firecrawl로 실시간 수집 (최대 30개)
   - 구글 검색 광고 직접 스크래핑
   
3. **Perplexity AI**: 독립적인 광고 트렌드 검색 (최대 30개)
   - 최신 광고 사례 및 바이럴 카피
   - 성공적인 마케팅 캠페인
   - 3가지 소스 종합 평가

**고급 기능**:
- **자동 DB 저장**: 수집한 광고를 자동으로 Supabase에 누적 (최대 90개/요청)
- **의도 기반 필터링**: 사용자 의도에 맞는 광고만 선택
- **수동 카피 입력**: 사용자가 직접 좋은 광고 카피 추가 가능
- **평가 시스템**: 광고 평가로 AI 학습 (1-5점)

---

## 빠른 시작

### 로컬 개발 환경

#### 1. 환경 변수 설정

`.env.local` 파일을 생성하고 다음 변수들을 설정하세요:

```env
# 데이터베이스 (Supabase PostgreSQL)
DATABASE_URL=postgresql://postgres:비밀번호@db.xxx.supabase.co:5432/postgres?sslmode=require
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...

# OpenAI API
OPENAI_API_KEY=sk-proj-...

# Google Gemini API (로테이션 지원)
GEMINI_API_KEY_1=AIzaSy...
GEMINI_API_KEY_2=AIzaSy...
GEMINI_API_KEY_3=AIzaSy...

# Anthropic Claude API
ANTHROPIC_API_KEY=sk-ant-...

# Perplexity API (광고 레퍼런스 수집)
PERPLEXITY_API_KEY=pplx-...

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key-change-this
```

**참고**: 환경 변수 템플릿은 `env.example.txt` 파일을 참고하세요.

#### 2. 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 엽니다.

---

### AWS EC2 배포

프로덕션 환경에 배포하려면 다음 가이드를 참고하세요:

- **📘 [AWS EC2 배포 가이드](./AWS_EC2_배포_가이드.md)** - 상세한 단계별 배포 가이드
- **🚀 [배포 빠른 시작 가이드](./배포_빠른_시작_가이드.md)** - 15분 안에 배포하기
- **✅ [배포 체크리스트](./배포_체크리스트.md)** - 배포 전/후 확인사항

#### 빠른 배포 요약

```bash
# 1. GitHub에 업로드
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/your-username/ad-copy-generator.git
git push -u origin main

# 2. EC2에서 클론 및 설정
ssh ubuntu@your-ec2-ip
git clone https://github.com/your-username/ad-copy-generator.git
cd ad-copy-generator
nano .env.local  # 환경 변수 설정

# 3. 빌드 및 실행
npm install
npm run build
pm2 start npm --name "ad-copy-generator" -- start
```

자세한 내용은 배포 가이드 문서를 참고하세요.

### 3. 사용하기

1. 회원가입 또는 로그인
2. 대시보드에서 "카피 생성" 선택
3. 원하는 입력 방식 선택:
   - **자연어**: "30대 여성용 화장품, 감성적으로"
   - **URL**: "https://www.innisfree.com/..."
   - **이미지**: 제품 이미지 업로드
   - **대화형**: AI와 대화하며 카피 개선
4. 생성된 카피 확인 및 복사

---

## 시스템 구조

### 데이터 흐름

```
사용자 입력
  ↓
의도 추출 (Gemini Flash)
  ↓
광고 레퍼런스 수집 (네이버/구글/Perplexity)
  - 120개 수집 → 의도 필터링 → DB에 자동 저장
  ↓
카피라이팅 전략 수립
  - 공식 선택 (AIDA, FAB 등)
  - 심리 트리거 선택
  - 마스터 스타일 선택
  ↓
멀티 모델 병렬 생성
  - 8가지 스타일 × 3개 = 24개
  ↓
DB에 저장 (실시간 업데이트)
  - copies 테이블: 생성된 카피
  - adReferences 테이블: 수집된 광고
  ↓
결과 반환
```

### 실시간 업데이트 시스템

- **/generate**: 카피 생성
- **/history**: 생성 이력 조회 및 피드백
- **/admin/ad-references**: 광고 레퍼런스 관리 및 평가
- **/admin/statistics**: 통계 대시보드
- **/conversational**: 대화형 카피 생성 (전용)

모든 데이터가 Supabase에 실시간으로 저장되며, 웹에서 즉시 조회 가능합니다.

---

## 주요 특징

### 카피라이팅 이론 기반
- **12가지 공식**: AIDA, FAB, PAS, BAB, 4U's 등
- **24가지 심리 트리거**: 긴급성, 희소성, 사회적 증명 등
- **14명 마스터 스타일**: Gary Halbert, David Ogilvy, Joseph Sugarman 등

### 피드백 기반 학습 시스템
**광고 레퍼런스 평가**:
- 사용자 평가(1-5점)를 학습
- 평점 4-5점 → 성능 점수 +5점 상승
- 평점 1-2점 → 성능 점수 -5점 하락
- 다음 카피 생성 시 고성능 광고 우선 사용

**생성된 카피 평가**:
- 즐겨찾기, 실제 사용 여부 체크
- 평점 4점 이상 → 사용된 광고 레퍼런스 성공 카운트 증가
- CTR/전환율 데이터 입력 가능

### 자동 품질 필터
- UI 요소 제거 (로그인, 메뉴 등)
- 이모지/이모티콘 완전 제거
- 최소 길이 체크 (5자 이상)
- 의도 기반 필터링 (키워드, 타겟, 톤 매칭)

### Admin 관리 페이지
- **광고 레퍼런스 관리**: 수집된 광고 조회, 평가, 수동 추가
- **생성 이력**: 모든 생성 카피 조회 및 피드백
- **통계 대시보드**: 실시간 성과 분석 및 비용 추적

---

## 기술 스택

- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL (Supabase)
- **ORM**: Drizzle ORM
- **AI Models**: OpenAI GPT-5, Google Gemini 2.5, Anthropic Claude 4.5
- **Web Scraping**: Firecrawl API
- **AI Search**: Perplexity AI

---

## 프로젝트 구조

```
.
├── app/                      # Next.js App Router
│   ├── (auth)/              # 로그인/회원가입
│   ├── (dashboard)/         # 대시보드, 카피 생성, 이력
│   │   ├── dashboard/
│   │   ├── generate/
│   │   ├── history/
│   │   ├── conversational/
│   │   └── admin/           # 관리자 페이지
│   ├── api/                 # API Routes
│   │   ├── auth/           # 인증 API
│   │   ├── copies/         # 카피 생성 API
│   │   ├── ad-references/  # 광고 레퍼런스 API
│   │   └── analytics/      # 통계 API
│   └── layout.tsx
├── src/
│   ├── domain/             # 카피라이팅 이론, 플랫폼 규격
│   ├── application/        # 비즈니스 로직
│   │   └── services/       # 핵심 서비스들
│   └── infrastructure/     # AI 프로바이더, DB, 스크래핑
├── lib/                    # 인증, 보안, Supabase 클라이언트
└── components/             # 재사용 컴포넌트
```

---

## API 엔드포인트

### 카피 생성
- `POST /api/copies/generate` - 카피 생성
- `POST /api/copies/conversational` - 대화형 카피 생성
- `GET /api/copies/list` - 생성 이력 조회

### 광고 레퍼런스
- `GET /api/ad-references/list` - 광고 목록 조회
- `POST /api/ad-references/feedback` - 광고 평가
- `GET /api/ad-references/search` - 광고 검색

### 통계
- `GET /api/analytics/summary` - 통계 요약

### 인증
- `POST /api/auth/signup` - 회원가입
- `POST /api/auth/login` - 로그인
- `POST /api/auth/logout` - 로그아웃

---

## 데이터베이스 스키마

### 주요 테이블

- **users**: 사용자 정보 및 할당량
- **copies**: 생성된 카피 저장
- **copyFeedback**: 카피 평가 및 피드백
- **adReferences**: 수집된 광고 레퍼런스
- **conversationSessions**: 대화 세션
- **conversationTurns**: 대화 내역
- **modelUsageLogs**: 모델 사용량 로그
- **analytics**: 통계 데이터
- **fewshotLearningLog**: 학습 로그

---

## 개발 상태

**현재 버전**: v0.1.0

### 완료된 기능
- ✅ 멀티 AI 모델 통합 (GPT-5, Gemini 2.5, Claude 4.5)
- ✅ 3가지 생성 모드 (단일/멀티/다양성)
- ✅ 4가지 입력 방식 (자연어/URL/이미지/대화형)
- ✅ 8가지 카피 스타일
- ✅ 3가지 독립 광고 수집 (네이버/구글/Perplexity)
- ✅ 실제 광고 레퍼런스 자동 수집 및 DB 누적 (최대 90개/요청)
- ✅ 의도 기반 필터링 (키워드, 타겟, 톤)
- ✅ 피드백 기반 학습 시스템
- ✅ 실시간 DB 업데이트 (모든 모드)
- ✅ Admin 페이지 (광고 관리, 통계, 이력)
- ✅ 수동 카피 입력 기능
- ✅ 광고 평가 시스템 (성능 점수 자동 조정)
- ✅ 회원가입/로그인 (Supabase Auth)
- ✅ 공통 네비게이션 바
- ✅ 토큰 비용 계산 및 표시
- ✅ 이모지 완전 제거
- ✅ 대화창 자연스러운 흐름

### 최근 업데이트 (2025-11-18)
- ✅ 광고 수집 방식 개선 (3가지 독립 소스)
- ✅ Perplexity 검색 쿼리 자연어 형태로 변경
- ✅ 대화형 모드 광고 레퍼런스 재수집 방지
- ✅ 모든 생성 모드 DB 저장 및 API 사용량 업데이트
- ✅ 수동 카피 입력 기능 추가
- ✅ UI/UX 대폭 개선 (메인, 로그인, 대시보드 등)
- ✅ 문서 정리 (41개 → 5개)

---

## 라이선스

Private Project

---

## 문의

프로젝트 관련 문의: 정인수 (9843ohs@gmail.com)
