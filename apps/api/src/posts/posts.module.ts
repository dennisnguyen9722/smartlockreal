import { Module } from '@nestjs/common';
import { PostCategoryController, PostController } from './post.controller';
import { PostCategoryService } from './post-category.service';
import { PostService } from './post.service';

// Mảng này dùng cho cả providers lẫn exports: thêm service mới chỉ cần import và thêm vào đây
const services = [PostService, PostCategoryService];

@Module({
  controllers: [PostCategoryController, PostController],
  providers: services,
  exports: services,
})
export class PostsModule {}