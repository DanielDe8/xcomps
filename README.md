# XComps

XComps is a gliding competition manager for Android that can download **task**, **waypoint** and **airspace** files from ongoing competitions into **XCSoar** and its related forks.
It was inspired by Kedder's [**Compman**](https://github.com/kedder/openvario-compman) for the OpenVario.

It searches the `Android/media` folder for sub-folders containing "soar" in their name and lets you choose which ones to download to.
Then it places the downloaded files into the folders you selected.

The files for tasks, waypoints and airspaces are named `xcomps_task.tsk`, `xcomps_waypoints.cup` and `xcomps_airspace.txt`, respectively.<br>
The files are overwritten each time you download a new one.

You can download the `.apk` file from the **Releases** tab.

Tasks are downloaded from [SoarScore.com](https://soarscore.com).<br>
Waypoint and airspace files are downloaded from [SoaringSpot.com](https://soaringspot.com).<br>
[Corsproxy.io](https://corsproxy.io) is used as a CORS proxy to solve CORS issues - the app is built as a web app with [Svelte](https://svelte.dev), and web apps cannot fetch data from websites unless explicitly allowed.
