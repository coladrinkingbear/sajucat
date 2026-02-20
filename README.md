# 🐱 고양이 사주 명당

## 서버 설치 (Contabo / Ubuntu)
```bash
git clone https://github.com/YOUR_USERNAME/saju-app.git
cd saju-app
sudo bash setup.sh
```
setup.sh 실행하면 Gemini API 키와 도메인만 입력하면 자동으로 전부 설치됩니다.

## HTTPS (도메인 DNS 연결 후)
```bash
sudo certbot --nginx -d 도메인.com -d www.도메인.com
```

## 관리
```bash
pm2 status / pm2 logs saju-api / pm2 restart saju-api
```
