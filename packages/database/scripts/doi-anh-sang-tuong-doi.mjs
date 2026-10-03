/**
 * BÓC TÊN MÁY CHỦ KHỎI MỌI ĐƯỜNG DẪN ẢNH ĐANG LƯU TRONG DATABASE.
 *
 *   http://localhost:4000/media/2026/01/a.webp     ->  /media/2026/01/a.webp
 *   http://192.168.1.181:4000/media/2026/01/a.webp ->  /media/2026/01/a.webp
 *
 * VÌ SAO:
 * Lưu đường dẫn đầy đủ nghĩa là database bị trói vào MỘT địa chỉ. Mở web trên
 * điện thoại cùng wifi là ảnh thủng (điện thoại hiểu "localhost" là chính nó),
 * và khi lên tên miền thật lại phải sửa database lần nữa.
 *
 * Lưu đường dẫn tương đối thì trình duyệt tự ghép với tên miền nó đang mở, nên
 * CÙNG MỘT bản ghi chạy đúng ở cả ba nơi: máy lập trình, wifi nội bộ, tên miền thật.
 *
 * Chạy script này MỘT LẦN, sau khi đã chép xong env.ts và hai file next.config.ts.
 *
 * CHẠY (từ thư mục gốc dự án):
 *   cd packages/database
 *
 *   # Bước 1 — xem sắp bóc những địa chỉ nào (không sửa gì)
 *   node --env-file=../../.env scripts/doi-anh-sang-tuong-doi.mjs
 *
 *   # Bước 2 — sửa thật
 *   node --env-file=../../.env scripts/doi-anh-sang-tuong-doi.mjs --ghi
 *
 * AN TOÀN: không có --ghi thì script chạy trong giao dịch rồi HỦY, database
 * không đổi một chữ. Có --ghi thì mọi bảng sửa trong CÙNG một giao dịch: lỗi
 * giữa chừng là quay về nguyên trạng, không sửa được nửa chừng.
 *
 * Chạy nhầm nhiều lần không sao: lần hai trở đi không còn gì để bóc nên 0 dòng.
 */

import pg from 'pg';

const GHI = process.argv.includes('--ghi');

/**
 * Mọi cột đang chứa đường dẫn ảnh.
 *
 * Bốn cột HTML cũng phải sửa: trình soạn thảo chèn ảnh bằng đường dẫn đầy đủ,
 * nên ảnh NẰM TRONG bài viết / trang tĩnh / chính sách / câu trả lời cũng hỏng y hệt.
 */
const COT = [
    { bang: 'media_assets', cot: 'url', mo: 'Thư viện ảnh' },
    { bang: 'product_media', cot: 'url', mo: 'Ảnh sản phẩm' },
    { bang: 'brands', cot: 'logo_url', mo: 'Logo hãng' },
    { bang: 'brands', cot: 'authorization_doc_url', mo: 'Giấy ủy quyền' },
    { bang: 'locations', cot: 'image_urls', mo: 'Ảnh showroom', mang: true },
    { bang: 'posts', cot: 'content_html', mo: 'Ảnh trong bài viết' },
    { bang: 'pages', cot: 'content_html', mo: 'Ảnh trong trang tĩnh' },
    { bang: 'policy_versions', cot: 'content_html', mo: 'Ảnh trong chính sách' },
    { bang: 'faqs', cot: 'answer_html', mo: 'Ảnh trong câu hỏi thường gặp' },
];

/**
 * Chỉ bóc những địa chỉ CHẮC CHẮN LÀ CỦA MÌNH.
 *
 * Hai bảng media_assets và product_media chỉ do máy chủ của mình ghi vào, nên địa
 * chỉ xuất hiện ở đó đích thị là máy chủ ảnh của mình. Lấy đúng danh sách đó rồi
 * thay nguyên văn.
 *
 * KHÔNG dùng kiểu "hễ thấy http + /media/ là bóc": tôi đã thử và nó bóc nhầm link
 * trỏ ra web NGOÀI mà đường dẫn tình cờ cũng có /media/ (ví dụ một bài báo ở
 * https://trangkhac.vn/media/tin-tuc), biến link đó thành link nội bộ hỏng.
 */
const CAU_LAY_DIA_CHI = `
  SELECT goc, SUM(soDong)::int AS so FROM (
    SELECT substring(url FROM '(https?://[^/]+)/media/') AS goc, COUNT(*) AS soDong
      FROM media_assets  GROUP BY 1
    UNION ALL
    SELECT substring(url FROM '(https?://[^/]+)/media/'), COUNT(*)
      FROM product_media GROUP BY 1
  ) t
  WHERE goc IS NOT NULL
  GROUP BY goc ORDER BY so DESC
`;

/** Tìm chỗ nào CÒN SÓT đường dẫn đầy đủ sau khi chạy, để báo cho người dùng biết */
const CAU_CON_SOT = COT.map(({ bang, cot, mang }) =>
    mang
        ? `SELECT '${bang}.${cot}' AS o, substring(phanTu FROM '(https?://[^/]+)/media/') AS goc
       FROM ${bang}, unnest(${cot}) AS phanTu WHERE phanTu ~ 'https?://[^/]+/media/'`
        : // Phải đặt tên cột ở MỌI nhánh: trong UNION ALL chỉ nhánh đầu tiên quyết định
          // tên cột, mà nhánh đầu là cột nào thì tùy thứ tự trong mảng COT ở trên
          `SELECT '${bang}.${cot}' AS o, substring(${cot} FROM '(https?://[^/]+)/media/') AS goc
       FROM ${bang} WHERE ${cot} ~ 'https?://[^/]+/media/'`,
).join(' UNION ALL ');

function inLoi(thongDiep) {
    console.error(`\nLỗi: ${thongDiep}\n`);
    process.exit(1);
}

/** Bảng/cột chưa có (bản database cũ hơn) thì bỏ qua chứ không chết cả script */
function thieuBang(loi) {
    return loi.code === '42P01' || loi.code === '42703';
}

/* --------------------------------- Chạy --------------------------------- */

const chuoiKetNoi = process.env.DATABASE_URL;
if (!chuoiKetNoi) {
    inLoi(
        'Không thấy DATABASE_URL.\n' +
            'Nhớ chạy kèm --env-file=../../.env, ví dụ:\n' +
            '  node --env-file=../../.env scripts/doi-anh-sang-tuong-doi.mjs',
    );
}

const khach = new pg.Client({ connectionString: chuoiKetNoi });
await khach.connect();

try {
    const dangDinh = await khach.query(CAU_LAY_DIA_CHI);

    if (dangDinh.rows.length === 0) {
        console.log('\nKhông còn đường dẫn ảnh nào dính tên máy chủ — đã ở dạng tương đối hết.\n');
        process.exit(0);
    }

    console.log('\nCác địa chỉ máy chủ ảnh của mình, sẽ được bóc:\n');
    for (const dong of dangDinh.rows) {
        console.log(`  ${String(dong.so).padStart(5)} ảnh   ${dong.goc}/media/...  →  /media/...`);
    }
    console.log('\nĐịa chỉ nào không nằm trong danh sách trên sẽ KHÔNG bị đụng tới.\n');

    const diaChi = dangDinh.rows.map((dong) => dong.goc);

    await khach.query('BEGIN');

    /*
     * Tất cả địa chỉ xử lý trong MỘT câu lệnh cho mỗi cột, bằng replace() lồng nhau.
     *
     * Lúc đầu tôi chạy mỗi địa chỉ một câu rồi cộng số dòng lại — sai: một dòng chứa
     * hai địa chỉ (ảnh showroom chụp ở hai thời điểm) bị đếm thành hai. Gộp một câu
     * thì số dòng báo ra là số dòng thật.
     */
    const thamSo = diaChi.map((goc) => `${goc}/media/`);

    function bieuThucThay(ten) {
        return thamSo.reduce((trong, _, chiSo) => `replace(${trong}, $${chiSo + 1}, '/media/')`, ten);
    }
    function dieuKien(ten) {
        return thamSo.map((_, chiSo) => `position($${chiSo + 1} in ${ten}) > 0`).join(' OR ');
    }

    let tong = 0;
    for (const { bang, cot, mo, mang } of COT) {
        // Tên bảng và cột là hằng số viết sẵn trong file này, không phải dữ liệu nhập vào.
        // Riêng địa chỉ máy chủ thì truyền bằng tham số $1, $2... không ghép vào câu lệnh.
        const cauLenh = mang
            ? `UPDATE ${bang}
           SET ${cot} = ARRAY(SELECT ${bieuThucThay('phanTu')} FROM unnest(${cot}) AS phanTu)
         WHERE EXISTS (SELECT 1 FROM unnest(${cot}) AS phanTu WHERE ${dieuKien('phanTu')})`
            : `UPDATE ${bang} SET ${cot} = ${bieuThucThay(cot)}
         WHERE ${dieuKien(cot)}`;

        let soDong;
        try {
            soDong = (await khach.query(cauLenh, thamSo)).rowCount;
        } catch (loi) {
            if (thieuBang(loi)) {
                console.log(`  ${'(bỏ qua)'.padStart(10)}  ${mo} — chưa có ${bang}.${cot}`);
                continue;
            }
            throw loi;
        }

        tong += soDong;
        console.log(`  ${(soDong > 0 ? `${soDong} dòng` : '— dòng').padStart(10)}  ${mo}  (${bang}.${cot})`);
    }

    /* --- Còn sót gì không? Báo rõ thay vì im lặng --- */
    let conSot = [];
    try {
        const ket = await khach.query(CAU_CON_SOT);
        conSot = [...new Set(ket.rows.map((dong) => dong.goc).filter(Boolean))];
    } catch (loi) {
        if (!thieuBang(loi)) throw loi;
    }

    if (conSot.length > 0) {
        console.log(
            '\nCòn những địa chỉ này chưa bóc (không nằm trong thư viện ảnh của mình):\n' +
                conSot.map((goc) => `  ${goc}/media/...`).join('\n') +
                '\n\nNếu đó là ảnh của web khác thì ĐÚNG, cứ để nguyên.\n' +
                'Nếu đó là máy chủ ảnh cũ của mình thì báo tôi, tôi bổ sung.\n',
        );
    }

    if (GHI) {
        await khach.query('COMMIT');
        console.log(
            `\nXong, đã sửa ${tong} dòng.\n\n` +
                'Việc còn lại:\n' +
                '  1. Trong file .env sửa thành:  MEDIA_PUBLIC_URL=/media\n' +
                '     (tìm xem nó nằm file nào:  grep -rn MEDIA_PUBLIC_URL .env apps/api/.env )\n' +
                '  2. Khởi động lại cả ba: API, web, admin — đổi next.config.ts thì bắt buộc\n' +
                '     chạy lại, Next.js không tự nạp lại file đó.\n' +
                '  3. Mở lại trang, tải lại mạnh tay vì ảnh cũ còn trong bộ nhớ đệm trình duyệt.\n',
        );
    } else {
        await khach.query('ROLLBACK');
        console.log(
            `\nMới chỉ XEM TRƯỚC — database chưa đổi gì (${tong} dòng sẽ được sửa).\n` +
                'Thấy đúng rồi thì chạy lại y hệt, thêm --ghi vào cuối.\n',
        );
    }
} catch (loi) {
    await khach.query('ROLLBACK').catch(() => {});
    inLoi(loi.message);
} finally {
    await khach.end();
}
