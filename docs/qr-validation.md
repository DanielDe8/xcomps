# QR import validation

## Automated

`npm test` exercises the three actual SeeYou image fixtures, Unicode/Latin-1 names, unnamed points, v1/v2, compressed QR images, takeoff/SSS/ESS handling, line widths, sector radii/angles, keyholes, finish AGL constraints, XML escaping, malformed inputs, unsupported semantics, decompression limits, destination preferences and partial file-write failures.

`npm run cap_build` builds the production web bundle (including the decoder worker) and syncs Capacitor. `./gradlew assembleDebug` in `android/` verifies native compilation and packaging.

## Browser integration harness

Run `npm run dev`; visit `http://127.0.0.1:5173/tests/ui.html`.

- Import from camera: the simulated feed is captured automatically, displays the mixed-sector task and reports that the video track is released.
- Acknowledge the deadline note; save to both default destinations. Verify two writes and return to the competition-selection home screen.
- Select the test competition; import a fixture through the image picker. Enable failure of the second destination and save. Verify the preview remains, with a partial-success error. Deselect the failed folder and retry; verify return to the same competition and retained folder preference.
- Deny camera access; verify the error offers retry and file import. Cancel without writing.
- Import an image without a task QR; verify an error and retry, with no save control.
- Check the narrow layout: stacked import buttons without a competition, side by side with one selected; scrollable review and readable folder labels.

The harness uses the real UI, image decoder, worker and serializer with in-memory native-service substitutes. It is not a physical Android camera/storage test.

## Required device smoke test before release

No Android device was attached during implementation. Install the debug APK on a supported Android phone and verify:

1. Grant/deny/revoke Camera, then scan a printed or on-screen dense task QR in portrait and landscape. Try all three fixture images with the camera and system image picker.
2. Open photos via Photos and Downloads/document providers, including a rotated phone photo. Cancel the picker and reselect the same file after an error.
3. Cancel/use Android Back while opening and scanning; background/resume the app. Check that the camera indicator turns off and no duplicate preview/save occurs.
4. Grant XComps file access, choose actual XCSoar/fork folders, save, and inspect `xcomps_task.tsk`. Revoke storage access and verify errors keep the preview available.
5. Open the saved task in XCSoar; compare the start/finish, point coordinates, line width, sector radii/angles and altitude constraints against the preview and original task.
6. Repeat with and without a competition selected. Confirm existing competition task, waypoint and airspace downloads still work.

The implementation saves the task file for XCSoar to load. It does not automatically activate a running XCSoar task.
