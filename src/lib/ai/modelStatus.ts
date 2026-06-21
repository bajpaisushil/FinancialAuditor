/**
 * Shared status of the on-device categorization model (~25 MB MiniLM).
 *
 * The model must be downloaded while ONLINE — Transformers.js caches it in the
 * browser, after which it works offline. So we let the user start that download
 * early (on the upload screen, before they go offline) and have both the
 * landing prep card and the dashboard toggle read the same status. Read with
 * useSyncExternalStore.
 */
export type AiModelPhase = "idle" | "downloading" | "ready" | "error";
export interface AiModelState {
  status: AiModelPhase;
  /** 0–100 while downloading. */
  progress: number;
}

const IDLE: AiModelState = { status: "idle", progress: 0 };
let state: AiModelState = IDLE;
const listeners = new Set<() => void>();

export function getAiModel(): AiModelState {
  return state;
}

/** Stable snapshot for SSR / first client render (must equal initial state). */
export function getAiModelServer(): AiModelState {
  return IDLE;
}

export function setAiModel(next: AiModelState): void {
  state = next;
  for (const l of listeners) l();
}

export function subscribeAiModel(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
