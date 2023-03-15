const ONE_MEG = 1024 * 1024

export const largeFile = Uint8Array.from(new Array(ONE_MEG * 5).fill(0).map(() => Math.random() * 100))

export const smallFile = Uint8Array.from(new Array(13).fill(0).map(() => Math.random() * 100))
