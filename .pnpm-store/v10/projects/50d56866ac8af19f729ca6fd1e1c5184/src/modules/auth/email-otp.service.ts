import { Injectable, Logger } from '@nestjs/common';
import { createTransport } from 'nodemailer';
import { EmailOtpPurpose } from './interfaces/email-otp.interface';

type EmailTemplate = {
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

type MailContext = {
  fromName: string;
  brandName: string;
  brandColor: string;
  brandColorSoft: string;
  supportUrl: string;
  locale: string;
  replyToEmail?: string;
  replyToName?: string;
  isVietnamese: boolean;
};

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';
const BREVO_TIMEOUT_MS = 15_000;

const DEFAULT_BRAND_COLOR = '#2596be';
const DEFAULT_BRAND_COLOR_SOFT = '#eef7fb';

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
    const ctx = this.buildMailContext();
    const otpExpireMinutes = Number(process.env.MAIL_OTP_EXPIRE_MINUTES ?? 10);
    const template = this.buildOtpTemplate({
      code,
      purpose,
      otpExpireMinutes,
      ctx,
    });

    return this.dispatchEmail(toEmail, template, ctx, {
      logSubject: `OTP ${purpose}`,
      consoleFallbackLine: `OTP cho ${toEmail} (${purpose}): ${code}`,
    });
  }

  async sendOtpVerifiedEmail(
    toEmail: string,
    purpose: EmailOtpPurpose,
  ): Promise<MailChannel> {
    const ctx = this.buildMailContext();
    const template = this.buildVerifiedTemplate({ purpose, ctx });

    return this.dispatchEmail(toEmail, template, ctx, {
      logSubject: `OTP_VERIFIED ${purpose}`,
      consoleFallbackLine: `OTP verified cho ${toEmail} (${purpose})`,
    });
  }

  private async dispatchEmail(
    toEmail: string,
    template: EmailTemplate,
    ctx: MailContext,
    meta: { logSubject: string; consoleFallbackLine: string },
  ): Promise<MailChannel> {
    const providerOverride = (process.env.MAIL_PROVIDER ?? '').toLowerCase();
    const brevoApiKey = process.env.BREVO_API_KEY?.trim();
    const brevoFromEmail =
      process.env.BREVO_SENDER_EMAIL ??
      process.env.MAIL_FROM_EMAIL ??
      process.env.SMTP_FROM_EMAIL;
    const brevoFromName = process.env.BREVO_SENDER_NAME ?? ctx.fromName;

    const useBrevo =
      providerOverride === 'brevo' ||
      (providerOverride === '' && !!brevoApiKey);

    if (useBrevo) {
      if (!brevoApiKey) {
        this.logger.warn(
          `MAIL_PROVIDER=brevo nhung BREVO_API_KEY chua co. Bo qua gui ${meta.logSubject} cho ${toEmail}.`,
        );
        return this.consoleFallback(meta.consoleFallbackLine);
      }
      if (!brevoFromEmail) {
        this.logger.warn(
          `Brevo can BREVO_SENDER_EMAIL hoac MAIL_FROM_EMAIL (sender da verify). Bo qua gui ${meta.logSubject} cho ${toEmail}.`,
        );
        return this.consoleFallback(meta.consoleFallbackLine);
      }

      await this.sendViaBrevo({
        apiKey: brevoApiKey,
        fromEmail: brevoFromEmail,
        fromName: brevoFromName,
        toEmail,
        subject: template.subject,
        text: template.text,
        html: template.html,
        replyToEmail: ctx.replyToEmail,
        replyToName: ctx.replyToName,
      });
      return 'brevo';
    }

    return this.sendViaSmtp({
      toEmail,
      template,
      fromName: ctx.fromName,
      replyTo: ctx.replyToEmail,
      consoleFallbackLine: meta.consoleFallbackLine,
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
    template: EmailTemplate;
    fromName: string;
    replyTo?: string;
    consoleFallbackLine: string;
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
      return this.consoleFallback(args.consoleFallbackLine);
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

  private consoleFallback(line: string): MailChannel {
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction) {
      this.logger.warn(
        `Mail provider chua cau hinh day du. ${line.replace(/:.*$/, '')} bi bo qua.`,
      );
    } else {
      this.logger.warn(`Mail provider chua cau hinh day du. ${line}`);
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

  private buildMailContext(): MailContext {
    const fromName =
      process.env.MAIL_FROM_NAME ?? process.env.MAIL_BRAND_NAME ?? 'Xpress';
    const brandName = process.env.MAIL_BRAND_NAME ?? fromName;
    const brandColor = this.normalizeColor(
      process.env.MAIL_BRAND_COLOR,
      DEFAULT_BRAND_COLOR,
    );
    const brandColorSoft = this.normalizeColor(
      process.env.MAIL_BRAND_COLOR_SOFT,
      DEFAULT_BRAND_COLOR_SOFT,
    );
    const supportUrl = process.env.MAIL_SUPPORT_URL ?? '';
    const locale = process.env.MAIL_LOCALE ?? 'vi';
    const replyToEmail = process.env.MAIL_REPLY_TO;
    const replyToName = process.env.MAIL_REPLY_TO_NAME;
    const isVietnamese = locale.toLowerCase().startsWith('vi');

    return {
      fromName,
      brandName,
      brandColor,
      brandColorSoft,
      supportUrl,
      locale,
      replyToEmail,
      replyToName,
      isVietnamese,
    };
  }

  private buildOtpTemplate(params: {
    code: string;
    purpose: EmailOtpPurpose;
    otpExpireMinutes: number;
    ctx: MailContext;
  }): EmailTemplate {
    const { code, purpose, otpExpireMinutes, ctx } = params;
    const isVi = ctx.isVietnamese;
    const actionLabel = this.getActionLabel(purpose, isVi);
    const safeCode = this.escapeHtml(code);

    const subject = isVi
      ? `[${ctx.brandName}] Ma OTP ${actionLabel}`
      : `[${ctx.brandName}] OTP code for ${actionLabel}`;

    const text = isVi
      ? [
          `Xin chào,`,
          ``,
          `Mã OTP để ${actionLabel} của bạn là: ${code}`,
          `Mã có hiệu lực trong ${otpExpireMinutes} phút.`,
          ``,
          `Vui lòng không chia sẻ mã này cho bất kỳ ai.`,
          `Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.`,
        ].join('\n')
      : [
          `Hello,`,
          ``,
          `Your OTP code for ${actionLabel} is: ${code}`,
          `This code will expire in ${otpExpireMinutes} minutes.`,
          ``,
          `Do not share this code with anyone.`,
          `If you did not request this, you can ignore this email.`,
        ].join('\n');

    const greeting = isVi ? 'Xin chao,' : 'Hello,';
    const intro = isVi
      ? `Ban dang thuc hien <strong>${this.escapeHtml(actionLabel)}</strong>. Su dung ma OTP ben duoi:`
      : `You are performing <strong>${this.escapeHtml(actionLabel)}</strong>. Use the OTP code below:`;
    const expiryLine = isVi
      ? `Ma co hieu luc trong <strong>${otpExpireMinutes} phut</strong>.`
      : `This code expires in <strong>${otpExpireMinutes} minutes</strong>.`;
    const warningLine = isVi
      ? `Khong chia se ma nay cho bat ky ai, ke ca nhan vien ho tro.`
      : `Never share this code with anyone, including support staff.`;

    const bodyHtml = `
      <p style="margin:0 0 12px 0;color:#111827;font-size:15px;line-height:24px;">${greeting}</p>
      <p style="margin:0 0 16px 0;color:#111827;font-size:15px;line-height:24px;">
        ${intro}
      </p>
      <div style="margin:0 0 16px 0;padding:12px 16px;border:1px dashed ${ctx.brandColor};border-radius:10px;background:${ctx.brandColorSoft};text-align:center;">
        <span style="font-size:30px;letter-spacing:8px;font-weight:700;color:#111827;">${safeCode}</span>
      </div>
      <p style="margin:0 0 8px 0;color:#111827;font-size:14px;line-height:22px;">
        ${expiryLine}
      </p>
      <p style="margin:0 0 16px 0;color:#b91c1c;font-size:13px;line-height:20px;">
        ${warningLine}
      </p>
    `;

    const html = this.wrapBrandedHtml(bodyHtml, ctx);
    return { subject, text, html };
  }

  private buildVerifiedTemplate(params: {
    purpose: EmailOtpPurpose;
    ctx: MailContext;
  }): EmailTemplate {
    const { purpose, ctx } = params;
    const isVi = ctx.isVietnamese;
    const actionLabel = this.getActionLabel(purpose, isVi);

    const subject = isVi
      ? `[${ctx.brandName}] Xac thuc email thanh cong`
      : `[${ctx.brandName}] Email verified successfully`;

    const text = isVi
      ? [
          `Xin chào,`,
          ``,
          `Bạn đã xác thực email thành công cho thao tác: ${actionLabel}.`,
          `Thời điểm: ${new Date().toLocaleString('vi-VN')}.`,
          ``,
          `Nếu không phải bạn, vui lòng đổi mật khẩu ngay và liên hệ hỗ trợ.`,
        ].join('\n')
      : [
          `Hello,`,
          ``,
          `Your email has been verified successfully for: ${actionLabel}.`,
          `Time: ${new Date().toUTCString()}.`,
          ``,
          `If this wasn't you, please change your password and contact support.`,
        ].join('\n');

    const heading = isVi
      ? 'Xac thuc email thanh cong'
      : 'Email verified successfully';
    const description = isVi
      ? `Ban da xac thuc OTP thanh cong cho thao tac <strong>${this.escapeHtml(actionLabel)}</strong>.`
      : `Your OTP has been verified for <strong>${this.escapeHtml(actionLabel)}</strong>.`;
    const timestamp = isVi
      ? `Thoi diem: ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`
      : `Time: ${new Date().toUTCString()}`;
    const securityNote = isVi
      ? `Neu day khong phai la ban, hay doi mat khau ngay va lien he ho tro.`
      : `If this wasn't you, change your password immediately and contact support.`;

    const checkmarkSvg = `
      <span style="display:inline-block;width:48px;height:48px;border-radius:50%;background:${ctx.brandColor};color:#ffffff;font-size:28px;line-height:48px;text-align:center;font-weight:700;">&#10003;</span>
    `;

    const bodyHtml = `
      <div style="text-align:center;margin:0 0 16px 0;">${checkmarkSvg}</div>
      <h2 style="margin:0 0 12px 0;color:#111827;font-size:20px;line-height:28px;text-align:center;">${heading}</h2>
      <p style="margin:0 0 16px 0;color:#111827;font-size:15px;line-height:24px;">
        ${description}
      </p>
      <div style="margin:0 0 16px 0;padding:12px 16px;border-left:4px solid ${ctx.brandColor};background:${ctx.brandColorSoft};border-radius:6px;">
        <p style="margin:0;color:#0f172a;font-size:13px;line-height:20px;">${timestamp}</p>
      </div>
      <p style="margin:0 0 8px 0;color:#b91c1c;font-size:13px;line-height:20px;">
        ${securityNote}
      </p>
    `;

    const html = this.wrapBrandedHtml(bodyHtml, ctx);
    return { subject, text, html };
  }

  private wrapBrandedHtml(bodyHtml: string, ctx: MailContext): string {
    const safeBrandName = this.escapeHtml(ctx.brandName);
    const safeSupportUrl = this.escapeHtml(ctx.supportUrl);
    const isVi = ctx.isVietnamese;

    const supportLabel = isVi ? 'Can ho tro?' : 'Need help?';
    const supportCta = isVi ? 'Lien he chung toi' : 'Contact support';
    const supportBlock = ctx.supportUrl
      ? `<p style="margin:0;color:#6b7280;font-size:13px;line-height:20px;">${supportLabel} <a href="${safeSupportUrl}" style="color:${ctx.brandColor};text-decoration:none;">${supportCta}</a>.</p>`
      : '';

    return `
<!doctype html>
<html lang="${isVi ? 'vi' : 'en'}">
  <body style="margin:0;padding:0;background:#f5f7fb;font-family:Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fb;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
            <tr>
              <td style="background:${ctx.brandColor};padding:16px 20px;color:#ffffff;font-size:18px;font-weight:700;">
                ${safeBrandName}
              </td>
            </tr>
            <tr>
              <td style="padding:24px 20px;">
                ${bodyHtml}
                ${supportBlock}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`.trim();
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
    if (purpose === 'TWO_FACTOR_SETUP') {
      return isVietnamese
        ? 'bat xac thuc 2 yeu to'
        : 'two-factor authentication setup';
    }
    if (purpose === 'TWO_FACTOR_DISABLE') {
      return isVietnamese
        ? 'tat xac thuc 2 yeu to'
        : 'two-factor authentication disable';
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

  private normalizeColor(input: string | undefined, fallback: string): string {
    if (!input) return fallback;
    const trimmed = input.trim();
    return /^#[0-9a-fA-F]{3,8}$/.test(trimmed) ? trimmed : fallback;
  }
}
