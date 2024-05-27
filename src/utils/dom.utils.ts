import { RGB } from "../types";

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

export const fetchImage = async (
  imageUrl: string
): Promise<HTMLImageElement> => {
  if (!imageUrl) {
    throw new Error("Image URL is not provided");
  }

  const img = new Image();
  img.crossOrigin = "Anonymous";

  const imgLoaded = new Promise((resolve, reject) => {
    img.onload = () => resolve(img);
    img.onerror = reject;
  });

  img.src = imageUrl;
  await imgLoaded;

  return img;
};

export const loadSvgString = (svg: string): string => {
  return `data:image/svg+xml;base64, ${btoa(svg)}`;
};

export const hexToRgb = (hex: string): RGB => {
  const bigint = parseInt(hex.slice(1), 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return { r, g, b };
};

export const loadImageBitmap = async (src: string): Promise<ImageBitmap> => {
  const resp = await fetch(src);
  if (!resp.ok) {
    throw "Network error";
  }
  const blob = await resp.blob();
  const image = await createImageBitmap(blob);
  return image;
}

export const loadImageBufferWithSize = (img: HTMLImageElement): ArrayBufferLike => {
  const { width, height } = img;
  const offscreenImageCtx = new OffscreenCanvas(width, height).getContext("2d");

  if (!offscreenImageCtx) {
    throw new Error("Missing offscreen canvas context");
  }

  // Draw image on the offscreen canvas
  offscreenImageCtx.clearRect(0, 0, width, height);
  offscreenImageCtx.drawImage(img, 0, 0, width, height);
  // Get ImageData from the canvas
  const circleImageData = offscreenImageCtx.getImageData(0, 0, width, height);
  const circleImageBufferData: ArrayBufferLike = circleImageData.data.buffer;
  return circleImageBufferData;
};

export const getPixelIndex = (x: number, y: number, width: number): number => {
  return (y * width + x) * 4;
}

export const getPixel = (
  pixels: Uint8ClampedArray,
  x: number,
  y: number,
  width: number,
  height: number
) => {
  if (x < 0 || x >= width || y < 0 || y >= height) {
    return [0, 0, 0, 0];
  }

  const index = getPixelIndex(x, y, width);
  return [
    pixels[index],
    pixels[index + 1],
    pixels[index + 2],
    pixels[index + 3],
  ];
}


// make the image bluered and smoother
export const lanczosResample = (
  ctx: OffscreenCanvasRenderingContext2D,
  blockSize: number,
  width: number,
  height: number
) => {
  const { data: pixels } = ctx.getImageData(0, 0, width, height);
  const newImageData = new ImageData(width, height);
  const newData = newImageData.data;

  const a = 3; // Lanczos parameter

  function lanczos(x: number): number {
    if (x === 0) return 1;
    if (x < -a || x > a) return 0;
    x *= Math.PI;
    return a * Math.sin(x) * Math.sin(x / a) / (x * x);
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      let totalWeight = 0;

      for (let cy = -blockSize; cy <= blockSize; cy++) {
        for (let cx = -blockSize; cx <= blockSize; cx++) {
          const weight = lanczos(cx / blockSize) * lanczos(cy / blockSize);
          const [pr, pg, pb, pa] = getPixel(pixels, x + cx, y + cy, width, height);
          r += pr * weight;
          g += pg * weight;
          b += pb * weight;
          a += pa * weight;
          totalWeight += weight;
        }
      }

      const index = (y * width + x) * 4;
      newData[index] = r / totalWeight;
      newData[index + 1] = g / totalWeight;
      newData[index + 2] = b / totalWeight;
      newData[index + 3] = a / totalWeight;
    }
  }

  return newImageData;
}

// expensive operation, loads canvas too much with re-drawing
export const updateColors = (
  imageData: ImageData,
  rgbColor: number[],
  radius: number,
  width: number,
  height: number,
): ImageData => {
  const { data } = imageData;
  const cx = width / 2;
  const cy = height / 2;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= radius * radius) {
        const index = (y * width + x) * 4;
        data[index] = rgbColor[0];     // Red
        data[index + 1] = rgbColor[1]; // Green
        data[index + 2] = rgbColor[2]; // Blue
        // Alpha (data[index + 3]) remains unchanged
      }
    }
  }
  return imageData;
}
