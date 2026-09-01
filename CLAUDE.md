# 이카운트 전자주문서 자동화 시스템

## 📁 기본 정보 저장소

**Google Drive 폴더:** https://drive.google.com/drive/folders/1Rti29meh-0zX8EpWIMMiLBsULAIRXTCC

이 폴더에는 다음이 포함되어 있습니다:
- **용어사전 (자비스 시트)**: 브랜치, API, UI/UX, 제조/유통 등 기술용어 정의
- **API 인증 정보 (Google Sheet)**: 이카운트 오딘/세광 API 키, 회사코드, 대출정보 등
- **제품/원재료 정보**: 원목 종류, 부자재, 도장공법, 친환경등급 등
- **거래처/제품 마스터**: Ecount 기본 양식 및 거래처/제품 코드

---

## 🤖 각 AI별 사용 방법

### Claude (이 세션)
- **자동 로드**: 별도 지시 없이 매 세션마다 자동으로 위 폴더 확인
- **동작**: 현재 프로젝트의 모든 필드명, API 인증, 용어 이해하고 대화 시작

### Gemini
```
"이 Google Drive 폴더에서 정보를 읽어줄래?
https://drive.google.com/drive/folders/1Rti29meh-0zX8EpWIMMiLBsULAIRXTCC

- 용어사전 시트에서 브랜치, 필드, 제조/유통 용어 파악
- API 인증 정보 시트에서 Ecount 계정 정보 확인
- 제품/원재료 정보 확인

이 정보를 바탕으로 우리 프로젝트를 이해하고 도와줘"
```

### Notebook LM (노트북 LM)
```
"이 Google Drive 폴더를 분석해줄래?
https://drive.google.com/drive/folders/1Rti29meh-0zX8EpWIMMiLBsULAIRXTCC

폴더 내 모든 시트와 파일을 이해한 후, 우리 이카운트 프로젝트의 전체 구조를 설명해줘"
```

---

## 🔄 세션 간 연결 원리

**Claude:**
- CLAUDE.md (이 파일)에 폴더 링크 저장
- 새 세션 시작 → Claude Code가 자동으로 CLAUDE.md 로드
- 나는 링크를 읽고 Google Drive 정보 자동 파악

**Gemini/Notebook LM:**
- 프롬프트에 폴더 링크 명시
- Google은 자신의 AI들에게 Google Drive 자동 접근 권한 제공
- 프롬프트 첫 문장에서 폴더 언급 → 자동 스캔/로드

---

## ⚙️ 프로젝트 핵심 설정

| 항목 | 값 |
|------|-----|
| **저장소** | `popo7542015-source/ecount-mcp` |
| **작업 브랜치** | `claude/call-center-automation-system-nuk9sp` |
| **이카운트 계정** | 오딘 (COM_CODE: 53258), 세광 (COM_CODE: 69073) |
| **API 타입** | Test API (sboapi) |
| **기본 정보 폴더** | [Google Drive](https://drive.google.com/drive/folders/1Rti29meh-0zX8EpWIMMiLBsULAIRXTCC) |

---

## 📋 매 세션 시작 시 확인 항목

Claude (자동):
- [ ] Google Drive 폴더에서 최신 용어/API 정보 로드
- [ ] Ecount API 인증키 확인
- [ ] 현재 설계서/진행상황 파악

Gemini/Notebook LM (수동):
- 첫 프롬프트에서 폴더 링크 제시 및 "이 정보 기반으로 작업해줘" 요청

---

**최종 수정**: 2026-09-01
