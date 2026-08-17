FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
# O schema e o prisma.config.ts precisam existir antes do `prisma generate`
# (rodado explicitamente abaixo — Prisma 7 não gera o client automaticamente
# via postinstall do npm install).
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm install
RUN npx prisma generate

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
