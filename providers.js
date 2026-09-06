h// AI 회의실에 참석하는 각 AI 회사의 API(창구)를 규격에 맞게 연결하는 부품 모음.
// 새 AI를 추가할 때는 이 파일에 함수 하나만 더 만들고 buildProviders()에 등록하면 된다.
// DeepSeek·Groq처럼 OpenAI 규격을 그대로 쓰는 곳은 openAiCompatible() 하나로 다 처리된다.

async function askAnthropic({ apiKey, model, systemPrompt, messages }) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,h
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 600,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Anthropic 오류 (${res.status})`);
  return data.content?.map((c) => c.text).join("") || "";
}

async function askGemini({ apiKey, model, systemPrompt, messages }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Gemini 오류 (${res.status})`);
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
}

// OpenAI 규격(챗 컴플리션)을 쓰는 곳은 전부 이 함수 하나로 처리한다.
// DeepSeek, Groq, OpenAI 자체, 그 외 호환 서비스 전부 baseUrl과 model만 바꾸면 된다.
function openAiCompatible({ baseUrl, apiKey, model }) {
  return async function ask({ systemPrompt, messages }) {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `${baseUrl} 오류 (${res.status})`);
    return data.choices?.[0]?.message?.content || "";
  };
}

// 환경변수에 키가 채워진 AI만 회의실에 자동으로 참석한다. 키가 없으면 조용히 빠진다.
function buildProviders() {
  const providers = [];

  if (process.env.ANTHROPIC_API_KEY) {
    providers.push({
      id: "claude",
      label: "클로드",
      ask: (args) =>
        askAnthropic({
          apiKey: process.env.ANTHROPIC_API_KEY,
          model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
          ...args,
        }),
    });
  }

  if (process.env.GEMINI_API_KEY) {
    providers.push({
      id: "gemini",
      label: "스파크",
      ask: (args) =>
        askGemini({
          apiKey: process.env.GEMINI_API_KEY,
          model: process.env.GEMINI_MODEL || "gemini-3.6-flash",
          ...args,
        }),
    });
  }

  if (process.env.DEEPSEEK_API_KEY) {
    const ask = openAiCompatible({
      baseUrl: "https://api.deepseek.com",
      apiKey: process.env.DEEPSEEK_API_KEY,
      model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
    });
    providers.push({ id: "deepseek", label: "딥시크", ask });
  }

  // Groq를 나중에 쓰려면 .env에 GROQ_API_KEY만 넣으면 자동으로 참석한다.
  if (process.env.GROQ_API_KEY) {
    const ask = openAiCompatible({
      baseUrl: "https://api.groq.com/openai/v1",
      apiKey: process.env.GROQ_API_KEY,
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
    });
    providers.push({ id: "groq", label: "그록", ask });
  }

  if (process.env.OPENAI_API_KEY) {
    const ask = openAiCompatible({
      baseUrl: "https://api.openai.com/v1",
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    });
    providers.push({ id: "openai", label: "챗지피티", ask });
  }

  return providers;
}

module.exports = { buildProviders };
