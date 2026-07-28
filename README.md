# 이카운트 실시간 조회 MCP 서버 — 배포 가이드

이 프로그램을 인터넷에 올리면(배포하면), 클로드 채팅창에서
"오딘 나비수인 재고 몇 개야?", "세광 미소가구 전화번호 알려줘" 라고 물어볼 수 있게 됩니다.

컴퓨터 코딩 몰라도 아래 순서대로 클릭만 하면 됩니다. 막히는 부분 있으면 그 화면
캡처해서 저한테 보여주세요.

---

## 1단계. GitHub에 코드 올리기 (코드 보관함 만들기)

1. https://github.com 접속 → 계정 없으면 회원가입 (무료)
2. 오른쪽 위 `+` 버튼 → `New repository` 클릭
3. Repository name: `ecount-mcp` 입력 → `Create repository` 클릭
4. 만들어진 빈 저장소 화면에서 `uploading an existing file` 링크 클릭
5. 제가 드린 zip 파일의 압축을 풀어서, 안에 있는 파일들을 전부 그 화면에
   드래그 앤 드롭으로 끌어다 놓기 (server.js, ecount.js, package.json, .env.example 등)
6. 아래 `Commit changes` 초록 버튼 클릭

> ⚠️ `.env` 파일(실제 비밀번호 넣은 파일)은 절대 GitHub에 올리지 마세요.
> 비밀번호는 3단계에서 Render 사이트에만 입력합니다.

---

## 2단계. Render에서 서버 실행하기 (무료)

1. https://render.com 접속 → `Get Started` → GitHub 계정으로 가입/로그인
2. 대시보드에서 `New +` → `Web Service` 클릭
3. 방금 만든 `ecount-mcp` 저장소 선택 → `Connect`
4. 설정 화면에서:
   - Name: `ecount-mcp` (아무 이름이나 가능)
   - Region: `Singapore` (한국과 제일 가까움)
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Instance Type: `Free`
5. 아래로 스크롤 → `Environment Variables` 섹션에서 `Add Environment Variable` 을
   눌러서 아래 항목들을 하나씩 입력 (`.env.example` 파일 참고, 실제 비밀번호/인증키로):

   | Key | Value |
   |---|---|
   | ODIN_COM_CODE | 53258 |
   | ODIN_USER_ID | (이카운트 아이디) |
   | ODIN_API_CERT_KEY | (오딘 인증키) |
   | ODIN_ZONE | CB |
   | SEGWANG_COM_CODE | 69073 |
   | SEGWANG_USER_ID | (이카운트 아이디) |
   | SEGWANG_API_CERT_KEY | (세광 인증키) |
   | SEGWANG_ZONE | (모르면 비워두기) |
   | ECOUNT_USE_PRODUCTION | false |

6. `Create Web Service` 클릭 → 3~5분 기다리면 배포 완료
7. 화면 상단에 `https://ecount-mcp-xxxx.onrender.com` 같은 주소가 생김 → 이 주소를 복사해두기

> 무료 요금제는 15분간 요청이 없으면 서버가 잠들어서, 첫 질문 응답이 20~30초
> 걸릴 수 있습니다. (두 번째 질문부터는 빠릅니다)

---

## 3단계. 클로드에 연결하기

1. 클로드(claude.ai) 접속 → 왼쪽 아래 프로필 → `설정(Settings)` → `커넥터(Connectors)`
2. `커스텀 커넥터 추가` 또는 `Add custom connector` 클릭
3. 이름: `이카운트`
4. URL: 2단계에서 복사한 주소 뒤에 `/mcp` 붙여서 입력
   예) `https://ecount-mcp-xxxx.onrender.com/mcp`
5. 저장 → 새 대화창에서 커넥터 켜기(토글 ON)

---

## 4단계. 테스트

새 대화에서:
- "오딘 나비수인 재고 조회해줘"
- "세광 미소가구 전화번호 알려줘"

**에러가 나면 화면을 캡처해서 저한테 보내주세요.** 이카운트 API 문서의
정확한 필드명은 아직 검증 전이라, 실제 응답을 보고 코드를 맞춰 고쳐야 할
가능성이 높습니다 (특히 거래처 조회 부분).
