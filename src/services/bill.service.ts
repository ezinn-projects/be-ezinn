import dayjs from 'dayjs'
import * as escpos from 'escpos'
import iconv from 'iconv-lite'
import { ObjectId } from 'mongodb'
import { DayType } from '~/constants/enum'
import { HTTP_STATUS_CODE } from '~/constants/httpStatus'
import { ErrorWithStatus } from '~/models/Error'
import { IBill } from '~/models/schemas/Bill.schema'
import databaseService from './database.service'
import promotionService from './promotion.service'
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

  private determineDayType(date: Date): DayType {
    const day = date.getDay()
    if (day === 0 || day === 6) {
      return DayType.Weekend
    } else {
      return DayType.Weekday
    }
  }

  private calculateHours(start: Date, end: Date): number {
    const diffInMs = end.getTime() - start.getTime()
    const diffInHours = diffInMs / (1000 * 60 * 60)

    // Tính toán số giờ và phút
    const hours = Math.floor(diffInHours)
    const minutes = Math.floor((diffInHours - hours) * 60)

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

  async getBill(scheduleId: string, actualEndTime?: string, paymentMethod?: string): Promise<IBill> {
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
    const dayType = this.determineDayType(new Date(schedule.startTime))
    const serviceFeeUnitPrice = await this.getServiceUnitPrice(
      new Date(schedule.startTime),
      dayType,
      room?.roomType || ''
    )
    const endTime = actualEndTime ? new Date(actualEndTime) : new Date(schedule.endTime as Date)
    if (!dayjs(endTime).isValid()) {
      throw new ErrorWithStatus({
        message: 'Thời gian kết thúc không hợp lý',
        status: HTTP_STATUS_CODE.BAD_REQUEST
      })
    }
    const hoursUsed = this.calculateHours(new Date(schedule.startTime), endTime)

    // Làm tròn xuống phí dịch vụ thu âm (chia cho 1000 rồi nhân lại)
    const roundedServiceFeeTotal = Math.floor((hoursUsed * serviceFeeUnitPrice) / 1000) * 1000

    const items: {
      description: string
      quantity: number
      unitPrice: number
      totalPrice: number
      originalPrice?: number
      discountPercentage?: number
      discountName?: string
    }[] = []

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

    // Thêm phí dịch vụ thu âm vào đầu danh sách
    items.unshift({
      description: 'Phi dich vu thu am',
      quantity: hoursUsed,
      unitPrice: serviceFeeUnitPrice,
      totalPrice: roundedServiceFeeTotal
    })

    // Lấy active promotion
    const activePromotion = await promotionService.getActivePromotion()

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
    const bill: IBill = {
      _id: new ObjectId(),
      scheduleId: new ObjectId(billData.scheduleId),
      roomId: new ObjectId(billData.roomId),
      items: billData.items,
      totalAmount: billData.totalAmount,
      startTime: billData.startTime,
      endTime: billData.endTime,
      createdAt: new Date(),
      paymentMethod: billData.paymentMethod,
      note: billData.note,
      activePromotion: billData.activePromotion
    }

    // Save bill to the database
    await databaseService.bills.insertOne(bill)

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
              description = 'Phi dich vu thu am'
            }

            // Giới hạn độ dài của description để tránh bị tràn
            if (description.length > 20) {
              description = description.substring(0, 17) + '...'
            }

            // Định dạng số tiền để hiển thị gọn hơn
            const formattedPrice = item.price >= 1000 ? `${Math.floor(item.price / 1000)}K` : item.price.toString()

            // Hiển thị giá gốc và giá sau khuyến mãi nếu có
            let formattedTotal = ''
            if (item.originalPrice && item.discountPercentage) {
              // Giá đã giảm
              const discountedPrice =
                item.quantity * item.price - Math.floor((item.quantity * item.price * item.discountPercentage) / 100)
              formattedTotal =
                discountedPrice >= 1000 ? `${Math.floor(discountedPrice / 1000)}K` : discountedPrice.toString()

              // In mục chính với giá gốc
              printer.tableCustom([
                { text: description, width: 0.45, align: 'left' },
                { text: quantity.toString(), width: 0.15, align: 'center' },
                { text: formattedPrice, width: 0.2, align: 'right' },
                {
                  text:
                    item.originalPrice >= 1000
                      ? `${Math.floor(item.originalPrice / 1000)}K`
                      : item.originalPrice.toString(),
                  width: 0.2,
                  align: 'right'
                }
              ])

              // Tính số tiền giảm giá
              const discountAmount = Math.floor((item.quantity * item.price * item.discountPercentage) / 100)
              const formattedDiscount =
                discountAmount >= 1000 ? `-${Math.floor(discountAmount / 1000)}K` : `-${discountAmount}`

              // In thông tin khuyến mãi với dấu "-" ở cả tên và số tiền
              printer.tableCustom([
                {
                  text: `  - ${item.discountName || ''} (${item.discountPercentage}%)`,
                  width: 0.8,
                  align: 'left'
                },
                { text: formattedDiscount, width: 0.2, align: 'right' }
              ])
            } else {
              // Không có khuyến mãi, hiển thị bình thường
              formattedTotal =
                item.quantity * item.price >= 1000
                  ? `${Math.floor((item.quantity * item.price) / 1000)}K`
                  : (item.quantity * item.price).toString()

              // Cân đối lại các cột
              printer.tableCustom([
                { text: description, width: 0.45, align: 'left' },
                { text: quantity.toString(), width: 0.15, align: 'center' },
                { text: formattedPrice, width: 0.2, align: 'right' },
                { text: formattedTotal, width: 0.2, align: 'right' }
              ])
            }
          })

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
  }

  /**
   * Get total revenue for a specific date
   * @param date Date to get revenue for (format: ISO date string)
   * @returns Object containing total revenue and bill details
   */
  async getDailyRevenue(date: string): Promise<{ totalRevenue: number; bills: IBill[] }> {
    // Parse the input date and adjust for Vietnam timezone
    const inputDate = dayjs(date).tz('Asia/Ho_Chi_Minh')
    const targetDate = inputDate.startOf('day')
    const nextDay = targetDate.add(1, 'day')

    // Convert to Date objects for MongoDB query
    const startDate = targetDate.toDate()
    const endDate = nextDay.toDate()

    console.log(`Tìm hóa đơn từ [${startDate.toISOString()}] đến [${endDate.toISOString()}]`)
    console.log(`Ngày được chỉ định: ${inputDate.format('YYYY-MM-DD')}`)

    // Find all bills created on the target date, using createdAt
    const bills = await databaseService.bills
      .find({
        createdAt: {
          $gte: startDate,
          $lt: endDate
        }
      })
      .toArray()

    // Log số lượng hóa đơn tìm được
    console.log(`Tìm thấy ${bills.length} hóa đơn theo createdAt`)

    // Nếu không tìm thấy hóa đơn, thử kiểm tra tất cả hóa đơn để debug
    if (bills.length === 0) {
      const allBills = await databaseService.bills.find({}).limit(20).toArray()
      console.log(`Danh sách ${allBills.length} hóa đơn gần nhất:`)
      allBills.forEach((bill) => {
        const createdAtDate = dayjs(bill.createdAt).tz('Asia/Ho_Chi_Minh').format('YYYY-MM-DD HH:mm:ss')
        console.log(`- Hóa đơn ${bill._id}: createdAt=${createdAtDate}, totalAmount=${bill.totalAmount}`)
      })

      // Thử tìm kiếm bằng cách so sánh ngày tháng dưới dạng chuỗi
      const dateString = inputDate.format('YYYY-MM-DD')
      console.log(`Thử tìm hóa đơn cho ngày: ${dateString}`)

      const manualFilteredBills = allBills.filter((bill) => {
        const billDate = dayjs(bill.createdAt).tz('Asia/Ho_Chi_Minh').format('YYYY-MM-DD')
        const matches = billDate === dateString
        if (matches) {
          console.log(`- Tìm thấy hóa đơn phù hợp: ${bill._id}, ngày ${billDate}`)
        }
        return matches
      })

      if (manualFilteredBills.length > 0) {
        console.log(`Tìm thấy ${manualFilteredBills.length} hóa đơn bằng lọc thủ công theo ngày`)
        return {
          totalRevenue: manualFilteredBills.reduce((total, bill) => total + bill.totalAmount, 0),
          bills: manualFilteredBills
        }
      }
    }

    // Calculate the total revenue
    const totalRevenue = bills.reduce((total, bill) => total + bill.totalAmount, 0)

    return {
      totalRevenue,
      bills
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
    // Parse the input date and get the start/end of the week (Vietnam timezone)
    const targetDate = dayjs(date).tz('Asia/Ho_Chi_Minh')
    const startOfWeek = targetDate.startOf('week')
    const endOfWeek = targetDate.endOf('week')

    // Convert to Date objects for MongoDB query
    const startDate = startOfWeek.toDate()
    const endDate = endOfWeek.toDate()

    console.log(`Tìm hóa đơn từ [${startDate.toISOString()}] đến [${endDate.toISOString()}]`)
    console.log(`Tuần chứa ngày: ${targetDate.format('YYYY-MM-DD')}`)

    // Find all bills created within the week
    const bills = await databaseService.bills
      .find({
        createdAt: {
          $gte: startDate,
          $lte: endDate
        }
      })
      .toArray()

    console.log(`Tìm thấy ${bills.length} hóa đơn trong tuần`)

    // Calculate the total revenue
    const totalRevenue = bills.reduce((total, bill) => total + bill.totalAmount, 0)

    return {
      totalRevenue,
      bills,
      startDate,
      endDate
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
    // Parse the input date and get the start/end of the month (Vietnam timezone)
    const targetDate = dayjs(date).tz('Asia/Ho_Chi_Minh')
    const startOfMonth = targetDate.startOf('month')
    const endOfMonth = targetDate.endOf('month')

    // Convert to Date objects for MongoDB query
    const startDate = startOfMonth.toDate()
    const endDate = endOfMonth.toDate()

    console.log(`Tìm hóa đơn từ [${startDate.toISOString()}] đến [${endDate.toISOString()}]`)
    console.log(`Tháng: ${targetDate.format('MM/YYYY')}`)

    // Find all bills created within the month
    const bills = await databaseService.bills
      .find({
        createdAt: {
          $gte: startDate,
          $lte: endDate
        }
      })
      .toArray()

    console.log(`Tìm thấy ${bills.length} hóa đơn trong tháng`)

    // Calculate the total revenue
    const totalRevenue = bills.reduce((total, bill) => total + bill.totalAmount, 0)

    return {
      totalRevenue,
      bills,
      startDate,
      endDate
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
    // Parse the input dates (Vietnam timezone)
    const start = dayjs(startDate).tz('Asia/Ho_Chi_Minh').startOf('day')
    const end = dayjs(endDate).tz('Asia/Ho_Chi_Minh').endOf('day')

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

    // Find all bills created within the date range
    const bills = await databaseService.bills
      .find({
        createdAt: {
          $gte: startDateObj,
          $lte: endDateObj
        }
      })
      .toArray()

    console.log(`Tìm thấy ${bills.length} hóa đơn trong khoảng thời gian chỉ định`)

    // Calculate the total revenue
    const totalRevenue = bills.reduce((total, bill) => total + bill.totalAmount, 0)

    return {
      totalRevenue,
      bills,
      startDate: startDateObj,
      endDate: endDateObj
    }
  }
}

const billService = new BillService()
export default billService
