import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { mkdir, writeFile } from 'fs/promises';
import { createReadStream, existsSync } from 'fs';
import { join, dirname } from 'path';
import { Readable } from 'stream';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private s3Client: S3Client | null = null;
  private bucketName: string | null = null;
  private readonly uploadRoot = join(process.cwd(), 'uploads');
  private isR2Enabled = false;

  onModuleInit() {
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const endpoint = process.env.R2_ENDPOINT;
    const bucket = process.env.R2_BUCKET;

    if (accessKeyId && secretAccessKey && endpoint && bucket) {
      this.s3Client = new S3Client({
        region: 'auto',
        endpoint: endpoint,
        credentials: {
          accessKeyId: accessKeyId,
          secretAccessKey: secretAccessKey,
        },
      });
      this.bucketName = bucket;
      this.isR2Enabled = true;
      this.logger.log(`Cloudflare R2 storage enabled. Bucket: ${bucket}`);
    } else {
      this.logger.warn(
        'Cloudflare R2 credentials missing. Falling back to local disk storage.',
      );
    }
  }

  async uploadFile(fileUrlPath: string, buffer: Buffer, mimetype: string): Promise<string> {
    let cleanPath = fileUrlPath.replace(/^\/+/, '');
    if (cleanPath.startsWith('uploads/')) {
      cleanPath = cleanPath.substring(8);
    }

    if (this.isR2Enabled && this.s3Client && this.bucketName) {
      try {
        await this.s3Client.send(
          new PutObjectCommand({
            Bucket: this.bucketName,
            Key: cleanPath,
            Body: buffer,
            ContentType: mimetype,
          }),
        );
        this.logger.log(`Uploaded file to R2: ${cleanPath}`);
        return `uploads/${cleanPath}`;
      } catch (error) {
        this.logger.error(`Failed to upload file to R2: ${cleanPath}`, error);
        throw error;
      }
    } else {
      const localFullPath = join(this.uploadRoot, cleanPath);
      await mkdir(dirname(localFullPath), { recursive: true });
      await writeFile(localFullPath, buffer);
      this.logger.log(`Uploaded file to local disk: ${localFullPath}`);
      return `uploads/${cleanPath}`;
    }
  }

  async getFileStream(fileUrlPath: string): Promise<{ stream: Readable; contentType: string }> {
    let cleanPath = fileUrlPath.replace(/^\/+/, '');
    if (cleanPath.startsWith('uploads/')) {
      cleanPath = cleanPath.substring(8);
    }

    const contentType = this.getContentTypeFromExtension(cleanPath);

    if (this.isR2Enabled && this.s3Client && this.bucketName) {
      try {
        const response = await this.s3Client.send(
          new GetObjectCommand({
            Bucket: this.bucketName,
            Key: cleanPath,
          }),
        );
        if (response.Body instanceof Readable) {
          return { stream: response.Body, contentType: response.ContentType || contentType };
        } else if (response.Body && typeof (response.Body as any).pipe === 'function') {
          return { stream: response.Body as any, contentType: response.ContentType || contentType };
        } else {
          const stream = Readable.from(response.Body as any);
          return { stream, contentType: response.ContentType || contentType };
        }
      } catch (error) {
        this.logger.warn(`File not found in R2: ${cleanPath}. Checking local fallback.`);
      }
    }

    const localFullPath = join(this.uploadRoot, cleanPath);
    if (existsSync(localFullPath)) {
      const stream = createReadStream(localFullPath);
      return { stream, contentType };
    }

    throw new Error(`File not found: ${cleanPath}`);
  }

  private getContentTypeFromExtension(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'png':
        return 'image/png';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'pdf':
        return 'application/pdf';
      case 'gif':
        return 'image/gif';
      default:
        return 'application/octet-stream';
    }
  }
}
