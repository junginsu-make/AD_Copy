# EC2 SSH 접속 가이드 (Windows)

> EC2 인스턴스에 처음 접속하기

---

## 📋 사전 준비물

- [x] EC2 인스턴스 생성 완료 (이전 단계)
- [x] `ad-copy-key.pem` 파일 다운로드 완료
- [x] EC2 Public IP 주소 확인

---

## 1단계: 키 파일(.pem) 준비

### 1-1. 키 파일 위치 확인

다운로드한 `ad-copy-key.pem` 파일을 찾으세요.

**권장 저장 위치:**
```
C:\Users\사용자명\.ssh\ad-copy-key.pem
```

### 1-2. .ssh 폴더 생성 (없는 경우)

PowerShell에서 실행:

```powershell
# .ssh 폴더 생성
mkdir $HOME\.ssh

# 키 파일 이동 (다운로드 폴더에서)
Move-Item "$HOME\Downloads\ad-copy-key.pem" "$HOME\.ssh\ad-copy-key.pem"
```

### 1-3. 키 파일 권한 설정 (Windows)

PowerShell에서 실행:

```powershell
# 키 파일 경로로 이동
cd $HOME\.ssh

# 파일 권한 설정 (보안)
icacls ad-copy-key.pem /inheritance:r
icacls ad-copy-key.pem /grant:r "$($env:USERNAME):R"
```

**성공 메시지:**
```
processed file: ad-copy-key.pem
Successfully processed 1 files; Failed processing 0 files
```

---

## 2단계: EC2 Public IP 주소 확인

### 2-1. AWS Console에서 확인

1. EC2 대시보드 → **Instances** 클릭
2. 생성한 인스턴스 선택
3. 하단 Details 탭에서 **Public IPv4 address** 확인
   ```
   예: 13.125.xxx.xxx
   ```
4. IP 주소 복사

---

## 3단계: SSH 접속 (PowerShell)

### 3-1. PowerShell 열기

1. **Windows 키** 누르기
2. **"PowerShell"** 검색
3. **Windows PowerShell** 실행

### 3-2. SSH 명령어 실행

**형식:**
```powershell
ssh -i "키파일경로" ubuntu@EC2-Public-IP
```

**실제 예시:**
```powershell
ssh -i "$HOME\.ssh\ad-copy-key.pem" ubuntu@13.125.xxx.xxx
```

**⚠️ 주의:**
- `ubuntu@` 부분 그대로 유지 (Ubuntu AMI의 기본 사용자명)
- `13.125.xxx.xxx`를 실제 EC2 Public IP로 변경

### 3-3. 첫 접속 시 경고 메시지

처음 접속하면 다음 메시지가 나타납니다:

```
The authenticity of host '13.125.xxx.xxx' can't be established.
ECDSA key fingerprint is SHA256:xxxxxxxxxxxxxxxxxxxx.
Are you sure you want to continue connecting (yes/no/[fingerprint])?
```

**`yes` 입력 후 Enter**

### 3-4. 접속 성공 확인

성공하면 다음과 같은 화면이 나타납니다:

```
Welcome to Ubuntu 22.04.3 LTS (GNU/Linux 6.2.0-1017-aws x86_64)

 * Documentation:  https://help.ubuntu.com
 * Management:     https://landscape.canonical.com
 * Support:        https://ubuntu.com/advantage

  System information as of Mon Nov 18 12:00:00 UTC 2025

  System load:  0.0               Processes:             95
  Usage of /:   5.1% of 29.02GB   Users logged in:       0
  Memory usage: 20%               IPv4 address for eth0: 172.31.x.x
  Swap usage:   0%

ubuntu@ip-172-31-x-x:~$
```

**✅ 접속 성공!**

프롬프트가 `ubuntu@ip-xxx:~$`로 바뀌면 성공입니다.

---

## 4단계: 시스템 업데이트

### 4-1. 패키지 목록 업데이트

```bash
sudo apt update
```

**예상 출력:**
```
Hit:1 http://ap-northeast-2.ec2.archive.ubuntu.com/ubuntu jammy InRelease
Get:2 http://ap-northeast-2.ec2.archive.ubuntu.com/ubuntu jammy-updates InRelease
...
Reading package lists... Done
Building dependency tree... Done
```

### 4-2. 시스템 업그레이드

```bash
sudo apt upgrade -y
```

**소요 시간**: 약 2-5분

**완료 메시지:**
```
...
Setting up ...
Processing triggers for ...
```

---

## 5단계: 필수 유틸리티 설치

```bash
sudo apt install -y git curl wget vim build-essential
```

**설치되는 도구:**
- `git`: 코드 저장소 관리
- `curl`, `wget`: 파일 다운로드
- `vim`: 텍스트 에디터
- `build-essential`: 컴파일 도구

---

## ✅ SSH 접속 완료!

이제 EC2 서버에 접속된 상태입니다.

### 📊 현재 상태

```
✅ EC2 인스턴스 생성
✅ SSH 접속 성공
✅ 시스템 업데이트 완료
✅ 기본 도구 설치 완료
```

---

## 🚀 다음 단계: Node.js 설치

이제 Node.js를 설치하고 GitHub에서 코드를 받을 차례입니다!

**다음 가이드:**
```
다음: EC2_환경_설정_가이드.md
```

---

## 🆘 문제 해결

### Q1: "Permission denied" 오류

**문제:**
```
Permission denied (publickey).
```

**해결:**
1. 키 파일 권한 확인
   ```powershell
   icacls $HOME\.ssh\ad-copy-key.pem
   ```
2. 권한 재설정 (1-3단계 다시 실행)
3. 올바른 키 파일 사용 확인

### Q2: "Connection timed out" 오류

**문제:**
```
ssh: connect to host xxx.xxx.xxx.xxx port 22: Connection timed out
```

**해결:**
1. EC2 Security Group 확인
   - SSH (포트 22)가 열려있는지
   - Source가 "My IP" 또는 "0.0.0.0/0"인지
2. EC2 인스턴스가 "Running" 상태인지 확인
3. Public IP 주소가 올바른지 확인

### Q3: "Host key verification failed" 오류

**해결:**
```powershell
# known_hosts 파일에서 해당 IP 제거
ssh-keygen -R EC2-Public-IP

# 다시 접속 시도
ssh -i "$HOME\.ssh\ad-copy-key.pem" ubuntu@EC2-Public-IP
```

### Q4: SSH 명령어가 없다고 나옵니다

**Windows 10/11에서 SSH 활성화:**

1. 설정 → 앱 → 선택적 기능
2. "OpenSSH 클라이언트" 설치
3. PowerShell 재시작

**또는 PuTTY 사용:**
- 다운로드: https://www.putty.org/
- .pem 파일을 .ppk로 변환 필요 (PuTTYgen 사용)

---

## 💡 유용한 팁

### SSH 접속 단축 명령어 만들기

`$HOME\.ssh\config` 파일 생성:

```powershell
notepad $HOME\.ssh\config
```

다음 내용 입력:

```
Host ad-copy-server
    HostName 13.125.xxx.xxx
    User ubuntu
    IdentityFile ~/.ssh/ad-copy-key.pem
```

저장 후 간단하게 접속:

```powershell
ssh ad-copy-server
```

### VS Code에서 SSH 접속

1. VS Code 설치
2. "Remote - SSH" 확장 설치
3. F1 → "Remote-SSH: Connect to Host"
4. 위에서 만든 `ad-copy-server` 선택

---

**작성일**: 2025-11-18  
**다음 단계**: Node.js 설치 및 환경 설정

