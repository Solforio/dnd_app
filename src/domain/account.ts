/**
 * Friends see only "nome utente" and "password". Firebase Auth needs an email,
 * so each username maps to a synthetic one that is never used to send mail.
 */
export const USERNAME_DOMAIN = 'dnd.local';
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
/** Firebase Auth refuses shorter passwords; the app adds no rules of its own. */
export const PASSWORD_MIN = 6;

export type Validation = { ok: true; value: string } | { ok: false; error: string };

export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase();
}

export function validateUsername(input: string): Validation {
  const value = normalizeUsername(input);
  if (value === '') return { ok: false, error: 'Scrivi un nome utente.' };
  if (value.length < USERNAME_MIN || value.length > USERNAME_MAX) {
    return {
      ok: false,
      error: `Il nome utente deve avere da ${USERNAME_MIN} a ${USERNAME_MAX} caratteri (ora ne ha ${value.length}).`,
    };
  }
  if (!/^[a-z0-9_-]+$/.test(value)) {
    return {
      ok: false,
      error: 'Il nome utente può contenere solo lettere senza accenti, cifre, _ e -. Niente spazi.',
    };
  }
  return { ok: true, value };
}

export function validatePassword(input: string): Validation {
  if (input.length < PASSWORD_MIN) {
    return { ok: false, error: `La password deve avere almeno ${PASSWORD_MIN} caratteri: è il minimo che accetta Firebase.` };
  }
  return { ok: true, value: input };
}

export function usernameToEmail(username: string): string {
  return `${normalizeUsername(username)}@${USERNAME_DOMAIN}`;
}

export function emailToUsername(email: string | null | undefined): string {
  if (!email) return '';
  const at = email.lastIndexOf('@');
  return at > 0 ? email.slice(0, at) : email;
}

export const USER_SCHEMA_VERSION = 1;

/** users/{uid} */
export interface UserDoc {
  schemaVersion: typeof USER_SCHEMA_VERSION;
  username: string;
  activeCharacterId: string | null;
  createdAt: number;
}
