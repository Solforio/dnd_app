/** A migration turns a document of version N into one of version N + 1. */
export type Migration = (doc: Record<string, unknown>) => Record<string, unknown>;

export class SchemaError extends Error {}

/**
 * Brings a stored document up to `current` by running each step in order.
 * Documents without a version are treated as version 1. Documents from a newer
 * app version are refused rather than guessed at, so nothing gets overwritten.
 */
export function runMigrations(
  raw: unknown,
  current: number,
  migrations: Readonly<Record<number, Migration>>,
): Record<string, unknown> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new SchemaError('Il dato non è un oggetto valido.');
  }
  let doc = { ...(raw as Record<string, unknown>) };
  const stored = doc.schemaVersion;
  let version = stored === undefined ? 1 : Number(stored);
  if (!Number.isInteger(version) || version < 1) {
    throw new SchemaError(`Versione dei dati non valida: ${String(stored)}.`);
  }
  if (version > current) {
    throw new SchemaError(
      `Questi dati vengono da una versione più recente dell’app (v${version}). Aggiorna la pagina e riprova.`,
    );
  }
  while (version < current) {
    const step = migrations[version];
    if (!step) throw new SchemaError(`Manca la migrazione dalla versione ${version}.`);
    doc = { ...step(doc), schemaVersion: version + 1 };
    version += 1;
  }
  return doc;
}
