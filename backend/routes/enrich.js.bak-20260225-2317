const express = require('express');
const router = express.Router();
const cleanText = require('../lib/clean-text');
const { SAJU_KB_FULL } = require('../lib/saju-kb');

router.post('/enrich', async (req, res) => {
  const { ruleText, sajuSummary } = req.body;
  if (!ruleText || !sajuSummary) return res.status(400).json({ error: '파라미터 누락' });

  const KEY = process.env.GEMINI_KEY;
  if (!KEY) return res.status(500).json({ error: 'API 키 미설정' });

  const prompt = `너는 바리만신이라는 한국 전통 사주 해석가야.

[말투]
- 고압적이고 권위있는 무당의 반말. 어미: ~하느니라, ~이니라, ~하거라, ~일지니, ~되리라
- 쉬운 한국어로. 한자어 쓰면 괄호 안에 뜻 풀이.

[서식 금지]
- 쌍따옴표/작은따옴표/별표/마크다운/해시/리스트 전부 금지.
- 강조 핵심 단어만 【】로 감싸.
- 순수 텍스트만. 문단 구분은 빈 줄.

[구성]
- 4~5개 문단. 각 문단 3~4문장.
- 첫 문단: 핵심 진단. 중간: 상세 분석 + 실생활 조언. 마지막: 종합 당부.

[명리학 지식 — 아래 고서 내용을 참고하여 해설하라]
${SAJU_KB_FULL}

[사주] ${sajuSummary}

아래 룰엔진 분석을 바탕으로, 위 고서의 지식을 활용해 깊이있게 해설해:
${ruleText}`;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 60000);

    const resp = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=' + KEY,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 1500, temperature: 0.8, thinkingConfig: { thinkingLevel: "MINIMAL" } }
        })
      }
    );
    clearTimeout(timer);

    if (!resp.ok) {
      const e = await resp.text();
      console.error('Gemini error:', resp.status, e.substring(0, 300));
      return res.status(502).json({ error: 'AI 오류 (' + resp.status + ')' });
    }

    const data = await resp.json();
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!text) return res.status(502).json({ error: '빈 응답' });

    res.json({ text: cleanText(text) });
  } catch (err) {
    console.error('Enrich:', err.message);
    if (err.name === 'AbortError') return res.status(504).json({ error: '시간 초과' });
    res.status(500).json({ error: '서버 오류' });
  }
});

module.exports = router;

// ============================================================
// 바리만신 1:1 채팅 — 같은 라우터에 추가
// ============================================================

router.post('/chat', async (req, res) => {
  const { sajuSummary, messages } = req.body;
  if (!sajuSummary || !messages || !messages.length) return res.status(400).json({ error: '파라미터 누락' });

  const KEY = process.env.GEMINI_KEY;
  if (!KEY) return res.status(500).json({ error: 'API 키 미설정' });

  const systemPrompt = `너는 "바리만신"이라는 이름의 한국 전통 사주 해석가야.

[정체성]
- 적천수(滴天髓), 궁통보감(窮通寶鑑), 자평진전(子平眞銓), 연해자평(淵海子平) 등 고서를 두루 섭렵한 도통한 역술인
- 수십 년간 수만 명의 사주를 감정한 베테랑
- "바리만신"이라는 이름에 걸맞게 신통력이 있는 듯한 말투

[말투]
- 고압적이고 권위있는 무당/도사의 반말
- 어미: ~하느니라, ~이니라, ~하거라, ~일지니, ~되리라, ~이로다
- 하지만 상대를 걱정하고 아끼는 마음이 담긴 따뜻한 톤
- 쉬운 한국어로. 전문 한자어 쓰면 괄호 안에 뜻 풀이

[서식]
- 마크다운, 별표, 해시, 리스트 기호 절대 금지
- 순수 텍스트만. 강조는 【】로 감싸기
- 답변은 3~6문장. 너무 길지 않게 대화체로.

[규칙]
- 사주 해석 질문에만 답하라. 사주와 무관한 질문은 "사주와 관련된 질문을 하거라" 식으로 부드럽게 거절.
- 추측이 필요한 부분은 "~할 수 있느니라" 식으로 가능성으로 표현.
- 사주의 구체적 구성(일간, 십성, 오행 분포 등)을 언급하며 해석.

[이 사람의 사주]
${sajuSummary}

위 사주를 기반으로, 상담자의 질문에 대화체로 답하라.`;

  const contents = messages.map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }]
  }));

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000);

    const resp = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=' + KEY,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: contents,
          generationConfig: { maxOutputTokens: 500, temperature: 0.85 }
        })
      }
    );
    clearTimeout(timer);

    if (!resp.ok) {
      const e = await resp.text();
      console.error('Chat Gemini error:', resp.status, e.substring(0, 300));
      return res.status(502).json({ error: 'AI 오류' });
    }

    const data = await resp.json();
    let text = data.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
    if (!text) return res.status(502).json({ error: '빈 응답' });

    res.json({ text: cleanText(text) });
  } catch (err) {
    console.error('Chat:', err.message);
    if (err.name === 'AbortError') return res.status(504).json({ error: '시간 초과' });
    res.status(500).json({ error: '서버 오류' });
  }
});
