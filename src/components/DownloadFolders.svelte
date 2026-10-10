<script>
    import { onMount } from 'svelte'
    import { Capacitor } from '@capacitor/core'
    import { Preferences } from '@capacitor/preferences'
    import { findSoarFolders } from '../lib/downloads.js'

    // Reusable destination picker; `selected` is bound by whichever view writes a file.
    export let selected = []
    // Prevent preference changes while a containing screen is saving an import.
    export let disabled = false
    let folders = [], loading = true, error = ''

    /** Reload Android/media destinations and restore each folder's saved preference. */
    async function refresh() {
        loading = true
        error = ''
        selected = []
        try {
            if (Capacitor.getPlatform() !== 'android') throw new Error('Android/media destinations are available in the Android app.')
            folders = await findSoarFolders()
            selected = folders.filter(f => f.preferred)
        } catch (e) { error = `Unable to read SOAR folders: ${e.message}` }
        finally { loading = false }
    }
    /** Update the caller's selection immediately and persist this folder's choice. */
    async function toggle(folder, checked) {
        selected = checked ? [...selected.filter(f => f.name !== folder.name), folder] : selected.filter(f => f.name !== folder.name)
        try { await Preferences.set({ key: folder.name, value: String(checked) }) }
        catch { error = 'The folder selection could not be remembered for next time.' }
    }
    // Discover destinations as soon as this picker is mounted.
    onMount(() => { refresh() })
</script>

<div class="w-full bg-base-200 card card-compact">
    <div class="card-body">
        <div>Download to Android/media folders:</div>
        {#if loading}
            <p role="status">Finding folders...</p>
        {:else}
            {#each folders as folder}
                <label class="label gap-3 cursor-pointer">
                    <input type="checkbox" class="toggle shrink-0" checked={selected.some(f => f.name === folder.name)}
                        {disabled} on:change={e => toggle(folder, e.target.checked)} />
                    <span class="break-all">{folder.name}</span>
                </label>
            {/each}
            {#if error}<p class="text-error" role="alert">{error}</p>
            {:else if !folders.length}<p>No XCSoar folders found. Open XCSoar once and allow XComps file access, then refresh.</p>{/if}
            <button class="btn btn-sm self-start" disabled={disabled || loading} on:click={refresh}>Refresh folders</button>
        {/if}
    </div>
</div>
