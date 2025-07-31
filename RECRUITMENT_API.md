# API Recruitment (Tuyển Dụng) - Admin Endpoints

## Tổng quan

API này cung cấp các endpoints để admin xem và quản lý đơn ứng tuyển part-time. Phần tạo đơn ứng tuyển sẽ được xử lý trong Next.js App Router.

## Cấu trúc dữ liệu

### Recruitment Schema

```typescript
{
  _id: ObjectId,
  fullName: string,           // Họ tên đầy đủ
  birthDate: Date,            // Ngày sinh
  gender: string,             // Giới tính
  phone: string,              // Số điện thoại
  email: string,              // Email
  socialMedia: string,        // Facebook/Zalo
  currentStatus: string,      // Trạng thái hiện tại
  otherStatus: string,        // Thông tin khác
  workDays: string[],         // Ngày có thể làm việc
  position: string,           // Vị trí ứng tuyển
  submittedAt: Date,          // Ngày nộp đơn
  status: string              // 'pending' | 'reviewed' | 'approved' | 'rejected' | 'hired'
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
- `search` (optional): Tìm kiếm theo tên, số điện thoại, email, vị trí

**Response (200):**
```json
{
  "message": "Lấy danh sách đơn ứng tuyển thành công",
        "data": [
        {
          "_id": "...",
          "fullName": "Nguyễn Văn A",
          "birthDate": "2000-01-01T00:00:00.000Z",
          "gender": "Nam",
          "phone": "0123456789",
          "email": "nguyenvana@email.com",
          "socialMedia": "facebook.com/nguyenvana",
          "currentStatus": "Sinh viên",
          "otherStatus": "",
          "workDays": ["Thứ 2", "Thứ 3", "Thứ 4"],
          "position": "Nhân viên phục vụ",
          "submittedAt": "2024-01-01T00:00:00.000Z",
          "status": "pending"
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
          "birthDate": "2000-01-01T00:00:00.000Z",
          "gender": "Nam",
          "phone": "0123456789",
          "email": "nguyenvana@email.com",
          "socialMedia": "facebook.com/nguyenvana",
          "currentStatus": "Sinh viên",
          "otherStatus": "",
          "workDays": ["Thứ 2", "Thứ 3", "Thứ 4"],
          "position": "Nhân viên phục vụ",
          "submittedAt": "2024-01-01T00:00:00.000Z",
          "status": "pending"
        }
}
```

### 3. Cập nhật trạng thái đơn ứng tuyển

**PUT** `/recruitments/recruitments/:id/status`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "status": "approved"
}
```

**Response (200):**
```json
{
  "message": "Cập nhật trạng thái đơn ứng tuyển thành công",
  "data": {
    "_id": "...",
    "fullName": "Nguyễn Văn A",
    "birthDate": "2000-01-01T00:00:00.000Z",
    "gender": "Nam",
    "phone": "0123456789",
    "email": "nguyenvana@email.com",
    "socialMedia": "facebook.com/nguyenvana",
    "currentStatus": "Sinh viên",
    "otherStatus": "",
    "workDays": ["Thứ 2", "Thứ 3", "Thứ 4"],
    "position": "Nhân viên phục vụ",
    "submittedAt": "2024-01-01T00:00:00.000Z",
    "status": "approved"
  }
}
```

### 4. Thống kê đơn ứng tuyển

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

## Các trường dữ liệu

- `fullName`: Họ tên đầy đủ
- `birthDate`: Ngày sinh (Date)
- `gender`: Giới tính (Nam/Nữ)
- `phone`: Số điện thoại
- `email`: Email
- `socialMedia`: Facebook/Zalo
- `currentStatus`: Trạng thái hiện tại (Sinh viên/Đi làm/Khác)
- `otherStatus`: Thông tin bổ sung nếu chọn "Khác"
- `workDays`: Mảng các ngày có thể làm việc
- `position`: Vị trí ứng tuyển
- `submittedAt`: Ngày nộp đơn
- `status`: Trạng thái đơn ứng tuyển

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

### Cập nhật trạng thái đơn ứng tuyển:
```bash
curl -X PUT "http://localhost:4000/recruitments/recruitments/507f1f77bcf86cd799439011/status" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "approved"}'
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