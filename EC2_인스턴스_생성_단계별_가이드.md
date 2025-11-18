# AWS EC2 인스턴스 생성 단계별 가이드

> 처음부터 끝까지 하나씩 따라하기

---

## 🎯 목표

광고 소재 문구 생성 시스템을 실행할 EC2 인스턴스 생성

---

## 📋 사전 준비물

- [ ] AWS 계정 (https://aws.amazon.com)
- [ ] 신용카드 (결제 수단)
- [ ] 이메일 주소

---

## 1단계: AWS Management Console 접속

### 1-1. AWS 로그인

1. 웹 브라우저에서 접속: **https://console.aws.amazon.com**
2. AWS 계정으로 로그인
3. 우측 상단에서 **지역(Region)** 확인
   - 권장: **서울 (ap-northeast-2)** 또는 **도쿄 (ap-northeast-1)**
   - 지역 변경: 우측 상단 드롭다운에서 선택

### 1-2. EC2 서비스로 이동

1. 상단 검색창에서 **"EC2"** 검색
2. **EC2** 클릭
3. EC2 대시보드 화면 확인

---

## 2단계: 인스턴스 시작

### 2-1. Launch Instance 클릭

1. EC2 대시보드에서 **"Launch Instance"** (인스턴스 시작) 버튼 클릭
2. 또는 좌측 메뉴 **"Instances"** → **"Launch instances"**

---

## 3단계: 인스턴스 기본 설정

### 3-1. Name (이름 설정)

```
Name: ad-copy-generator-server
```

또는 원하는 이름으로 설정 (한글 가능)

### 3-2. Application and OS Images (AMI 선택)

**중요: 정확히 선택해야 합니다!**

1. **Quick Start** 탭에서
2. **Ubuntu** 선택
3. **Ubuntu Server 22.04 LTS (HVM), SSD Volume Type** 선택
   - ✅ "Free tier eligible" 표시 확인 (프리티어)
   - 아키텍처: **64-bit (x86)**

**스크린샷 예시:**
```
┌─────────────────────────────────────┐
│ ● Ubuntu                             │
│   Ubuntu Server 22.04 LTS (HVM)     │
│   64-bit (x86)                       │
│   ✓ Free tier eligible               │
└─────────────────────────────────────┘
```

---

## 4단계: 인스턴스 타입 선택

### 4-1. Instance type

**선택 1 - 프리티어 (무료 테스트용):**
```
t2.micro
- 1 vCPU
- 1 GiB RAM
- ✓ Free tier eligible
```

**선택 2 - 권장 (프로덕션):**
```
t3.medium
- 2 vCPU
- 4 GiB RAM
- 시간당 약 $0.05 (월 약 $36)
```

**선택 3 - 고성능 (트래픽 많을 경우):**
```
t3.large
- 2 vCPU
- 8 GiB RAM
- 시간당 약 $0.10 (월 약 $73)
```

**추천**: 먼저 **t2.micro**로 테스트 후 필요시 **t3.medium**으로 업그레이드

---

## 5단계: Key Pair (로그인 키) 생성

**매우 중요: 이 키가 없으면 서버 접속 불가!**

### 5-1. Create new key pair 클릭

1. **"Create new key pair"** 버튼 클릭

### 5-2. 키 정보 입력

```
Key pair name: ad-copy-key
(또는 원하는 이름)

Key pair type: RSA (선택)

Private key file format: .pem (Windows/Mac/Linux 모두 사용 가능)
```

### 5-3. Create key pair 클릭

1. **"Create key pair"** 클릭
2. **`ad-copy-key.pem`** 파일이 자동으로 다운로드됨
3. **⚠️ 이 파일을 안전한 곳에 보관! 재다운로드 불가!**

**권장 보관 위치:**
```
C:\Users\사용자명\.ssh\ad-copy-key.pem
```

---

## 6단계: Network Settings (네트워크 설정)

### 6-1. Edit 버튼 클릭

**"Network settings"** 섹션에서 **"Edit"** 클릭

### 6-2. VPC 설정 (기본값 유지)

```
VPC: (default) - 기본값 유지
Subnet: No preference - 기본값 유지
Auto-assign public IP: Enable - 반드시 Enable!
```

### 6-3. Firewall (Security groups) 설정

**매우 중요: 포트 설정!**

**"Create security group" 선택**

```
Security group name: ad-copy-sg
Description: Security group for ad copy generator
```

### 6-4. Security group rules 설정

**총 4개의 규칙 추가:**

#### Rule 1: SSH (서버 접속용)
```
Type: SSH
Protocol: TCP
Port range: 22
Source type: My IP (내 IP만 허용 - 보안 강화)
Description: SSH access
```

#### Rule 2: HTTP (웹 접속용)
```
Type: HTTP
Protocol: TCP
Port range: 80
Source type: Anywhere (0.0.0.0/0)
Description: HTTP access
```

**"Add security group rule" 클릭하여 추가**

#### Rule 3: HTTPS (보안 웹 접속용)
```
Type: HTTPS
Protocol: TCP
Port range: 443
Source type: Anywhere (0.0.0.0/0)
Description: HTTPS access
```

**"Add security group rule" 클릭하여 추가**

#### Rule 4: Custom TCP (Next.js 테스트용)
```
Type: Custom TCP
Protocol: TCP
Port range: 3000
Source type: Anywhere (0.0.0.0/0)
Description: Next.js development server
```

**최종 확인:**
```
┌──────┬──────┬──────┬─────────────┐
│ Type │ Port │ Source │ Description │
├──────┼──────┼─────────────┼───────────┤
│ SSH  │ 22   │ My IP       │ SSH       │
│ HTTP │ 80   │ 0.0.0.0/0   │ HTTP      │
│ HTTPS│ 443  │ 0.0.0.0/0   │ HTTPS     │
│ TCP  │ 3000 │ 0.0.0.0/0   │ Next.js   │
└──────┴──────┴─────────────┴───────────┘
```

---

## 7단계: Storage (스토리지) 설정

### 7-1. Configure storage

```
Volume type: gp3 (General Purpose SSD)
Size (GiB): 30 GB (권장)
  - 최소: 20 GB
  - 권장: 30 GB
  - 넉넉하게: 50 GB

Delete on termination: 체크 (인스턴스 삭제 시 스토리지도 삭제)
```

**프리티어**: 30GB까지 무료

---

## 8단계: 고급 설정 (선택사항, 건너뛰어도 됨)

**"Advanced details"는 기본값으로 두고 건너뛰어도 됩니다.**

---

## 9단계: Summary (요약) 확인

### 9-1. 우측 Summary 패널 확인

```
Name: ad-copy-generator-server
AMI: Ubuntu Server 22.04 LTS
Instance type: t2.micro (또는 선택한 타입)
Key pair: ad-copy-key
Security group: ad-copy-sg
Storage: 30 GiB gp3
```

### 9-2. Number of instances

```
Number of instances: 1
```

---

## 10단계: Launch Instance (인스턴스 시작)

### 10-1. Launch instance 클릭

1. **"Launch instance"** (주황색 버튼) 클릭
2. 성공 메시지 확인:
   ```
   ✓ Successfully initiated launch of instance (i-xxxxx)
   ```
3. **"View all instances"** 클릭

---

## 11단계: 인스턴스 상태 확인

### 11-1. Instances 페이지

1. 생성한 인스턴스가 목록에 표시됨
2. **Instance state** 확인:
   ```
   Pending → Running (약 1-2분 소요)
   ```
3. **Status check** 확인:
   ```
   Initializing → 2/2 checks passed (약 3-5분 소요)
   ```

### 11-2. 인스턴스 정보 확인

인스턴스를 선택하면 하단에 세부 정보 표시:

```
Instance ID: i-xxxxxxxxxxxxx
Instance type: t2.micro
Public IPv4 address: xxx.xxx.xxx.xxx (이것이 중요!)
Public IPv4 DNS: ec2-xxx-xxx-xxx-xxx.ap-northeast-2.compute.amazonaws.com
```

**Public IPv4 address를 메모장에 복사해두세요!**

---

## 12단계: Elastic IP 할당 (선택사항, 권장)

**왜 필요한가?**
- 인스턴스 재시작 시 IP 주소가 변경되지 않음
- 도메인 연결 시 편리함

### 12-1. Elastic IPs 메뉴

1. 좌측 메뉴에서 **"Elastic IPs"** 클릭
2. **"Allocate Elastic IP address"** 클릭

### 12-2. Elastic IP 할당

1. Network Border Group: 기본값 유지
2. **"Allocate"** 클릭
3. 새로운 IP 주소가 할당됨

### 12-3. 인스턴스에 연결

1. 할당된 IP 주소 선택
2. **"Actions"** → **"Associate Elastic IP address"** 클릭
3. Instance: 방금 생성한 인스턴스 선택
4. **"Associate"** 클릭

**이제 이 IP 주소가 고정 IP입니다!**

---

## ✅ EC2 인스턴스 생성 완료!

### 📊 생성된 정보 정리

```
서버 이름: ad-copy-generator-server
인스턴스 ID: i-xxxxxxxxxxxxx
퍼블릭 IP: xxx.xxx.xxx.xxx (메모!)
인스턴스 타입: t2.micro (또는 선택한 타입)
운영 체제: Ubuntu Server 22.04 LTS
키 파일: ad-copy-key.pem
```

---

## 🚀 다음 단계: SSH 접속

이제 생성한 EC2 인스턴스에 접속할 차례입니다!

**다음 가이드 문서를 준비했습니다:**

```
다음: EC2_SSH_접속_가이드.md
```

---

## 💰 비용 예상

### 프리티어 (t2.micro)
- 월 750시간 무료 (1대 기준 24시간 운영 가능)
- 스토리지 30GB: 무료

### 유료 (t3.medium)
- 인스턴스: 월 약 $36
- 스토리지 30GB: 월 약 $3
- Elastic IP: 무료 (사용 중일 때)
- **총 예상 비용**: 월 약 $40

---

## 🆘 문제 발생 시

### Q1: 키 파일을 잃어버렸어요
- 안타깝지만 재발급 불가
- 인스턴스를 삭제하고 새로 생성해야 함
- **반드시 안전한 곳에 백업!**

### Q2: 인스턴스 시작이 실패했어요
- 지역(Region)을 확인하세요
- 프리티어 한도를 초과했는지 확인
- AWS 계정 상태 확인

### Q3: Public IP가 표시되지 않아요
- "Auto-assign public IP"가 Enable인지 확인
- 인스턴스 재시작 시도
- Elastic IP 할당 고려

---

**작성일**: 2025-11-18  
**다음 단계**: SSH 접속 및 환경 설정

