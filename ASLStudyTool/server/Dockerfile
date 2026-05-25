FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production --legacy-peer-deps || npm install --only=production --legacy-peer-deps

COPY . .

RUN npm run build

EXPOSE 8080

CMD ["npm", "start"]
