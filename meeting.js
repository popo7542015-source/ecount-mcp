// meeting.js
// AI 회의실 진행 로직. 참석자(클로드·스파크 등)가 순서대로 발언하고, 서로의 답변을 보고 이어간다.
// 회의 상태는 서버 메모리에만 보관한다 — 서버 재시작(무료 요금제 슬립 포함) 시 사라지므로,
// 확정된 기록은 요약(summarize) 시점에 구글시트로 내보내는 웹훅이 담당한다(설정 안 하면 그냥 건너뜀).

const { randomUUID } = require("crypto");
const { buildProviders } = require("./providers");

const meetings = new Map(); // meetingId -> { topic, messages: [...], lastSummary }

function systemPromptFor(label, topic) {
  return (
    `당신은 "${label}"이고, 가구 제조·유통 회사(오딘/세광) 대표의 AI 회의실에 참석했습니다. ` +
    `사회자는 대표(사장님)입니다. 다른 참석자의 의견을 참고해서 짧고 실용적으로 의견을 말하세요. ` +
    `모르는 것은 모른다고 하고, 추측이면 "추측입니다"라고 밝히세요. 과장·아부 없이 핵심만 말하세요.` +
    (topic ? ` 오늘 회의 주제: ${topic}` : "")
  );
}

// 각 참석자에게는 자신을 포함한 모든 발언을 "누가 한 말인지" 표시해서 user 메시지로 보여준다.
// (참석자별로 자기 답변만 assistant로 분리하면 로직이 복잡해지므로, 전부 user로 통일해 단순하게 유지)
function toProviderMessages(messages) {
  if (!messages.length) return [{ role: "user", content: "회의 시작." }]; return messages.map((m) => ({
    role: "user",
    content: `[${m.label}] ${m.content}`,
  }));
}

function fireWebhook(url, payload) {
  if (!url) return;
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch((err) => console.error("회의록 웹훅 전송 실패:", err.message));
}

function startMeeting(topic) {
  const id = randomUUID();
  meetings.set(id, { topic: (topic || "").trim(), messages: [], lastSummary: null, createdAt: Date.now() });
  return id;
}

function getMeeting(id) {
  const meeting = meetings.get(id);
  if (!meeting) throw new Error("존재하지 않거나 만료된 회의입니다. 회의를 다시 시작해주세요.");
  return meeting;
}

async function askProvider(provider, meeting) {
  const systemPrompt = systemPromptFor(provider.label, meeting.topic);
  const contextMessages = toProviderMessages(meeting.messages);
  try {
    return await provider.ask({ systemPrompt, messages: contextMessages });
  } catch (err) {
    return `(오류로 발언 못함: ${err.message})`;
  }
}

function appendEntry(meeting, entry) {
  meeting.messages.push(entry);
  fireWebhook(process.env.MEETING_RAW_WEBHOOK_URL, {
    topic: meeting.topic,
    ...entry,
  });
  return entry;
}

// 활성 참석자 전원이 한 번씩 발언하는 "한 바퀴" 진행
async function runRound(meetingId) {
  const meeting = getMeeting(meetingId);
  const providers = buildProviders();
  if (providers.length === 0) {
    throw new Error("참석 가능한 AI가 없습니다. Render 환경변수(API 키)를 확인하세요.");
  }

  const results = [];
  for (const provider of providers) {
    const content = await askProvider(provider, meeting);
    const entry = appendEntry(meeting, {
      speaker: provider.id,
      label: provider.label,
      role: "assistant",
      content,
      ts: Date.now(),
    });
    results.push(entry);
  }
  return results;
}

// 사장님의 자유 질문. targetId를 주면 그 AI에게만, 안 주면 활성 참석자 전원에게 묻는다.
async function ask(meetingId, question, targetId) {
  const meeting = getMeeting(meetingId);
  const q = (question || "").trim();
  if (!q) throw new Error("질문 내용이 비어 있습니다.");

  appendEntry(meeting, {
    speaker: "moderator",
    label: "사장님",
    role: "moderator",
    content: q,
    ts: Date.now(),
  });

  const providers = buildProviders().filter((p) => !targetId || p.id === targetId);
  if (providers.length === 0) {
    throw new Error(
      targetId ? `'${targetId}' 참석자를 찾을 수 없습니다.` : "참석 가능한 AI가 없습니다."
    );
  }

  const results = [];
  for (const provider of providers) {
    const content = await askProvider(provider, meeting);
    const entry = appendEntry(meeting, {
      speaker: provider.id,
      label: provider.label,
      role: "assistant",
      content,
      ts: Date.now(),
    });
    results.push(entry);
  }
  return results;
}

// 검증관별 역할 (2026-09-03 회의록 확정안 그대로 반영).
// 역할을 안 정해주면 다들 똑같은 잔소리만 반복해서 교차검증의 의미가 없어진다 — 사장님 지적.
const AUDIT_FOCUS = {
  openai:
    "당신은 제1 검증관입니다. 논리 결함, 빠진 예외 상황, 비용 함정을 공격적으로 지적하세요. " +
    "특히 \"이 계획이 실패한다면 가장 가능성 높은 원인\"과 \"유지보수 인력이 없는 회사에서 위험한 지점\"을 집중적으로 찾으세요.",
  gemini:
    "당신은 제2 검증관입니다. 구글 도구(구글시트/앱시트/앱스크립트) 적합성을 전문으로 검증하세요. " +
    "우리 회사 인프라가 구글 워크스페이스이므로, \"이걸 구글 도구로 구현했을 때 실제로 돌아가는지, 더 쉬운 구글 도구 방법은 없는지\"를 중심으로 보세요.",
  deepseek:
    "당신은 기술 검증관입니다. 복잡한 로직·알고리즘·비용 구조를 깊게 파고들어 검증하세요. " +
    "겉으로는 그럴듯해도 실제 구현 단계에서 막힐 기술적 함정을 찾으세요.",
};

// 암행어사: 클로드(작업반장)가 만든 결과물을 다른 AI들이 "각자 독립적으로" 검수한다.
// 회의(round/ask)와 달리 서로의 의견을 보여주지 않는다 — 서로 눈치 보지 않고 각자 판단해야
// "교차검증"의 의미가 있기 때문. 클로드 자신은 검증관에서 제외한다(자기 결과물을 자기가 감사할 수 없음).
async function audit(meetingId, content) {
  const meeting = getMeeting(meetingId);
  const text = (content || "").trim() || meeting.messages.map((m) => `[${m.label}] ${m.content}`).join("\n");
  if (!text) throw new Error("검증할 내용이 없습니다. 회의 내용이 비어있거나 검증할 글을 입력하세요.");

  const auditors = buildProviders().filter((p) => p.id !== "claude");
  if (auditors.length === 0) {
    throw new Error("암행어사로 참석할 AI가 없습니다. Render 환경변수(GEMINI_API_KEY/DEEPSEEK_API_KEY/OPENAI_API_KEY 등)를 확인하세요.");
  }

  const commonRule =
    "당신은 제조·유통 기업의 자동화·기획 결과물을 심사하는 냉정한 감사관(암행어사)입니다. " +
    "칭찬이나 요약은 하지 말고, 문제점만 번호를 매겨 조목조목 말하세요. " +
    "문제가 없다고 판단되면 '문제 없음'이라고만 쓰세요. 모르는 건 모른다고 하고, 추측이면 '추측입니다'라고 밝히세요.";

  const findings = await Promise.all(
    auditors.map(async (p) => {
      const focus = AUDIT_FOCUS[p.id];
      const systemPrompt = focus ? `${commonRule} ${focus}` : commonRule;
      try {
        const result = await p.ask({
          systemPrompt,
          messages: [{ role: "user", content: text }],
        });
        return { speaker: p.id, label: `${p.label}(암행어사)`, content: result };
      } catch (err) {
        return { speaker: p.id, label: `${p.label}(암행어사)`, content: `(오류로 검증 못함: ${err.message})` };
      }
    })
  );

  const entries = findings.map((f) =>
    appendEntry(meeting, { speaker: f.speaker, label: f.label, role: "audit", content: f.content, ts: Date.now() })
  );

  const record = { topic: meeting.topic, target: text, findings: entries, ts: Date.now() };
  fireWebhook(process.env.AUDIT_WEBHOOK_URL, record);
  return entries;
}

// 지금까지 대화를 3줄 요약 + 최종 결정으로 정리 (참석자 중 첫 번째 AI가 담당)
async function summarize(meetingId) {
  const meeting = getMeeting(meetingId);
  const providers = buildProviders();
  if (providers.length === 0) {
    throw new Error("참석 가능한 AI가 없습니다.");
  }
  const summarizer = providers[0];
  const transcript = meeting.messages.map((m) => `[${m.label}] ${m.content}`).join("\n");
  const systemPrompt =
    "당신은 회의록 작성 담당입니다. 아래 회의 대화 전체를 보고 딱 두 항목만 출력하세요: " +
    "1) 핵심 요약(3줄 이내) 2) 최종 결정(결정된 게 없으면 '결정된 것 없음'이라고 쓰세요). " +
    "군더더기 설명 없이 이 두 항목만 출력하세요.";

  const summaryText = await summarizer.ask({
    systemPrompt,
    messages: [{ role: "user", content: transcript || "(아직 대화 없음)" }],
  });

  const record = { topic: meeting.topic, summary: summaryText, ts: Date.now() };
  meeting.lastSummary = record;
  fireWebhook(process.env.MEETING_SUMMARY_WEBHOOK_URL, record);
  return record;
}

function getState(meetingId) {
  const meeting = getMeeting(meetingId);
  return {
    meetingId,
    topic: meeting.topic,
    messages: meeting.messages,
    lastSummary: meeting.lastSummary,
    participants: buildProviders().map((p) => ({ id: p.id, label: p.label })),
  };
}

module.exports = { startMeeting, runRound, ask, audit, summarize, getState };
