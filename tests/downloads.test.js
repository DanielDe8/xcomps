import test from 'node:test'
import assert from 'node:assert/strict'
import { findSoarFolders, writeDownloadFile, downloadError } from '../src/lib/downloads.js'

// Use small injected plugin fakes to verify folder filtering, preference defaults,
// UTF-8 paths, and partial failures without requiring Android storage access.
test('folder discovery preserves opt-out preferences and filters non-folders', async () => {
    const fs = { readdir: async () => ({ files: [{ name: 'org.xcsoar', type: 'directory' }, { name: 'XCSoar-test', type: 'directory' }, { name: 'photos', type: 'directory' }, { name: 'soar.txt', type: 'file' }] }) }
    const prefs = { get: async ({ key }) => ({ value: key === 'org.xcsoar' ? 'false' : null }) }
    assert.deepEqual(await findSoarFolders(fs, prefs), [{ name: 'org.xcsoar', preferred: false }, { name: 'XCSoar-test', preferred: true }])
})
test('writes exact UTF-8 task to every selected destination', async () => {
    const calls = []
    const result = await writeDownloadFile('<Task>Žatec</Task>', 'xcomps_task.tsk', [{ name: 'org.xcsoar' }, { name: 'org.xcsoar.testing' }], { writeFile: async call => calls.push(call) })
    assert.deepEqual(result, { saved: ['org.xcsoar', 'org.xcsoar.testing'], failed: [] })
    assert.equal(calls[0].path, 'Android/media/org.xcsoar/xcomps_task.tsk')
    assert.equal(calls[1].path, 'Android/media/org.xcsoar.testing/xcomps_task.tsk')
    assert.equal(calls[0].data, '<Task>Žatec</Task>')
    assert.equal(calls[0].encoding, 'utf8')
    assert.equal(calls[0].directory, 'EXTERNAL_STORAGE')
})
test('reports partial failure without claiming every destination succeeded', async () => {
    const result = await writeDownloadFile('<Task/>', 'xcomps_task.tsk', [{ name: 'org.xcsoar' }, { name: 'org.soar.fail' }], { writeFile: async ({ path }) => { if (path.includes('.fail')) throw new Error('permission denied') } })
    assert.deepEqual(result.saved, ['org.xcsoar'])
    assert.equal(result.failed.length, 1)
    assert.match(downloadError(result), /Saved to org.xcsoar.*Unable to save to org.soar.fail: permission denied/)
})
test('requires a selected folder and propagates discovery failure', async () => {
    await assert.rejects(writeDownloadFile('', 'xcomps_task.tsk', []), /select/)
    await assert.rejects(findSoarFolders({ readdir: async () => { throw new Error('permission denied') } }), /permission denied/)
})
