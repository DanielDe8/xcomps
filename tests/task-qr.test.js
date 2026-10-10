import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { deflateSync } from 'node:zlib'
import { load } from 'cheerio'
import { PNG } from 'pngjs'
import QRCode from 'qrcode'
import { decodeTaskQr, taskToXml, decodePolyline } from '../src/lib/task-qr.js'
import { decodeQrPixels } from '../src/lib/qr-image.js'

// Parser/serializer tests include real SeeYou QR bitmaps plus constructed XCTrack tasks.
// The PNG cases verify the scanner's pixel-to-text boundary; remaining cases pin the
// normalization rules and ensure unsupported semantics are rejected instead of lost.
/** Load a checked-in QR payload as UTF-8 text, stripping only its fixture newline. */
const fixture = name => fs.readFileSync(new URL(`./fixtures/${name}.txt`, import.meta.url), 'utf8').trim()
/** Return the compressed-format SeeYou fixture as a mutable object for focused edits. */
const sample = () => JSON.parse(fixture('seeyou-fai').slice(6))
/** A small XCTrack v1 task covering takeoff, SSS/ESS, and finish options. */
const v1 = () => ({ taskType: 'CLASSIC', version: 1, turnpoints: [
    { type: 'TAKEOFF', radius: 400, waypoint: { name: 'Launch', lat: 49, lon: 14, altSmoothed: 500 } },
    { type: 'SSS', radius: 1000, waypoint: { name: 'Start & "Gate"', lat: 49.2, lon: -14.1, altSmoothed: -20 } },
    { type: 'ESS', radius: 700, waypoint: { name: 'Goal', lat: 49.4, lon: -14.2, altSmoothed: 250 } },
], goal: { type: 'LINE', finishAltitude: 100 }, sss: { type: 'RACE', timeGates: ['12:00:00Z'] } })

for (const name of ['seeyou-fai', 'seeyou-large', 'seeyou-mixed']) {
    test(`decodes actual SeeYou QR pixels and task: ${name}`, () => {
        const png = PNG.sync.read(fs.readFileSync(new URL(`./fixtures/${name}.png`, import.meta.url)))
        const payload = decodeQrPixels(new Uint8ClampedArray(png.data), png.width, png.height)
        assert.equal(payload, fixture(name))
        const task = decodeTaskQr(payload)
        assert.equal(task.points.length, 4)
        assert.deepEqual(task.points.map(p => p.type), ['Start', 'Turn', 'Turn', 'Finish'])
        const $ = load(taskToXml(task), { xmlMode: true })
        assert.equal($('Task').attr('type'), 'RT')
        assert.equal($('Point').length, 4)
        assert.equal(Number($('Point').eq(1).find('ObservationZone').attr('radius')), 3000)
        assert.equal(Number($('Point').eq(1).find('ObservationZone').attr('angle')), 90)
        assert.match(task.warnings.join(' '), /deadline/)
    })
}
test('keeps SeeYou exact radii, line width and Latin-1 waypoint names', () => {
    const task = decodeTaskQr(fixture('seeyou-mixed'))
    assert.deepEqual(task.points[0].zone, { type: 'Line', length: 2000 })
    assert.deepEqual(task.points[3].zone, { type: 'Cylinder', radius: 1000 })
    assert.equal(task.points[1].name, 'Velký Zvon')
    assert.equal(task.points[1].lat, 49.55022)
    assert.equal(task.points[1].lon, 12.63671)
    assert.equal(task.points[1].altitude, 857)
    assert.equal(decodeTaskQr(fixture('seeyou-large')).points[1].name, 'TP 1')
})
test('v1 removes takeoff, preserves signs, line goal and AGL finish constraint; escapes XML', () => {
    const task = decodeTaskQr('XCTSK:' + JSON.stringify(v1()))
    assert.equal(task.points.length, 2)
    assert.equal(task.points[0].lon, -14.1)
    const $ = load(taskToXml(task), { xmlMode: true })
    assert.equal($('Waypoint').first().attr('name'), 'Start & "Gate"')
    assert.equal($('ObservationZone').last().attr('length'), '1400')
    assert.equal($('Task').attr('finish_min_height'), '100')
    assert.equal($('Task').attr('finish_min_height_ref'), 'AGL')
    assert.ok(task.details.includes('Start gates (UTC): 12:00:00Z'))
    assert.match(task.warnings.join(' '), /not applied/)
})
test('accepts compressed XCTSKZ, case-insensitive prefixes and raw JSON', () => {
    const json = JSON.stringify(v1())
    const compressed = deflateSync(json).toString('base64')
    assert.deepEqual(decodeTaskQr(`xctskz:${compressed}`), decodeTaskQr(json))
    assert.deepEqual(decodeTaskQr(`xctsk:${json}`), decodeTaskQr(json))
})
test('decodes compressed QR images and UTF-8 names', async () => {
    const raw = v1(); raw.turnpoints[1].waypoint.name = 'Žatec 日本'
    for (const payload of ['XCTSK:' + JSON.stringify(raw), 'XCTSKZ:' + deflateSync(JSON.stringify(raw)).toString('base64')]) {
        const png = PNG.sync.read(await QRCode.toBuffer(payload, { width: 1000, margin: 4 }))
        assert.equal(decodeQrPixels(new Uint8ClampedArray(png.data), png.width, png.height), payload)
    }
})
test('blank images return no result', () => {
    assert.equal(decodeQrPixels(new Uint8ClampedArray(400 * 400 * 4).fill(255), 400, 400), null)
})
test('polyline order, negative values and strict termination', () => {
    assert.deepEqual(decodePolyline('g||rAoosrHiOozD'), [1375188, 5040392, 261, 3000])
    assert.throws(() => decodePolyline('~~~~~~~'), /coordinates/)
    assert.throws(() => decodePolyline('g||rAoosrHiOozD?'), /number/)
    assert.throws(() => decodePolyline('\u0000???'), /coordinates/)
})
test('custom keyholes preserve the inner cylinder and full sector angle', () => {
    const raw = sample(); raw.t[1].na_o = { a1: 45, a2: 180, r2: 500, l: false }
    const task = decodeTaskQr(JSON.stringify(raw))
    assert.deepEqual(task.points[1].zone, { type: 'CustomKeyhole', radius: 3000, inner_radius: 500, angle: 90 })
})
test('waypoint-only routes disclose their default sectors', () => {
    const raw = { T: 'W', V: 2, t: [{ n: 'A', z: 'g||rAoosrHiO' }, { n: 'B', z: '_u|vAom_sH_N' }] }
    const task = decodeTaskQr(JSON.stringify(raw))
    assert.deepEqual(task.points[0].zone, { type: 'Cylinder', radius: 500 })
    assert.match(task.warnings[0], /500 m/)
})
test('speed-section start truncates preceding points, including compact takeoff', () => {
    const raw = sample(); raw.t[1].t = 2; raw.t[2].t = 3
    const task = decodeTaskQr(JSON.stringify(raw))
    assert.equal(task.points[0].name, 'Steti')
    assert.match(task.warnings.join(' '), /separate ESS scoring/)
})
for (const [label, mutate] of [
    ['future version', r => r.version = 3],
    ['unknown task type', r => r.taskType = 'AAT'],
    ['earth model', r => r.e = 1],
    ['unsupported extension', r => r.x = [{ id: 'unknown' }]],
    ['malformed extension', r => r.x = { geometry: 'unknown' }],
    ['null observation zone', r => r.t[1].na_o = null],
    ['unknown goal rules', r => r.g.speed = 100],
    ['unknown point geometry', r => r.t[1].sector = 'unknown'],
    ['unknown SeeYou task rules', r => r.na_t = { duration: 7200 }],
    ['fixed sector orientation', r => r.t[1].na_o.a12 = 80],
    ['unsupported compound sector', r => r.t[1].na_o.r2 = 500],
    ['invalid radius', r => r.t[0].z = 'g||rAoosrHiO?'],
    ['too few points', r => r.t = r.t.slice(0, 1)],
    ['too many points', r => r.t = Array(101).fill(r.t[0])],
    ['invalid goal time', r => r.g.d = '25:00:00Z'],
    ['invalid start gates', r => r.s = { g: 'noon' }],
    ['invalid role order', r => { r.t[2].t = 2; r.t[1].t = 3 }],
    ['duplicate start', r => { r.t[0].t = 2; r.t[1].t = 2 }],
    ['line at a turnpoint', r => r.t[1].na_o.l = true],
]) test(`rejects ${label} instead of changing task semantics`, () => {
    const raw = sample(); mutate(raw)
    assert.throws(() => decodeTaskQr(JSON.stringify(raw)))
})
test('rejects invalid coordinates, text, unrelated links and corrupt compression', () => {
    for (const payload of ['XCTSK:{', 'XCTSKZ:!!!', 'XCTSKZ:AAAA', 'https://seeyou.cloud/xcplanner?vi=example', 'hello']) assert.throws(() => decodeTaskQr(payload))
    const raw = v1(); raw.turnpoints[1].waypoint.lat = 100
    assert.throws(() => decodeTaskQr(JSON.stringify(raw)), /latitude/)
    raw.turnpoints[1].waypoint.lat = 49; raw.turnpoints[1].waypoint.name = '\u0000'
    assert.throws(() => decodeTaskQr(JSON.stringify(raw)), /name/)
})
test('bounds both plain and decompressed payload size', () => {
    assert.throws(() => decodeTaskQr('XCTSK:' + ' '.repeat(300000)), /large/)
    const bomb = deflateSync(' '.repeat(1024 * 1024)).toString('base64')
    assert.throws(() => decodeTaskQr('XCTSKZ:' + bomb), /large/)
})
