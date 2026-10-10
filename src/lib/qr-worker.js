// Dedicated worker entry point: decode transferred RGBA pixels without blocking Svelte.
import { decodeQrPixels } from './qr-image.js'

// Keep the CPU-heavy QR scan off the UI thread; send only text or a safe error back.
self.onmessage = ({ data: { pixels, width, height } }) => {
    try { self.postMessage({ text: decodeQrPixels(pixels, width, height) }) }
    catch { self.postMessage({ error: 'Unable to decode this image.' }) }
}
