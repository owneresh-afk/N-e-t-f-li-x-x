import type { ConvoState } from "./types.js";

const states = new Map<number, ConvoState>();

export function setConvo(userId: number, state: ConvoState): void {
  states.set(userId, state);
}

export function getConvo(userId: number): ConvoState | undefined {
  return states.get(userId);
}

export function clearConvo(userId: number): void {
  states.delete(userId);
}

export function hasConvo(userId: number): boolean {
  return states.has(userId);
}
