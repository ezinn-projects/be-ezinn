# Sử dụng Node.js image chính thức dựa trên Debian
FROM node:22

# Không cần cài thêm build-base hay linux-headers vì image này đã có sẵn
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