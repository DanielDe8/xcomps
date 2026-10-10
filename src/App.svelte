<script>
    import CompsView from "./views/CompsView.svelte";
    import HomeView from "./views/HomeView.svelte";
    import QrImportView from "./views/QrImportView.svelte";
    import { onMount } from "svelte";
    import { Capacitor } from "@capacitor/core";
    import { App } from "@capacitor/app";
    import { viewStore, qrSavingStore } from "./lib/stores";
    onMount(() => {
        if (!Capacitor.isNativePlatform()) return;
        const listener = App.addListener('backButton', () => {
            if ($qrSavingStore) return;
            if ($viewStore !== 'home') $viewStore = 'home';
            else App.exitApp();
        });
        return () => { listener.then(handle => handle.remove()); };
    });
</script>

<div class="min-h-screen pt-16">
    {#if $viewStore == "home"}
        <HomeView/>
    {:else if $viewStore == "comps"}
        <CompsView/>
    {:else if $viewStore === "qr-camera" || $viewStore === "qr-files"}
        <QrImportView source={$viewStore === "qr-camera" ? "camera" : "files"} />
    {/if}
</div>
