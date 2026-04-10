/**
 * Fx stub: WorldMonitor uses Clerk for Pro auth. This app uses Supabase auth instead;
 * map/premium code paths expect these symbols so builds stay dependency-light.
 */

export async function initClerk(): Promise<void> {}

export function getClerk(): null {
  return null;
}

export function openSignIn(): void {}

export async function signOut(): Promise<void> {}

export async function getClerkToken(): Promise<string | null> {
  return null;
}

export function getCurrentClerkUser(): {
  id: string;
  name: string;
  email: string;
  image: string | null;
  plan: 'free' | 'pro';
} | null {
  return null;
}

export function subscribeClerk(_callback: () => void): () => void {
  return () => {};
}

export function mountUserButton(_el: HTMLDivElement): () => void {
  return () => {};
}
