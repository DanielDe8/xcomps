<script>
    import { onMount, onDestroy, tick } from 'svelte'
    import DownloadFolders from '../components/DownloadFolders.svelte'
    import { createQrReader, readQrFile } from '../lib/qr-scanner.js'
    import { decodeTaskQr, taskToXml, zoneLabel } from '../lib/task-qr.js'
    import { writeDownloadFile, downloadError } from '../lib/downloads.js'
    import { taskFileName } from '../lib/consts.js'
    import { viewStore, importNoticeStore, qrFileStore, qrSavingStore } from '../lib/stores.js'

    export let source = 'camera'
    let video, fileInput, reader, stream, timer, destroyed = false, generation = 0
    let task = null, error = '', busy = false, saving = false, cameraActive = false
    let downloadFolders = [], acknowledged = false

    function stopCamera() {
        generation++
        clearTimeout(timer)
        stream?.getTracks().forEach(track => track.stop())
        stream = null
        if (video) video.srcObject = null
        cameraActive = false
    }
    function accept(payload) {
        if (!payload) throw new Error('No QR code found. Choose a clear image containing the entire code, including its white border.')
        task = decodeTaskQr(payload)
        acknowledged = false
        error = ''
    }
    async function scanFrame(token) {
        if (destroyed || token !== generation || !cameraActive) return
        try {
            const payload = await reader.read(video, 1280)
            if (destroyed || token !== generation) return
            if (payload !== null) {
                stopCamera()
                accept(payload)
                return
            }
        } catch (e) {
            if (destroyed || token !== generation) return
            stopCamera(); error = e.message; return
        }
        timer = setTimeout(() => scanFrame(token), 250)
    }
    async function startCamera() {
        stopCamera()
        const token = generation
        error = ''
        busy = true
        try {
            if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera access is unavailable. Use the Android app or import a QR image from files.')
            const acquired = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } })
            if (destroyed || token !== generation) { acquired.getTracks().forEach(track => track.stop()); return }
            stream = acquired
            await tick()
            video.srcObject = stream
            await video.play()
            if (destroyed || token !== generation) return
            cameraActive = true
            scanFrame(token)
        } catch (e) {
            if (destroyed || token !== generation) return
            stopCamera()
            if (!destroyed) error = ['NotAllowedError', 'PermissionDeniedError'].includes(e.name)
                ? 'Camera permission was denied. Allow Camera for XComps in Settings, then try again, or import from files.'
                : e.message || 'Unable to open the camera. You can import a QR photo from files.'
        } finally { if (!destroyed) busy = false }
    }
    async function loadFile(file) {
        if (!file || busy) return
        stopCamera()
        reader?.destroy()
        reader = createQrReader()
        busy = true
        error = ''
        try {
            const payload = await readQrFile(file, reader)
            if (!destroyed) accept(payload)
        } catch (e) { if (!destroyed) error = e.message }
        finally { if (!destroyed) busy = false; if (fileInput) fileInput.value = '' }
    }
    function visibilityChanged() {
        if (document.hidden) stopCamera()
    }
    async function save() {
        if (saving || !task || (task.warnings.length && !acknowledged)) return
        saving = true
        error = ''
        try {
            const result = await writeDownloadFile(taskToXml(task), taskFileName, downloadFolders)
            if (result.failed.length) { error = downloadError(result); return }
            $importNoticeStore = `Saved ${taskFileName} to ${result.saved.join(', ')}. The task is ready to load in XCSoar.`
            $viewStore = 'home'
        } catch (e) { error = e.message }
        finally { saving = false }
    }
    $: $qrSavingStore = saving
    onMount(() => {
        reader = createQrReader()
        document.addEventListener('visibilitychange', visibilityChanged)
        if (source === 'camera') startCamera()
        else if ($qrFileStore) { const file = $qrFileStore; $qrFileStore = null; loadFile(file) }
    })
    onDestroy(() => { destroyed = true; $qrSavingStore = false; stopCamera(); reader?.destroy(); document.removeEventListener('visibilitychange', visibilityChanged) })
</script>

<div class="p-4 flex flex-col gap-4 max-w-3xl mx-auto">
    <div class="flex gap-3 items-center justify-between">
        <h1 class="text-xl font-bold">{task ? 'Confirm decoded task' : 'Import task QR code'}</h1>
        <button class="btn btn-ghost" disabled={saving} on:click={() => $viewStore = 'home'}>Cancel</button>
    </div>
    {#if error && !task}<p class="alert alert-error break-words" role="alert">{error}</p>{/if}
    {#if task}
        <div class="card bg-base-200"><div class="card-body p-4 gap-3">
            <h2 class="card-title">{task.name}</h2>
            <p>Racing task · {task.points.length} points · WGS84</p>
            <p>Check the point order, coordinates and sectors before saving.</p>
            <ol class="flex flex-col gap-3">
                {#each task.points as point, i}
                    <li class="border-t border-base-300 pt-3">
                        <p class="font-bold break-words">{i + 1}. {point.type === 'Turn' ? `TP ${i}` : point.type}: {point.name}</p>
                        {#if point.description}<p class="break-words">{point.description}</p>{/if}
                        <p class="font-mono text-sm">{point.lat.toFixed(5)}°, {point.lon.toFixed(5)}°</p>
                        <p>Elevation {point.altitude} m AMSL</p>
                        <p>{zoneLabel(point.zone)}</p>
                    </li>
                {/each}
            </ol>
            {#each task.details as detail}<p>{detail}</p>{/each}
        </div></div>
        {#if task.warnings.length}
            <div class="card bg-base-200"><div class="card-body p-4">
                <h2 class="font-bold">Import notes</h2>
                <ul class="list-disc pl-5">{#each task.warnings as warning}<li>{warning}</li>{/each}</ul>
                <label class="flex items-start gap-3 mt-2"><input type="checkbox" class="checkbox shrink-0" bind:checked={acknowledged} disabled={saving} />
                    <span>I have reviewed these notes and will check the task rules in XCSoar.</span></label>
            </div></div>
        {/if}
        <DownloadFolders bind:selected={downloadFolders} disabled={saving} />
        {#if error}<p class="alert alert-error break-words" role="alert">{error}</p>{/if}
        <p class="text-sm">This replaces {taskFileName} in the selected folders. Load that task file in XCSoar to activate it.</p>
        <button class="btn btn-primary" disabled={saving || !downloadFolders.length || (task.warnings.length > 0 && !acknowledged)} on:click={save}>
            {saving ? 'Saving...' : 'Save & Import to XCSoar'}
        </button>
    {:else}
        {#if source === 'camera'}
            <div class="rounded-box overflow-hidden bg-black">
                <video bind:this={video} class="w-full max-h-[55vh]" autoplay playsinline muted aria-label="Task QR camera preview"></video>
            </div>
            <p role="status">{busy ? 'Opening camera...' : cameraActive ? 'Point the camera at the whole task QR code. It will be captured automatically.' : 'Camera stopped.'}</p>
            {#if !cameraActive}<button class="btn btn-primary" disabled={busy} on:click={startCamera}>Start camera</button>{/if}
        {/if}
        <p>Select a QR code photo from Downloads, Photos or another available location.</p>
        <input bind:this={fileInput} type="file" accept="image/*" class="hidden" aria-label="QR code image" on:change={e => loadFile(e.target.files?.[0])} />
        <button class="btn btn-secondary" disabled={busy} on:click={() => fileInput.click()}>{busy && source === 'files' ? 'Decoding image...' : 'Choose QR code image'}</button>
    {/if}
</div>
