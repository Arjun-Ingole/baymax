export const makeFindingId = (...parts: string[]): string =>
  parts.join('::').replace(/\s+/g, '-').toLowerCase();
