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

export enum HouseRuleStatus {
  Active = 'active',
  Inactive = 'inactive'
}

export enum UserRole {
  Admin = 'admin',
  User = 'user',
  Client = 'client'
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
