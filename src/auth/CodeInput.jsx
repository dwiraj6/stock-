/* THE SIX-DIGIT INPUT.
   ────────────────────────────────────────────────────────────────
   Six boxes rather than one field, because a code arriving from a
   phone is read in pairs and typed with pauses, and six boxes show
   you where you are without counting.

   Every fiddly case is handled, because this is the one control in
   the product a user meets while already mildly annoyed:

     · paste fills all six from anywhere in the row, and strips the
       spaces and dashes that mail clients love to insert
     · backspace on an empty box steps back and clears the previous
       one, which is what the finger expects
     · arrows and Home/End move without editing
     · autocomplete="one-time-code" lets iOS and Android offer the
       code straight from the SMS or mail notification
     · a full six digits submits on its own — nobody wants to hunt
       for a button after typing a code they were just shown

   The inputs are type="text" with inputMode="numeric", not
   type="number", which would bring spinner arrows, allow "e" and
   "-", and silently drop a leading zero. */

import { useEffect, useRef } from 'react';

const LENGTH = 6;

export default function CodeInput({ value, onChange, onComplete, disabled, invalid }) {
  const refs = useRef([]);
  const digits = String(value ?? '').padEnd(LENGTH, ' ').slice(0, LENGTH).split('');

  useEffect(() => {
    // Land the caret in the first box when the step appears.
    refs.current[0]?.focus();
  }, []);

  const set = (next) => {
    const clean = next.replace(/\D/g, '').slice(0, LENGTH);
    onChange(clean);
    if (clean.length === LENGTH) onComplete?.(clean);
    return clean;
  };

  const handleChange = (i, raw) => {
    const typed = raw.replace(/\D/g, '');
    if (!typed) return;
    const current = String(value ?? '');
    /* Take the LAST character typed, so overtyping a filled box
       replaces it instead of being ignored. */
    const ch = typed[typed.length - 1];
    const arr = current.padEnd(LENGTH, ' ').split('');
    arr[i] = ch;
    const joined = arr.join('').replace(/\s+$/, '');
    const clean = set(joined);
    if (i < LENGTH - 1) refs.current[i + 1]?.focus();
    else if (clean.length === LENGTH) refs.current[i]?.blur();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const arr = String(value ?? '').padEnd(LENGTH, ' ').split('');
      if (arr[i] && arr[i] !== ' ') {
        arr[i] = ' ';
        onChange(arr.join('').replace(/\s+$/, ''));
      } else if (i > 0) {
        arr[i - 1] = ' ';
        onChange(arr.join('').replace(/\s+$/, ''));
        refs.current[i - 1]?.focus();
      }
      return;
    }
    if (e.key === 'ArrowLeft' && i > 0) { e.preventDefault(); refs.current[i - 1]?.focus(); }
    if (e.key === 'ArrowRight' && i < LENGTH - 1) { e.preventDefault(); refs.current[i + 1]?.focus(); }
    if (e.key === 'Home') { e.preventDefault(); refs.current[0]?.focus(); }
    if (e.key === 'End') { e.preventDefault(); refs.current[LENGTH - 1]?.focus(); }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const clean = set(e.clipboardData.getData('text'));
    refs.current[Math.min(clean.length, LENGTH - 1)]?.focus();
  };

  return (
    <div
      className={`au-code ${invalid ? 'is-invalid' : ''}`}
      role="group"
      aria-label="Six digit verification code"
    >
      {Array.from({ length: LENGTH }, (_, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          className="au-code-box font-data"
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          disabled={disabled}
          aria-label={`Digit ${i + 1}`}
          value={digits[i] === ' ' ? '' : digits[i]}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
}
