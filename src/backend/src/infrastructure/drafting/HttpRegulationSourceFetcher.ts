import type {
  FetchedRegulationSource,
  RegulationSourceFetcher,
} from "../../application/drafting/draftingJobPorts";
import { BusinessRuleViolationError } from "../../application/errors";
import { isAllowedRegulationSourceUrl } from "../../domain/regulationSource";
import { extractHtmlTitle, htmlToText } from "./htmlToText";

const FETCH_TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const HTML_CONTENT_TYPES = ["text/html", "application/xhtml+xml"];
const PLAIN_TEXT_CONTENT_TYPES = ["text/plain", "text/markdown"];

export class RegulationSourceFetchError extends BusinessRuleViolationError {}

export class HttpRegulationSourceFetcher implements RegulationSourceFetcher {
  async fetchSource(url: string): Promise<FetchedRegulationSource> {
    const response = await fetchFollowingAllowedRedirects(url);
    const mediaType = (response.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
    const body = await readCappedBody(response, url);

    if (HTML_CONTENT_TYPES.includes(mediaType)) {
      return { title: extractHtmlTitle(body), text: htmlToText(body) };
    }

    if (PLAIN_TEXT_CONTENT_TYPES.includes(mediaType)) {
      return { title: null, text: body.trim() };
    }

    throw new RegulationSourceFetchError(
      `${url} returned ${mediaType || "no content type"}; only HTML and plain text are supported`,
    );
  }
}

// Every hop is checked against the allowlist, so a redirect cannot lead to an internal address.
async function fetchFollowingAllowedRedirects(url: string): Promise<Response> {
  let currentUrl = url;

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    if (!isAllowedRegulationSourceUrl(currentUrl)) {
      throw new RegulationSourceFetchError(`${currentUrl} is not an allowed regulation source`);
    }

    const response = await fetch(currentUrl, {
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { accept: "text/html, text/plain;q=0.9" },
    });
    const location = response.headers.get("location");

    if (response.status >= 300 && response.status < 400 && location) {
      currentUrl = new URL(location, currentUrl).href;
      continue;
    }

    if (!response.ok) {
      throw new RegulationSourceFetchError(`${currentUrl} responded with HTTP ${response.status}`);
    }

    return response;
  }

  throw new RegulationSourceFetchError(`${url} redirected more than ${MAX_REDIRECTS} times`);
}

async function readCappedBody(response: Response, url: string): Promise<string> {
  const reader = response.body?.getReader();

  if (!reader) {
    return "";
  }

  const chunks: Uint8Array[] = [];
  let size = 0;

  for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
    size += chunk.value.byteLength;

    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new RegulationSourceFetchError(`${url} is larger than ${MAX_BODY_BYTES / 1024 / 1024} MB`);
    }

    chunks.push(chunk.value);
  }

  return new TextDecoder().decode(Buffer.concat(chunks));
}
