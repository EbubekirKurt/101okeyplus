import { Tile } from '../../types/tile';

/** createDeck ile aynı: numaralı taş id = renk harfi + sayı + kopya (0|1). */
function numberedCanonicalId(color: string, number: number, copy: 0 | 1): string {
  return `${color[0].toUpperCase()}-${number}-${copy}`;
}

/**
 * Firestore’dan gelen elde `id` / `copy` kayması veya aynı yüzden iki taşın
 * yanlışlıkla aynı `id` ile gelmesi drag / ıstaka senkronunda taş kaybına yol açar.
 * Her fiziksel taşın benzersiz `id`’si olmalı (ör. iki siyah 3 → B-3-0 ve B-3-1).
 */
export function repairHandTileIds(tiles: Tile[]): Tile[] {
  const pass1 = tiles.map((t): Tile => {
    if (t.kind === 'fake-joker') {
      const copy: 0 | 1 = t.copy === 1 ? 1 : 0;
      const id = `FJ-${copy}`;
      return t.id === id && t.copy === copy ? t : { ...t, id, copy };
    }
    const copy: 0 | 1 = t.copy === 1 ? 1 : 0;
    const id = numberedCanonicalId(t.color, t.number, copy);
    return t.id === id && t.copy === copy ? t : { ...t, id, copy };
  });

  const seen = new Set<string>();
  return pass1.map((t) => {
    if (t.kind === 'fake-joker') {
      if (!seen.has(t.id)) {
        seen.add(t.id);
        return t;
      }
      const alt: 0 | 1 = t.copy === 0 ? 1 : 0;
      const altId = `FJ-${alt}`;
      if (!seen.has(altId)) {
        seen.add(altId);
        return { ...t, copy: alt, id: altId };
      }
      return t;
    }
    if (!seen.has(t.id)) {
      seen.add(t.id);
      return t;
    }
    const altCopy: 0 | 1 = t.copy === 0 ? 1 : 0;
    const altId = numberedCanonicalId(t.color, t.number, altCopy);
    if (!seen.has(altId)) {
      seen.add(altId);
      return { ...t, copy: altCopy, id: altId };
    }
    if (import.meta.env.DEV) {
      console.warn('[repairHandTileIds] aynı yüz için 2 kopyadan fazla veya id çakışması', t);
    }
    return t;
  });
}
