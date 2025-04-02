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

// H�m m? h�a text �?ng
function encodeVietnameseText(text: string, encoding = 'windows-1258') {
  return iconv.encode(text, encoding)
}

// V� d? s? d?ng v?i text �?ng
const dynamicText = 'Xin chào, đây là hóa đơn của bạn!'
const encodedText = encodeVietnameseText(dynamicText)

export class BillService {
  private deviceData: any // L�u th�ng tin thi?t b? USB ��?c t?m th?y
  private transactionHistory: IBill[] = []

  private determineDayType(date: Date): DayType {
    const day = dayjs(date).day() // 0 = Ch? Nh?t, 6 = Th? B?y
    return day === 0 || day === 6 ? DayType.Weekend : DayType.Weekday
  }

  private calculateHours(startTime: Date, endTime: Date): number {
    const hours = dayjs(endTime).diff(startTime, 'hour', true)
    if (isNaN(hours) || hours < 0) {
      throw new ErrorWithStatus({
        message: 'Kho?ng th?i gian kh�ng h?p l?: endTime ph?i sau startTime',
        status: HTTP_STATUS_CODE.BAD_REQUEST
      })
    }
    return Math.floor(hours * 100) / 100
  }

  private readonly prices = {
    drinks: { water: 10000, soda: 15000, tea: 12000 },
    snacks: { regular: 10000, potato: 16000, medium: 10000 }
  }

  private async getServiceUnitPrice(startTime: Date, dayType: DayType, roomType: string): Promise<number> {
    const priceDoc = await databaseService.price.findOne({ day_type: dayType })
    if (!priceDoc || !priceDoc.time_slots) {
      throw new ErrorWithStatus({
        message: 'Không tìm thấy cấu hình giá',
        status: HTTP_STATUS_CODE.NOT_FOUND
      })
    }
    const time = dayjs(startTime).format('HH:mm')
    const timeSlot = priceDoc.time_slots.find((slot: any) => time >= slot.start && time <= slot.end)
    if (!timeSlot) {
      throw new ErrorWithStatus({
        message: 'Không tìm thấy khung giá phù hợp',
        status: HTTP_STATUS_CODE.NOT_FOUND
      })
    }
    const priceEntry = timeSlot.prices.find((p: any) => p.room_type === roomType)
    if (!priceEntry) {
      throw new ErrorWithStatus({
        message: 'Không tìm thấy giá cho loại phòng',
        status: HTTP_STATUS_CODE.NOT_FOUND
      })
    }
    return priceEntry.price
  }

  constructor() {
    try {
      // Patch �?i t�?ng usb to�n c?c n?u c?n (�? tr�nh l?i usb.on is not function)
      const usb = require('usb')
      if (typeof usb.on !== 'function') {
        const { EventEmitter } = require('events')
        Object.setPrototypeOf(usb, EventEmitter.prototype)
        usb.on = EventEmitter.prototype.on
      }
      // Kh?i t?o k?t n?i ban �?u �? ki?m tra m�y in
      const USB = require('escpos-usb')
      const devices = USB.findPrinter()
      console.log('Found devices:', devices)
      if (devices.length === 0) {
        throw new ErrorWithStatus({
          message: 'Không tìm thấy máy in USB',
          status: HTTP_STATUS_CODE.NOT_FOUND
        })
      }
      // L�u l?i th�ng tin c?a device �?u ti�n
      this.deviceData = devices[0]
      console.log('Printer device được lưu lại:', this.deviceData)
    } catch (error) {
      console.error('Lỗi khởi tạo máy in (constructor):', error)
    }
  }

  async getBill(scheduleId: string, actualEndTime?: string, paymentMethod?: string): Promise<IBill> {
    const id = new ObjectId(scheduleId)
    const schedule = await databaseService.roomSchedule.findOne({ _id: id })
    const orders = await databaseService.fnbOrder.find({ roomScheduleId: id }).toArray()
    const room = await databaseService.rooms.findOne({ _id: schedule?.roomId })
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
    const serviceFeeTotal = hoursUsed * serviceFeeUnitPrice

    const items: { description: string; quantity: number; unitPrice: number; totalPrice: number }[] = []
    orders.forEach((order) => {
      for (const drink in order.order.drinks) {
        const quantity = order.order.drinks[drink]
        const unitPrice = this.prices.drinks[drink as keyof typeof this.prices.drinks]
        const totalPrice = quantity * unitPrice
        items.push({
          description: drink === 'water' ? 'N�?c su?i' : drink === 'soda' ? 'N�?c ng?t' : 'Tr�',
          quantity,
          unitPrice,
          totalPrice
        })
      }
      for (const snack in order.order.snacks) {
        const quantity = order.order.snacks[snack]
        const unitPrice = this.prices.snacks[snack as keyof typeof this.prices.snacks]
        const totalPrice = quantity * unitPrice
        items.push({
          description: snack === 'regular' ? 'Snack th�?ng' : snack === 'potato' ? 'Snack khoai t�y' : 'Snack ngon',
          quantity,
          unitPrice,
          totalPrice
        })
      }
    })
    items.unshift({
      description: 'Phi dich vu thu am',
      quantity: hoursUsed,
      unitPrice: serviceFeeUnitPrice,
      totalPrice: serviceFeeTotal
    })
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
        quantity: item.quantity
      })),
      totalAmount,
      paymentMethod
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
      note: billData.note
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
        console.log('Found devices:', devices)

        if (devices.length === 0) {
          throw new Error('Khong tim thay may in USB')
        }

        // Lưu lại thông tin thiết bị tìm thấy để debug
        const printerDevice = devices[0]
        console.log('Printer device được lưu lại:', printerDevice)

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
            return reject(new Error('Loi mo may in: ' + error.message))
          }

          // In hóa đơn
          printer
            .font('a')
            .align('ct')
            .style('b')
            .size(1, 1)
            .text('Jozo Studio')
            .text('HOA DON THANH TOAN')
            .style('normal')
            .size(0, 0)
            .align('ct')
            .text('------------------------------')
            .align('lt')
            .text(`Ma HD: ${invoiceCode}`)
            .text(`ID: ${bill._id}`)
            .text('╭─────────────────────────╮')
            .text(`│ ${room?.roomName || 'Khong xac dinh'} │`)
            .text('╰─────────────────────────╯')
            .text(`Ngay: ${formatDate(new Date(bill.createdAt))}`)
            .text(`Gio bat dau: ${dayjs(bill.startTime).format('HH:mm')}`)
            .text(`Gio ket thuc: ${dayjs(bill.endTime).format('HH:mm')}`)
            .text(`Phuong thuc thanh toan: ${paymentMethodText}`)
            .align('ct')
            .text('------------------------------')
            .text('CHI TIET DICH VU')
            .text('------------------------------')
            .align('lt')

          // In tiêu đề cột
          printer
            .tableCustom([
              { text: 'Dich vu', width: 0.4, align: 'left' },
              { text: 'SL', width: 0.15, align: 'center' },
              { text: 'Don gia', width: 0.2, align: 'right' },
              { text: 'Thanh tien', width: 0.25, align: 'right' }
            ])
            .align('ct')
            .text('------------------------------')

          // In chi tiết từng mục
          bill.items.forEach((item) => {
            let description = item.description
            let quantity = item.quantity

            // Xử lý hiển thị cho phí dịch vụ thu âm
            if (description === 'Phí dịch vụ thu âm') {
              // Làm tròn đến 1 chữ số thập phân
              quantity = Math.round(quantity * 10) / 10
              description = 'Phi dich vu thu am'
            } else {
              // Đơn giản hóa tên các loại đồ ăn, nước uống
              description = description
                .replace('Nước suối', 'Nuoc suoi')
                .replace('Nước ngọt', 'Nuoc ngot')
                .replace('Trà', 'Tra')
                .replace('Snack thường', 'Snack thuong')
                .replace('Snack khoai tây', 'Snack khoai tay')
                .replace('Snack ngon', 'Snack ngon')
            }

            printer.tableCustom([
              { text: description, width: 0.4, align: 'left' },
              { text: quantity.toString(), width: 0.15, align: 'center' },
              { text: item.price.toLocaleString('vi-VN'), width: 0.2, align: 'right' },
              { text: (item.quantity * item.price).toLocaleString('vi-VN'), width: 0.25, align: 'right' }
            ])
          })

          printer
            .text('------------------------------')
            .align('rt')
            .style('b')
            .text(`TONG CONG: ${bill.totalAmount.toLocaleString('vi-VN')} VND`)
            .style('normal')
            .align('ct')
            .text('------------------------------')
            .text('Cam on quy khach da su dung dich vu')
            .text('Hen gap lai quy khach!')
            .text('------------------------------')
            .text('Dia chi: 123 Duong ABC, Quan XYZ, TP.HCM')
            .text('Hotline: 0123 456 789')
            .text('Website: www.jozo.vn')
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
      } catch (err: any) {
        reject(new Error('Loi khi in hoa don: ' + err.message))
      }
    })
  }
  public async generateBillPDF(bill: IBill, actualEndTime?: string): Promise<Buffer> {
    return new Promise<Buffer>(async (resolve, reject) => {
      try {
        // 1. T�nh to�n chi?u cao c�c ph?n c? �?nh
        const headerHeight = 50 // ph?n header (logo, slogan)
        const invoiceInfoHeight = 50 // ph?n th�ng tin h�a ��n
        const tableHeaderHeight = 12 // ti�u �? b?ng
        const footerHeight = 40 // ph?n footer (�?a ch?, c?m �n)
        let tableItemsHeight = 0

        // Duy?t qua t?ng item �? t�nh t?ng chi?u cao c?a c�c h�ng b?ng
        bill.items.forEach((item) => {
          let description = item.description
          // N?u c?n �p xu?ng d?ng v� d? v?i "Ph� d?ch v? thu �m"
          if (description === 'Ph� d?ch v? thu �m') {
            description = 'Ph� d?ch v?\nthu �m'
          }
          const values = [
            description,
            item.price.toFixed(2),
            item.quantity.toString(),
            (item.price * item.quantity).toFixed(2)
          ]
          // T�nh s? d?ng c?a m?i cell (d?a tr�n k? t? "\n") v� l?y s? d?ng l?n nh?t
          const maxLines = Math.max(...values.map((value) => value.split('\n').length))
          // Gi? s? m?i d?ng chi?m 12 �i?m
          const rowHeight = maxLines * 12
          tableItemsHeight += rowHeight
        })

        // C?ng d?n c�c ph?n v� th�m kho?ng padding
        let dynamicPageHeight =
          headerHeight + invoiceInfoHeight + tableHeaderHeight + tableItemsHeight + footerHeight + 40

        // V� d?: "c?t ��i t? A4" ngh?a l� chi?u cao kh�ng v�?t qu� 421 �i?m (n?a A4)
        const halfA4Height = 421
        if (dynamicPageHeight > halfA4Height) {
          dynamicPageHeight = halfA4Height
        }
        // N?u n?i dung qu� �t, c� th? �?t gi� tr? t?i thi?u (v� d? 300 �i?m)
        if (dynamicPageHeight < 300) {
          dynamicPageHeight = 300
        }

        // 2. T?o file PDF v?i k�ch th�?c ��?c t�nh: width gi? nguy�n A4 (595 �i?m) v� height = dynamicPageHeight
        const doc = new PDFDocument({
          autoFirstPage: false,
          size: [595, 842], // A4 portrait (595 x 842 points)
          margin: 20 // T�ng margin �? tr�nh c?t n?i dung
        })
        // ��ng k? font h? tr? ti?ng Vi?t
        doc.registerFont('DejaVuSans', path.join(__dirname, '..', 'fonts', 'DejaVuSans.ttf'))
        doc.font('DejaVuSans')

        const buffers: Uint8Array[] = []
        doc.on('data', buffers.push.bind(buffers))
        doc.on('end', () => {
          const pdfData = Buffer.concat(buffers)
          resolve(pdfData)
        })

        // 3. V? n?i dung PDF
        doc.addPage()

        // Header: C�n gi?a
        doc.fontSize(16).text('Jozo', { align: 'center' })
        doc.fontSize(12).text('Th�?ng th?c kh�ng gian c?a ch�ng t�i', { align: 'center' })
        doc.moveDown(1)

        // Th�ng tin h�a ��n: Gi?, nh�n vi�n, ph?ng (c�n gi?a)
        doc
          .fontSize(10)
          .text(`Gi? b?t �?u: ${bill.startTime.toLocaleString()}`, { align: 'center' })
          .text(`Gi? k?t th�c: ${bill.endTime.toLocaleString()}`, { align: 'center' })
          .text(`Nh�n vi�n: John Doe`, { align: 'center' })
          .text(`Ph?ng: ${bill.roomId.toString()}`, { align: 'center' })
        doc.moveDown(1)

        // Ti�u �? b?ng danh s�ch m?t h�ng (c�n gi?a)
        doc.fontSize(12).text('Danh s�ch m?t h�ng:', { underline: true, align: 'center' })
        doc.moveDown(0.5)

        // T�nh to�n chi?u r?ng c�c c?t: s? d?ng to�n b? chi?u r?ng trang (tr? margin)
        const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right
        const colWidths = [pageWidth * 0.4, pageWidth * 0.2, pageWidth * 0.2, pageWidth * 0.2] // �i?u ch?nh t? l? c�c c?t
        const startX = doc.page.margins.left
        let currentY = doc.y

        // V? ti�u �? c?t (c�n gi?a v� in �?m)
        const headers = ['M� t?', 'Gi�', 'SL', 'Th�nh ti?n']
        headers.forEach((header, i) => {
          const x = startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0)
          doc.font('DejaVuSans').text(header, x, currentY, { width: colWidths[i], align: 'center' })
        })
        doc.font('DejaVuSans') // Reset font
        currentY += 15
        doc.y = currentY
        doc.moveDown(0.5)

        // V? c�c h�ng c?a b?ng
        bill.items.forEach((item) => {
          let description = item.description
          if (description === 'Ph� d?ch v? thu �m') {
            description = 'Ph� d?ch v?\nthu �m'
          }
          const values = [
            description,
            item.price.toLocaleString('vi-VN') + '�',
            item.quantity.toString(),
            (item.price * item.quantity).toLocaleString('vi-VN') + '�'
          ]

          // T�nh s? d?ng c?a m?i cell v� l?y s? d?ng l?n nh?t l�m chi?u cao h�ng
          const maxLines = Math.max(...values.map((value) => value.split('\n').length))
          const rowHeight = maxLines * 15 // T�ng chi?u cao m?i d?ng

          // V? c�c cell c?a h�ng
          values.forEach((value, i) => {
            const x = startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0)
            doc.text(value, x, currentY, { width: colWidths[i], align: 'center' })
          })
          currentY += rowHeight
          doc.y = currentY
        })

        // T?ng ti?n thanh to�n (c�n gi?a v� in �?m)
        doc.moveDown(1)
        doc
          .font('DejaVuSans')
          .fontSize(12)
          .text(`T?ng ti?n: ${bill.totalAmount.toLocaleString('vi-VN')}�`, { align: 'center' })
        doc.font('DejaVuSans')
        doc.moveDown(1)

        // Footer: �?a ch? v� l?i c?m �n
        const availableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right
        doc
          .fontSize(10)
          .text('�?a ch?: S? 123, ��?ng ABC, Qu?n 1, TP. H? Ch� Minh', doc.page.margins.left, doc.y, {
            width: availableWidth,
            align: 'center'
          })
          .moveDown(0.5)
          .text('C?m �n qu? kh�ch �? s? d?ng d?ch v?!', doc.page.margins.left, doc.y, {
            width: availableWidth,
            align: 'center'
          })

        // K?t th�c file PDF
        doc.end()
      } catch (error: any) {
        reject(error)
      }
    })
  }
}

const billService = new BillService()
export default billService
