import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { XpressItem } from '../../../common/mongodb/xpress-item.schema';
import {
  EmailOtpEntity,
  EmailOtpPurpose,
} from '../interfaces/email-otp.interface';

@Injectable()
export class EmailOtpRepository {
  constructor(
    @InjectModel(XpressItem.name)
    private readonly itemModel: Model<Record<string, any>>,
  ) {}

  async upsertOtp(otp: EmailOtpEntity): Promise<void> {
    await this.itemModel
      .replaceOne({ PK: otp.PK, SK: otp.SK }, otp, { upsert: true })
      .exec();
  }

  async findOtp(
    email: string,
    purpose: EmailOtpPurpose,
  ): Promise<EmailOtpEntity | null> {
    return this.itemModel
      .findOne({
        PK: `OTP#${email}`,
        SK: `OTP#${purpose}`,
      })
      .select('-_id')
      .lean<EmailOtpEntity>()
      .exec();
  }

  async incrementAttempts(
    email: string,
    purpose: EmailOtpPurpose,
  ): Promise<void> {
    await this.itemModel
      .updateOne(
        {
          PK: `OTP#${email}`,
          SK: `OTP#${purpose}`,
        },
        {
          $inc: { attempts: 1 },
          $set: { updatedAt: new Date().toISOString() },
        },
      )
      .exec();
  }

  async deleteOtp(email: string, purpose: EmailOtpPurpose): Promise<void> {
    await this.itemModel
      .deleteOne({
        PK: `OTP#${email}`,
        SK: `OTP#${purpose}`,
      })
      .exec();
  }
}

