# ===== BUILD STAGE =====
FROM node:18 AS builder

WORKDIR /app

# Install deps
COPY package*.json ./
RUN npm install

# Copy project
COPY . .

# Build (Vite + TS)
RUN npm run ci

# ===== PRODUCTION STAGE =====
FROM nginx:alpine

# Copy hasil build Vite
COPY --from=builder /app/dist /usr/share/nginx/html

# Fix routing React
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]