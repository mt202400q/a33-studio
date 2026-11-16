/** a33.club account IpcApi error codes. Import directly from this module on both sides. */
export const a33AccountErrorCodes = {
  /** Wrong email or password. */
  INVALID_CREDENTIALS: 'A33_ACCOUNT_INVALID_CREDENTIALS',
  /** The two-factor code was rejected or the 2FA step expired. */
  INVALID_2FA_CODE: 'A33_ACCOUNT_INVALID_2FA_CODE',
  /** The account is disabled on a33.club. */
  INACTIVE: 'A33_ACCOUNT_INACTIVE',
  /** a33.club rate-limited the request. */
  RATE_LIMITED: 'A33_ACCOUNT_RATE_LIMITED',
  /** No a33.club session, or it was revoked. */
  NOT_SIGNED_IN: 'A33_ACCOUNT_NOT_SIGNED_IN',
  /** a33.club refused the request; the error message is the server's own text. */
  REQUEST_FAILED: 'A33_ACCOUNT_REQUEST_FAILED'
} as const
