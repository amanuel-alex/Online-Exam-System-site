import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  UseGuards,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { LocalDiskStorage } from './local-disk-storage.service';

@Controller('files')
@UseGuards(JwtAuthGuard)
export class FileController {
  constructor(private readonly storage: LocalDiskStorage) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 50 * 1024 * 1024 }), // 50MB
          new FileTypeValidator({
            fileType: /(jpg|jpeg|png|pdf|mp4|avi)$/,
          }),
        ],
      }),
    )
    file: any,
  ) {
    if (!file) throw new BadRequestException('No file uploaded.');

    const url = await this.storage.upload(file, 'uploads');

    return {
      url,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    };
  }
}
