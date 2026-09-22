'use client';

import { Editor } from '@tinymce/tinymce-react';
import { useAuth } from '@/components/auth-provider';
import { errorText } from '@/lib/error-text';

const API_KEY = process.env.NEXT_PUBLIC_TINYMCE_API_KEY ?? '';

/**
 * Trình soạn thảo nội dung (bài viết, trang tĩnh, chính sách, câu trả lời FAQ): TinyMCE bản cloud (tải từ cdn.tiny.cloud bằng khóa NEXT_PUBLIC_TINYMCE_API_KEY).
 *
 * Cấu hình (plugins, toolbar, định dạng) PHẢI khớp danh sách lọc HTML ở apps/api/src/posts/rich-text.ts.
 * Thứ gì trình soạn thảo tạo ra mà máy chủ không cho phép sẽ bị bỏ khi lưu. Vì vậy:
 * - Không có màu chữ, cỡ chữ, font: website tự quyết giao diện.
 * - Căn lề dùng class (text-center, img-left...) thay vì style.
 * - Ảnh: tải lên Thư viện ảnh (kể cả ảnh dán/kéo thả), không nhúng base64.
 * - Tiêu đề trong bài chỉ h2–h4 (h1 là tiêu đề bài trên website).
 *
 * Khi đưa CMS lên máy chủ thật: thêm tên miền admin vào "Approved Domains" của tài khoản Tiny.
 */
export function RichTextEditor({
    value,
    onChange,
    onReady,
    disabled,
    invalid,
    compact,
}: {
    value: string;
    onChange: (html: string) => void;
    /** HTML sau khi TinyMCE chuẩn hóa lúc mở (dùng làm mốc so sánh "có thay đổi chưa lưu") */
    onReady?: (normalizedHtml: string) => void;
    disabled?: boolean;
    invalid?: boolean;
    /** Bản gọn cho câu trả lời FAQ: thấp hơn, bớt nút (không ảnh lớn, bảng, video) */
    compact?: boolean;
}) {
    const { authFetch } = useAuth();

    if (!API_KEY) {
        return (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
                Chưa cấu hình <code>NEXT_PUBLIC_TINYMCE_API_KEY</code> trong <code>apps/admin/.env.local</code>. Thêm khóa rồi
                chạy lại <code>pnpm dev</code>.
            </div>
        );
    }

    return (
        <div className={invalid ? 'rounded-lg ring-1 ring-destructive' : undefined}>
            <Editor
                apiKey={API_KEY}
                value={value}
                onEditorChange={(html) => onChange(html)}
                onInit={(_event, editor) => onReady?.(editor.getContent())}
                disabled={disabled}
                init={{
                    language: 'vi',
                    height: compact ? 260 : 640,
                    menubar: false,
                    branding: false,
                    promotion: false,
                    plugins: compact
                        ? 'lists link autolink'
                        : 'lists link image table media autolink wordcount searchreplace fullscreen code',
                    toolbar: compact
                        ? 'bold italic underline | bullist numlist | link | undo redo'
                        : 'undo redo | blocks | bold italic underline strikethrough | bullist numlist blockquote | ' +
                        'alignleft aligncenter alignright | link image media table hr | searchreplace code fullscreen',
                    statusbar: !compact,
                    block_formats: 'Đoạn văn=p; Tiêu đề lớn=h2; Tiêu đề vừa=h3; Tiêu đề nhỏ=h4',
                    // Căn lề bằng class, khớp RICH_TEXT_ALIGN_CLASSES ở API
                    formats: {
                        alignleft: [
                            { selector: 'p,h2,h3,h4,li,td,th', classes: 'text-left' },
                            { selector: 'img,figure,table', classes: 'img-left' },
                        ],
                        aligncenter: [
                            { selector: 'p,h2,h3,h4,li,td,th', classes: 'text-center' },
                            { selector: 'img,figure,table', classes: 'img-center' },
                        ],
                        alignright: [
                            { selector: 'p,h2,h3,h4,li,td,th', classes: 'text-right' },
                            { selector: 'img,figure,table', classes: 'img-right' },
                        ],
                        underline: { inline: 'u', exact: true },
                        strikethrough: { inline: 's', exact: true },
                    },
                    // Dán từ Word/web: bỏ định dạng lạ (máy chủ cũng lọc lại)
                    paste_as_text: false,
                    paste_block_drop: false,
                    invalid_styles: 'color font-size font-family background-color line-height',
                    // Ảnh
                    image_caption: true,
                    image_advtab: false,
                    image_dimensions: false,
                    image_title: false,
                    automatic_uploads: true,
                    paste_data_images: true,
                    file_picker_types: 'image',
                    images_file_types: 'jpeg,jpg,png,webp',
                    // Giữ link ảnh tuyệt đối tới máy chủ ảnh (không đổi thành đường dẫn tương đối)
                    relative_urls: false,
                    remove_script_host: false,
                    convert_urls: false,
                    images_upload_handler: async (blobInfo: { blob: () => Blob; filename: () => string }) => {
                        const form = new FormData();
                        form.append('file', blobInfo.blob(), blobInfo.filename());
                        try {
                            const asset = await authFetch<{ url: string }>('/media/upload', { method: 'POST', body: form });
                            return asset.url;
                        } catch (error) {
                            // TinyMCE hiện thông báo này và bỏ ảnh lỗi khỏi bài
                            throw new Error(errorText(error));
                        }
                    },
                    // Link
                    link_default_target: '_self',
                    link_target_list: [
                        { title: 'Cùng tab', value: '' },
                        { title: 'Tab mới', value: '_blank' },
                    ],
                    link_title: false,
                    // Video: chỉ YouTube (máy chủ bỏ iframe trang khác)
                    media_alt_source: false,
                    media_poster: false,
                    media_dimensions: false,
                    // Bảng: không cho kéo độ rộng bằng style, website tự co giãn
                    table_sizing_mode: 'responsive',
                    table_default_styles: {},
                    table_resize_bars: false,
                    table_appearance_options: false,
                    table_advtab: false,
                    table_cell_advtab: false,
                    table_row_advtab: false,
                    content_style: [
                        'body { font-family: system-ui, sans-serif; font-size: 16px; line-height: 1.7; max-width: 760px; margin: 1rem auto; padding: 0 1rem; }',
                        'img { max-width: 100%; height: auto; }',
                        'figure { margin: 1rem 0; } figcaption { font-size: 14px; color: #666; text-align: center; }',
                        'table { border-collapse: collapse; width: 100%; } td, th { border: 1px solid #ddd; padding: 6px 8px; }',
                        '.text-center { text-align: center; } .text-right { text-align: right; } .text-left { text-align: left; }',
                        '.img-center { display: block; margin-left: auto; margin-right: auto; }',
                        '.img-left { float: left; margin: 0 1rem 1rem 0; } .img-right { float: right; margin: 0 0 1rem 1rem; }',
                    ].join('\n'),
                }}
            />
        </div>
    );
}