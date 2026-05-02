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

export function isOkey(tile: Tile, indicator: IndicatorInfo): boolean {
  if (tile.kind === 'fake-joker') return true;
  return tile.color === indicator.okeyColor && tile.number === indicator.okeyNumber;
}
