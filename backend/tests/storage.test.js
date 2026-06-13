const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('Storage and R2 Integration regression checks', () => {
  test('StorageService contains R2 credentials checking and local fallback', () => {
    const storageService = read('src/modules/storage/storage.service.ts');

    expect(storageService).toContain('R2_ACCESS_KEY_ID');
    expect(storageService).toContain('R2_SECRET_ACCESS_KEY');
    expect(storageService).toContain('R2_ENDPOINT');
    expect(storageService).toContain('R2_BUCKET');
    expect(storageService).toContain('S3Client');
    expect(storageService).toContain('PutObjectCommand');
    expect(storageService).toContain('GetObjectCommand');
    expect(storageService).toContain('local disk storage');
    expect(storageService).toContain('isR2Enabled = false');
  });

  test('UploadsController exposes wildcard file serving route', () => {
    const uploadsController = read('src/modules/storage/uploads.controller.ts');

    expect(uploadsController).toContain("@Controller('uploads')");
    expect(uploadsController).toContain("@Get('*')");
    expect(uploadsController).toContain('this.storageService.getFileStream');
    expect(uploadsController).toContain("res.setHeader('Content-Type', contentType)");
    expect(uploadsController).toContain("res.setHeader('Content-Disposition', 'inline')");
  });

  test('KYC and Fleet services inject StorageService and upload files', () => {
    const usersService = read('src/modules/users/users.service.ts');
    const fleetService = read('src/modules/fleet/fleet.service.ts');

    expect(usersService).toContain('private storageService: StorageService');
    expect(usersService).toContain('this.storageService.uploadFile');
    
    expect(fleetService).toContain('private readonly storageService: StorageService');
    expect(fleetService).toContain('this.storageService.uploadFile');
  });
});
