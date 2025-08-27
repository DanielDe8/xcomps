import { writable } from "svelte/store"

const viewStore = writable("home")
const compStore = writable("{}")

export { viewStore, compStore }