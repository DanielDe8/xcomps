import jsQR from 'jsqr'

// Some SeeYou QR codes use ISO-8859-1 bytes without an ECI header. jsQR's
// UTF-8-only text result is empty for these codes; preserve their waypoint names.
export function decodeQrPixels(data, width, height) {
    const qr = jsQR(data, width, height, { inversionAttempts: 'attemptBoth' })
    if (!qr) return null
    if (qr.data) return qr.data
    const bytes = Uint8Array.from(qr.binaryData)
    try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
    catch { return Array.from(bytes, byte => String.fromCharCode(byte)).join('') }
}
