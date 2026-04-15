import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomBytes } from "crypto";

export class S3Service {
  private client: S3Client;
  private bucket: string;
  private region?: string;

  constructor() {
    this.region = process.env.AWS_REGION;
    this.bucket = process.env.S3_BUCKET_NAME || "";

    if (!this.bucket) {
      throw new Error("S3_BUCKET_NAME environment variable is not set");
    }

    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

    const credentials = accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined;

    this.client = new S3Client({ region: this.region, credentials });
  }

  private contentTypeFromExt(type: string) {
    switch ((type || "").toLowerCase()) {
      case "pdf":
        return "application/pdf";
      case "docx":
        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      case "txt":
        return "text/plain";
      default:
        return "application/octet-stream";
    }
  }

  /**
   * Uploads a file buffer to S3 and returns a signed GET URL (expires in 1 hour by default).
   * Reads AWS credentials and bucket name from environment variables.
   */
  async uploadFile(buffer: Buffer, fileName: string, type: string): Promise<string> {
    const key = `${Date.now()}-${randomBytes(6).toString("hex")}-${fileName}`;

    const putCmd = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: this.contentTypeFromExt(type),
    });

    await this.client.send(putCmd);

    // Return a signed GET URL so consumers (OpenRouter, other services) can download the file.
    const getCmd = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    const signedUrl = await getSignedUrl(this.client, getCmd, { expiresIn: 3600 });

    console.error(`[S3Service] Uploaded ${fileName} -> s3://${this.bucket}/${key}`);
    return signedUrl;
  }
}
