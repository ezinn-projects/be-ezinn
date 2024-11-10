export const USER_MESSAGES = {
  USER_NOT_FOUND: 'User not found',
  USERNAME_NOT_EMPTY: 'User name is not empty',
  INVALID_EMAIL: 'Invalid email',
  INVALID_FIELD: 'Validation error',
  USER_EXISTS: 'User already exists',
  EMAIL_EXISTS: 'Email already exists',
  INVALID_VERIFY_TOKEN: 'Invalid verify token',
  INVALID_FORGOT_PASSWORD_TOKEN: 'Invalid forgot password token',
  INVALID_USER: 'Invalid user',
  INVALID_REFRESH_TOKEN: 'Invalid refresh token',
  INVALID_LOGIN: 'Invalid username or password',
  INVALID_TOKEN: 'Invalid token',
  INVALID_VERIFY_EMAIL: 'Invalid verify email',
  INVALID_RESET_PASSWORD: 'Invalid reset password',
  INVALID_USER_VERIFY_STATUS: 'Invalid user verify status',
  INVALID_USER_BIO: 'Invalid user bio',
  INVALID_USER_LOCATION: 'Invalid user location',
  INVALID_USER_WEBSITE: 'Invalid user website',
  INVALID_USER_NAME: 'Name must be between 2 and 100 characters',
  USER_NOT_EXISTS: 'User not exists',
  INVALID_PASSWORD:
    'Password must be at least 6 characters long and contain at least one lowercase letter, one uppercase letter, one number, and one special character.',
  PASSWORD_NOT_MATCH: 'Password not match',
  PASSWORD_NOT_EMPTY: 'Password is not empty',
  CONFIRM_PASSWORD_NOT_EMPTY: 'Password confirm is not empty',
  EMAIL_NOT_EMPTY: 'Email is not empty',
  INVALID_DATE_OF_BIRTH: "Date of birth must be in ISO format 'YYYY-MM-DD'",
  LOGIN_SUCCESS: 'Login success',
  REGISTER_SUCCESS: 'Register success',
  ACCESS_TOKEN_NOT_EMPTY: 'Access token is not empty',
  REFRESH_TOKEN_NOT_EMPTY: 'Refresh token is not empty',
  LOGOUT_SUCCESS: 'Logout success'
} as const

export const HOUSE_RULES_MESSAGES = {
  ADD_HOUSE_RULES_SUCCESS: 'Add house rule success'
} as const

export const ROOM_TYPE_MESSAGES = {
  INVALID_ROOM_TYPE_ID: 'Invalid room type id',
  ROOM_TYPE_EXISTS: 'Room type already exists',
  ADD_ROOM_TYPE_SUCCESS: 'Add room type success',
  GET_ROOM_TYPES_SUCCESS: 'Get room types success',
  GET_ROOM_TYPE_BY_ID_SUCCESS: 'Get room type by id success',
  UPDATE_ROOM_TYPE_BY_ID_SUCCESS: 'Update room type by id success',
  DELETE_ROOM_TYPE_BY_ID_SUCCESS: 'Delete room type by id success',
  DELETE_MANY_ROOM_TYPES_SUCCESS: 'Delete many room types success',
  ROOM_TYPE_NOT_FOUND: 'Room type not found',
  INVALID_ROOM_TYPE_IDS: 'Invalid room type ids'
} as const
