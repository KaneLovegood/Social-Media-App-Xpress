import { Injectable, Logger } from '@nestjs/common';
import { createTransport } from 'nodemailer';
import { EmailOtpPurpose } from './interfaces/email-otp.interface';

type OtpEmailTemplate = {
  subject: string;
  text: string;
  html: string;
};

type SmtpTransportOptions = {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  pool?: boolean;
  maxConnections?: number;
  maxMessages?: number;
  connectionTimeout?: number;
  greetingTimeout?: number;
  socketTimeout?: number;
  tls?: { rejectUnauthorized?: boolean; servername?: string };
};

type SmtpMailOptions = {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
};

type MailTransporter = {
  sendMail: (options: SmtpMailOptions) => Promise<unknown>;
  verify?: () => Promise<true>;
  close?: () => void;
};

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
};

type BrevoSendInput = {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  toEmail: string;
  subject: string;
  text: string;
  html: string;
  replyToEmail?: string;
  replyToName?: string;
};

type MailChannel = 'brevo' | 'smtp' | 'console';

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';
const BREVO_TIMEOUT_MS = 15_000;

@Injectable()
export class EmailOtpService {
  private readonly logger = new Logger(EmailOtpService.name);
  private transporter: MailTransporter | null = null;
  private transporterKey: string | null = null;
  private verifyPromise: Promise<void> | null = null;

  async sendOtpEmail(
    toEmail: string,
    code: string,
    purpose: EmailOtpPurpose,
  ): Promise<MailChannel> {
    const fromName =
      process.env.MAIL_FROM_NAME ?? process.env.MAIL_BRAND_NAME ?? 'Xpress';
    const brandName = process.env.MAIL_BRAND_NAME ?? fromName;
    const supportUrl = process.env.MAIL_SUPPORT_URL ?? '';
    const otpExpireMinutes = Number(process.env.MAIL_OTP_EXPIRE_MINUTES ?? 10);
    const locale = process.env.MAIL_LOCALE ?? 'vi';
    const replyToEmail = process.env.MAIL_REPLY_TO;
    const replyToName = process.env.MAIL_REPLY_TO_NAME;

    const template = this.buildOtpTemplate({
      code,
      purpose,
      brandName,
      supportUrl,
      otpExpireMinutes,
      locale,
    });

    const providerOverride = (process.env.MAIL_PROVIDER ?? '').toLowerCase();
    const brevoApiKey = process.env.BREVO_API_KEY?.trim();
    const brevoFromEmail =
      process.env.BREVO_SENDER_EMAIL ??
      process.env.MAIL_FROM_EMAIL ??
      process.env.SMTP_FROM_EMAIL;
    const brevoFromName = process.env.BREVO_SENDER_NAME ?? fromName;

    const useBrevo =
      providerOverride === 'brevo' ||
      (providerOverride === '' && !!brevoApiKey);

    if (useBrevo) {
      if (!brevoApiKey) {
        this.logger.warn(
          `MAIL_PROVIDER=brevo nhung BREVO_API_KEY chua co. Bo qua gui OTP cho ${toEmail} (${purpose}).`,
        );
        return this.consoleFallback(toEmail, code, purpose);
      }
      if (!brevoFromEmail) {
        this.logger.warn(
          `Brevo can BREVO_SENDER_EMAIL hoac MAIL_FROM_EMAIL (sender da verify). Bo qua gui OTP cho ${toEmail}.`,
        );
        return this.consoleFallback(toEmail, code, purpose);
      }

      await this.sendViaBrevo({
        apiKey: brevoApiKey,
        fromEmail: brevoFromEmail,
        fromName: brevoFromName,
        toEmail,
        subject: template.subject,
        text: template.text,
        html: template.html,
        replyToEmail,
        replyToName,
      });
      return 'brevo';
    }

    return this.sendViaSmtp({
      toEmail,
      code,
      purpose,
      template,
      fromName,
      replyTo: replyToEmail,
    });
  }

  private async sendViaBrevo(input: BrevoSendInput): Promise<void> {
    const body: Record<string, unknown> = {
      sender: { name: input.fromName, email: input.fromEmail },
      to: [{ email: input.toEmail }],
      subject: input.subject,
      htmlContent: input.html,
      textContent: input.text,
    };
    if (input.replyToEmail) {
      body.replyTo = input.replyToName
        ? { email: input.replyToEmail, name: input.replyToName }
        : { email: input.replyToEmail };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), BREVO_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(BREVO_ENDPOINT, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'api-key': input.apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      const e = err as { name?: string; message?: string };
      const isAbort = e.name === 'AbortError';
      this.logger.error(
        `Brevo request failed (network) to=${input.toEmail} ` +
          `abort=${isAbort} msg=${e.message ?? String(err)}`,
      );
      throw err;
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const rawText = await response.text().catch(() => '');
      let parsedCode: string | undefined;
      let parsedMessage: string | undefined;
      try {
        const json = JSON.parse(rawText) as { code?: string; message?: string };
        parsedCode = json.code;
        parsedMessage = json.message;
      } catch {
        /* not JSON */
      }
      this.logger.error(
        `Brevo sendMail failed status=${response.status} to=${input.toEmail} ` +
          `code=${parsedCode ?? 'UNKNOWN'} msg=${parsedMessage ?? rawText.slice(0, 300)}`,
      );
      throw new Error(
        `Brevo email send failed (${response.status} ${parsedCode ?? ''}). ${parsedMessage ?? ''}`.trim(),
      );
    }
  }

  private async sendViaSmtp(args: {
    toEmail: string;
    code: string;
    purpose: EmailOtpPurpose;
    template: OtpEmailTemplate;
    fromName: string;
    replyTo?: string;
  }): Promise<MailChannel> {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const envPort = Number(process.env.SMTP_PORT ?? 587);
    const port = Number.isFinite(envPort) && envPort > 0 ? envPort : 587;
    const secureEnv = process.env.SMTP_SECURE;
    const secure =
      secureEnv != null ? secureEnv.toLowerCase() === 'true' : port === 465;
    const fromEmail =
      process.env.MAIL_FROM_EMAIL ?? process.env.SMTP_FROM_EMAIL ?? user;

    if (!host || !user || !pass || !fromEmail) {
      return this.consoleFallback(args.toEmail, args.code, args.purpose);
    }

    const transporter = this.getTransporter({ host, port, secure, user, pass });
    const mailOptions: SmtpMailOptions = {
      from: `"${args.fromName}" <${fromEmail}>`,
      to: args.toEmail,
      subject: args.template.subject,
      text: args.template.text,
      html: args.template.html,
      ...(args.replyTo ? { replyTo: args.replyTo } : {}),
    };

    try {
      await transporter.sendMail(mailOptions);
      return 'smtp';
    } catch (err) {
      const e = err as { code?: string; command?: string; message?: string };
      this.logger.error(
        `SMTP sendMail failed host=${host} port=${port} secure=${secure} ` +
          `code=${e.code ?? 'UNKNOWN'} cmd=${e.command ?? 'N/A'} ` +
          `msg=${e.message ?? String(err)}`,
      );
      this.disposeTransporter();

      if (e.code === 'ETIMEDOUT' || e.code === 'ECONNECTION') {
        this.logger.error(
          'Mat ket noi SMTP. Render Free chan moi outbound SMTP. ' +
            'Hay cau hinh BREVO_API_KEY de gui qua HTTPS thay vi SMTP.',
        );
      }
      throw err;
    }
  }

  private consoleFallback(
    toEmail: string,
    code: string,
    purpose: EmailOtpPurpose,
  ): MailChannel {
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction) {
      this.logger.warn(
        `Mail provider chua cau hinh day du. Bo qua gui OTP email cho ${toEmail} (${purpose}).`,
      );
    } else {
      this.logger.warn(
        `Mail provider chua cau hinh day du. OTP cho ${toEmail} (${purpose}): ${code}`,
      );
    }
    return 'console';
  }

  private getTransporter(cfg: SmtpConfig): MailTransporter {
    const key = `${cfg.host}:${cfg.port}:${cfg.secure}:${cfg.user}`;
    if (this.transporter && this.transporterKey === key) {
      return this.transporter;
    }
    this.disposeTransporter();

    const createMailer = createTransport as unknown as (
      options: SmtpTransportOptions,
    ) => MailTransporter;

    this.transporter = createMailer({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: { user: cfg.user, pass: cfg.pass },
      pool: true,
      maxConnections: 3,
      maxMessages: 100,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
      tls: { servername: cfg.host },
    });
    this.transporterKey = key;

    if (typeof this.transporter.verify === 'function') {
      this.verifyPromise = this.transporter
        .verify()
        .then(() => {
          this.logger.log(
            `SMTP transport ready (host=${cfg.host} port=${cfg.port} secure=${cfg.secure}).`,
          );
        })
        .catch((err: unknown) => {
          const e = err as { code?: string; message?: string };
          this.logger.warn(
            `SMTP verify failed host=${cfg.host} port=${cfg.port} secure=${cfg.secure} ` +
              `code=${e.code ?? 'UNKNOWN'} msg=${e.message ?? String(err)}`,
          );
        });
    }

    return this.transporter;
  }

  private disposeTransporter(): void {
    if (this.transporter && typeof this.transporter.close === 'function') {
      try {
        this.transporter.close();
      } catch {
        /* ignore */
      }
    }
    this.transporter = null;
    this.transporterKey = null;
    this.verifyPromise = null;
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
