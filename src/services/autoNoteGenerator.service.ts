import { RoomType } from '~/constants/enum'

class AutoNoteGeneratorService {
  /**
   * Tự động tạo ghi chú đơn giản cho admin/staff
   */
  generateAdminNotes(
    virtualSize: RoomType,
    physicalSize: RoomType,
    customerRequestedSize: RoomType,
    upgraded: boolean
  ): { virtualSizeToUse: RoomType; staffInstructions: string } {
    return {
      virtualSizeToUse: virtualSize,
      staffInstructions: this.generateSimpleStaffInstructions(virtualSize, physicalSize, upgraded)
    }
  }

  /**
   * Tạo hướng dẫn đơn giản cho staff
   */
  private generateSimpleStaffInstructions(virtualSize: RoomType, physicalSize: RoomType, upgraded: boolean): string {
    if (upgraded) {
      return `UPGRADE: Sử dụng phòng như ${virtualSize} (do hết size nhỏ hơn)`
    }

    if (virtualSize !== physicalSize) {
      return `Sử dụng phòng như ${virtualSize} (Physical: ${physicalSize})`
    }

    return `Sử dụng phòng như ${virtualSize}`
  }

  /**
   * Tạo ghi chú booking đơn giản
   */
  generateBookingNote(
    customerName: string,
    customerPhone: string,
    virtualRoomName: string,
    virtualSize: RoomType,
    upgraded: boolean
  ): string {
    let note = `Booking by ${customerName} (${customerPhone})`

    if (upgraded) {
      note += ` - UPGRADE to ${virtualSize} (do hết size nhỏ hơn)`
    }

    return note
  }

  /**
   * Tạo notification message đơn giản
   */
  generateNotificationMessage(
    virtualRoomName: string,
    virtualSize: RoomType,
    customerName: string,
    upgraded: boolean
  ): string {
    let message = `${virtualRoomName} - ${customerName}`

    if (upgraded) {
      message += ` - UPGRADE to ${virtualSize} (do hết size nhỏ hơn)`
    }

    return message
  }
}

export const autoNoteGeneratorService = new AutoNoteGeneratorService()
