@echo off
chcp 65001 > nul
echo ====================================
echo GitHub 코드 업데이트
echo ====================================
echo.

REM 변경된 파일 확인
echo [1/4] 변경된 파일 확인 중...
echo.
git status
echo.

REM 모든 변경사항 스테이징
echo [2/4] 변경사항 스테이징 중...
git add .
echo 완료!
echo.

REM 커밋
echo [3/4] 커밋 생성 중...
echo 커밋 메시지를 입력하세요 (예: UI 개선):
set /p commit_message="> "

if "%commit_message%"=="" (
    set commit_message=코드 업데이트
)

git commit -m "%commit_message%"
if errorlevel 1 (
    echo.
    echo 변경사항이 없거나 커밋 실패!
    pause
    exit /b 1
)
echo 커밋 완료!
echo.

REM GitHub에 푸시
echo [4/4] GitHub에 업로드 중...
git push origin main
if errorlevel 1 (
    echo.
    echo ====================================
    echo 업로드 실패!
    echo ====================================
    echo.
    echo GitHub 로그인을 확인하세요.
    pause
    exit /b 1
)

echo.
echo ====================================
echo ✅ GitHub 업데이트 완료!
echo ====================================
echo.
echo 저장소: https://github.com/junginsu-make/AD_Copy
echo.
echo 다음 단계:
echo EC2 서버도 업데이트하려면 다음 명령어를 실행하세요:
echo.
echo   cd ~/AD_Copy
echo   git pull
echo   pm2 restart ad-copy-generator
echo.

pause

