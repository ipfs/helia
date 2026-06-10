import type { AbortOptions } from "@libp2p/interface";
import { raceSignal } from 'race-signal'

export function delay (ms: number, options?: AbortOptions): Promise<void> {
  return raceSignal(new Promise<void>(resolve => {
    setTimeout(() => resolve(), ms)
  }), options?.signal)
}
