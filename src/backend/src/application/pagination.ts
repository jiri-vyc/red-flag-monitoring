export type PageRequest = { limit: number; offset: number };
export type Page<T> = PageRequest & { items: T[]; total: number };
