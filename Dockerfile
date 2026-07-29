# syntax=docker/dockerfile:1
FROM node:26.5.0-alpine3.23 AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:26.5.0-alpine3.23 AS runtime
ENV NODE_ENV=production
WORKDIR /work

COPY --from=build --chown=node:node /app/node_modules /app/node_modules
COPY --from=build --chown=node:node /app/dist /app/dist
COPY --chown=node:node package.json /app/package.json

USER node
ENTRYPOINT ["node", "/app/dist/cli.js"]
CMD ["--help"]
