import dayjs from 'dayjs'
import * as escpos from 'escpos'
import iconv from 'iconv-lite'
import { ObjectId } from 'mongodb'
import { DayType, RoomScheduleStatus } from '~/constants/enum'
import { HTTP_STATUS_CODE } from '~/constants/httpStatus'
import { ErrorWithStatus } from '~/models/Error'
import { IBill } from '~/models/schemas/Bill.schema'
import databaseService from './database.service'
import promotionService from './promotion.service'
import { holidayService } from './holiday.service'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

// Cấu hình timezone cho dayjs
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.tz.setDefault('Asia/Ho_Chi_Minh')

// Ensure all date objects are using the correct timezone
function ensureVNTimezone(date: Date | string | null | undefined): Date {
  if (!date) {
    // Return current date as fallback if date is null or undefined
    return dayjs().tz('Asia/Ho_Chi_Minh').toDate()
  }
  return dayjs(date).tz('Asia/Ho_Chi_Minh').toDate()
}

// Khai báo biến toàn cục để lưu USB adapter
let usbAdapter: any = null

// Extend the escpos Printer type to include custom methods
declare module 'escpos' {
  interface Printer {
    tableCustom(data: Array<{ text: string; width: number; align: string }>): Printer
    feed(n: number): Printer
    style(type: 'b' | 'i' | 'u' | 'normal'): Printer
  }
}

// Fix USB.findPrinter overloads
declare module 'escpos-usb' {
  function findPrinter(deviceId?: any): any[]
  function findPrinter(deviceId: any, callback: (err: any, device: any) => void): void
}

function encodeVietnameseText(text: string, encoding = 'windows-1258') {
  return iconv.encode(text, encoding)
}

// Hàm format ngày tháng
function formatDate(date: Date): string {
  return dayjs(ensureVNTimezone(date)).format('DD/MM/YYYY HH:mm')
}

const dynamicText = 'Xin chào, đây là hóa đơn của bạn!'
const encodedText = encodeVietnameseText(dynamicText)

export class BillService {
  private deviceData: any // Lưu thông tin thiết bị USB được tìm thấy
  private transactionHistory: Array<IBill> = [] // Lưu lịch sử giao dịch
  private printer: any

  constructor() {
    this.initEscPos()
  }

  private async initEscPos() {
    try {
      // Lazy load escpos-usb để tránh lỗi khi khởi tạo
      usbAdapter = require('escpos-usb')

      // Tìm kiếm các thiết bị máy in
      const devices = usbAdapter.findPrinter()
      if (devices && devices.length > 0) {
        this.deviceData = devices[0]
        console.log('Tìm thấy máy in:', this.deviceData)
      } else {
        console.log('Không tìm thấy máy in USB nào')
      }
    } catch (error) {
      console.error('Không thể khởi tạo escpos:', error)
    }
  }

  private async determineDayType(date: Date): Promise<DayType> {
    // Convert to Vietnam timezone before checking type
    const vnDate = ensureVNTimezone(date)

    // Check if it's a holiday first
    const isHoliday = await holidayService.isHoliday(vnDate)
    if (isHoliday) {
      return DayType.Holiday
    }

    // If not a holiday, check if it's weekend
    const day = vnDate.getDay()
    if (day === 0 || day === 6) {
      return DayType.Weekend
    } else {
      return DayType.Weekday
    }
  }

  /**
   * Calculate hours between two dates
   * @param start Start date
   * @param end End date
   * @returns Number of hours
   */
  calculateHours(start: Date | string, end: Date | string): number {
    // Explicitly ensure both dates are in Vietnam timezone
    const startDate = dayjs(ensureVNTimezone(start)).tz('Asia/Ho_Chi_Minh')
    const endDate = dayjs(ensureVNTimezone(end)).tz('Asia/Ho_Chi_Minh')

    // Check if end date is before start date, which would produce negative values
    if (endDate.isBefore(startDate)) {
      console.warn(`Warning: End date (${endDate.format()}) is before start date (${startDate.format()})`)
      // Return a small positive value to avoid negative calculations
      return 0.5
    }

    // Calculate difference in milliseconds
    const diffMilliseconds = endDate.diff(startDate)
    // Convert to hours
    const diffHours = diffMilliseconds / (1000 * 60 * 60)

    // Giảm tolerance xuống chỉ còn 3 giây để đảm bảo hầu hết các trường hợp
    // được tính chính xác theo số phút thực tế
    const tolerance = 3 / 3600 // 3 giây chuyển thành giờ
    const isNearWholeHour = Math.abs(Math.round(diffHours) - diffHours) <= tolerance

    console.log(`Time calculation: ${startDate.format('HH:mm')} to ${endDate.format('HH:mm')}`)
    console.log(`Raw difference: ${diffHours} hours`)
    console.log(`Is near whole hour: ${isNearWholeHour}`)

    if (isNearWholeHour) {
      console.log(`Rounding to: ${Math.round(diffHours)} hours`)
      return Math.round(diffHours)
    }

    // Tính toán số giờ và phút
    const hours = Math.floor(diffHours)
    const minutes = Math.floor((diffHours - hours) * 60)

    // Luôn tính giờ theo tỷ lệ phút sử dụng thực tế
    // Bỏ điều kiện minutes > 0 để đảm bảo luôn trả về giá trị chính xác
    const result = parseFloat((hours + minutes / 60).toFixed(2))
    console.log(`Calculated hours with minutes: ${hours}h ${minutes}m = ${result} hours`)
    return result
  }

  private async getServiceUnitPrice(startTime: Date, dayType: DayType, roomType: string): Promise<number> {
    const priceDoc = await databaseService.price.findOne({ day_type: dayType })
    if (!priceDoc || !priceDoc.time_slots) {
      throw new ErrorWithStatus({
        message: 'Không tìm thấy cấu hình giá',
        status: HTTP_STATUS_CODE.NOT_FOUND
      })
    }

    // Log thời gian server để debug
    console.log('Server time:', new Date())
    console.log('Input startTime:', startTime)

    // Sử dụng timezone Vietnam/Asia
    if (!dayjs.tz) {
      console.log('Configuring dayjs timezone...')
      dayjs.extend(require('dayjs/plugin/utc'))
      dayjs.extend(require('dayjs/plugin/timezone'))
    }

    // Lấy thời gian bắt đầu dưới dạng HH:mm để so sánh với khung giờ, sử dụng múi giờ Việt Nam
    const time = dayjs(ensureVNTimezone(startTime)).format('HH:mm')
    console.log('Thời gian bắt đầu (Asia/Ho_Chi_Minh):', time, 'Loại ngày:', dayType, 'Loại phòng:', roomType)

    // Log tất cả các khung giờ để debug
    console.log('Các khung giờ có sẵn:', JSON.stringify(priceDoc.time_slots))

    // Tìm khung giờ phù hợp với thời gian bắt đầu
    const timeSlot = priceDoc.time_slots.find((slot: any) => {
      const slotStart = slot.start
      const slotEnd = slot.end
      console.log(`Đang kiểm tra khung giờ: ${slotStart} - ${slotEnd}`)

      // Xử lý trường hợp khung giờ bắt đầu > khung giờ kết thúc (qua ngày)
      if (slotStart > slotEnd) {
        const isInRange = time >= slotStart || time <= slotEnd
        console.log(`Khung giờ qua ngày, kết quả: ${isInRange}`)
        return isInRange
      }
      // Trường hợp bình thường
      const isInRange = time >= slotStart && time <= slotEnd
      console.log(`Khung giờ thường, kết quả: ${isInRange}`)
      return isInRange
    })

    if (!timeSlot) {
      // Nếu không tìm thấy khung giờ, lấy khung giờ mặc định hoặc khung giờ đầu tiên
      console.log('Không tìm thấy khung giờ phù hợp, sử dụng khung giờ mặc định')
      const defaultTimeSlot = priceDoc.time_slots[0] // Lấy khung giờ đầu tiên làm mặc định

      if (!defaultTimeSlot) {
        throw new ErrorWithStatus({
          message: 'Không tìm thấy khung giá phù hợp cho thời gian ' + time,
          status: HTTP_STATUS_CODE.NOT_FOUND
        })
      }

      const priceEntry = defaultTimeSlot.prices.find((p: any) => p.room_type === roomType)
      if (!priceEntry) {
        throw new ErrorWithStatus({
          message: 'Không tìm thấy giá cho loại phòng ' + roomType,
          status: HTTP_STATUS_CODE.NOT_FOUND
        })
      }

      return priceEntry.price
    }

    const priceEntry = timeSlot.prices.find((p: any) => p.room_type === roomType)
    if (!priceEntry) {
      throw new ErrorWithStatus({
        message: 'Không tìm thấy giá cho loại phòng ' + roomType,
        status: HTTP_STATUS_CODE.NOT_FOUND
      })
    }

    return priceEntry.price
  }

  async getBill(
    scheduleId: string,
    actualEndTime?: string,
    paymentMethod?: string,
    promotionId?: string,
    actualStartTime?: string
  ): Promise<IBill> {
    const id = new ObjectId(scheduleId)
    const schedule = await databaseService.roomSchedule.findOne({ _id: id })
    const orders = await databaseService.fnbOrder.find({ roomScheduleId: id }).toArray()
    const room = await databaseService.rooms.findOne({ _id: schedule?.roomId })
    const menu = await databaseService.fnbMenu.find({}).toArray()

    if (!schedule) {
      throw new ErrorWithStatus({
        message: 'Không tìm thấy lịch đặt phòng',
        status: HTTP_STATUS_CODE.NOT_FOUND
      })
    }
    const dayType = await this.determineDayType(ensureVNTimezone(schedule.startTime))

    // Xử lý actualStartTime nếu được cung cấp
    let validatedStartTime: Date
    if (actualStartTime) {
      console.log('actualStartTime:', actualStartTime)

      if (/^\d{2}:\d{2}$/.test(actualStartTime)) {
        // Nếu là định dạng HH:mm
        const [hours, minutes] = actualStartTime.split(':')
        validatedStartTime = dayjs(ensureVNTimezone(schedule.startTime))
          .hour(parseInt(hours))
          .minute(parseInt(minutes))
          .second(0)
          .millisecond(0)
          .toDate()
        console.log('Validated start time:', dayjs(validatedStartTime).format('YYYY-MM-DD HH:mm:ss'))
      } else {
        // Nếu là định dạng datetime đầy đủ
        validatedStartTime = dayjs(actualStartTime).tz('Asia/Ho_Chi_Minh').toDate()

        if (!dayjs(validatedStartTime).isValid()) {
          throw new ErrorWithStatus({
            message: 'Thời gian bắt đầu không hợp lệ',
            status: HTTP_STATUS_CODE.BAD_REQUEST
          })
        }
      }
    } else {
      // Nếu không có actualStartTime, sử dụng schedule.startTime
      validatedStartTime = dayjs(ensureVNTimezone(schedule.startTime)).toDate()
    }

    // Convert times to Vietnam timezone
    const startTime = validatedStartTime

    // Kiểm tra và xử lý actualEndTime
    let validatedEndTime: Date
    console.log('actualEndTime:', actualEndTime)

    if (actualEndTime && /^\d{2}:\d{2}$/.test(actualEndTime)) {
      // Nếu là định dạng HH:mm
      const [hours, minutes] = actualEndTime.split(':')
      validatedEndTime = dayjs(ensureVNTimezone(startTime))
        .hour(parseInt(hours))
        .minute(parseInt(minutes))
        .second(0)
        .millisecond(0)
        .toDate()

      // Kiểm tra nếu actualEndTime trước startTime (điều này không hợp lý)
      if (dayjs(validatedEndTime).isBefore(dayjs(startTime))) {
        console.warn(
          `Warning: Actual end time (${actualEndTime}) is before start time (${dayjs(ensureVNTimezone(startTime)).format('HH:mm')})`
        )
        // Đặt giá trị mặc định là startTime + 1 giờ
        validatedEndTime = dayjs(ensureVNTimezone(startTime)).add(1, 'hour').toDate()
      }

      console.log('Validated end time:', dayjs(validatedEndTime).format('YYYY-MM-DD HH:mm:ss'))
    } else if (actualEndTime) {
      // Nếu là định dạng datetime đầy đủ
      validatedEndTime = dayjs(actualEndTime).tz('Asia/Ho_Chi_Minh').toDate()

      if (!dayjs(validatedEndTime).isValid()) {
        throw new ErrorWithStatus({
          message: 'Thời gian kết thúc không hợp lệ',
          status: HTTP_STATUS_CODE.BAD_REQUEST
        })
      }
    } else {
      // Nếu không có actualEndTime, sử dụng schedule.endTime
      validatedEndTime = schedule.endTime
        ? dayjs(ensureVNTimezone(schedule.endTime)).toDate()
        : dayjs(ensureVNTimezone(startTime)).add(1, 'hour').toDate() // Nếu không có endTime, mặc định là startTime + 1 giờ
    }

    // Lấy thông tin bảng giá cho loại ngày (weekday/weekend)
    const priceDoc = await databaseService.price.findOne({ day_type: dayType })
    if (!priceDoc || !priceDoc.time_slots) {
      throw new ErrorWithStatus({
        message: 'Không tìm thấy cấu hình giá',
        status: HTTP_STATUS_CODE.NOT_FOUND
      })
    }

    // Tính toán phí dịch vụ với việc xét nhiều khung giờ
    let totalServiceFee = 0
    let totalHoursUsed = 0
    const timeSlotItems = []

    // Sắp xếp các khung giờ theo thời gian bắt đầu
    const sortedTimeSlots = [...priceDoc.time_slots].sort((a, b) => {
      return a.start.localeCompare(b.start)
    })

    // Tạo ranh giới thời gian cho các khung giờ trong ngày
    const timeSlotBoundaries = []

    for (const slot of sortedTimeSlots) {
      // Use Vietnam timezone for all date calculations
      const slotStartTime = dayjs(ensureVNTimezone(startTime)).format('YYYY-MM-DD') + ' ' + slot.start
      let slotEndTime

      // Xử lý khung giờ qua ngày
      if (slot.start > slot.end) {
        slotEndTime = dayjs(ensureVNTimezone(startTime)).add(1, 'day').format('YYYY-MM-DD') + ' ' + slot.end
      } else {
        slotEndTime = dayjs(ensureVNTimezone(startTime)).format('YYYY-MM-DD') + ' ' + slot.end
      }

      timeSlotBoundaries.push({
        start: dayjs(slotStartTime).tz('Asia/Ho_Chi_Minh').toDate(),
        end: dayjs(slotEndTime).tz('Asia/Ho_Chi_Minh').toDate(),
        prices: slot.prices
      })
    }

    // Kiểm tra và tính toán giờ sử dụng trong từng khung giờ
    for (let i = 0; i < timeSlotBoundaries.length; i++) {
      const slot = timeSlotBoundaries[i]

      // Tìm đơn giá cho loại phòng trong khung giờ này
      const priceEntry = slot.prices.find((p: any) => p.room_type === room?.roomType)
      if (!priceEntry) {
        continue // Bỏ qua nếu không tìm thấy giá cho loại phòng
      }

      // Kiểm tra thời gian phiên có nằm trong khung giờ này không
      const sessionStart = dayjs(startTime).tz('Asia/Ho_Chi_Minh').isAfter(dayjs(slot.start).tz('Asia/Ho_Chi_Minh'))
        ? startTime
        : slot.start
      const sessionEnd = dayjs(validatedEndTime).tz('Asia/Ho_Chi_Minh').isBefore(dayjs(slot.end).tz('Asia/Ho_Chi_Minh'))
        ? validatedEndTime
        : slot.end

      // Nếu có thời gian sử dụng trong khung giờ này
      if (dayjs(sessionStart).tz('Asia/Ho_Chi_Minh').isBefore(dayjs(sessionEnd).tz('Asia/Ho_Chi_Minh'))) {
        const hoursInSlot = this.calculateHours(sessionStart, sessionEnd)

        if (hoursInSlot > 0) {
          // Làm tròn xuống phí dịch vụ (chia cho 1000 rồi nhân lại)
          const slotServiceFee = Math.floor((hoursInSlot * priceEntry.price) / 1000) * 1000

          totalServiceFee += slotServiceFee
          totalHoursUsed += hoursInSlot

          // Thêm vào danh sách chi tiết theo khung giờ
          timeSlotItems.push({
            description: `Phi dich vu thu am (${dayjs(ensureVNTimezone(sessionStart)).format('HH:mm')}-${dayjs(ensureVNTimezone(sessionEnd)).format('HH:mm')})`,
            quantity: parseFloat(hoursInSlot.toFixed(2)), // Đảm bảo hiển thị đúng 2 chữ số thập phân
            unitPrice: priceEntry.price,
            totalPrice: slotServiceFee
          })
        }
      }
    }

    // Nếu không có khung giờ nào phù hợp, sử dụng phương pháp cũ
    if (timeSlotItems.length === 0) {
      console.log('Không tìm thấy khung giờ phù hợp, sử dụng giá theo thời gian bắt đầu')
      const serviceFeeUnitPrice = await this.getServiceUnitPrice(startTime, dayType, room?.roomType || '')
      const hoursUsed = this.calculateHours(startTime, validatedEndTime)

      // Làm tròn xuống phí dịch vụ (chia cho 1000 rồi nhân lại)
      const roundedServiceFeeTotal = Math.floor((hoursUsed * serviceFeeUnitPrice) / 1000) * 1000

      timeSlotItems.push({
        description: `Phi dich vu thu am`,
        quantity: parseFloat(hoursUsed.toFixed(2)), // Đảm bảo hiển thị đúng 2 chữ số thập phân
        unitPrice: serviceFeeUnitPrice,
        totalPrice: roundedServiceFeeTotal
      })

      totalServiceFee = roundedServiceFeeTotal
      totalHoursUsed = hoursUsed
    }

    // Log để debug

    const items: {
      description: string
      quantity: number
      unitPrice: number
      totalPrice: number
      originalPrice?: number
      discountPercentage?: number
      discountName?: string
    }[] = [...timeSlotItems]

    const order = orders[0]

    // Xử lý các đơn hàng F&B từ menu động
    if (order && order.order) {
      // Xử lý snacks từ đơn hàng
      if (order.order.snacks) {
        const snackIds = Object.keys(order.order.snacks)

        for (const snackId of snackIds) {
          const quantity = order.order.snacks[snackId]
          const menuItem = menu.find((item) => item._id.toString() === snackId)

          if (menuItem) {
            // Chuyển đổi giá từ chuỗi sang số nếu cần
            const price =
              typeof menuItem.price === 'string'
                ? parseFloat((menuItem.price as string).replace(/\./g, ''))
                : typeof menuItem.price === 'number'
                  ? menuItem.price
                  : 0

            // Làm tròn xuống tổng giá (chia cho 1000 rồi nhân lại)
            const roundedTotalPrice = Math.floor((price * quantity) / 1000) * 1000

            items.push({
              description: menuItem.name,
              quantity: quantity,
              unitPrice: price,
              totalPrice: roundedTotalPrice
            })
          }
        }
      }

      // Xử lý drinks từ đơn hàng (tương tự như snacks)
      if (order.order.drinks) {
        const drinkIds = Object.keys(order.order.drinks)

        for (const drinkId of drinkIds) {
          const quantity = order.order.drinks[drinkId]
          const menuItem = menu.find((item) => item._id.toString() === drinkId)

          if (menuItem) {
            const price =
              typeof menuItem.price === 'string'
                ? parseFloat((menuItem.price as string).replace(/\./g, ''))
                : typeof menuItem.price === 'number'
                  ? menuItem.price
                  : 0

            // Làm tròn xuống tổng giá (chia cho 1000 rồi nhân lại)
            const roundedTotalPrice = Math.floor((price * quantity) / 1000) * 1000

            items.push({
              description: menuItem.name,
              quantity: quantity,
              unitPrice: price,
              totalPrice: roundedTotalPrice
            })
          }
        }
      }
    }

    // Lấy khuyến mãi đang hoạt động
    let activePromotion = null

    // If a specific promotionId is provided, use that instead of the active promotion
    if (promotionId) {
      if (promotionId !== 'null') {
        activePromotion = await promotionService.getPromotionById(promotionId)
      } else {
        // Nếu promotionId là 'null', không áp dụng khuyến mãi
        console.log('Không áp dụng khuyến mãi (promotionId = null)')
      }
    } else {
      activePromotion = await promotionService.getActivePromotion()
    }

    // Áp dụng khuyến mãi nếu có
    if (activePromotion) {
      console.log('Áp dụng khuyến mãi:', activePromotion.name)

      // Duyệt qua từng item để áp dụng promotion
      for (let i = 0; i < items.length; i++) {
        const item = items[i]

        // Gọi hàm applyPromotionToItem và truyền thông tin phòng
        const itemWithPromotion = promotionService.applyPromotionToItem(
          {
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice
          },
          activePromotion,
          room?._id
        )

        // Cập nhật lại item nếu có áp dụng giảm giá
        if ('originalPrice' in itemWithPromotion) {
          items[i].originalPrice = itemWithPromotion.originalPrice
          items[i].totalPrice = itemWithPromotion.totalPrice
          items[i].discountPercentage = itemWithPromotion.discountPercentage
          items[i].discountName = itemWithPromotion.discountName

          // Cập nhật mô tả để bao gồm thông tin khuyến mãi
          items[i].description =
            `${item.description} (Giam ${itemWithPromotion.discountPercentage}% - ${itemWithPromotion.discountName || 'KM'})`
        }
      }
    }

    // Tính tổng tiền từ các mục đã được làm tròn và có thể đã áp dụng khuyến mãi
    const totalAmount = items.reduce((acc, item) => acc + item.totalPrice, 0)

    const bill: IBill = {
      scheduleId: schedule._id,
      roomId: schedule.roomId,
      startTime: startTime, // Sử dụng startTime đã điều chỉnh
      endTime: validatedEndTime,
      createdAt: schedule.createdAt,
      note: schedule.note,
      items: items.map((item) => ({
        description: item.description,
        price: item.unitPrice,
        quantity: typeof item.quantity === 'number' ? parseFloat(item.quantity.toFixed(2)) : item.quantity, // Đảm bảo hiển thị đúng 2 chữ số thập phân
        originalPrice: item.originalPrice,
        discountPercentage: item.discountPercentage,
        discountName: item.discountName
      })),
      totalAmount,
      paymentMethod,
      activePromotion: activePromotion
        ? {
            name: activePromotion.name,
            discountPercentage: activePromotion.discountPercentage,
            appliesTo: activePromotion.appliesTo
          }
        : undefined,
      actualEndTime: actualEndTime ? new Date(actualEndTime) : undefined,
      actualStartTime: actualStartTime ? new Date(actualStartTime) : undefined
    }

    // Làm tròn tổng tiền xuống đến 1000 VND để đảm bảo nhất quán
    bill.totalAmount = Math.floor(bill.totalAmount / 1000) * 1000

    return bill
  }

  async printBill(billData: IBill): Promise<IBill> {
    try {
      console.log('PrintBill - Promotion info:', JSON.stringify(billData.activePromotion))

      // Xác định promotionId đúng để truyền vào getBill
      let promotionIdToUse = undefined
      if (billData.activePromotion) {
        // Tìm promotion dựa vào tên
        const promotionFromDB = await databaseService.promotions.findOne({
          name: billData.activePromotion.name
        })

        if (promotionFromDB && promotionFromDB._id) {
          promotionIdToUse = promotionFromDB._id.toString()
          console.log('Found promotion by name, using ID:', promotionIdToUse)
        } else {
          console.log('Could not find promotion with name:', billData.activePromotion.name)
        }
      }

      // Lưu lại thời gian bắt đầu và kết thúc chính xác khi in hóa đơn
      const exactStartTime = billData.actualStartTime || billData.startTime
      const exactEndTime = billData.endTime || new Date()
      console.log(
        `Thời gian bắt đầu chính xác khi in hóa đơn: ${dayjs(ensureVNTimezone(exactStartTime)).format('DD/MM/YYYY HH:mm:ss')}`
      )
      console.log(
        `Thời gian kết thúc chính xác khi in hóa đơn: ${dayjs(ensureVNTimezone(exactEndTime)).format('DD/MM/YYYY HH:mm:ss')}`
      )

      // Sử dụng tính năng tính lại hóa đơn từ getBill để đảm bảo tính chính xác
      // thay vì chỉ sao chép billData đã truyền vào
      const recalculatedBill = await this.getBill(
        billData.scheduleId.toString(),
        dayjs(exactEndTime).toISOString(),
        billData.paymentMethod,
        promotionIdToUse,
        dayjs(exactStartTime).toISOString()
      )

      // Tạo unique ID cho bill này, nhưng sẽ không lưu vào DB
      const bill: IBill = {
        _id: new ObjectId(),
        scheduleId: new ObjectId(recalculatedBill.scheduleId),
        roomId: new ObjectId(recalculatedBill.roomId),
        items: recalculatedBill.items,
        totalAmount: recalculatedBill.totalAmount,
        startTime: recalculatedBill.startTime,
        endTime: recalculatedBill.endTime,
        createdAt: new Date(),
        paymentMethod: recalculatedBill.paymentMethod,
        note: recalculatedBill.note,
        activePromotion: recalculatedBill.activePromotion,
        actualEndTime: exactEndTime,
        actualStartTime: exactStartTime
      }

      // Kiểm tra status của schedule chỉ để ghi log
      const schedule = await databaseService.roomSchedule.findOne({ _id: bill.scheduleId })
      console.log(
        `In hóa đơn cho ScheduleId=${bill.scheduleId}, Status=${schedule?.status || 'unknown'}, không lưu vào database`
      )

      // Lưu hóa đơn vào DB sau khi tính
      try {
        // Tạo một bản sao của bill để lưu vào DB
        const billToSave = { ...bill }
        const result = await databaseService.bills.insertOne(billToSave as any)
        console.log(`Đã lưu hóa đơn vào database với ID: ${result.insertedId}`)
      } catch (saveError) {
        console.error('Lỗi khi lưu hóa đơn vào database:', saveError)
        // Không ảnh hưởng đến việc in hóa đơn
      }

      const room = await databaseService.rooms.findOne({ _id: bill.roomId })

      let paymentMethodText = ''
      switch (bill.paymentMethod) {
        case 'cash':
          paymentMethodText = 'Tien mat'
          break
        case 'bank_transfer':
          paymentMethodText = 'Chuyen khoan'
          break
        case 'momo':
          paymentMethodText = 'MoMo'
          break
        case 'zalo_pay':
          paymentMethodText = 'Zalo Pay'
          break
        case 'vnpay':
          paymentMethodText = 'VNPay'
          break
        case 'visa':
          paymentMethodText = 'Visa'
          break
        case 'mastercard':
          paymentMethodText = 'Mastercard'
          break
        default:
          paymentMethodText = bill.paymentMethod || ''
      }

      // Sử dụng Promise để xử lý in hóa đơn
      return new Promise((resolve, reject) => {
        const self = this // Lưu tham chiếu this

        try {
          const usb = require('usb')
          if (typeof usb.on !== 'function') {
            const { EventEmitter } = require('events')
            Object.setPrototypeOf(usb, EventEmitter.prototype)
            usb.on = EventEmitter.prototype.on
          }

          const USB = require('escpos-usb')
          const escpos = require('escpos')
          const devices = USB.findPrinter()

          if (devices.length === 0) {
            throw new Error('Khong tim thay may in USB')
          }

          // Lưu lại thông tin thiết bị tìm thấy để debug
          const printerDevice = devices[0]

          // Sử dụng thông tin từ thiết bị tìm thấy
          const device = new USB(printerDevice.deviceDescriptor.idVendor, printerDevice.deviceDescriptor.idProduct)

          // Sử dụng encoding GB18030 cho máy in Gainscha model GA-E200I
          const printer = new escpos.Printer(device, { encoding: 'GB18030' })

          // Định dạng ngày giờ
          const formatDate = (date: Date) => {
            return `${dayjs(ensureVNTimezone(date)).format('DD/MM/YYYY HH:mm')}`
          }

          // Tạo mã hóa đơn theo định dạng #DDMMHHMM (ngày, tháng, giờ, phút)
          const now = new Date()
          const invoiceCode = `#${now.getDate().toString().padStart(2, '0')}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`

          device.open(function (err: any) {
            if (err) {
              return reject(new Error('Lỗi mở máy in: ' + err.message))
            }

            // In hóa đơn
            printer
              .font('a')
              .align('ct')
              .style('b')
              .size(1, 1)
              .text('Jozo Music Box')
              .text('HOA DON THANH TOAN')
              .style('b')
              .size(0, 0)
              .text('--------------------------------------------')
              .text(`Ma HD: ${invoiceCode}`)
              .text(`${room?.roomName || 'Khong xac dinh'}`)
              .align('lt')
              .text(`Ngay: ${formatDate(new Date(bill.createdAt))}`)
              .text(`Gio bat dau: ${dayjs(ensureVNTimezone(bill.startTime)).format('HH:mm')}`)
              .text(`Gio ket thuc: ${dayjs(ensureVNTimezone(bill.endTime)).format('HH:mm')}`)
              .align('ct')
              .text('--------------------------------------------')
              .style('b')
              .text('CHI TIET DICH VU')
              .style('b')
              .text('--------------------------------------------')

            // Tạo header cho bảng với khoảng cách đều hơn
            const tableHeader = [
              { text: 'Dich vu', width: 0.45, align: 'left' },
              { text: 'SL', width: 0.15, align: 'center' },
              { text: 'Don gia', width: 0.2, align: 'right' },
              { text: 'T.Tien', width: 0.2, align: 'right' }
            ]

            printer.tableCustom(tableHeader)
            printer.text('--------------------------------------')

            // In chi tiết từng mục với định dạng cải thiện
            bill.items.forEach((item) => {
              let description = item.description
              let quantity = item.quantity

              // Xử lý hiển thị cho phí dịch vụ thu âm
              if (description === 'Phi dich vu thu am') {
                quantity = Math.round(quantity * 10) / 10
              }

              // Tách mô tả và thông tin khuyến mãi nếu mô tả có chứa thông tin khuyến mãi
              const promotionMatch = description.match(/ \(Giam (\d+)% - (.*)\)$/)
              if (promotionMatch) {
                // Tách phần mô tả gốc và phần khuyến mãi
                description = description.replace(/ \(Giam (\d+)% - (.*)\)$/, '')
              }

              // Giới hạn độ dài của description để tránh bị tràn
              // Không cắt ngắn các mô tả về phí dịch vụ thu âm
              if (description.length > 20 && !description.includes('Phi dich vu thu am')) {
                description = description.substring(0, 17) + '...'
              }

              // Định dạng số tiền để hiển thị gọn hơn
              const formattedPrice = item.price >= 1000 ? `${Math.floor(item.price / 1000)}K` : item.price.toString()

              // Sử dụng originalPrice nếu có, nếu không sử dụng price để tính toán
              let itemTotalDisplay = 0
              if (item.originalPrice) {
                itemTotalDisplay = item.originalPrice
              } else {
                // Sử dụng cùng logic làm tròn như trong getBill
                itemTotalDisplay = Math.floor((item.quantity * item.price) / 1000) * 1000
              }

              const formattedTotal =
                itemTotalDisplay >= 1000 ? `${Math.floor(itemTotalDisplay / 1000)}K` : itemTotalDisplay.toString()

              // In thông tin item mà không hiển thị thông tin giảm giá
              printer.tableCustom([
                { text: description, width: 0.45, align: 'left' },
                { text: quantity.toString(), width: 0.15, align: 'center' },
                { text: formattedPrice, width: 0.2, align: 'right' },
                { text: formattedTotal, width: 0.2, align: 'right' }
              ])
            })

            // Hiển thị tổng giá trước khi giảm
            let subtotalAmount = 0

            // Tính lại subtotalAmount từ các item với giá không giảm giá
            bill.items.forEach((item) => {
              if (item.originalPrice) {
                subtotalAmount += item.originalPrice
              } else {
                subtotalAmount += item.quantity * item.price
              }
            })

            printer.text('--------------------------------------------')

            // Hiển thị thông tin giảm giá tổng nếu có
            if (bill.activePromotion) {
              printer.align('rt')
              printer.tableCustom([
                {
                  text: `Tong tien hang: `,
                  width: 0.6,
                  align: 'left'
                },
                {
                  text: `${subtotalAmount.toLocaleString('vi-VN')} VND`,
                  width: 0.4,
                  align: 'right'
                }
              ])

              const discountAmount = Math.floor((subtotalAmount * bill.activePromotion.discountPercentage) / 100)
              printer.tableCustom([
                {
                  text: `Giam gia ${bill.activePromotion.discountPercentage}% - ${bill.activePromotion.name}: `,
                  width: 0.6,
                  align: 'left'
                },
                {
                  text: `-${discountAmount.toLocaleString('vi-VN')} VND`,
                  width: 0.4,
                  align: 'right'
                }
              ])
            }

            printer
              .text('--------------------------------------------')
              .align('rt')
              .style('b')
              .text(`TONG CONG: ${bill.totalAmount.toLocaleString('vi-VN')} VND`)
              .align('lt')
              .style('normal')
              .text('--------------------------------------------')
              .text(`Phuong thuc thanh toan: ${paymentMethodText}`)
              .align('ct')
              .text('--------------------------------------------')
              .text('Cam on quy khach da su dung dich vu cua Jozo')
              .text('Hen gap lai quy khach!')
              .text('--------------------------------------------')
              .align('ct')
              .text('Dia chi: 247/5 Phan Trung, Tan Mai, Bien Hoa')
              .text('Website: jozo.com.vn')
              .style('i')
              .text('Powered by Jozo')
              .style('normal')
              .feed(3)
              .cut()
              .close(function () {
                console.log('In hoa don thanh cong')
                self.transactionHistory.push(bill)
                resolve(bill)
              })
          })
        } catch (error) {
          reject(error)
        }
      })
    } catch (error) {
      console.error('Lỗi khi lưu hóa đơn:', error)
      throw error
    }
  }

  /**
   * Get total revenue for a specific date
   * @param date Date to get revenue for (format: ISO date string)
   * @returns Object containing total revenue and bill details
   */
  async getDailyRevenue(date: string): Promise<{ totalRevenue: number; bills: IBill[] }> {
    try {
      // Chuyển đổi input date sang múi giờ Việt Nam
      const inputDate = dayjs(date).tz('Asia/Ho_Chi_Minh')

      // Tạo đầu ngày và cuối ngày trong múi giờ Việt Nam
      const startOfDay = inputDate.startOf('day')
      const endOfDay = inputDate.endOf('day')

      // Chuyển sang UTC để lưu vào database (MongoDB lưu ở UTC)
      const startDateUTC = startOfDay.toDate()
      const endDateUTC = endOfDay.toDate()

      console.log(`[DOANH THU] Bắt đầu tính doanh thu ngày ${inputDate.format('DD/MM/YYYY')}`)
      console.log(
        `[DOANH THU] Khoảng thời gian (VN): ${startOfDay.format('YYYY-MM-DD HH:mm:ss')} - ${endOfDay.format('YYYY-MM-DD HH:mm:ss')}`
      )
      console.log(`[DOANH THU] Khoảng thời gian (UTC): ${startDateUTC.toISOString()} - ${endDateUTC.toISOString()}`)

      // Lấy các lịch đặt phòng đã hoàn thành trong ngày (sử dụng UTC trong query)
      const finishedSchedules = await databaseService.roomSchedule
        .find({
          status: RoomScheduleStatus.Finished,
          endTime: {
            $gte: startDateUTC,
            $lte: endDateUTC
          }
        })
        .toArray()

      console.log(`[DOANH THU] Tìm thấy ${finishedSchedules.length} lịch đã hoàn thành`)

      if (finishedSchedules.length === 0) {
        console.log('[DOANH THU] Không có lịch nào hoàn thành trong ngày này')
        return {
          totalRevenue: 0,
          bills: []
        }
      }

      // Đầu tiên tìm kiếm trong database xem đã có hóa đơn lưu sẵn chưa
      console.log('[DOANH THU] Tìm kiếm hóa đơn đã lưu trong database...')
      const scheduleIds = finishedSchedules.map((schedule) => schedule._id)
      const savedBills = await databaseService.bills
        .find({
          scheduleId: { $in: scheduleIds }
        })
        .toArray()

      // Filter lại savedBills để chỉ giữ các hóa đơn thực sự nằm trong ngày đã chọn
      // (kiểm tra theo createdAt hoặc endTime)
      const filteredSavedBills = savedBills.filter((bill) => {
        // Chuyển đổi sang múi giờ Việt Nam để so sánh
        const billCreatedAt = dayjs(ensureVNTimezone(bill.createdAt)).tz('Asia/Ho_Chi_Minh')
        const billEndTime = dayjs(ensureVNTimezone(bill.endTime)).tz('Asia/Ho_Chi_Minh')

        // Nếu createdAt nằm trong ngày đã chọn
        if (billCreatedAt.isAfter(startOfDay) && billCreatedAt.isBefore(endOfDay)) {
          return true
        }

        // Hoặc nếu endTime nằm trong ngày đã chọn
        if (billEndTime.isAfter(startOfDay) && billEndTime.isBefore(endOfDay)) {
          return true
        }

        return false
      })

      console.log(
        `[DOANH THU] Tìm thấy ${filteredSavedBills.length} hóa đơn đã lưu trong database (thuộc ngày ${inputDate.format('DD/MM/YYYY')})`
      )

      // Tạo map từ scheduleId đến bill đã lưu để tra cứu nhanh
      const savedBillMap = new Map<string, IBill>()
      for (const bill of filteredSavedBills) {
        const scheduleId = bill.scheduleId.toString()
        if (
          !savedBillMap.has(scheduleId) ||
          (bill.createdAt &&
            savedBillMap.get(scheduleId)!.createdAt &&
            new Date(bill.createdAt) > new Date(savedBillMap.get(scheduleId)!.createdAt))
        ) {
          savedBillMap.set(scheduleId, bill)
        }
      }

      console.log(`[DOANH THU] Có ${savedBillMap.size} lịch có hóa đơn đã lưu (sau khi lọc trùng lặp)`)

      // CÁCH MỚI: Ưu tiên sử dụng hóa đơn đã lưu, nếu không có thì tính lại
      const finalBills: IBill[] = []
      let totalRevenue = 0

      for (const schedule of finishedSchedules) {
        try {
          const scheduleId = schedule._id.toString()
          console.log(`\n[DOANH THU] Xử lý hóa đơn cho lịch ${scheduleId}:`)

          // Lấy thông tin phòng
          const room = await databaseService.rooms.findOne({ _id: schedule.roomId })
          console.log(`- Phòng: ${room?.roomName || schedule.roomId}`)
          console.log(
            `- Thời gian: ${dayjs(ensureVNTimezone(schedule.startTime)).format('DD/MM HH:mm')} - ${dayjs(ensureVNTimezone(schedule.endTime)).format('DD/MM HH:mm')}`
          )

          // Kiểm tra xem lịch này có thực sự thuộc về ngày đã chọn không
          const scheduleEndTime = dayjs(schedule.endTime).tz('Asia/Ho_Chi_Minh')
          if (!scheduleEndTime.isAfter(startOfDay) || !scheduleEndTime.isBefore(endOfDay)) {
            console.log(`- Lịch này không thuộc về ngày ${inputDate.format('DD/MM/YYYY')}, bỏ qua`)
            continue
          }

          let billToUse: IBill

          // Kiểm tra xem đã có hóa đơn lưu sẵn chưa
          if (savedBillMap.has(scheduleId)) {
            billToUse = savedBillMap.get(scheduleId)!
            console.log(`- Sử dụng hóa đơn đã lưu trong database, ID: ${billToUse._id}`)
            console.log(
              `- Thời gian kết thúc trong hóa đơn: ${dayjs(ensureVNTimezone(billToUse.endTime)).format('DD/MM HH:mm:ss')}`
            )

            if (billToUse.actualEndTime) {
              console.log(
                `- Thời gian kết thúc chính xác: ${dayjs(ensureVNTimezone(billToUse.actualEndTime)).format('DD/MM HH:mm:ss')}`
              )
            }
          } else {
            // Nếu không có hóa đơn lưu sẵn, tính lại từ getBill
            console.log(`- Không tìm thấy hóa đơn đã lưu, đang tính toán lại...`)
            billToUse = await this.getBill(scheduleId, undefined, undefined, 'null', undefined)

            // Gán _id nếu cần
            if (!billToUse._id) {
              billToUse._id = new ObjectId()
            }
          }

          // Làm tròn tổng tiền xuống đến 1000 VND để đảm bảo nhất quán
          billToUse.totalAmount = Math.floor(billToUse.totalAmount / 1000) * 1000

          // Log chi tiết hóa đơn
          console.log(`- Hóa đơn được sử dụng:`)
          console.log(`  + Tổng tiền: ${billToUse.totalAmount.toLocaleString('vi-VN')} VND`)

          // Sử dụng hóa đơn
          finalBills.push(billToUse)
          totalRevenue += billToUse.totalAmount

          console.log(`- Đã thêm vào tổng doanh thu: ${billToUse.totalAmount.toLocaleString('vi-VN')} VND`)
          console.log(`- Tổng doanh thu hiện tại: ${totalRevenue.toLocaleString('vi-VN')} VND`)
        } catch (error) {
          console.error(`[DOANH THU] Lỗi khi xử lý hóa đơn cho lịch ${schedule._id}:`, error)
        }
      }

      console.log(`\n[DOANH THU] Tổng kết doanh thu ngày ${inputDate.format('DD/MM/YYYY')}:`)
      console.log(`- Số lượng hóa đơn: ${finalBills.length}`)
      console.log(`- Tổng doanh thu: ${totalRevenue.toLocaleString('vi-VN')} VND`)

      return {
        totalRevenue,
        bills: finalBills as any // Cast to compatible type
      }
    } catch (error) {
      console.error('[DOANH THU] Lỗi khi tính doanh thu:', error)
      throw error
    }
  }

  /**
   * Get total revenue for a specific week
   * @param date Any date within the week to get revenue for (format: ISO date string)
   * @returns Object containing total revenue, bill details, and date range
   */
  async getWeeklyRevenue(
    date: string
  ): Promise<{ totalRevenue: number; bills: any[]; startDate: Date; endDate: Date }> {
    try {
      const targetDate = dayjs(date).tz('Asia/Ho_Chi_Minh')
      const startOfWeek = targetDate.startOf('week')
      const endOfWeek = targetDate.endOf('week')

      const startDate = startOfWeek.toDate()
      const endDate = endOfWeek.toDate()

      console.log(`[DOANH THU] Bắt đầu tính doanh thu tuần ${targetDate.week()} năm ${targetDate.year()}`)
      console.log(`[DOANH THU] Khoảng thời gian: ${startDate.toISOString()} - ${endDate.toISOString()}`)

      const finishedSchedules = await databaseService.roomSchedule
        .find({
          status: RoomScheduleStatus.Finished,
          endTime: {
            $gte: startDate,
            $lte: endDate
          }
        })
        .toArray()

      console.log(`[DOANH THU] Tìm thấy ${finishedSchedules.length} lịch đã hoàn thành`)

      if (finishedSchedules.length === 0) {
        console.log('[DOANH THU] Không có lịch nào hoàn thành trong tuần này')
        return {
          totalRevenue: 0,
          bills: [],
          startDate,
          endDate
        }
      }

      // CÁCH MỚI: Luôn tính lại hóa đơn cho mọi lịch
      const finalBills: IBill[] = []
      let totalRevenue = 0

      // Tìm kiếm hóa đơn đã lưu trong database
      console.log('[DOANH THU] Tìm kiếm hóa đơn đã lưu trong database...')
      const scheduleIds = finishedSchedules.map((schedule) => schedule._id)
      const savedBills = await databaseService.bills
        .find({
          scheduleId: { $in: scheduleIds }
        })
        .toArray()

      // Tạo map từ scheduleId đến bill đã lưu để tra cứu nhanh
      const savedBillMap = new Map<string, IBill>()
      for (const bill of savedBills) {
        const scheduleId = bill.scheduleId.toString()
        if (
          !savedBillMap.has(scheduleId) ||
          (bill.createdAt &&
            savedBillMap.get(scheduleId)!.createdAt &&
            new Date(bill.createdAt) > new Date(savedBillMap.get(scheduleId)!.createdAt))
        ) {
          savedBillMap.set(scheduleId, bill)
        }
      }

      console.log(`[DOANH THU] Có ${savedBillMap.size} lịch có hóa đơn đã lưu (sau khi lọc trùng lặp)`)

      for (const schedule of finishedSchedules) {
        try {
          console.log(`\n[DOANH THU] Xử lý hóa đơn cho lịch ${schedule._id}:`)

          // Lấy thông tin phòng
          const room = await databaseService.rooms.findOne({ _id: schedule.roomId })
          console.log(`- Phòng: ${room?.roomName || schedule.roomId}`)
          console.log(
            `- Thời gian: ${dayjs(ensureVNTimezone(schedule.startTime)).format('DD/MM HH:mm')} - ${dayjs(ensureVNTimezone(schedule.endTime)).format('DD/MM HH:mm')}`
          )

          let billToUse: IBill

          // Kiểm tra xem đã có hóa đơn lưu sẵn chưa
          if (savedBillMap.has(schedule._id.toString())) {
            billToUse = savedBillMap.get(schedule._id.toString())!
            console.log(`- Sử dụng hóa đơn đã lưu trong database, ID: ${billToUse._id}`)
          } else {
            // Tính lại hóa đơn dựa trên thông tin schedule
            console.log(`- Không tìm thấy hóa đơn đã lưu, đang tính toán lại...`)
            billToUse = await this.getBill(schedule._id.toString(), undefined, undefined, 'null', undefined)

            // Gán _id nếu cần
            if (!billToUse._id) {
              billToUse._id = new ObjectId()
            }
          }

          // Làm tròn tổng tiền xuống đến 1000 VND để đảm bảo nhất quán
          billToUse.totalAmount = Math.floor(billToUse.totalAmount / 1000) * 1000

          // Log chi tiết hóa đơn đã tính
          console.log(`- Hóa đơn được sử dụng:`)
          console.log(`  + Tổng tiền (đã làm tròn): ${billToUse.totalAmount.toLocaleString('vi-VN')} VND`)

          if (billToUse.items) {
            billToUse.items.forEach((item) => {
              console.log(
                `  + ${item.description}: ${item.quantity} x ${item.price.toLocaleString('vi-VN')} = ${(item.quantity * item.price).toLocaleString('vi-VN')} VND`
              )
            })
          }

          // Sử dụng hóa đơn đã tính toán
          finalBills.push(billToUse)
          totalRevenue += billToUse.totalAmount

          console.log(`- Đã thêm vào tổng doanh thu: ${billToUse.totalAmount.toLocaleString('vi-VN')} VND`)
          console.log(`- Tổng doanh thu hiện tại: ${totalRevenue.toLocaleString('vi-VN')} VND`)
        } catch (error) {
          console.error(`[DOANH THU] Lỗi khi xử lý hóa đơn cho lịch ${schedule._id}:`, error)
        }
      }

      console.log(`\n[DOANH THU] Tổng kết doanh thu tuần ${targetDate.week()} năm ${targetDate.year()}:`)
      console.log(`- Số lượng hóa đơn: ${finalBills.length}`)
      console.log(`- Tổng doanh thu: ${totalRevenue.toLocaleString('vi-VN')} VND`)

      return {
        totalRevenue,
        bills: finalBills as any,
        startDate,
        endDate
      }
    } catch (error) {
      console.error('[DOANH THU] Lỗi khi tính doanh thu:', error)
      throw error
    }
  }

  /**
   * Get total revenue for a specific month
   * @param date Any date within the month to get revenue for (format: ISO date string)
   * @returns Object containing total revenue, bill details, and date range
   */
  async getMonthlyRevenue(
    date: string
  ): Promise<{ totalRevenue: number; bills: any[]; startDate: Date; endDate: Date }> {
    try {
      const targetDate = dayjs(date).tz('Asia/Ho_Chi_Minh')
      const startOfMonth = targetDate.startOf('month')
      const endOfMonth = targetDate.endOf('month')

      const startDate = startOfMonth.toDate()
      const endDate = endOfMonth.toDate()

      console.log(`[DOANH THU] Bắt đầu tính doanh thu tháng ${targetDate.format('MM/YYYY')}`)
      console.log(`[DOANH THU] Khoảng thời gian: ${startDate.toISOString()} - ${endDate.toISOString()}`)

      const finishedSchedules = await databaseService.roomSchedule
        .find({
          status: RoomScheduleStatus.Finished,
          endTime: {
            $gte: startDate,
            $lte: endDate
          }
        })
        .toArray()

      console.log(`[DOANH THU] Tìm thấy ${finishedSchedules.length} lịch đã hoàn thành`)

      if (finishedSchedules.length === 0) {
        console.log('[DOANH THU] Không có lịch nào hoàn thành trong tháng này')
        return {
          totalRevenue: 0,
          bills: [],
          startDate,
          endDate
        }
      }

      // CÁCH MỚI: Luôn tính lại hóa đơn cho mọi lịch
      const finalBills: IBill[] = []
      let totalRevenue = 0

      // Tìm kiếm hóa đơn đã lưu trong database
      console.log('[DOANH THU] Tìm kiếm hóa đơn đã lưu trong database...')
      const scheduleIds = finishedSchedules.map((schedule) => schedule._id)
      const savedBills = await databaseService.bills
        .find({
          scheduleId: { $in: scheduleIds }
        })
        .toArray()

      // Tạo map từ scheduleId đến bill đã lưu để tra cứu nhanh
      const savedBillMap = new Map<string, IBill>()
      for (const bill of savedBills) {
        const scheduleId = bill.scheduleId.toString()
        if (
          !savedBillMap.has(scheduleId) ||
          (bill.createdAt &&
            savedBillMap.get(scheduleId)!.createdAt &&
            new Date(bill.createdAt) > new Date(savedBillMap.get(scheduleId)!.createdAt))
        ) {
          savedBillMap.set(scheduleId, bill)
        }
      }

      console.log(`[DOANH THU] Có ${savedBillMap.size} lịch có hóa đơn đã lưu (sau khi lọc trùng lặp)`)

      for (const schedule of finishedSchedules) {
        try {
          console.log(`\n[DOANH THU] Xử lý hóa đơn cho lịch ${schedule._id}:`)

          // Lấy thông tin phòng
          const room = await databaseService.rooms.findOne({ _id: schedule.roomId })
          console.log(`- Phòng: ${room?.roomName || schedule.roomId}`)
          console.log(
            `- Thời gian: ${dayjs(ensureVNTimezone(schedule.startTime)).format('DD/MM HH:mm')} - ${dayjs(ensureVNTimezone(schedule.endTime)).format('DD/MM HH:mm')}`
          )

          let billToUse: IBill

          // Kiểm tra xem đã có hóa đơn lưu sẵn chưa
          if (savedBillMap.has(schedule._id.toString())) {
            billToUse = savedBillMap.get(schedule._id.toString())!
            console.log(`- Sử dụng hóa đơn đã lưu trong database, ID: ${billToUse._id}`)
          } else {
            // Tính lại hóa đơn dựa trên thông tin schedule
            console.log(`- Không tìm thấy hóa đơn đã lưu, đang tính toán lại...`)
            billToUse = await this.getBill(schedule._id.toString(), undefined, undefined, 'null', undefined)

            // Gán _id nếu cần
            if (!billToUse._id) {
              billToUse._id = new ObjectId()
            }
          }

          // Làm tròn tổng tiền xuống đến 1000 VND để đảm bảo nhất quán
          billToUse.totalAmount = Math.floor(billToUse.totalAmount / 1000) * 1000

          // Log chi tiết hóa đơn đã tính
          console.log(`- Hóa đơn được sử dụng:`)
          console.log(`  + Tổng tiền (đã làm tròn): ${billToUse.totalAmount.toLocaleString('vi-VN')} VND`)

          if (billToUse.items) {
            billToUse.items.forEach((item) => {
              console.log(
                `  + ${item.description}: ${item.quantity} x ${item.price.toLocaleString('vi-VN')} = ${(item.quantity * item.price).toLocaleString('vi-VN')} VND`
              )
            })
          }

          // Sử dụng hóa đơn đã tính toán
          finalBills.push(billToUse)
          totalRevenue += billToUse.totalAmount

          console.log(`- Đã thêm vào tổng doanh thu: ${billToUse.totalAmount.toLocaleString('vi-VN')} VND`)
          console.log(`- Tổng doanh thu hiện tại: ${totalRevenue.toLocaleString('vi-VN')} VND`)
        } catch (error) {
          console.error(`[DOANH THU] Lỗi khi xử lý hóa đơn cho lịch ${schedule._id}:`, error)
        }
      }

      console.log(`\n[DOANH THU] Tổng kết doanh thu tháng ${targetDate.format('MM/YYYY')}:`)
      console.log(`- Số lượng hóa đơn: ${finalBills.length}`)
      console.log(`- Tổng doanh thu: ${totalRevenue.toLocaleString('vi-VN')} VND`)

      return {
        totalRevenue,
        bills: finalBills as any,
        startDate,
        endDate
      }
    } catch (error) {
      console.error('[DOANH THU] Lỗi khi tính doanh thu:', error)
      throw error
    }
  }

  /**
   * Get total revenue for a custom date range
   * @param startDate Start date (format: ISO date string)
   * @param endDate End date (format: ISO date string)
   * @returns Object containing total revenue, bill details, and date range
   */
  async getRevenueByCustomRange(
    startDate: string,
    endDate: string
  ): Promise<{ totalRevenue: number; bills: any[]; startDate: Date; endDate: Date }> {
    try {
      const start = dayjs(startDate).tz('Asia/Ho_Chi_Minh').startOf('day')
      const end = dayjs(endDate).tz('Asia/Ho_Chi_Minh').endOf('day')

      const startDateObj = start.toDate()
      const endDateObj = end.toDate()

      console.log(`[DOANH THU] Bắt đầu tính doanh thu từ ${start.format('DD/MM/YYYY')} đến ${end.format('DD/MM/YYYY')}`)
      console.log(`[DOANH THU] Khoảng thời gian: ${startDateObj.toISOString()} - ${endDateObj.toISOString()}`)

      if (start.isAfter(end)) {
        throw new ErrorWithStatus({
          message: 'Ngày bắt đầu phải trước ngày kết thúc',
          status: HTTP_STATUS_CODE.BAD_REQUEST
        })
      }

      const finishedSchedules = await databaseService.roomSchedule
        .find({
          status: RoomScheduleStatus.Finished,
          endTime: {
            $gte: startDateObj,
            $lte: endDateObj
          }
        })
        .toArray()

      console.log(`[DOANH THU] Tìm thấy ${finishedSchedules.length} lịch đã hoàn thành`)

      if (finishedSchedules.length === 0) {
        console.log('[DOANH THU] Không có lịch nào hoàn thành trong khoảng thời gian này')
        return {
          totalRevenue: 0,
          bills: [],
          startDate: startDateObj,
          endDate: endDateObj
        }
      }

      // CÁCH MỚI: Luôn tính lại hóa đơn cho mọi lịch
      const finalBills: IBill[] = []
      let totalRevenue = 0

      // Tìm kiếm hóa đơn đã lưu trong database
      console.log('[DOANH THU] Tìm kiếm hóa đơn đã lưu trong database...')
      const scheduleIds = finishedSchedules.map((schedule) => schedule._id)
      const savedBills = await databaseService.bills
        .find({
          scheduleId: { $in: scheduleIds }
        })
        .toArray()

      // Tạo map từ scheduleId đến bill đã lưu để tra cứu nhanh
      const savedBillMap = new Map<string, IBill>()
      for (const bill of savedBills) {
        const scheduleId = bill.scheduleId.toString()
        if (
          !savedBillMap.has(scheduleId) ||
          (bill.createdAt &&
            savedBillMap.get(scheduleId)!.createdAt &&
            new Date(bill.createdAt) > new Date(savedBillMap.get(scheduleId)!.createdAt))
        ) {
          savedBillMap.set(scheduleId, bill)
        }
      }

      console.log(`[DOANH THU] Có ${savedBillMap.size} lịch có hóa đơn đã lưu (sau khi lọc trùng lặp)`)

      for (const schedule of finishedSchedules) {
        try {
          console.log(`\n[DOANH THU] Xử lý hóa đơn cho lịch ${schedule._id}:`)

          // Lấy thông tin phòng
          const room = await databaseService.rooms.findOne({ _id: schedule.roomId })
          console.log(`- Phòng: ${room?.roomName || schedule.roomId}`)
          console.log(
            `- Thời gian: ${dayjs(ensureVNTimezone(schedule.startTime)).format('DD/MM HH:mm')} - ${dayjs(ensureVNTimezone(schedule.endTime)).format('DD/MM HH:mm')}`
          )

          let billToUse: IBill

          // Kiểm tra xem đã có hóa đơn lưu sẵn chưa
          if (savedBillMap.has(schedule._id.toString())) {
            billToUse = savedBillMap.get(schedule._id.toString())!
            console.log(`- Sử dụng hóa đơn đã lưu trong database, ID: ${billToUse._id}`)
          } else {
            // Tính lại hóa đơn dựa trên thông tin schedule
            console.log(`- Không tìm thấy hóa đơn đã lưu, đang tính toán lại...`)
            billToUse = await this.getBill(schedule._id.toString(), undefined, undefined, 'null', undefined)

            // Gán _id nếu cần
            if (!billToUse._id) {
              billToUse._id = new ObjectId()
            }
          }

          // Làm tròn tổng tiền xuống đến 1000 VND để đảm bảo nhất quán
          billToUse.totalAmount = Math.floor(billToUse.totalAmount / 1000) * 1000

          // Log chi tiết hóa đơn đã tính
          console.log(`- Hóa đơn được sử dụng:`)
          console.log(`  + Tổng tiền (đã làm tròn): ${billToUse.totalAmount.toLocaleString('vi-VN')} VND`)

          if (billToUse.items) {
            billToUse.items.forEach((item) => {
              console.log(
                `  + ${item.description}: ${item.quantity} x ${item.price.toLocaleString('vi-VN')} = ${(item.quantity * item.price).toLocaleString('vi-VN')} VND`
              )
            })
          }

          // Sử dụng hóa đơn đã tính toán
          finalBills.push(billToUse)
          totalRevenue += billToUse.totalAmount

          console.log(`- Đã thêm vào tổng doanh thu: ${billToUse.totalAmount.toLocaleString('vi-VN')} VND`)
          console.log(`- Tổng doanh thu hiện tại: ${totalRevenue.toLocaleString('vi-VN')} VND`)
        } catch (error) {
          console.error(`[DOANH THU] Lỗi khi xử lý hóa đơn cho lịch ${schedule._id}:`, error)
        }
      }

      console.log(`\n[DOANH THU] Tổng kết doanh thu từ ${start.format('DD/MM/YYYY')} đến ${end.format('DD/MM/YYYY')}:`)
      console.log(`- Số lượng hóa đơn: ${finalBills.length}`)
      console.log(`- Tổng doanh thu: ${totalRevenue.toLocaleString('vi-VN')} VND`)

      return {
        totalRevenue,
        bills: finalBills as any,
        startDate: startDateObj,
        endDate: endDateObj
      }
    } catch (error) {
      console.error('[DOANH THU] Lỗi khi tính doanh thu:', error)
      throw error
    }
  }

  /**
   * Tạo key duy nhất cho một hóa đơn dựa trên các thông tin chính
   * @private
   * @param bill - Hóa đơn cần tạo key
   * @returns key duy nhất cho hóa đơn
   */
  private getBillUniqueKey(bill: IBill): string {
    // Tạo hash string từ các mục trong hóa đơn
    const itemsHash = bill.items
      .map((item) => `${item.description}:${item.quantity}:${item.price}`)
      .sort()
      .join('|')

    return `${bill.scheduleId}-${bill.roomId}-${new Date(bill.startTime).getTime()}-${new Date(bill.endTime).getTime()}-${bill.totalAmount}-${itemsHash}`
  }

  /**
   * Dọn dẹp hóa đơn trùng lặp trong cơ sở dữ liệu
   * @param dateString Ngày cần dọn dẹp (ISO string)
   * @returns Số lượng hóa đơn trùng lặp đã xóa
   */
  async cleanDuplicateBills(dateString?: string): Promise<{
    removedCount: number
    beforeCount: number
    afterCount: number
  }> {
    try {
      let startDate: Date, endDate: Date

      if (dateString) {
        // Nếu có ngày cụ thể, chỉ xóa trong ngày đó
        const date = dayjs(dateString).tz('Asia/Ho_Chi_Minh')
        startDate = date.startOf('day').toDate()
        endDate = date.endOf('day').toDate()
      } else {
        // Mặc định, xóa tất cả hóa đơn trùng lặp (lấy ngày sớm nhất và muộn nhất)
        const earliestBill = await databaseService.bills.findOne({}, { sort: { createdAt: 1 } })
        const latestBill = await databaseService.bills.findOne({}, { sort: { createdAt: -1 } })

        if (!earliestBill || !latestBill) {
          return { removedCount: 0, beforeCount: 0, afterCount: 0 }
        }

        startDate = earliestBill.createdAt
        endDate = latestBill.createdAt
      }

      // Tìm tất cả hóa đơn trong khoảng thời gian
      const bills = await databaseService.bills
        .find({
          createdAt: {
            $gte: startDate,
            $lte: endDate
          }
        })
        .toArray()

      const beforeCount = bills.length
      console.log(`Tìm thấy ${beforeCount} hóa đơn trong khoảng thời gian từ ${startDate} đến ${endDate}`)

      if (bills.length === 0) {
        return { removedCount: 0, beforeCount: 0, afterCount: 0 }
      }

      // Nhóm hóa đơn theo key duy nhất
      const billGroups = new Map<string, IBill[]>()

      bills.forEach((bill) => {
        const key = this.getBillUniqueKey(bill)
        if (!billGroups.has(key)) {
          billGroups.set(key, [])
        }
        billGroups.get(key)!.push(bill)
      })

      // Tìm các hóa đơn trùng lặp (có hơn 1 hóa đơn với cùng key)
      const duplicateBillIds: ObjectId[] = []

      billGroups.forEach((group) => {
        if (group.length > 1) {
          // Sắp xếp theo createdAt để giữ lại hóa đơn mới nhất
          group.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

          // Lấy tất cả IDs ngoại trừ cái đầu tiên (mới nhất)
          const duplicateIds = group.slice(1).map((bill) => bill._id!)
          duplicateBillIds.push(...duplicateIds)
        }
      })

      console.log(`Tìm thấy ${duplicateBillIds.length} hóa đơn trùng lặp cần xóa`)

      // Xóa các hóa đơn trùng lặp
      if (duplicateBillIds.length > 0) {
        const result = await databaseService.bills.deleteMany({
          _id: { $in: duplicateBillIds }
        })

        const afterCount = beforeCount - result.deletedCount
        console.log(`Đã xóa ${result.deletedCount} hóa đơn trùng lặp`)

        return {
          removedCount: result.deletedCount,
          beforeCount,
          afterCount
        }
      }

      return {
        removedCount: 0,
        beforeCount,
        afterCount: beforeCount
      }
    } catch (error) {
      console.error('Lỗi khi dọn dẹp hóa đơn trùng lặp:', error)
      throw error
    }
  }

  /**
   * Dọn dẹp hóa đơn từ lịch đặt phòng chưa hoàn thành
   * @returns Kết quả dọn dẹp
   */
  async cleanUpNonFinishedBills(): Promise<{
    removedCount: number
    beforeCount: number
    afterCount: number
  }> {
    try {
      // Lấy tất cả hóa đơn
      const allBills = await databaseService.bills.find({}).toArray()
      const beforeCount = allBills.length
      console.log(`Tổng số hóa đơn hiện tại: ${beforeCount}`)

      // Lấy tất cả lịch đặt phòng đã hoàn thành
      const finishedSchedules = await databaseService.roomSchedule
        .find({
          status: RoomScheduleStatus.Finished
        })
        .toArray()

      // Tạo map của các ID lịch đã hoàn thành để tra cứu nhanh
      const finishedScheduleIds = new Set(finishedSchedules.map((schedule) => schedule._id.toString()))
      console.log(`Số lượng lịch đặt phòng đã hoàn thành: ${finishedScheduleIds.size}`)

      // Tìm các hóa đơn từ lịch chưa hoàn thành
      const billsToRemove = allBills.filter((bill) => !finishedScheduleIds.has(bill.scheduleId.toString()))
      console.log(`Số lượng hóa đơn thuộc về lịch chưa hoàn thành: ${billsToRemove.length}`)

      if (billsToRemove.length === 0) {
        return {
          removedCount: 0,
          beforeCount,
          afterCount: beforeCount
        }
      }

      // Lấy các ID hóa đơn cần xóa
      const billIdsToRemove = billsToRemove.map((bill) => bill._id)

      // Xóa các hóa đơn thuộc về lịch chưa hoàn thành
      const result = await databaseService.bills.deleteMany({
        _id: { $in: billIdsToRemove }
      })

      const afterCount = beforeCount - result.deletedCount
      console.log(`Đã xóa ${result.deletedCount} hóa đơn thuộc về lịch chưa hoàn thành`)

      return {
        removedCount: result.deletedCount,
        beforeCount,
        afterCount
      }
    } catch (error) {
      console.error('Lỗi khi dọn dẹp hóa đơn từ lịch chưa hoàn thành:', error)
      throw error
    }
  }
}

const billService = new BillService()
export default billService
