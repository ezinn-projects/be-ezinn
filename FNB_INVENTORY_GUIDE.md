# FNB Inventory Validation Guide

## Tổng quan

Hệ thống FNB đã được cải thiện với tính năng validation inventory thông minh và cập nhật inventory real-time khi user thêm/bớt items trong order.

## Các tính năng mới

### 1. Inventory Validation khi Add Item

**Logic mới:**
- Kiểm tra inventory hiện có
- Chỉ cho phép add item nếu: `available_quantity >= quantity`
- **Trừ inventory ngay lập tức** khi add item thành công

**Ví dụ:**
- Inventory có 5 items
- User thêm 3 items → Inventory còn 2 items
- User thêm 2 items nữa → Inventory còn 0 items
- User thêm 1 item nữa → **Từ chối** vì inventory = 0

### 2. Inventory Restoration khi Remove Item

**Logic mới:**
- **Hoàn trả inventory ngay lập tức** khi remove item
- Inventory được cộng lại số lượng đã remove

**Ví dụ:**
- Inventory = 0 items
- User remove 2 items → Inventory = 2 items
- User có thể thêm items mới

## API Endpoints

### 1. Add Item to Order (Đã cải thiện)

**Endpoint:** `POST /fnb-orders/:roomScheduleId/add-item`

**Chức năng:**
- Validate inventory có đủ không
- Trừ inventory ngay lập tức khi add thành công
- Trả về lỗi nếu vượt quá inventory

**Request:**
```json
{
  "itemId": "64f8a1b2c3d4e5f6a7b8c9d0",
  "quantity": 2,
  "category": "drinks",
  "createdBy": "user123"
}
```

**Response khi thành công:**
```json
{
  "message": "Item added to order successfully",
  "result": {
    "order": {
      "drinks": {
        "64f8a1b2c3d4e5f6a7b8c9d0": 2
      },
      "snacks": {}
    }
  }
}
```

**Response khi thiếu inventory:**
```json
{
  "message": "Insufficient inventory for this item"
}
```

### 2. Remove Item from Order (Đã cải thiện)

**Endpoint:** `POST /fnb-orders/:roomScheduleId/remove-item`

**Chức năng:**
- Hoàn trả inventory ngay lập tức khi remove thành công
- Cập nhật order

**Request:**
```json
{
  "itemId": "64f8a1b2c3d4e5f6a7b8c9d0",
  "quantity": 1,
  "category": "drinks",
  "createdBy": "user123"
}
```

**Response:**
```json
{
  "message": "Item removed from order successfully",
  "result": {
    "order": {
      "drinks": {
        "64f8a1b2c3d4e5f6a7b8c9d0": 1
      },
      "snacks": {}
    }
  }
}
```

## Workflow sử dụng

### Frontend Integration

```typescript
// 1. Thêm items vào order (validate + trừ inventory)
const addItemToOrder = async (roomScheduleId: string, itemId: string, quantity: number, category: 'drinks' | 'snacks') => {
  try {
    const response = await fetch(`/api/fnb-orders/${roomScheduleId}/add-item`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        itemId,
        quantity,
        category,
        createdBy: currentUser.id
      })
    });

    if (!response.ok) {
      const error = await response.json();
      if (error.message === 'Insufficient inventory for this item') {
        // Hiển thị thông báo lỗi cho user
        showError('Không đủ hàng trong kho');
        return;
      }
      throw new Error('Failed to add item');
    }

    const result = await response.json();
    // Inventory đã được trừ tự động
    showSuccess('Đã thêm vào giỏ hàng');
    return result;
  } catch (error) {
    console.error('Error adding item:', error);
    throw error;
  }
};

// 2. Remove items từ order (hoàn trả inventory)
const removeItemFromOrder = async (roomScheduleId: string, itemId: string, quantity: number, category: 'drinks' | 'snacks') => {
  try {
    const response = await fetch(`/api/fnb-orders/${roomScheduleId}/remove-item`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        itemId,
        quantity,
        category,
        createdBy: currentUser.id
      })
    });

    if (!response.ok) {
      throw new Error('Failed to remove item');
    }

    const result = await response.json();
    // Inventory đã được hoàn trả tự động
    showSuccess('Đã xóa khỏi giỏ hàng');
    return result;
  } catch (error) {
    console.error('Error removing item:', error);
    throw error;
  }
};
```

### React Native Example

```typescript
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';

const FnbOrderScreen = ({ roomScheduleId }) => {
  const [order, setOrder] = useState({ drinks: {}, snacks: {} });
  const [isLoading, setIsLoading] = useState(false);

  const addItem = async (itemId: string, quantity: number, category: 'drinks' | 'snacks') => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/fnb-orders/${roomScheduleId}/add-item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId,
          quantity,
          category,
          createdBy: 'user123'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        if (error.message === 'Insufficient inventory for this item') {
          Alert.alert('Lỗi', 'Không đủ hàng trong kho');
          return;
        }
        throw new Error('Failed to add item');
      }

      const result = await response.json();
      setOrder(result.result.order);
      Alert.alert('Thành công', 'Đã thêm vào giỏ hàng');
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể thêm item');
    } finally {
      setIsLoading(false);
    }
  };

  const removeItem = async (itemId: string, quantity: number, category: 'drinks' | 'snacks') => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/fnb-orders/${roomScheduleId}/remove-item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId,
          quantity,
          category,
          createdBy: 'user123'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to remove item');
      }

      const result = await response.json();
      setOrder(result.result.order);
      Alert.alert('Thành công', 'Đã xóa khỏi giỏ hàng');
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể xóa item');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View>
      {/* UI để thêm items */}
      <TouchableOpacity 
        onPress={() => addItem('item123', 1, 'drinks')}
        disabled={isLoading}
      >
        <Text>Thêm Coca Cola</Text>
      </TouchableOpacity>

      {/* UI để remove items */}
      <TouchableOpacity 
        onPress={() => removeItem('item123', 1, 'drinks')}
        disabled={isLoading}
      >
        <Text>Xóa Coca Cola</Text>
      </TouchableOpacity>
    </View>
  );
};
```

## Lợi ích của cách tiếp cận mới

### 1. **Real-time Inventory Management**
- Inventory được cập nhật ngay lập tức khi user thao tác
- Không cần confirm order để trừ inventory
- Inventory luôn chính xác và real-time

### 2. **User Experience**
- User thấy ngay kết quả của thao tác
- Không cần bước confirm phức tạp
- Có thể thêm/bớt items tự do trong giới hạn inventory

### 3. **Data Integrity**
- Đảm bảo không bao giờ order vượt quá inventory
- Inventory được đồng bộ với order real-time
- Rollback tự động khi có lỗi

### 4. **Business Logic**
- Đơn giản và trực quan
- Phù hợp với workflow thực tế của user
- Dễ implement và maintain

## Migration từ cách cũ

Nếu bạn đang sử dụng cách cũ:

1. **Backward Compatibility**: API cũ vẫn hoạt động
2. **Automatic Migration**: Logic mới tự động áp dụng
3. **No Breaking Changes**: Không cần thay đổi frontend logic

## Testing

Sử dụng test script `test-fnb-orders.js` để kiểm tra:

```bash
node test-fnb-orders.js
```

Test script sẽ kiểm tra:
- Validation inventory khi add item
- Trừ inventory khi add item thành công
- Hoàn trả inventory khi remove item
- Error handling cho insufficient inventory

## Lưu ý quan trọng

1. **Inventory được trừ ngay khi add item**
2. **Inventory được hoàn trả ngay khi remove item**
3. **Validation đơn giản: available_quantity >= quantity**
4. **Hỗ trợ cả menu items và variants**
5. **Error handling chi tiết cho từng trường hợp**
6. **History tracking được giữ nguyên**

## Troubleshooting

### Lỗi "Insufficient inventory"
- Kiểm tra inventory của item trong database
- Đảm bảo itemId đúng (có thể là variant ID)
- Kiểm tra xem có item nào khác đã "lock" inventory không

### Lỗi khi add/remove item
- Kiểm tra order có tồn tại không
- Kiểm tra quyền truy cập database
- Kiểm tra format của request body

### Inventory không đồng bộ
- Kiểm tra logs để xem có lỗi khi update inventory không
- Kiểm tra xem có concurrent requests không
- Verify database transactions 