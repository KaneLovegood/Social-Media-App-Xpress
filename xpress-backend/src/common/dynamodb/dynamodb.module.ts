import { Module } from '@nestjs/common';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DYNAMODB_DOC_CLIENT } from './dynamodb.constants';

@Module({
  providers: [
    {
      provide: DYNAMODB_DOC_CLIENT,
      useFactory: () => {
        const client = new DynamoDBClient({
          region: process.env.AWS_REGION,
          // nếu chạy local với .env thì có thể để credentials:
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
          },
        });

        return DynamoDBDocumentClient.from(client, {
          marshallOptions: {
            removeUndefinedValues: true,
          },
        });
      },
    },
  ],
  exports: [DYNAMODB_DOC_CLIENT],
})
export class DynamoDbModule {}
