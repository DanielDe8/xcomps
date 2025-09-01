<script>
    import { CapacitorHttp } from "@capacitor/core"
    import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
    import { Preferences } from '@capacitor/preferences'
	import { fetchCompTasks, fetchCompAirspace, fetchCompWaypoints } from "../lib/fetch"
    import { compStore, viewStore } from "../lib/stores.js"
    import { APP_VERSION, SOARINGSPOT_URL, taskFileName, waypointFileName, airspaceFileName } from "../lib/consts.js"

    let taskDownloadSuccess = false
    let waypointDownloadSuccess = false
    let airspaceDownloadSuccess = false

	let selectedClass = ""

	$: comp = JSON.parse($compStore)

    let downloadFolders = []

	function taskByClass(tasks, taskClass) {
		if (!tasks || tasks.length === 0) return null

		return tasks.find(task => task.taskClass == taskClass)
	}

	async function downloadTask(task) {
		if (!task) return
        if (downloadFolders.length === 0) {
            alert("Please select at least one folder to download the task to.")
            return
        }
        console.log("Downloading task:", task)
        console.log("To folders:", downloadFolders)

        const taskFileRes = await CapacitorHttp.get({ url: task.href }) 

        if (taskFileRes.status != 200) {
            console.log(taskFileRes)
            alert(`Failed to fetch task file: ${taskFileRes.status} (Try restarting the app)`)
        }

        for (const folder of downloadFolders) {
            const filePath = `Android/media/${folder.name}/${taskFileName}`

            try {
                const result = await Filesystem.writeFile({
                    path: filePath,
                    data: taskFileRes.data,
                    directory: Directory.ExternalStorage,
                    encoding: Encoding.UTF8
                })
    
                console.log(`Task file written to ${folder.name}:`, result)

                taskDownloadSuccess = true
                setTimeout(() => taskDownloadSuccess = false, 1500)
            } catch (e) {
                console.log(`Error writing task file to ${folder.name}:`, e)
                alert(`Unable to write task file to ${folder.name}: ` + e.message)
            }
        }
	}

    async function downloadWaypoints(waypointsUrl) {
        if (downloadFolders.length === 0) {
            alert("Please select at least one folder to download the Waypoints file to.")
            return
        }
        console.log("Downloading waypoints to folders:", downloadFolders)

        const waypointUrl = await fetchCompWaypoints(comp.href)

        if (!waypointUrl) {
            alert("No waypoint file available for this competition.")
            return
        }

        const waypointFileRes = await CapacitorHttp.get({ url: SOARINGSPOT_URL + waypointUrl })

        if (waypointFileRes.status != 200) {
            console.log(waypointFileRes)
            alert(`Failed to fetch Waypoints file: ${waypointFileRes.status} (Try restarting the app)`)
        }

        for (const folder of downloadFolders) {
            const filePath = `Android/media/${folder.name}/${waypointFileName}`

            try {
                const result = await Filesystem.writeFile({
                    path: filePath,
                    data: waypointFileRes.data,
                    directory: Directory.ExternalStorage,
                    encoding: Encoding.UTF8
                })
            
                console.log(`Waypoints file written to ${folder.name}:`, result)

                waypointDownloadSuccess = true
                setTimeout(() => waypointDownloadSuccess = false, 1500)
            } catch (e) {
                console.log(`Error writing waypoints file to ${folder.name}:`, e)
                alert(`Unable to write waypoints file to ${folder.name}: ` + e.message)
            } 
        }
    }

    async function downloadAirspace(airspaceUrl) {
        if (downloadFolders.length === 0) {
            alert("Please select at least one folder to download the Airspace file to.")
            return
        }
        console.log("Downloading airspace to folders:", downloadFolders)

        if (!airspaceUrl) {
            alert("No airspace file available for this competition.")
            return
        }

        const airspaceFileRes = await CapacitorHttp.get({ url: SOARINGSPOT_URL + airspaceUrl })

        if (airspaceFileRes.status != 200) {
            console.log(airspaceFileRes)
            alert(`Failed to fetch Waypoints file: ${airspaceFileRes.status} (Try restarting the app)`)
        }

        for (const folder of downloadFolders) {
            const filePath = `Android/media/${folder.name}/${airspaceFileName}`

            try {
                const result = await Filesystem.writeFile({
                    path: filePath,
                    data: airspaceFileRes.data,
                    directory: Directory.ExternalStorage,
                    encoding: Encoding.UTF8
                })
            
                console.log(`Airspace file written to ${folder.name}:`, result)

                airspaceDownloadSuccess = true
                setTimeout(() => airspaceDownloadSuccess = false, 1500)
            } catch (e) {
                console.log(`Error writing airspace file to ${folder.name}:`, e)
                alert(`Unable to write airspace file to ${folder.name}: ` + e.message)
            } 
        }
    }

    async function findSoarFolders() {
        try {
            const result = await Filesystem.readdir({
                path: "Android/media",
                directory: Directory.ExternalStorage
            })
            console.log("Read dir result:", result)

            var soarFolders = result.files.filter(info => info.name.includes('soar') && info.type == "directory")
                .map((info) => ({ name: info.name, preferred: false }))

            console.log("SOAR folders:", soarFolders)

            soarFolders = await checkPreferred(soarFolders)

            console.log("SOAR folders with preferred:", soarFolders)

            return soarFolders
        } catch (e) {
            alert('Unable to read SOAR folders: ' + e.message)
            console.log("Error reading SOAR folders:", e)
            return []
        }
    }

    async function checkPreferred(soarFolders) {
        // const preferredFoldersRaw = await Preferences.get({ key: "preferredFolders" })
        // const preferredFolders = JSON.parse(preferredFoldersRaw?.value || "[]")

        // console.log("Raw preferred folders from preferences:", preferredFoldersRaw)
        // console.log("preferred folders from preferences:", preferredFolders)

        // downloadFolders
        //     .push(...preferredFolders?.filter(f => soarFolders.some(sf => sf.name === f))?.map((name) => ({ name, preferred: true })) || [])

        // console.log("Download folders:", downloadFolders)

        // return soarFolders.map(folder => ({
        //     ...folder,
        //     preferred: preferredFolders?.includes(folder.name) || false
        // }))

        return await Promise.all(soarFolders.map(async (folder) => {
            const preferredRaw = await Preferences.get({ key: folder.name })
            var preferred = (preferredRaw?.value || "true") == "true" // true by default

            if (preferred) {
                downloadFolders.push(folder)
            }

            return {
                ...folder,
                preferred
            }
        }))
    }

    function handleToggle(e, soarFolder) {
        if (e.target.checked) {
            downloadFolders.push(soarFolder)

            // Preferences.set({ key: "preferredFolders", value: JSON.stringify(downloadFolders.map(f => f.name)) })
            Preferences.set({ key: soarFolder.name, value: "true" })
        } else {
            downloadFolders = downloadFolders.filter(f => f.name !== soarFolder.name)

            // Preferences.set({ key: "preferredFolders", value: JSON.stringify(downloadFolders.map(f => f.name)) })
            Preferences.set({ key: soarFolder.name, value: "false" })
        }
        console.log(downloadFolders)
    }
</script>

<div class="p-4 flex flex-col space-y-4">
	<button class="btn btn-accent btn-lg" on:click={ () => $viewStore = "comps" }>
        { comp.name ? "Competition: " + comp.name : "Click to select a competition" }
    </button>

    <div class="w-full bg-base-200 card card-compact">
        <div class="card-body">
            <div>Download to Android/media folders:</div>

            {#await findSoarFolders()}
                Finding folders...
            {:then soarFolders}
                {#each soarFolders as soarFolder}
                    <label class="label">
                        <input type="checkbox" class="toggle" checked={ soarFolder.preferred } on:change={ (e) => handleToggle(e, soarFolder) } />
                        { soarFolder.name }
                    </label>
                {/each}
            {/await}
        </div>
    </div>

	<div class="w-full bg-base-200 card card-compact">
		<div class="card-body">
		    <h1 class="card-title">
                Task { selectedClass ? " for class: " : "" }
            </h1>

		    {#if comp.href}
    			{#await fetchCompTasks(comp.href)}
    				Fetching tasks...
    			{:then tasks}
    				{#if tasks && tasks.length > 0}
    					<div>
    						<div class="dropdown dropdown-start">
    							<button class="btn btn-secondary m-1" tabindex="0">
                                    { selectedClass || "Select class" }
                                </button>

    							<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    							<ul class="dropdown-content menu bg-base-200 rounded-box z-1 w-52 p-2 shadow-sm" tabindex="0">
    								{#each tasks as task}
    									<li><button on:click={ () => { 
                                            selectedClass = task.taskClass

                                            document.activeElement.blur()
                                        } }>{ task.taskClass }</button></li>
    								{/each}
    							</ul>
    						</div>
    
    						{#if taskByClass(tasks, selectedClass)}
    							<span>Task { taskByClass(tasks, selectedClass).taskNum }, Day { taskByClass(tasks, selectedClass).taskDay }</span>
    						{:else}
    							No class selected
    						{/if}
    					</div>
    
    					{#if taskByClass(tasks, selectedClass)}
    						<p>Task generated on { taskByClass(tasks, selectedClass).taskDate }</p>
    					{/if}
    
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
        Waypoints and Airspace files are downloaded from <a href="https://soaringspot.com" class="link link-primary">SoaringSpot.com</a><br>
        Task files are downloaded from <a href="https://soarscore.com" class="link link-primary">SoarScore.com</a><br>
        <br>
        <span class="italic">XComps version { APP_VERSION }</span>
    </p>
</div>