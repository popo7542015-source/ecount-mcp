# 표준 Node 컨테이너. Render(현재)와 구글 클라우드 런(이전 예정) 양쪽에서 그대로 동작합니다.
FROM node:18-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY . .

ENV NODE_ENV=production
# Render/Cloud Run 모두 PORT 환경변수를 자동으로 주입합니다.
EXPOSE 3000

CMD ["node", "server.js"]
