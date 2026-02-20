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
