/**
 * Explicit success/failure. The factory runs unattended for three weeks, so a
 * swallowed exception is a silent dead epoch. Callers must look at `ok`.
 */
export type Result<T, E = Error> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const Ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const Err = <E>(error: E): Result<never, E> => ({ ok: false, error });

/** Wrap a throwing async call so failures become values, not stack unwinds. */
export async function attempt<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return Ok(await fn());
  } catch (cause) {
    return Err(cause instanceof Error ? cause : new Error(String(cause)));
  }
}
