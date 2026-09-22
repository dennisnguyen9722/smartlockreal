import sanitizeHtml from 'sanitize-html';

/**
 * LỌC HTML TỪ TINYMCE trước khi lưu: bài viết, trang tĩnh, chính sách, câu trả lời FAQ.
 *
 * Danh sách dưới đây PHẢI khớp cấu hình trình soạn thảo ở
 * apps/admin/src/components/post/rich-text-editor.tsx (plugins, toolbar, formats).
 * Thẻ/thuộc tính ngoài danh sách bị bỏ (giữ lại chữ bên trong), nên dán từ Word hay web khác
 * cũng không mang theo mã rác, màu chữ, font lạ.
 *
 * Tiêu đề bài là <h1> trên website, nên trong bài chỉ dùng h2–h4.
 */

/** Căn lề dùng class (không dùng style) để website tự quyết giao diện */
export const RICH_TEXT_ALIGN_CLASSES = ['text-left', 'text-center', 'text-right', 'text-justify', 'img-left', 'img-center', 'img-right'];

/** Video nhúng: chỉ YouTube (hướng dẫn cài đặt, review khóa) */
const IFRAME_HOSTS = ['www.youtube.com', 'www.youtube-nocookie.com', 'youtube.com'];

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'h2', 'h3', 'h4', 'p', 'br', 'hr',
    'strong', 'em', 'u', 's', 'sub', 'sup',
    'a', 'ul', 'ol', 'li', 'blockquote',
    'img', 'figure', 'figcaption',
    // Bảng: so sánh thông số các dòng khóa
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption',
    'iframe',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel', 'title'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    ol: ['start'],
    th: ['colspan', 'rowspan', 'scope'],
    td: ['colspan', 'rowspan'],
    iframe: ['src', 'width', 'height', 'allowfullscreen', 'title'],
    '*': ['class'],
  },
  allowedClasses: {
    '*': RICH_TEXT_ALIGN_CLASSES,
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  // Chặn ảnh base64 (data:) làm nặng database: ảnh phải tải lên Thư viện ảnh
  allowedSchemesByTag: { img: ['http', 'https'], iframe: ['https'] },
  allowProtocolRelative: false,
  allowedIframeHostnames: IFRAME_HOSTS,
  transformTags: {
    h1: 'h2',
    h5: 'h4',
    h6: 'h4',
    b: 'strong',
    i: 'em',
    strike: 's',
    del: 's',
    // Link mở tab mới luôn có rel an toàn; link cùng tab giữ nguyên (link nội bộ không gắn nofollow)
    a: (tagName, attribs) => {
      const next: sanitizeHtml.Attributes = { ...attribs };
      if (next.target === '_blank') next.rel = 'noopener noreferrer';
      else {
        delete next.target;
        delete next.rel;
      }
      return { tagName, attribs: next };
    },
    // Ảnh trong bài tải chậm (lazy) để trang nhẹ hơn
    img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: 'lazy' } }),
  },
  // Ảnh/video bị bỏ src (base64, trang lạ) thì bỏ luôn thẻ rỗng
  exclusiveFilter: (frame) => (frame.tag === 'img' || frame.tag === 'iframe') && !frame.attribs.src,
};

/** HTML từ trình duyệt -> HTML an toàn để lưu và hiển thị */
export function sanitizeRichHtml(html: string): string {
  return sanitizeHtml(html, OPTIONS).trim();
}