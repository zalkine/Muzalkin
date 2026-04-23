# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Serve stage — nginx on $PORT (Cloud Run default: 8080)
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
# Replace nginx default config so it listens on $PORT and handles SPA routing
RUN printf 'server {\n\
  listen ${PORT:-8080};\n\
  root /usr/share/nginx/html;\n\
  index index.html;\n\
  location / {\n\
    try_files $uri $uri/ /index.html;\n\
  }\n\
}\n' > /etc/nginx/conf.d/default.conf
# nginx doesn't expand env vars in config by default — use envsubst at startup
CMD ["/bin/sh", "-c", "envsubst '${PORT}' < /etc/nginx/conf.d/default.conf > /tmp/nginx.conf && nginx -c /tmp/nginx.conf -g 'daemon off;'"]
