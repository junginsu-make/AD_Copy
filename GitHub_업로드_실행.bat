@echo off
chcp 65001 > nul
echo ====================================
echo GitHub 업로드 준비 스크립트
echo ====================================
echo.

REM 현재 디렉토리 확인
echo 현재 디렉토리: %cd%
echo.

REM Git 초기화
echo [1/6] Git 초기화 중...
git init
if errorlevel 1 (
    echo Git 초기화 실패!
    pause
    exit /b 1
)
echo Git 초기화 완료!
echo.

REM 모든 파일 스테이징
echo [2/6] 파일 스테이징 중... (.gitignore에 의해 자동 필터링됨)
git add .
if errorlevel 1 (
    echo 파일 스테이징 실패!
    pause
    exit /b 1
)
echo 파일 스테이징 완료!
echo.

REM 스테이징된 파일 확인
echo [3/6] 스테이징된 파일 확인:
echo.
git status
echo.

REM 중요 파일 확인
echo [4/6] 중요 파일 확인 중...
echo.
echo ✅ 반드시 포함되어야 할 파일:
if exist "package.json" (echo   ✓ package.json) else (echo   ✗ package.json 없음!)
if exist "env.example.txt" (echo   ✓ env.example.txt) else (echo   ✗ env.example.txt 없음!)
if exist "README.md" (echo   ✓ README.md) else (echo   ✗ README.md 없음!)
if exist "app\" (echo   ✓ app/) else (echo   ✗ app/ 없음!)
if exist "src\" (echo   ✓ src/) else (echo   ✗ src/ 없음!)
echo.

echo ❌ 절대 포함되면 안 되는 파일 (확인 필요):
if exist "env.local.txt" (echo   ✗ env.local.txt 발견! - 삭제 또는 .gitignore 확인 필요!) else (echo   ✓ env.local.txt 없음 - 안전)
if exist "node_modules\" (echo   ✗ node_modules/ 발견! - .gitignore 확인 필요!) else (echo   ✓ node_modules/ 없음 - 안전)
if exist ".next\" (echo   ✗ .next/ 발견! - .gitignore 확인 필요!) else (echo   ✓ .next/ 없음 - 안전)
echo.

REM 사용자 확인
echo [5/6] 위 내용을 확인하세요!
echo.
echo 계속하려면 아무 키나 누르세요...
echo (취소하려면 창을 닫으세요)
pause > nul

REM 첫 커밋
echo.
echo [6/6] 첫 커밋 생성 중...
git commit -m "Initial commit: 광고 소재 문구 생성 시스템"
if errorlevel 1 (
    echo 커밋 실패!
    pause
    exit /b 1
)
echo 커밋 완료!
echo.

REM 완료 메시지
echo ====================================
echo Git 초기화 완료!
echo ====================================
echo.
echo 다음 단계:
echo.
echo 1. GitHub에서 새 저장소 생성 (https://github.com/new)
echo.
echo 2. 다음 명령어 실행:
echo    git remote add origin https://github.com/your-username/저장소이름.git
echo    git branch -M main
echo    git push -u origin main
echo.
echo 3. 업로드 후 GitHub에서 확인:
echo    - env.local.txt가 없는지 확인
echo    - node_modules/가 없는지 확인
echo    - app/, src/, components/ 등이 있는지 확인
echo.

pause

