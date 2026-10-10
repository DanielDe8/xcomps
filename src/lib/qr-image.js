import jsQR from 'jsqr'

/** Turn QR decoder results into text while retaining legacy SeeYou byte encodings. */

// Some SeeYou QR codes use ISO-8859-1 bytes without an ECI header. jsQR's
// UTF-8-only text result is empty for these codes; preserve their waypoint names.
/** Decode RGBA image pixels to QR text, falling back to ISO-8859-1 when needed. */
export function decodeQrPixels(data, width, height) {
    const qr = jsQR(data, width, height, { inversionAttempts: 'attemptBoth' })
    if (!qr) return null
    if (qr.data) return qr.data
    const bytes = Uint8Array.from(qr.binaryData)
    try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
    catch { return Array.from(bytes, byte => String.fromCharCode(byte)).join('') }
}
