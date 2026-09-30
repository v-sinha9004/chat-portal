import { registerAs } from '@nestjs/config';

export interface StorageConfig {
  endpoint?: string;
  region: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  publicUrl: string;
  forcePathStyle: boolean;
}

export default registerAs(
  'storage',
  (): StorageConfig => ({
    endpoint: process.env.STORAGE_ENDPOINT || 'http://localhost:9000',
    region: process.env.STORAGE_REGION || 'us-east-1',
    accessKey: process.env.STORAGE_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.STORAGE_SECRET_KEY || 'minioadmin',
    bucket: process.env.STORAGE_BUCKET || 'chat-portal-attachments',
    publicUrl:
      process.env.STORAGE_PUBLIC_URL ||
      'http://localhost:9000/chat-portal-attachments',
    forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE === 'true',
  }),
);
