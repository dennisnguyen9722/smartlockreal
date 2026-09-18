/** Yêu cầu tối thiểu với mật khẩu nhân viên */
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

/** Những mật khẩu tuyệt đối không được dùng */
const FORBIDDEN = [
  'password', 'matkhau', '123456', 'qwerty', 'admin', 'khoathongminh',
];

export interface PasswordCheckResult {
  valid: boolean;
  errors: string[];
}

export function checkPasswordStrength(password: string): PasswordCheckResult {
  const errors: string[] = [];

  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Mật khẩu phải có ít nhất ${PASSWORD_MIN_LENGTH} ký tự`);
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    errors.push(`Mật khẩu không được quá ${PASSWORD_MAX_LENGTH} ký tự`);
  }
  if (!/[a-z]/.test(password)) errors.push('Cần ít nhất một chữ thường');
  if (!/[A-Z]/.test(password)) errors.push('Cần ít nhất một chữ hoa');
  if (!/[0-9]/.test(password)) errors.push('Cần ít nhất một chữ số');

  const lower = password.toLowerCase();
  if (FORBIDDEN.some((word) => lower.includes(word))) {
    errors.push('Mật khẩu chứa từ quá dễ đoán');
  }
  if (/^(.)\1+$/.test(password)) {
    errors.push('Mật khẩu không được lặp lại một ký tự');
  }

  return { valid: errors.length === 0, errors };
}
