const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
const GROUP_UNITS = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];

/** Đọc một nhóm 3 chữ số. full = nhóm không đứng đầu, phải đọc đủ "không trăm", "linh" */
function readGroup(value: number, full: boolean): string {
  const hundreds = Math.floor(value / 100);
  const tens = Math.floor((value % 100) / 10);
  const units = value % 10;
  const words: string[] = [];

  if (full || hundreds > 0) words.push(DIGITS[hundreds] ?? '', 'trăm');
  if (tens === 0) {
    if (units > 0 && (full || hundreds > 0)) words.push('linh');
  } else if (tens === 1) {
    words.push('mười');
  } else {
    words.push(DIGITS[tens] ?? '', 'mươi');
  }
  if (units > 0) {
    if (units === 1 && tens > 1) words.push('mốt');
    else if (units === 5 && tens > 0) words.push('lăm');
    else words.push(DIGITS[units] ?? '');
  }
  return words.join(' ');
}

/** 12.345.000 -> "Mười hai triệu ba trăm bốn mươi lăm nghìn đồng" */
export function vndToWords(amount: number): string {
  const value = Math.floor(Math.abs(amount));
  if (value === 0) return 'Không đồng';

  const groups: number[] = [];
  for (let rest = value; rest > 0; rest = Math.floor(rest / 1000)) groups.push(rest % 1000);

  const parts: string[] = [];
  for (let index = groups.length - 1; index >= 0; index -= 1) {
    const group = groups[index] ?? 0;
    if (group === 0) continue;
    const leading = index === groups.length - 1;
    parts.push([readGroup(group, !leading), GROUP_UNITS[index]].filter(Boolean).join(' '));
  }
  const text = `${parts.join(' ')} đồng`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}