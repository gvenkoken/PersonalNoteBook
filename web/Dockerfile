# Web image: builds the React client and serves it with nginx, which also proxies /api and /health to the API service.
# Build context is the repository root (npm workspaces: the lock file lives there): docker build -f web/Dockerfile .
FROM node:22-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
COPY web/package.json web/
RUN npm ci
COPY web/ web/
RUN npm run build --workspace web

FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/web/dist /usr/share/nginx/html
EXPOSE 8080
