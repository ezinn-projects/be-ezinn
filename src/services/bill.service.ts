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
  return dayjs(date).format('DD/MM/YYYY HH:mm')
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
    // Check if it's a holiday first
    const isHoliday = await holidayService.isHoliday(date)
    if (isHoliday) {
      return DayType.Holiday
    }

    // If not a holiday, check if it's weekend
    const day = date.getDay()
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
    const startDate = dayjs(start)
    const endDate = dayjs(end)

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

    // Tính toán số giờ và phút (như logic cũ)
    const hours = Math.floor(diffHours)
    const minutes = Math.floor((diffHours - hours) * 60)

    // Tính giờ theo tỷ lệ phút sử dụng thực tế
    // Nếu phút > 0, tính theo tỷ lệ phút/60 thay vì làm tròn lên 1 giờ
    if (minutes > 0) {
      return parseFloat((hours + minutes / 60).toFixed(2))
    }

    return hours
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
    promotionId?: string
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
    const dayType = await this.determineDayType(new Date(schedule.startTime))
    const endTime = actualEndTime ? new Date(actualEndTime) : new Date(schedule.endTime as Date)
    if (!dayjs(endTime).isValid()) {
      throw new ErrorWithStatus({
        message: 'Thời gian kết thúc không hợp lý',
        status: HTTP_STATUS_CODE.BAD_REQUEST
      })
    }

    // Lấy thông tin bảng giá cho loại ngày (weekday/weekend)
    const priceDoc = await databaseService.price.findOne({ day_type: dayType })
    if (!priceDoc || !priceDoc.time_slots) {
      throw new ErrorWithStatus({
        message: 'Không tìm thấy cấu hình giá',
        status: HTTP_STATUS_CODE.NOT_FOUND
      })
    }

    // Thời gian bắt đầu và kết thúc
    const startTime = new Date(schedule.startTime)

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
      const slotStartTime = dayjs(startTime).format('YYYY-MM-DD') + ' ' + slot.start
      let slotEndTime

      // Xử lý khung giờ qua ngày
      if (slot.start > slot.end) {
        slotEndTime = dayjs(startTime).add(1, 'day').format('YYYY-MM-DD') + ' ' + slot.end
      } else {
        slotEndTime = dayjs(startTime).format('YYYY-MM-DD') + ' ' + slot.end
      }

      timeSlotBoundaries.push({
        start: new Date(slotStartTime),
        end: new Date(slotEndTime),
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
      const sessionStart = dayjs(startTime).isAfter(dayjs(slot.start)) ? startTime : slot.start
      const sessionEnd = dayjs(endTime).isBefore(dayjs(slot.end)) ? endTime : slot.end

      // Nếu có thời gian sử dụng trong khung giờ này
      if (dayjs(sessionStart).isBefore(dayjs(sessionEnd))) {
        const hoursInSlot = this.calculateHours(sessionStart, sessionEnd)

        if (hoursInSlot > 0) {
          // Làm tròn xuống phí dịch vụ (chia cho 1000 rồi nhân lại)
          const slotServiceFee = Math.floor((hoursInSlot * priceEntry.price) / 1000) * 1000

          totalServiceFee += slotServiceFee
          totalHoursUsed += hoursInSlot

          // Thêm vào danh sách chi tiết theo khung giờ
          timeSlotItems.push({
            description: `Phi dich vu thu am (${dayjs(sessionStart).format('HH:mm')}-${dayjs(sessionEnd).format('HH:mm')})`,
            quantity: hoursInSlot,
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
      const hoursUsed = this.calculateHours(startTime, endTime)

      // Làm tròn xuống phí dịch vụ (chia cho 1000 rồi nhân lại)
      const roundedServiceFeeTotal = Math.floor((hoursUsed * serviceFeeUnitPrice) / 1000) * 1000

      timeSlotItems.push({
        description: `Phi dich vu thu am`,
        quantity: hoursUsed,
        unitPrice: serviceFeeUnitPrice,
        totalPrice: roundedServiceFeeTotal
      })

      totalServiceFee = roundedServiceFeeTotal
      totalHoursUsed = hoursUsed
    }

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
      activePromotion = await promotionService.getPromotionById(promotionId)
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
      startTime: schedule.startTime,
      endTime,
      createdAt: schedule.createdAt,
      note: schedule.note,
      items: items.map((item) => ({
        description: item.description,
        price: item.unitPrice,
        quantity: item.quantity,
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
        : undefined
    }

    return bill
  }

  async printBill(billData: IBill): Promise<IBill> {
    try {
      // Kiểm tra xem đã có hóa đơn tương tự trong khoảng thời gian gần đây không
      // (trong vòng 5 phút gần đây)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)

      // Tìm tất cả hóa đơn trong khoảng thời gian gần đây
      const recentBills = await databaseService.bills
        .find({
          createdAt: { $gte: fiveMinutesAgo }
        })
        .toArray()

      // Tạo key cho hóa đơn hiện tại
      const newBillKey = this.getBillUniqueKey(billData)

      // Tìm hóa đơn trùng lặp dựa trên key
      const existingBill = recentBills.find((bill) => this.getBillUniqueKey(bill) === newBillKey)

      // Nếu đã có hóa đơn tương tự, trả về hóa đơn đó thay vì tạo mới
      if (existingBill) {
        console.log(`Tìm thấy hóa đơn tương tự đã tồn tại trong 5 phút qua.`)
        console.log(`Sử dụng hóa đơn đã tồn tại: ${existingBill._id}`)
        return existingBill
      }

      const bill: IBill = {
        _id: new ObjectId(),
        scheduleId: new ObjectId(billData.scheduleId),
        roomId: new ObjectId(billData.roomId),
        items: billData.items,
        totalAmount: billData.totalAmount,
        startTime: billData.startTime,
        endTime: billData.endTime,
        createdAt: new Date(), // Sử dụng thời gian hiện tại
        paymentMethod: billData.paymentMethod,
        note: billData.note,
        activePromotion: billData.activePromotion
      }

      // Log thông tin bill trước khi lưu
      console.log(
        `Lưu hóa đơn mới: ${bill._id}, createdAt=${bill.createdAt.toISOString()}, totalAmount=${bill.totalAmount}`
      )

      // Save bill to the database
      const result = await databaseService.bills.insertOne(bill)
      console.log(`Kết quả lưu hóa đơn: success=${result.acknowledged}, id=${result.insertedId}`)

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

      return new Promise((resolve, reject) => {
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
            return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()} ${date.getHours()}:${date.getMinutes()}`
          }

          // Tạo mã hóa đơn theo định dạng #DDMMHHMM (ngày, tháng, giờ, phút)
          const now = new Date()
          const invoiceCode = `#${now.getDate().toString().padStart(2, '0')}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`

          device.open((error: any) => {
            if (error) {
              return reject(new Error('Lỗi mở máy in: ' + error.message))
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
              .text(`Gio bat dau: ${dayjs(bill.startTime).format('HH:mm')}`)
              .text(`Gio ket thuc: ${dayjs(bill.endTime).format('HH:mm')}`)
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

              // Tính và hiển thị tổng tiền của item mà không áp dụng giảm giá
              const itemTotalPrice = item.quantity * item.price
              const formattedTotal =
                itemTotalPrice >= 1000 ? `${Math.floor(itemTotalPrice / 1000)}K` : itemTotalPrice.toString()

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
            bill.items.forEach((item) => {
              subtotalAmount += item.quantity * item.price
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
              .feed(3) // Thêm 3 dòng trống ở cuối để tăng margin bottom
              .cut()
              .close(() => {
                console.log('In hoa don thanh cong')
                this.transactionHistory.push(bill)
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
      // Parse the input date in local timezone
      const inputDate = dayjs(date)

      // Create date range for the specific day (from 00:00:00 to 23:59:59)
      const startDate = inputDate.startOf('day').toDate()
      const endDate = inputDate.endOf('day').toDate()

      console.log(`Tìm hóa đơn từ [${startDate.toISOString()}] đến [${endDate.toISOString()}]`)
      console.log(`Ngày được chỉ định: ${inputDate.format('YYYY-MM-DD')}`)

      // Tìm tất cả roomSchedules đã hoàn thành trong ngày này
      const finishedSchedules = await databaseService.roomSchedule
        .find({
          // Trạng thái đã hoàn thành
          status: RoomScheduleStatus.Finished,
          // Thời gian kết thúc nằm trong ngày được chỉ định
          endTime: {
            $gte: startDate,
            $lte: endDate
          }
        })
        .toArray()

      console.log(
        `Tìm thấy ${finishedSchedules.length} lịch đặt phòng đã hoàn thành cho ngày ${inputDate.format('YYYY-MM-DD')}`
      )

      // Lấy danh sách scheduleId
      const scheduleIds = finishedSchedules.map((schedule) => schedule._id)

      // Tìm hóa đơn theo ngày cụ thể và chỉ lấy hóa đơn của các lịch đã hoàn thành
      const bills = await databaseService.bills
        .find({
          createdAt: {
            $gte: startDate,
            $lte: endDate
          },
          scheduleId: { $in: scheduleIds }
        })
        .toArray()

      console.log(`Tìm thấy ${bills.length} hóa đơn cho ngày ${inputDate.format('YYYY-MM-DD')}`)

      if (bills.length === 0) {
        // Kiểm tra xem bills collection có dữ liệu không
        const totalBills = await databaseService.bills.countDocuments({})
        console.log(`Tổng số hóa đơn trong database: ${totalBills}`)

        // Lấy mẫu một số hóa đơn để debug
        if (totalBills > 0) {
          const sampleBills = await databaseService.bills.find({}).limit(5).toArray()
          console.log('Mẫu một số hóa đơn:')
          sampleBills.forEach((bill) => {
            console.log(`- Bill ID: ${bill._id}, createdAt: ${bill.createdAt}, totalAmount: ${bill.totalAmount}`)
          })
        }
      }

      // Lọc bỏ hoá đơn trùng lặp dựa trên các thông tin quan trọng
      const uniqueBillsMap = new Map<string, IBill>()

      bills.forEach((bill) => {
        // Tạo key duy nhất cho mỗi hóa đơn dựa trên các thông tin chính
        const uniqueKey = this.getBillUniqueKey(bill)

        // Nếu key chưa tồn tại hoặc bill hiện tại được tạo sau bill đã lưu
        // thì sử dụng bill hiện tại (để lấy phiên bản mới nhất)
        if (
          !uniqueBillsMap.has(uniqueKey) ||
          new Date(bill.createdAt) > new Date(uniqueBillsMap.get(uniqueKey)!.createdAt)
        ) {
          uniqueBillsMap.set(uniqueKey, bill)
        }
      })

      // Chuyển map thành mảng
      const uniqueBills = Array.from(uniqueBillsMap.values())

      console.log(`Đã lọc từ ${bills.length} hóa đơn còn ${uniqueBills.length} hóa đơn sau khi xử lý trùng lặp`)

      // Tính tổng doanh thu từ danh sách hóa đơn đã lọc
      const totalRevenue = uniqueBills.reduce((total, bill) => total + bill.totalAmount, 0)

      return {
        totalRevenue,
        bills: uniqueBills
      }
    } catch (error) {
      console.error('Lỗi khi lấy doanh thu theo ngày:', error)
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
  ): Promise<{ totalRevenue: number; bills: IBill[]; startDate: Date; endDate: Date }> {
    try {
      // Parse the input date and get the start/end of the week
      const targetDate = dayjs(date)
      const startOfWeek = targetDate.startOf('week')
      const endOfWeek = targetDate.endOf('week')

      // Convert to Date objects for MongoDB query
      const startDate = startOfWeek.toDate()
      const endDate = endOfWeek.toDate()

      console.log(`Tìm hóa đơn từ [${startDate.toISOString()}] đến [${endDate.toISOString()}]`)
      console.log(`Tuần: ${targetDate.week()} năm ${targetDate.year()}`)

      // Tìm tất cả roomSchedules đã hoàn thành trong tuần này
      const finishedSchedules = await databaseService.roomSchedule
        .find({
          // Trạng thái đã hoàn thành
          status: RoomScheduleStatus.Finished,
          // Thời gian kết thúc nằm trong tuần được chỉ định
          endTime: {
            $gte: startDate,
            $lte: endDate
          }
        })
        .toArray()

      console.log(`Tìm thấy ${finishedSchedules.length} lịch đặt phòng đã hoàn thành trong tuần`)

      // Lấy danh sách scheduleId
      const scheduleIds = finishedSchedules.map((schedule) => schedule._id)

      // Find all bills created within the week and only for completed schedules
      const bills = await databaseService.bills
        .find({
          createdAt: {
            $gte: startDate,
            $lte: endDate
          },
          scheduleId: { $in: scheduleIds }
        })
        .toArray()

      console.log(`Tìm thấy ${bills.length} hóa đơn trong tuần`)

      // Lọc bỏ hoá đơn trùng lặp dựa trên các thông tin quan trọng
      const uniqueBillsMap = new Map<string, IBill>()

      bills.forEach((bill) => {
        // Tạo key duy nhất cho mỗi hóa đơn dựa trên các thông tin chính
        const uniqueKey = this.getBillUniqueKey(bill)

        // Nếu key chưa tồn tại hoặc bill hiện tại được tạo sau bill đã lưu
        // thì sử dụng bill hiện tại (để lấy phiên bản mới nhất)
        if (
          !uniqueBillsMap.has(uniqueKey) ||
          new Date(bill.createdAt) > new Date(uniqueBillsMap.get(uniqueKey)!.createdAt)
        ) {
          uniqueBillsMap.set(uniqueKey, bill)
        }
      })

      // Chuyển map thành mảng
      const uniqueBills = Array.from(uniqueBillsMap.values())

      console.log(`Đã lọc từ ${bills.length} hóa đơn còn ${uniqueBills.length} hóa đơn sau khi xử lý trùng lặp`)

      // Calculate the total revenue from filtered bills
      const totalRevenue = uniqueBills.reduce((total, bill) => total + bill.totalAmount, 0)

      return {
        totalRevenue,
        bills: uniqueBills,
        startDate,
        endDate
      }
    } catch (error) {
      console.error('Lỗi khi lấy doanh thu theo tuần:', error)
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
  ): Promise<{ totalRevenue: number; bills: IBill[]; startDate: Date; endDate: Date }> {
    try {
      // Parse the input date and get the start/end of the month
      const targetDate = dayjs(date)
      const startOfMonth = targetDate.startOf('month')
      const endOfMonth = targetDate.endOf('month')

      // Convert to Date objects for MongoDB query
      const startDate = startOfMonth.toDate()
      const endDate = endOfMonth.toDate()

      console.log(`Tìm hóa đơn từ [${startDate.toISOString()}] đến [${endDate.toISOString()}]`)
      console.log(`Tháng: ${targetDate.format('MM/YYYY')}`)

      // Tìm tất cả roomSchedules đã hoàn thành trong tháng này
      const finishedSchedules = await databaseService.roomSchedule
        .find({
          // Trạng thái đã hoàn thành
          status: RoomScheduleStatus.Finished,
          // Thời gian kết thúc nằm trong tháng được chỉ định
          endTime: {
            $gte: startDate,
            $lte: endDate
          }
        })
        .toArray()

      console.log(`Tìm thấy ${finishedSchedules.length} lịch đặt phòng đã hoàn thành trong tháng`)

      // Lấy danh sách scheduleId
      const scheduleIds = finishedSchedules.map((schedule) => schedule._id)

      // Find all bills created within the month and only for completed schedules
      const bills = await databaseService.bills
        .find({
          createdAt: {
            $gte: startDate,
            $lte: endDate
          },
          scheduleId: { $in: scheduleIds }
        })
        .toArray()

      console.log(`Tìm thấy ${bills.length} hóa đơn trong tháng`)

      // Lọc bỏ hoá đơn trùng lặp dựa trên các thông tin quan trọng
      const uniqueBillsMap = new Map<string, IBill>()

      bills.forEach((bill) => {
        // Tạo key duy nhất cho mỗi hóa đơn dựa trên các thông tin chính
        const uniqueKey = this.getBillUniqueKey(bill)

        // Nếu key chưa tồn tại hoặc bill hiện tại được tạo sau bill đã lưu
        // thì sử dụng bill hiện tại (để lấy phiên bản mới nhất)
        if (
          !uniqueBillsMap.has(uniqueKey) ||
          new Date(bill.createdAt) > new Date(uniqueBillsMap.get(uniqueKey)!.createdAt)
        ) {
          uniqueBillsMap.set(uniqueKey, bill)
        }
      })

      // Chuyển map thành mảng
      const uniqueBills = Array.from(uniqueBillsMap.values())

      console.log(`Đã lọc từ ${bills.length} hóa đơn còn ${uniqueBills.length} hóa đơn sau khi xử lý trùng lặp`)

      // Calculate the total revenue from filtered bills
      const totalRevenue = uniqueBills.reduce((total, bill) => total + bill.totalAmount, 0)

      return {
        totalRevenue,
        bills: uniqueBills,
        startDate,
        endDate
      }
    } catch (error) {
      console.error('Lỗi khi lấy doanh thu theo tháng:', error)
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
  ): Promise<{ totalRevenue: number; bills: IBill[]; startDate: Date; endDate: Date }> {
    try {
      // Parse the input dates
      const start = dayjs(startDate).startOf('day')
      const end = dayjs(endDate).endOf('day')

      // Convert to Date objects for MongoDB query
      const startDateObj = start.toDate()
      const endDateObj = end.toDate()

      console.log(`Tìm hóa đơn từ [${startDateObj.toISOString()}] đến [${endDateObj.toISOString()}]`)
      console.log(`Khoảng thời gian: ${start.format('DD/MM/YYYY')} - ${end.format('DD/MM/YYYY')}`)

      // Validate date range
      if (start.isAfter(end)) {
        throw new ErrorWithStatus({
          message: 'Ngày bắt đầu phải trước ngày kết thúc',
          status: HTTP_STATUS_CODE.BAD_REQUEST
        })
      }

      // Tìm tất cả roomSchedules đã hoàn thành trong khoảng thời gian này
      const finishedSchedules = await databaseService.roomSchedule
        .find({
          // Trạng thái đã hoàn thành
          status: RoomScheduleStatus.Finished,
          // Thời gian kết thúc nằm trong khoảng thời gian được chỉ định
          endTime: {
            $gte: startDateObj,
            $lte: endDateObj
          }
        })
        .toArray()

      console.log(`Tìm thấy ${finishedSchedules.length} lịch đặt phòng đã hoàn thành trong khoảng thời gian chỉ định`)

      // Lấy danh sách scheduleId
      const scheduleIds = finishedSchedules.map((schedule) => schedule._id)

      // Find all bills created within the date range and only for completed schedules
      const bills = await databaseService.bills
        .find({
          createdAt: {
            $gte: startDateObj,
            $lte: endDateObj
          },
          scheduleId: { $in: scheduleIds }
        })
        .toArray()

      console.log(`Tìm thấy ${bills.length} hóa đơn trong khoảng thời gian chỉ định`)

      // Lọc bỏ hoá đơn trùng lặp dựa trên các thông tin quan trọng
      const uniqueBillsMap = new Map<string, IBill>()

      bills.forEach((bill) => {
        // Tạo key duy nhất cho mỗi hóa đơn dựa trên các thông tin chính
        const uniqueKey = this.getBillUniqueKey(bill)

        // Nếu key chưa tồn tại hoặc bill hiện tại được tạo sau bill đã lưu
        // thì sử dụng bill hiện tại (để lấy phiên bản mới nhất)
        if (
          !uniqueBillsMap.has(uniqueKey) ||
          new Date(bill.createdAt) > new Date(uniqueBillsMap.get(uniqueKey)!.createdAt)
        ) {
          uniqueBillsMap.set(uniqueKey, bill)
        }
      })

      // Chuyển map thành mảng
      const uniqueBills = Array.from(uniqueBillsMap.values())

      console.log(`Đã lọc từ ${bills.length} hóa đơn còn ${uniqueBills.length} hóa đơn sau khi xử lý trùng lặp`)

      // Calculate the total revenue from filtered bills
      const totalRevenue = uniqueBills.reduce((total, bill) => total + bill.totalAmount, 0)

      return {
        totalRevenue,
        bills: uniqueBills,
        startDate: startDateObj,
        endDate: endDateObj
      }
    } catch (error) {
      console.error('Lỗi khi lấy doanh thu theo khoảng thời gian:', error)
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
        const date = dayjs(dateString)
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
