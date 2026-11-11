// Save text as a file from the browser (deck exports, tournament event JSON).

/** Offer `text` as a download named `name`. */
export function download(name: string, text: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  // the click has started the download; free the blob once it has been handed over
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
