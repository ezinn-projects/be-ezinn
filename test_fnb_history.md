# Test FNB Order History Flow

## Cách hoạt động (ĐƠN GIẢN):

1. **Client tạo/update order** → Lưu vào collection `fnb_orders`
2. **Khi get bill** → Tự động lưu order vào `fnb_order_history` (nếu chưa có)
3. **Khi get bill** → Lấy order từ `fnb_order_history` thay vì `fnb_orders`

## Test Flow:

### 1. Tạo order
```bash
POST /fnb-orders/upsert
{
  "roomScheduleId": "room_schedule_id_here",
  "order": {
    "drinks": {
      "drink_id_1": 2,
      "drink_id_2": 1
    },
    "snacks": {
      "snack_id_1": 3
    }
  },
  "createdBy": "test_user"
}
```

### 2. Get bill (tự động lưu vào history và lấy từ history)
```bash
GET /bills/room_schedule_id_here
```

## Lợi ích:

- **Siêu đơn giản**: Chỉ cần 1 API get bill
- **Tự động**: Không cần thao tác thủ công
- **Rõ ràng**: Order hiện tại trong `fnb_orders`, order đã complete trong `fnb_order_history`
- **Mapping dễ dàng**: Cùng `roomScheduleId` để mapping

## Database Collections:

1. **`fnb_orders`**: Order hiện tại đang được edit
2. **`fnb_order_history`**: Order đã complete với thông tin:
   - `roomScheduleId`: Mapping với room schedule
   - `order`: Data order
   - `completedAt`: Thời gian complete
   - `completedBy`: Người complete
   - `billId`: ID của bill (optional)

## Logic trong BillService:

```typescript
// 1. Lấy order từ history
const orderHistory = await fnbOrderService.getOrderHistoryByRoomSchedule(scheduleId)
const order = orderHistory.length > 0 ? orderHistory[orderHistory.length - 1] : null

// 2. Tự động lưu vào history nếu chưa có
if (order && order.order) {
  const existingHistory = await fnbOrderService.getOrderHistoryByRoomSchedule(scheduleId)
  const orderExistsInHistory = existingHistory.some(historyOrder => 
    JSON.stringify(historyOrder.order) === JSON.stringify(order.order)
  )
  
  if (!orderExistsInHistory) {
    await fnbOrderService.saveOrderHistory(scheduleId, order.order, 'system', bill.invoiceCode)
  }
}
``` 