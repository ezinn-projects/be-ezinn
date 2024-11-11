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
