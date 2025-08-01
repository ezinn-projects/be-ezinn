# API Recruitment (Tuyển Dụng) - Admin Endpoints

## Tổng quan

API này cung cấp các endpoints để admin xem và quản lý đơn ứng tuyển part-time. Phần tạo đơn ứng tuyển sẽ được xử lý trong Next.js App Router.

## Cấu trúc dữ liệu

### Recruitment Schema

```typescript
{
  _id: ObjectId,
  fullName: string,           // Họ tên đầy đủ
  birthDate: Date,            // Ngày sinh (dd/mm/yyyy)
  gender: string,             // "male" | "female" | "other"
  phone: string,              // Số điện thoại (0xxxxxxxxx)
  email: string | null,       // Email (optional)
  socialMedia: string,        // Facebook/Zalo link
  currentStatus: string,      // "student" | "working" | "other"
  otherStatus: string | null, // Thông tin khác (nếu currentStatus = "other")
  position: string[],         // ["cashier", "server", "parking"] - có thể chọn nhiều
  workShifts: string[],       // ["morning", "evening"] - có thể chọn nhiều
  submittedAt: Date,          // Thời gian nộp đơn
  status: string,             // "pending" | "reviewed" | "contacted" | "hired" | "rejected"
  workDays?: string[] | null  // Optional - backward compatibility
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
- `position` (optional): Lọc theo vị trí ứng tuyển
- `gender` (optional): Lọc theo giới tính
- `workShifts` (optional): Lọc theo ca làm việc
- `page` (optional): Trang hiện tại (default: 1)
- `limit` (optional): Số lượng item mỗi trang (default: 10)
- `search` (optional): Tìm kiếm theo tên, số điện thoại, email, vị trí

**Lưu ý:** Kết quả được sắp xếp theo thứ tự mới nhất (submittedAt DESC)

**Response (200):**
```json
{
  "message": "Lấy danh sách đơn ứng tuyển thành công",
        "data": [
        {
          "_id": "...",
          "fullName": "Nguyễn Văn A",
          "birthDate": "2000-01-01T00:00:00.000Z",
          "gender": "male",
          "phone": "0123456789",
          "email": "nguyenvana@email.com",
          "socialMedia": "facebook.com/nguyenvana",
          "currentStatus": "student",
          "otherStatus": null,
          "position": ["server", "cashier"],
          "workShifts": ["morning", "evening"],
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
          "gender": "male",
          "phone": "0123456789",
          "email": "nguyenvana@email.com",
          "socialMedia": "facebook.com/nguyenvana",
          "currentStatus": "student",
          "otherStatus": null,
          "position": ["server", "cashier"],
          "workShifts": ["morning", "evening"],
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

- `pending`: Chờ xem xét
- `reviewed`: Đã xem xét
- `contacted`: Đã liên hệ
- `hired`: Đã tuyển dụng
- `rejected`: Từ chối

## Các trường dữ liệu

### Thông tin cá nhân:
- `fullName`: Họ tên đầy đủ
- `birthDate`: Ngày sinh (dd/mm/yyyy, validate 18-25 tuổi)
- `gender`: Giới tính ("male" | "female" | "other")
- `phone`: Số điện thoại (format: 0xxxxxxxxx)
- `email`: Email (optional)
- `socialMedia`: Facebook/Zalo (required)

### Thông tin ứng tuyển:
- `currentStatus`: Tình trạng hiện tại ("student" | "working" | "other")
- `otherStatus`: Thông tin khác (nếu currentStatus = "other")
- `position`: Vị trí ứng tuyển (array - có thể chọn nhiều)
  - `"cashier"` = Nhân viên lễ tân
  - `"server"` = Nhân viên phục vụ  
  - `"parking"` = Nhân viên giữ xe
- `workShifts`: Ca làm việc (array - có thể chọn nhiều)
  - `"morning"` = Ca sáng (12:00-17:00)
  - `"evening"` = Ca tối (17:00-22:00)

### Quản lý đơn:
- `submittedAt`: Thời gian nộp đơn
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
# Lấy tất cả đơn ứng tuyển (sắp xếp theo mới nhất)
curl -X GET "http://localhost:4000/recruitments/recruitments?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Lọc theo trạng thái
curl -X GET "http://localhost:4000/recruitments/recruitments?status=pending&page=1&limit=10" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Lọc theo vị trí ứng tuyển
curl -X GET "http://localhost:4000/recruitments/recruitments?position=server&page=1&limit=10" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Lọc theo ca làm việc
curl -X GET "http://localhost:4000/recruitments/recruitments?workShifts=morning&page=1&limit=10" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Lọc theo giới tính
curl -X GET "http://localhost:4000/recruitments/recruitments?gender=male&page=1&limit=10" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Kết hợp nhiều filter
curl -X GET "http://localhost:4000/recruitments/recruitments?status=pending&position=server&workShifts=morning&gender=female&page=1&limit=10" \
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