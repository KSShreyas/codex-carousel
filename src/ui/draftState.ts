export type DraftSyncPolicy = {
  dirty: boolean;
  touched: boolean;
  isOpen: boolean;
};

export function shouldSyncDraftFromSaved(policy: DraftSyncPolicy): boolean {
  if (policy.dirty) return false;
  if (!policy.isOpen) return true;
  return !policy.touched;
}

export function computeDirty<T>(draft: T, saved: T): boolean {
  return JSON.stringify(draft) !== JSON.stringify(saved);
}
