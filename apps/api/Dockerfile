# One image for both processes:
#   API:    docker run <image>                      (node dist/server.js)
#   Worker: docker run <image> node dist/worker.js
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npx prisma generate && npm run build && npm prune --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
# Days ("today", dates of services) follow the owners' time zone, not UTC.
ENV TZ=Africa/Tunis
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts /app/package.json ./
# Part photos are written here at run time (mount a volume or use a CDN in production).
RUN mkdir -p /app/models && chown node:node /app/models
USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]
