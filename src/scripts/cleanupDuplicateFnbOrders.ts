import fnbOrderService from '../services/fnbOrder.service'

/**
 * Script để cleanup các duplicate FNB orders hiện tại
 * Chạy script này một lần để dọn dẹp dữ liệu cũ
 */
async function cleanupDuplicateOrders() {
  try {
    console.log('Starting cleanup of duplicate FNB orders...')

    // Đảm bảo unique index được tạo
    await fnbOrderService.ensureUniqueIndex()

    // Cleanup duplicate orders
    await fnbOrderService.cleanupDuplicateOrders()

    console.log('Cleanup completed successfully!')
    process.exit(0)
  } catch (error) {
    console.error('Error during cleanup:', error)
    process.exit(1)
  }
}

// Chạy script
cleanupDuplicateOrders()
