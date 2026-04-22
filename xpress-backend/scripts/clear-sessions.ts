/* eslint-disable no-console */
import 'dotenv/config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';

const TABLE_NAME = process.env.DDB_TABLE_NAME;
const REGION = process.env.AWS_REGION ?? 'us-east-1';

if (!TABLE_NAME) {
  console.error('DDB_TABLE_NAME chưa được cấu hình trong .env');
  process.exit(1);
}

const rawClient = new DynamoDBClient({
  region: REGION,
  credentials:
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
      : undefined,
});
const ddb = DynamoDBDocumentClient.from(rawClient);

interface SessionKey {
  PK: string;
  SK: string;
}

async function scanAllSessions(): Promise<SessionKey[]> {
  const keys: SessionKey[] = [];
  let lastKey: Record<string, unknown> | undefined = undefined;

  do {
    const result = await ddb.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression:
          'entityType = :entityType OR begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':entityType': 'SESSION',
          ':skPrefix': 'SESSION#',
        },
        ProjectionExpression: 'PK, SK',
        ExclusiveStartKey: lastKey as never,
      }),
    );

    for (const item of result.Items ?? []) {
      if (
        typeof item.PK === 'string' &&
        typeof item.SK === 'string' &&
        item.SK.startsWith('SESSION#')
      ) {
        keys.push({ PK: item.PK, SK: item.SK });
      }
    }

    lastKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);

  return keys;
}

async function batchDelete(keys: SessionKey[]): Promise<void> {
  const CHUNK_SIZE = 25;
  for (let i = 0; i < keys.length; i += CHUNK_SIZE) {
    const chunk = keys.slice(i, i + CHUNK_SIZE);
    let requestItems: Record<string, { DeleteRequest: { Key: SessionKey } }[]> =
      {
        [TABLE_NAME!]: chunk.map((key) => ({
          DeleteRequest: { Key: key },
        })),
      };

    let attempt = 0;
    while (requestItems[TABLE_NAME!]?.length && attempt < 5) {
      const result = await ddb.send(
        new BatchWriteCommand({ RequestItems: requestItems }),
      );

      const unprocessed = result.UnprocessedItems?.[TABLE_NAME!] as
        | { DeleteRequest: { Key: SessionKey } }[]
        | undefined;

      if (unprocessed && unprocessed.length > 0) {
        requestItems = { [TABLE_NAME!]: unprocessed };
        attempt += 1;
        await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
      } else {
        break;
      }
    }

    console.log(
      `Đã xoá ${Math.min(i + CHUNK_SIZE, keys.length)}/${keys.length} session`,
    );
  }
}

async function main(): Promise<void> {
  console.log(`Đang quét session trong bảng "${TABLE_NAME}" (${REGION})...`);
  const keys = await scanAllSessions();
  console.log(`Tìm thấy ${keys.length} session cần xoá.`);

  if (keys.length === 0) {
    console.log('Không có session nào để xoá. Kết thúc.');
    return;
  }

  await batchDelete(keys);
  console.log('Hoàn tất: đã xoá sạch toàn bộ session của tất cả user.');
}

main().catch((err) => {
  console.error('Lỗi khi xoá session:', err);
  process.exit(1);
});
