// ============================================================
// text-utils.js — 화면 문장 교정 (조사 자동 선택)
// ============================================================

function hasBatchim(syllable) {
  const code = syllable.charCodeAt(0) - 0xAC00;
  if (code < 0 || code > 11171) return null;
  return code % 28 !== 0;
}
function isRieul(syllable) {
  return (syllable.charCodeAt(0) - 0xAC00) % 28 === 8;
}

const PAIRS = [['이', '가'], ['은', '는'], ['을', '를'], ['과', '와'], ['으로', '로']];

/** 단어 뒤에 붙일 조사 선택. josa('화', '이/가') → '가' */
export function josa(word, pair) {
  const [withB, withoutB] = pair.split('/');
  const base = String(word).replace(/\([^)]*\)$/, '').replace(/\*+$/, '');
  const last = base.slice(-1);
  const b = hasBatchim(last);
  if (b === null) return withB;
  if (withB === '으로') return b && !isRieul(last) ? '으로' : '로';
  return b ? withB : withoutB;
}

// 교정 대상 명사: 오행·십성 이름만 (사이·차이 같은 일반어 오교정을 막기 위해 한정)
const NOUNS = '목|화|토|금|수|비견|겁재|식신|상관|편재|정재|편관|정관|편인|정인';
const PARTICLES = '으로|이|가|은|는|을|를|과|와|로';
const JOSA_RE = new RegExp(
  `(^|[\\s(\\[·,'"*])(${NOUNS})(\\([^)]{1,4}\\))?(\\*\\*)?(${PARTICLES})(?=[\\s,.!?…:;'")\\]]|$)`,
  'g'
);

/** 오행·십성 이름 뒤에 잘못 붙은 조사를 받침에 맞게 교정 */
export function fixJosa(text) {
  if (typeof text !== 'string') return text;
  return text.replace(JOSA_RE, (m, pre, noun, paren, bold, p) => {
    const pair = PAIRS.find(([a, b]) => a === p || b === p);
    if (!pair) return m;
    return pre + noun + (paren || '') + (bold || '') + josa(noun, pair.join('/'));
  });
}
