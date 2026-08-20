import type { Area } from 'react-easy-crop';

const AVATAR_OUTPUT_SIZE = 512;

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', reject);
    image.src = url;
  });
}

/** Recorta la región seleccionada y exporta un JPEG cuadrado listo para avatar. */
export async function getCroppedAvatarFile(
  imageSrc: string,
  pixelCrop: Area,
  fileName = 'avatar.jpg',
): Promise<File> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height,
  );

  const size = Math.min(AVATAR_OUTPUT_SIZE, pixelCrop.width, pixelCrop.height);
  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = size;
  outputCanvas.height = size;
  const outputCtx = outputCanvas.getContext('2d');
  if (!outputCtx) throw new Error('Canvas not supported');

  outputCtx.drawImage(canvas, 0, 0, size, size);

  const blob = await new Promise<Blob>((resolve, reject) => {
    outputCanvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('Failed to export image'))),
      'image/jpeg',
      0.92,
    );
  });

  const safeName = fileName.replace(/\.[^.]+$/, '') || 'avatar';
  return new File([blob], `${safeName}.jpg`, { type: 'image/jpeg' });
}
