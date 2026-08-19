#!/bin/bash
# ── sajucat 배포 스크립트 (로컬 Windows Git Bash에서 실행) ──
# 사용법: bash deploy.sh "커밋 메시지"   (메시지 생략 시 타임스탬프)
# 동작: 로컬 커밋 → 깃허브 푸시 → VPS가 pull → 빌드 → 서비스 재시작
set -e
cd "$(dirname "$0")"
MSG=${1:-"deploy: $(date +%Y%m%d-%H%M)"}

# 토큰은 .env에서만 읽음 (깃에 안 올라감)
source ./.env
[ -z "$GITHUB_TOKEN" ] && echo ".env에 GITHUB_TOKEN이 없습니다" && exit 1

git add -A
git diff --cached --quiet || git commit -m "$MSG"
git push "https://coladrinkingbear:${GITHUB_TOKEN}@github.com/coladrinkingbear/sajucat.git" master

ssh jupvps bash -s << 'REMOTE'
set -e
cd /var/www/sajucat
git pull origin master
cd backend && npm install --omit=dev --silent
cd ../frontend && npm install --silent && npm run build
systemctl restart saju-api
nginx -t 2>/dev/null && systemctl reload nginx
sleep 1
echo "── 헬스체크 ──"
curl -s http://127.0.0.1:4000/api/health && echo
echo "── 배포 완료 ──"
REMOTE
