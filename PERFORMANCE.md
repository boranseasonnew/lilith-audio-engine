# Performance and compatibility

## Previous feasibility probe (not the public Lilith SDK)

Windows 11, Chrome for Testing 155, ONNX Runtime Web 1.30.0, UVR-MDX-NET-Voc_FT. An authorized public test fixture (Le Tigre, Fake French, WIRED CD; upstream fixture README identifies CC licensing) was clipped to 8 seconds (10–18s). Fixture is not redistributed here; its exact CC conditions require independent review before inclusion.

- Correct asyncify WASM CPU inference: **54.1843 seconds** / 8s audio, 2 completed windows.
- Correct WebGPU inference: **8.6022 seconds** / 8s audio, 2 completed windows.
- Actual public model download, SHA-256 verification, cache reuse and external redirect CORS succeeded.
- Each PCM16 stereo WAV: 1,411,244 bytes, 44.1kHz, 8s.
- Initial signal check: vocal RMS 0.1001843, instrumental RMS 0.1726967, correlation 0.0546893; reconstructed PCM16 sum max error 3.05e-5 after common gain. These prove valid differing outputs, NOT vocal quality or ground-truth SDR.

The new SDK adds final-tail coverage to the chunk plan. New SDK measurements belong in `docs/TEST_RESULTS.md` after execution. Do not present the old probe as SDK verification.

## Limits and deployment

Default input ceiling 96 MiB compressed / 240s decoded; stereo44.1kHz float PCM alone ~84.7MB for240s, but runtime heaps, activations, FFT tensors, reconstruction, transferred output and playback buffers add much more. Actual peak process/GPU memory is **UNMEASURED**. Do not infer RAM needs from model size alone.

Model:66.8MB. ORT asyncify runtime:26,781,914B, split into ≤20MiB assets to respect Cloudflare Pages25MiB limit. Parts reassemble once in the worker using ORT's wasmBinary setting. Single WASM thread, no shared-memory/COOP/COEP requirement. The worker needs `script-src 'self' 'wasm-unsafe-eval'` and model download hosts; no sitewide unsafe-eval is needed.

WebGPU requires a compatible adapter and supported graph operators; available API alone is not proof of successful neural inference. WASM SIMD CPU fallback can be slow. Real Android, Safari and Firefox inference are UNVERIFIED. An earlier local Firefox launch failed at the operating-system process launch (spawn UNKNOWN / side-by-side); it did not establish model incompatibility. Chromium viewport/touch emulation is not a hardware/mobile Firefox test.

No realtime promise. No listening quality verdict or comparison with UVR Online is made. GPU may execute unsupported operators on CPU when ORT assigns mixed providers; a successful GPU session is not a promise of 100% GPU operators.

The four-minute revision avoids padded full-input copies, normalizes overlap-add in place, and reuses vocal prediction buffers during reconstruction. The original mix, four output channels, activation tensors and playback/export buffers still require substantial memory. Job timeout is 60 minutes; this is a cancellation ceiling, not an expected processing time.
