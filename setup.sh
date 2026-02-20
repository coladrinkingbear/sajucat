#!/bin/bash
set -e
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  고양이 사주 명당 — 서버 자동 설정${NC}"
echo -e "${GREEN}========================================${NC}"

[ "$EUID" -ne 0 ] && echo -e "${RED}sudo bash setup.sh 로 실행하세요${NC}" && exit 1

DIR="$(cd "$(dirname "$0")" && pwd)"

# --- API 키 입력 ---
if [ ! -f "$DIR/backend/.env" ]; then
  echo ""
  echo "Google Gemini API 키가 필요합니다"
  echo "  → https://aistudio.google.com 에서 무료 발급"
  echo ""
  read -p "Gemini API 키: " GEMINI_KEY
  read -p "도메인 (없으면 엔터=IP): " DOMAIN
  [ -z "$DOMAIN" ] && DOMAIN=$(curl -s ifconfig.me) && USEIP=1
  cat > "$DIR/backend/.env" << ENVX
GEMINI_KEY=${GEMINI_KEY}
DOMAIN=${DOMAIN}
PORT=4000
NODE_ENV=production
ENVX
  echo -e "${GREEN}.env 생성${NC}"
else
  DOMAIN=$(grep "^DOMAIN=" "$DIR/backend/.env" | cut -d= -f2)
  [[ "$DOMAIN" =~ ^[0-9]+\. ]] && USEIP=1
  echo "기존 .env 사용 (도메인: $DOMAIN)"
fi

# --- 패키지 설치 ---
echo -e "\n${GREEN}[1/5] 시스템 패키지...${NC}"
apt update -qq && apt install -y -qq nginx git curl ufw
[ -z "$USEIP" ] && apt install -y -qq certbot python3-certbot-nginx
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y -qq nodejs
fi
command -v pm2 &>/dev/null || npm i -g pm2 --silent
echo "  Node $(node -v)"

# --- 방화벽 ---
echo -e "\n${GREEN}[2/5] 방화벽...${NC}"
ufw --force enable && ufw allow OpenSSH && ufw allow 80 && ufw allow 443

# --- npm + 빌드 ---
echo -e "\n${GREEN}[3/5] 백엔드 설치...${NC}"
cd "$DIR/backend" && npm install --production

echo -e "\n${GREEN}[4/5] 프론트엔드 빌드...${NC}"
cd "$DIR/frontend" && npm install && npm run build

# --- Nginx ---
echo -e "\n${GREEN}[5/5] Nginx + PM2...${NC}"
cat > /etc/nginx/sites-available/saju << NGXEOF
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};
    root ${DIR}/frontend/dist;
    index index.html;
    location / { try_files \$uri \$uri/ /index.html; }
    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_read_timeout 60s;
    }
    location ~* \.(js|css|png|svg|woff2)$ { expires 30d; }
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;
}
NGXEOF
ln -sf /etc/nginx/sites-available/saju /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

cd "$DIR/backend"
pm2 delete saju-api 2>/dev/null || true
pm2 start server.js --name saju-api
pm2 save && pm2 startup systemd -u root --hp /root 2>/dev/null || true

echo ""
echo -e "${GREEN}===== 설치 완료! =====${NC}"
echo "  사이트: http://${DOMAIN}"
echo "  헬스체크: http://${DOMAIN}/api/health"
[ -z "$USEIP" ] && echo -e "\n  ${YELLOW}HTTPS:${NC} sudo certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}"
echo ""
