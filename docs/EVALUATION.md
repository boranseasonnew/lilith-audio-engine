# Reproducible evaluation

1. Obtain a short recording that you are authorized to process. Do not commit it. Use `LILITH_TEST_AUDIO=/absolute/path` with `npm run test:inference`; a browser driver must be locally installed (see script).
2. Build, serve Studio, record browser/version/OS/adapter/backend and model SHA-256. Track all requests: audio content must never leave the device.
3. Use the public SDK on a real File/Blob. Record model progress, completed windows and wall/inference times. Export both real WAVs and ZIP. Check finite stereo PCM, exact sample count, rate, clipping and original-sum reconstruction.
4. Listen to authorized clips with vocals plus music, solo voice, sparse accompaniment and transients across chunk boundaries. Record leakage/artifacts and blind A/B results. Use reference stems for SDR/SI-SDR only when properly licensed and sample-aligned.
5. Compare CPU and GPU output numerically; process multiple clips/files, cancellation during model load/inference, invalid codecs and offline/corrupt-cache errors.

Normal unit CI uses synthetic samples only for DSP/export/playback invariants. Synthetic/mock tests are not neural separation proof. No invented scores, peak RAM numbers or UVR Online parity claims. Peak browser process/GPU memory requires profiler measurement and is not represented by JavaScript heap size alone.
