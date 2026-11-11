// The public Overpass server is often busy, and when it is, it answers errors without
// CORS headers, which the browser reports as a CORS failure. This tries several public
// mirrors in turn so the doctors map keeps working.
const PRIMARY = "https://overpass-api.de/api/interpreter";
const MIRRORS = [
  PRIMARY,
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];
const TIMEOUT_MS = 15000;

const realFetch = window.fetch.bind(window);

function withTimeout(init: RequestInit | undefined) {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const outer = init?.signal;
  if (outer) {
    if (outer.aborted) ctrl.abort();
    else outer.addEventListener("abort", () => ctrl.abort(), { once: true });
  }
  return { init: { ...init, signal: ctrl.signal } as RequestInit, done: () => window.clearTimeout(timer) };
}

window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  if (typeof input !== "string" && !(input instanceof URL)) return realFetch(input, init);
  const url = typeof input === "string" ? input : input.href;
  if (!url.startsWith(PRIMARY)) return realFetch(input, init);

  const rest = url.slice(PRIMARY.length); // keeps a ?data=... query if there is one
  let lastError: unknown = new Error("Overpass request failed");
  let lastResponse: Response | null = null;
  for (const base of MIRRORS) {
    const attempt = withTimeout(init);
    try {
      const res = await realFetch(base + rest, attempt.init);
      if (res.ok) return res;
      lastResponse = res;
    } catch (e) {
      lastError = e;
      if (init?.signal?.aborted) throw e; // the page itself cancelled the request
    } finally {
      attempt.done();
    }
  }
  if (lastResponse) return lastResponse;
  throw lastError;
};
