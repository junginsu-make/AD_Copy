# GitHub 업로드 다음 단계

> 커밋 완료 후 실행할 명령어

---

## 📝 현재 상태

✅ Git 초기화 완료  
✅ 파일 스테이징 완료 (122개 파일)  
✅ .gitignore 정상 작동 확인:
  - `env.local.txt` 제외됨
  - `node_modules/` 제외됨
  - `.next/` 제외됨

---

## 🚀 1단계: GitHub 저장소 생성

1. 웹 브라우저에서 접속: https://github.com/new

2. 저장소 정보 입력:
   - **Repository name**: `ad-copy-generator` (원하는 이름)
   - **Description**: 광고 소재 문구 생성 시스템
   - **Visibility**: **Private** 선택 (권장)
   - **Initialize options**: 모두 체크하지 않음

3. **Create repository** 클릭

---

## 🚀 2단계: GitHub에 업로드

커밋이 완료된 후 PowerShell에서 실행:

```powershell
# GitHub 저장소 연결 (your-username을 실제 사용자명으로 변경)
git remote add origin https://github.com/your-username/ad-copy-generator.git

# main 브랜치로 설정
git branch -M main

# GitHub에 업로드
git push -u origin main
```

### GitHub 인증

첫 업로드 시 로그인 창이 나타납니다:
- GitHub 아이디/비밀번호 입력
- 또는 Personal Access Token 사용

---

## ✅ 3단계: 업로드 확인

GitHub 웹사이트에서 저장소 확인:

### 반드시 확인할 사항

1. ✅ `app/` 폴더가 보이는지
2. ✅ `src/` 폴더가 보이는지
3. ✅ `components/` 폴더가 보이는지
4. ✅ `package.json` 파일이 있는지
5. ✅ `env.example.txt` 파일이 있는지

### 절대 없어야 할 파일 (보안!)

1. ❌ `env.local.txt` - **없어야 함!**
2. ❌ `node_modules/` - **없어야 함!**
3. ❌ `.next/` - **없어야 함!**

### 검색으로 확인

GitHub 저장소 검색창에서:
```
OPENAI_API_KEY
```

**결과**: `env.example.txt`에서만 나와야 함 (실제 키 값 없는 템플릿)

---

## 🎉 업로드 완료!

축하합니다! 이제 코드가 GitHub에 안전하게 업로드되었습니다.

---

## 🚀 다음 단계: AWS EC2 배포

### EC2 배포 가이드 문서

1. **빠른 배포** (15분): `배포_빠른_시작_가이드.md`
2. **상세 배포** (40분): `AWS_EC2_배포_가이드.md`

### 배포 요약

```bash
# 1. EC2에 SSH 접속
ssh -i "your-key.pem" ubuntu@your-ec2-ip

# 2. 저장소 클론
git clone https://github.com/your-username/ad-copy-generator.git
cd ad-copy-generator

# 3. 환경 변수 설정
nano .env.local
# (실제 API 키 입력)

# 4. 의존성 설치
npm install

# 5. 빌드
npm run build

# 6. PM2로 실행
pm2 start npm --name "ad-copy-generator" -- start
pm2 startup
pm2 save

# 7. Nginx 설정
# (가이드 문서 참고)
```

---

## 🆘 문제 발생 시

### env.local.txt가 GitHub에 올라갔다면

```bash
# 즉시 제거
git rm env.local.txt
git commit -m "Remove sensitive file"
git push

# ⚠️ API 키 즉시 재발급 필요!
```

### node_modules가 올라갔다면

```bash
# 제거
git rm -r node_modules
git commit -m "Remove node_modules"
git push
```

---

## 📞 추가 도움말

- **GitHub 가이드**: `GitHub_업로드_최종_가이드.md`
- **배포 체크리스트**: `배포_체크리스트.md`
- **의존성 관리**: `의존성_모듈_목록.md`

---

**작성일**: 2025-11-18  
**다음**: AWS EC2 배포

