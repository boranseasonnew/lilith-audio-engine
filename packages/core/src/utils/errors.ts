export type ErrorCode = 'ABORTED'|'BUSY'|'DISPOSED'|'LIMIT'|'DECODE'|'MODEL'|'INTEGRITY'|'RUNTIME'|'OUTPUT'|'WORKER'|'UNSUPPORTED';
export class AudioEngineError extends Error {
  constructor(public readonly code: ErrorCode, message: string, options?: ErrorOptions) { super(message, options); this.name='AudioEngineError'; }
}
export function checkAbort(signal?: AbortSignal): void {
  if(signal?.aborted) throw new AudioEngineError('ABORTED','Operation canceled.');
}
