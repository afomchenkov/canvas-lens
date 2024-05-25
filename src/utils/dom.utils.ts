import { RGB } from "../types";

export const fetchSvgString = async (
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

export const loadSvgString = (svg: string): string => {
  return `data:image/svg+xml;base64, ${btoa(svg)}`;
};

// export const loadImage = async (src: string): Promise<ImageBitmap> => {
//   const resp = await fetch(src);
//   if (!resp.ok) {
//     throw "Network error";
//   }
//   const blob = await resp.blob();
//   const image = await createImageBitmap(blob);
//   return image;
// };

// export const componentToHex = (component: number): string => {
//   const hex = component.toString(16);
//   return hex.length === 1 ? "0" : "" + hex;
// };

// export const rgbToHex = (colors: RGB): string => {
//   const { r, g, b } = colors;
//   const rHex = componentToHex(r);
//   const gHex = componentToHex(g);
//   const bHex = componentToHex(b);
//   return `#${rHex}${gHex}${bHex}`.padEnd(7, "0");
// };

// export const pixelateImage = (
//   ctx: CanvasRenderingContext2D,
//   pixelSize: number,
//   width: number,
//   height: number
// ): Uint8ClampedArray => {
//   const { data: pixels } = ctx.getImageData(0, 0, width, height);
//   const newImageLayout = new Uint8ClampedArray(pixels.length);

//   for (let y = 0; y < height; y += pixelSize) {
//     for (let x = 0; x < width; x += pixelSize) {
//       const red = [];
//       const green = [];
//       const blue = [];
//       const alpha = [];

//       for (let yy = 0; yy < pixelSize; yy++) {
//         for (let xx = 0; xx < pixelSize; xx++) {
//           const px = (x + xx + (y + yy) * width) * 4;

//           if (px < pixels.length) {
//             red.push(pixels[px]);
//             green.push(pixels[px + 1]);
//             blue.push(pixels[px + 2]);
//             alpha.push(pixels[px + 3]);
//           }
//         }
//       }

//       // Calculate the average color of the block
//       const r = average(red);
//       const g = average(green);
//       const b = average(blue);
//       const a = average(alpha);

//       // Set the color of each pixel in the block to the average color
//       for (let yy = 0; yy < pixelSize; yy++) {
//         for (let xx = 0; xx < pixelSize; xx++) {
//           const px = (x + xx + (y + yy) * width) * 4;

//           if (px < pixels.length) {
//             newImageLayout[px] = r;
//             newImageLayout[px + 1] = g;
//             newImageLayout[px + 2] = b;
//             newImageLayout[px + 3] = a;
//           }
//         }
//       }
//     }
//   }

//   return newImageLayout;
// };

// export const getPixelIndex = (x: number, y: number, width: number): number => {
//   return (y * width + x) * 4;
// };

// export const average = (arr: number[]): number => {
//   const sum = arr.reduce((a, b) => a + b, 0);
//   return sum / arr.length;
// };
