import { TokenType } from '~/constants/enum'

export type JwtPayload = {
  user_id: string
  token_type: TokenType
  iat: number // Issued At Time
  exp: number // Expiration Time
}
