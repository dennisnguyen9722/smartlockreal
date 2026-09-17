/** Dữ liệu của job "hello" trong hàng đợi system */
export interface SystemHelloJobData {
  from: string;
  at: string;
  /** Room Socket.IO sẽ nhận thông báo khi job xong */
  notifyRoom?: string;
}

/** Nội dung sự kiện JOB_COMPLETED gửi tới client */
export interface JobCompletedPayload {
  queue: string;
  jobId: string;
  name: string;
  result: unknown;
}