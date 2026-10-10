// Manual integration harness, served only by Vite dev; never included in the APK.
// Replace native Preferences/Filesystem plugins with in-memory fakes, then mount the
// real app. The fake media stream repeatedly paints a QR fixture into a video track.
import { Capacitor, registerPlugin } from '@capacitor/core'
import { mount } from 'svelte'
import '../src/app.css'

const prefs = new Map()
// These plugin fakes exercise UI persistence and successful/partial file writes.
registerPlugin('Preferences', { web: () => ({ get: async ({ key }) => ({ value: prefs.get(key) ?? null }), set: async ({ key, value }) => { prefs.set(key, value) } }) })
registerPlugin('Filesystem', { web: () => ({
    readdir: async () => ({ files: [{ name: 'org.xcsoar', type: 'directory' }, { name: 'org.xcsoar.testing', type: 'directory' }] }),
    writeFile: async ({ path, data }) => {
        if (document.querySelector('#fail').checked && path.includes('.testing')) throw new Error('Simulated permission denial')
        document.querySelector('#saved').textContent += `Saved ${path}: ${new DOMParser().parseFromString(data, 'text/xml').querySelectorAll('Point').length} points\n`
    },
}) })
Capacitor.getPlatform = () => 'android'
// Browser camera APIs do not expose a real test feed, so return a canvas stream whose
// frames contain the sample QR; the harness controls permission and track cleanup.
Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => {
    if (document.querySelector('#deny').checked) throw new DOMException('Denied', 'NotAllowedError')
    const image = new Image(); image.src = './fixtures/seeyou-mixed.png'; await image.decode()
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height
    const stream = canvas.captureStream(5)
    const timer = setInterval(() => canvas.getContext('2d').drawImage(image, 0, 0), 200)
    const track = stream.getVideoTracks()[0], stop = track.stop.bind(track)
    track.stop = () => { stop(); clearInterval(timer); document.querySelector('#camera-status').textContent = 'Camera stopped; track released' }
    document.querySelector('#camera-status').textContent = 'Camera active'
    return stream
} })
const { default: App } = await import('../src/App.svelte')
const { compStore } = await import('../src/lib/stores.js')
document.querySelector('#competition').onclick = () => compStore.set(JSON.stringify({ name: 'Test competition' }))
mount(App, { target: document.querySelector('#app') })
