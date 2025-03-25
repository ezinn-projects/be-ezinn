# Sử dụng Node.js image chính thức
FROM node:22-alpine

# Cài đặt Python và các dependencies cần thiết, bao gồm build-base
RUN apk add --no-cache python3 py3-pip bash build-base

# Kiểm tra symbolic link trước khi tạo
RUN [ -e /usr/bin/python ] || ln -s /usr/bin/python3 /usr/bin/python

# Thiết lập thư mục làm việc trong container
WORKDIR /usr/src/app

# Sao chép package.json và package-lock.json
COPY package*.json ./

# Cài đặt dependencies bao gồm cả devDependencies
RUN npm install

# Sao chép toàn bộ mã nguồn vào container
COPY . .

# Build ứng dụng TypeScript
RUN npm run build

# Mở cổng ứng dụng
EXPOSE 4000

# Khởi động ứng dụng
CMD ["npm", "start"]