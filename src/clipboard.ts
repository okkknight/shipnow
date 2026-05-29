export interface CopyEnvironment {
  navigator?: Pick<Navigator, 'clipboard'>;
  document?: Pick<Document, 'body' | 'createElement' | 'execCommand'>;
}

function tryLegacyCopy(documentLike: CopyEnvironment['document'], value: string): boolean {
  if (!documentLike?.body || !documentLike.createElement || typeof documentLike.execCommand !== 'function') {
    return false;
  }

  const textarea = documentLike.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.top = '-9999px';
  textarea.style.left = '-9999px';
  textarea.style.opacity = '0';
  documentLike.body.appendChild(textarea);

  try {
    if (typeof textarea.focus === 'function') {
      textarea.focus();
    }
    textarea.select();
    if (typeof textarea.setSelectionRange === 'function') {
      textarea.setSelectionRange(0, value.length);
    }
    return documentLike.execCommand('copy');
  } catch {
    return false;
  } finally {
    if (typeof documentLike.body.removeChild === 'function') {
      try {
        documentLike.body.removeChild(textarea);
      } catch {
        // Ignore cleanup failures; the page will recover on the next render.
      }
    }
  }
}

export async function copyText(value: string, environment: CopyEnvironment = {}): Promise<boolean> {
  const navigatorLike = environment.navigator ?? globalThis.navigator;
  const documentLike = environment.document ?? globalThis.document;

  if (tryLegacyCopy(documentLike, value)) {
    return true;
  }

  if (navigatorLike?.clipboard?.writeText) {
    try {
      await navigatorLike.clipboard.writeText(value);
      return true;
    } catch {
      // Fall back to a legacy clipboard path below.
    }
  }

  return false;
}
