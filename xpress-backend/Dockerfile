FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm install
COPY . .

RUN npm run build


FROM node:22-alpine AS runner

WORKDIR /app

COPY package*.json ./

RUN npm install --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

EXPOSE 8080

CMD ["node", "dist/src/main.js"]