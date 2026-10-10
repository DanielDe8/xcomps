/** Camera/file QR decoding helpers. Pixel decoding runs off the UI thread in a worker. */

/**
 * Create a reader for one import-screen lifetime. A single request may be in flight;
 * `destroy` terminates the worker and resolves that request as an empty result so
 * camera shutdown or view navigation cannot leave the UI waiting forever.
 */
export function createQrReader() {
    const worker = new Worker(new URL('./qr-worker.js', import.meta.url), { type: 'module' })
    let pending = null, disposed = false
    // Resolve exactly the pending frame read, then free the single-request slot.
    worker.onmessage = ({ data }) => { const call = pending; pending = null; if (data.error) call?.reject(new Error(data.error)); else call?.resolve(data.text) }
    // Surface worker startup/runtime failures to the caller and make this reader unusable.
    worker.onerror = () => { disposed = true; worker.terminate(); pending?.reject(new Error('Unable to start the QR decoder. Please reopen the scanner.')); pending = null }
    return {
        /**
         * Copy an image/video frame to a scaled canvas and transfer its RGBA pixels to
         * the worker. Returns decoded text, `null` when no code is present, or rejects
         * for invalid use/decoder errors. The longest edge is capped by `maxSize`.
         */
        read(image, maxSize = 1800) {
            if (disposed) return Promise.reject(new Error('QR scanner was closed.'))
            if (pending) return Promise.reject(new Error('A QR scan is already running.'))
            const width = image.videoWidth || image.naturalWidth || image.width
            const height = image.videoHeight || image.naturalHeight || image.height
            if (!width || !height) return Promise.resolve(null)
            const scale = Math.min(1, maxSize / Math.max(width, height))
            const canvas = document.createElement('canvas')
            canvas.width = Math.round(width * scale)
            canvas.height = Math.round(height * scale)
            const context = canvas.getContext('2d', { willReadFrequently: true })
            context.drawImage(image, 0, 0, canvas.width, canvas.height)
            const { data: pixels } = context.getImageData(0, 0, canvas.width, canvas.height)
            return new Promise((resolve, reject) => {
                pending = { resolve, reject }
                worker.postMessage({ pixels, width: canvas.width, height: canvas.height }, [pixels.buffer])
            })
        },
        /** Stop this session's worker and settle any pending frame read. */
        destroy() { disposed = true; worker.terminate(); pending?.resolve(null); pending = null },
    }
}

/**
 * Decode a selected image file. Reject oversized/unreadable images, try a detailed
 * rendering first, then a smaller rendering for photos whose original dimensions add
 * noise or exceed useful QR-decoder resolution. The object URL is always released.
 */
export async function readQrFile(file, reader) {
    if (file.size > 30 * 1024 * 1024) throw new Error('Please choose an image smaller than 30 MB.')
    const url = URL.createObjectURL(file)
    try {
        const image = new Image()
        image.src = url
        try { await image.decode() } catch { throw new Error('This image cannot be opened. Choose a JPEG, PNG or WebP photo of the QR code.') }
        // Try both resolutions: dense QR codes need more detail; large photos
        // sometimes decode better after downsampling.
        return await reader.read(image, 2400) || await reader.read(image, 1200)
    } finally { URL.revokeObjectURL(url) }
}
