<script>
	import { fetchComps } from "../lib/fetch.js"
	import { viewStore, compStore } from "../lib/stores"
	import { onMount } from "svelte"

	let compsPromise = null

	onMount(() => {
		compsPromise = fetchComps()
	})

	function setComp(comp) {
		$compStore = JSON.stringify(comp)
		$viewStore = "home"
	}
</script>

<div class="pb-24 max-w-md flex flex-col space-y-2 px-4 pt-2">
	<!-- <h1 class="text-4xl px-2 sticky top-2">Select competition</h1> -->
	{#await compsPromise}
		Fetching competitions...
	{:then comps}
		{#each comps as comp}
			<button on:click={ () => setComp(comp) } class="w-full p-4 bg-base-200 card text-left cursor-pointer">
				<h2>{ comp.name }</h2>
			</button>
		{/each}
	{:catch error}
		Error: {error.message} (Try restarting the app)
	{/await}
</div>

<div class="fixed bottom-0 left-0 w-full p-4 bg-base-200">
	<button class="btn btn-primary w-full p-2" on:click={ () => $viewStore = "home" }>Back</button>
</div>