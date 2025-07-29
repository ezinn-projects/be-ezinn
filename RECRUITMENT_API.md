# API Recruitment (Tuyển Dụng) - Admin Endpoints

## Tổng quan

API này cung cấp các endpoints để admin xem và quản lý đơn ứng tuyển part-time. Phần tạo đơn ứng tuyển sẽ được xử lý trong Next.js App Router.

## Cấu trúc dữ liệu

### Recruitment Schema

```typescript
{
  _id: ObjectId,
  fullName: string,           // Họ tên đầy đủ
  birthYear: number,          // Năm sinh (để tính tuổi 18-25)
  phoneNumber: string,        // Số điện thoại (10-11 số)
  socialMedia: string,        // Facebook/Zalo
  currentStatus: string,      // 'student' | 'working' | 'other'
  currentStatusOther?: string, // Thông tin bổ sung nếu chọn 'other'
  area: string,               // Khu vực (Phường/xã + Quận/huyện)
  availableWorkTimes: string[], // ['morning', 'afternoon', 'evening', 'weekend']
  status: string,             // 'pending' | 'reviewed' | 'approved' | 'rejected' | 'hired'
  notes?: string,             // Ghi chú của admin
  createdAt: Date,
  updatedAt?: Date
}
```

## API Endpoints (Admin Only)

### 1. Lấy danh sách đơn ứng tuyển

**GET** `/recruitments/recruitments`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `status` (optional): Lọc theo trạng thái
- `page` (optional): Trang hiện tại (default: 1)
- `limit` (optional): Số lượng item mỗi trang (default: 10)
- `search` (optional): Tìm kiếm theo tên, số điện thoại, khu vực

**Response (200):**
```json
{
  "message": "Lấy danh sách đơn ứng tuyển thành công",
  "data": [
    {
      "_id": "...",
      "fullName": "Nguyễn Văn A",
      "birthYear": 2000,
      "phoneNumber": "0123456789",
      "socialMedia": "facebook.com/nguyenvana",
      "currentStatus": "student",
      "area": "Phường 1, Quận 1, TP.HCM",
      "availableWorkTimes": ["evening", "weekend"],
      "status": "pending",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3
  }
}
```

### 2. Lấy chi tiết đơn ứng tuyển

**GET** `/recruitments/recruitments/:id`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "message": "Lấy chi tiết đơn ứng tuyển thành công",
  "data": {
    "_id": "...",
    "fullName": "Nguyễn Văn A",
    "birthYear": 2000,
    "phoneNumber": "0123456789",
    "socialMedia": "facebook.com/nguyenvana",
    "currentStatus": "student",
    "area": "Phường 1, Quận 1, TP.HCM",
    "availableWorkTimes": ["evening", "weekend"],
    "status": "pending",
    "notes": "",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### 3. Thống kê đơn ứng tuyển

**GET** `/recruitments/stats`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "message": "Lấy thống kê đơn ứng tuyển thành công",
  "data": {
    "total": 25,
    "pending": 10,
    "reviewed": 5,
    "approved": 7,
    "rejected": 2,
    "hired": 1
  }
}
```

## Trạng thái đơn ứng tuyển

- `pending`: Chờ xử lý
- `reviewed`: Đã xem xét
- `approved`: Đã duyệt
- `rejected`: Từ chối
- `hired`: Đã tuyển dụng

## Khung giờ làm việc

- `morning`: 10h-14h
- `afternoon`: 14h-18h
- `evening`: 18h-24h
- `weekend`: Thứ 7 - Chủ nhật

## Error Responses

### 401 Unauthorized
```json
{
  "message": "Access token không được để trống"
}
```

### 403 Forbidden
```json
{
  "message": "Không đủ quyền truy cập"
}
```

### 404 Not Found
```json
{
  "message": "Không tìm thấy đơn ứng tuyển"
}
```

### 500 Internal Server Error
```json
{
  "message": "Có lỗi xảy ra khi lấy danh sách đơn ứng tuyển"
}
```

## Ví dụ sử dụng

### Lấy danh sách đơn ứng tuyển:
```bash
curl -X GET "http://localhost:4000/recruitments/recruitments?page=1&limit=10&status=pending" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Lấy chi tiết đơn ứng tuyển:
```bash
curl -X GET "http://localhost:4000/recruitments/recruitments/507f1f77bcf86cd799439011" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Lấy thống kê:
```bash
curl -X GET "http://localhost:4000/recruitments/stats" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Lưu ý

- Tất cả endpoints đều yêu cầu xác thực với quyền Admin hoặc Staff
- Phần tạo đơn ứng tuyển sẽ được xử lý trong Next.js App Router
- API này chỉ dành cho admin để xem và quản lý đơn ứng tuyển 