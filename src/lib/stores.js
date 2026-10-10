import { writable } from "svelte/store"

const viewStore = writable("home")
const compStore = writable("{}")

export { viewStore, compStore }
export const qrFileStore = writable(null)
export const importNoticeStore = writable("")
export const qrSavingStore = writable(false)
