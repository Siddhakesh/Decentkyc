# Frontend Dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy and install dependencies (separate layer for cache)
COPY package.json ./
RUN npm install

COPY . .

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget -qO- http://localhost:3000 || exit 1

CMD ["npm", "run", "dev"]
