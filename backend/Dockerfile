# Stage 1: Build the NestJS application
FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
RUN apt-get update -y && apt-get install -y openssl
COPY . .
RUN npx prisma generate
RUN npm run build

# Stage 2: Run the production server
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV production
RUN apt-get update -y && apt-get install -y openssl
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma

EXPOSE 5000
CMD ["node", "dist/main.js"]
