// ============================================================
// saju-core.js — SajuCat 자체 만세력 모듈 v2.0
// ============================================================
// 연주/일주/시주: 공식 기반 (모든 연도)
// 월주: KASI 절기 시각 (2000~2026) + astronomy-engine fallback
// ============================================================

import kasiRaw from './kasi-jeolgi-table.json';
import { MakeTime, SearchSunLongitude } from 'astronomy-engine';

// ============================================================
// 상수
// ============================================================

const 천간 = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const 지지 = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];

const VALID_JEOLGI = [
  '소한','입춘','경칩','청명','입하','망종',
  '소서','입추','백로','한로','입동','대설'
];

// 절기 → 월지 인덱스
const JEOLGI_TO_JI_IDX = {
  '소한': 1, '입춘': 2, '경칩': 3, '청명': 4,
  '입하': 5, '망종': 6, '소서': 7, '입추': 8,
  '백로': 9, '한로': 10, '입동': 11, '대설': 0,
};

// 절기 → 태양 황경(도)
const JEOLGI_SUN_LNG = {
  '소한': 285, '입춘': 315, '경칩': 345, '청명': 15,
  '입하': 45,  '망종': 75,  '소서': 105, '입추': 135,
  '백로': 165, '한로': 195, '입동': 225, '대설': 255,
};

// 절기 순서 (시간순) — fallback 계산용
const JEOLGI_ORDER = [
  '소한','입춘','경칩','청명','입하','망종',
  '소서','입추','백로','한로','입동','대설'
];

// 년상기월법: 연간 → 인월(寅月) 천간 시작
const YEAR_GAN_TO_YIN_START = [2, 4, 6, 8, 0, 2, 4, 6, 8, 0];

// 일상기시법(오자둔법): 일간 → 자시(子時) 천간 시작
const DAY_GAN_TO_ZI_START = [0, 2, 4, 6, 8, 0, 2, 4, 6, 8];

// 일주 기준점: 2000-01-01 = 戊午
const BASE_GAN_IDX = 4;
const BASE_JI_IDX = 6;

// ============================================================
// KASI 절기 타임라인 구축
// ============================================================

function buildKasiTimeline(rawData) {
  const events = [];
  for (const [, entries] of Object.entries(rawData)) {
    for (const e of entries) {
      if (!VALID_JEOLGI.includes(e.name)) continue;
      const numericTime = e.year * 100000000
        + e.month * 1000000
        + e.day * 10000
        + e.hour * 100
        + e.minute;
      events.push({
        name: e.name,
        jiIdx: JEOLGI_TO_JI_IDX[e.name],
        year: e.year,
        month: e.month,
        day: e.day,
        hour: e.hour,
        minute: e.minute,
        numericTime,
      });
    }
  }
  // 2000년 입춘 중복 제거
  const seen = new Set();
  const unique = events.filter(e => {
    const key = `${e.year}-${e.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  unique.sort((a, b) => a.numericTime - b.numericTime);
  return unique;
}

const KASI_TL = buildKasiTimeline(kasiRaw);

// ============================================================
// astronomy-engine fallback: 절기 시각 계산
// ============================================================

// 캐시: 한번 계산한 절기는 저장
const astroCache = new Map();

/**
 * astronomy-engine으로 특정 연도·절기의 KST 시각을 계산
 * @returns {{ numericTime, name, jiIdx, year, month, day, hour, minute }}
 */
function calcJeolgiByAstro(year, jeolgiName) {
  const cacheKey = `${year}-${jeolgiName}`;
  if (astroCache.has(cacheKey)) return astroCache.get(cacheKey);

  const targetLng = JEOLGI_SUN_LNG[jeolgiName];

  // 검색 시작: 절기 예상일 약간 전 (UTC)
  const approxMonth = JEOLGI_ORDER.indexOf(jeolgiName);
  const searchStart = new Date(Date.UTC(year, approxMonth, 1, 0, 0, 0));
  const astroTime = MakeTime(searchStart);

  let result;
  try {
    result = SearchSunLongitude(targetLng, astroTime, 40);
  } catch {
    return null;
  }
  if (!result) return null;

  // UTC → KST (+9h)
  const utcDate = result.date;
  const kstMs = utcDate.getTime() + 9 * 60 * 60 * 1000;
  const kst = new Date(kstMs);

  const m = kst.getUTCMonth() + 1;
  const d = kst.getUTCDate();
  const h = kst.getUTCHours();
  const mi = kst.getUTCMinutes();
  const numericTime = year * 100000000 + m * 1000000 + d * 10000 + h * 100 + mi;

  const entry = {
    name: jeolgiName,
    jiIdx: JEOLGI_TO_JI_IDX[jeolgiName],
    year, month: m, day: d, hour: h, minute: mi,
    numericTime,
    source: 'astro',
  };

  astroCache.set(cacheKey, entry);
  return entry;
}

/**
 * 특정 연도의 12절기 전체를 계산 (astronomy-engine)
 */
function getYearJeolgiByAstro(year) {
  return JEOLGI_ORDER.map(name => calcJeolgiByAstro(year, name)).filter(Boolean);
}

// ============================================================
// 통합 절기 타임라인: KASI 범위 안이면 KASI, 밖이면 astro
// ============================================================

// KASI 범위
const KASI_MIN_YEAR = 2000;
const KASI_MAX_YEAR = 2026;

/**
 * 주어진 birthNumeric 직전(이하)의 절기를 찾는다
 */
function findCurrentJeolgi(birthNumeric) {
  const birthYear = Math.floor(birthNumeric / 100000000);

  // KASI 범위 내: KASI 타임라인에서 역순 탐색
  if (birthYear >= KASI_MIN_YEAR && birthYear <= KASI_MAX_YEAR) {
    for (let i = KASI_TL.length - 1; i >= 0; i--) {
      if (KASI_TL[i].numericTime <= birthNumeric) return KASI_TL[i];
    }
    // birthNumeric이 KASI 첫 이벤트보다 이전
    // → 전년도 대설을 astro로 계산
    return calcJeolgiByAstro(birthYear - 1, '대설');
  }

  // KASI 범위 밖: astronomy-engine으로 계산
  // 해당 연도 + 전년도 절기를 모두 구해서 역순 탐색
  const candidates = [
    ...getYearJeolgiByAstro(birthYear),
    ...getYearJeolgiByAstro(birthYear - 1),
  ].sort((a, b) => a.numericTime - b.numericTime);

  for (let i = candidates.length - 1; i >= 0; i--) {
    if (candidates[i].numericTime <= birthNumeric) return candidates[i];
  }

  return null;
}

// ============================================================
// 연주 (年柱)
// ============================================================

function findIpchun(year) {
  // KASI 범위
  const kasiIpchun = KASI_TL.find(e => e.year === year && e.name === '입춘');
  if (kasiIpchun) return kasiIpchun.numericTime;

  // astronomy-engine fallback
  const astro = calcJeolgiByAstro(year, '입춘');
  return astro ? astro.numericTime : year * 100000000 + 2040000; // 최후 fallback: 2/4
}

function calcYearPillar(year, birthNumeric) {
  const ipchunNT = findIpchun(year);
  const sajuYear = birthNumeric < ipchunNT ? year - 1 : year;

  const ganIdx = ((sajuYear - 4) % 10 + 10) % 10;
  const jiIdx = ((sajuYear - 4) % 12 + 12) % 12;

  return { 천간: 천간[ganIdx], 지지: 지지[jiIdx], ganIdx, jiIdx, sajuYear };
}

// ============================================================
// 월주 (月柱)
// ============================================================

function calcMonthPillar(sajuYear, birthNumeric) {
  const jeolgi = findCurrentJeolgi(birthNumeric);
  if (!jeolgi) return null;

  const monthJiIdx = jeolgi.jiIdx;
  const yearGanIdx = ((sajuYear - 4) % 10 + 10) % 10;
  const yinStart = YEAR_GAN_TO_YIN_START[yearGanIdx];
  const offset = (monthJiIdx - 2 + 12) % 12;
  const monthGanIdx = (yinStart + offset) % 10;

  return {
    천간: 천간[monthGanIdx],
    지지: 지지[monthJiIdx],
    ganIdx: monthGanIdx,
    jiIdx: monthJiIdx,
    jeolgiName: jeolgi.name,
    source: jeolgi.source || 'kasi',
  };
}

// ============================================================
// 일주 (日柱)
// ============================================================

function calcDayPillar(year, month, day) {
  const target = Date.UTC(year, month - 1, day);
  const base = Date.UTC(2000, 0, 1);
  const diffDays = Math.round((target - base) / (24 * 60 * 60 * 1000));

  const ganIdx = ((BASE_GAN_IDX + diffDays) % 10 + 10) % 10;
  const jiIdx = ((BASE_JI_IDX + diffDays) % 12 + 12) % 12;

  return { 천간: 천간[ganIdx], 지지: 지지[jiIdx], ganIdx, jiIdx };
}

// ============================================================
// 시주 (時柱)
// ============================================================

function getHourJiIdx(hour) {
  if (hour >= 23 || hour < 1) return 0;
  return Math.floor((hour + 1) / 2);
}

function calcHourPillar(dayGanIdx, hour) {
  const jiIdx = getHourJiIdx(hour);
  const ziStart = DAY_GAN_TO_ZI_START[dayGanIdx];
  const ganIdx = (ziStart + jiIdx) % 10;

  return { 천간: 천간[ganIdx], 지지: 지지[jiIdx], ganIdx, jiIdx };
}

// ============================================================
// 메인 함수
// ============================================================

/**
 * 사주 계산
 * @param {number} year   - 생년 (양력, KST)
 * @param {number} month  - 생월 (1~12)
 * @param {number} day    - 생일 (1~31)
 * @param {number} hour   - 생시 (0~23, KST)
 * @param {number} minute - 생분 (0~59), 기본값 0
 * @returns {object}
 */
export function calculateSaju(year, month, day, hour, minute = 0) {
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) {
    throw new Error(`Invalid input: ${year}-${month}-${day}`);
  }
  if (hour < 0 || hour > 23) throw new Error(`Invalid hour: ${hour}`);

  const birthNumeric = year * 100000000 + month * 1000000
    + day * 10000 + hour * 100 + minute;

  const yearP = calcYearPillar(year, birthNumeric);
  const dayP = calcDayPillar(year, month, day);
  const hourP = calcHourPillar(dayP.ganIdx, hour);
  const monthP = calcMonthPillar(yearP.sajuYear, birthNumeric);

  return {
    연주: { 천간: yearP.천간, 지지: yearP.지지 },
    월주: monthP ? { 천간: monthP.천간, 지지: monthP.지지 } : null,
    일주: { 천간: dayP.천간, 지지: dayP.지지 },
    시주: { 천간: hourP.천간, 지지: hourP.지지 },
    meta: {
      sajuYear: yearP.sajuYear,
      monthSource: monthP?.source || null,
      monthJeolgi: monthP?.jeolgiName || null,
    },
  };
}

export function ganjiStr(pillar) {
  if (!pillar) return '??';
  return pillar.천간 + pillar.지지;
}

export function sajuToString(result) {
  return `${ganjiStr(result.시주)} ${ganjiStr(result.일주)} ${ganjiStr(result.월주)} ${ganjiStr(result.연주)}`;
}

// ============================================================
// 진태양시 보정
// ============================================================

export function applyTrueSolarTime(hour, minute, longitude) {
  const STANDARD_LNG = 135;
  const correctionMinutes = (longitude - STANDARD_LNG) * 4;
  let totalMinutes = hour * 60 + minute + correctionMinutes;

  let dayOffset = 0;
  if (totalMinutes < 0) { dayOffset = -1; totalMinutes += 1440; }
  else if (totalMinutes >= 1440) { dayOffset = 1; totalMinutes -= 1440; }

  return {
    hour: Math.floor(totalMinutes / 60),
    minute: Math.floor(totalMinutes % 60),
    dayOffset,
  };
}
