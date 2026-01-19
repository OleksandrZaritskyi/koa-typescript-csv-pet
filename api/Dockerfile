FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY tsconfig*.json ./
COPY src/ ./src/
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist/ ./dist/
COPY migrate.cjs ./
COPY migrations/ ./migrations/
ENV NODE_ENV=production
CMD ["sh", "-c", "npm run migrate:up && node dist/index.js"]
