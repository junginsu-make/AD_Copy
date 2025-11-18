# GitHub 업로드 가이드

> 광고 소재 문구 생성 시스템을 GitHub에 안전하게 업로드하기

---

## ⚠️ 보안 주의사항

**절대 업로드하면 안 되는 파일:**

```
❌ env.local.txt          # 실제 API 키가 포함된 파일
❌ .env.local             # 환경 변수 파일
❌ .env                   # 환경 변수 파일
❌ node_modules/          # npm 패키지 (용량이 크고 불필요)
❌ .next/                 # Next.js 빌드 파일
```

이러한 파일들은 `.gitignore`에 이미 포함되어 있어 자동으로 제외됩니다.

---

## 📋 업로드 전 체크리스트

### 1. .gitignore 확인

현재 프로젝트의 `.gitignore` 파일이 올바르게 설정되어 있는지 확인:

```bash
# .gitignore 파일 내용 확인
cat .gitignore
```

다음 항목들이 포함되어 있어야 합니다:
- `node_modules/`
- `.env*.local`
- `env.local.txt`
- `.next/`
- `*.log`

### 2. 민감한 정보 확인

```powershell
# 환경 변수 파일이 제외되는지 확인
git status

# 다음 파일들이 "Untracked files"에 나타나지 않아야 합니다:
# - env.local.txt
# - .env.local
# - .env
```

### 3. 환경 변수 템플릿 생성

`env.example.txt` 파일이 생성되었는지 확인:

```bash
# 템플릿 파일 확인
ls env.example.txt
```

---

## 🚀 GitHub 업로드 단계

### Step 1: GitHub 저장소 생성

1. GitHub 웹사이트 접속: https://github.com
2. 우측 상단 `+` 버튼 → `New repository` 클릭
3. 저장소 정보 입력:
   - **Repository name**: `ad-copy-generator` (원하는 이름)
   - **Description**: AI 기반 광고 소재 문구 생성 시스템
   - **Visibility**: 
     - `Private` 권장 (보안상 - API 키 노출 방지)
     - `Public` 선택 시 반드시 환경 변수 파일이 제외되었는지 재확인
   - **Initialize options**: 모두 체크하지 않음
4. `Create repository` 클릭

### Step 2: Git 초기화 및 커밋

```powershell
# 프로젝트 디렉토리로 이동
cd "C:\Users\a2061\Desktop\Coding\바탕 화면\광고 소제 문구 생성"

# Git 초기화
git init

# 현재 상태 확인 (.gitignore가 적용되었는지)
git status

# 모든 파일 스테이징 (.gitignore에 의해 자동 필터링됨)
git add .

# 스테이징된 파일 확인
git status

# ⚠️ 확인사항: 
# - env.local.txt가 스테이징되지 않았는지
# - .env.local이 스테이징되지 않았는지
# - node_modules/가 스테이징되지 않았는지

# 첫 번째 커밋
git commit -m "Initial commit: 광고 소재 문구 생성 시스템"
```

### Step 3: GitHub 저장소 연결

```powershell
# GitHub 저장소 연결 (your-username을 실제 GitHub 사용자명으로 변경)
git remote add origin https://github.com/your-username/ad-copy-generator.git

# main 브랜치로 변경
git branch -M main

# GitHub에 업로드
git push -u origin main
```

**GitHub 인증이 필요한 경우:**
- Personal Access Token (PAT) 사용 권장
- GitHub Settings → Developer settings → Personal access tokens → Generate new token
- 생성된 토큰을 비밀번호로 사용

---

## ✅ 업로드 확인

### 1. GitHub 웹에서 확인

1. GitHub 저장소 페이지 접속
2. 다음 디렉토리/파일이 있는지 확인:
   - ✅ `app/`
   - ✅ `components/`
   - ✅ `lib/`
   - ✅ `src/`
   - ✅ `package.json`
   - ✅ `next.config.mjs`
   - ✅ `README.md`
   - ✅ `env.example.txt`

3. 다음 파일/디렉토리가 **없는지** 확인:
   - ❌ `node_modules/`
   - ❌ `.next/`
   - ❌ `env.local.txt`
   - ❌ `.env.local`
   - ❌ `test*.js`, `test*.ps1`

### 2. 파일 검색으로 확인

GitHub 저장소에서 검색 (상단 검색창):
- `env.local.txt` 검색 → 결과 없어야 함
- `OPENAI_API_KEY` 검색 → `env.example.txt`에서만 템플릿으로 나타나야 함

---

## 🔄 코드 업데이트 (이후)

로컬에서 코드를 수정한 후 GitHub에 업로드:

```powershell
# 변경사항 확인
git status

# 변경된 파일 스테이징
git add .

# 또는 특정 파일만 스테이징
git add app/api/copies/generate/route.ts

# 커밋
git commit -m "기능 추가: 새로운 카피 생성 모드"

# GitHub에 푸시
git push origin main
```

---

## 🛡️ 보안 체크

### 환경 변수 노출 확인

만약 실수로 환경 변수가 업로드되었다면:

```powershell
# ⚠️ 긴급: 커밋 히스토리에서 제거
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch env.local.txt" \
  --prune-empty --tag-name-filter cat -- --all

# 강제 푸시 (주의!)
git push origin --force --all
```

**중요**: API 키가 노출된 경우 즉시 해당 키를 무효화하고 새로 발급받아야 합니다!

---

## 📚 참고사항

### .gitignore 파일 구조

```gitignore
# 의존성
/node_modules

# 환경 변수 (절대 업로드 금지!)
.env
.env*.local
env.local.txt

# Next.js 빌드
/.next/
/out/

# 로그 파일
*.log

# 테스트 파일
test*.js
test*.ps1
```

### 업로드할 파일 vs 제외할 파일

| 카테고리 | 업로드 | 제외 |
|---------|--------|------|
| **소스 코드** | ✅ `app/`, `src/`, `components/`, `lib/` | |
| **설정 파일** | ✅ `package.json`, `tsconfig.json`, `next.config.mjs` | |
| **환경 변수** | ✅ `env.example.txt` (템플릿) | ❌ `env.local.txt`, `.env.local` |
| **의존성** | | ❌ `node_modules/` |
| **빌드** | | ❌ `.next/`, `/out/` |
| **문서** | ✅ `README.md`, 가이드 문서들 | |
| **테스트** | | ❌ `test*.js`, `test*.ps1` |

---

## 🆘 문제 해결

### 문제 1: node_modules가 업로드됨

```powershell
# .gitignore에 추가 확인
echo "/node_modules" >> .gitignore

# Git 캐시에서 제거
git rm -r --cached node_modules

# 커밋 및 푸시
git commit -m "Remove node_modules from tracking"
git push origin main
```

### 문제 2: .env.local이 업로드됨

```powershell
# .gitignore에 추가 확인
echo ".env*.local" >> .gitignore

# Git 캐시에서 제거
git rm --cached .env.local

# 커밋 및 푸시
git commit -m "Remove .env.local from tracking"
git push origin main

# ⚠️ API 키 즉시 재발급 필요!
```

### 문제 3: 파일이 너무 많이 업로드됨

```powershell
# 현재 추적 중인 파일 확인
git ls-files

# 특정 파일 추적 중지
git rm --cached path/to/file

# 전체 재설정 (조심!)
git rm -r --cached .
git add .
git commit -m "Fix .gitignore"
git push origin main --force
```

---

## 📞 추가 도움

- **Git 공식 문서**: https://git-scm.com/doc
- **GitHub 가이드**: https://docs.github.com/
- **.gitignore 생성기**: https://www.toptal.com/developers/gitignore

---

**마지막 업데이트**: 2025-11-18  
**가이드 버전**: 1.0.0

