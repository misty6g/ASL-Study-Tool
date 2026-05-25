FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production || npm install

COPY . .

RUN npm run build

EXPOSE 8080

CMD ["npm", "start"]
