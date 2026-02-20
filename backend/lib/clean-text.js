function cleanText(t) {
  if (!t) return t;
  // 따옴표/백틱 제거
  t = t.replace(/[\u201C\u201D\u2018\u2019\u300C\u300D\u300E\u300F\u0022\u0027\u0060\u00AB\u00BB]/g, '');
  // 마크다운 → 【】
  t = t.replace(/\*\*([^*]+)\*\*/g, '\u3010$1\u3011');
  t = t.replace(/\*([^*]+)\*/g, '$1');
  t = t.replace(/^#{1,4}\s*/gm, '');
  // 리스트 제거
  t = t.replace(/^[\-\u2022\u25CF\u25C6\u25B8\u25B9\u25B6\u25A0\u25C7\u00B7]\s*/gm, '');
  t = t.replace(/^\d+[\.\)]\s*/gm, '');
  // 라벨: 제거
  t = t.replace(/^[가-힣A-Za-z\s]+:\s*/gm, function(m) { return m.length > 15 ? m : ''; });
  // 구분선
  t = t.replace(/^[\-=]{3,}\s*$/gm, '');
  // AI 말버릇
  t = t.replace(/^(자,?\s*|그렇다면\s*|다음으로\s*|마지막으로\s*|결론적으로\s*|요약하자면\s*|정리하자면\s*|종합하면\s*|즉,?\s*|따라서\s*|한마디로\s*)/gm, '');
  // 존댓말 → 무당체
  t = t.replace(/입니다\./g, '이니라.');
  t = t.replace(/합니다\./g, '하느니라.');
  t = t.replace(/됩니다\./g, '되느니라.');
  t = t.replace(/습니다\./g, '느니라.');
  t = t.replace(/세요\./g, '거라.');
  t = t.replace(/하세요/g, '하거라');
  t = t.replace(/십시오/g, '거라');
  t = t.replace(/보세요/g, '보거라');
  t = t.replace(/드립니다/g, '주마');
  t = t.replace(/겠습니다/g, '겠느니라');
  t = t.replace(/있습니다/g, '있느니라');
  t = t.replace(/없습니다/g, '없느니라');
  // 이모지 제거
  t = t.replace(/[\u0022\u0027\u0060]/g, '');
  t = t.replace(/\(\s*\)/g, '');
  t = t.replace(/\n{3,}/g, '\n\n');
  t = t.replace(/^\s*\n/gm, '\n');
  t = t.replace(/\n{3,}/g, '\n\n');
  return t.trim();
}
module.exports = cleanText;
