# EC2 환경 설정 및 배포 가이드

> Node.js 설치부터 애플리케이션 실행까지

---

## 📋 현재 상태

```
✅ EC2 인스턴스 생성
✅ SSH 접속 완료
✅ 시스템 업데이트 완료
```

---

## 1단계: Node.js 설치

### 1-1. NodeSource 저장소 추가

EC2 SSH 접속 상태에서:

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
```

**예상 출력:**
```
## Installing the NodeSource Node.js 18.x repo...
## Populating apt-get cache...
+ apt-get update
...
## Run `sudo apt-get install -y nodejs` to install Node.js 18.x and npm
```

### 1-2. Node.js 설치

```bash
sudo apt install -y nodejs
```

**소요 시간**: 약 1-2분

### 1-3. 설치 확인

```bash
node --version
npm --version
```

**예상 출력:**
```
v18.19.0
9.2.0
```

✅ **Node.js v18 이상이면 성공!**

---

## 2단계: GitHub 저장소 클론

### 2-1. 홈 디렉토리 확인

```bash
cd ~
pwd
```

**출력:**
```
/home/ubuntu
```

### 2-2. GitHub 저장소 클론

```bash
git clone https://github.com/junginsu-make/AD_Copy.git
```

**예상 출력:**
```
Cloning into 'AD_Copy'...
remote: Enumerating objects: 150, done.
remote: Counting objects: 100% (150/150), done.
remote: Compressing objects: 100% (100/100), done.
remote: Total 150 (delta 40), reused 150 (delta 40), pack-reused 0
Receiving objects: 100% (150/150), 1.50 MiB | 5.00 MiB/s, done.
Resolving deltas: 100% (40/40), done.
```

### 2-3. 프로젝트 디렉토리로 이동

```bash
cd AD_Copy
ls -la
```

**예상 출력:**
```
total 100
drwxrwxr-x  8 ubuntu ubuntu  4096 Nov 18 12:00 .
drwxr-x---  5 ubuntu ubuntu  4096 Nov 18 12:00 ..
drwxrwxr-x  6 ubuntu ubuntu  4096 Nov 18 12:00 app
drwxrwxr-x  3 ubuntu ubuntu  4096 Nov 18 12:00 components
-rw-rw-r--  1 ubuntu ubuntu   500 Nov 18 12:00 .gitignore
drwxrwxr-x  5 ubuntu ubuntu  4096 Nov 18 12:00 lib
-rw-rw-r--  1 ubuntu ubuntu  1500 Nov 18 12:00 package.json
drwxrwxr-x  3 ubuntu ubuntu  4096 Nov 18 12:00 src
...
```

✅ **파일들이 보이면 성공!**

---

## 3단계: 환경 변수 설정

### 3-1. .env.local 파일 생성

```bash
nano .env.local
```

**nano 에디터가 열립니다.**

### 3-2. 환경 변수 입력

다음 내용을 **복사하여 붙여넣고** 실제 값으로 수정:

```bash
# ===============================================
# Supabase 설정
# ===============================================
NEXT_PUBLIC_SUPABASE_URL=https://eqpeosahpzyjvnuklvqv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=실제_Supabase_Anon_Key

DATABASE_URL=postgresql://postgres.eqpeosahpzyjvnuklvqv:실제_비밀번호@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres

# ===============================================
# JWT Secret (프로덕션용 - 복잡한 랜덤 문자열 사용)
# ===============================================
JWT_SECRET=production-jwt-secret-change-to-random-string-here

# ===============================================
# AI API 키
# ===============================================

# OpenAI
OPENAI_API_KEY=sk-proj-실제_OpenAI_키

# Anthropic Claude
ANTHROPIC_API_KEY=sk-ant-실제_Anthropic_키

# Perplexity
PERPLEXITY_API_KEY=pplx-실제_Perplexity_키

# Google Gemini (5개)
GEMINI_API_KEY_1=실제_Gemini_키_1
GEMINI_API_KEY_2=실제_Gemini_키_2
GEMINI_API_KEY_3=실제_Gemini_키_3
GEMINI_API_KEY_4=실제_Gemini_키_4
GEMINI_API_KEY_5=실제_Gemini_키_5

# ===============================================
# 기타 API (선택사항)
# ===============================================
REPLICATE_API_TOKEN=필요시_입력
FAL_KEY=필요시_입력
FAL_API_KEY=필요시_입력
KLING_ACCESS_KEY=필요시_입력
KLING_SECRET_KEY=필요시_입력
```

### 3-3. 파일 저장 및 종료

1. **Ctrl + X** (종료)
2. **Y** (저장 확인)
3. **Enter** (파일명 확인)

### 3-4. 환경 변수 파일 확인

```bash
cat .env.local
```

내용이 제대로 저장되었는지 확인

### 3-5. 파일 권한 설정 (보안)

```bash
chmod 600 .env.local
```

**이제 소유자만 읽기/쓰기 가능합니다.**

---

## 4단계: 의존성 설치

### 4-1. npm install 실행

```bash
npm install
```

**소요 시간**: 약 3-5분

**예상 출력:**
```
added 500 packages, and audited 501 packages in 3m

150 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
```

✅ **"found 0 vulnerabilities" 또는 경고 없이 완료되면 성공!**

### 4-2. 설치 확인

```bash
ls -la node_modules | head -20
```

**node_modules 폴더에 패키지들이 설치되었는지 확인**

---

## 5단계: 프로덕션 빌드

### 5-1. Next.js 빌드

```bash
npm run build
```

**소요 시간**: 약 2-3분

**예상 출력:**
```
> pltt-ad-copy@0.1.0 build
> next build

   ▲ Next.js 14.2.5

   Creating an optimized production build ...
 ✓ Compiled successfully
 ✓ Linting and checking validity of types
 ✓ Collecting page data
 ✓ Generating static pages (10/10)
 ✓ Collecting build traces
 ✓ Finalizing page optimization

Route (app)                              Size     First Load JS
┌ ○ /                                    5.2 kB         87.1 kB
├ ○ /api/auth/login                      0 B                0 B
...
○  (Static)  prerendered as static content

✨ Done in 150.35s.
```

✅ **"✓ Compiled successfully" 메시지가 보이면 성공!**

---

## 6단계: PM2 설치 (프로세스 관리자)

### 6-1. PM2 전역 설치

```bash
sudo npm install -g pm2
```

### 6-2. PM2 버전 확인

```bash
pm2 --version
```

**예상 출력:**
```
5.3.0
```

---

## 7단계: 애플리케이션 실행

### 7-1. PM2로 Next.js 시작

```bash
pm2 start npm --name "ad-copy-generator" -- start
```

**예상 출력:**
```
[PM2] Starting /usr/bin/npm in fork_mode (1 instance)
[PM2] Done.
┌────┬────────────────────┬──────────┬──────┬───────────┬──────────┬──────────┐
│ id │ name               │ mode     │ ↺    │ status    │ cpu      │ memory   │
├────┼────────────────────┼──────────┼──────┼───────────┼──────────┼──────────┤
│ 0  │ ad-copy-generator  │ fork     │ 0    │ online    │ 0%       │ 50.0mb   │
└────┴────────────────────┴──────────┴──────┴───────────┴──────────┴──────────┘
```

✅ **"status: online"이면 성공!**

### 7-2. 애플리케이션 상태 확인

```bash
pm2 status
```

### 7-3. 로그 확인

```bash
pm2 logs ad-copy-generator --lines 20
```

**예상 출력:**
```
0|ad-copy-generator  | > pltt-ad-copy@0.1.0 start
0|ad-copy-generator  | > next start
0|ad-copy-generator  | 
0|ad-copy-generator  |   ▲ Next.js 14.2.5
0|ad-copy-generator  |   - Local:        http://localhost:3000
0|ad-copy-generator  |   - Network:      http://0.0.0.0:3000
0|ad-copy-generator  | 
0|ad-copy-generator  |  ✓ Ready in 1.2s
```

✅ **"Ready in X.Xs" 메시지가 보이면 정상 작동!**

로그 보기 종료: **Ctrl + C**

---

## 8단계: 브라우저에서 접속 테스트

### 8-1. EC2 Public IP 확인

AWS Console에서 EC2 Public IP 확인

### 8-2. 브라우저에서 접속

```
http://EC2-Public-IP:3000
```

**예시:**
```
http://13.125.xxx.xxx:3000
```

✅ **광고 소재 문구 생성 시스템 홈페이지가 보이면 성공!**

---

## 9단계: PM2 자동 시작 설정

### 9-1. PM2 startup 설정

```bash
pm2 startup
```

**출력된 명령어 복사 후 실행:**

```bash
# 예시 (실제로는 출력된 명령어를 복사하여 실행)
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

### 9-2. 현재 프로세스 저장

```bash
pm2 save
```

**예상 출력:**
```
[PM2] Saving current process list...
[PM2] Successfully saved in /home/ubuntu/.pm2/dump.pm2
```

✅ **이제 서버 재부팅 시에도 자동으로 애플리케이션이 시작됩니다!**

---

## 10단계: Nginx 설치 및 설정 (선택사항, 권장)

### 10-1. Nginx 설치

```bash
sudo apt install -y nginx
```

### 10-2. Nginx 상태 확인

```bash
sudo systemctl status nginx
```

**"active (running)" 메시지 확인**

### 10-3. Nginx 설정 파일 생성

```bash
sudo nano /etc/nginx/sites-available/ad-copy-generator
```

**다음 내용 입력 (EC2-Public-IP를 실제 IP로 변경):**

```nginx
server {
    listen 80;
    server_name EC2-Public-IP;

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

        # 타임아웃 설정 (AI API 대기)
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
```

저장: **Ctrl + X** → **Y** → **Enter**

### 10-4. Nginx 설정 활성화

```bash
# 심볼릭 링크 생성
sudo ln -s /etc/nginx/sites-available/ad-copy-generator /etc/nginx/sites-enabled/

# 기본 설정 비활성화
sudo rm /etc/nginx/sites-enabled/default

# 설정 테스트
sudo nginx -t
```

**예상 출력:**
```
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

### 10-5. Nginx 재시작

```bash
sudo systemctl restart nginx
```

---

## ✅ 배포 완료!

### 🎉 최종 접속 테스트

이제 **포트 번호 없이** 접속 가능:

```
http://EC2-Public-IP
```

**예시:**
```
http://13.125.xxx.xxx
```

---

## 📊 배포 상태 요약

```
✅ EC2 인스턴스 생성
✅ SSH 접속
✅ Node.js 설치 (v18)
✅ GitHub 저장소 클론
✅ 환경 변수 설정
✅ npm install
✅ npm run build
✅ PM2 실행
✅ PM2 자동 시작 설정
✅ Nginx 설정 (선택)
✅ 브라우저 접속 성공
```

---

## 🔧 유용한 PM2 명령어

```bash
# 상태 확인
pm2 status

# 로그 보기
pm2 logs ad-copy-generator

# 재시작
pm2 restart ad-copy-generator

# 중지
pm2 stop ad-copy-generator

# 삭제
pm2 delete ad-copy-generator

# 실시간 모니터링
pm2 monit
```

---

## 🔄 코드 업데이트 방법

나중에 GitHub에 코드를 업데이트했을 때:

```bash
# SSH 접속
ssh -i "$HOME\.ssh\ad-copy-key.pem" ubuntu@EC2-Public-IP

# 프로젝트 디렉토리
cd ~/AD_Copy

# 최신 코드 받기
git pull

# 의존성 업데이트 (package.json 변경 시)
npm install

# 재빌드
npm run build

# PM2 재시작
pm2 restart ad-copy-generator
```

---

## 🆘 문제 해결

### Q1: "Module not found" 오류

```bash
# node_modules 재설치
rm -rf node_modules package-lock.json
npm install
npm run build
pm2 restart ad-copy-generator
```

### Q2: 환경 변수 오류

```bash
# .env.local 파일 확인
cat .env.local

# 필수 환경 변수 있는지 확인
# 수정
nano .env.local

# PM2 재시작
pm2 restart ad-copy-generator
```

### Q3: 포트 3000이 사용 중

```bash
# 포트 사용 프로세스 확인
sudo lsof -i :3000

# PM2 중지 후 재시작
pm2 stop ad-copy-generator
pm2 start ad-copy-generator
```

### Q4: Nginx 502 Bad Gateway 오류

```bash
# PM2 상태 확인
pm2 status

# PM2 로그 확인
pm2 logs ad-copy-generator

# Next.js가 포트 3000에서 실행 중인지 확인
curl localhost:3000
```

---

## 📝 다음 단계 (선택사항)

1. **도메인 연결**: DNS 설정으로 도메인 연결
2. **SSL 인증서**: Let's Encrypt로 HTTPS 설정
3. **모니터링**: CloudWatch 또는 PM2 Plus 설정
4. **백업**: 자동 백업 스크립트 설정

---

**작성일**: 2025-11-18  
**배포 완료**: ✅  
**접속 URL**: `http://EC2-Public-IP`

