export interface ShipNowRuntimeConfig {
  publicBaseUrl: string;
  apiBaseUrl: string;
  previewBaseUrl: string;
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

export function buildShipNowRuntimeConfig(input: ShipNowRuntimeConfig): ShipNowRuntimeConfig {
  return {
    publicBaseUrl: stripTrailingSlash(input.publicBaseUrl),
    apiBaseUrl: stripTrailingSlash(input.apiBaseUrl),
    previewBaseUrl: stripTrailingSlash(input.previewBaseUrl),
  };
}

function readRuntimeMeta(name: string): string | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const meta = document.head.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  const value = meta?.content?.trim();
  return value ? value : null;
}

export function getShipNowRuntimeConfig(): ShipNowRuntimeConfig {
  return buildShipNowRuntimeConfig({
    publicBaseUrl:
      readRuntimeMeta('shipnow-public-base') ||
      import.meta.env.VITE_SHIPNOW_PUBLIC_BASE_URL ||
      'https://boringmax.com',
    apiBaseUrl:
      readRuntimeMeta('shipnow-api-base') ||
      import.meta.env.VITE_SHIPNOW_API_BASE_URL ||
      '/api',
    previewBaseUrl:
      readRuntimeMeta('shipnow-preview-base') ||
      import.meta.env.VITE_SHIPNOW_PREVIEW_BASE_URL ||
      '/preview',
  });
}
