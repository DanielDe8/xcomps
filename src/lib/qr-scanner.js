// One worker per scan session; disposal also settles an in-flight decode.
export function createQrReader() {
    const worker = new Worker(new URL('./qr-worker.js', import.meta.url), { type: 'module' })
    let pending = null, disposed = false
    worker.onmessage = ({ data }) => { const call = pending; pending = null; if (data.error) call?.reject(new Error(data.error)); else call?.resolve(data.text) }
    worker.onerror = () => { disposed = true; worker.terminate(); pending?.reject(new Error('Unable to start the QR decoder. Please reopen the scanner.')); pending = null }
    return {
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
        destroy() { disposed = true; worker.terminate(); pending?.resolve(null); pending = null },
    }
}

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
