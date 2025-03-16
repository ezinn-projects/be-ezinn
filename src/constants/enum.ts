export enum UserVerifyStatus {
  Unverified,
  Verified,
  Banned
}

export enum TokenType {
  AccessToken,
  RefreshToken,
  ForgotPasswordToken,
  EmailVerificationToken
}

export enum UserRole {
  Admin = 'admin',
  Staff = 'staff',
  Client = 'client',
  User = 'user'
}

export enum RoomType {
  Small = 'small',
  Medium = 'medium',
  Large = 'large'
}

export enum RoomStatus {
  Available = 'available',
  Occupied = 'occupied',
  Cleaning = 'cleaning',
  Reserved = 'reserved',
  Maintenance = 'maintenance'
}

export enum DayType {
  Weekday = 'weekday',
  Weekend = 'weekend',
  Holiday = 'holiday'
}

export enum RoomScheduleStatus {
  Available = 'available',
  Booked = 'booked',
  InUse = 'in use',
  Maintenance = 'maintenance',
  Locked = 'locked',
  Cancelled = 'cancelled'
}
