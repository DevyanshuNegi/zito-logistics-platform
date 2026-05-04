const defaultPages = [
  'http://127.0.0.1:3001/login',
  'http://127.0.0.1:3001/partners/login',
  'http://127.0.0.1:3001/internal/login',
];

const pages = process.argv.slice(2).length > 0 ? process.argv.slice(2) : defaultPages;

function extractMatches(html, pattern, baseUrl) {
  return [...html.matchAll(pattern)].map((match) => new URL(match[1], baseUrl).toString());
}

async function fetchText(url) {
  const response = await fetch(url, { cache: 'no-store', redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`Page request failed for ${url} (${response.status})`);
  }
  return response.text();
}

async function verifyAsset(url) {
  const response = await fetch(url, { cache: 'no-store', redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`Asset request failed for ${url} (${response.status})`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0) {
    throw new Error(`Asset was empty: ${url}`);
  }

  return bytes.byteLength;
}

async function main() {
  const checkedAssets = new Set();

  for (const page of pages) {
    const html = await fetchText(page);

    const cssAssets = extractMatches(html, /href="([^"]+\.css[^"]*)"/g, page);
    const jsAssets = extractMatches(
      html,
      /src="([^"]*\/_next\/static\/[^"]+\.js[^"]*)"/g,
      page,
    );

    if (cssAssets.length === 0) {
      throw new Error(`No CSS assets were found in ${page}`);
    }

    for (const asset of [...cssAssets, ...jsAssets]) {
      if (checkedAssets.has(asset)) {
        continue;
      }
      const size = await verifyAsset(asset);
      checkedAssets.add(asset);
      console.log(`OK ${asset} (${size} bytes)`);
    }
  }

  console.log(`Preview asset verification passed for ${pages.length} page(s).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
