// 회귀 테스트 하네스 — 엔진 출력 스냅샷 (수정 전/후 diff 용)
// 실행: npx esbuild test-baseline.mjs --bundle --format=esm --platform=node --outfile=../.test-bundle.mjs && node ../.test-bundle.mjs <out.json>
import { calculateSaju, applyTrueSolarTime, sajuToString } from './src/saju-core.js';
import { 대운시작나이, 대운생성, 세운분석, 일진계산 } from './src/saju-advanced.js';
import fs from 'fs';

const out = {};

// 1) 만세력: 1940~2026 사이 고정 샘플 (경계 케이스 포함)
const sajuCases = [];
for (let y = 1940; y <= 2026; y += 7) {
  for (const [m, d, h, mi] of [[1, 3, 0, 10], [2, 4, 5, 30], [6, 15, 12, 0], [12, 31, 23, 50]]) {
    sajuCases.push([y, m, d, h, mi]);
  }
}
// 절기 당일 경계 근처
sajuCases.push([2000, 2, 4, 20, 40], [2010, 2, 4, 7, 47], [2024, 2, 4, 17, 27], [1995, 8, 8, 3, 0]);
out.saju = sajuCases.map(c => [c.join('-'), sajuToString(calculateSaju(...c))]);

// 2) 진태양시 보정
out.tst = [[0, 10, 126.978], [23, 50, 129.075], [12, 0, 126.7052], [0, 30, 127.0]].map(
  ([h, mi, lon]) => [`${h}:${mi}@${lon}`, JSON.stringify(applyTrueSolarTime(h, mi, lon))]
);

// 3) 대운수: 연도×월×성별 그리드
out.daewoon = [];
for (const y of [1970, 1985, 1990, 1995, 2000, 2010]) {
  for (const m of [1, 2, 3, 6, 11, 12]) {
    for (const d of [1, 5, 20, 28]) {
      for (const g of ['남', '여']) {
        for (const 연간 of ['甲', '乙']) {
          out.daewoon.push([`${y}-${m}-${d}-${g}-${연간}`, 대운시작나이(y, m, d, g, 연간)]);
        }
      }
    }
  }
}

// 4) 대운 목록 샘플
out.대운생성 = JSON.stringify(대운생성('丙', '寅', '甲', '남', 1990, 12, 20, '庚'));

// 5) 세운
out.세운 = [2025, 2026, 2027].map(y => JSON.stringify(세운분석(y, '甲', '화', '수', { 십성카운트: {} })));

// 6) 일진
out.일진 = [[2026, 1, 1], [2026, 8, 20], [2000, 2, 29]].map(c => [c.join('-'), JSON.stringify(일진계산(...c))]);

const dest = process.argv[2] || 'baseline.json';
fs.writeFileSync(dest, JSON.stringify(out, null, 1));
console.log('written:', dest, '| saju cases:', out.saju.length, '| daewoon cases:', out.daewoon.length);
