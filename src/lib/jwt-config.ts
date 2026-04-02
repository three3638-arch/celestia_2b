const secret = process.env.JWT_SECRET
if (!secret) {
  throw new Error('JWT_SECRET environment variable is not set. Please configure it in .env file.')
}
export const JWT_SECRET = new TextEncoder().encode(secret)
export const COOKIE_NAME = 'celestia-token'
export const JWT_EXPIRES_IN = '7d'
export const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 // 7 days in seconds
