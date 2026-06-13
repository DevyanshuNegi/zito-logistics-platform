import { Controller, Get, Req, Res, NotFoundException, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { StorageService } from './storage.service';

@Controller('uploads')
export class UploadsController {
  private readonly logger = new Logger(UploadsController.name);

  constructor(private readonly storageService: StorageService) {}

  @Get('*')
  async serveFile(@Req() req: Request, @Res() res: Response) {
    const filePath = req.params[0] || req.path.replace(/^\/uploads\//, '');
    if (!filePath) {
      throw new NotFoundException('File path is required');
    }

    try {
      const { stream, contentType } = await this.storageService.getFileStream(filePath);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', 'inline');
      stream.pipe(res);
    } catch (error) {
      this.logger.warn(`Error serving file ${filePath}: ${error.message}`);
      throw new NotFoundException('File not found');
    }
  }
}
