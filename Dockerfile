# Sử dụng Node.js base image
FROM node:18

# Tạo thư mục làm việc trong container
WORKDIR /app

# Sao chép package.json và cài đặt dependencies
COPY package*.json ./
RUN npm install

# Sao chép toàn bộ mã nguồn
COPY . .

# Expose cổng cho Node.js và Socket.io
EXPOSE 5000

# Lệnh chạy ứng dụng
CMD ["npm", "start"]
