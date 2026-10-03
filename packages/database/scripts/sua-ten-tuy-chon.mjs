/**
 * SỬA TÊN NHÓM TÙY CHỌN BỊ GHI THÀNH MÃ ("mau" → "Màu sắc").
 *
 * VÌ SAO:
 * File Excel nhập sản phẩm chỉ có MÃ tùy chọn, không có cột tên hiển thị
 * (dạng ô: mau=vang-ho-phach:Vàng hổ phách). Trình nhập lấy luôn mã làm tên,
 * nên website hiện "mau" thay vì "Màu sắc" ngay trên đầu nhóm nút chọn.
 *
 * Script này đổi lại tên theo một bảng tra. Mã nào không có trong bảng thì
 * GIỮ NGUYÊN và liệt kê ra cuối để bạn báo lại, tôi bổ sung — thà để nguyên
 * còn hơn đoán bừa rồi ghi sai tên lên website.
 *
 * Tên nào người dùng đã tự sửa trong trang quản trị (có dấu tiếng Việt, hoặc
 * có chữ hoa) thì KHÔNG đụng tới.
 *
 * CHẠY (từ thư mục gốc dự án):
 *   cd packages/database
 *
 *   # Xem trước, không sửa gì
 *   node --env-file=../../.env scripts/sua-ten-tuy-chon.mjs
 *
 *   # Sửa thật
 *   node --env-file=../../.env scripts/sua-ten-tuy-chon.mjs --ghi
 *
 * Không có --ghi thì chạy trong giao dịch rồi HỦY, database không đổi một chữ.
 */

import pg from 'pg';

const GHI = process.argv.includes('--ghi');

/**
 * Bảng tra mã → tên hiển thị.
 *
 * Bảng này CÓ BẢN SAO trong apps/api/src/catalog/import/import.service.ts
 * (hàm tenTuyChon). Sửa bên này thì nhớ sửa bên đó, nếu không lần nhập Excel
 * tiếp theo lại sinh ra tên sai.
 */
const BANG_TRA = {
    mau: 'Màu sắc',
    'mau-sac': 'Màu sắc',
    color: 'Màu sắc',
    app: 'Ứng dụng',
    'ung-dung': 'Ứng dụng',
    'ket-noi': 'Kết nối',
    kieu: 'Kiểu mở',
    'kieu-mo': 'Kiểu mở',
    'kieu-khoa': 'Kiểu khóa',
    loai: 'Loại',
    'loai-khoa': 'Loại khóa',
    size: 'Kích thước',
    'kich-thuoc': 'Kích thước',
    'kich-co': 'Kích cỡ',
    'chat-lieu': 'Chất liệu',
    'vat-lieu': 'Vật liệu',
    'phien-ban': 'Phiên bản',
    version: 'Phiên bản',
    'tay-nam': 'Tay nắm',
    'tay-cam': 'Tay cầm',
    the: 'Thẻ từ',
    'the-tu': 'Thẻ từ',
    'do-day': 'Độ dày',
    'chieu-day': 'Độ dày',
    huong: 'Chiều mở',
    'chieu-mo': 'Chiều mở',
    remote: 'Điều khiển từ xa',
    'dieu-khien': 'Điều khiển',
    camera: 'Camera',
    pin: 'Nguồn điện',
    'van-tay': 'Vân tay',
    'man-hinh': 'Màn hình',
};

/**
 * Tên đang là MÃ hay là tên người đã đặt tử tế?
 * Mã thì chỉ có chữ thường, số và gạch ngang — không dấu, không khoảng trắng.
 * Có dấu tiếng Việt hoặc chữ hoa nghĩa là người đã sửa rồi, đừng đụng vào.
 */
function trongNhuMa(ten) {
    return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(ten);
}

function inLoi(thongDiep) {
    console.error(`\nLỗi: ${thongDiep}\n`);
    process.exit(1);
}

/* --------------------------------- Chạy --------------------------------- */

const chuoiKetNoi = process.env.DATABASE_URL;
if (!chuoiKetNoi) {
    inLoi(
        'Không thấy DATABASE_URL.\n' +
            'Nhớ chạy kèm --env-file=../../.env, ví dụ:\n' +
            '  node --env-file=../../.env scripts/sua-ten-tuy-chon.mjs',
    );
}

const khach = new pg.Client({ connectionString: chuoiKetNoi });
await khach.connect();

try {
    const ds = await khach.query(`
    SELECT code, name, COUNT(*)::int AS so
      FROM product_options
     GROUP BY code, name
     ORDER BY so DESC, code
  `);

    if (ds.rows.length === 0) {
        console.log('\nChưa có nhóm tùy chọn nào trong database.\n');
        process.exit(0);
    }

    const canSua = [];
    const khongBiet = [];
    const boQua = [];

    for (const dong of ds.rows) {
        if (!trongNhuMa(dong.name)) {
            boQua.push(dong);
            continue;
        }
        const tenMoi = BANG_TRA[dong.code] ?? BANG_TRA[dong.name];
        if (tenMoi) canSua.push({ ...dong, tenMoi });
        else khongBiet.push(dong);
    }

    console.log('\nCác nhóm tùy chọn đang có:\n');
    for (const d of canSua) {
        console.log(`  ✎ ${String(d.so).padStart(4)} sản phẩm   "${d.name}"  →  "${d.tenMoi}"`);
    }
    for (const d of boQua) {
        console.log(`  · ${String(d.so).padStart(4)} sản phẩm   "${d.name}"  (đã có tên tử tế, bỏ qua)`);
    }
    for (const d of khongBiet) {
        console.log(`  ? ${String(d.so).padStart(4)} sản phẩm   mã "${d.code}", tên "${d.name}"  ← CHƯA CÓ TRONG BẢNG TRA`);
    }

    if (canSua.length === 0) {
        console.log('\nKhông có gì để sửa.\n');
        if (khongBiet.length > 0) {
            console.log('Mấy mã có dấu "?" ở trên thì gửi tôi, tôi bổ sung vào bảng tra.\n');
        }
        process.exit(0);
    }

    await khach.query('BEGIN');

    let tong = 0;
    for (const d of canSua) {
        const ket = await khach.query(
            `UPDATE product_options SET name = $1 WHERE code = $2 AND name = $3`,
            [d.tenMoi, d.code, d.name],
        );
        tong += ket.rowCount;
    }

    if (GHI) {
        await khach.query('COMMIT');
        console.log(`\nXong, đã đổi tên ${tong} nhóm tùy chọn.`);
        console.log('Trang sản phẩm đặt revalidate = 60 giây, nên chờ chút hoặc Cmd+Shift+R.\n');
    } else {
        await khach.query('ROLLBACK');
        console.log(`\nMới chỉ XEM TRƯỚC — database chưa đổi gì (${tong} nhóm sẽ được sửa).`);
        console.log('Thấy đúng rồi thì chạy lại y hệt, thêm --ghi vào cuối.\n');
    }

    if (khongBiet.length > 0) {
        console.log('Những mã có dấu "?" ở trên tôi chưa biết dịch là gì — gửi tôi, tôi bổ sung.\n');
    }
} catch (loi) {
    await khach.query('ROLLBACK').catch(() => {});
    inLoi(loi.message);
} finally {
    await khach.end();
}
