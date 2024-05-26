import { RGB } from '../types';

export const fetchSvgFromString = async (
  svgString: string
): Promise<HTMLImageElement> => {
  const blob = new Blob([svgString], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);

  return new Promise((resolve) => {
    const image = document.createElement("img");
    image.src = url;
    image.addEventListener(
      "load",
      () => {
        URL.revokeObjectURL(url);
        resolve(image);
      },
      { once: true }
    );
  });
};

export const fetchImage = async (imageUrl: string): Promise<HTMLImageElement> => {
  if (!imageUrl) {
    throw new Error('Image URL is not provided');
  }

  const img = new Image();
  img.crossOrigin = 'Anonymous';

  const imgLoaded = new Promise((resolve, reject) => {
    img.onload = () => resolve(img);
    img.onerror = reject;
  });

  img.src = imageUrl;
  await imgLoaded;

  return img;
}

export const loadSvgString = (svg: string): string => {
  return `data:image/svg+xml;base64, ${btoa(svg)}`;
};

export const hexToRgb = (hex: string): RGB => {
  const bigint = parseInt(hex.slice(1), 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return { r, g, b };
}