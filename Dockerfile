# Default target: dev (Astro dev server).
# Production: docker build --target production .

# --- Production build stage ---
FROM node:lts AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install
COPY . .

RUN npm run build

# --- Production serve stage ---
FROM nginx:alpine AS production
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx/nginx.conf /etc/nginx/nginx.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]

# --- Dev stage (default): run Astro dev server ---
FROM node:lts AS dev
WORKDIR /app

COPY package*.json ./
RUN npm install
COPY . .

ENV HOST=0.0.0.0
ENV PORT=8080
EXPOSE 8080

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "8080"]
