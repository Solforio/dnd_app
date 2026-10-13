import type { RollMode } from '../../domain/dice/types';

export const MODE_LABEL: Record<RollMode, string> = {
  normal: 'Normale',
  advantage: 'Vantaggio',
  disadvantage: 'Svantaggio',
};
