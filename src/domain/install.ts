/** What the install hint needs to know about the browser; pure so that it can be tested. */

/** iPhone, iPad (also when it presents itself as a Mac with a touch screen): no install button there, only «Aggiungi alla schermata Home». */
export function isIos(userAgent: string, maxTouchPoints: number): boolean {
  return /iPad|iPhone|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}

export type InstallHint = 'installed' | 'prompt' | 'ios' | 'none';

/**
 * Which hint to show: nothing when the app already runs installed, the install button when the browser
 * offered one (Chrome and Edge, on Android and on the desktop), the how-to on iOS, nothing otherwise.
 */
export function installHint(opts: { standalone: boolean; canPrompt: boolean; ios: boolean }): InstallHint {
  if (opts.standalone) return 'installed';
  if (opts.canPrompt) return 'prompt';
  return opts.ios ? 'ios' : 'none';
}
