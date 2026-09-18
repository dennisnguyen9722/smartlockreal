import { Global, Module } from '@nestjs/common';
import { ImageService } from './image.service';
import { MediaController } from './media.controller';
import { StorageService } from './storage.service';

@Global()
@Module({
  controllers: [MediaController],
  providers: [StorageService, ImageService],
  exports: [StorageService, ImageService],
})
export class MediaModule {}
