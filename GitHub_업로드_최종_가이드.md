# GitHub 업로드 최종 가이드

> 파일이 너무 많아서 업로드가 안 될 때 - 한 번에 해결하기

---

## 🔴 문제 상황

- GitHub 업로드 시 파일이 너무 많음
- 어떤 파일을 업로드해야 할지 모르겠음
- requirements.txt 같은 파일이 필요한지 궁금함

---

## ✅ 해결 방법

### 1. 의존성 관리 (requirements.txt 대신)

**Node.js 프로젝트는 `package.json`이 Python의 `requirements.txt` 역할을 합니다!**

✅ **이미 완료됨**: `package.json` 파일에 모든 의존성이 정의되어 있습니다.

```json
// package.json (이미 존재)
{
  "dependencies": {
    "@anthropic-ai/sdk": "^0.20.1",      // Claude AI
    "@google/generative-ai": "^0.1.3",   // Gemini AI
    "@mendable/firecrawl-js": "^0.0.19", // Firecrawl
    "@supabase/supabase-js": "^2.39.3",  // Supabase
    "openai": "^4.20.1",                 // OpenAI GPT
    "axios": "^1.6.2",                   // HTTP 클라이언트
    // ... 기타 모듈들
  }
}
```

**EC2에서 설치 방법:**
```bash
npm install
```

---

### 2. .gitignore 업데이트 완료

✅ **이미 완료됨**: 불필요한 파일들이 자동으로 제외되도록 설정했습니다.

**제외되는 파일들:**
- `node_modules/` (용량 큼, npm install로 재설치)
- `.next/` (빌드 파일)
- `env.local.txt` (API 키 보호)
- 테스트 파일들 (test*.js, test*.ps1 등)
- 로컬 스크립트들
- 문서 파일들 (일부)

---

### 3. GitHub 업로드 실행

**방법 1: 자동 스크립트 실행 (권장)**

프로젝트 폴더에서 다음 파일을 더블클릭:

```
GitHub_업로드_실행.bat
```

이 스크립트가 자동으로:
1. Git 초기화
2. 파일 스테이징
3. 중요 파일 확인
4. 첫 커밋 생성

**방법 2: PowerShell에서 직접 실행**

프로젝트 폴더에서 PowerShell 열기 (우클릭 → "여기에 PowerShell 창 열기"):

```powershell
# 1. Git 초기화
git init

# 2. 파일 추가 (.gitignore가 자동으로 필터링)
git add .

# 3. 상태 확인
git status

# 4. 커밋
git commit -m "Initial commit: 광고 소재 문구 생성 시스템"
```

---

### 4. GitHub 저장소 연결

#### 4.1 GitHub에서 새 저장소 생성

1. https://github.com/new 접속
2. Repository name: `ad-copy-generator` (원하는 이름)
3. **Private** 선택 (권장 - API 키 보호)
4. "Create repository" 클릭

#### 4.2 로컬과 연결

```powershell
# GitHub 저장소 연결 (your-username을 실제 사용자명으로 변경)
git remote add origin https://github.com/your-username/ad-copy-generator.git

# main 브랜치로 설정
git branch -M main

# GitHub에 업로드
git push -u origin main
```

---

## 📊 업로드되는 파일 목록

### ✅ 업로드되는 파일 (필수)

```
광고 소제 문구 생성/
├── app/                          ✅ Next.js 앱 (전체)
├── components/                   ✅ React 컴포넌트
├── lib/                          ✅ 유틸리티 라이브러리
├── src/                          ✅ 비즈니스 로직
├── public/                       ✅ 정적 파일
├── scripts/                      ✅ 유틸리티 스크립트
├── .gitignore                    ✅ Git 설정
├── package.json                  ✅ 의존성 관리
├── tsconfig.json                 ✅ TypeScript 설정
├── next.config.mjs               ✅ Next.js 설정
├── tailwind.config.ts            ✅ Tailwind 설정
├── postcss.config.mjs            ✅ PostCSS 설정
├── drizzle.config.ts             ✅ Drizzle 설정
├── env.example.txt               ✅ 환경 변수 템플릿
├── README.md                     ✅ 프로젝트 설명
├── AWS_EC2_배포_가이드.md        ✅ 배포 가이드
├── 배포_빠른_시작_가이드.md      ✅ 빠른 배포
├── 배포_체크리스트.md            ✅ 체크리스트
├── 배포_가이드_모음.md           ✅ 가이드 모음
├── GitHub_업로드_가이드.md       ✅ 업로드 가이드
└── 시스템_아키텍처.md            ✅ 아키텍처 (선택)
```

**예상 파일 개수**: 약 100-150개  
**예상 크기**: 10-15MB

---

### ❌ 업로드 제외되는 파일 (자동)

```
❌ node_modules/         # npm 패키지 (300-500MB)
❌ .next/                # Next.js 빌드
❌ env.local.txt         # 실제 API 키 포함!
❌ .env.local            # 환경 변수
❌ package-lock.json     # 자동 생성
❌ *.log                 # 로그 파일
❌ test*.js              # 테스트 파일
❌ drizzle/              # 마이그레이션 히스토리
❌ system docs/          # 시스템 문서
❌ 개선_완료_요약.md     # 로컬 문서들
❌ 문제해결_가이드.md
❌ 슈퍼베이스_*.md
❌ 시스템_보고서*.md
```

---

## 🔍 업로드 후 확인사항

### GitHub 웹에서 확인

1. ✅ `app/` 디렉토리가 보이는지
2. ✅ `src/` 디렉토리가 보이는지
3. ✅ `package.json`이 있는지
4. ✅ `env.example.txt`가 있는지 (템플릿만)
5. ❌ `node_modules/`가 **없는지** ⚠️
6. ❌ `env.local.txt`가 **없는지** ⚠️
7. ❌ `.next/`가 **없는지** ⚠️

### 파일 검색으로 확인

GitHub 저장소 검색창에서:
- `OPENAI_API_KEY` 검색 → `env.example.txt`에서만 나와야 함 (실제 키 없음)
- `node_modules` 검색 → 결과 없어야 함

---

## 🚀 EC2에서 배포

GitHub 업로드 완료 후 EC2에서:

```bash
# 1. 저장소 클론
git clone https://github.com/your-username/ad-copy-generator.git
cd ad-copy-generator

# 2. 환경 변수 설정
nano .env.local
# (실제 API 키 입력)

# 3. 의존성 설치 (package.json 기반)
npm install

# 4. 빌드
npm run build

# 5. 실행
npm start
```

---

## ⚠️ 중요 주의사항

### 1. API 키 보호

```bash
# ❌ 절대 업로드하면 안 됨
env.local.txt
.env.local
.env

# ✅ 대신 템플릿만 업로드
env.example.txt
```

### 2. node_modules 제외

```bash
# node_modules는 용량이 크므로 (.gitignore에 포함)
# EC2에서 npm install로 재설치
```

### 3. 파일 크기 제한

- **단일 파일**: 100MB 이하
- **저장소 전체**: 1GB 권장

---

## 📝 빠른 체크리스트

### 업로드 전
- [ ] `.gitignore` 파일 확인
- [ ] `env.local.txt`가 `.gitignore`에 포함되어 있는지
- [ ] `package.json`에 모든 의존성이 있는지
- [ ] `env.example.txt` 템플릿 파일 생성

### 업로드 실행
- [ ] `GitHub_업로드_실행.bat` 실행 (또는 수동 명령어)
- [ ] `git status`로 확인
- [ ] `git commit` 완료
- [ ] GitHub 저장소 생성
- [ ] `git push` 완료

### 업로드 후
- [ ] GitHub에서 파일 확인
- [ ] `env.local.txt`가 없는지 확인
- [ ] `node_modules/`가 없는지 확인
- [ ] API 키 검색으로 노출 확인

---

## 🆘 문제 해결

### Q1: "파일이 너무 많습니다" 오류

**해결:** `.gitignore`가 제대로 적용되지 않음

```bash
# Git 캐시 초기화
git rm -r --cached .
git add .
git commit -m "Fix .gitignore"
```

### Q2: node_modules가 업로드됨

**해결:**

```bash
# .gitignore에 추가 확인
echo "node_modules/" >> .gitignore

# Git에서 제거
git rm -r --cached node_modules
git commit -m "Remove node_modules"
git push
```

### Q3: env.local.txt가 업로드됨

**해결:**

```bash
# Git에서 제거
git rm --cached env.local.txt
git commit -m "Remove env.local.txt"
git push

# ⚠️ API 키 즉시 재발급 필요!
```

---

## 📚 추가 문서

- **상세 가이드**: `AWS_EC2_배포_가이드.md`
- **빠른 배포**: `배포_빠른_시작_가이드.md`
- **필수 파일**: `GitHub_업로드_필수_파일_목록.md`
- **모듈 목록**: `의존성_모듈_목록.md`

---

## 🎯 요약

1. **의존성 관리**: `package.json` 사용 (requirements.txt 불필요)
2. **파일 제외**: `.gitignore`로 자동 필터링
3. **업로드**: `GitHub_업로드_실행.bat` 실행
4. **확인**: GitHub에서 보안 파일 노출 확인
5. **배포**: EC2에서 `npm install` 후 실행

---

**작성일**: 2025-11-18  
**버전**: 1.0.0  
**문제 해결**: ✅ 파일이 너무 많아서 업로드 안 되는 문제 해결 완료

