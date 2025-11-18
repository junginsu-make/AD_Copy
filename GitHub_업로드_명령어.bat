@echo off
chcp 65001 > nul
echo ====================================
echo GitHub 업로드 실행
echo ====================================
echo.
echo 저장소: https://github.com/junginsu-make/AD_Copy
echo.

REM GitHub 원격 저장소 연결
echo [1/3] GitHub 저장소 연결 중...
git remote add origin https://github.com/junginsu-make/AD_Copy.git
if errorlevel 1 (
    echo 이미 연결되어 있을 수 있습니다. 계속 진행합니다...
    git remote set-url origin https://github.com/junginsu-make/AD_Copy.git
)
echo GitHub 저장소 연결 완료!
echo.

REM main 브랜치로 설정
echo [2/3] main 브랜치로 설정 중...
git branch -M main
echo main 브랜치 설정 완료!
echo.

REM GitHub에 업로드
echo [3/3] GitHub에 업로드 중...
echo.
echo GitHub 로그인이 필요할 수 있습니다.
echo 브라우저 창이 열리면 로그인하세요.
echo.
git push -u origin main
if errorlevel 1 (
    echo.
    echo ====================================
    echo 업로드 실패!
    echo ====================================
    echo.
    echo 다음을 확인하세요:
    echo 1. GitHub 로그인이 완료되었는지
    echo 2. 저장소 접근 권한이 있는지
    echo 3. 네트워크 연결이 정상인지
    echo.
    pause
    exit /b 1
)

echo.
echo ====================================
echo 업로드 완료!
echo ====================================
echo.
echo 저장소 확인: https://github.com/junginsu-make/AD_Copy
echo.
echo 다음을 확인하세요:
echo 1. app/ 폴더가 있는지
echo 2. src/ 폴더가 있는지
echo 3. package.json이 있는지
echo 4. env.local.txt가 없는지 (중요!)
echo 5. node_modules/가 없는지 (중요!)
echo.

pause

