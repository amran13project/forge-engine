let counter = 0;

export function createForgeId(prefix = 'go'): string {
  counter += 1;
  const time = Date.now().toString(36);
  return `${prefix}_${time}_${counter.toString(36)}`;
}
