import { IndicatorInfo } from '../../types/game';
import { Tile, TileColor, TileNumber } from '../../types/tile';

export function computeOkey(indicator: Tile): IndicatorInfo {
  if (indicator.kind === 'fake-joker') {
    // If indicator is a fake joker, okey is 1 of red (conventional)
    return {
      indicatorTile: indicator,
      okeyColor: 'red',
      okeyNumber: 1,
    };
  }

  const okeyNumber = ((indicator.number % 13) + 1) as TileNumber;
  return {
    indicatorTile: indicator,
    okeyColor: indicator.color as TileColor,
    okeyNumber,
  };
}

/** Fiziksel gösterge+1 okey taşı (numaralı). Sahte okey değil. */
export function isOkey(tile: Tile, indicator: IndicatorInfo): boolean {
  return (
    tile.kind === 'numbered'
    && tile.color === indicator.okeyColor
    && tile.number === indicator.okeyNumber
  );
}

/** Seri/grupta joker gibi davranan yalnızca gerçek okey taşı. */
export function isMeldWildcard(tile: Tile, indicator: IndicatorInfo): boolean {
  return isOkey(tile, indicator);
}

/**
 * Seri/grup doğrulaması için taşın sabit yüzü.
 * Sahte okey her zaman gösterge+1 ile aynı renk/sayıyı temsil eder (joker değil).
 */
export type TileMeldFace =
  | { kind: 'wildcard' }
  | { kind: 'fixed'; color: TileColor; number: TileNumber };

export function tileMeldFace(tile: Tile, indicator: IndicatorInfo): TileMeldFace | null {
  if (tile.kind === 'fake-joker') {
    return { kind: 'fixed', color: indicator.okeyColor, number: indicator.okeyNumber };
  }
  if (tile.kind !== 'numbered') return null;
  if (isOkey(tile, indicator)) return { kind: 'wildcard' };
  return { kind: 'fixed', color: tile.color, number: tile.number };
}

/** Ardışık seri tarayıcısı: sabit sıra numarası; gerçek okey (joker) için null. */
export function runRank(tile: Tile, indicator: IndicatorInfo): TileNumber | null {
  if (tile.kind === 'fake-joker') return indicator.okeyNumber;
  if (tile.kind !== 'numbered') return null;
  if (isOkey(tile, indicator)) return null;
  return tile.number;
}

/** Seri rengi; gerçek okey (joker) için null. */
export function runColor(tile: Tile, indicator: IndicatorInfo): TileColor | null {
  if (tile.kind === 'fake-joker') return indicator.okeyColor;
  if (tile.kind !== 'numbered') return null;
  if (isOkey(tile, indicator)) return null;
  return tile.color;
}
