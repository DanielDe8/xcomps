import { Inflate } from 'pako'
import xmlbuilder from 'xmlbuilder'

/**
 * Decode supported XCTrack and SeeYou QR payloads into a validated, app-neutral task,
 * then serialize that task as an XCSoar .tsk XML file. Keep this module independent of
 * the UI so format and conversion rules can be reviewed and exercised in isolation.
 * Unsupported source rules are rejected; rules that XCSoar cannot store are returned
 * as warnings/details for the import review screen.
 */
const MAX_PAYLOAD = 256 * 1024

/** Throw a user-readable validation error from any stage of decoding. */
const fail = message => { throw new Error(message) }

/** Require a non-array JSON object and include its field's role in the error. */
const object = (value, label) => value && typeof value === 'object' && !Array.isArray(value)
    ? value : fail(`Invalid ${label}.`)

/** Validate a finite numeric value and its inclusive format-specific range. */
const number = (value, min, max, label) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
    ? value : fail(`Invalid ${label}.`)

/** Validate optional display text, reject control characters, and apply a fallback. */
const text = (value, label, fallback = '') => {
    if (value === undefined || value === '') return fallback
    if (typeof value !== 'string' || value.length > 500 || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)) fail(`Invalid ${label}.`)
    return value
}

/**
 * Decode XCTSK's signed, 5-bit continuation encoding. Values are independent integers
 * (not polyline deltas) in longitude, latitude, altitude, then optional radius order.
 * `count` is strict so a malformed coordinate cannot silently shift later fields.
 */
export function decodePolyline(encoded, count = 4) {
    if (typeof encoded !== 'string' || encoded.length > 100) fail('Invalid encoded coordinates.')
    const values = []
    let offset = 0
    while (offset < encoded.length) {
        let value = 0, shift = 0, byte
        do {
            if (offset >= encoded.length || shift > 30) fail('Truncated or oversized encoded coordinates.')
            byte = encoded.charCodeAt(offset++) - 63
            if (byte < 0 || byte > 63) fail('Invalid encoded coordinates.')
            value += (byte & 31) * 2 ** shift
            shift += 5
        } while (byte & 32)
        // The low bit is the sign flag (zig-zag encoding); the remaining bits are magnitude.
        values.push(value % 2 ? -(value + 1) / 2 : value / 2)
    }
    if (values.length !== count) fail('Wrong number of encoded coordinates.')
    return values
}

/** Strip XCTSK prefixes, inflate XCTSKZ data, and parse the bounded JSON task object. */
function unpack(payload) {
    if (typeof payload !== 'string' || payload.length > MAX_PAYLOAD) fail('The QR task is too large.')
    let json = payload.trim()
    if (/^https?:/i.test(json)) fail('This QR code contains a web link. In SeeYou, open Share → Mobile and use the task QR code, not the public-link QR code.')
    if (/^XCTSKZ:/i.test(json)) {
        // Inflate incrementally and cap the output too, so a small compressed QR cannot expand unboundedly.
        const base64 = json.slice(7)
        if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) fail('Invalid compressed task encoding.')
        try {
            const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
            const inflater = new Inflate({ to: 'string', chunkSize: 16384 })
            let size = 0
            const chunks = []
            inflater.onData = chunk => {
                size += chunk.length
                if (size > MAX_PAYLOAD) fail('The QR task is too large.')
                chunks.push(chunk)
            }
            inflater.push(bytes, true)
            if (inflater.err || !inflater.ended) fail('Invalid compressed data.')
            json = chunks.join('')
        } catch (error) {
            fail(`Cannot decompress this task: ${error.message || 'invalid data'}`)
        }
    } else if (/^XCTSK:/i.test(json)) json = json.slice(6)
    else if (!json.startsWith('{')) fail('This is not an XCTrack or SeeYou task QR code.')
    try { return object(JSON.parse(json), 'task') }
    catch (error) { fail(error instanceof SyntaxError ? 'The QR code contains invalid task JSON.' : error.message) }
}

/** Reject unknown fields rather than importing a task with altered or ignored rules. */
function checkKeys(value, allowed, label) {
    object(value, label)
    if (Object.keys(value).some(key => !allowed.includes(key))) fail(`Unsupported ${label} fields or rules.`)
}

/** Only absent or empty extension arrays are understood by this importer. */
function checkExtensions(value) {
    if (value !== undefined && (!Array.isArray(value) || value.length > 0)) fail('Unsupported manufacturer extensions.')
}

/**
 * Map one XCTrack or SeeYou observation zone to the closest faithful XCSoar zone.
 * SeeYou's `na_o` stores a half-angle and optional inner radius; unsupported compound
 * geometries and misplaced lines fail instead of being simplified without notice.
 */
function zoneFor(point, index, last, goalType) {
    const radius = point.radius
    if (point.naviter === undefined) {
        return index === last && goalType === 'LINE'
            ? { type: 'Line', length: radius * 2 }
            : { type: 'Cylinder', radius }
    }
    const oz = object(point.naviter, 'SeeYou observation zone')
    if (Object.keys(oz).some(k => !['a1', 'a2', 'r2', 'l'].includes(k))) fail('This SeeYou sector has unsupported orientation or rules.')
    const a1 = number(oz.a1, 0.01, 180, 'sector half-angle')
    const a2 = number(oz.a2 ?? 0, 0, 180, 'secondary sector half-angle')
    const r2 = number(oz.r2 ?? 0, 0, 500000, 'secondary sector radius')
    if (typeof oz.l !== 'boolean') fail('Invalid SeeYou line flag.')
    if (oz.l) {
        if (index !== 0 && index !== last) fail('A line at an intermediate turnpoint is not supported by XCSoar.')
        if (r2 || a2) fail('A combined line and sector is not supported.')
        return { type: 'Line', length: radius * 2 }
    }
    if (r2 > 0 || a2 > 0) {
        if (r2 > 0 && r2 < radius && a2 === 180 && a1 < 180 && index > 0 && index < last) {
            return { type: 'CustomKeyhole', radius, inner_radius: r2, angle: a1 * 2 }
        }
        fail('This combined SeeYou sector cannot be represented faithfully in XCSoar.')
    }
    if (a1 === 180) return { type: 'Cylinder', radius }
    // FAISector in XCSoar has built-in radii. SymmetricQuadrant preserves the QR's exact radius.
    return { type: 'SymmetricQuadrant', radius, angle: a1 * 2 }
}

/**
 * Convert a supported QR payload (raw JSON, XCTSK, or compressed XCTSKZ) into a
 * normalized racing task. Coordinates become decimal degrees/metres; takeoff points
 * are removed, the speed-section start becomes XCSoar's start, and point roles are
 * assigned from position. `warnings` describe rules that cannot be represented and
 * must be acknowledged before saving; `details` retain source timing metadata.
 */
export function decodeTaskQr(payload) {
    const raw = unpack(payload)
    // SeeYou waypoint routes use T/V; XCTrack tasks use taskType/version fields.
    const waypointsOnly = raw.T === 'W' && raw.V === 2
    const version = waypointsOnly ? 2 : raw.version
    if (!waypointsOnly && raw.taskType !== 'CLASSIC') fail('Unsupported task type. Only XCTrack CLASSIC and waypoint routes are supported.')
    if (version !== 1 && version !== 2) fail('Unsupported task format version.')
    if ((version === 2 && (raw.e ?? 0) !== 0) || (version === 1 && (raw.earthModel ?? 'WGS84') !== 'WGS84')) fail('FAI sphere tasks cannot be imported with the same earth model in XCSoar.')
    // The accepted field lists are intentionally closed: unrecognized scoring rules must not disappear on import.
    checkExtensions(raw.x)
    checkExtensions(raw.extensions)
    if (Object.keys(raw).some(k => k.startsWith('na_'))) fail('This task contains unsupported manufacturer extensions or task rules.')
    const allowed = waypointsOnly ? ['T', 'V', 't', 'name'] : version === 2
        ? ['taskType', 'version', 't', 's', 'g', 'e', 'to', 'tc', 'x', 'name']
        : ['taskType', 'version', 'earthModel', 'turnpoints', 'takeoff', 'sss', 'goal', 'extensions', 'name']
    if (Object.keys(raw).some(key => !allowed.includes(key))) fail('This task contains unsupported task fields or rules.')
    const source = version === 2 ? raw.t : raw.turnpoints
    if (!Array.isArray(source) || source.length < 2 || source.length > 100) fail('A task must contain between 2 and 100 points.')
    const warnings = []
    if (waypointsOnly) warnings.push('This QR contains a waypoint route without sectors. Each point will use a 500 m cylinder in a racing task.')
    // Normalize the compact v2 `z` tuple or expanded v1 waypoint object to the same point shape.
    let points = source.map((item, index) => {
        object(item, 'turnpoint')
        checkExtensions(item.x)
        checkExtensions(item.extensions)
        checkKeys(item, version === 2 ? ['z', 'n', 'd', 't', 'x', 'na_o'] : ['type', 'radius', 'waypoint', 'extensions', 'na_o'], 'turnpoint')
        let lon, lat, altitude, radius, name, description, role
        if (version === 2) {
            const z = decodePolyline(item.z, waypointsOnly ? 3 : 4)
            ;[lon, lat, altitude, radius] = z
            lon /= 100000
            lat /= 100000
            radius ??= 500
            name = item.n
            description = item.d
            if (item.t !== undefined && ![1, 2, 3].includes(item.t)) fail('Invalid turnpoint role.')
            role = item.t === 2 ? 'SSS' : item.t === 3 ? 'ESS' : undefined
        } else {
            const wp = object(item.waypoint, 'waypoint')
            ;({ lon, lat, altSmoothed: altitude, name, description } = wp)
            radius = item.radius
            role = item.type
            if (role !== undefined && !['TAKEOFF', 'SSS', 'ESS'].includes(role)) fail('Invalid turnpoint role.')
            if (role === 'TAKEOFF' && index !== 0) fail('Takeoff must be the first point.')
        }
        return {
            name: text(name, 'waypoint name'), description: text(description, 'waypoint description'), role,
            lon: number(lon, -180, 180, 'longitude'), lat: number(lat, -90, 90, 'latitude'),
            altitude: number(altitude, -1000, 10000, 'altitude'), radius: number(radius, 0.01, 500000, 'radius'),
            naviter: item.na_o,
        }
    })
    for (const role of ['SSS', 'ESS']) if (points.filter(p => p.role === role).length > 1) fail(`Multiple ${role} points are not supported.`)
    const startIndex = points.findIndex(p => p.role === 'SSS')
    const essIndex = points.findIndex(p => p.role === 'ESS')
    if (essIndex >= 0 && startIndex >= essIndex) fail('The end of the speed section must follow the start.')
    // XCSoar's racing task starts at SSS; launch points and any preceding route points are not task points.
    if (startIndex > 0) {
        points = points.slice(startIndex)
        warnings.push('Takeoff and points before the speed-section start are omitted from the XCSoar racing task.')
    } else if (points[0].role === 'TAKEOFF') {
        points = points.slice(1)
        warnings.push('The takeoff point is omitted from the XCSoar racing task.')
    }
    if (points.length < 2) fail('The task needs a start and finish after removing takeoff points.')
    if (points.some((p, i) => p.role === 'ESS' && i !== points.length - 1)) warnings.push('The speed section ends before the goal. XCSoar will score this as a racing task to the final goal; separate ESS scoring is not imported.')
    const goal = (version === 2 ? raw.g : raw.goal) ?? {}
    checkKeys(goal, version === 2 ? ['t', 'd', 'fa'] : ['type', 'deadline', 'finishAltitude'], 'goal')
    const goalType = version === 2 ? ({ 1: 'LINE', 2: 'CYLINDER' }[goal.t ?? 2]) : (goal.type ?? 'CYLINDER')
    if (!['LINE', 'CYLINDER'].includes(goalType)) fail('Unsupported goal type.')
    const start = version === 2 ? raw.s : raw.sss
    const details = []
    // Keep times visible during review, but warn because they are metadata and not XCSoar task-file rules.
    if (start) {
        checkKeys(start, version === 2 ? ['g', 'd', 't', 'timeClose'] : ['type', 'direction', 'timeGates', 'timeClose'], 'start')
        const startType = version === 2 ? ({ 1: 'RACE', 2: 'ELAPSED-TIME' }[start.t]) : start.type
        if (!['RACE', 'ELAPSED-TIME'].includes(startType)) fail('Invalid start type.')
        details.push(`Start type: ${startType === 'RACE' ? 'Race' : 'Elapsed time'}`)
        const gates = version === 2 ? start.g : start.timeGates
        if (gates !== undefined && !Array.isArray(gates)) fail('Invalid start gates.')
        if (gates?.length) details.push(`Start gates (UTC): ${gates.map(validateTime).join(', ')}`)
        if (start.timeClose) details.push(`Start closes (UTC): ${validateTime(start.timeClose)}`)
        warnings.push('Start times, gates and race/elapsed-time rules are shown for reference but are not applied to the XCSoar task. Set these in XCSoar if needed.')
    }
    const deadline = version === 2 ? goal.d : goal.deadline
    if (deadline) {
        details.push(`Goal deadline (UTC): ${validateTime(deadline)}`)
        warnings.push('The goal deadline is not enforced by the imported XCSoar task.')
    }
    if (raw.takeoff !== undefined) checkKeys(raw.takeoff, ['timeOpen', 'timeClose'], 'takeoff')
    const takeoffOpen = version === 2 ? raw.to : raw.takeoff?.timeOpen
    const takeoffClose = version === 2 ? raw.tc : raw.takeoff?.timeClose
    if (takeoffOpen !== undefined) details.push(`Takeoff opens (UTC): ${validateTime(takeoffOpen)}`)
    if (takeoffClose !== undefined) details.push(`Takeoff closes (UTC): ${validateTime(takeoffClose)}`)
    if (takeoffOpen !== undefined || takeoffClose !== undefined) warnings.push('Takeoff time windows are not applied to the XCSoar task.')
    const finishAltitude = version === 2 ? goal.fa : goal.finishAltitude
    const attributes = { type: 'RT', fai_finish: '0' }
    if (finishAltitude !== undefined) {
        attributes.finish_min_height = number(finishAltitude, 0, 10000, 'minimum finish height')
        attributes.finish_min_height_ref = 'AGL'
        details.push(`Minimum finish height: ${finishAltitude} m AGL`)
    }
    // Assign XCSoar roles after trimming, so the first and last retained points are always start and finish.
    points = points.map((point, i) => ({
        ...point,
        name: point.name || (i === 0 ? 'Start' : i === points.length - 1 ? 'Finish' : `TP ${i}`),
        type: i === 0 ? 'Start' : i === points.length - 1 ? 'Finish' : 'Turn',
        zone: zoneFor(point, i, points.length - 1, goalType),
    }))
    return { name: text(raw.name, 'task name', 'Imported QR task'), attributes, points, details, warnings }
}

/** Accept the UTC HH:MM:SSZ form used for start gates, windows, and goal deadlines. */
function validateTime(value) {
    if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d:[0-5]\dZ$/.test(value)) fail('Invalid UTC task time.')
    return value
}

/** Serialize the normalized task as a UTF-8 XCSoar Task XML document. */
export function taskToXml(task) {
    const root = xmlbuilder.create('Task', { encoding: 'UTF-8' }).att(task.attributes)
    for (const point of task.points) {
        const node = root.ele('Point', { type: point.type })
        const waypoint = node.ele('Waypoint', { name: point.name, altitude: point.altitude })
        waypoint.ele('Location', { latitude: point.lat, longitude: point.lon })
        if (point.description) waypoint.ele('Comment').txt(point.description)
        node.ele('ObservationZone', point.zone)
    }
    return root.end({ pretty: true, indent: '\t' })
}

/** Format a normalized observation zone for the import review list. */
export function zoneLabel(zone) {
    if (zone.type === 'Line') return `Line · length ${zone.length} m`
    if (zone.type === 'Cylinder') return `Cylinder · radius ${zone.radius} m`
    if (zone.type === 'CustomKeyhole') return `Keyhole · ${zone.angle}° · radius ${zone.radius} m + ${zone.inner_radius} m cylinder`
    return `${zone.angle === 90 ? 'FAI sector (90°)' : `Sector (${zone.angle}°)`} · radius ${zone.radius} m`
}
