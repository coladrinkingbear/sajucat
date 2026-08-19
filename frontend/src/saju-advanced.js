// ============================================================
// saju-advanced.js — Phase 4: 대운/세운/일진 시스템
// ============================================================

import { 천간, 지지, 천간오행, 지지오행, 천간음양, 지장간, 월령세력, 십이운성 } from './saju-tables.js';
import { findPrevNextJeolgi } from './saju-core.js';

// ──────────────────────────────────────────
// 4-1. 대운 시작 나이 계산
// 순행(양남음녀): 출생 → 다음 절기까지 / 역행: 이전 절기 → 출생까지, 일수 ÷ 3
// 절기 시각은 KASI 표(2000~2026) + astronomy-engine 폴백 (saju-core.js)
// ──────────────────────────────────────────
export function 대운시작나이(birthYear, birthMonth, birthDay, gender, 연간, birthHour = 12, birthMinute = 0) {
  const 양남음녀 = (천간음양[연간] === '양' && gender === '남') || (천간음양[연간] === '음' && gender === '여');
  const { prev, next } = findPrevNextJeolgi(birthYear, birthMonth, birthDay, birthHour, birthMinute);
  const target = 양남음녀 ? next : prev;
  if (!target) return 5; // 절기 계산 실패 시 안전 폴백

  // KST 벽시계를 Date.UTC로 통일해 로컬 타임존 영향 제거
  const birthMs = Date.UTC(birthYear, birthMonth - 1, birthDay, birthHour, birthMinute);
  const targetMs = Date.UTC(target.year, target.month - 1, target.day, target.hour, target.minute);
  const diffDays = Math.abs(targetMs - birthMs) / 86400000;

  // 3일 = 1년. 나머지는 반올림.
  const 시작나이 = Math.max(1, Math.round(diffDays / 3));
  return Math.min(시작나이, 10); // 최대 10세
}

// ──────────────────────────────────────────
// 4-2. 대운 10개 생성 (시작 나이 포함)
// ──────────────────────────────────────────
export function 대운생성(월간, 월지, 연간, gender, birthYear, birthMonth, birthDay, 일간) {
  const 양남음녀 = (천간음양[연간] === '양' && gender === '남') || (천간음양[연간] === '음' && gender === '여');
  const dir = 양남음녀 ? 1 : -1;
  const 시작나이 = 대운시작나이(birthYear, birthMonth, birthDay, gender, 연간);

  let gi = 천간.indexOf(월간);
  let ji = 지지.indexOf(월지);
  const 대운들 = [];

  for (let i = 0; i < 10; i++) {
    gi = ((gi + dir) % 10 + 10) % 10;
    ji = ((ji + dir) % 12 + 12) % 12;
    const g = 천간[gi], j = 지지[ji];
    const 시작 = 시작나이 + i * 10;
    const 끝 = 시작 + 9;

    대운들.push({
      순번: i + 1,
      간지: g + j,
      천간: g,
      지지: j,
      시작나이: 시작,
      끝나이: 끝,
      천간오행: 천간오행[g],
      지지오행: 지지오행[j],
      운성: 십이운성(일간, j)
    });
  }

  return { 시작나이, 순행: 양남음녀, 대운: 대운들 };
}

// ──────────────────────────────────────────
// 4-3. 대운별 길흉 판정
// ──────────────────────────────────────────
export function 대운길흉(대운, 용신, 기신, 일간, 원국Z) {
  const 상생 = { 목:'수', 화:'목', 토:'화', 금:'토', 수:'금' };
  const 상극표 = { 목:'금', 화:'수', 토:'목', 금:'화', 수:'토' };
  const 충쌍 = [['子','午'],['丑','未'],['寅','申'],['卯','酉'],['辰','戌'],['巳','亥']];

  return 대운.map(d => {
    let 점수 = 50; // 기본 50
    const 요소 = [];

    // 천간 오행이 용신이면 +
    if (d.천간오행 === 용신) { 점수 += 15; 요소.push('천간이 용신(' + 용신 + ')과 같아 길'); }
    if (d.지지오행 === 용신) { 점수 += 15; 요소.push('지지가 용신(' + 용신 + ')과 같아 길'); }
    // 용신을 생하는 오행
    if (상생[용신] === d.천간오행) { 점수 += 10; 요소.push('천간이 용신을 생해 희신 역할'); }
    if (상생[용신] === d.지지오행) { 점수 += 10; 요소.push('지지가 용신을 생해 희신 역할'); }
    // 기신이면 -
    if (d.천간오행 === 기신) { 점수 -= 12; 요소.push('천간이 기신(' + 기신 + ')이라 불리'); }
    if (d.지지오행 === 기신) { 점수 -= 12; 요소.push('지지가 기신(' + 기신 + ')이라 불리'); }

    // 일지와 대운 지지의 충 체크
    const 일지 = 원국Z[2];
    for (const [a, b] of 충쌍) {
      if ((일지 === a && d.지지 === b) || (일지 === b && d.지지 === a)) {
        점수 -= 10;
        요소.push(일지 + d.지지 + '충으로 변동 암시');
      }
    }

    // 운성 가감
    const 강운 = ['건록','제왕','관대','장생'];
    const 약운 = ['사','묘','절','병'];
    if (강운.includes(d.운성)) { 점수 += 5; 요소.push('운성 ' + d.운성 + '으로 에너지 강화'); }
    if (약운.includes(d.운성)) { 점수 -= 5; 요소.push('운성 ' + d.운성 + '으로 에너지 약화'); }

    점수 = Math.max(10, Math.min(95, 점수));

    let 등급;
    if (점수 >= 75) 등급 = '대길';
    else if (점수 >= 60) 등급 = '길';
    else if (점수 >= 45) 등급 = '보통';
    else if (점수 >= 30) 등급 = '흉';
    else 등급 = '대흉';

    return { ...d, 점수, 등급, 요소 };
  });
}

// ──────────────────────────────────────────
// 4-5. 세운 (연운) 분석
// ──────────────────────────────────────────
export function 세운분석(연도, 일간, 용신, 기신, 원국Z) {
  // 연도 → 천간/지지
  const baseYear = 1984; // 甲子년
  const offset = ((연도 - baseYear) % 60 + 60) % 60;
  const g = 천간[offset % 10];
  const j = 지지[offset % 12];
  const gOh = 천간오행[g];
  const jOh = 지지오행[j];

  let 점수 = 50;
  const 요소 = [];

  if (gOh === 용신) { 점수 += 15; 요소.push('세운 천간이 용신과 같아 길'); }
  if (jOh === 용신) { 점수 += 15; 요소.push('세운 지지가 용신과 같아 길'); }
  if (gOh === 기신) { 점수 -= 12; 요소.push('세운 천간이 기신이라 주의'); }
  if (jOh === 기신) { 점수 -= 12; 요소.push('세운 지지가 기신이라 주의'); }

  // 일지 충 체크
  const 충쌍 = [['子','午'],['丑','未'],['寅','申'],['卯','酉'],['辰','戌'],['巳','亥']];
  const 일지 = 원국Z[2];
  for (const [a, b] of 충쌍) {
    if ((일지 === a && j === b) || (일지 === b && j === a)) {
      점수 -= 10;
      요소.push(일지 + j + '충 — 큰 변화 암시');
    }
  }

  점수 = Math.max(10, Math.min(95, 점수));

  let 등급;
  if (점수 >= 75) 등급 = '상길(上吉)';
  else if (점수 >= 60) 등급 = '소길(小吉)';
  else if (점수 >= 45) 등급 = '평(平)';
  else if (점수 >= 30) 등급 = '소흉(小凶)';
  else 등급 = '대흉(大凶)';

  return { 연도, 간지: g + j, 천간: g, 지지: j, 천간오행: gOh, 지지오행: jOh, 점수, 등급, 요소 };
}

// ──────────────────────────────────────────
// 4-6. 월운 12개월 (세운 위에)
// ──────────────────────────────────────────
const 월별절기천간 = [
  // 1월(소한)~12월(대설). 연간에 따라 천간이 달라짐 → 연간×2+월 공식
  // 여기선 간단히 연간 기준 생성
];

export function 월운생성(연도, 일간, 용신, 기신) {
  const baseYear = 1984;
  const yearOffset = ((연도 - baseYear) % 60 + 60) % 60;
  const yearG = 천간[yearOffset % 10];

  // 연간에 따른 1월(인월) 천간 시작
  const 월두법 = { 甲: 2, 乙: 4, 丙: 6, 丁: 8, 戊: 0, 己: 2, 庚: 4, 辛: 6, 壬: 8, 癸: 0 };
  const startGi = 월두법[yearG];
  const 월지순 = ['寅','卯','辰','巳','午','未','申','酉','戌','亥','子','丑'];
  const 월이름 = ['1월(인월)','2월(묘월)','3월(진월)','4월(사월)','5월(오월)','6월(미월)','7월(신월)','8월(유월)','9월(술월)','10월(해월)','11월(자월)','12월(축월)'];

  return 월지순.map((mj, i) => {
    const mg = 천간[(startGi + i) % 10];
    const gOh = 천간오행[mg];
    const jOh = 지지오행[mj];
    let 점수 = 50;
    if (gOh === 용신 || jOh === 용신) 점수 += 15;
    if (gOh === 기신 || jOh === 기신) 점수 -= 12;
    점수 = Math.max(15, Math.min(90, 점수));

    let 등급;
    if (점수 >= 70) 등급 = '길';
    else if (점수 >= 45) 등급 = '평';
    else 등급 = '흉';

    return { 월: i + 1, 이름: 월이름[i], 간지: mg + mj, 천간: mg, 지지: mj, 점수, 등급 };
  });
}

// ──────────────────────────────────────────
// 4-7. 일진 (오늘의 운세)
// ──────────────────────────────────────────
export function 일진계산(year, month, day) {
  // 기준일: 2000-01-01 = 戊午일 → 천간idx=4, 지지idx=6
  const base = new Date(2000, 0, 1);
  const target = new Date(year, month - 1, day);
  const diff = Math.round((target - base) / 86400000);
  const gi = ((4 + diff) % 10 + 10) % 10;
  const ji = ((6 + diff) % 12 + 12) % 12;
  return { 천간: 천간[gi], 지지: 지지[ji], 간지: 천간[gi] + 지지[ji] };
}

export function 오늘운세(일간, 용신, 기신) {
  const now = new Date();
  const 일진 = 일진계산(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const gOh = 천간오행[일진.천간];
  const jOh = 지지오행[일진.지지];
  const 일oh = 천간오행[일간];

  let 점수 = 50;
  const 요소 = [];

  if (gOh === 용신) { 점수 += 15; 요소.push('오늘 천간이 용신과 같아 좋은 하루'); }
  if (jOh === 용신) { 점수 += 10; 요소.push('오늘 지지가 용신 기운'); }
  if (gOh === 기신) { 점수 -= 12; 요소.push('오늘 천간이 기신이라 조심'); }
  if (jOh === 기신) { 점수 -= 10; 요소.push('오늘 지지가 기신 기운'); }
  if (gOh === 일oh) { 점수 += 5; 요소.push('비견의 날 — 동료/경쟁'); }

  점수 = Math.max(10, Math.min(95, 점수));

  let 한줄;
  if (점수 >= 75) 한줄 = '기운이 충만한 하루일세. 새로운 일을 시작하기 좋겠네.';
  else if (점수 >= 60) 한줄 = '무난한 하루가 되겠네. 꾸준히 하던 일에 집중하게.';
  else if (점수 >= 45) 한줄 = '평범한 하루일세. 무리하지 말고 차분히 보내게.';
  else if (점수 >= 30) 한줄 = '기운이 약한 날이네. 큰 결정은 미루는 게 좋겠네.';
  else 한줄 = '조심해야 할 하루일세. 다툼과 과욕을 삼가게.';

  return { 일진, 점수, 요소, 한줄 };
}
