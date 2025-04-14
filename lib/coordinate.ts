import type { PomCoords } from './types';

export function parseCoordinate(coordinate: string): Partial<PomCoords> {
  if (!coordinate) return {};
  const [name, version] = coordinate.split('@');
  const [groupId, artifactId, type, classifier] = name?.split(':');
  return {
    groupId,
    artifactId,
    version,
    type,
    classifier,
  };
}

export function coordsToString(coords: Partial<PomCoords>): string {
  let name = `${coords.groupId || 'unknown'}:${
    coords.artifactId || 'unknown'
  }:${coords.type || 'jar'}`;
  if (coords.classifier) name += `:${coords.classifier}`;
  return `${name}@${coords.version || 'unknown'}`;
}
