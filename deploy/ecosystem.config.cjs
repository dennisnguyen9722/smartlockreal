/**
 * ============================================================================
 *  CẤU HÌNH PM2 CHO khoathongminhchinhhang.vn
 * ============================================================================
 *
 *  VPS đang có 8 app PM2 của website khác. File này KHÔNG liệt kê chúng, nên
 *  mọi lệnh pm2 dùng kèm file này chỉ tác động tới 4 app tên "ktm-*".
 *
 *  TUYỆT ĐỐI KHÔNG chạy:  pm2 kill  /  pm2 delete all  /  pm2 resurrect
 *  — sẽ hạ cả 8 app của website khác.
 *
 *  Đuôi .cjs (không phải .js): gốc monorepo có "type": "module", mà PM2 nạp
 *  file cấu hình bằng require() nên phải là CommonJS.
 * ============================================================================
 */

const GOC = '/var/www/khoathongminhchinhhang.vn';
const UNG_DUNG = `${GOC}/app`;
const CHAY = `${UNG_DUNG}/deploy/chay.sh`;

/**
 * @param {string} ten      tên ngắn, cũng là tên file log
 * @param {string} ram      ngưỡng RAM, quá thì PM2 khởi động lại app
 */
function ung(ten, ram) {
    return {
        name: `ktm-${ten}`,
        script: CHAY,
        args: ten,
        // chay.sh là script bash, không phải JS
        interpreter: 'bash',
        cwd: UNG_DUNG,

        // fork, KHÔNG cluster: cluster mode của PM2 dùng node:cluster của chính
        // tiến trình PM2 (Node 20), sẽ không áp được Node 24 trong chay.sh.
        exec_mode: 'fork',
        instances: 1,

        autorestart: true,
        // Hỏng cấu hình thì app chết ngay khi vừa bật. min_uptime + max_restarts
        // để PM2 bỏ cuộc sau 10 lần thay vì quay vòng vô hạn ăn hết CPU của VPS.
        min_uptime: '20s',
        max_restarts: 10,
        restart_delay: 3000,

        max_memory_restart: ram,
        // Cho app kịp đóng kết nối database / kết thúc job đang chạy
        kill_timeout: 10000,

        out_file: `${GOC}/logs/${ten}.log`,
        error_file: `${GOC}/logs/${ten}.loi.log`,
        merge_logs: true,
        time: true,
    };
}

module.exports = {
    apps: [
        ung('api', '500M'),
        ung('worker', '400M'),
        ung('web', '650M'),
        ung('admin', '650M'),
    ],
};
