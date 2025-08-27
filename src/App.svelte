<script>
    import CompsView from "./views/CompsView.svelte";
    import HomeView from "./views/HomeView.svelte";
    import { viewStore } from "./lib/stores";
</script>

<div class="min-h-screen pt-16">
    {#if $viewStore == "home"}
        <HomeView/>
    {:else if $viewStore == "comps"}
        <CompsView/>
    {/if}
</div>
