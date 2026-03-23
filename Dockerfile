FROM node:20-alpine

WORKDIR /app

# Install client deps and build
COPY client/package*.json ./client/
RUN cd client && npm install

COPY client/ ./client/
RUN cd client && npm run build

# Install server deps
COPY server/package*.json ./server/
RUN cd server && npm install

COPY server/ ./server/
RUN cd server && npx prisma generate

EXPOSE 5000

CMD ["sh", "-c", "cd server && npx prisma migrate deploy && node src/index.js"]
