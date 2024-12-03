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
  Small = 'Small',
  Medium = 'Medium',
  Large = 'Large'
}

export enum RoomStatus {
  Available = 'Available',
  Occupied = 'Occupied',
  Cleaning = 'Cleaning',
  Reserved = 'Reserved', // Đặt trước
  Maintenance = 'Maintenance' // Bảo trì
}
