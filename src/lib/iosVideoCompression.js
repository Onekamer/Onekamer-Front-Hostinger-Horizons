export async function compressVideoIfIOS(file, preset = '720p') {
  try {
    const C = typeof window !== 'undefined' ? window.Capacitor : null;
    if (!C || typeof C.getPlatform !== 'function' || C.getPlatform() !== 'ios') return file;
    const Plugins = C.Plugins || {};
    const VC = Plugins.VideoCompressor || Plugins.VideoCompressorPlugin;
    const FS = Plugins.Filesystem;
    if (!VC || !FS) return file;

    const name = String(file?.name || 'video').toLowerCase();
    const type = String(file?.type || '');
    const extFromType = type.endsWith('quicktime') ? 'mov' : (type.split('/')[1] || 'mp4');
    const extFromName = name.includes('.') ? name.split('.').pop() : '';
    const ext = (extFromName || extFromType || 'mp4').replace(/[^a-z0-9]/gi, '');
    const inPath = `ok_in_${Date.now()}.${ext || 'mp4'}`;

    const base64DataUrl = await blobToBase64(file);
    const base64 = base64DataUrl.replace(/^data:.*;base64,/, '');
    await FS.writeFile({ path: inPath, directory: 'CACHE', data: base64 });

    const got = await FS.getUri({ path: inPath, directory: 'CACHE' }).catch(() => ({}));
    const nativePath = got && (got.uri || got.path) ? (got.uri || got.path) : inPath;

    let result;
    try {
      result = await VC.compress({ path: nativePath, preset });
    } catch (_) {
      try { await FS.deleteFile({ path: inPath, directory: 'CACHE' }); } catch {}
      return file;
    }

    const outPath = result && (result.path || result.uri);
    if (!outPath) {
      try { await FS.deleteFile({ path: inPath, directory: 'CACHE' }); } catch {}
      return file;
    }

    const src = typeof C.convertFileSrc === 'function' ? C.convertFileSrc(outPath) : outPath;
    const resp = await fetch(src);
    const blob = await resp.blob();
    const outFile = new File([blob], `compressed_${Date.now()}.mp4`, { type: 'video/mp4' });

    try { await FS.deleteFile({ path: inPath, directory: 'CACHE' }); } catch {}

    return outFile;
  } catch (_) {
    return file;
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read error'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(blob);
  });
}
