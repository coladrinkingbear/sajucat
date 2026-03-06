// ============================================================
// KASI 24절기 데이터 수집기
// 실행: node kasi-collect.mjs
// /root/saju/frontend/ 에서 실행
// 결과: kasi-jeolgi-table.json
// ============================================================

const API_KEY = encodeURIComponent('af9890c28053d25672e16d60865502ad70709348d8f7f5a6214e9bac61c498a9');
const BASE = 'http://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/get24DivisionsInfo';

// 사주 월주에 영향을 주는 12절기(節)
const JEOL_SET = new Set(['입춘','경칩','청명','입하','망종','소서','입추','백로','한로','입동','대설','소한']);

async function fetchYear(year) {
  const url = `${BASE}?solYear=${year}&ServiceKey=${API_KEY}&numOfRows=30&_type=json`;
  const resp = await fetch(url);
  const text = await resp.text();
  
  let data;
  try { data = JSON.parse(text); } catch(e) {
    throw new Error(`Parse error ${year}: ${text.substring(0,80)}`);
  }
  
  if (data?.response?.header?.resultCode !== '00') {
    throw new Error(`API ${year}: ${data?.response?.header?.resultCode} ${data?.response?.header?.resultMsg||''}`);
  }
  
  const items = data?.response?.body?.items?.item;
  if (!items) return [];
  return (Array.isArray(items) ? items : [items]).map(it => ({
    date: String(it.locdate),
    name: it.dateName,
    kst: it.kst ? String(it.kst).trim() : null,
    sunLng: it.sunLongitude != null ? Number(it.sunLongitude) : null
  }));
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('=== KASI 24절기 데이터 수집 ===\n');
  
  const table = {}; // { "2000": [ {name, date, kst, sajuMonth, ...}, ... ] }
  
  for (let year = 2000; year <= 2026; year++) {
    try {
      const items = await fetchYear(year);
      if (items.length === 0) { console.log(`${year}: empty`); continue; }
      
      // 12절기(節)만 추출
      const jeols = items.filter(it => JEOL_SET.has(it.name));
      
      table[year] = jeols.map(j => {
        const ds = j.date;
        const y = parseInt(ds.substring(0,4));
        const m = parseInt(ds.substring(4,6));
        const d = parseInt(ds.substring(6,8));
        let hour = null, minute = null;
        if (j.kst && j.kst.length >= 4) {
          hour = parseInt(j.kst.substring(0,2));
          minute = parseInt(j.kst.substring(2,4));
        }
        return {
          name: j.name,
          year: y, month: m, day: d,
          hour, minute,
          kst: j.kst,
          sunLng: j.sunLng
        };
      });
      
      console.log(`${year}: ${jeols.length}개 절기 수집`);
      await sleep(300);
    } catch(e) {
      console.log(`${year}: ERROR - ${e.message}`);
      await sleep(1000);
    }
  }
  
  // 저장
  const fs = await import('fs');
  const output = JSON.stringify(table, null, 2);
  fs.writeFileSync('kasi-jeolgi-table.json', output);
  
  // 통계
  let total = 0;
  for (const yr of Object.keys(table)) total += table[yr].length;
  console.log(`\n수집 완료: ${Object.keys(table).length}개 연도, ${total}개 절기`);
  console.log('저장: kasi-jeolgi-table.json');
  
  // 미리보기
  console.log('\n=== 미리보기 (2024년) ===');
  if (table['2024']) {
    table['2024'].forEach(j => {
      console.log(`  ${j.name}: ${j.year}.${j.month}.${j.day} ${j.kst||'?'} (황경${j.sunLng})`);
    });
  }
}

main().catch(e => console.error('Fatal:', e));
