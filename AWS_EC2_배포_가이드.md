# AWS EC2 배포 가이드

> **광고 소재 문구 생성 시스템** - GitHub에서 AWS EC2로 배포하는 완전 가이드

---

## 목차

1. [사전 준비사항](#1-사전-준비사항)
2. [GitHub 업로드 준비](#2-github-업로드-준비)
3. [GitHub 저장소 생성 및 업로드](#3-github-저장소-생성-및-업로드)
4. [AWS EC2 인스턴스 설정](#4-aws-ec2-인스턴스-설정)
5. [EC2에서 애플리케이션 배포](#5-ec2에서-애플리케이션-배포)
6. [Nginx 웹 서버 설정](#6-nginx-웹-서버-설정)
7. [PM2로 프로세스 관리](#7-pm2로-프로세스-관리)
8. [도메인 연결 (선택사항)](#8-도메인-연결-선택사항)
9. [문제 해결](#9-문제-해결)

---

## 1. 사전 준비사항

### 1.1 필요한 계정 및 도구

- **GitHub 계정**: 소스 코드 저장소
- **AWS 계정**: EC2 인스턴스 생성
- **Git 클라이언트**: 로컬에 설치 필요
- **SSH 클라이언트**: EC2 접속용 (Windows의 경우 PowerShell 또는 PuTTY)

### 1.2 로컬 환경 확인

```powershell
# Git 설치 확인
git --version

# Node.js 버전 확인 (v18 이상 권장)
node --version

# npm 버전 확인
npm --version
```

---

## 2. GitHub 업로드 준비

### 2.1 .gitignore 파일 업데이트

현재 `.gitignore` 파일에 다음 항목들을 추가해야 합니다:

```gitignore
# 의존성
/node_modules
/.pnp
.pnp.js
package-lock.json

# 테스트
/coverage

# Next.js
/.next/
/out/

# 프로덕션
/build

# 환경 변수 (절대 업로드 금지!)
.env
.env*.local
env.local.txt

# 디버그
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# TypeScript
*.tsbuildinfo
next-env.d.ts

# 로그 파일
*.log
server.log

# 테스트 파일
test*.txt
test*.ps1
test*.mjs
test*.js
test*.bat
watch-*.ps1
*.backup

# Drizzle
drizzle/

# 임시 파일
*.tmp
*.temp

# 배포 스크립트 (로컬 전용)
start-server.bat
start-test-server.bat
auto-setup-and-start.bat
ONE-CLICK-START.bat
one-click-start.sh
restart-server.ps1
start-new-environment.ps1
check-environment.bat

# 문서 파일 (선택적 - 업로드 여부는 상황에 따라)
# system docs/
# *.Zip
# superbase.txt
```

### 2.2 GitHub에 업로드할 파일 목록

**✅ 반드시 업로드해야 할 파일:**

```
📁 프로젝트 루트
├── app/                    # Next.js 앱 디렉토리
├── components/             # React 컴포넌트
├── lib/                    # 유틸리티 및 설정
├── src/                    # 소스 코드
├── public/                 # 정적 파일
├── .gitignore             # Git 무시 파일
├── drizzle.config.ts      # Drizzle ORM 설정
├── next.config.mjs        # Next.js 설정
├── package.json           # 프로젝트 의존성
├── postcss.config.mjs     # PostCSS 설정
├── tailwind.config.ts     # Tailwind CSS 설정
├── tsconfig.json          # TypeScript 설정
└── README.md              # 프로젝트 설명
```

**❌ 절대 업로드하면 안 되는 파일:**

```
❌ node_modules/           # npm 패키지
❌ .next/                  # Next.js 빌드 파일
❌ .env.local              # 환경 변수
❌ env.local.txt           # 환경 변수 (API 키 포함!)
❌ *.log                   # 로그 파일
❌ test*.js, test*.ps1     # 테스트 스크립트
❌ *.backup                # 백업 파일
```

### 2.3 환경 변수 파일 생성

GitHub에 업로드할 **템플릿 파일**을 생성합니다:

**파일명: `.env.example`**

```bash
# ===============================================
# 환경 변수 템플릿
# 실제 사용시 .env.local로 복사하여 값을 채워주세요
# ===============================================

# ------------------- Supabase 설정 -------------------
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
DATABASE_URL=your_database_url_here

# ------------------- JWT Secret -------------------
JWT_SECRET=your_jwt_secret_key_here

# ------------------- AI/ML API 키 -------------------

# OpenAI API Keys
OPENAI_API_KEY=your_openai_api_key_here

# Anthropic Claude API Key
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Perplexity API
PERPLEXITY_API_KEY=your_perplexity_api_key_here

# Gemini API Keys (5개)
GEMINI_API_KEY_1=your_gemini_key_1_here
GEMINI_API_KEY_2=your_gemini_key_2_here
GEMINI_API_KEY_3=your_gemini_key_3_here
GEMINI_API_KEY_4=your_gemini_key_4_here
GEMINI_API_KEY_5=your_gemini_key_5_here

# ------------------- 기타 API -------------------

# Replicate API
REPLICATE_API_TOKEN=your_replicate_token_here

# fal.ai API
FAL_KEY=your_fal_key_here
FAL_API_KEY=your_fal_api_key_here

# Kling AI Keys
KLING_ACCESS_KEY=your_kling_access_key_here
KLING_SECRET_KEY=your_kling_secret_key_here

# ------------------- 네이버 API -------------------
NAVER_ACCESS_LICENSE=your_naver_access_license_here
NAVER_SECRET_KEY=your_naver_secret_key_here
NAVER_CUSTOMER_ID=your_naver_customer_id_here

# ------------------- Google API -------------------
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_API_KEY=your_google_api_key_here
```

---

## 3. GitHub 저장소 생성 및 업로드

### 3.1 GitHub 저장소 생성

1. GitHub 웹사이트 접속 (https://github.com)
2. 우측 상단 `+` → `New repository` 클릭
3. 저장소 정보 입력:
   - **Repository name**: `ad-copy-generator` (원하는 이름)
   - **Description**: 광고 소재 문구 생성 시스템
   - **Public** 또는 **Private** 선택 (Private 권장 - 보안상)
   - **Initialize this repository with**: 체크하지 않음
4. `Create repository` 클릭

### 3.2 로컬 Git 초기화 및 업로드

```powershell
# 프로젝트 디렉토리로 이동
cd "C:\Users\a2061\Desktop\Coding\바탕 화면\광고 소제 문구 생성"

# Git 초기화
git init

# 모든 파일 스테이징 (.gitignore에 의해 자동 필터링됨)
git add .

# 첫 커밋
git commit -m "Initial commit: 광고 소재 문구 생성 시스템"

# GitHub 저장소 연결 (your-username을 실제 GitHub 사용자명으로 변경)
git remote add origin https://github.com/your-username/ad-copy-generator.git

# main 브랜치로 변경
git branch -M main

# GitHub에 업로드
git push -u origin main
```

### 3.3 업로드 확인

GitHub 저장소 페이지에서 다음 사항을 확인:
- ✅ `app/`, `components/`, `lib/`, `src/` 디렉토리가 있는지
- ✅ `package.json`, `next.config.mjs` 파일이 있는지
- ❌ `node_modules/`, `.env.local`, `env.local.txt`가 **없는지** 확인

---

## 4. AWS EC2 인스턴스 설정

### 4.1 EC2 인스턴스 생성

1. **AWS Management Console** 접속
2. **EC2** 서비스로 이동
3. **Launch Instance** 클릭

#### 4.1.1 기본 설정

- **Name**: `ad-copy-generator-server` (원하는 이름)
- **AMI**: `Ubuntu Server 22.04 LTS (HVM), SSD Volume Type`
- **Instance type**: 
  - 개발/테스트: `t2.micro` (프리티어)
  - 프로덕션: `t3.medium` 이상 권장 (AI API 사용으로 메모리 필요)
- **Key pair**: 
  - 새로 생성: `ad-copy-key` (이름)
  - `.pem` 파일 다운로드 후 안전한 곳에 보관

#### 4.1.2 네트워크 설정

**Security Group 규칙:**

| Type | Protocol | Port Range | Source | Description |
|------|----------|------------|--------|-------------|
| SSH | TCP | 22 | My IP | SSH 접속 |
| HTTP | TCP | 80 | 0.0.0.0/0 | 웹 트래픽 |
| HTTPS | TCP | 443 | 0.0.0.0/0 | 보안 웹 트래픽 |
| Custom TCP | TCP | 3000 | 0.0.0.0/0 | Next.js 개발 서버 (초기 테스트용) |

#### 4.1.3 스토리지 설정

- **크기**: 최소 20GB 이상 (30GB 권장)
- **볼륨 타입**: `gp3` (General Purpose SSD)

#### 4.1.4 인스턴스 시작

- `Launch Instance` 클릭
- 인스턴스 생성 대기 (약 1-2분)

### 4.2 탄력적 IP 할당 (선택사항이지만 권장)

1. EC2 대시보드 → **Elastic IPs** 클릭
2. **Allocate Elastic IP address** 클릭
3. **Allocate** 클릭
4. 할당된 IP 선택 → **Actions** → **Associate Elastic IP address**
5. 생성한 인스턴스 선택 → **Associate**

---

## 5. EC2에서 애플리케이션 배포

### 5.1 EC2 인스턴스 접속

#### Windows PowerShell에서:

```powershell
# .pem 파일 권한 설정 (처음 한 번만)
icacls "C:\path\to\ad-copy-key.pem" /inheritance:r
icacls "C:\path\to\ad-copy-key.pem" /grant:r "%username%:R"

# SSH 접속 (your-ec2-ip를 실제 EC2 Public IP로 변경)
ssh -i "C:\path\to\ad-copy-key.pem" ubuntu@your-ec2-ip
```

### 5.2 시스템 업데이트 및 기본 패키지 설치

```bash
# 시스템 업데이트
sudo apt update && sudo apt upgrade -y

# 필수 유틸리티 설치
sudo apt install -y git curl wget vim build-essential
```

### 5.3 Node.js 설치 (v18 LTS)

```bash
# NodeSource 저장소 추가
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -

# Node.js 설치
sudo apt install -y nodejs

# 버전 확인
node --version  # v18.x.x
npm --version   # 9.x.x
```

### 5.4 GitHub 저장소 클론

```bash
# 홈 디렉토리로 이동
cd ~

# GitHub 저장소 클론 (your-username을 실제 사용자명으로 변경)
git clone https://github.com/your-username/ad-copy-generator.git

# 프로젝트 디렉토리로 이동
cd ad-copy-generator
```

### 5.5 환경 변수 설정

```bash
# .env.local 파일 생성
nano .env.local
```

**다음 내용을 붙여넣고 실제 값으로 수정:**

```bash
# Supabase 설정
NEXT_PUBLIC_SUPABASE_URL=https://eqpeosahpzyjvnuklvqv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_actual_anon_key_here
DATABASE_URL=postgresql://postgres.eqpeosahpzyjvnuklvqv:your_password@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres

# JWT Secret
JWT_SECRET=production-jwt-secret-change-this-to-secure-random-string

# AI API 키들
OPENAI_API_KEY=your_actual_openai_key
ANTHROPIC_API_KEY=your_actual_anthropic_key
PERPLEXITY_API_KEY=your_actual_perplexity_key

GEMINI_API_KEY_1=your_actual_gemini_key_1
GEMINI_API_KEY_2=your_actual_gemini_key_2
GEMINI_API_KEY_3=your_actual_gemini_key_3
GEMINI_API_KEY_4=your_actual_gemini_key_4
GEMINI_API_KEY_5=your_actual_gemini_key_5

# 기타 API 키들 (사용하는 것만)
REPLICATE_API_TOKEN=your_token_if_needed
FAL_KEY=your_key_if_needed
FAL_API_KEY=your_key_if_needed
```

**저장 및 종료:**
- `Ctrl + X` → `Y` → `Enter`

### 5.6 의존성 설치

```bash
# npm 패키지 설치
npm install

# 설치 확인
npm list --depth=0
```

### 5.7 데이터베이스 마이그레이션 (Supabase)

```bash
# Drizzle 마이그레이션 적용
npm run db:push
```

### 5.8 프로덕션 빌드

```bash
# Next.js 프로덕션 빌드
npm run build

# 빌드 성공 확인
ls -la .next/
```

### 5.9 테스트 실행

```bash
# 프로덕션 모드로 실행 (테스트)
npm start
```

**브라우저에서 확인:**
- `http://your-ec2-ip:3000`

문제없이 작동하면 `Ctrl + C`로 종료

---

## 6. Nginx 웹 서버 설정

### 6.1 Nginx 설치

```bash
# Nginx 설치
sudo apt install -y nginx

# Nginx 상태 확인
sudo systemctl status nginx

# Nginx 시작
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 6.2 Nginx 설정 파일 생성

```bash
# Nginx 설정 파일 생성
sudo nano /etc/nginx/sites-available/ad-copy-generator
```

**다음 내용 붙여넣기:**

```nginx
server {
    listen 80;
    server_name your-ec2-ip;  # EC2 Public IP 또는 도메인

    # 업로드 파일 크기 제한 (이미지 분석용)
    client_max_body_size 10M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 타임아웃 설정 (AI API 응답 대기)
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
```

**저장 및 종료:** `Ctrl + X` → `Y` → `Enter`

### 6.3 Nginx 설정 활성화

```bash
# 심볼릭 링크 생성
sudo ln -s /etc/nginx/sites-available/ad-copy-generator /etc/nginx/sites-enabled/

# 기본 설정 비활성화
sudo rm /etc/nginx/sites-enabled/default

# 설정 테스트
sudo nginx -t

# Nginx 재시작
sudo systemctl restart nginx
```

---

## 7. PM2로 프로세스 관리

### 7.1 PM2 설치

```bash
# PM2 전역 설치
sudo npm install -g pm2

# 버전 확인
pm2 --version
```

### 7.2 PM2로 애플리케이션 시작

```bash
# 프로젝트 디렉토리로 이동
cd ~/ad-copy-generator

# PM2로 Next.js 앱 시작
pm2 start npm --name "ad-copy-generator" -- start

# 상태 확인
pm2 status

# 로그 확인
pm2 logs ad-copy-generator
```

### 7.3 PM2 자동 시작 설정

```bash
# 시스템 부팅 시 PM2 자동 시작
pm2 startup

# 위 명령어 실행 후 나오는 명령어를 복사하여 실행
# 예: sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u ubuntu --hp /home/ubuntu

# 현재 프로세스 저장
pm2 save
```

### 7.4 PM2 유용한 명령어

```bash
# 프로세스 재시작
pm2 restart ad-copy-generator

# 프로세스 중지
pm2 stop ad-copy-generator

# 프로세스 삭제
pm2 delete ad-copy-generator

# 실시간 모니터링
pm2 monit

# 로그 보기
pm2 logs ad-copy-generator --lines 100
```

---

## 8. 도메인 연결 (선택사항)

### 8.1 도메인 DNS 설정

도메인 제공업체(가비아, 카페24, AWS Route 53 등)에서:

**A 레코드 추가:**
- **Type**: A
- **Name**: @ (또는 www)
- **Value**: EC2 Public IP 또는 Elastic IP
- **TTL**: 300 (또는 기본값)

### 8.2 Nginx 설정 업데이트

```bash
sudo nano /etc/nginx/sites-available/ad-copy-generator
```

**server_name 수정:**

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;  # 도메인으로 변경
    # ... 나머지 설정 동일
}
```

```bash
# Nginx 재시작
sudo systemctl restart nginx
```

### 8.3 SSL 인증서 설정 (HTTPS)

```bash
# Certbot 설치
sudo apt install -y certbot python3-certbot-nginx

# SSL 인증서 발급 및 자동 설정
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# 이메일 입력, 약관 동의 후 자동 설정 완료

# 인증서 자동 갱신 테스트
sudo certbot renew --dry-run
```

---

## 9. 문제 해결

### 9.1 포트 3000이 이미 사용 중인 경우

```bash
# 포트 사용 프로세스 확인
sudo lsof -i :3000

# 해당 프로세스 종료
sudo kill -9 <PID>

# 또는 PM2 재시작
pm2 restart ad-copy-generator
```

### 9.2 Nginx 오류 확인

```bash
# Nginx 에러 로그 확인
sudo tail -f /var/log/nginx/error.log

# Nginx 액세스 로그 확인
sudo tail -f /var/log/nginx/access.log
```

### 9.3 애플리케이션 로그 확인

```bash
# PM2 로그 실시간 확인
pm2 logs ad-copy-generator

# 최근 100줄 로그 확인
pm2 logs ad-copy-generator --lines 100

# 에러 로그만 확인
pm2 logs ad-copy-generator --err
```

### 9.4 환경 변수 문제

```bash
# .env.local 파일 확인
cat .env.local

# 환경 변수가 로드되는지 테스트
node -e "require('dotenv').config({ path: '.env.local' }); console.log(process.env.DATABASE_URL);"
```

### 9.5 빌드 오류 발생 시

```bash
# node_modules 삭제 후 재설치
rm -rf node_modules package-lock.json
npm install

# 캐시 삭제 후 재빌드
rm -rf .next
npm run build
```

### 9.6 Supabase 연결 오류

```bash
# Supabase URL 및 키 확인
echo $NEXT_PUBLIC_SUPABASE_URL
echo $NEXT_PUBLIC_SUPABASE_ANON_KEY

# 데이터베이스 연결 테스트
npm run test:db  # (package.json에 스크립트가 있는 경우)
```

### 9.7 메모리 부족 문제

```bash
# 메모리 사용량 확인
free -h

# Swap 파일 생성 (메모리 부족 시)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# 영구 적용
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## 10. 배포 완료 체크리스트

### ✅ GitHub 업로드 확인

- [ ] `.gitignore`에 환경 변수 파일이 포함되어 있는지
- [ ] `env.local.txt` 파일이 GitHub에 업로드되지 않았는지
- [ ] `node_modules/`가 업로드되지 않았는지
- [ ] `.env.example` 템플릿 파일이 업로드되었는지

### ✅ AWS EC2 설정 확인

- [ ] EC2 인스턴스가 정상 실행 중인지
- [ ] Security Group에 HTTP(80), HTTPS(443) 포트가 열려 있는지
- [ ] Elastic IP가 할당되었는지 (선택사항)

### ✅ 애플리케이션 배포 확인

- [ ] Node.js v18 이상이 설치되었는지
- [ ] GitHub 저장소가 클론되었는지
- [ ] `.env.local` 파일에 모든 환경 변수가 설정되었는지
- [ ] `npm install`이 성공적으로 완료되었는지
- [ ] `npm run build`가 성공적으로 완료되었는지

### ✅ 웹 서버 설정 확인

- [ ] Nginx가 설치되고 실행 중인지
- [ ] Nginx 설정 파일이 올바르게 작성되었는지
- [ ] PM2로 애플리케이션이 실행 중인지
- [ ] PM2 자동 시작이 설정되었는지

### ✅ 접속 테스트

- [ ] `http://your-ec2-ip`로 접속이 되는지
- [ ] 로그인/회원가입이 정상 작동하는지
- [ ] 광고 문구 생성 기능이 작동하는지
- [ ] Supabase 데이터베이스 연결이 정상인지

---

## 11. 추가 권장사항

### 11.1 보안 강화

```bash
# UFW 방화벽 설정
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

### 11.2 자동 배포 설정 (GitHub Actions)

프로젝트에 `.github/workflows/deploy.yml` 파일 생성하여 자동 배포 설정 가능

### 11.3 모니터링 설정

```bash
# PM2 모니터링 대시보드 (선택사항)
pm2 install pm2-logrotate

# 로그 로테이션 설정
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
```

### 11.4 정기 백업

```bash
# 데이터베이스 백업 스크립트 생성
mkdir -p ~/backups
nano ~/backup-db.sh
```

```bash
#!/bin/bash
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR=~/backups
mkdir -p $BACKUP_DIR

# Supabase는 자동 백업되지만, 중요 데이터는 별도 백업 권장
echo "Backup completed at $TIMESTAMP"
```

```bash
# 실행 권한 부여
chmod +x ~/backup-db.sh

# cron 작업 추가 (매일 새벽 2시)
crontab -e
# 추가: 0 2 * * * /home/ubuntu/backup-db.sh
```

---

## 12. 참고 자료

- **Next.js 공식 문서**: https://nextjs.org/docs
- **AWS EC2 가이드**: https://docs.aws.amazon.com/ec2/
- **Nginx 공식 문서**: https://nginx.org/en/docs/
- **PM2 공식 문서**: https://pm2.keymetrics.io/docs/
- **Supabase 문서**: https://supabase.com/docs

---

## 문의 및 지원

배포 과정에서 문제가 발생하면 다음을 확인하세요:

1. EC2 인스턴스 로그: `pm2 logs ad-copy-generator`
2. Nginx 에러 로그: `sudo tail -f /var/log/nginx/error.log`
3. 시스템 로그: `sudo journalctl -xe`

---

**작성일**: 2025-11-18  
**버전**: 1.0.0  
**최종 수정**: 초기 작성

