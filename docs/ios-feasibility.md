# iOS feasibility — separate follow-up

Assessed 9 October 2026. This change implements Android QR import; it does not add or ship an iOS target.

## Recommendation

An iOS port is feasible. The best candidate for the requested workflow is **one-time selection of XCSoar’s `XCSoarData` folder in the iOS document picker**, followed by direct writes from XComps using a saved security-scoped bookmark. After that setup, the same Save button could write `xcomps_task.tsk`, `xcomps_waypoints.cup`, and `xcomps_airspace.txt` without a manual Files-app copy on every import.

This is an implementation proposal based on Apple’s APIs and XCSoar’s source, not a verified device result. Validate folder selection and write permission with the actual installed XCSoar iOS build before promising this workflow. Zero-interaction access to another app’s private container is not available.

## What XCSoar currently exposes

XCSoar’s [Apple path provider](https://github.com/XCSoar/XCSoar/blob/master/src/Apple/PathProvider.cpp) returns `Documents/PRODUCT_DATA_DIR` on iOS. Its [local-path code](https://github.com/XCSoar/XCSoar/blob/master/src/LocalPath.cpp) resolves that within XCSoar’s own app home. For XCSoar, the data directory is `Documents/XCSoarData`; it is not an Android-style shared filesystem path.

XCSoar’s [iOS Info.plist](https://github.com/XCSoar/XCSoar/blob/master/Data/iOS/Info.plist.in.xml) enables both `UIFileSharingEnabled` and `LSSupportsOpeningDocumentsInPlace`. These are encouraging prerequisites for access through Files. The expected picker location is **On My iPhone/iPad → XCSoar → XCSoarData**, although app display names and visibility depend on the installed build. Launch XCSoar first so the directory exists.

The inspected plist does not declare `CFBundleDocumentTypes`, `UTImportedTypeDeclarations`, `CFBundleURLTypes`, or a share extension. Consequently, an “Open in XCSoar” share target or URL-based import/activation cannot be assumed to exist. Merely writing a task into the directory does not activate that task inside XCSoar. File selection/reload in XCSoar remains a separate concern, as on Android.

## Proposed XComps implementation

1. Add a Capacitor 7-compatible iOS target and its Xcode signing configuration. Reuse the Svelte screens, QR worker and task serializer. Add `NSCameraUsageDescription` and verify camera access in WKWebView; retain image import via the system picker.
2. Replace the Android/media selector on iOS with **Choose XCSoar folder**. A small Swift Capacitor plugin should present `UIDocumentPickerViewController(forOpeningContentTypes: [.folder])`, opening the selected folder in place.
3. Save the returned URL as bookmark data. On later saves, resolve it, detect stale bookmarks, and acquire/release its security scope. Do not persist a guessed sandbox path or another app’s container UUID.
4. Coordinate writes using `NSFileCoordinator`; create temporary sibling files and replace the three fixed filenames only after successful writes. Report success/failure per file. Keep folder selection available if permission is revoked, a bookmark becomes stale, or XCSoar is reinstalled.
5. Keep this native directory writer behind the shared download interface. Capacitor Filesystem’s ordinary `Directory.Documents` refers to **XComps’ own Documents directory**; it does not grant access to XCSoar or manage external security-scoped bookmarks.

Apple explicitly supports selecting external directories, accessing their contents, creating new items and retaining access with bookmarks. The user must grant the initial folder selection. See [Providing access to directories](https://developer.apple.com/documentation/uikit/providing-access-to-directories), [UIDocumentPickerViewController](https://developer.apple.com/documentation/uikit/uidocumentpickerviewcontroller), and [UIFileSharingEnabled](https://developer.apple.com/documentation/bundleresources/information-property-list/uifilesharingenabled).

## Fallbacks if direct folder selection is unavailable

| Approach | User effort | XCSoar changes required? |
| --- | --- | --- |
| Export the generated files from XComps using the iOS document export picker | Choose the XCSoar destination and confirm export; the picker can remember the last directory | Usually none, provided the folder is exposed and writable |
| Share the three generated file URLs using the native share sheet, then Save to Files | User chooses the destination; XComps cannot silently choose a share action | None for Save to Files; an XCSoar share target requires verified support |
| Add native document reception or a share extension to XCSoar | User chooses XCSoar in the share sheet; XCSoar can copy/import and activate the task itself | Yes: document types/UTIs plus incoming-file handling, overwrite behavior and task activation |

Do not advertise “Share → XCSoar” until its receiving implementation is present and tested. An App Group cannot simply be added by XComps to share an independently signed XCSoar container; it would require coordinated entitlements and distribution. A custom URL scheme alone cannot confer filesystem access.

## Device feasibility spike before implementing the port

- Select the real XCSoarData directory; write/read back all three filenames; restart XComps and repeat using the bookmark.
- Confirm overwrite behavior and that XCSoar can load the new `.tsk` and use the `.cup` and `.txt` files. Test while XCSoar is running and after reopening it.
- Revoke access, move/remove the folder, and reinstall XCSoar; ensure XComps requests reselection rather than claiming success.
- Verify task camera scanning, photo/file import, denied permissions, and background/resume on both iPhone and iPad.
- If the directory is not selectable/writable, test export and sharing from within XComps, then decide whether to propose an XCSoar receiving feature.
