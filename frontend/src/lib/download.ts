/**
 * Descarga un archivo desde una URL (típicamente una presigned de MinIO).
 *
 * Se baja a un blob antes de disparar el `<a download>` porque el atributo
 * `download` se ignora en respuestas cross-origin: sin esto el archivo se
 * abriría en vez de guardarse. Si el fetch falla (URL vencida, red caída), se
 * cae a abrirla — en Electron eso va al navegador del sistema vía
 * `setWindowOpenHandler`.
 *
 * Reemplaza cuatro copias idénticas que había en ConversationPage,
 * ConversationDetailPanel, ImageViewer y VideoViewer.
 */
export async function downloadFile(
  url: string,
  filename?: string | null,
  fallbackName = 'file',
): Promise<void> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = blobUrl;
    anchor.download = filename || fallbackName;
    anchor.click();

    URL.revokeObjectURL(blobUrl);
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
