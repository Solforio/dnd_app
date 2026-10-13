import { formatNumber as n } from '../format/number';

export interface Hp {
  cur: number;
  max: number;
  temp: number;
}

export type SaveCount = 0 | 1 | 2 | 3;

export interface DeathSaves {
  successes: SaveCount;
  failures: SaveCount;
}

export interface Vitals {
  hp: Hp;
  deathSaves: DeathSaves;
}

/** Every rule returns the new state plus one Italian sentence for the status line. */
export interface VitalsChange {
  vitals: Vitals;
  message: string;
}

export const HP_LIMIT = 9999;
export const NO_SAVES: DeathSaves = { successes: 0, failures: 0 };

export type LifeState = 'conscious' | 'dying' | 'stable' | 'dead';

const clampInt = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.trunc(Number.isFinite(n) ? n : min)));

const toSaveCount = (n: number) => clampInt(n, 0, 3) as SaveCount;

export function lifeState({ hp, deathSaves }: Vitals): LifeState {
  if (deathSaves.failures >= 3) return 'dead';
  if (hp.cur > 0) return 'conscious';
  if (deathSaves.successes >= 3) return 'stable';
  return 'dying';
}

export function canRollDeathSave(v: Vitals): boolean {
  return lifeState(v) === 'dying';
}

function failures(saves: DeathSaves, added: number): DeathSaves {
  return { ...saves, failures: toSaveCount(saves.failures + added) };
}

export function applyDamage(v: Vitals, amount: number): VitalsChange {
  const dmg = clampInt(amount, 0, HP_LIMIT * 10);
  if (dmg === 0) return { vitals: v, message: 'Nessun danno da applicare.' };
  if (lifeState(v) === 'dead') return { vitals: v, message: 'Il personaggio è morto: i danni non cambiano nulla.' };

  const absorbed = Math.min(v.hp.temp, dmg);
  const rest = dmg - absorbed;
  const temp = v.hp.temp - absorbed;
  const absorbedText = absorbed > 0 ? ` (${n(absorbed)} assorbiti dai PF temporanei)` : '';

  // Already at 0 HP: any damage that gets past temporary HP costs a death save, or kills outright.
  if (v.hp.cur === 0) {
    const hp = { ...v.hp, temp };
    if (rest === 0) {
      return { vitals: { ...v, hp }, message: `Subiti ${n(dmg)} danni, tutti assorbiti dai PF temporanei.` };
    }
    if (rest >= v.hp.max) {
      return {
        vitals: { hp, deathSaves: { ...v.deathSaves, failures: 3 } },
        message: `Subiti ${n(dmg)} danni${absorbedText} a 0 PF, almeno quanto i PF massimi: morte istantanea.`,
      };
    }
    const wasStable = v.deathSaves.successes >= 3;
    const base = wasStable ? NO_SAVES : v.deathSaves;
    const deathSaves = failures(base, 1);
    const dead = deathSaves.failures >= 3;
    return {
      vitals: { hp, deathSaves },
      message:
        `Subiti ${n(dmg)} danni${absorbedText} a 0 PF: un fallimento al tiro salvezza contro morte (${deathSaves.failures}/3)` +
        (wasStable ? ', non sei più stabile' : '') +
        (dead ? '. Il personaggio è morto.' : '.'),
    };
  }

  const cur = Math.max(0, v.hp.cur - rest);
  const overflow = rest - v.hp.cur;
  const hp = { ...v.hp, cur, temp };
  if (cur === 0 && overflow >= v.hp.max) {
    return {
      vitals: { hp, deathSaves: { ...v.deathSaves, failures: 3 } },
      message: `Subiti ${n(dmg)} danni${absorbedText}: ${n(overflow)} oltre lo zero, almeno quanto i PF massimi. Morte istantanea.`,
    };
  }
  if (cur === 0) {
    return {
      vitals: { hp, deathSaves: NO_SAVES },
      message: `Subiti ${n(dmg)} danni${absorbedText}: sei a 0 PF e privo di sensi. Tira i tiri salvezza contro morte.`,
    };
  }
  return {
    vitals: { ...v, hp },
    message: `Subiti ${n(dmg)} danni${absorbedText}: ora hai ${n(cur)}/${n(v.hp.max)} PF.`,
  };
}

export function applyHealing(v: Vitals, amount: number): VitalsChange {
  const heal = clampInt(amount, 0, HP_LIMIT);
  if (heal === 0) return { vitals: v, message: 'Nessuna cura da applicare.' };
  if (lifeState(v) === 'dead') {
    return {
      vitals: v,
      message: 'Il personaggio è morto: una cura non basta. Azzera i fallimenti a mano se viene riportato in vita.',
    };
  }
  const cur = Math.min(v.hp.max, v.hp.cur + heal);
  const gained = cur - v.hp.cur;
  const wasted = heal - gained;
  const fromZero = v.hp.cur === 0 && cur > 0;
  return {
    vitals: { hp: { ...v.hp, cur }, deathSaves: fromZero ? NO_SAVES : v.deathSaves },
    message:
      `Curati ${n(gained)} PF: ora hai ${n(cur)}/${n(v.hp.max)} PF` +
      (wasted > 0 ? ` (${n(wasted)} oltre il massimo persi)` : '') +
      (fromZero ? '. Tiri salvezza contro morte azzerati.' : '.'),
  };
}

/** Temporary HP do not stack: the new value replaces the old one only if higher. */
export function gainTempHp(v: Vitals, amount: number): VitalsChange {
  const temp = clampInt(amount, 0, HP_LIMIT);
  if (temp <= v.hp.temp) {
    return {
      vitals: v,
      message: `Hai già ${n(v.hp.temp)} PF temporanei: ${n(temp)} non li sostituisce, perché i PF temporanei non si sommano.`,
    };
  }
  return {
    vitals: { ...v, hp: { ...v.hp, temp } },
    message:
      v.hp.temp > 0
        ? `PF temporanei: ${n(temp)}, al posto dei ${n(v.hp.temp)} precedenti.`
        : `PF temporanei: ${n(temp)}.`,
  };
}

export function longRest(v: Vitals): VitalsChange {
  return {
    vitals: { hp: { ...v.hp, cur: v.hp.max, temp: 0 }, deathSaves: NO_SAVES },
    message: `Riposo lungo: PF al massimo (${n(v.hp.max)}), PF temporanei e tiri salvezza contro morte azzerati.`,
  };
}

/** Direct edit of the three HP fields. Values are clamped; coming back above 0 HP resets death saves. */
export function editHp(v: Vitals, patch: Partial<Hp>): VitalsChange {
  const max = clampInt(patch.max ?? v.hp.max, 1, HP_LIMIT);
  const cur = clampInt(patch.cur ?? v.hp.cur, 0, max);
  const temp = clampInt(patch.temp ?? v.hp.temp, 0, HP_LIMIT);
  const revived = v.hp.cur === 0 && cur > 0;
  return {
    vitals: { hp: { cur, max, temp }, deathSaves: revived ? NO_SAVES : v.deathSaves },
    message: `PF impostati a ${n(cur)}/${n(max)}, temporanei ${n(temp)}` + (revived ? '. Tiri salvezza contro morte azzerati.' : '.'),
  };
}

export function setDeathSaves(v: Vitals, saves: { successes: number; failures: number }): VitalsChange {
  const deathSaves = { successes: toSaveCount(saves.successes), failures: toSaveCount(saves.failures) };
  const next = { ...v, deathSaves };
  const state = lifeState(next);
  const tail = state === 'dead' ? ' Il personaggio è morto.' : state === 'stable' ? ' Il personaggio è stabile.' : '';
  return {
    vitals: next,
    message: `Tiri salvezza contro morte: ${deathSaves.successes} successi, ${deathSaves.failures} fallimenti.${tail}`,
  };
}

/** Applies a natural d20 result to a dying character. */
export function applyDeathSave(v: Vitals, natural: number): VitalsChange {
  if (!canRollDeathSave(v)) {
    return { vitals: v, message: 'Il tiro salvezza contro morte si fa solo a 0 PF, se non sei stabile o morto.' };
  }
  if (natural === 20) {
    return {
      vitals: { hp: { ...v.hp, cur: 1 }, deathSaves: NO_SAVES },
      message: 'Tiro salvezza contro morte: 20 naturale! Torni a 1 PF e riprendi i sensi.',
    };
  }
  if (natural === 1) {
    const deathSaves = failures(v.deathSaves, 2);
    return {
      vitals: { ...v, deathSaves },
      message:
        `Tiro salvezza contro morte: 1 naturale, due fallimenti (${deathSaves.failures}/3).` +
        (deathSaves.failures >= 3 ? ' Il personaggio è morto.' : ''),
    };
  }
  if (natural >= 10) {
    const deathSaves = { ...v.deathSaves, successes: toSaveCount(v.deathSaves.successes + 1) };
    return {
      vitals: { ...v, deathSaves },
      message:
        `Tiro salvezza contro morte: ${natural}, un successo (${deathSaves.successes}/3).` +
        (deathSaves.successes >= 3 ? ' Il personaggio è stabile.' : ''),
    };
  }
  const deathSaves = failures(v.deathSaves, 1);
  return {
    vitals: { ...v, deathSaves },
    message:
      `Tiro salvezza contro morte: ${natural}, un fallimento (${deathSaves.failures}/3).` +
      (deathSaves.failures >= 3 ? ' Il personaggio è morto.' : ''),
  };
}
