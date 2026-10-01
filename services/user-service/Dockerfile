# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci
RUN npx prisma generate

COPY . .
RUN npm run build

# Stage 2: Runtime
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --only=production
RUN npx prisma generate

COPY --from=builder /app/dist ./dist

EXPOSE 3002

CMD ["sh", "-c", "npx prisma db push && node dist/main"]
