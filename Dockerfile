# syntax=docker/dockerfile:1

##### 1) Build del frontend (Vite) #####
FROM node:22-alpine AS client-build
WORKDIR /app/client
COPY client/package.json client/package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY client/ ./
RUN npm run build

##### 2) Instalación de dependencias del backend (incluye compilar better-sqlite3) #####
FROM node:22-alpine AS server-deps
WORKDIR /app/server
# python3/make/g++ solo hacen falta para compilar better-sqlite3 si no hay
# binario precompilado para esta plataforma; no viajan a la imagen final.
RUN apk add --no-cache python3 make g++
COPY server/package.json server/package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

##### 3) Imagen final: solo lo necesario para ejecutar #####
FROM node:22-alpine AS runtime
RUN apk add --no-cache tini
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/data/coctelaria.db

COPY --from=server-deps /app/server/node_modules ./node_modules
COPY server/package.json ./
COPY server/src ./src
COPY --from=client-build /app/client/dist ./public

# Usuario sin privilegios
RUN addgroup -S app && adduser -S app -G app && \
    mkdir -p /data && chown -R app:app /data /app
USER app

VOLUME ["/data"]
EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/index.js"]
