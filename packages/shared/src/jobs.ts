/** Dữ liệu của job "hello" trong hàng đợi system */
export interface SystemHelloJobData {
  from: string;
  at: string;
  /** Phòng Socket.IO nhận thông báo khi job xong, vd: staff:<id> */
  notifyRoom?: string;
}

/** Nội dung sự kiện JOB_COMPLETED gửi tới client */
export interface JobCompletedPayload {
  queue: string;
  jobId: string;
  name: string;
  result: unknown;
}