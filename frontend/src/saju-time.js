// ============================================================
// saju-time.js — 출생 시각 → 사주용 시각 변환 + 시진 선택지
// ============================================================
// 한국 시계 시각은 시대마다 UTC 기준이 달랐음 (서머타임, 1954~61년 UTC+8:30).
// 절기 판정(연·월주)은 KST(UTC+9) 순간으로, 시진·일 경계는 진태양시(경도 보정)로 계산한다.
// 일 경계는 자시일변: 진태양시 23:00부터 다음 날 일주.

import { calculateSaju } from './saju-core.js';

// Asia/Seoul 역사적 UTC 오프셋(분) — IANA tzdata 2025b에서 추출, 날짜 단위(전환 당일 시각 차이는 무시)
const KOREA_OFFSETS = [
  ['1948-06-01', '1948-09-12', 600], ['1949-04-03', '1949-09-10', 600],
  ['1950-04-01', '1950-09-09', 600], ['1951-05-06', '1951-09-08', 600],
  ['1954-03-21', '1955-05-04', 510], ['1955-05-05', '1955-09-08', 570],
  ['1955-09-09', '1956-05-19', 510], ['1956-05-20', '1956-09-29', 570],
  ['1956-09-30', '1957-05-04', 510], ['1957-05-05', '1957-09-21', 570],
  ['1957-09-22', '1958-05-03', 510], ['1958-05-04', '1958-09-20', 570],
  ['1958-09-21', '1959-05-02', 510], ['1959-05-03', '1959-09-19', 570],
  ['1959-09-20', '1960-04-30', 510], ['1960-05-01', '1960-09-17', 570],
  ['1960-09-18', '1961-08-09', 510],
  ['1987-05-10', '1987-10-10', 600], ['1988-05-08', '1988-10-08', 600],
];

const pad = n => String(n).padStart(2, '0');

export function koreaOffsetMin(year, month, day) {
  const d = `${year}-${pad(month)}-${pad(day)}`;
  for (const [s, e, off] of KOREA_OFFSETS) if (d >= s && d <= e) return off;
  return 540;
}

// 보정없음(해외, 135) → 시계 시각을 그대로 진태양시로 취급
function isCorrected(longitude) {
  return !!longitude && longitude !== 135;
}

// 시계 시각 - 진태양시 (분)
function clockMinusTst(year, month, day, longitude) {
  if (!isCorrected(longitude)) return 0;
  return koreaOffsetMin(year, month, day) - Math.round(longitude * 4);
}

function shiftWall(year, month, day, hour, minute, deltaMin) {
  const t = new Date(Date.UTC(year, month - 1, day, hour, minute) + deltaMin * 60000);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), h: t.getUTCHours(), mi: t.getUTCMinutes() };
}

/**
 * 출생 시계 시각 → 네 기둥
 * @returns {{연주, 월주, 일주, 시주}} 각 {천간, 지지}
 */
export function birthPillars(year, month, day, hour, minute, longitude) {
  const off = isCorrected(longitude) ? koreaOffsetMin(year, month, day) : 540;
  // 절기 판정용 KST(UTC+9) 순간
  const kst = shiftWall(year, month, day, hour, minute, 540 - off);
  // 진태양시
  const tst = shiftWall(year, month, day, hour, minute, -clockMinusTst(year, month, day, longitude));
  // 자시일변: 진태양시 23:00부터 다음 날
  const dayRef = shiftWall(tst.y, tst.m, tst.d, tst.h, tst.mi, 60);
  const hh = tst.h >= 23 ? 0 : tst.h, mm = tst.h >= 23 ? 30 : tst.mi;

  const ym = calculateSaju(kst.y, kst.m, kst.d, kst.h, kst.mi);
  const dh = calculateSaju(dayRef.y, dayRef.m, dayRef.d, hh, mm);
  return { 연주: ym.연주, 월주: ym.월주, 일주: dh.일주, 시주: dh.시주 };
}

const SIJIN = [
  ['자', '子'], ['축', '丑'], ['인', '寅'], ['묘', '卯'], ['진', '辰'], ['사', '巳'],
  ['오', '午'], ['미', '未'], ['신', '申'], ['유', '酉'], ['술', '戌'], ['해', '亥'],
];
const hm = m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

/**
 * 출생지·날짜 기준 시진별 시계 시각 범위 (시간순)
 * 자정을 걸치는 시진은 자정 전/후 두 칸으로 나눔 (입력한 날짜 기준으로 일주가 달라지므로)
 * @returns {Array<{ji, name, start, end, hour, minute, label}>} start/end는 시계 분(0~1439, end 포함)
 */
export function sijinOptions(year, month, day, longitude) {
  const shift = clockMinusTst(year, month, day, longitude);
  const opts = [];
  for (let k = 0; k < 12; k++) {
    const tstStart = (k * 120 - 60 + 1440) % 1440;
    const start = ((tstStart + shift) % 1440 + 1440) % 1440;
    const end = start + 120; // 미포함
    const [kor, han] = SIJIN[k];
    const parts = end <= 1440 ? [[start, end - 1]] : [[start, 1439], [0, end - 1441]];
    for (const [s, e] of parts) {
      const mid = Math.floor((s + e) / 2);
      opts.push({ ji: han, name: `${kor}시`, start: s, end: e, hour: Math.floor(mid / 60), minute: mid % 60, label: `${kor}시(${han})`, range: `${hm(s)}~${hm(e)}` });
    }
  }
  return opts.sort((a, b) => a.start - b.start);
}

/** 사용자에게 보여줄 시대별 시간 보정 안내 (없으면 null) */
export function eraNote(year, month, day, longitude) {
  if (!isCorrected(longitude)) return null;
  const off = koreaOffsetMin(year, month, day);
  if (off === 600) return '그 해 여름엔 서머타임(1시간 앞당김)이 있었으니 반영했네.';
  if (off === 570) return '그 시절 표준시(UTC+8:30)와 서머타임을 함께 반영했네.';
  if (off === 510) return '그 시절엔 표준시가 지금보다 30분 늦었으니(UTC+8:30) 반영했네.';
  return null;
}
