# Race viewer 0.98.3 (incremental recorded checkpoints)

This separate installable `@pelotonia/race-viewer` package extends the
0.98.2 candidate. Rebuild from the `source/` directory of
`Pelotonia_Viewer_Integration_Kit_0.98.1.zip`, apply the 0.98.2 patch and
then `pelotonia-race-viewer-0.98.3.patch`. The application imports the
package; it does not embed the demo app.

`ViewerController.appendRecordedFrames` and the React imperative handle
accept strictly later checkpoint frames for a `streaming:true` feed. They
validate the resulting feed and preserve the existing Three.js scene and
local camera. The empty duration frame is a contract sentinel, not a
position or an invented result. A new package test covers append ordering
and rejection of invalid or non-streaming calls. The full source package
suite passed 286/286, and its library/data builds passed.

Tarball SHA-256:
`E42F32FD606F07DF4CA169F9953A2718C0727EAD33A4C7B7DCBF1841BDEEC42F`.
The spectator route and its database migration remain opt-in and separate
from guided or official races.
