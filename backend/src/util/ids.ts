/** Generates prefix-stable ids of the form `<prefix>_<base36-time>_<random>`. */
export function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
