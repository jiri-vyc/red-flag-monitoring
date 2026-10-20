/** Saves text as a file in the browser (Blob + object URL); nothing is sent anywhere. */
export function downloadTextFile({
  content,
  fileName,
  mimeType,
}: {
  content: string;
  fileName: string;
  mimeType: string;
}): void {
  const objectUrl = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  // Safari and older Firefox cancel the download of a detached link or of an URL revoked right after the click.
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), REVOKE_DELAY_MS);
}

const REVOKE_DELAY_MS = 1000;
