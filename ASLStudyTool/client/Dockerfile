# Build Stage
FROM node:20-alpine as build-stage

WORKDIR /app

COPY package*.json ./

RUN npm ci || npm install

COPY . .

RUN npm run build

# Production Stage
FROM nginx:stable-alpine

COPY --from=build-stage /app/build /usr/share/nginx/html

# Reconfigure Nginx to listen on port 3000 instead of 80 to match docker-compose mapping
RUN sed -i 's/listen       80;/listen       3000;/g' /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
