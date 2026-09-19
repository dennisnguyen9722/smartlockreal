-- AlterTable
ALTER TABLE "products" ADD COLUMN     "highlights" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "spec_definitions" ADD COLUMN     "group_name" VARCHAR(80);

-- Điểm nổi bật luôn là mảng các nhóm
ALTER TABLE "products" ADD CONSTRAINT "products_highlights_is_array"
  CHECK (jsonb_typeof("highlights") = 'array');
