# Verified development session — 2026-10-13

## COMPLETE / measured

- Clean `npm ci --ignore-scripts` succeeds on Node24.19.0/npm11.17.0.
- Strict core + Studio TypeScript compilation, project lint checks and production build succeed.
- Core unit suite:26/26 passes. Synthetic/mock tests are labeled, not neural proof.
- Chromium through available Playwright MCP: actual public SDK and Studio process an authorized8s stereo recording with the pinned UVR ONNX model and SHA-256 verification.
- SDK WASM:86.2741s inference,3/3 completed windows;352800 samples/channel,44.1kHz,8s,finite output,peak0.99999994,common gain0.8769814. Genuine vocal WAV1,411,244B and separate-stem ZIP2,822,762B (filenames affect ZIP size).
- Browser-case suite (`scripts/browser-case.mjs`) executed through Playwright MCP:PASS. Studio WebGPU11.2–11.3s for8s, real waveforms, Play Both clock advances, pause/seek2s/mute, actual WAV and ZIP browser downloads,390px viewport without overflow. Switching actions and reopening the same result produces no new inference request. Recorded requests were GET only; public model is lazy and subsequent runs use its verified cache.
- First new SDK Studio WebGPU run11.9s for8s. These are single-machine observations, not promised performance.
- Cancellation rejects and terminates the worker. Malformed WAV rejects with a decode error; no audio upload.
- SDK outside Studio:22.05kHz WAV resampled and genuinely processed; output44.1kHz,44100 frames,1s;WebGPU4.7062s.
- ZenithW preview with actual Pages middleware:8s WebGPU11.7s, two actual waveforms, exact title/future note; model redirect CORS and scoped worker CSP succeed. Host integration/cache/language/media suite20/20 passes, including5 new integration checks.
- Full ORT MIT/third-party notices and PFFFT license downloaded successfully after the initial automatic-review outage resolved, then packaged with the runtime.
- npm name check returns404 for `@lilith/audio-engine`. This does NOT reserve a scope/name or prove publishing rights.

## BLOCKED / not counted as passed

Separate Node Playwright CLI driver attempted installed Chrome and Firefox executables. Both failed before startup with `browserType.launch: spawn UNKNOWN`. The browser-case suite ran successfully through Playwright MCP. The CLI launch failure remains reproducible, not hidden. No Firefox neural inference test succeeded.

## UNVERIFIED

Real Android hardware, Safari, Firefox runtime behavior, peak browser/GPU RAM, five-minute files, blind listening, ground-truth separation scores, perceived leakage/boundary artifacts and UVR Online parity. Narrow viewport emulation is not Android hardware testing. Signal validity and files do not establish quality for every recording.

## NOT STARTED / unavailable

Additional RoFormer/Demucs adapters, MP3/FLAC/M4A encoders, npm publishing and Studio deployment. No Android/Windows application changes. GitHub push is now owner-authorized; repository visibility is unchanged.

## Four-minute revision and premium progressive Studio

- Actual UVR ONNX inference through the public SDK, WebGPU: an authorized 8s stereo recording repeated into a 240s test fixture (not redistributed). This is a duration/resource regression, not a diverse four-minute quality benchmark.
- Input:42,336,044B WAV. Completed55/55 model windows. Neural inference192.5979s; total decode/inference/output/export validation201.1113s on this Windows Chromium environment.
- Both stems:240s,10,584,000 samples per channel,44.1kHz; all samples finite,peak0.99999994,common gain0.87691474. Vocal WAV42,336,044B; two-stem ZIP84,672,366B.
- New allocation path avoids full padded mixture copies and final overlap-add output copies; reconstruction can reuse prediction buffers. Peak RAM remains unmeasured.
- Updated SDK/Studio and ZenithW middleware preview both passed actual8s WebGPU11.4s inference, two real waveforms, synchronized playback, pause, seek, mute, WAV/ZIP downloads. No audio POST; no model request before user action.
- First-load options hidden; file selection reveals action cards. All eight ZenithW language variants tested at390px, no horizontal overflow. Reduced-motion preference disables panel animation. Reopening existing results after an action change starts zero new workers.
- Typecheck, production build, project lint and26 unit tests passed. Website integration/cache/language/media suite20/20 passed. Four-minute default boundary and reused-buffer behavior have explicit unit tests (mock decoder test is not neural evidence).
- Firefox CLI launch remains blocked by Windows spawn UNKNOWN. No four-minute WASM timing, physical Android memory test, Safari inference or perceptual quality verdict is claimed.
