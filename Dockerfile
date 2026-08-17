# ---- Build stage ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Runtime stage ----
FROM nginx:alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/config.js.template /usr/share/nginx/html/config.js.template
COPY docker/20-generate-config.sh /docker-entrypoint.d/20-generate-config.sh
RUN chmod +x /docker-entrypoint.d/20-generate-config.sh
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
