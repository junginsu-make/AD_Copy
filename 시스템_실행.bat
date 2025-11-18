@echo off
chcp 65001 > nul
echo ====================================
echo 광고 소재 문구 생성 시스템 실행
echo ====================================
echo.

REM 현재 디렉토리 확인
echo 프로젝트 디렉토리: %cd%
echo.

REM Node.js 설치 확인
where node >nul 2>nul
if errorlevel 1 (
    echo ❌ Node.js가 설치되어 있지 않습니다!
    echo.
    echo Node.js를 먼저 설치해주세요:
    echo https://nodejs.org
    echo.
    pause
    exit /b 1
)

echo ✅ Node.js 버전:
node --version
npm --version
echo.

REM .env.local 파일 확인
if not exist ".env.local" (
    echo ⚠️ .env.local 파일이 없습니다!
    echo.
    echo env.local.txt 파일을 .env.local로 복사합니다...
    copy env.local.txt .env.local >nul 2>nul
    if errorlevel 1 (
        echo ❌ env.local.txt 파일도 없습니다!
        echo .env.local 파일을 직접 생성해주세요.
        pause
        exit /b 1
    )
    echo ✅ .env.local 파일 생성 완료
    echo.
)

REM node_modules 확인
if not exist "node_modules" (
    echo ⚠️ node_modules가 없습니다. 의존성을 설치합니다...
    echo.
    call npm install
    if errorlevel 1 (
        echo ❌ npm install 실패!
        pause
        exit /b 1
    )
    echo ✅ 의존성 설치 완료
    echo.
)

echo ====================================
echo 🚀 개발 서버 시작 중...
echo ====================================
echo.
echo 서버가 시작되면 자동으로 브라우저가 열립니다.
echo 서버를 중지하려면 Ctrl+C를 누르세요.
echo.

REM 3초 후 브라우저 자동 실행
start "" /B powershell -Command "Start-Sleep -Seconds 5; Start-Process 'http://localhost:3000'"

REM 개발 서버 실행
npm run dev

pause

