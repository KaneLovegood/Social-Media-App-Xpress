import { Inject, Injectable } from '@nestjs/common';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { DYNAMODB_DOC_CLIENT } from '../../../common/dynamodb/dynamodb.constants';
import {
  EmailOtpEntity,
  EmailOtpPurpose,
} from '../interfaces/email-otp.interface';

@Injectable()
export class EmailOtpRepository {
  private readonly tableName = process.env.DDB_TABLE_NAME!;

  constructor(
    @Inject(DYNAMODB_DOC_CLIENT)
    private readonly ddbDocClient: DynamoDBDocumentClient,
  ) {}

  async upsertOtp(otp: EmailOtpEntity): Promise<void> {
    await this.ddbDocClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: otp,
      }),
    );
  }

  async findOtp(
    email: string,
    purpose: EmailOtpPurpose,
  ): Promise<EmailOtpEntity | null> {
    const result = await this.ddbDocClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: {
          PK: `OTP#${email}`,
          SK: `OTP#${purpose}`,
        },
      }),
    );

    return (result.Item as EmailOtpEntity) ?? null;
  }

  async incrementAttempts(
    email: string,
    purpose: EmailOtpPurpose,
  ): Promise<void> {
    await this.ddbDocClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: {
          PK: `OTP#${email}`,
          SK: `OTP#${purpose}`,
        },
        ConditionExpression: 'attribute_exists(PK)',
        UpdateExpression:
          'SET attempts = if_not_exists(attempts, :zero) + :one',
        ExpressionAttributeValues: {
          ':zero': 0,
          ':one': 1,
        },
      }),
    );
  }

  async deleteOtp(email: string, purpose: EmailOtpPurpose): Promise<void> {
    await this.ddbDocClient.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: {
          PK: `OTP#${email}`,
          SK: `OTP#${purpose}`,
        },
      }),
    );
  }
}
