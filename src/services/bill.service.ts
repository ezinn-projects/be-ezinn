import { ObjectId } from 'mongodb'
import databaseService from './database.service'
import { DayType, RoomScheduleStatus } from '~/constants/enum'
import { Bill, IBill } from '~/models/schemas/Bill.schema'
import dayjs from 'dayjs'
import * as escpos from 'escpos'
import iconv from 'iconv-lite'
import PDFDocument from 'pdfkit'
import path from 'path'
import { ErrorWithStatus } from '~/models/Error'
import { HTTP_STATUS_CODE } from '~/constants/httpStatus'
import promotionService from './promotion.service'

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

    // Lấy thời gian hiện tại dưới dạng HH:mm để so sánh với khung giờ
    const time = dayjs(startTime).format('HH:mm')

    // Tìm khung giờ phù hợp với thời gian bắt đầu
    const timeSlot = priceDoc.time_slots.find((slot: any) => {
      // Xử lý trường hợp khung giờ bắt đầu > khung giờ kết thúc (qua ngày)
      if (slot.start > slot.end) {
        return time >= slot.start || time <= slot.end
      }
      // Trường hợp bình thường
      return time >= slot.start && time <= slot.end
    })

    if (!timeSlot) {
      throw new ErrorWithStatus({
        message: 'Không tìm thấy khung giá phù hợp cho thời gian ' + time,
        status: HTTP_STATUS_CODE.NOT_FOUND
      })
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

    // Áp dụng khuyến mãi nếu có
    const activePromotion = await promotionService.getActivePromotion()
    if (activePromotion) {
      // Áp dụng khuyến mãi cho từng mục
      for (let i = 0; i < items.length; i++) {
        if ((activePromotion.appliesTo === 'sing' && i === 0) || activePromotion.appliesTo === 'all') {
          const originalPrice = items[i].totalPrice
          const discountAmount = Math.floor((originalPrice * activePromotion.discountPercentage) / 100)

          items[i].originalPrice = originalPrice
          items[i].totalPrice = originalPrice - discountAmount
          items[i].discountPercentage = activePromotion.discountPercentage
          items[i].discountName = activePromotion.name
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

  // Hàm tạo mã hóa đơn ngẫu nhiên
  private generateInvoiceCode(): string {
    const timestamp = new Date().getTime().toString().slice(-6)
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0')
    return `JZ${timestamp}${random}`
  }

  public async generateBillPDF(bill: IBill, actualEndTime?: string): Promise<Buffer> {
    return new Promise<Buffer>(async (resolve, reject) => {
      try {
        // 1. Tính toán chiều cao các phần cố định
        const headerHeight = 50 // phần header (logo, slogan)
        const invoiceInfoHeight = 50 // phần thông tin hóa đơn
        const tableHeaderHeight = 12 // tiêu đề bảng
        const footerHeight = 40 // phần footer (địa chỉ, cảm ơn)
        let tableItemsHeight = 0

        // Duyệt qua từng item để tính tổng chiều cao của các hàng bảng
        bill.items.forEach((item) => {
          let description = item.description
          // Nếu cần xuống dòng và dị với "Phí dịch vụ thu âm"
          if (description === 'Phí dịch vụ thu âm') {
            description = 'Phí dịch vụ thu âm'
          }
          const values = [
            description,
            item.price.toFixed(2),
            item.quantity.toString(),
            (item.price * item.quantity).toFixed(2)
          ]
          // Tính số dùng của mỗi cell (dựa trên kí tự "\n") và lấy số dùng lớn nhất
          const maxLines = Math.max(...values.map((value) => value.split('\n').length))
          // Giả sử mỗi dòng chiếm 12 điểm
          const rowHeight = maxLines * 12
          tableItemsHeight += rowHeight
        })

        // Cộng dồn các phần và thêm khoảng padding
        let dynamicPageHeight =
          headerHeight + invoiceInfoHeight + tableHeaderHeight + tableItemsHeight + footerHeight + 40

        // Ví dụ: "cắt ở điểm A4" nghĩa là chiều cao không vượt quá 421 điểm (nửa A4)
        const halfA4Height = 421
        if (dynamicPageHeight > halfA4Height) {
          dynamicPageHeight = halfA4Height
        }
        // Nếu nội dung quá ít, có thể đặt giá trị tối thiểu (ví dụ 300 điểm)
        if (dynamicPageHeight < 300) {
          dynamicPageHeight = 300
        }

        // 2. Tạo file PDF với kích thước được tính: width giữ nguyên A4 (595 điểm) và height = dynamicPageHeight
        const doc = new PDFDocument({
          autoFirstPage: false,
          size: [595, 842], // A4 portrait (595 x 842 points)
          margin: 20 // Tăng margin để tránh cắt nội dung
        })
        // Đăng kí font hỗ trợ tiếng Việt
        doc.registerFont('DejaVuSans', path.join(__dirname, '..', 'fonts', 'DejaVuSans.ttf'))
        doc.font('DejaVuSans')

        const buffers: Uint8Array[] = []
        doc.on('data', buffers.push.bind(buffers))
        doc.on('end', () => {
          const pdfData = Buffer.concat(buffers)
          resolve(pdfData)
        })

        // 3. Vẽ nội dung PDF
        doc.addPage()

        // Header: Căn giữa
        doc.fontSize(16).text('Jozo', { align: 'center' })
        doc.fontSize(12).text('Thông thức không gian của chúng tôi', { align: 'center' })
        doc.moveDown(1)

        // Thông tin hóa đơn: Giờ, nhân viên, phòng (căn giữa)
        doc
          .fontSize(10)
          .text(`Giờ bắt đầu: ${bill.startTime.toLocaleString()}`, { align: 'center' })
          .text(`Giờ kết thúc: ${bill.endTime.toLocaleString()}`, { align: 'center' })
          .text(`Nhân viên: John Doe`, { align: 'center' })
          .text(`Phòng: ${bill.roomId.toString()}`, { align: 'center' })
        doc.moveDown(1)

        // Tiêu đề bảng danh sách một hàng (căn giữa)
        doc.fontSize(12).text('Danh sách một hàng:', { underline: true, align: 'center' })
        doc.moveDown(0.5)

        // Tính toán chiều rộng các cột: sử dụng toàn bộ chiều rộng trang (trừ margin)
        const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right
        const colWidths = [pageWidth * 0.4, pageWidth * 0.2, pageWidth * 0.2, pageWidth * 0.2] // Điều chỉnh tỉ lệ các cột
        const startX = doc.page.margins.left
        let currentY = doc.y

        // Vẽ tiêu đề cột (căn giữa và in đầm)
        const headers = ['Mục', 'Giá', 'SL', 'Thành tiền']
        headers.forEach((header, i) => {
          const x = startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0)
          doc.font('DejaVuSans').text(header, x, currentY, { width: colWidths[i], align: 'center' })
        })
        doc.font('DejaVuSans') // Reset font
        currentY += 15
        doc.y = currentY
        doc.moveDown(0.5)

        // Vẽ các hàng của bảng
        bill.items.forEach((item) => {
          let description = item.description
          if (description === 'Phí dịch vụ thu âm') {
            description = 'Phí dịch vụ thu âm'
          }
          const values = [
            description,
            item.price.toLocaleString('vi-VN') + 'đ',
            item.quantity.toString(),
            (item.price * item.quantity).toLocaleString('vi-VN') + 'đ'
          ]

          // Tính số dùng của mỗi cell và lấy số dùng lớn nhất làm chiều cao hàng
          const maxLines = Math.max(...values.map((value) => value.split('\n').length))
          const rowHeight = maxLines * 15 // Tăng chiều cao mỗi dòng

          // Vẽ các cell của hàng
          values.forEach((value, i) => {
            const x = startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0)
            doc.text(value, x, currentY, { width: colWidths[i], align: 'center' })
          })
          currentY += rowHeight
          doc.y = currentY
        })

        // Tổng tiền thanh toán (căn giữa và in đầm)
        doc.moveDown(1)
        doc
          .font('DejaVuSans')
          .fontSize(12)
          .text(`Tổng tiền: ${bill.totalAmount.toLocaleString('vi-VN')}đ`, { align: 'center' })
        doc.font('DejaVuSans')
        doc.moveDown(1)

        // Footer: Địa chỉ và lời cảm ơn
        const availableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right
        doc
          .fontSize(10)
          .text('Địa chỉ: Số 123, Đường ABC, Quận 1, TP. Hồ Chí Minh', doc.page.margins.left, doc.y, {
            width: availableWidth,
            align: 'center'
          })
          .moveDown(0.5)
          .text('Cảm ơn quý khách đã sử dụng dịch vụ của Jozo', doc.page.margins.left, doc.y, {
            width: availableWidth,
            align: 'center'
          })

        // Add promotion info to the PDF bill
        if (bill.activePromotion) {
          doc.text(
            `Applied promotion: ${bill.activePromotion.name} - ${bill.activePromotion.discountPercentage}% off`,
            {
              align: 'center'
            }
          )
        }

        // Kết thúc file PDF
        doc.end()
      } catch (error: any) {
        reject(error)
      }
    })
  }
}

const billService = new BillService()
export default billService
