const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8080';

export interface VideoSources {
  streamUrl: string;
  previewUrl: string;
  isDrive: boolean;
  fileId: string | null;
}

/**
 * Extracts a Google Drive file ID from various Drive URL formats.
 */
export function extractGoogleDriveFileId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();

  // Match /api/videos/stream/{id}
  const streamMatch = trimmed.match(/\/api\/videos\/stream\/([a-zA-Z0-9_-]+)/);
  if (streamMatch && streamMatch[1]) {
    return streamMatch[1];
  }

  // Direct file ID format (e.g. 18UdWhaqW4OqABHe_T1PumvLqswIbZ4Qb)
  if (/^[a-zA-Z0-9_-]{25,}$/.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.includes('drive.google.com')) {
    // Format: /file/d/{id}
    const fileDMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileDMatch && fileDMatch[1]) return fileDMatch[1];

    // Format: open?id={id}
    const openMatch = trimmed.match(/open\?id=([a-zA-Z0-9_-]+)/);
    if (openMatch && openMatch[1]) return openMatch[1];

    // Format: ?id={id} or &id={id}
    const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idMatch && idMatch[1]) return idMatch[1];
  }

  return null;
}

/**
 * Resolves video URLs to direct streaming endpoints and preview fallbacks.
 * Direct streams allow native <video> elements to play muted without audio.
 */
export function resolveVideoSources(rawUrl: string): VideoSources {
  if (!rawUrl) {
    return {
      streamUrl: '',
      previewUrl: '',
      isDrive: false,
      fileId: null,
    };
  }

  const trimmed = rawUrl.trim();
  const fileId = extractGoogleDriveFileId(trimmed);

  if (fileId) {
    const cleanApiBase = API_BASE.replace(/\/+$/, '');
    return {
      streamUrl: `${cleanApiBase}/api/videos/stream/${fileId}`,
      previewUrl: `https://drive.google.com/file/d/${fileId}/preview`,
      isDrive: true,
      fileId,
    };
  }

  // Handle local relative video paths
  if (trimmed.startsWith('/')) {
    const cleanApiBase = API_BASE.replace(/\/+$/, '');
    const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    return {
      streamUrl: `${cleanApiBase}${cleanPath}`,
      previewUrl: `${cleanApiBase}${cleanPath}`,
      isDrive: false,
      fileId: null,
    };
  }

  return {
    streamUrl: trimmed,
    previewUrl: trimmed,
    isDrive: false,
    fileId: null,
  };
}
