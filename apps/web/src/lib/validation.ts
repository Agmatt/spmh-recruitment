// ── Phone number validation ────────────────────────────────
// Accepts:
//   +254 7XX XXX XXX / +254 1XX XXX XXX   (Kenyan international)
//   07XX XXX XXX / 01XX XXX XXX           (Kenyan local, auto-converted)
//   254XXXXXXXXX                          (Kenyan without +)
//   +<8-15 digits>                        (Generic E.164 international)
// Rejects: everything else (too short, letters, missing country code, etc.)

export type PhoneResult =
  | { ok: true; normalized: string }
  | { ok: false; error: string };

export function normalizeAndValidatePhone(input: string): PhoneResult {
  const trimmed = (input ?? '').trim();

  if (!trimmed) {
    return { ok: false, error: 'Phone number is required.' };
  }

  // Strip spaces, dashes, parens, dots
  let cleaned = trimmed.replace(/[^\d+]/g, '');

  // Only one leading '+' allowed
  if ((cleaned.match(/\+/g) || []).length > 1) {
    return { ok: false, error: 'Invalid phone number.' };
  }
  cleaned = cleaned.replace(/(?!^)\+/g, '');

  // Kenyan local: 07xxxxxxxx or 01xxxxxxxx
  if (/^0[17]\d{8}$/.test(cleaned)) {
    return { ok: true, normalized: '+254' + cleaned.slice(1) };
  }

  // Kenyan with country code, no plus
  if (/^254[17]\d{8}$/.test(cleaned)) {
    return { ok: true, normalized: '+' + cleaned };
  }

  // Kenyan with +254
  if (/^\+254[17]\d{8}$/.test(cleaned)) {
    return { ok: true, normalized: cleaned };
  }

  // Generic E.164: '+' followed by 8–15 digits
  if (/^\+\d{8,15}$/.test(cleaned)) {
    return { ok: true, normalized: cleaned };
  }

  return {
    ok: false,
    error:
      'Enter a valid phone number, e.g. +254 7XX XXX XXX or 07XX XXX XXX.',
  };
}

// ── Email validation ───────────────────────────────────────
// Stricter than the browser default — requires a real TLD (2+ chars),
// no spaces, no leading/trailing dots.

export const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export type EmailResult =
  | { ok: true; normalized: string }
  | { ok: false; error: string };

export function normalizeAndValidateEmail(input: string): EmailResult {
  const trimmed = (input ?? '').trim();

  if (!trimmed) {
    return { ok: false, error: 'Email address is required.' };
  }

  if (trimmed.length > 200) {
    return { ok: false, error: 'Email address is too long.' };
  }

  if (trimmed.includes(' ')) {
    return { ok: false, error: 'Email address cannot contain spaces.' };
  }

  // Reject leading/trailing dots in local or domain
  if (/^\./.test(trimmed) || /\.@/.test(trimmed) || /@\./.test(trimmed) || /\.\./.test(trimmed)) {
    return { ok: false, error: 'Enter a valid email address.' };
  }

  if (!EMAIL_REGEX.test(trimmed)) {
    return {
      ok: false,
      error: 'Enter a valid email address, e.g. name@example.com.',
    };
  }

  return { ok: true, normalized: trimmed.toLowerCase() };
}