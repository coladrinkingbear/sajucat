# 🐱 고양이 사주 명당 — sajucat.co.kr

고양이 캐릭터와 대화하며 사주를 보는 웹 서비스. 자체 만세력 엔진(KASI 절기 기반)으로 사주를 계산하고, xAI Grok으로 "바리만신" AI 상담·인연찾기 채팅을 제공한다.

**작동 로직 상세 문서: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**

## 구조

| 구성 | 내용 |
|---|---|
| frontend/ | React 18 + Vite SPA (App.jsx 단일 파일 + 사주 엔진 5개 모듈) |
| backend/ | Express + better-sqlite3 (포트 4000) — 인증·저장·공유·AI 프록시 |
| AI | xAI Grok (`XAI_KEY`, 기본 모델 grok-4.20-0309-non-reasoning) |
| 배포 | VPS nginx(80/443) + systemd `saju-api` + `/var/www/sajucat` |

## 배포 (로컬에서)

```bash
bash deploy.sh "커밋 메시지"
```

커밋 → 깃허브 푸시 → VPS pull → 빌드 → 재시작까지 자동. 푸시 토큰은 레포 루트 `.env`의 `GITHUB_TOKEN`에서 읽는다 (깃에 안 올라감).

## 서버 운영 (ssh jupvps)

```bash
systemctl status saju-api          # 백엔드 상태
journalctl -u saju-api -f          # 실시간 로그
systemctl restart saju-api         # 재시작
nginx -t && systemctl reload nginx # nginx 설정 반영
```

- 코드: `/var/www/sajucat` · DB: `/var/www/sajucat/backend/sajucat.db` (**깃 제외 — 개인정보**)
- env: `/var/www/sajucat/backend/.env` (`XAI_KEY`, `PORT`, `BASE_URL`)
- HTTPS: Let's Encrypt (certbot 자동갱신), 도메인은 Cloudflare 프록시 경유

## 로컬 개발

```bash
cd backend && npm install && node server.js     # API :4000
cd frontend && npm install && npm run dev        # Vite :5173 (/api,/auth 프록시)
```

## 주의

- `backend/sajucat.db`는 실사용자 개인정보 — 절대 깃에 커밋 금지 (.gitignore 처리됨)
- 소셜 로그인(구글/카카오/네이버)은 OAuth env 미설정 시 자동 비활성 (버튼은 /로 리다이렉트)
- 첫 서버 셋업 절차는 setup.sh 참고 (레거시 — 현 서버는 systemd 방식으로 구성됨)
