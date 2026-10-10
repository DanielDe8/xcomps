<script>
    import { CapacitorHttp } from "@capacitor/core"
    import DownloadFolders from "../components/DownloadFolders.svelte"
    import { writeDownloadFile, downloadError } from "../lib/downloads.js"
	import { fetchCompAirspace, fetchCompWaypoints, fetchCompTasksSGSP, generateCompTask } from "../lib/fetch"
    import { compStore, viewStore, qrFileStore, importNoticeStore } from "../lib/stores.js"
    import { APP_VERSION, SOARINGSPOT_URL, taskFileName, waypointFileName, airspaceFileName } from "../lib/consts.js"

    // Home combines competition downloads with QR import entry points and shared folders.
    let taskDownloadSuccess = false
    let waypointDownloadSuccess = false
    let airspaceDownloadSuccess = false

	let selectedClass = ""

	$: comp = JSON.parse($compStore)

    let downloadFolders = []
    let qrFileInput

    /** Pass the selected photo to the QR review view without losing the File object. */
    function importFile(event) {
        const file = event.target.files?.[0]
        if (!file) return
        $qrFileStore = file
        $importNoticeStore = ""
        $viewStore = "qr-files"
        event.target.value = ""
    }

	/** Return the competition task matching the currently selected class, if any. */
	function taskByClass(tasks, taskClass) {
		if (!tasks || tasks.length === 0) return null

		return tasks.find(task => task.taskClass == taskClass)
	}

    /**
     * Fetch a URL or use pre-generated `altData`, write the result to each selected
     * folder, then update the supplied success flag. Partial failures remain visible.
     */
    async function downloadFile({ url, label, fileName, successFlagSetter, altDataFlag = false, altData = "" }) {
        if (downloadFolders.length === 0) {
            alert(`Please select at least one folder to download the ${label} file to.`)
            return
        }
        try {
            let data = altData
            if (!altDataFlag) {
                const result = await CapacitorHttp.get({ url })
                if (result.status !== 200) throw new Error(`Failed to fetch ${label} file: ${result.status}`)
                data = result.data
            }
            const result = await writeDownloadFile(data, fileName, downloadFolders)
            if (result.failed.length) { alert(downloadError(result)); return }
            successFlagSetter(true)
            setTimeout(() => successFlagSetter(false), 1500)
        } catch (error) { alert(error.message) }
    }

	/** Generate the selected competition task, then save it under XCSoar's task filename. */
	async function downloadTask(task) {
		if (!task) return
        await downloadFile({
            url: task.href,
            label: "task",
            fileName: taskFileName,
            successFlagSetter: (v) => taskDownloadSuccess = v,
            altDataFlag: true,
            altData: await generateCompTask(task.href)
        })
	}
	/** Fetch and save the selected competition waypoint file. */
    async function downloadWaypoints(waypointsUrl) {
        await downloadFile({
            url: SOARINGSPOT_URL + waypointsUrl,
            label: "waypoints",
            fileName: waypointFileName,
            successFlagSetter: (v) => waypointDownloadSuccess = v
        })
    }
	/** Fetch and save the selected competition airspace file. */
    async function downloadAirspace(airspaceUrl) {
        await downloadFile({
            url: SOARINGSPOT_URL + airspaceUrl,
            label: "airspace",
            fileName: airspaceFileName,
            successFlagSetter: (v) => airspaceDownloadSuccess = v
        })
    }

</script>

<div class="p-4 flex flex-col space-y-4">
	<button class="btn btn-accent btn-lg" on:click={ () => $viewStore = "comps" }>
        { comp.name ? "Competition: " + comp.name : "Click to select a competition" }
    </button>

    <div class="grid gap-3 {comp.name ? 'grid-cols-2' : 'grid-cols-1'}">
        <button class="btn btn-secondary h-auto min-h-16 py-3" on:click={() => { $importNoticeStore = ''; $viewStore = 'qr-camera' }}>
            Import task QR code from camera
        </button>
        <button class="btn btn-secondary h-auto min-h-16 py-3" on:click={() => qrFileInput.click()}>
            Import task QR code from files
        </button>
    </div>
    <input bind:this={qrFileInput} type="file" accept="image/*" class="hidden" aria-label="QR code image" on:change={importFile} />
    {#if $importNoticeStore}<p class="alert alert-success break-words" role="status">{$importNoticeStore}</p>{/if}

    <DownloadFolders bind:selected={downloadFolders} />

	<div class="w-full bg-base-200 card card-compact">
		<div class="card-body">
		    <h1 class="card-title">
                Task { selectedClass ? " for class: " : "" }
            </h1>

		    {#if comp.href}
    			{#await fetchCompTasksSGSP(comp.href)}
    				Fetching tasks...
    			{:then tasks}
    				{#if tasks && tasks.length > 0}
                        { (() => { if (tasks.length == 1) { selectedClass = tasks[0].taskClass } })() } <!-- auto select class when no other available -->

    					<div>
    						<div class="dropdown dropdown-start">
    							<button class="btn btn-secondary m-1" tabindex="0">
                                    { selectedClass || "Select class" }
                                </button>

    							<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    							<ul class="dropdown-content menu bg-base-content rounded-box z-1 w-52 p-2 shadow-sm" tabindex="0">
    								{#each tasks as task}
    									<li class="text-accent-content font-semibold"><button on:click={ () => { 
                                            selectedClass = task.taskClass

                                            document.activeElement.blur()
                                        } }>{ task.taskClass }</button></li>
    								{/each}
    							</ul>
    						</div>
    
    						{#if taskByClass(tasks, selectedClass)}
    							<span>{ taskByClass(tasks, selectedClass).taskNum }, { taskByClass(tasks, selectedClass).taskDate }</span>
    						{:else}
    							No class selected
    						{/if}
    					</div>
    
    					<!-- {#if taskByClass(tasks, selectedClass)}
    						<p>Task generated on { taskByClass(tasks, selectedClass).taskDate }</p>
    					{/if} -->
    
    					<div class="flex items-center">
    					    <button on:click={ () => downloadTask(taskByClass(tasks, selectedClass)) } class="btn btn-primary flex-1 { selectedClass ? "" : "btn-disabled" }">
                                { selectedClass ? "Download Task file" : "Select a class to download task" }
                            </button>
        				
                            {#if taskDownloadSuccess}
                                <span class="ml-2 text-success p-2 rounded-sm font-semibold text-lg">Success!</span>
                            {/if}
    					</div>
                    {:else}
    					No tasks available for this competition.
    				{/if}
    			{/await}
    		{:else}
    			Please select a competition to view tasks
    		{/if}
		</div>
	</div>

    <div class="flex items-center">
        {#if comp.href}
            {#await fetchCompWaypoints(comp.href)}
                <button class="btn btn-primary flex-1 btn-disabled">
                    Fetching Waypoints data...
                </button>
            {:then waypointsUrl}
                {#if waypointsUrl}
                     <button on:click={ () => downloadWaypoints(waypointsUrl) }  class="btn btn-primary flex-1">
                        Download competition Waypoints file
                    </button>
                {:else}
                    <button class="btn btn-primary flex-1 btn-disabled">
                        No Waypoints file available for this competition
                    </button>
                {/if}
            {/await}
        {:else}
            <button class="btn btn-primary flex-1 btn-disabled">
                Select a competition to download Waypoints file
            </button>
        {/if}
    
        {#if waypointDownloadSuccess}
            <span class="ml-2 text-success p-2 rounded-sm font-semibold text-lg">Success!</span>
        {/if}
    </div>

    <div class="flex items-center">
        {#if comp.href}
            {#await fetchCompAirspace(comp.href)}
                <button class="btn btn-primary flex-1 btn-disabled">
                    Fetching Airspace data...
                </button>
            {:then airspaceUrl}
                {#if airspaceUrl}
                    <button on:click={ () => downloadAirspace(airspaceUrl) }  class="btn btn-primary flex-1">
                        Download competition Airspace file
                    </button>
                {:else} 
                    <button class="btn btn-primary flex-1 btn-disabled">
                        No Airspace file available for this competition
                    </button>
                {/if}
            {/await}
        {:else}
            <button class="btn btn-primary flex-1 btn-disabled">
                Select a competition to download Airspace file
            </button>
        {/if}
    
        {#if airspaceDownloadSuccess}
            <span class="ml-2 text-success p-2 rounded-sm font-semibold text-lg">Success!</span>
        {/if}
    </div>

    <p class="text-xs">
        Waypoint and Airspace files are downloaded from <a href="https://soaringspot.com" class="link link-primary">SoaringSpot.com</a><br>
        Task files are generated using the <a href="https://api.glideandseek.com/v2/task" class="link link-primary">GlideAndSeek API</a>
        <br>
        <span class="italic">XComps version { APP_VERSION }</span>
    </p>
</div>
