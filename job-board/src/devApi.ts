// Calls to the local admin server (scripts/dev-server.js), which writes jobs.json,
// occupations.json and constants.json during local development.

const NOT_RUNNING =
  "The local admin server isn't running. Start it in a second terminal with " +
  '`npm run dev-server` and try again.';

/** POSTs JSON and returns the parsed reply. */
export async function postJson<T>(url: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    // The request never landed at all.
    throw new Error(NOT_RUNNING);
  }

  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(res.ok ? NOT_RUNNING : `${NOT_RUNNING} (${res.status})`);
  }

  if (!res.ok) {
    const message = (parsed as { error?: string })?.error;
    throw new Error(message || `Request failed (${res.status})`);
  }
  return parsed as T;
}
