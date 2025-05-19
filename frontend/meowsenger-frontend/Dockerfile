FROM node:23-alpine AS builder

WORKDIR /app

# Copy package files and npmrc first
COPY package*.json .npmrc ./

# Install dependencies with legacy peer deps
RUN npm i --legacy-peer-deps

# Copy the rest of the code
COPY . .

# Build with legacy peer deps
RUN npm run build

FROM node:23-alpine AS runner

WORKDIR /app

# Copy package files and npmrc
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.npmrc ./

# Install only production dependencies
RUN npm i --only=production --legacy-peer-deps

# Copy build output and static files
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.js ./next.config.js

ENV NODE_ENV=production

EXPOSE 3000

CMD ["npm", "start","--reload"]