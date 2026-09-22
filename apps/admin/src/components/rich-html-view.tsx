/**
 * Hiển thị HTML ĐÃ LỌC SẠCH ở máy chủ (bài viết, chính sách, FAQ) để xem lại trong CMS.
 * Chỉ dùng cho HTML trả về từ API (đã qua sanitizeRichHtml), không dùng cho chuỗi người dùng vừa gõ.
 */
export function RichHtmlView({ html, className = '' }: { html: string; className?: string }) {
    return (
        <div
            className={[
                'max-w-none text-sm leading-7',
                '[&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold',
                '[&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold',
                '[&_h4]:mt-4 [&_h4]:mb-1 [&_h4]:font-semibold',
                '[&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6',
                '[&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground',
                '[&_img]:my-3 [&_img]:max-w-full [&_img]:rounded-md [&_table]:my-3 [&_table]:w-full [&_td]:border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:px-2 [&_th]:py-1',
                '[&_iframe]:aspect-video [&_iframe]:w-full',
                className,
            ].join(' ')}
            // eslint-disable-next-line react/no-danger -- HTML đã được máy chủ lọc bằng danh sách thẻ cho phép
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}