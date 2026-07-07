export type EmailOtpPurpose =
  | 'REGISTER'
  | 'LOGIN'
  | 'CHANGE_PASSWORD'
  | 'TWO_FACTOR_SETUP'
  | 'TWO_FACTOR_DISABLE';

export interface EmailOtpEntity {
  PK: string; // OTP#{email}
  SK: string; // OTP#{purpose}
  entityType: 'EMAIL_OTP';

  email: string;
  purpose: EmailOtpPurpose;
  codeHash: string;
  expiresAt: string;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  updatedAt: string;
}
