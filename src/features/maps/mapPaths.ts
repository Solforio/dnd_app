import type { MapScope } from '../../data/mapStore';

export const mapPath = (scope: MapScope, mapId: string) =>
  scope.kind === 'personal' ? `/mappe/io/${mapId}` : `/mappe/gruppo/${scope.pid}/${mapId}`;
