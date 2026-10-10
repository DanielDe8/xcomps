import { decodeQrPixels } from './qr-image.js'
self.onmessage = ({ data: { pixels, width, height } }) => {
    try { self.postMessage({ text: decodeQrPixels(pixels, width, height) }) }
    catch { self.postMessage({ error: 'Unable to decode this image.' }) }
}
