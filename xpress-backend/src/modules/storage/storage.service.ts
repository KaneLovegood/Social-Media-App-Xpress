import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

function getS3Credentials():
  | {
      accessKeyId: string;
      secretAccessKey: string;
    }
  | undefined {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!accessKeyId || !secretAccessKey) {
    return undefined;
  }

  return { accessKeyId, secretAccessKey };
}

@Injectable()
export class StorageService {
  private s3: S3Client;
  private bucketName: string;

  constructor() {
    this.bucketName = process.env.S3_BUCKET_NAME || '';

    // Khởi tạo S3 Client
    const credentials = getS3Credentials();

    this.s3 = new S3Client({
      region: process.env.AWS_REGION || 'ap-southeast-1',
      ...(credentials ? { credentials } : {}),
    });
  }

  async generatePresignedUrl(fileName: string, contentType: string) {
    const ext = fileName.split('.').pop();
    const uniqueFileName = `chat-files/${randomUUID()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: uniqueFileName,
      ContentType: contentType,
    });

    // URL có hạn trong 5 phút (300s)
    const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn: 300 });

    const publicUrl = `https://${this.bucketName}.s3.${process.env.AWS_REGION || 'ap-southeast-1'}.amazonaws.com/${uniqueFileName}`;

    return { uploadUrl, publicUrl, fileName, contentType };
  }
}
