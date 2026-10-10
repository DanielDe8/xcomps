# Privacy Policy for XComps

XComps (“the App”), developed by [DanielDe8](https://github.com/danielde8), respects your privacy.  
This policy explains what data is handled and why.


## Data Handling
- The App does **not** collect, store, or share any personal data.  
- Data is never transmitted to the developer or third parties.  
- All operations on files happen locally on your device.  

QR camera frames and selected photos are decoded locally. They are not uploaded or retained by XComps. Only the generated task file is saved, after the user confirms the import.

## Permissions Used

| Permission                  | Why It’s Needed                                                                 |
|-----------------------------|---------------------------------------------------------------------------------|
| `MANAGE_EXTERNAL_STORAGE`   | Allows full access to external storage so the App can open, edit, and manage user files. This is required for the App’s core functionality. It is only used on `Android/media` to search for XCSoar (and it's forks) folders and download competition task, waypoint and airspace files to them. |
| `READ_EXTERNAL_STORAGE`     | Lets the App read user-selected files on older Android versions for compatibility. |
| `WRITE_EXTERNAL_STORAGE`    | Lets the App save or modify files on older Android versions for compatibility.   |
| `CAMERA`                    | Used only when the user opens the task QR scanner. Frames are processed locally and the camera stops after capture, cancellation or backgrounding. |
| `INTERNET`                  | Allows the App to connect to the internet when fetching competitions and competition task, waypoint and airspace files. |

## Your Rights
You may revoke permissions anytime in your device settings.

## Contact
Questions? Please open an issue on [GitHub](https://github.com/danielde8/xcomps).