import React, { useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';

export default function OtpInput({
  length = 6,
  value = '',
  onChange,
  onComplete,
  disabled = false,
  className = '',
  autoComplete = 'one-time-code',
  autoFocus = true,
  idPrefix = 'otp',
}) {
  const refs = useRef([]);

  const digits = String(value || '').replace(/\D/g, '').slice(0, length);

  useEffect(() => {
    if (!autoFocus) return;
    const el = refs.current[0];
    try { el && el.focus && el.focus(); } catch (_) {}
  }, [autoFocus]);

  const setDigitAt = (idx, val) => {
    const arr = Array.from({ length }, (_, k) => (digits[k] || ''));
    arr[idx] = val;
    const next = arr.join('');
    onChange && onChange(next);
    if (next.length === length && onComplete) onComplete(next);
  };

  const focusAt = (idx) => {
    const el = refs.current[idx];
    if (el && typeof el.focus === 'function') {
      try { el.focus(); el.select?.(); } catch (_) {}
    }
  };

  const handleChange = (idx, raw) => {
    const v = String(raw || '').replace(/\D/g, '').slice(0, 1);
    setDigitAt(idx, v);
    if (v && idx < length - 1) focusAt(idx + 1);
  };

  const handleKeyDown = (idx, e) => {
    const key = e.key;
    const cur = digits[idx] || '';
    if (key === 'Backspace') {
      if (cur) {
        e.preventDefault();
        setDigitAt(idx, '');
      } else if (idx > 0) {
        e.preventDefault();
        focusAt(idx - 1);
        setTimeout(() => setDigitAt(idx - 1, ''), 0);
      }
    } else if (key === 'ArrowLeft' && idx > 0) {
      e.preventDefault();
      focusAt(idx - 1);
    } else if (key === 'ArrowRight' && idx < length - 1) {
      e.preventDefault();
      focusAt(idx + 1);
    }
  };

  const handlePaste = (e) => {
    try {
      const txt = (e.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, length);
      if (!txt) return;
      e.preventDefault();
      const arr = Array.from({ length }, (_, i) => txt[i] || '');
      const next = arr.join('');
      onChange && onChange(next);
      const last = Math.min(txt.length, length) - 1;
      focusAt(last >= 0 ? last : 0);
      if (next.length === length && onComplete) onComplete(next);
    } catch (_) {}
  };

  return (
    <div className={`grid grid-cols-6 gap-2 ${className}`} onPaste={handlePaste}>
      {Array.from({ length }).map((_, i) => (
        <Input
          key={`otp-${i}`}
          id={`${idPrefix}-${i}`}
          ref={(el) => { refs.current[i] = el; }}
          value={digits[i] || ''}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          className="text-center"
          autoComplete={i === 0 ? autoComplete : 'off'}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
