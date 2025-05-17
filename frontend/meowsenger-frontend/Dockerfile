FROM node:23-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm i

COPY . .

RUN npm run build

FROM node:23-alpine AS runner

WORKDIR /app

COPY --from=builder /app/package*.json ./
RUN npm i --only=production

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.js ./next.config.js

ENV NODE_ENV=production

EXPOSE 3000

CMD ["npm", "start","--reload"]