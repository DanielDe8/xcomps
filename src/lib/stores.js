import { writable } from "svelte/store"

// App-wide navigation/competition state plus short-lived QR import handoff and status.
// `viewStore` selects the mounted screen (`home`, `comps`, `qr-camera`, or `qr-files`).
const viewStore = writable("home")
// Competition data is serialized because this store is shared by the two existing views.
const compStore = writable("{}")

export { viewStore, compStore }
// Carries the browser File from HomeView to the newly mounted import view.
export const qrFileStore = writable(null)
// Success message shown on the home screen after every selected destination saves.
export const importNoticeStore = writable("")
// Lets the native back-button handler avoid leaving during an active file write.
export const qrSavingStore = writable(false)
