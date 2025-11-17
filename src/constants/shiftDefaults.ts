import { ShiftType } from './enum'

export const DEFAULT_SHIFT_TIMES = {
  [ShiftType.Morning]: {
    name: 'Ca Sáng',
    startTime: '12:00',
    endTime: '17:00'
  },
  [ShiftType.Afternoon]: {
    name: 'Ca Chiều',
    startTime: '17:00',
    endTime: '22:00'
  },
  [ShiftType.All]: {
    name: 'Cả Ngày',
    startTime: '12:00',
    endTime: '22:00'
  }
} as const

// Helper function to get shift info
export function getShiftInfo(shiftType: ShiftType, customStartTime?: string, customEndTime?: string) {
  const defaultShift = DEFAULT_SHIFT_TIMES[shiftType]
  
  return {
    name: defaultShift.name,
    startTime: customStartTime || defaultShift.startTime,
    endTime: customEndTime || defaultShift.endTime
  }
}

