// ============================================================
// KASI 24절기 수집 + manseryeok v1.0.7 교차검증 (수정판)
// 실행: node kasi-verify.mjs
// /root/saju/frontend/ 에서 실행
// ============================================================

const API_KEY = encodeURIComponent('af9890c28053d25672e16d60865502ad70709348d8f7f5a6214e9bac61c498a9');
const BASE = 'http://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/get24DivisionsInfo';

// 사주월 경계를 결정하는 12절기(節)
const JEOL_NAMES = ['입춘','경칩','청명','입하','망종','소서','입추','백로','한로','입동','대설','소한'];
const JEOL_TO_JIJI = {'입춘':'寅','경칩':'卯','청명':'辰','입하':'巳','망종':'午','소서':'未','입추':'申','백로':'酉','한로':'戌','입동':'亥','대설':'子','소한':'丑'};

import { calculateSaju } from '@fullstackfamily/manseryeok';

async function fetchYear(year) {
  const url = `${BASE}?solYear=${year}&ServiceKey=${API_KEY}&numOfRows=30&_type=json`;
  const resp = await fetch(url);
  const text = await resp.text();
  
  if (text.includes('SERVICE_KEY_IS_NOT_REGISTERED') || text.includes('Unauthorized') || text.includes('UNAUTHORIZED')) {
    throw new Error('API key unauthorized');
  }
  
  let data;
  try { data = JSON.parse(text); } catch(e) {
    // XML 에러일 수 있음
    const codeMatch = text.match(/<resultCode>(\d+)<\/resultCode>/);
    const msgMatch = text.match(/<resultMsg>([^<]+)<\/resultMsg>/);
    if (codeMatch) throw new Error(`API: ${codeMatch[1]} ${msgMatch?.[1]||''}`);
    throw new Error(`Parse error: ${text.substring(0,100)}`);
  }
  
  const resultCode = data?.response?.header?.resultCode;
  if (resultCode !== '00') {
    throw new Error(`API: ${resultCode} ${data?.response?.header?.resultMsg||''}`);
  }
  
  const items = data?.response?.body?.items?.item;
  if (!items) return [];
  const arr = Array.isArray(items) ? items : [items];
  return arr.map(item => ({
    date: String(item.locdate),
    name: item.dateName,
    kst: item.kst ? String(item.kst).trim() : null,
    sunLongitude: item.sunLongitude
  }));
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  // API 연결 테스트
  console.log('=== API 연결 테스트 ===');
  try {
    const test = await fetchYear(2024);
    console.log(`2024년: ${test.length}개 절기 수신 OK`);
    if (test.length > 0) console.log(`  첫번째: ${test[0].name} ${test[0].date} kst=${test[0].kst}`);
  } catch(e) {
    console.log(`API 테스트 실패: ${e.message}`);
    console.log('\nServiceKey 확인 필요.');
    return;
  }
  
  // API 지원 범위 탐색
  console.log('\n=== API 지원 범위 탐색 ===');
  let minYear = 2024, maxYear = 2024;
  
  for (const y of [2000, 1990, 1980, 1970, 1960, 1950, 1940, 1930, 1920, 1900]) {
    try {
      const items = await fetchYear(y);
      if (items.length > 0) { minYear = y; console.log(`${y}년: OK (${items.length}개)`); }
      else { console.log(`${y}년: 데이터 없음`); break; }
      await sleep(300);
    } catch(e) { console.log(`${y}년: ${e.message}`); break; }
  }
  for (const y of [2026, 2028, 2030, 2040, 2050]) {
    try {
      const items = await fetchYear(y);
      if (items.length > 0) { maxYear = y; console.log(`${y}년: OK (${items.length}개)`); }
      else { console.log(`${y}년: 데이터 없음`); break; }
      await sleep(300);
    } catch(e) { console.log(`${y}년: ${e.message}`); break; }
  }
  console.log(`지원 범위: ${minYear}~${maxYear}년`);
  
  // 본격 검증
  console.log(`\n=== 검증 시작: ${minYear}~${maxYear} ===\n`);
  
  let totalChecks = 0, passed = 0, failed = 0;
  const failures = [];
  
  for (let year = minYear; year <= maxYear; year++) {
    try {
      const items = await fetchYear(year);
      if (items.length === 0) continue;
      
      const jeols = items.filter(it => JEOL_NAMES.includes(it.name));
      let yearFail = 0;
      
      for (const jeol of jeols) {
        const ds = jeol.date;
        const y = parseInt(ds.substring(0,4)), m = parseInt(ds.substring(4,6)), d = parseInt(ds.substring(6,8));
        const ej = JEOL_TO_JIJI[jeol.name];
        if (!ej) continue;
        
        let kstH = 12;
        if (jeol.kst && jeol.kst.length >= 4) kstH = parseInt(jeol.kst.substring(0,2));
        
        // 절기 당일 (절기 시각+2시간) → 새 월
        const ch = Math.min(23, kstH + 2);
        const on = calculateSaju(y, m, d, ch, 0, {applyTimeCorrection: false});
        totalChecks++;
        if (on.monthPillarHanja[1] === ej) { passed++; }
        else { failed++; yearFail++; failures.push({year, j:jeol.name, d:`${y}.${m}.${d}`, kst:jeol.kst, ch, exp:ej, got:on.monthPillarHanja[1], mp:on.monthPillarHanja, t:'당일'}); }
        
        // 절기 전날 오전 → 이전 월
        const pv = new Date(y, m-1, d-1);
        const pvr = calculateSaju(pv.getFullYear(), pv.getMonth()+1, pv.getDate(), 6, 0, {applyTimeCorrection: false});
        totalChecks++;
        if (pvr.monthPillarHanja[1] !== ej) { passed++; }
        else { failed++; yearFail++; failures.push({year, j:jeol.name, d:`${pv.getFullYear()}.${pv.getMonth()+1}.${pv.getDate()}`, exp:'≠'+ej, got:pvr.monthPillarHanja[1], t:'전날'}); }
      }
      
      if (yearFail > 0) console.log(`${year}: ❌ ${yearFail}건`);
      else if (year % 10 === 0 || year === minYear || year === maxYear) console.log(`${year}: ✅ ${jeols.length}개 통과`);
      
      await sleep(250);
    } catch(e) {
      console.log(`${year}: ERR ${e.message}`);
      await sleep(1000);
    }
  }
  
  console.log(`\n${'='.repeat(50)}`);
  console.log(`총: ${totalChecks}건 | 통과: ${passed} (${totalChecks>0?(passed/totalChecks*100).toFixed(2):0}%) | 실패: ${failed}`);
  
  if (failures.length > 0) {
    console.log(`\n=== 불일치 ===`);
    failures.forEach(f => console.log(`  ${f.year} ${f.j} ${f.d} kst=${f.kst||'?'} ch=${f.ch||'?'}: 기대=${f.exp} 실제=${f.got} ${f.mp||''} [${f.t}]`));
  } else {
    console.log(`\n🎉 전 구간 KASI↔라이브러리 일치!`);
  }
  
  const fs = await import('fs');
  fs.writeFileSync('kasi-verify-result.json', JSON.stringify({totalChecks,passed,failed,failures,range:`${minYear}-${maxYear}`},null,2));
  console.log(`저장: kasi-verify-result.json`);
}

main().catch(e => console.error('Fatal:', e));
