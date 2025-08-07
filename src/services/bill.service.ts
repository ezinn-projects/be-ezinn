import axios from 'axios'
import dayjs from 'dayjs'
import isBetween from 'dayjs/plugin/isBetween'
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import iconv from 'iconv-lite'
import { ObjectId } from 'mongodb'
import { DayType, RoomScheduleStatus } from '~/constants/enum'
import { HTTP_STATUS_CODE } from '~/constants/httpStatus'
import { ErrorWithStatus } from '~/models/Error'
import { IBill } from '~/models/schemas/Bill.schema'
import databaseService from './database.service'
import fnbMenuItemService from './fnbMenuItem.service'
import fnbOrderService from './fnbOrder.service'
import { holidayService } from './holiday.service'

// Cấu hình timezone và plugins cho dayjs
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(isBetween)
dayjs.extend(isSameOrBefore)
dayjs.tz.setDefault('Asia/Ho_Chi_Minh')

// Ensure all date objects are using the correct timezone
function ensureVNTimezone(date: Date | string | null | undefined): Date {
  if (!date) {
    // Return current date as fallback if date is null or undefined
    return dayjs().tz('Asia/Ho_Chi_Minh').toDate()
  }

  // FIX: Luôn xử lý như UTC nếu có 'Z' trong string hoặc là Date object
  const dateStr = String(date)
  if (dateStr.includes('Z') || date instanceof Date) {
    // Nếu là UTC string hoặc Date object, parse như UTC rồi chuyển về VN time
    return dayjs.utc(date).tz('Asia/Ho_Chi_Minh').toDate()
  }

  // Nếu không phải UTC, sử dụng timezone hiện tại
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

// TextPrinter class để giả lập printer
class TextPrinter {
  private content: string[] = []
  private currentAlign: 'lt' | 'ct' | 'rt' = 'lt'
  private currentStyle: 'normal' | 'b' | 'i' = 'normal'
  private currentSize: [number, number] = [0, 0]
  private readonly PAPER_WIDTH = 48 // Độ rộng chuẩn cho giấy 80mm

  constructor() {}

  font(_: string) {
    return this
  }

  align(alignment: 'lt' | 'ct' | 'rt') {
    this.currentAlign = alignment
    return this
  }

  style(style: 'normal' | 'b' | 'i') {
    this.currentStyle = style
    return this
  }

  size(width: number, height: number) {
    this.currentSize = [width, height]
    return this
  }

  text(str: string) {
    let line = str

    // Nếu là dòng gạch ngang, chuẩn hóa độ dài
    if (/^-+$/.test(line)) {
      line = '-'.repeat(this.PAPER_WIDTH)
    } else {
      // Cắt chuỗi nếu dài hơn độ rộng giấy
      if (line.length > this.PAPER_WIDTH) {
        line = line.substring(0, this.PAPER_WIDTH)
      }

      // Xử lý căn lề
      if (this.currentAlign === 'ct') {
        // Tính toán padding trái và phải để căn giữa chính xác
        const totalPadding = this.PAPER_WIDTH - line.length
        const leftPadding = Math.floor(totalPadding / 2)
        const rightPadding = totalPadding - leftPadding
        line = ' '.repeat(leftPadding) + line + ' '.repeat(rightPadding)
      } else if (this.currentAlign === 'rt') {
        line = line.padStart(this.PAPER_WIDTH)
      } else {
        // Căn trái (lt)
        line = line.padEnd(this.PAPER_WIDTH)
      }
    }

    this.content.push(line)
    return this
  }

  feed(lines: number) {
    for (let i = 0; i < lines; i++) {
      this.content.push('')
    }
    return this
  }

  tableCustom(data: Array<{ text: string; width: number; align: string }>) {
    let line = ''
    let currentWidth = 0

    data.forEach((col, index) => {
      const isLastColumn = index === data.length - 1
      const colWidth = isLastColumn ? this.PAPER_WIDTH - currentWidth : Math.floor(this.PAPER_WIDTH * col.width)

      currentWidth += colWidth
      let text = col.text

      // Chỉ cắt text nếu không phải là phí dịch vụ thu âm
      if (text.length > colWidth && !text.includes('Phi dich vu thu am')) {
        text = text.substring(0, colWidth - 3) + '...'
      }

      // Nếu là phí dịch vụ thu âm và quá dài, tạo dòng mới
      if (text.includes('Phi dich vu thu am') && text.length > colWidth) {
        // Xử lý sau trong phần in chi tiết
        text = text
      }

      // Căn lề cho từng cột
      if (col.align === 'right') {
        text = text.padStart(colWidth)
      } else if (col.align === 'center') {
        const padding = Math.floor((colWidth - text.length) / 2)
        text = ' '.repeat(padding) + text.padEnd(colWidth - padding)
      } else {
        text = text.padEnd(colWidth)
      }

      line += text
    })

    // Đảm bảo dòng không vượt quá độ rộng giấy
    if (line.length > this.PAPER_WIDTH) {
      // Nếu dòng chứa phí dịch vụ thu âm, giữ nguyên
      if (!line.includes('Phi dich vu thu am')) {
        line = line.substring(0, this.PAPER_WIDTH)
      }
    }

    this.content.push(line)
    return this
  }

  getText(): string {
    return this.content.join('\n') + '\n'
  }
}

export class BillService {
  private deviceData: any // Lưu thông tin thiết bị USB được tìm thấy
  private transactionHistory: Array<IBill> = [] // Lưu lịch sử giao dịch
  private printer: any
  private lastPrintTime: number = 0 // Thời gian in lần cuối
  private printQueue: Array<() => Promise<any>> = [] // Queue để tránh conflict
  private isPrinting: boolean = false // Flag đang in

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
   * Calculate hours between two dates based only on hours and minutes, ignoring seconds and milliseconds
   * @param start Start date
   * @param end End date
   * @returns Number of hours
   */
  calculateHours(start: Date | string, end: Date | string): number {
    // Chuyển đổi thời gian về múi giờ Việt Nam và reset seconds/milliseconds
    const startDate = dayjs(start).tz('Asia/Ho_Chi_Minh').second(0).millisecond(0)
    const endDate = dayjs(end).tz('Asia/Ho_Chi_Minh').second(0).millisecond(0)

    // Check if end date is before start date, which would produce negative values
    if (endDate.isBefore(startDate)) {
      console.warn(`Warning: End date (${endDate.format()}) is before start date (${startDate.format()})`)
      // Return a small positive value to avoid negative calculations
      return 0.5
    }

    // Calculate difference in minutes only (ignoring seconds and milliseconds)
    const diffMinutes = endDate.diff(startDate, 'minute')
    // Convert to hours with 2 decimal places
    const diffHours = diffMinutes / 60

    console.log(`Time calculation in VN timezone:`)
    console.log(`Start time: ${startDate.format('YYYY-MM-DD HH:mm')}`)
    console.log(`End time: ${endDate.format('YYYY-MM-DD HH:mm')}`)
    console.log(`Difference in minutes: ${diffMinutes} minutes`)
    console.log(`Calculated hours: ${diffHours} hours`)

    // Round to 2 decimal places for consistency
    const result = Math.round(diffHours * 100) / 100
    console.log(`Final result: ${result} hours`)

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
    const time = dayjs(startTime).tz('Asia/Ho_Chi_Minh').format('HH:mm')
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
    // Validate ObjectId format for scheduleId
    if (!ObjectId.isValid(scheduleId)) {
      throw new ErrorWithStatus({
        message: 'Invalid scheduleId format - must be a valid 24 character hex string',
        status: HTTP_STATUS_CODE.BAD_REQUEST
      })
    }

    const id = new ObjectId(scheduleId)
    const schedule = await databaseService.roomSchedule.findOne({ _id: id })

    // Lấy FNB orders từ collection hiện tại trước
    console.log('=== LẤY FNB ORDERS TỪ COLLECTION HIỆN TẠI ===')
    console.log('ScheduleId:', scheduleId)

    const currentOrders = await fnbOrderService.getFnbOrdersByRoomSchedule(scheduleId)
    console.log('Số lượng orders hiện tại tìm thấy:', currentOrders.length)

    let order = null
    if (currentOrders.length > 0) {
      order = currentOrders[currentOrders.length - 1] // Lấy order mới nhất
      console.log('=== ORDER HIỆN TẠI ĐƯỢC TÌM THẤY ===')
      console.log('Order ID:', order._id)
      console.log('RoomScheduleId:', order.roomScheduleId)
      console.log('Order data:', JSON.stringify(order.order, null, 2))
      console.log('Drinks:', order.order?.drinks)
      console.log('Snacks:', order.order?.snacks)
    } else {
      console.log('=== KHÔNG TÌM THẤY ORDER HIỆN TẠI ===')

      // Thử lấy từ history nếu không có order hiện tại
      const orderHistory = await fnbOrderService.getOrderHistoryByRoomSchedule(scheduleId)
      console.log('Số lượng order history tìm thấy:', orderHistory.length)

      if (orderHistory.length > 0) {
        order = orderHistory[orderHistory.length - 1]
        console.log('=== ORDER TỪ HISTORY ĐƯỢC TÌM THẤY ===')
        console.log('Order ID:', order._id)
        console.log('Completed at:', (order as any).completedAt)
      }
    }

    const room = await databaseService.rooms.findOne({ _id: schedule?.roomId })
    const menu = await databaseService.fnbMenu.find({}).toArray()

    if (!schedule) {
      throw new ErrorWithStatus({
        message: 'Không tìm thấy lịch đặt phòng',
        status: HTTP_STATUS_CODE.NOT_FOUND
      })
    }
    const dayType = await this.determineDayType(dayjs.utc(schedule.startTime).tz('Asia/Ho_Chi_Minh').toDate())

    // Xử lý actualStartTime nếu được cung cấp
    let validatedStartTime: Date
    if (actualStartTime) {
      console.log('actualStartTime:', actualStartTime)

      if (/^\d{2}:\d{2}$/.test(actualStartTime)) {
        // Nếu là định dạng HH:mm
        const [hours, minutes] = actualStartTime.split(':')
        // Sử dụng schedule.startTime đã được xử lý múi giờ đúng
        const baseDate = dayjs.utc(schedule.startTime).tz('Asia/Ho_Chi_Minh')
        validatedStartTime = baseDate.hour(parseInt(hours)).minute(parseInt(minutes)).second(0).millisecond(0).toDate()
        console.log('Validated start time:', dayjs(validatedStartTime).format('YYYY-MM-DD HH:mm:ss'))
      } else {
        // Nếu là định dạng datetime đầy đủ - reset giây và millisecond về 0
        validatedStartTime = dayjs(actualStartTime).tz('Asia/Ho_Chi_Minh').second(0).millisecond(0).toDate()

        if (!dayjs(validatedStartTime).isValid()) {
          throw new ErrorWithStatus({
            message: 'Thời gian bắt đầu không hợp lệ',
            status: HTTP_STATUS_CODE.BAD_REQUEST
          })
        }
        console.log('Validated start time (from datetime):', dayjs(validatedStartTime).format('YYYY-MM-DD HH:mm:ss'))
      }
    } else {
      // Nếu không có actualStartTime, sử dụng schedule.startTime và reset giây/millisecond
      // FIX: Luôn xử lý thời gian từ DB như UTC và chuyển về VN time
      const rawStartTime = schedule.startTime
      console.log('Raw startTime from DB:', rawStartTime)

      // Luôn xử lý như UTC vì thời gian từ DB luôn là UTC
      // FIXED: Trước đây có thể xử lý sai múi giờ trong production
      const processedStartTime = dayjs.utc(rawStartTime).tz('Asia/Ho_Chi_Minh').toDate()
      console.log(
        'Processed startTime (UTC -> VN):',
        dayjs(processedStartTime).tz('Asia/Ho_Chi_Minh').format('YYYY-MM-DD HH:mm:ss')
      )

      validatedStartTime = dayjs(processedStartTime).second(0).millisecond(0).toDate()
    }

    // Convert times to Vietnam timezone
    const startTime = validatedStartTime

    // Kiểm tra và xử lý actualEndTime
    let validatedEndTime: Date
    console.log('actualEndTime:', actualEndTime)

    if (actualEndTime && /^\d{2}:\d{2}$/.test(actualEndTime)) {
      // Nếu là định dạng HH:mm
      const [hours, minutes] = actualEndTime.split(':')
      validatedEndTime = dayjs(startTime)
        .hour(parseInt(hours))
        .minute(parseInt(minutes))
        .second(0)
        .millisecond(0)
        .toDate()

      // Kiểm tra nếu actualEndTime trước startTime (chỉ tính giờ và phút)
      if (!this.compareTimeIgnoreSeconds(validatedEndTime, startTime)) {
        console.warn(
          `Warning: Actual end time (${actualEndTime}) is before start time (${dayjs(startTime).format('HH:mm')}) - comparing only hours and minutes`
        )
        console.warn(`Start time: ${dayjs(startTime).format('YYYY-MM-DD HH:mm:ss')}`)
        console.warn(`End time: ${dayjs(validatedEndTime).format('YYYY-MM-DD HH:mm:ss')}`)
        // Đặt giá trị mặc định là startTime + 1 giờ
        validatedEndTime = dayjs(startTime).add(1, 'hour').second(0).millisecond(0).toDate()
        console.warn(`Adjusted end time: ${dayjs(validatedEndTime).format('YYYY-MM-DD HH:mm:ss')}`)
      }

      console.log('Validated end time:', dayjs(validatedEndTime).format('YYYY-MM-DD HH:mm:ss'))
    } else if (actualEndTime) {
      // Nếu là định dạng datetime đầy đủ - reset giây và millisecond về 0
      validatedEndTime = dayjs(actualEndTime).tz('Asia/Ho_Chi_Minh').second(0).millisecond(0).toDate()

      if (!dayjs(validatedEndTime).isValid()) {
        throw new ErrorWithStatus({
          message: 'Thời gian kết thúc không hợp lệ',
          status: HTTP_STATUS_CODE.BAD_REQUEST
        })
      }
      console.log('Validated end time (from datetime):', dayjs(validatedEndTime).format('YYYY-MM-DD HH:mm:ss'))
    } else {
      // Nếu không có actualEndTime, sử dụng schedule.endTime và reset giây/millisecond
      if (schedule.endTime) {
        // FIX: Luôn xử lý thời gian từ DB như UTC và chuyển về VN time
        const rawEndTime = schedule.endTime
        console.log('Raw endTime from DB:', rawEndTime)

        // Luôn xử lý như UTC vì thời gian từ DB luôn là UTC
        // FIXED: Trước đây có thể xử lý sai múi giờ trong production
        const processedEndTime = dayjs.utc(rawEndTime).tz('Asia/Ho_Chi_Minh').toDate()
        console.log(
          'Processed endTime (UTC -> VN):',
          dayjs(processedEndTime).tz('Asia/Ho_Chi_Minh').format('YYYY-MM-DD HH:mm:ss')
        )

        validatedEndTime = dayjs(processedEndTime).second(0).millisecond(0).toDate()
      } else {
        // Nếu không có endTime, mặc định là startTime + 1 giờ
        validatedEndTime = dayjs(startTime).add(1, 'hour').second(0).millisecond(0).toDate()
      }
    }

    // Debug log cho endTime
    console.log('Validated endTime (VN):', dayjs(validatedEndTime).tz('Asia/Ho_Chi_Minh').format('YYYY-MM-DD HH:mm:ss'))

    // Debug log để kiểm tra thời gian
    console.log('=== DEBUG THỜI GIAN ===')
    console.log('Schedule startTime (raw):', schedule.startTime)
    console.log('Schedule endTime (raw):', schedule.endTime)
    console.log('Schedule startTime (as UTC):', dayjs.utc(schedule.startTime).format('YYYY-MM-DD HH:mm:ss'))
    console.log(
      'Schedule startTime (as VN):',
      dayjs.utc(schedule.startTime).tz('Asia/Ho_Chi_Minh').format('YYYY-MM-DD HH:mm:ss')
    )
    console.log('Validated startTime (VN):', dayjs(startTime).tz('Asia/Ho_Chi_Minh').format('YYYY-MM-DD HH:mm:ss'))
    console.log('Validated endTime (VN):', dayjs(validatedEndTime).tz('Asia/Ho_Chi_Minh').format('YYYY-MM-DD HH:mm:ss'))
    console.log('Current server time (VN):', dayjs().tz('Asia/Ho_Chi_Minh').format('YYYY-MM-DD HH:mm:ss'))
    console.log('Current server time (UTC):', dayjs().utc().format('YYYY-MM-DD HH:mm:ss'))
    console.log('========================')

    console.log('========================')

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
    const bookingDate = dayjs(startTime).tz('Asia/Ho_Chi_Minh').format('YYYY-MM-DD')

    for (const slot of sortedTimeSlots) {
      // Tạo thời gian bắt đầu và kết thúc của khung giờ
      const slotStartTime = dayjs.tz(`${bookingDate} ${slot.start}`, 'YYYY-MM-DD HH:mm', 'Asia/Ho_Chi_Minh')
      let slotEndTime

      // Xử lý khung giờ qua ngày
      if (slot.start > slot.end) {
        slotEndTime = dayjs.tz(`${bookingDate} ${slot.end}`, 'YYYY-MM-DD HH:mm', 'Asia/Ho_Chi_Minh').add(1, 'day')
      } else {
        slotEndTime = dayjs.tz(`${bookingDate} ${slot.end}`, 'YYYY-MM-DD HH:mm', 'Asia/Ho_Chi_Minh')
      }

      timeSlotBoundaries.push({
        start: slotStartTime.toDate(),
        end: slotEndTime.toDate(),
        prices: slot.prices
      })
    }

    // Kiểm tra và tính toán giờ sử dụng trong từng khung giờ
    const transitionTime = '18:00' // Thời điểm chuyển tiếp giữa các khung giờ
    const sessionStartVN = dayjs(startTime).tz('Asia/Ho_Chi_Minh')
    const sessionEndVN = dayjs(validatedEndTime).tz('Asia/Ho_Chi_Minh')
    const transitionPoint = dayjs.tz(
      `${sessionStartVN.format('YYYY-MM-DD')} ${transitionTime}`,
      'YYYY-MM-DD HH:mm',
      'Asia/Ho_Chi_Minh'
    )

    // Debug log cho tính toán khung giờ
    console.log('=== TÍNH TOÁN KHUNG GIỜ ===')
    console.log('Session start (VN):', sessionStartVN.format('YYYY-MM-DD HH:mm:ss'))
    console.log('Session end (VN):', sessionEndVN.format('YYYY-MM-DD HH:mm:ss'))
    console.log('Transition point (18:00):', transitionPoint.format('YYYY-MM-DD HH:mm:ss'))
    console.log('Is before transition?', sessionStartVN.isBefore(transitionPoint))
    console.log('Is after transition?', sessionEndVN.isAfter(transitionPoint))
    console.log('Session duration (hours):', sessionEndVN.diff(sessionStartVN, 'hour', true))
    console.log('==========================')

    // Kiểm tra xem phiên có kéo dài qua điểm chuyển tiếp không
    if (sessionStartVN.isBefore(transitionPoint) && sessionEndVN.isAfter(transitionPoint)) {
      // Tính toán cho khoảng thời gian trước 18:00
      const hoursBeforeTransition = this.calculateHours(sessionStartVN.toDate(), transitionPoint.toDate())
      console.log(`Tính toán giờ trước 18h: ${hoursBeforeTransition} giờ`)
      if (hoursBeforeTransition > 0) {
        // Tìm giá cho khung giờ trước 18:00
        const beforePrice = sortedTimeSlots.find((slot) => {
          const slotStart = dayjs.tz(
            `${sessionStartVN.format('YYYY-MM-DD')} ${slot.start}`,
            'YYYY-MM-DD HH:mm',
            'Asia/Ho_Chi_Minh'
          )
          const slotEnd = dayjs.tz(
            `${sessionStartVN.format('YYYY-MM-DD')} ${slot.end}`,
            'YYYY-MM-DD HH:mm',
            'Asia/Ho_Chi_Minh'
          )
          return sessionStartVN.isBetween(slotStart, slotEnd, null, '[)')
        })

        if (beforePrice) {
          const priceEntry = beforePrice.prices.find((p: any) => p.room_type === room?.roomType)
          if (priceEntry) {
            const slotServiceFee = Math.floor((hoursBeforeTransition * priceEntry.price) / 1000) * 1000
            totalServiceFee += slotServiceFee
            totalHoursUsed += hoursBeforeTransition

            timeSlotItems.push({
              description: `Phi dich vu thu am (${sessionStartVN.format('HH:mm')}-${transitionPoint.format('HH:mm')})`,
              quantity: parseFloat(hoursBeforeTransition.toFixed(2)),
              price: priceEntry.price,
              totalPrice: slotServiceFee
            })

            console.log(
              `Tính giờ cho khung trước 18h: ${sessionStartVN.format('HH:mm')}-${transitionPoint.format('HH:mm')}:`
            )
            console.log(`- Số giờ: ${hoursBeforeTransition}`)
            console.log(`- Đơn giá: ${priceEntry.price}`)
            console.log(`- Thành tiền: ${slotServiceFee}`)
          }
        }
      }

      // Tính toán cho khoảng thời gian sau 18:00
      const hoursAfterTransition = this.calculateHours(transitionPoint.toDate(), sessionEndVN.toDate())
      console.log(`Tính toán giờ sau 18h: ${hoursAfterTransition} giờ`)
      if (hoursAfterTransition > 0) {
        // Tìm giá cho khung giờ sau 18:00
        const afterPrice = sortedTimeSlots.find((slot) => {
          const slotStart = dayjs.tz(
            `${sessionStartVN.format('YYYY-MM-DD')} ${slot.start}`,
            'YYYY-MM-DD HH:mm',
            'Asia/Ho_Chi_Minh'
          )
          const slotEnd =
            slot.start > slot.end
              ? dayjs
                  .tz(`${sessionStartVN.format('YYYY-MM-DD')} ${slot.end}`, 'YYYY-MM-DD HH:mm', 'Asia/Ho_Chi_Minh')
                  .add(1, 'day')
              : dayjs.tz(`${sessionStartVN.format('YYYY-MM-DD')} ${slot.end}`, 'YYYY-MM-DD HH:mm', 'Asia/Ho_Chi_Minh')
          return transitionPoint.isBetween(slotStart, slotEnd, null, '[)')
        })

        if (afterPrice) {
          const priceEntry = afterPrice.prices.find((p: any) => p.room_type === room?.roomType)
          if (priceEntry) {
            const slotServiceFee = Math.floor((hoursAfterTransition * priceEntry.price) / 1000) * 1000
            totalServiceFee += slotServiceFee
            totalHoursUsed += hoursAfterTransition

            timeSlotItems.push({
              description: `Phi dich vu thu am (${transitionPoint.format('HH:mm')}-${sessionEndVN.format('HH:mm')})`,
              quantity: parseFloat(hoursAfterTransition.toFixed(2)),
              price: priceEntry.price,
              totalPrice: slotServiceFee
            })

            console.log(
              `Tính giờ cho khung sau 18h: ${transitionPoint.format('HH:mm')}-${sessionEndVN.format('HH:mm')}:`
            )
            console.log(`- Số giờ: ${hoursAfterTransition}`)
            console.log(`- Đơn giá: ${priceEntry.price}`)
            console.log(`- Thành tiền: ${slotServiceFee}`)
          }
        }
      }

      // Kiểm tra nếu cả hai khoảng thời gian đều = 0
      if (hoursBeforeTransition <= 0 && hoursAfterTransition <= 0) {
        console.log(
          `Không tính phí dịch vụ vì tổng thời gian sử dụng = ${hoursBeforeTransition + hoursAfterTransition} giờ`
        )
      }
    } else {
      // Nếu không kéo dài qua điểm chuyển tiếp, tính toán bình thường
      const hoursInSlot = this.calculateHours(sessionStartVN.toDate(), sessionEndVN.toDate())
      console.log(`Tính toán giờ sử dụng: ${hoursInSlot} giờ`)

      if (hoursInSlot > 0) {
        // Tìm khung giờ phù hợp
        const timeSlot = sortedTimeSlots.find((slot) => {
          const slotStart = dayjs.tz(
            `${sessionStartVN.format('YYYY-MM-DD')} ${slot.start}`,
            'YYYY-MM-DD HH:mm',
            'Asia/Ho_Chi_Minh'
          )
          const slotEnd =
            slot.start > slot.end
              ? dayjs
                  .tz(`${sessionStartVN.format('YYYY-MM-DD')} ${slot.end}`, 'YYYY-MM-DD HH:mm', 'Asia/Ho_Chi_Minh')
                  .add(1, 'day')
              : dayjs.tz(`${sessionStartVN.format('YYYY-MM-DD')} ${slot.end}`, 'YYYY-MM-DD HH:mm', 'Asia/Ho_Chi_Minh')
          return sessionStartVN.isBetween(slotStart, slotEnd, null, '[)')
        })

        if (timeSlot) {
          const priceEntry = timeSlot.prices.find((p: any) => p.room_type === room?.roomType)
          if (priceEntry) {
            const slotServiceFee = Math.floor((hoursInSlot * priceEntry.price) / 1000) * 1000
            totalServiceFee += slotServiceFee
            totalHoursUsed += hoursInSlot

            timeSlotItems.push({
              description: `Phi dich vu thu am (${sessionStartVN.format('HH:mm')}-${sessionEndVN.format('HH:mm')})`,
              quantity: parseFloat(hoursInSlot.toFixed(2)),
              price: priceEntry.price,
              totalPrice: slotServiceFee
            })

            console.log(`Tính giờ cho khung ${sessionStartVN.format('HH:mm')}-${sessionEndVN.format('HH:mm')}:`)
            console.log(`- Số giờ: ${hoursInSlot}`)
            console.log(`- Đơn giá: ${priceEntry.price}`)
            console.log(`- Thành tiền: ${slotServiceFee}`)
          }
        }
      } else {
        console.log(`Không tính phí dịch vụ vì thời gian sử dụng = ${hoursInSlot} giờ`)
      }
    }

    // Xử lý các đơn hàng F&B từ menu động
    const items = [...timeSlotItems] as Array<{
      description: string
      quantity: number
      price: number
      totalPrice: number
      originalPrice?: number
      discountPercentage?: number
      discountName?: string
    }>

    console.log(`Tổng số items từ timeSlotItems: ${timeSlotItems.length}`)
    timeSlotItems.forEach((item, index) => {
      console.log(`Item ${index + 1}: ${item.description} - ${item.quantity} giờ - ${item.price} VND`)
    })

    // Debug log để kiểm tra FNB orders
    console.log('=== DEBUG FNB ORDERS ===')
    console.log('Order từ history:', order)
    if (order) {
      console.log('Order structure:', JSON.stringify(order, null, 2))
      console.log('Order.order:', order.order)
      if (order.order) {
        console.log('Order.order.drinks:', order.order.drinks)
        console.log('Order.order.snacks:', order.order.snacks)
        console.log('Type of order.order.drinks:', typeof order.order.drinks)
        console.log('Type of order.order.snacks:', typeof order.order.snacks)
        console.log('Is drinks object?', order.order.drinks && typeof order.order.drinks === 'object')
        console.log('Is snacks object?', order.order.snacks && typeof order.order.snacks === 'object')
      }
    }
    console.log('Số lượng menu items:', menu.length)
    console.log(
      'Menu items:',
      menu.map((m) => ({ id: m._id, name: m.name, price: m.price }))
    )
    console.log('========================')

    // Thêm các mục F&B từ order vào items nếu có
    if (order && order.order) {
      console.log('=== XỬ LÝ FNB ITEMS ===')
      console.log('Order found:', !!order)
      console.log('Order.order exists:', !!order.order)
      console.log('Menu items count:', menu.length)

      // Xử lý đồ uống
      if (order.order.drinks && typeof order.order.drinks === 'object' && Object.keys(order.order.drinks).length > 0) {
        console.log('Xử lý đồ uống...')
        console.log('Drinks object:', JSON.stringify(order.order.drinks, null, 2))
        for (const [menuId, quantity] of Object.entries(order.order.drinks)) {
          console.log(`Tìm menu item với ID: ${menuId}, quantity: ${quantity}`)

          // Sử dụng hàm helper để tìm menu item
          const menuItem = await this.findMenuItemById(menuId, menu)

          if (menuItem) {
            console.log(`Tìm thấy menu item: ${menuItem.name}, price: ${menuItem.price}`)

            // Đảm bảo price là number và được xử lý đúng định dạng
            const price = this.parsePrice(menuItem.price)
            console.log(`Parsed price: ${price}`)
            if (price === 0) {
              console.error(`Invalid price for menu item ${menuItem.name}: ${menuItem.price}`)
              continue
            }
            const totalPrice = Math.floor((quantity * price) / 1000) * 1000
            console.log(
              `Thêm item: ${menuItem.name}, quantity: ${quantity}, price: ${price}, totalPrice: ${totalPrice}`
            )
            items.push({
              description: menuItem.name,
              quantity: quantity,
              price: price,
              totalPrice: totalPrice
            })
          } else {
            console.log(`KHÔNG TÌM THẤY menu item với ID: ${menuId}`)
            console.log(
              'Available menu IDs:',
              menu.map((m) => m._id.toString())
            )
          }
        }
      } else {
        console.log('Không có đồ uống trong order hoặc cấu trúc không đúng')
        console.log('Drinks object:', order.order.drinks)
      }

      // Xử lý đồ ăn
      if (order.order.snacks && typeof order.order.snacks === 'object' && Object.keys(order.order.snacks).length > 0) {
        console.log('Xử lý đồ ăn...')
        console.log('Snacks object:', JSON.stringify(order.order.snacks, null, 2))
        for (const [menuId, quantity] of Object.entries(order.order.snacks)) {
          console.log(`Tìm menu item với ID: ${menuId}, quantity: ${quantity}`)

          // Sử dụng hàm helper để tìm menu item
          const menuItem = await this.findMenuItemById(menuId, menu)

          if (menuItem) {
            console.log(`Tìm thấy menu item: ${menuItem.name}, price: ${menuItem.price}`)

            // Đảm bảo price là number và được xử lý đúng định dạng
            const price = this.parsePrice(menuItem.price)
            console.log(`Parsed price: ${price}`)
            if (price === 0) {
              console.error(`Invalid price for menu item ${menuItem.name}: ${menuItem.price}`)
              continue
            }
            const totalPrice = Math.floor((quantity * price) / 1000) * 1000
            console.log(
              `Thêm item: ${menuItem.name}, quantity: ${quantity}, price: ${price}, totalPrice: ${totalPrice}`
            )
            items.push({
              description: menuItem.name,
              quantity: quantity,
              price: price,
              totalPrice: totalPrice
            })
          } else {
            console.log(`KHÔNG TÌM THẤY menu item với ID: ${menuId}`)
            console.log(
              'Available menu IDs:',
              menu.map((m) => m._id.toString())
            )
          }
        }
      } else {
        console.log('Không có đồ ăn trong order hoặc cấu trúc không đúng')
        console.log('Snacks object:', order.order.snacks)
      }
      console.log('=== KẾT THÚC XỬ LÝ FNB ITEMS ===')
      console.log('Tổng số items sau khi xử lý FNB:', items.length)
    } else {
      console.log('Không có order hoặc order.order không tồn tại')
      console.log('Order object:', order)
    }

    // Lấy thông tin promotion nếu có promotionId
    let activePromotion = undefined
    if (promotionId) {
      console.log('Tìm promotion với ID:', promotionId)
      const promotion = await databaseService.promotions.findOne({ _id: new ObjectId(promotionId) })
      if (promotion) {
        activePromotion = promotion
        console.log('Tìm thấy promotion:', promotion.name, 'discount:', promotion.discountPercentage + '%')
      } else {
        console.log('Không tìm thấy promotion với ID:', promotionId)
      }
    } else {
      console.log('Không có promotionId được truyền')
    }

    // Áp dụng khuyến mãi nếu có
    let shouldApplyPromotion = false
    if (activePromotion) {
      console.log('Áp dụng khuyến mãi:', activePromotion.name)
      console.log('Promotion appliesTo:', activePromotion.appliesTo)
      console.log('Room ID:', room?._id)

      // Kiểm tra xem promotion có áp dụng cho phòng này không
      const appliesTo = Array.isArray(activePromotion.appliesTo)
        ? activePromotion.appliesTo[0]?.toLowerCase()
        : activePromotion.appliesTo?.toLowerCase()

      // For all items
      if (appliesTo === 'all') {
        console.log('Áp dụng promotion cho tất cả items')
        shouldApplyPromotion = true
      }
      // For specific room
      else if (appliesTo === 'room' && room?._id) {
        const appliesToRooms = Array.isArray(activePromotion.appliesTo)
          ? activePromotion.appliesTo
          : [activePromotion.appliesTo]

        const roomIdStr = room._id.toString()
        shouldApplyPromotion = appliesToRooms.some((room) => room === roomIdStr)
        console.log('Áp dụng promotion cho phòng cụ thể:', shouldApplyPromotion)
      }
      // For specific room type
      else if (appliesTo === 'room_type' && room?.roomType) {
        const appliesToRoomTypes = Array.isArray(activePromotion.appliesTo)
          ? activePromotion.appliesTo
          : [activePromotion.appliesTo]

        const roomTypeIdStr = room.roomType.toString()
        shouldApplyPromotion = appliesToRoomTypes.some((type) => type === roomTypeIdStr)
        console.log('Áp dụng promotion cho loại phòng:', shouldApplyPromotion)
      }

      if (shouldApplyPromotion) {
        // Thêm thông tin promotion vào từng item để hiển thị
        for (let i = 0; i < items.length; i++) {
          items[i].discountPercentage = activePromotion.discountPercentage
          items[i].discountName = activePromotion.name
        }
        console.log(`Đã áp dụng promotion ${activePromotion.discountPercentage}% cho tất cả items`)
      } else {
        console.log('Promotion không áp dụng cho phòng này')
      }
    }

    console.log(`Tổng số items cuối cùng: ${items.length}`)
    items.forEach((item, index) => {
      console.log(`Final Item ${index + 1}: ${item.description} - ${item.quantity} - ${item.price} VND`)
    })

    // Tính tổng tiền từ các mục đã được làm tròn
    // --- SỬA ĐOẠN NÀY: TÍNH SUBTOTAL, DISCOUNT, TOTALAMOUNT ---
    let subtotal = items.reduce((acc, item) => {
      return acc + item.totalPrice
    }, 0)

    let discountAmount = 0
    if (activePromotion && shouldApplyPromotion) {
      discountAmount = Math.floor((subtotal * activePromotion.discountPercentage) / 100)
      console.log(`Subtotal: ${subtotal.toLocaleString('vi-VN')} VND`)
      console.log(`Discount ${activePromotion.discountPercentage}%: ${discountAmount.toLocaleString('vi-VN')} VND`)
    }

    const totalAmount = Math.floor((subtotal - discountAmount) / 1000) * 1000
    console.log(`Total after discount: ${totalAmount.toLocaleString('vi-VN')} VND`)

    const bill: IBill = {
      scheduleId: schedule._id,
      roomId: schedule.roomId,
      startTime: startTime, // Sử dụng startTime đã điều chỉnh
      endTime: validatedEndTime,
      createdAt: schedule.createdAt,
      note: schedule.note,
      items: items.map((item) => ({
        description: item.description,
        price: item.price,
        quantity: typeof item.quantity === 'number' ? parseFloat(item.quantity.toFixed(2)) : item.quantity, // Đảm bảo hiển thị đúng 2 chữ số thập phân
        discountPercentage: item.discountPercentage,
        discountName: item.discountName
      })),
      totalAmount, // ĐÃ SỬA: tổng tiền đã trừ discount
      paymentMethod,
      activePromotion: activePromotion
        ? {
            name: activePromotion.name,
            discountPercentage: activePromotion.discountPercentage,
            appliesTo: activePromotion.appliesTo
          }
        : undefined,
      actualEndTime: actualEndTime ? new Date(actualEndTime) : undefined,
      actualStartTime: actualStartTime ? new Date(actualStartTime) : undefined,
      // Thêm thông tin FNB order vào bill
      fnbOrder: order
        ? {
            drinks: order.order.drinks || {},
            snacks: order.order.snacks || {},
            completedAt: (order as any).completedAt,
            completedBy: (order as any).completedBy
          }
        : undefined
    }

    // Tự động lưu order vào history nếu có order và chưa có trong history
    if (order && order.order) {
      try {
        // Kiểm tra xem order đã có trong history chưa
        const existingHistory = await fnbOrderService.getOrderHistoryByRoomSchedule(scheduleId)
        const orderExistsInHistory = existingHistory.some(
          (historyOrder) => JSON.stringify(historyOrder.order) === JSON.stringify(order.order)
        )

        if (!orderExistsInHistory) {
          console.log('Lưu order vào history...')
          await fnbOrderService.saveOrderHistory(
            scheduleId,
            order.order,
            'system',
            bill.invoiceCode // Sử dụng invoiceCode làm billId
          )
          console.log('Order đã được lưu vào history')
        } else {
          console.log('Order đã tồn tại trong history, không lưu lại')
        }
      } catch (error) {
        console.error('Lỗi khi lưu order vào history:', error)
        // Không fail toàn bộ request nếu chỉ lỗi lưu history
      }
    }

    // Không cần làm tròn nữa vì đã làm tròn từng item rồi
    // bill.totalAmount = Math.floor(bill.totalAmount / 1000) * 1000

    // Thêm mã hóa đơn nếu chưa có
    if (!bill.invoiceCode) {
      const now = dayjs().tz('Asia/Ho_Chi_Minh')
      bill.invoiceCode = `#${now.date().toString().padStart(2, '0')}${(now.month() + 1).toString().padStart(2, '0')}${now.hour().toString().padStart(2, '0')}${now.minute().toString().padStart(2, '0')}`
    }

    return bill
  }

  // Quản lý queue in để tránh conflict
  private async managePrintQueue<T>(printFunction: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.printQueue.push(async () => {
        try {
          // Kiểm tra thời gian từ lần in cuối
          const currentTime = Date.now()
          const timeSinceLastPrint = currentTime - this.lastPrintTime
          const minCooldown = 3000 // 3 giây giữa các lần in

          if (timeSinceLastPrint < minCooldown) {
            const waitTime = minCooldown - timeSinceLastPrint
            console.log(`Cho ${waitTime}ms de may in san sang...`)
            await new Promise((resolve) => setTimeout(resolve, waitTime))
          }

          this.isPrinting = true
          console.log('Bat dau in... (Queue size:', this.printQueue.length, ')')

          const result = await printFunction()

          this.lastPrintTime = Date.now()
          this.isPrinting = false

          console.log('Hoan thanh in thanh cong')
          resolve(result)
        } catch (error) {
          this.isPrinting = false
          console.error('Loi khi in:', error)
          reject(error)
        } finally {
          // Xử lý job tiếp theo trong queue
          this.processNextInQueue()
        }
      })

      // Nếu không đang in, xử lý ngay
      if (!this.isPrinting) {
        this.processNextInQueue()
      }
    })
  }

  private async processNextInQueue() {
    if (this.printQueue.length > 0 && !this.isPrinting) {
      const nextJob = this.printQueue.shift()
      if (nextJob) {
        await nextJob()
      }
    }
  }

  /**
   * Helper method để gọi API in qua Socket.IO
   */
  private async printViaAPI(billData: IBill): Promise<any> {
    try {
      const billContent = await this.getBillText(billData)
      console.log('process.env.HTTP_API_URL', process.env.HTTP_API_URL)
      // Gọi API in
      const response = await axios.post(
        `${process.env.HTTP_API_URL}/print`,
        {
          printerId: process.env.PRINTER_ID,
          content: billContent
        },
        {
          headers: { 'Content-Type': 'application/json' }
        }
      )

      return response.data
    } catch (error) {
      console.error('Error calling print API:', error)
      throw error
    }
  }

  /**
   * In hóa đơn (phương thức mới sử dụng Socket.IO)
   */
  async printBill(billData: IBill): Promise<IBill> {
    try {
      console.log('PrintBill - Đang in hóa đơn với dữ liệu đã tính sẵn')

      // Lưu lại thời gian bắt đầu và kết thúc chính xác khi in hóa đơn
      const exactStartTime = billData.actualStartTime || billData.startTime
      const exactEndTime = billData.endTime || new Date()
      console.log(
        `Thời gian bắt đầu chính xác khi in hóa đơn: ${dayjs(ensureVNTimezone(exactStartTime)).format('DD/MM/YYYY HH:mm:ss')}`
      )
      console.log(
        `Thời gian kết thúc chính xác khi in hóa đơn: ${dayjs(ensureVNTimezone(exactEndTime)).format('DD/MM/YYYY HH:mm:ss')}`
      )

      // Tạo mã hóa đơn theo định dạng #DDMMHHMM (ngày, tháng, giờ, phút)
      const now = dayjs().tz('Asia/Ho_Chi_Minh')
      const invoiceCode = `#${now.date().toString().padStart(2, '0')}${(now.month() + 1).toString().padStart(2, '0')}${now.hour().toString().padStart(2, '0')}${now.minute().toString().padStart(2, '0')}`

      // SỬ DỤNG TRỰC TIẾP billData thay vì tạo bill object mới
      const bill: IBill = {
        ...billData,
        _id: new ObjectId(),
        scheduleId: new ObjectId(billData.scheduleId),
        roomId: new ObjectId(billData.roomId),
        createdAt: new Date(),
        actualEndTime: exactEndTime,
        actualStartTime: exactStartTime,
        invoiceCode: invoiceCode
      }

      // Kiểm tra status của schedule chỉ để ghi log
      const schedule = await databaseService.roomSchedule.findOne({ _id: new ObjectId(bill.scheduleId) })
      console.log(
        `In hóa đơn cho ScheduleId=${bill.scheduleId}, Status=${schedule?.status || 'unknown'}, CHỈ IN - KHÔNG LƯU VÀO DATABASE`
      )

      // Gọi API in qua Socket.IO
      await this.printViaAPI(bill)

      // Lưu vào transaction history
      this.transactionHistory.push(bill)

      return bill
    } catch (error) {
      console.error('Lỗi khi in hóa đơn:', error)
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
      // Validate date format
      if (!dayjs(date).isValid()) {
        throw new ErrorWithStatus({
          message: 'Invalid date format. Please use ISO date string format',
          status: HTTP_STATUS_CODE.BAD_REQUEST
        })
      }

      // FIX: Xử lý múi giờ nhất quán - chuyển đổi ngày về múi giờ Việt Nam trước khi tạo khoảng thời gian
      const targetDate = dayjs(date).tz('Asia/Ho_Chi_Minh')

      // Tạo khoảng thời gian cho ngày đó trong múi giờ Việt Nam
      const startDateObj = targetDate.startOf('day').toDate()
      const endDateObj = targetDate.endOf('day').toDate()

      const bills = await databaseService.bills
        .find({
          createdAt: {
            $gte: startDateObj,
            $lte: endDateObj
          }
        })
        .sort({ createdAt: -1 })
        .toArray()

      console.log(`[DOANH THU] Tìm thấy ${bills.length} hóa đơn (bao gồm trùng lặp)`)

      // Log thông tin từng hóa đơn để debug
      bills.forEach((bill, index) => {
        const billDate = dayjs(bill.createdAt).tz('Asia/Ho_Chi_Minh')
        console.log(
          `[DOANH THU] Bill ${index + 1}: ID=${bill._id}, ScheduleId=${bill.scheduleId}, CreatedAt=${billDate.format('DD/MM/YYYY HH:mm:ss')}, Amount=${bill.totalAmount}`
        )
      })

      // Remove duplicates by scheduleId - keep paid bills or latest bill
      const uniqueBills = new Map<string, IBill>()

      for (const bill of bills) {
        const scheduleId = bill.scheduleId.toString()

        if (!uniqueBills.has(scheduleId)) {
          // First bill for this scheduleId
          uniqueBills.set(scheduleId, bill)
          console.log(`[DOANH THU] First bill for schedule ${scheduleId}: ${bill._id} (${bill.totalAmount})`)
        } else {
          const existingBill = uniqueBills.get(scheduleId)!
          let shouldReplace = false

          // Priority 1: Bills with paymentMethod (paid) over bills without
          if (bill.paymentMethod && !existingBill.paymentMethod) {
            shouldReplace = true
            console.log(
              `[DOANH THU] Replacing unpaid bill ${existingBill._id} with paid bill ${bill._id} for schedule ${scheduleId}`
            )
          }
          // Priority 2: If both have same payment status, use latest createdAt
          else if (
            !!bill.paymentMethod === !!existingBill.paymentMethod &&
            bill.createdAt &&
            existingBill.createdAt &&
            new Date(bill.createdAt) > new Date(existingBill.createdAt)
          ) {
            shouldReplace = true
            console.log(
              `[DOANH THU] Replacing older bill ${existingBill._id} with newer bill ${bill._id} for schedule ${scheduleId}`
            )
          }

          if (shouldReplace) {
            uniqueBills.set(scheduleId, bill)
            console.log(
              `[DOANH THU] Selected bill ${bill._id} (${bill.totalAmount}) over ${existingBill._id} (${existingBill.totalAmount})`
            )
          } else {
            console.log(
              `[DOANH THU] Keeping existing bill ${existingBill._id} (${existingBill.totalAmount}) over ${bill._id} (${bill.totalAmount})`
            )
          }
        }
      }

      const finalBills = Array.from(uniqueBills.values())

      console.log(`[DOANH THU] Sau khi loại bỏ trùng lặp: ${finalBills.length} hóa đơn`)

      // Log final bills
      finalBills.forEach((bill, index) => {
        const billDate = dayjs(bill.createdAt).tz('Asia/Ho_Chi_Minh')
        console.log(
          `[DOANH THU] Final Bill ${index + 1}: ID=${bill._id}, ScheduleId=${bill.scheduleId}, CreatedAt=${billDate.format('DD/MM/YYYY HH:mm:ss')}, Amount=${bill.totalAmount}, PaymentMethod=${bill.paymentMethod || 'null'}`
        )
      })

      // Simple calculation - just sum all totalAmount
      const totalRevenue = finalBills.reduce((sum, bill) => sum + bill.totalAmount, 0)

      console.log(`[DOANH THU] Tổng doanh thu: ${totalRevenue.toLocaleString('vi-VN')} VND`)
      console.log(`[DOANH THU] Số lượng hóa đơn: ${finalBills.length}`)

      return {
        totalRevenue,
        bills: finalBills
      }
    } catch (error) {
      console.error('[DOANH THU] Lỗi khi lấy doanh thu:', error)
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

            // Log thông tin khuyến mãi nếu có
            if (billToUse.activePromotion) {
              console.log(
                `- Khuyến mãi đã áp dụng: ${billToUse.activePromotion.name} (${billToUse.activePromotion.discountPercentage}%)`
              )
              console.log(`- Tổng tiền sau giảm giá: ${billToUse.totalAmount.toLocaleString('vi-VN')} VND`)
            }
          } else {
            // Tính lại hóa đơn dựa trên thông tin schedule
            console.log(`- Không tìm thấy hóa đơn đã lưu, đang tính toán lại...`)
            // Không áp dụng promotion nào khi tính toán lại để tránh sai lệch
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

            // Log thông tin khuyến mãi nếu có
            if (billToUse.activePromotion) {
              console.log(
                `- Khuyến mãi đã áp dụng: ${billToUse.activePromotion.name} (${billToUse.activePromotion.discountPercentage}%)`
              )
              console.log(`- Tổng tiền sau giảm giá: ${billToUse.totalAmount.toLocaleString('vi-VN')} VND`)
            }
          } else {
            // Tính lại hóa đơn dựa trên thông tin schedule
            console.log(`- Không tìm thấy hóa đơn đã lưu, đang tính toán lại...`)
            // Không áp dụng promotion nào khi tính toán lại để tránh sai lệch
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

            // Log thông tin khuyến mãi nếu có
            if (billToUse.activePromotion) {
              console.log(
                `- Khuyến mãi đã áp dụng: ${billToUse.activePromotion.name} (${billToUse.activePromotion.discountPercentage}%)`
              )
              console.log(`- Tổng tiền sau giảm giá: ${billToUse.totalAmount.toLocaleString('vi-VN')} VND`)
            }
          } else {
            // Tính lại hóa đơn dựa trên thông tin schedule
            console.log(`- Không tìm thấy hóa đơn đã lưu, đang tính toán lại...`)
            // Không áp dụng promotion nào khi tính toán lại để tránh sai lệch
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

  /**
   * Get total revenue directly from bills collection without checking room schedules
   * @param dateType Type of date range: 'day', 'week', 'month', or 'custom'
   * @param startDate Start date (required for all types, format: ISO date string)
   * @param endDate End date (only required for 'custom' type, format: ISO date string)
   * @returns Object containing total revenue and bill details
   */
  async getRevenueFromBillsCollection(
    dateType: 'day' | 'week' | 'month' | 'custom',
    startDate: string,
    endDate?: string
  ): Promise<{
    totalRevenue: number
    bills: IBill[]
    startDate: Date
    endDate: Date
    timeRange: string
  }> {
    try {
      let start: dayjs.Dayjs
      let end: dayjs.Dayjs
      let timeRangeDescription: string

      // Xác định khoảng thời gian dựa vào dateType
      start = dayjs(startDate).tz('Asia/Ho_Chi_Minh')

      switch (dateType) {
        case 'day':
          start = start.startOf('day')
          end = start.endOf('day')
          timeRangeDescription = `ngày ${start.format('DD/MM/YYYY')}`
          break

        case 'week':
          start = start.startOf('week')
          end = start.endOf('week')
          timeRangeDescription = `tuần ${start.week()} năm ${start.year()} (${start.format('DD/MM')} - ${end.format('DD/MM/YYYY')})`
          break

        case 'month':
          start = start.startOf('month')
          end = start.endOf('month')
          timeRangeDescription = `tháng ${start.format('MM/YYYY')}`
          break

        case 'custom':
          if (!endDate) {
            throw new ErrorWithStatus({
              message: 'Cần cung cấp ngày kết thúc cho khoảng thời gian tùy chỉnh',
              status: HTTP_STATUS_CODE.BAD_REQUEST
            })
          }
          start = start.startOf('day')
          end = dayjs(endDate).tz('Asia/Ho_Chi_Minh').endOf('day')
          timeRangeDescription = `từ ${start.format('DD/MM/YYYY')} đến ${end.format('DD/MM/YYYY')}`

          if (start.isAfter(end)) {
            throw new ErrorWithStatus({
              message: 'Ngày bắt đầu phải trước ngày kết thúc',
              status: HTTP_STATUS_CODE.BAD_REQUEST
            })
          }
          break
      }

      const startDateObj = start.toDate()
      const endDateObj = end.toDate()

      // FIX: Sử dụng createdAt thay vì endTime để tránh vấn đề múi giờ
      // vì createdAt thường được lưu chính xác hơn về thời điểm tạo hóa đơn
      const bills = await databaseService.bills
        .find({
          createdAt: {
            $gte: startDateObj,
            $lte: endDateObj
          }
        })
        .sort({ createdAt: -1 })
        .toArray()

      console.log(`[DOANH THU MỚI] Tìm thấy ${bills.length} hóa đơn trong khoảng thời gian ${timeRangeDescription}`)

      // Log thông tin từng hóa đơn để debug
      bills.forEach((bill, index) => {
        const billDate = dayjs(bill.createdAt).tz('Asia/Ho_Chi_Minh')
        console.log(
          `[DOANH THU MỚI] Bill ${index + 1}: ID=${bill._id}, ScheduleId=${bill.scheduleId}, CreatedAt=${billDate.format('DD/MM/YYYY HH:mm:ss')}, Amount=${bill.totalAmount}`
        )
      })

      if (bills.length === 0) {
        return {
          totalRevenue: 0,
          bills: [],
          startDate: startDateObj,
          endDate: endDateObj,
          timeRange: timeRangeDescription
        }
      }

      // Remove duplicates by scheduleId (prioritize paid bills, then latest createdAt)
      const uniqueBills = new Map<string, IBill>()
      for (const bill of bills) {
        const scheduleId = bill.scheduleId.toString()

        if (!uniqueBills.has(scheduleId)) {
          // First bill for this scheduleId
          uniqueBills.set(scheduleId, bill)
        } else {
          const existingBill = uniqueBills.get(scheduleId)!
          let shouldReplace = false

          // Priority 1: Bills with paymentMethod (paid) over bills without
          if (bill.paymentMethod && !existingBill.paymentMethod) {
            shouldReplace = true
          }
          // Priority 2: If both have paymentMethod or both don't have, use latest createdAt
          else if (
            (!bill.paymentMethod && !existingBill.paymentMethod) ||
            (bill.paymentMethod && existingBill.paymentMethod)
          ) {
            if (
              bill.createdAt &&
              existingBill.createdAt &&
              new Date(bill.createdAt) > new Date(existingBill.createdAt)
            ) {
              shouldReplace = true
              console.log(
                `[DOANH THU] Replacing older bill ${existingBill._id} with newer bill ${bill._id} for schedule ${scheduleId}`
              )
            }
          }

          if (shouldReplace) {
            uniqueBills.set(scheduleId, bill)
            console.log(
              `[DOANH THU] Selected bill ${bill._id} (${bill.totalAmount}) over ${existingBill._id} (${existingBill.totalAmount})`
            )
          } else {
            console.log(
              `[DOANH THU] Keeping existing bill ${existingBill._id} (${existingBill.totalAmount}) over ${bill._id} (${bill.totalAmount})`
            )
          }
        }
      }

      const finalBills = Array.from(uniqueBills.values())

      // Làm tròn tổng tiền của từng hóa đơn (nếu cần)
      finalBills.forEach((bill) => {
        bill.totalAmount = Math.floor(bill.totalAmount / 1000) * 1000

        // Log thông tin chi tiết về hóa đơn và khuyến mãi nếu có
        const billDate = dayjs(bill.createdAt).tz('Asia/Ho_Chi_Minh')
        console.log(
          `- Bill ID: ${bill._id}, CreatedAt: ${billDate.format('DD/MM/YYYY HH:mm:ss')}, Tổng tiền: ${bill.totalAmount.toLocaleString('vi-VN')} VND`
        )
        if (bill.activePromotion) {
          console.log(
            `  + Khuyến mãi đã áp dụng: ${bill.activePromotion.name} (${bill.activePromotion.discountPercentage}%)`
          )
          console.log(`  + Đây là giá trị đã giảm giá, sử dụng trực tiếp từ database`)
        }

        // Log thông tin từng mục trong hóa đơn
        if (bill.items && bill.items.length > 0) {
          bill.items.forEach((item) => {
            if (item.originalPrice) {
              console.log(
                `  + ${item.description}: ${item.quantity} x ${item.price} = ${item.originalPrice} -> ${item.price * item.quantity} VND (đã giảm giá)`
              )
            } else {
              console.log(
                `  + ${item.description}: ${item.quantity} x ${item.price} = ${item.price * item.quantity} VND`
              )
            }
          })
        }
      })

      // Tính tổng doanh thu
      const totalRevenue = finalBills.reduce((sum, bill) => sum + bill.totalAmount, 0)

      console.log(`[DOANH THU MỚI] Tổng doanh thu ${timeRangeDescription}: ${totalRevenue.toLocaleString('vi-VN')} VND`)
      console.log(`[DOANH THU MỚI] Số lượng hóa đơn (sau khi lọc trùng): ${finalBills.length}`)

      return {
        totalRevenue,
        bills: finalBills,
        startDate: startDateObj,
        endDate: endDateObj,
        timeRange: timeRangeDescription
      }
    } catch (error) {
      console.error('[DOANH THU MỚI] Lỗi khi tính doanh thu:', error)
      throw error
    }
  }

  // Tạo nội dung hóa đơn dạng text
  public async getBillText(bill: IBill): Promise<string> {
    const room = await databaseService.rooms.findOne({ _id: new ObjectId(bill.roomId) })
    const printer = new TextPrinter()

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
      .text(`Ma HD: ${bill.invoiceCode || 'N/A'}`)
      .text(`${room?.roomName || 'Khong xac dinh'}`)
      .align('lt')
      .text(`Ngay: ${dayjs(ensureVNTimezone(bill.createdAt)).format('DD/MM/YYYY')}`)
      .text(`Gio bat dau: ${dayjs(bill.startTime).tz('Asia/Ho_Chi_Minh').format('HH:mm')}`)
      .text(`Gio ket thuc: ${dayjs(bill.endTime).tz('Asia/Ho_Chi_Minh').format('HH:mm')}`)
      .text(
        `Tong gio su dung: ${dayjs(bill.endTime).diff(dayjs(bill.startTime), 'hour')} gio ${dayjs(bill.endTime).diff(dayjs(bill.startTime), 'minute') % 60} phut`
      )
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

    printer.style('b').tableCustom(tableHeader)

    // In chi tiết từng mục với định dạng tương tự printBill
    bill.items.forEach((item) => {
      let description = item.description
      let quantity = item.quantity

      // Xử lý đặc biệt cho phí dịch vụ thu âm
      if (description.includes('Phi dich vu thu am')) {
        // Tách description thành tên dịch vụ và thời gian
        const [serviceName, timeRange] = description.split('(')
        const timeStr = timeRange ? `(${timeRange}` : ''

        // Định dạng số tiền để hiển thị gọn hơn
        const formattedPrice = item.price.toLocaleString('vi-VN')
        // Tính tổng tiền và làm tròn xuống 1000 VND để nhất quán
        const rawTotal = quantity * item.price
        const currentTotal = Math.floor(rawTotal / 1000) * 1000
        const formattedTotal = currentTotal.toLocaleString('vi-VN')

        // In dòng đầu với tên dịch vụ
        printer.style('b').tableCustom([
          { text: 'Phi dich vu thu am', width: 0.45, align: 'left' },
          { text: quantity.toString(), width: 0.15, align: 'center' },
          { text: formattedPrice, width: 0.2, align: 'right' },
          { text: formattedTotal, width: 0.2, align: 'right' }
        ])

        // In dòng thứ hai với thời gian
        if (timeStr) {
          printer.style('b').tableCustom([
            { text: timeStr, width: 0.45, align: 'left' },
            { text: '', width: 0.15, align: 'center' },
            { text: '', width: 0.2, align: 'right' },
            { text: '', width: 0.2, align: 'right' }
          ])
        }

        return
      }

      // Loại bỏ dấu nếu là món ăn/đồ uống (không phải phí dịch vụ thu âm)
      description = removeVietnameseTones(description)

      // Tách mô tả và thông tin khuyến mãi nếu mô tả có chứa thông tin khuyến mãi
      const promotionMatch = description.match(/ \(Giam (\d+)% - (.*)\)$/)
      if (promotionMatch) {
        description = description.replace(/ \(Giam (\d+)% - (.*)\)$/, '')
      }

      const maxNameLength = 21
      const nameLines = []
      let desc = description
      while (desc.length > 0) {
        nameLines.push(desc.substring(0, maxNameLength))
        desc = desc.substring(maxNameLength)
      }

      const formattedPrice = item.price.toLocaleString('vi-VN')
      const rawTotal = item.quantity * item.price
      const itemTotalDisplay = Math.floor(rawTotal / 1000) * 1000
      const formattedTotal = itemTotalDisplay.toLocaleString('vi-VN')

      // In dòng đầu tiên với tên (phần đầu), SL, Đơn giá, Thành tiền
      printer.tableCustom([
        { text: nameLines[0], width: 0.45, align: 'left' },
        { text: quantity.toString(), width: 0.15, align: 'center' },
        { text: formattedPrice, width: 0.2, align: 'right' },
        { text: formattedTotal, width: 0.2, align: 'right' }
      ])
      // Nếu có nhiều dòng, in các dòng tiếp theo chỉ với tên, các cột còn lại để trống
      for (let i = 1; i < nameLines.length; i++) {
        printer.tableCustom([
          { text: nameLines[i], width: 0.45, align: 'left' },
          { text: '', width: 0.15, align: 'center' },
          { text: '', width: 0.2, align: 'right' },
          { text: '', width: 0.2, align: 'right' }
        ])
      }
    })

    printer.text('------------------------------------------------')

    // Hiển thị discount từ activePromotion nếu có
    if (bill.activePromotion) {
      // Tính tổng tiền gốc (subtotal) - làm tròn xuống 1000 VND để nhất quán
      let subtotalAmount = 0
      bill.items.forEach((item) => {
        const rawTotal = item.quantity * item.price
        subtotalAmount += Math.floor(rawTotal / 1000) * 1000
      })

      // Hiển thị tổng tiền hàng
      printer
        .align('rt')
        .style('b')
        .size(1, 1)
        .text(`Tong tien hang: ${subtotalAmount.toLocaleString('vi-VN')} VND`)

      // Hiển thị discount
      const discountAmount = Math.floor((subtotalAmount * bill.activePromotion.discountPercentage) / 100)
      printer
        .align('lt')
        .style('b')
        .size(1, 1)
        .text(`Discount ${bill.activePromotion.discountPercentage}%:`)
        .align('rt')
        .text(`-${discountAmount.toLocaleString('vi-VN')} VND`)
    }

    printer
      .text('--------------------------------------------')
      .align('rt')
      .style('b')
      .text(`TONG CONG: ${bill.totalAmount.toLocaleString('vi-VN')} VND`)
      .align('lt')
      .style('normal')
      .text('--------------------------------------------')

    if (bill.paymentMethod) {
      const paymentMethods: { [key: string]: string } = {
        cash: 'Tien mat',
        bank_transfer: 'Chuyen khoan',
        momo: 'MoMo',
        zalo_pay: 'Zalo Pay',
        vnpay: 'VNPay',
        visa: 'Visa',
        mastercard: 'Mastercard'
      }
      const paymentMethodText = paymentMethods[bill.paymentMethod] || bill.paymentMethod
      printer.text(`Phuong thuc thanh toan: ${paymentMethodText}`)
    }

    printer
      .align('ct')
      .text('--------------------------------------------')
      .text('Cam on quy khach da su dung dich vu cua Jozo')
      .text('Hen gap lai quy khach!')
      .text('--------------------------------------------')
      .align('ct')
      .text('Dia chi: 247/5 Phan Trung, Tam Hiep, Bien Hoa')
      .text('Website: jozo.com.vn')
      .style('i')
      .text('Powered by Jozo')
      .style('normal')
      .feed(2)

    return printer.getText()
  }

  /**
   * Tìm menu item theo ID, tìm trong cả fnb_menu và fnb_menu_item collections
   */
  private async findMenuItemById(menuId: string, menu: any[]): Promise<{ name: string; price: number } | null> {
    // Tìm menu item chính trước
    let menuItem = menu.find((m) => m._id.toString() === menuId)

    if (menuItem) {
      // Nếu tìm thấy menu chính
      return {
        name: menuItem.name,
        price: menuItem.price
      }
    } else {
      // Nếu không tìm thấy menu chính, tìm trong fnb_menu_item collection
      console.log(`Không tìm thấy menu chính, tìm trong fnb_menu_item collection...`)
      const menuItemFromService = await fnbMenuItemService.getMenuItemById(menuId)
      if (menuItemFromService) {
        return {
          name: menuItemFromService.name,
          price: menuItemFromService.price
        }
      } else {
        // Nếu vẫn không tìm thấy, tìm trong variants của menu chính
        console.log(`Không tìm thấy trong fnb_menu_item, tìm trong variants...`)
        for (const menuItem of menu) {
          if (menuItem.variants && Array.isArray(menuItem.variants)) {
            const variant = menuItem.variants.find((v: any) => v.id === menuId)
            if (variant) {
              // Lấy tên product cha và tên variant
              return {
                name: `${menuItem.name} - ${variant.name}`,
                price: variant.price
              }
            }
          }
        }
      }
    }

    return null
  }

  /**
   * Chuyển đổi giá tiền từ nhiều định dạng khác nhau sang số
   * Ví dụ: "10.000" -> 10000, "10,000" -> 10000, 10 -> 10000
   */
  private parsePrice(price: string | number): number {
    if (typeof price === 'number') {
      // Nếu giá là số nhỏ (ví dụ: 10), nhân với 1000
      if (price < 1000) {
        return price * 1000
      }
      return price
    }

    // Xóa tất cả dấu chấm và phẩy, sau đó chuyển thành số
    const cleanPrice = price.replace(/[.,]/g, '')
    const numericPrice = Number(cleanPrice)

    if (isNaN(numericPrice)) {
      console.error(`Invalid price format: ${price}`)
      return 0
    }

    // Nếu giá là số nhỏ (ví dụ: 10), nhân với 1000
    if (numericPrice < 1000) {
      return numericPrice * 1000
    }

    return numericPrice
  }

  /**
   * So sánh thời gian chỉ tính đến giờ và phút, bỏ qua giây
   * @param time1 - Thời gian thứ nhất
   * @param time2 - Thời gian thứ hai
   * @returns true nếu time1 >= time2 (chỉ tính giờ và phút)
   */
  private compareTimeIgnoreSeconds(time1: Date, time2: Date): boolean {
    const time1Minutes = time1.getHours() * 60 + time1.getMinutes()
    const time2Minutes = time2.getHours() * 60 + time2.getMinutes()
    return time1Minutes >= time2Minutes
  }
}

const billService = new BillService()
export default billService

export async function printUnicodeWithEscpos(text: string): Promise<void> {
  const escpos = require('escpos')
  escpos.USB = require('escpos-usb')
  const iconv = require('iconv-lite')
  const idVendor = 1137
  const idProduct = 85
  const device = new escpos.USB(idVendor, idProduct)
  const printer = new escpos.Printer(device, { encoding: 'GB18030' })

  return new Promise((resolve, reject) => {
    device.open(function (err: any) {
      if (err) return reject(err)
      const buffer = iconv.encode(text, 'cp1258')
      printer.raw(buffer)
      printer.cut()
      printer.close()
      resolve()
    })
  })
}

export async function printBitmapUnicode(text: string): Promise<void> {
  const escpos = require('escpos')
  escpos.USB = require('escpos-usb')
  const sharp = require('sharp')
  const fs = require('fs')
  const path = require('path')

  // Render text ra BMP buffer
  const imageBuffer = await sharp({
    text: {
      text: `<span foreground=\"black\">${text}</span>`,
      font: 'DejaVu Sans',
      width: 384,
      height: 100,
      rgba: true
    }
  })
    .bmp()
    .toBuffer()

  // Ghi buffer ra file tạm
  const tmpPath = path.join(__dirname, 'temp_print.bmp')
  fs.writeFileSync(tmpPath, imageBuffer)

  // In ảnh BMP bằng escpos gốc
  const idVendor = 1137
  const idProduct = 85
  const device = new escpos.USB(idVendor, idProduct)
  const printer = new escpos.Printer(device)

  return new Promise((resolve, reject) => {
    device.open(function (err: any) {
      if (err) return reject(err)
      printer.image(tmpPath, 'd24', function () {
        for (let i = 0; i < 15; i++) printer.text('\n')
        printer.cut()
        printer.close()
        fs.unlinkSync(tmpPath)
        resolve()
      })
    })
  })
}

export async function printBitmapWithEscpos(text: string): Promise<void> {
  const escpos = require('escpos')
  escpos.USB = require('escpos-usb')
  const sharp = require('sharp')
  const fs = require('fs')
  const path = require('path')

  // Render text ra PNG buffer và ghi ra file tạm
  const imageBuffer = await sharp({
    text: {
      text: `<span foreground="black">${text}</span>`,
      font: 'DejaVu Sans',
      width: 384,
      height: 100,
      rgba: true
    }
  })
    .png()
    .toBuffer()
  const tmpPath = path.join(__dirname, 'temp_print_escpos.png')
  fs.writeFileSync(tmpPath, imageBuffer)

  // In ảnh bằng escpos gốc
  const idVendor = 1137
  const idProduct = 85
  const device = new escpos.USB(idVendor, idProduct)
  const printer = new escpos.Printer(device)

  return new Promise((resolve, reject) => {
    device.open(function (err: any) {
      if (err) return reject(err)
      printer.image(tmpPath, 's8', function () {
        for (let i = 0; i < 5; i++) printer.newLine()
        printer.cut()
        printer.close()
        // Xóa file tạm sau khi in
        fs.unlinkSync(tmpPath)
        resolve()
      })
    })
  })
}

function removeVietnameseTones(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
}
