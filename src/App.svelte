<script>
    // Root view switcher and Android system-back integration for the app screens.
    import CompsView from "./views/CompsView.svelte";
    import HomeView from "./views/HomeView.svelte";
    import QrImportView from "./views/QrImportView.svelte";
    import { onMount } from "svelte";
    import { Capacitor } from "@capacitor/core";
    import { App } from "@capacitor/app";
    import { viewStore, qrSavingStore } from "./lib/stores";
    // Handle Android system-back globally: return to home, or exit from home itself.
    // While a task is being written, leave the screen in place until the save settles.
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

<!-- Keep screen switching in one place so import views are torn down when left. -->
<div class="min-h-screen pt-16">
    {#if $viewStore == "home"}
        <HomeView/>
    {:else if $viewStore == "comps"}
        <CompsView/>
    {:else if $viewStore === "qr-camera" || $viewStore === "qr-files"}
        <!-- The route chooses camera or file mode while both modes share one review screen. -->
        <QrImportView source={$viewStore === "qr-camera" ? "camera" : "files"} />
    {/if}
</div>
