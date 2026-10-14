import { createCharacter, type Character } from '../domain/character';
import { newItem } from '../domain/inventory';
import type { Attack } from '../domain/sheet/sheet';

/** A made-up character with something in every part of the sheet, for tests and for looking at the PDF. */
export function sampleCharacter(name = 'Elowen Fiammaspenta'): Character {
  const c = createCharacter(name);
  const s = c.sheet;
  s.race = 'Elfo dei boschi';
  s.background = 'Sapiente';
  s.alignment = 'Neutrale buono';
  s.classes = [{ name: 'Mago', subclass: 'Scuola di Evocazione', level: 5, hitDie: 0, hitDiceUsed: 2 }];
  s.abilities = { str: 8, dex: 14, con: 14, int: 17, wis: 12, cha: 10 };
  s.saves.int.proficient = true;
  s.saves.wis.proficient = true;
  s.skills.arcana.prof = 2;
  s.skills.history.prof = 1;
  s.skills.investigation.prof = 1;
  s.skills.perception.prof = 0.5;
  s.skills.insight.bonus = 1;
  s.ac = 13;
  s.speedM = 9;
  s.darkvisionM = 18;
  s.inspiration = true;
  s.languages = ['Comune', 'Elfico', 'Draconico', 'Gnomesco'];
  s.otherProficiencies = 'Pugnali, dardi, fionde, bastoni ferrati, balestre leggere. Strumenti da calligrafo. Il personaggio ha competenza nel Giocoliere dei trucchi arcani e conosce bene le biblioteche di mezzo continente.';
  s.conditions = ['poisoned'];
  s.exhaustion = 1;
  const attack = (id: string, patch: Partial<Attack>): Attack => ({
    id,
    name: 'Attacco',
    ability: 'int',
    proficient: true,
    bonus: 0,
    damage: '1d10',
    addAbilityToDamage: false,
    damageBonus: 0,
    damageType: 'fuoco',
    notes: '',
    ...patch,
  });
  s.attacks = [
    attack('a1', { name: 'Dardo di fuoco', damage: '2d10' }),
    attack('a2', { name: 'Bastone ferrato', ability: 'str', damage: '1d6', addAbilityToDamage: true, damageType: 'contundente' }),
    attack('a3', { name: 'Pugnale', ability: 'dex', damage: '1d4', addAbilityToDamage: true, damageType: 'perforante' }),
  ];
  s.features = [
    { id: 'f1', name: 'Recupero arcano', source: 'Mago', text: 'Una volta al giorno, durante un riposo breve, puoi recuperare slot incantesimo spesi con livello combinato pari o inferiore a metà del tuo livello da mago (arrotondato per eccesso), e nessuno slot può essere di livello 6 o superiore.', uses: { cur: 1, max: 1, reset: 'long' } },
    { id: 'f2', name: 'Scolpire incantesimi', source: 'Evocazione', text: 'Quando lanci un incantesimo di evocazione che colpisce altre creature che puoi vedere, puoi scegliere alcune di esse perché riescano automaticamente nel tiro salvezza.', uses: null },
    { id: 'f3', name: 'Sensi acuti', source: 'Elfo', text: 'Hai competenza nell’abilità Percezione.', uses: null },
  ];
  s.spellcasting.slotsUsed = [2, 1, 0, 0, 0, 0, 0, 0, 0];
  s.spellcasting.lists = {
    wizard: {
      known: ['fire-bolt', 'mage-hand', 'light', 'prestidigitation', 'magic-missile', 'shield', 'detect-magic', 'identify', 'sleep', 'misty-step', 'fireball', 'counterspell', 'invisibility'],
      prepared: ['magic-missile', 'shield', 'detect-magic', 'misty-step', 'fireball', 'counterspell', 'invisibility'],
    },
  };
  c.hp = { cur: 24, max: 32, temp: 3 };
  c.deathSaves = { successes: 1, failures: 2 };
  c.inventory.coins = { cp: 12, sp: 8, ep: 0, gp: 143, pp: 2 };
  const bag = newItem('bag', { name: 'Zaino da esploratore', category: 'gear', isContainer: true, weightLb: 5, valueCp: 200 });
  c.inventory.items = [
    newItem('i1', { name: 'Bastone ferrato', category: 'weapon', weightLb: 4, valueCp: 20, equipped: true }),
    newItem('i2', { name: 'Libro degli incantesimi', category: 'tool', weightLb: 3, valueCp: 5000, notes: 'Rilegato in pelle, con i tuoi 13 incantesimi.' }),
    newItem('i3', { name: 'Pozione di cura', category: 'consumable', quantity: 3, weightLb: 0.5, valueCp: 5000 }),
    newItem('i4', { name: 'Anello di protezione', category: 'magic', weightLb: 0, valueCp: 350000, requiresAttunement: true, attuned: true, equipped: true }),
    bag,
    newItem('i5', { name: 'Razione di viaggio', category: 'gear', quantity: 10, weightLb: 2, valueCp: 50, containerId: 'bag' }),
    newItem('i6', { name: 'Corda di canapa (15 m)', category: 'gear', weightLb: 10, valueCp: 100, containerId: 'bag' }),
  ];
  return c;
}
