export const USER_MESSAGES = {
  USER_NOT_FOUND: 'User not found',
  GET_USER_SUCCESS: 'Get user success',
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
  REFRESH_TOKEN_NOT_EMPTY: 'Refresh token is not empty',
  LOGOUT_SUCCESS: 'Logout success',
  INVALID_ROLE: 'Invalid role',
  ROLE_NOT_EMPTY: 'Role is not empty',
  PHONE_NUMBER_NOT_EMPTY: 'Phone number is not empty',
  INVALID_PHONE_NUMBER: 'Invalid phone number'
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

export const AUTH_MESSAGES = {
  ACCESS_TOKEN_NOT_EMPTY: 'Access token is not empty',
  INSUFFICIENT_PRIVILEGES: 'Your role does not have sufficient privileges for this operation'
} as const

export const ROOM_MESSAGES = {
  ADD_ROOM_TYPE_SUCCESS: 'Add room success',
  ROOM_EXISTS: 'Room already exists',
  GET_ROOM_SUCCESS: 'Get room success',
  GET_ROOMS_SUCCESS: 'Get rooms success',
  ROOM_NOT_FOUND: 'Room not found',
  UPDATE_ROOM_SUCCESS: 'Update room success',
  DELETE_ROOM_SUCCESS: 'Delete room success'
} as const

export const SONG_QUEUE_MESSAGES = {
  ADD_SONG_TO_QUEUE_SUCCESS: 'Add song to queue success',
  REMOVE_SONG_FROM_QUEUE_SUCCESS: 'Remove song from queue success',
  REMOVE_ALL_SONGS_IN_QUEUE_SUCCESS: 'Remove all songs in queue success',
  NO_SONG_IN_QUEUE: 'No song in queue',
  SONG_IS_NOW_PLAYING: 'Song is now playing',
  GET_SONGS_IN_QUEUE_SUCCESS: 'Get songs in queue success',
  SONG_PLAYING: 'Song is playing',
  SONG_PAUSED: 'Song is paused',
  SONG_SKIPPED: 'Song is skipped',
  GET_VIDEO_INFO_SUCCESS: 'Get video info success',
  UPDATE_QUEUE_SUCCESS: 'Update queue success'
} as const

export const Price_MESSAGES = {
  GET_Price_SUCCESS: 'Get Price success',
  GET_Price_BY_ID_SUCCESS: 'Get Price by id success',
  CREATE_Price_SUCCESS: 'Create Price success',
  UPDATE_Price_SUCCESS: 'Update Price success',
  DELETE_Price_SUCCESS: 'Delete Price success',
  DELETE_MULTIPLE_Price_SUCCESS: 'Delete multiple Price success',
  Price_NOT_FOUND: 'Price not found',
  Price_EXISTS: 'Price already exists'
} as const

export const ROOM_CATEGORY_MESSAGES = {
  CREATE_ROOM_CATEGORY_SUCCESS: 'Create room category success',
  GET_ALL_ROOM_CATEGORIES_SUCCESS: 'Get all room categories success',
  GET_ROOM_CATEGORY_BY_ID_SUCCESS: 'Get room category by id success',
  UPDATE_ROOM_CATEGORY_SUCCESS: 'Update room category success',
  DELETE_ROOM_CATEGORY_SUCCESS: 'Delete room category success',
  DELETE_MULTIPLE_ROOM_CATEGORY_SUCCESS: 'Delete multiple room category success',
  ROOM_CATEGORY_EXISTS: 'Room category already exists',
  ROOM_CATEGORY_NOT_FOUND: 'Room category not found',
  ROOM_CATEGORY_NAME_ALREADY_EXISTS: 'Room category name already exists'
} as const
