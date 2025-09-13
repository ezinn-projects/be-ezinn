# Tính năng thông báo đơn hàng mới đến Admin

## Tổng quan
Khi client lưu đơn hàng F&B vào phòng, hệ thống sẽ tự động gửi thông báo real-time đến admin với thông tin chi tiết về đơn hàng để nhân viên có thể chuẩn bị ngay lập tức.

## Cách hoạt động

### 1. Khi client lưu đơn hàng
- Client gọi API `POST /client/fnb/orders/room/:roomId` với thông tin đơn hàng
- Hệ thống sẽ:
  - Tìm phòng và lịch trình hoạt động
  - Lưu/cập nhật đơn hàng vào phòng
  - **Gửi thông báo đến admin**

### 2. Thông báo được gửi đến admin
- Thông báo được gửi qua Socket.IO đến room 'admin'
- Event name: `new_order_notification`
- Chỉ admin (có `isAdmin=true` trong query params) mới nhận được thông báo

## Cấu trúc dữ liệu thông báo

```typescript
interface NewOrderNotification {
  type: 'new_order'
  roomId: string
  message: string
  timestamp: number
  orderData: {
    roomId: string
    orderId: string
    items: Array<{
      itemId: string
      name: string
      quantity: number
      price: number
    }>
    totalAmount: number
    customerInfo: {
      roomName: string
      roomScheduleId: string
    }
    createdAt: string
  }
}
```

## Cách sử dụng trên Frontend

### 1. Kết nối Socket với quyền admin
```javascript
const socket = io('ws://localhost:3000', {
  query: {
    isAdmin: 'true'  // Quan trọng: phải có isAdmin=true
  }
})
```

### 2. Lắng nghe thông báo đơn hàng mới
```javascript
socket.on('new_order_notification', (notification) => {
  console.log('Đơn hàng mới:', notification)
  
  // Hiển thị thông báo cho admin
  showOrderNotification(notification)
  
  // Có thể redirect đến trang quản lý đơn hàng
  // hoặc hiển thị popup với thông tin chi tiết
})
```

### 3. Ví dụ hiển thị thông báo
```javascript
function showOrderNotification(notification) {
  const { orderData } = notification
  
  // Tạo thông báo popup
  const notificationElement = document.createElement('div')
  notificationElement.className = 'order-notification'
  notificationElement.innerHTML = `
    <h3>🍽️ Đơn hàng mới từ ${orderData.customerInfo.roomName}</h3>
    <p><strong>Mã đơn hàng:</strong> ${orderData.orderId}</p>
    <p><strong>Tổng tiền:</strong> ${orderData.totalAmount.toLocaleString()} VNĐ</p>
    <div class="order-items">
      <h4>Chi tiết món:</h4>
      ${orderData.items.map(item => 
        `<p>• ${item.name} x${item.quantity} - ${(item.price * item.quantity).toLocaleString()} VNĐ</p>`
      ).join('')}
    </div>
    <p><strong>Thời gian:</strong> ${new Date(orderData.createdAt).toLocaleString()}</p>
    <button onclick="handleOrderNotification('${orderData.orderId}')">
      Xem chi tiết
    </button>
  `
  
  document.body.appendChild(notificationElement)
  
  // Tự động ẩn sau 10 giây
  setTimeout(() => {
    notificationElement.remove()
  }, 10000)
}
```

## API Endpoints liên quan

### Save Client FNB Order
```
POST /client/fnb/orders/room/:roomId
Content-Type: application/json

{
  "order": {
    "drinks": {
      "itemId1": quantity1,
      "itemId2": quantity2
    },
    "snacks": {
      "itemId3": quantity3,
      "itemId4": quantity4
    }
  }
}
```

**Ví dụ:**
```json
{
  "order": {
    "drinks": {
      "64f1a2b3c4d5e6f7a8b9c0d1": 2,
      "64f1a2b3c4d5e6f7a8b9c0d2": 1
    },
    "snacks": {
      "64f1a2b3c4d5e6f7a8b9c0d3": 3
    }
  }
}
```

## Socket Events

### Admin nhận được
- `new_order_notification`: Thông báo đơn hàng mới
- `notification`: Thông báo hỗ trợ thông thường

### Client có thể gửi
- `send_notification`: Gửi yêu cầu hỗ trợ đến admin

## Lưu ý quan trọng

1. **Chỉ admin mới nhận được thông báo**: Phải có `isAdmin=true` trong query params khi kết nối socket
2. **Thông báo được lưu trong Redis**: Có thể truy xuất lại nếu cần
3. **Không ảnh hưởng đến flow đặt hàng**: Nếu gửi thông báo lỗi, đơn hàng vẫn được tạo thành công
4. **Real-time**: Thông báo được gửi ngay lập tức khi đơn hàng được hoàn thành

## Troubleshooting

### Admin không nhận được thông báo
1. Kiểm tra `isAdmin=true` trong query params
2. Kiểm tra console log để xem có lỗi gửi thông báo không
3. Kiểm tra kết nối socket có thành công không

### Thông báo không hiển thị đúng
1. Kiểm tra cấu trúc dữ liệu trong `orderData`
2. Kiểm tra frontend có lắng nghe đúng event `new_order_notification` không
