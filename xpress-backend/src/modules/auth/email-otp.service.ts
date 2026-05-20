import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { EmailOtpPurpose } from './interfaces/email-otp.interface';

type OtpEmailTemplate = {
  subject: string;
  text: string;
  html: string;
};

export type OtpDeliveryChannel = 'resend' | 'console';

@Injectable()
export class EmailOtpService {
  private readonly logger = new Logger(EmailOtpService.name);
  private resendClient: Resend | null = null;
  private resendApiKey: string | null = null;

  async sendOtpEmail(
    toEmail: string,
    code: string,
    purpose: EmailOtpPurpose,
  ): Promise<OtpDeliveryChannel> {
    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail =
      process.env.MAIL_FROM_EMAIL ?? process.env.RESEND_FROM_EMAIL;
    const fromName =
      process.env.MAIL_FROM_NAME ?? process.env.MAIL_BRAND_NAME ?? 'Xpress';
    const replyTo = process.env.MAIL_REPLY_TO;
    const brandName = process.env.MAIL_BRAND_NAME ?? fromName;
    const supportUrl = process.env.MAIL_SUPPORT_URL ?? '';
    const otpExpireMinutes = Number(process.env.MAIL_OTP_EXPIRE_MINUTES ?? 10);
    const locale = process.env.MAIL_LOCALE ?? 'vi';

    const template = this.buildOtpTemplate({
      code,
      purpose,
      brandName,
      supportUrl,
      otpExpireMinutes,
      locale,
    });

    if (!apiKey || !fromEmail) {
      const isProduction = process.env.NODE_ENV === 'production';
      if (isProduction) {
        this.logger.warn(
          `Resend chua cau hinh day du (RESEND_API_KEY / MAIL_FROM_EMAIL). Bo qua gui OTP email cho ${toEmail} (${purpose}).`,
        );
      } else {
        this.logger.warn(
          `Resend chua cau hinh day du. OTP cho ${toEmail} (${purpose}): ${code}`,
        );
      }
      return 'console';
    }

    const client = this.getResendClient(apiKey);

    const { error } = await client.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [toEmail],
      subject: template.subject,
      text: template.text,
      html: template.html,
      ...(replyTo ? { replyTo } : {}),
    });

    if (error) {
      this.logger.error(
        `Resend gui OTP that bai cho ${toEmail} (${purpose}): ${error.name} - ${error.message}`,
      );
      throw new Error(`Resend send failed: ${error.message}`);
    }

    return 'resend';
  }

  private getResendClient(apiKey: string): Resend {
    if (!this.resendClient || this.resendApiKey !== apiKey) {
      this.resendClient = new Resend(apiKey);
      this.resendApiKey = apiKey;
    }
    return this.resendClient;
  }

  private buildOtpTemplate(params: {
    code: string;
    purpose: EmailOtpPurpose;
    brandName: string;
    supportUrl: string;
    otpExpireMinutes: number;
    locale: string;
  }): OtpEmailTemplate {
    const { code, purpose, brandName, supportUrl, otpExpireMinutes, locale } =
      params;
    const isVietnamese = locale.toLowerCase().startsWith('vi');
    const actionLabel = this.getActionLabel(purpose, isVietnamese);
    const safeBrandName = this.escapeHtml(brandName);
    const safeCode = this.escapeHtml(code);
    const safeSupportUrl = this.escapeHtml(supportUrl);

    if (isVietnamese) {
      const subject = `[${brandName}] Ma OTP ${actionLabel}`;
      const text = [
        `Xin chào,`,
        ``,
        `Mã OTP để ${actionLabel} của bạn là: ${code}`,
        `Mã có hiệu lực trong ${otpExpireMinutes} phút.`,
        ``,
        `Vui lòng không chia sẻ mã này cho bất kỳ ai.`,
        `Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.`,
      ].join('\n');

      const supportBlock = supportUrl
        ? `<p style="margin:0;color:#6b7280;font-size:13px;line-height:20px;">Cần hỗ trợ? <a href="${safeSupportUrl}" style="color:#f25019;text-decoration:none;">Liên hệ chúng tôi</a>.</p>`
        : '';

      const html = `
<!doctype html>
<html lang="vi">
  <body style="margin:0;padding:0;background:#f5f7fb;font-family:Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fb;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
            <tr>
              <td style="background:#f25019;padding:16px 20px;color:#ffffff;font-size:18px;font-weight:700;">
                ${safeBrandName}
              </td>
            </tr>
            <tr>
              <td style="padding:24px 20px;">
                <p style="margin:0 0 12px 0;color:#111827;font-size:15px;line-height:24px;">Xin chao,</p>
                <p style="margin:0 0 16px 0;color:#111827;font-size:15px;line-height:24px;">
                  Ban dang thuc hien <strong>${this.escapeHtml(actionLabel)}</strong>. Su dung ma OTP ben duoi:
                </p>
                <div style="margin:0 0 16px 0;padding:12px 16px;border:1px dashed #f25019;border-radius:10px;background:#fff7f2;text-align:center;">
                  <span style="font-size:30px;letter-spacing:8px;font-weight:700;color:#111827;">${safeCode}</span>
                </div>
                <p style="margin:0 0 8px 0;color:#111827;font-size:14px;line-height:22px;">
                  Ma co hieu luc trong <strong>${otpExpireMinutes} phut</strong>.
                </p>
                <p style="margin:0 0 16px 0;color:#b91c1c;font-size:13px;line-height:20px;">
                  Khong chia se ma nay cho bat ky ai, ke ca nhan vien ho tro.
                </p>
                ${supportBlock}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`.trim();

      return { subject, text, html };
    }

    const subject = `[${brandName}] OTP code for ${actionLabel}`;
    const text = [
      `Hello,`,
      ``,
      `Your OTP code for ${actionLabel} is: ${code}`,
      `This code will expire in ${otpExpireMinutes} minutes.`,
      ``,
      `Do not share this code with anyone.`,
      `If you did not request this, you can ignore this email.`,
    ].join('\n');

    const supportBlock = supportUrl
      ? `<p style="margin:0;color:#6b7280;font-size:13px;line-height:20px;">Need help? <a href="${safeSupportUrl}" style="color:#f25019;text-decoration:none;">Contact support</a>.</p>`
      : '';

    const html = `
<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f5f7fb;font-family:Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fb;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
            <tr>
              <td style="background:#f25019;padding:16px 20px;color:#ffffff;font-size:18px;font-weight:700;">
                ${safeBrandName}
              </td>
            </tr>
            <tr>
              <td style="padding:24px 20px;">
                <p style="margin:0 0 12px 0;color:#111827;font-size:15px;line-height:24px;">Hello,</p>
                <p style="margin:0 0 16px 0;color:#111827;font-size:15px;line-height:24px;">
                  You are performing <strong>${this.escapeHtml(actionLabel)}</strong>. Use the OTP code below:
                </p>
                <div style="margin:0 0 16px 0;padding:12px 16px;border:1px dashed #f25019;border-radius:10px;background:#fff7f2;text-align:center;">
                  <span style="font-size:30px;letter-spacing:8px;font-weight:700;color:#111827;">${safeCode}</span>
                </div>
                <p style="margin:0 0 8px 0;color:#111827;font-size:14px;line-height:22px;">
                  This code expires in <strong>${otpExpireMinutes} minutes</strong>.
                </p>
                <p style="margin:0 0 16px 0;color:#b91c1c;font-size:13px;line-height:20px;">
                  Never share this code with anyone, including support staff.
                </p>
                ${supportBlock}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`.trim();

    return { subject, text, html };
  }

  private getActionLabel(
    purpose: EmailOtpPurpose,
    isVietnamese: boolean,
  ): string {
    if (purpose === 'REGISTER') {
      return isVietnamese ? 'dang ky tai khoan' : 'account registration';
    }
    if (purpose === 'CHANGE_PASSWORD') {
      return isVietnamese ? 'quen mat khau' : 'password reset';
    }
    return isVietnamese ? 'dang nhap' : 'login';
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
