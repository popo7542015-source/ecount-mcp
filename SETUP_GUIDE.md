# ecount-mcp 설정 가이드

## 🚀 빠른 시작

### 1단계: 저장소 클론 및 의존성 설치

```bash
cd /home/user/ecount-mcp
npm install
```

### 2단계: 환경 변수 설정

`.env` 파일을 생성하고 필요한 API 키를 입력하세요:

```bash
cp .env.example .env
# .env 파일을 열어서 API 키 입력
```

### 3단계: 각 시스템별 설정

---

## 📋 시스템별 설정 가이드

### 1️⃣ 프랜차이즈 신규 오픈 자동 영업

#### 필수 환경

- ✅ Anthropic API Key
- ✅ Google Service Account (Google Sheets API)
- ✅ Solapi Key (카카오톡 알림톡)
- ✅ Make.com 계정

#### 설정 단계

##### a) Google Sheets API 설정

1. [Google Cloud Console](https://console.cloud.google.com) 접속
2. 새 프로젝트 생성
3. **API 및 서비스** → **라이브러리** → "Google Sheets API" 검색
4. 활성화 클릭
5. **사용자 인증 정보** → **서비스 계정** 생성
6. 키 생성 (JSON)
7. 생성된 JSON을 `.env`의 `GOOGLE_SERVICE_ACCOUNT_JSON`에 입력

##### b) Google Sheets 생성

1. [Google Sheets](https://sheets.google.com) 접속
2. 새 스프레드시트 생성 (이름: "B2B 가구 영업 자동화")
3. 스프레드시트 URL에서 ID 복사
   ```
   https://docs.google.com/spreadsheets/d/[ID]/edit
   ```
4. `.env`의 `GOOGLE_SHEET_ID`에 입력

##### c) 서비스 계정 권한 부여

1. Google Sheets에서 **공유** 버튼 클릭
2. 서비스 계정 이메일 주소 입력
3. 편집자 권한 부여

##### d) Solapi (카카오톡 알림톡) 설정

1. [Solapi](https://solapi.com) 가입
2. API 키 및 시크릿 생성
3. 카카오톡 알림톡 템플릿 승인 신청 (약 2-3일 소요)
4. `.env`에 입력:
   ```env
   SOLAPI_API_KEY=your_api_key
   SOLAPI_API_SECRET=your_api_secret
   ```

#### 실행

```bash
# 전체 파이프라인 실행
node franchise-automation.js

# 특정 에이전트만 테스트
node -e "const Agent = require('./agents/crawling-agent'); const a = new Agent(); a.detectNewStores();"
```

---

### 2️⃣ AI 자동화 아이디어 Google Sheets 동기화

#### 필수 환경

- ✅ Anthropic API Key
- ✅ Google Service Account
- ✅ Google Sheets ID

#### 설정 단계

1. 위의 "프랜차이즈 자동화" 중 **a), b), c)** 단계 완료
2. 스크립트 실행:

```bash
node google-sheets-sync.js
```

#### 결과

- "AI자동화아이디어" 워크시트 자동 생성
- 5가지 아이디어 자동 입력:
  1. ✅ 상세페이지 + 카카오톡 자동화
  2. ✅ 프랜차이즈 신규 오픈 자동 영업
  3. ⏳ 멀티에이전트 마케팅 자동화
  4. 💡 이미지 크롤링 + 배경제거 자동화
  5. 📋 Claude Code 화면공유 제안

---

### 3️⃣ 멀티에이전트 마케팅 자동화 (준비 중)

#### 필수 환경

- ✅ Anthropic API Key
- ✅ PostgreSQL 데이터베이스
- ✅ Redis (선택)
- ✅ SNS API 키 (Instagram, Facebook, LinkedIn)

#### 예정 설정

곧 추가될 예정입니다. 기다려주세요!

---

### 4️⃣ 이미지 크롤링 + 배경제거 자동화 (기획 중)

#### 필수 환경

- ✅ Python 3.10+
- ✅ GPU (선택, 배경제거 가속화)
- ✅ AWS S3 또는 Google Cloud Storage

#### 예정 설정

곧 추가될 예정입니다. 기다려주세요!

---

### 5️⃣ Claude Code 화면공유 제안 (진행 중)

이 제안은 Anthropic Claude Code 팀에 제출되었습니다.

진행 상황: 📧 검토 중

---

## 🔧 Docker 컨테이너로 실행 (선택)

### Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# 환경변수는 runtime에 전달
ENV NODE_ENV=production

EXPOSE 3000

CMD ["npm", "start"]
```

### 실행

```bash
# 이미지 빌드
docker build -t ecount-mcp .

# 컨테이너 실행
docker run -e ANTHROPIC_API_KEY=your_key \
           -e GOOGLE_SHEET_ID=your_id \
           -e GOOGLE_SERVICE_ACCOUNT_JSON='{"..."}' \
           -p 3000:3000 \
           ecount-mcp
```

---

## 🐛 문제 해결

### "API 키가 없습니다" 오류

```
Error: ANTHROPIC_API_KEY is not set
```

**해결책:**
```bash
# .env 파일 확인
cat .env

# 또는 직접 전달
export ANTHROPIC_API_KEY=sk-ant-...
node franchise-automation.js
```

### "Google Sheets 권한 거부" 오류

```
Error: Permission denied: User does not have permission to access this resource
```

**해결책:**
1. Google Sheets의 공유 버튼 클릭
2. 서비스 계정 이메일에 편집 권한 부여
3. 15분 정도 기다렸다가 재시도

### "Solapi 발송 실패" 오류

```
Error: Solapi API authentication failed
```

**해결책:**
1. Solapi 대시보드에서 API 키 확인
2. 카카오톡 알림톡 템플릿 승인 확인
3. 잔액 확인 (최소 1,000원)

---

## 📊 모니터링

### 로그 확인

```bash
# 실시간 로그 보기
npm start | grep -E "SUCCESS|ERROR|WARNING"

# 로그 파일 저장
npm start > logs/$(date +%Y%m%d).log 2>&1
```

### 성과 분석

Google Sheets의 "발송로그" 시트에서 자동으로 추적됩니다:

- 발송시간
- 대상 (시공사/점주/본부)
- 채널 (카카오톡/이메일)
- 상태 (발송/개봉/클릭/문의/계약)
- 개봉율, 클릭율, 문의율, 계약율

---

## 🚀 배포 가이드

### 클라우드 배포 (AWS EC2 기준)

```bash
# 1. 인스턴스 시작
aws ec2 run-instances --image-id ami-0c55b159cbfafe1f0 --count 1

# 2. SSH 접속
ssh -i key.pem ec2-user@instance-ip

# 3. Node.js 설치
curl -sL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install nodejs

# 4. 저장소 클론
git clone https://github.com/yourusername/ecount-mcp.git
cd ecount-mcp

# 5. 의존성 설치
npm install --production

# 6. 환경 설정
nano .env
# 환경변수 입력

# 7. PM2로 백그라운드 실행
sudo npm install -g pm2
pm2 start franchise-automation.js
pm2 save
```

### 정기 작업 설정 (Cron)

```bash
# 매일 6시, 12시, 18시 실행
crontab -e

# 추가:
0 6,12,18 * * * cd /home/ec2-user/ecount-mcp && node franchise-automation.js >> logs/cron.log 2>&1

# 매주 금요일 오후 5시 주간 분석
0 17 * * 5 cd /home/ec2-user/ecount-mcp && node -e "const Agent = require('./agents/analytics-agent'); ..." >> logs/weekly.log 2>&1
```

---

## 📞 기술 지원

### FAQ

**Q: Google Sheets에 데이터가 안 입력됩니다**
A: 
1. GOOGLE_SERVICE_ACCOUNT_JSON이 올바른 JSON인지 확인
2. 서비스 계정에 Google Sheets 편집 권한이 있는지 확인
3. GOOGLE_SHEET_ID가 올바른지 확인

**Q: 카카오톡 알림톡이 발송되지 않습니다**
A:
1. Solapi 대시보드에서 템플릿 승인 상태 확인
2. API 키와 시크릿이 올바른지 확인
3. 발송 대상 전화번호 형식 확인 (010-XXXX-XXXX)

**Q: 프랜차이즈 정보가 감지되지 않습니다**
A:
1. 크롤링 URL이 최신인지 확인
2. 웹사이트 CSS 셀렉터가 변경되었는지 확인
3. 크롤링 에이전트 로그 확인

---

## 📚 참고 자료

- [Anthropic API 문서](https://docs.anthropic.com)
- [Google Sheets API 문서](https://developers.google.com/sheets/api)
- [Solapi 문서](https://docs.solapi.com)
- [Make.com 문서](https://www.make.com/en/help)

---

**마지막 업데이트**: 2024-08-24  
**버전**: 1.0.0
