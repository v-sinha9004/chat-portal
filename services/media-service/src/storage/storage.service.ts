import {
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  HeadBucketCommand,
  CreateBucketCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageConfig } from './storage.config';

export interface PresignedUploadResult {
  uploadUrl: string;
  publicUrl: string;
  fileKey: string;
  expiresInSeconds: number;
}

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    const config = this.configService.get<StorageConfig>('storage');
    if (!config) {
      throw new Error('Storage configuration is not defined');
    }

    this.bucket = config.bucket;
    this.publicBaseUrl = config.publicUrl.replace(/\/$/, '');

    this.s3Client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey,
      },
    });

    this.logger.log(
      `S3 Storage initialized targeting bucket [${this.bucket}] via [${config.endpoint || 'AWS Default'}]`,
    );
  }

  async onModuleInit(): Promise<void> {
    await this.ensureBucketExists();
  }

  /**
   * Automatically creates the bucket if it does not exist (essential for MinIO / local dev)
   * and configures public read policy for object delivery.
   */
  async ensureBucketExists(): Promise<void> {
    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`Bucket [${this.bucket}] exists and is accessible`);
    } catch (error: any) {
      if (
        error.name === 'NotFound' ||
        error.name === 'NoSuchBucket' ||
        error.$metadata?.httpStatusCode === 404
      ) {
        this.logger.warn(
          `Bucket [${this.bucket}] not found. Creating bucket automatically...`,
        );
        try {
          await this.s3Client.send(
            new CreateBucketCommand({ Bucket: this.bucket }),
          );
          this.logger.log(`Bucket [${this.bucket}] successfully created`);

          // Apply public read access policy so avatars/attachments can be downloaded/previewed
          await this.applyPublicReadPolicy();
        } catch (createErr: any) {
          this.logger.error(
            `Failed to create bucket [${this.bucket}]: ${createErr.message}`,
            createErr.stack,
          );
        }
      } else {
        this.logger.warn(
          `HeadBucket verification error for [${this.bucket}]: ${error.message}`,
        );
      }
    }
  }

  /**
   * Applies an anonymous download policy to the bucket for public media access
   */
  private async applyPublicReadPolicy(): Promise<void> {
    const policy = {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'PublicReadGetObject',
          Effect: 'Allow',
          Principal: '*',
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${this.bucket}/*`],
        },
      ],
    };

    try {
      await this.s3Client.send(
        new PutBucketPolicyCommand({
          Bucket: this.bucket,
          Policy: JSON.stringify(policy),
        }),
      );
      this.logger.log(`Public read policy set on bucket [${this.bucket}]`);
    } catch (policyErr: any) {
      this.logger.warn(
        `Could not apply public read policy: ${policyErr.message}`,
      );
    }
  }

  /**
   * Generates a pre-signed URL for direct browser PUT upload
   */
  async generatePresignedUploadUrl(
    fileKey: string,
    mimeType: string,
    expiresInSeconds = 600,
  ): Promise<PresignedUploadResult> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: fileKey,
      ContentType: mimeType,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: expiresInSeconds,
    });

    const publicUrl = `${this.publicBaseUrl}/${fileKey}`;

    return {
      uploadUrl,
      publicUrl,
      fileKey,
      expiresInSeconds,
    };
  }

  /**
   * Deletes an object from the storage bucket
   */
  async deleteObject(fileKey: string): Promise<void> {
    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: fileKey,
      }),
    );
    this.logger.log(`Deleted storage object [${fileKey}] from [${this.bucket}]`);
  }

  /**
   * Verifies health connectivity to the storage provider
   */
  async checkHealth(): Promise<boolean> {
    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return true;
    } catch {
      return false;
    }
  }
}
