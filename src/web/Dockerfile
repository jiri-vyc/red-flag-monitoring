# Build context is src/ (the npm workspace root): docker build -f web/Dockerfile --build-arg BACKEND_URL=https://... .
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY web/package.json web/
COPY backend/package.json backend/
RUN npm ci --workspace web

FROM deps AS build
# next.config.ts bakes BACKEND_URL into the /api/* rewrite at build time; a runtime-only value is ignored there.
ARG BACKEND_URL
ARG NEXT_PUBLIC_API_MODE=mock
ENV BACKEND_URL=$BACKEND_URL NEXT_PUBLIC_API_MODE=$NEXT_PUBLIC_API_MODE NEXT_TELEMETRY_DISABLED=1
COPY web web
RUN npm run build -w web && mkdir -p web/public

FROM node:24-alpine AS runtime
WORKDIR /app
ARG BACKEND_URL
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000 BACKEND_URL=$BACKEND_URL
COPY --from=build --chown=node:node /app/web/.next/standalone ./
COPY --from=build --chown=node:node /app/web/.next/static ./web/.next/static
COPY --from=build --chown=node:node /app/web/public ./web/public
USER node
EXPOSE 3000
CMD ["node", "web/server.js"]
