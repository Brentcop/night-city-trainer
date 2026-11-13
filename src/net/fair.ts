// Who picks first or second (rule 7.5: a random method both players agree on chooses a player, who then decides), done
// so that neither browser decides alone: each side picks a secret random number and sends its SHA-256 hash first
// (commit), then, once it has the other's hash, the number itself (reveal). Each side checks the other's number against
// its hash and both compute the same result from the two numbers, so neither can change its number after seeing the
// other's.

const toHex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');

/** A fresh secret: 16 random bytes as 32 hex digits. */
export function newNonce(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return toHex(b);
}

/** The commitment to a secret: SHA-256 of its text, as 64 hex digits. */
export async function commitOf(nonce: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`nct-roll:${nonce}`));
  return toHex(new Uint8Array(d));
}

/** Whether a revealed secret matches the commitment sent before it. */
export async function checkReveal(commit: string, nonce: string): Promise<boolean> {
  return (await commitOf(nonce)) === commit;
}

/** The chosen player from the two secrets: 0 the host, 1 the guest (the low bit of the two first bytes, XORed). */
export function chosenSeat(hostNonce: string, guestNonce: string): 0 | 1 {
  const a = parseInt(hostNonce.slice(0, 2), 16);
  const b = parseInt(guestNonce.slice(0, 2), 16);
  return ((a ^ b) & 1) as 0 | 1;
}
