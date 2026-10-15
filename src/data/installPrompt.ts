import { create } from 'zustand';
import { installHint, isIos, type InstallHint } from '../domain/install';

/** The event Chrome and Edge fire when the app can be installed; not in the DOM typings. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallState {
  event: BeforeInstallPromptEvent | null;
  installed: boolean;
}

export const useInstallState = create<InstallState>(() => ({ event: null, installed: false }));

const standalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** Starts listening for the install offer; call once when the app starts. */
export function initInstallPrompt(): () => void {
  const offered = (e: Event) => {
    e.preventDefault();
    useInstallState.setState({ event: e as BeforeInstallPromptEvent });
  };
  const done = () => useInstallState.setState({ event: null, installed: true });
  window.addEventListener('beforeinstallprompt', offered);
  window.addEventListener('appinstalled', done);
  return () => {
    window.removeEventListener('beforeinstallprompt', offered);
    window.removeEventListener('appinstalled', done);
  };
}

/** Opens the browser's own install dialog. */
export async function promptInstall(): Promise<void> {
  const { event } = useInstallState.getState();
  if (!event) return;
  await event.prompt();
  const { outcome } = await event.userChoice;
  if (outcome === 'accepted') useInstallState.setState({ event: null });
}

export function useInstallHint(): InstallHint {
  const { event, installed } = useInstallState();
  return installHint({
    standalone: installed || standalone(),
    canPrompt: event !== null,
    ios: isIos(navigator.userAgent, navigator.maxTouchPoints),
  });
}
