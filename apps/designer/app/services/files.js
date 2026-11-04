// Handing a file to the person (download) and reading one they pick.
export function download(name, obj) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(obj)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const readJsonFile = async (file) => JSON.parse(await file.text());
