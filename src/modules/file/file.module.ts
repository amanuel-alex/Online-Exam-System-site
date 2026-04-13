import { Module } from '@nestjs/common';
import { FileController } from './file.controller';
import { LocalDiskStorage } from './local-disk-storage.service';

@Module({
  controllers: [FileController],
  providers: [LocalDiskStorage],
  exports: [LocalDiskStorage],
})
export class FileModule {}
