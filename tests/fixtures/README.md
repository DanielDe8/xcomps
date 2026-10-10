# QR fixtures

These PNGs reconstruct the black/white modules of the **Share → Mobile** QR shown by SeeYou Cloud on 2026-10-09 for the three public examples supplied in the feature request:

- `seeyou-fai`: https://seeyou.cloud/xcplanner?ci=public-task&vn=taskpoints&vi=cmsejw5l1000h356s1uqms4r4
- `seeyou-large`: https://seeyou.cloud/xcplanner?ci=public-task&vn=taskpoints&vi=cmsejrzbe000b356slreiv7d5
- `seeyou-mixed`: https://seeyou.cloud/xcplanner?ci=public-task&vn=taskpoints&vi=cmsejylwg000n356sf6trdgdz

The text fixtures are the decoded payloads, saved as UTF-8. The mixed QR's original byte segment contains ISO-8859-1 `ý` (0xfd), without ECI; retain the PNG to test this interoperability case. The large task contains unnamed intermediate points. The mixed task encodes a 1000 m **radius** for its start line (2000 m total width), two 3000 m, 90° sectors, and a 1000 m finish cylinder.

No content was obtained from the Gmail attachment links. Source pages were read in the browser; no SeeYou implementation code is included.
