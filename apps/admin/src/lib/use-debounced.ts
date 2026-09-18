'use client';

import { useEffect, useState } from 'react';

/**
 * Trả về giá trị sau khi người dùng ngừng thay đổi trong `delay` mili giây.
 * Dùng cho ô tìm kiếm để không gọi API sau mỗi phím gõ.
 */
export function useDebounced<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
