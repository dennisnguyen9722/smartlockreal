import { Module } from '@nestjs/common';
import { FaqController, PageController, PolicyController } from './content.controller';
import { FaqService } from './faq.service';
import { PageService } from './page.service';
import { PolicyService } from './policy.service';

// Mảng này dùng cho cả providers lẫn exports: thêm service mới chỉ cần import và thêm vào đây
const services = [PageService, PolicyService, FaqService];

/** Nội dung tĩnh: trang tĩnh, chính sách (theo phiên bản), câu hỏi thường gặp */
@Module({
  controllers: [PageController, PolicyController, FaqController],
  providers: services,
  exports: services,
})
export class ContentModule {}