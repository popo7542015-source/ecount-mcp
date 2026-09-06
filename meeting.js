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
  return messages.map((m) => ({
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

module.exports = { startMeeting, runRound, ask, summarize, getState };
