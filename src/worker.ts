type ImageSize = {
  width: number;
  height: number;
}

type WorkerIncomingMessage = {
  canvas: OffscreenCanvas;
  src: string;
  type: string;
  x: number;
  y: number;
  backgroundImageBufferData: ArrayBufferLike;
  backgroundImageSize: ImageSize;
  circleImageBufferData: ArrayBufferLike;
  circleImageSize: ImageSize;
};

type MousePosition = {
  x: number;
  y: number;
};

// type WorkerOutgoingMessage = {
//   message: string;
// };

export type RGB = {
  r: number;
  g: number;
  b: number;
};

// const WIDTH = 1200;
// const HEIGHT = 800;
const WIDTH = 1600;
const HEIGHT = 1200;

const lensRadius = 80;
const zoomFactor = 3;
const diameter = lensRadius * 2;

class PixalatedLens {
  private offscreenBackgroundImage: ImageBitmap | null = null;
  private selectedColorImage: { image: ImageData, data: ImageBitmap, width: number, height: number } | null = null;
  private resampledImage: ImageData | null = null;
  private pixelatedImage: ImageData | null = null;
  private newImgDataBitmap: ImageBitmap | null = null;
  // Create an offscreen canvas to hold the zoomed circle area
  private zoomCanvas: OffscreenCanvas = new OffscreenCanvas(diameter, diameter);

  constructor(
    private canvas: OffscreenCanvas,
    private ctx: OffscreenCanvasRenderingContext2D
  ) { }

  public async loadBackgroundImage(src: string, imageBufferData: ArrayBufferLike): Promise<void> {
    const image = new ImageData(new Uint8ClampedArray(imageBufferData), WIDTH, HEIGHT);
    this.offscreenBackgroundImage = await createImageBitmap(image);
    // this.offscreenBackgroundImage = await loadImage(src);
  }

  public async loadSelectedCircleImage(imageBufferData: ArrayBufferLike, imageSize: ImageSize): Promise<void> {
    const { width, height } = imageSize;
    const image = new ImageData(new Uint8ClampedArray(imageBufferData), width, height);
    this.selectedColorImage = {
      image,
      data: await createImageBitmap(image),
      width,
      height,
    }
  }

  public renderBackgroundImage(image: ImageBitmap): void {
    if (!this.canvas || !this.ctx) {
      throw new Error("Canvas or background image are not initialised");
    }

    const { width: canvasWidth, height: canvasHeight } = this.canvas;
    const { width: imageWidth, height: imageHeight } = image;

    const canvasAspectRatio = canvasWidth / canvasHeight;
    const imageAspectRatio = imageWidth / imageHeight;

    let renderableWidth, renderableHeight, xStart, yStart;

    if (canvasAspectRatio < imageAspectRatio) {
      // Canvas is taller relative to its width than the image
      renderableWidth = imageWidth * (canvasHeight / imageHeight);
      renderableHeight = canvasHeight;
      xStart = (canvasWidth - renderableWidth) / 2;
      yStart = 0;
    } else if (canvasAspectRatio > imageAspectRatio) {
      // Canvas is wider relative to its height than the image
      renderableWidth = canvasWidth;
      renderableHeight = imageHeight * (canvasWidth / imageWidth);
      xStart = 0;
      yStart = (canvasHeight - renderableHeight) / 2;
    } else {
      // Canvas and image have the same aspect ratio
      renderableWidth = canvasWidth;
      renderableHeight = canvasHeight;
      xStart = 0;
      yStart = 0;
    }

    this.ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    this.ctx.drawImage(
      image,
      xStart,
      yStart,
      renderableWidth,
      renderableHeight
    );
  }

  public async loadPixelatedImage(): Promise<void> {
    this.pixelatedImage = pixelateByAverageSquare(this.ctx, 3, WIDTH, HEIGHT);
    // this.resampledImage = lanczosResample(this.ctx, 4, WIDTH, HEIGHT);
    // this.pixelatedImage = pixelateImage(this.resampledImage, 5, WIDTH, HEIGHT);
    this.newImgDataBitmap = await createImageBitmap(this.pixelatedImage);
  }

  public renderZoomLens({ x, y }: MousePosition): void {
    if (!this.newImgDataBitmap) {
      return;
    }

    const radius = lensRadius;
    const zoom = zoomFactor;

    const startX = x - radius;
    const startY = y - radius;
    const diameter = radius * 2;

    const zoomCtx = this.zoomCanvas.getContext('2d');
    if (!zoomCtx) {
      return;
    }

    let hex = '#000000';
    let rgb = [0, 0, 0, 0];
    if (this.pixelatedImage) {
      // Log the pixel data at the clicked position, calculate the index of the pixel
      rgb = getPixel(this.pixelatedImage.data, x, y, WIDTH, HEIGHT);
      hex = rgbToHex({ r: rgb[0], g: rgb[1], b: rgb[2] });
      console.log({ rgb, hex });
    }

    zoomCtx.clearRect(0, 0, WIDTH, HEIGHT);

    // Draw zoomed portion of the image onto the offscreen canvas
    zoomCtx.drawImage(
      this.newImgDataBitmap,
      x - (radius / zoom),
      y - (radius / zoom),
      diameter / zoom,
      diameter / zoom,
      0,
      0,
      diameter,
      diameter
    );

    // update selected color circle
    if (this.selectedColorImage) {
      const { data, width, height } = this.selectedColorImage;
      zoomCtx.drawImage(data, 0, 0, width, height);
      let imageData = zoomCtx.getImageData(0, 0, width, height);
      imageData = updateColors(imageData, rgb, lensRadius + 1, width, height);
      // Put the updated ImageData back on the canvas
      zoomCtx.putImageData(imageData, 0, 0);
    }

    const textX = radius - 30;
    const textY = radius + 20;

    drawRoundedRect(zoomCtx, textX - 5, textY - 15, 75, 20, 5);

    zoomCtx.font = '16px Arial';
    zoomCtx.fillStyle = hex;
    zoomCtx.fillText(hex, textX, textY);

    // Clip and draw the zoomed circle onto the main canvas
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, 2 * Math.PI);
    this.ctx.clip();
    this.ctx.drawImage(this.zoomCanvas, startX, startY);
    this.ctx.restore();

    // // Draw lens border
    // this.ctx.beginPath();
    // this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    // this.ctx.strokeStyle = hex;
    // this.ctx.lineWidth = 10;
    // this.ctx.stroke();
  }

  public render(mousePosition?: MousePosition) {
    if (!this.ctx || !this.offscreenBackgroundImage) {
      return;
    }

    // Clear the canvas
    this.ctx.clearRect(0, 0, WIDTH, HEIGHT);
    // Draw the background image
    this.renderBackgroundImage(this.offscreenBackgroundImage);
    // Draw the zoom-in lens effect
    if (mousePosition) {
      this.renderZoomLens(mousePosition);
    }
  }
}

let pixelatedLens: PixalatedLens | null = null;

self.onmessage = async (event: MessageEvent<WorkerIncomingMessage>) => {
  const {
    type,
    canvas,
    src,
    x,
    y,
    backgroundImageBufferData,
    // backgroundImageSize,
    circleImageBufferData,
    circleImageSize
  } = event.data;

  let offscreenCanvas: OffscreenCanvas | null = null;
  let offscreenCtx: OffscreenCanvasRenderingContext2D | null = null;

  if (type === "init" && canvas) {
    // Initialize OffscreenCanvas
    offscreenCanvas = canvas;
    offscreenCtx = offscreenCanvas.getContext("2d");

    if (offscreenCtx) {
      pixelatedLens = new PixalatedLens(offscreenCanvas, offscreenCtx);

      // Load the background image
      await pixelatedLens.loadBackgroundImage(src, backgroundImageBufferData);
      // Load selected circle image
      await pixelatedLens.loadSelectedCircleImage(circleImageBufferData, circleImageSize);
      // load pixelated image for zoom
      await pixelatedLens.loadPixelatedImage();

      // Wait for the next repaint when background image has been rendered on the canvas
      requestAnimationFrame(async () => {
        await pixelatedLens?.loadPixelatedImage();
      });

      pixelatedLens.render();
    }
  }

  if (type === "mousemove") {
    if (pixelatedLens) {
      pixelatedLens.render({ x, y });
    }
  }

  // self.postMessage('test');
};

async function loadImage(src: string): Promise<ImageBitmap> {
  const resp = await fetch(src);
  if (!resp.ok) {
    throw "Network error";
  }
  const blob = await resp.blob();
  const image = await createImageBitmap(blob);
  return image;
}

function average(arr: number[]): number {
  const sum = arr.reduce((a, b) => a + b, 0);
  return sum / arr.length;
}

function componentToHex(component: number): string {
  const hex = component.toString(16);
  return hex.length === 1 ? "0" : "" + hex;
}

function rgbToHex(colors: RGB): string {
  const { r, g, b } = colors;
  const rHex = componentToHex(r);
  const gHex = componentToHex(g);
  const bHex = componentToHex(b);
  return `#${rHex}${gHex}${bHex}`.padEnd(7, "0");
}

function getPixelIndex(x: number, y: number, width: number): number {
  return (y * width + x) * 4;
}

function getPixel(
  pixels: Uint8ClampedArray,
  x: number,
  y: number,
  width: number,
  height: number
) {
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

function updateColors(
  imageData: ImageData,
  rgbColor: number[],
  radius: number,
  width: number,
  height: number,
): ImageData {
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
function drawRoundedRect(
  ctx: OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  color?: string
): void {
  ctx.fillStyle = color || 'grey';
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.arcTo(x + width, y, x + width, y + radius, radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
  ctx.lineTo(x + radius, y + height);
  ctx.arcTo(x, y + height, x, y + height - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
  ctx.fill();
}

// make the image bluered and smoother
function lanczosResample(
  ctx: OffscreenCanvasRenderingContext2D,
  blockSize: number,
  width: number,
  height: number
) {
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

function pixelateByAverageSquare(
  ctx: OffscreenCanvasRenderingContext2D,
  blockSize: number,
  width: number,
  height: number
): ImageData {
  const { data: pixels } = ctx.getImageData(0, 0, width, height);
  const newImageData = new ImageData(width, height);
  const newData = newImageData.data;

  for (let y = 0; y < height; y += blockSize) {
    for (let x = 0; x < width; x += blockSize) {
      const red = [];
      const green = [];
      const blue = [];
      const alpha = [];

      for (let yy = 0; yy < blockSize; yy++) {
        for (let xx = 0; xx < blockSize; xx++) {
          const px = (x + xx + (y + yy) * width) * 4;

          if (px < pixels.length) {
            red.push(pixels[px]);
            green.push(pixels[px + 1]);
            blue.push(pixels[px + 2]);
            alpha.push(pixels[px + 3]);
          }
        }
      }

      // Calculate the average color of the block
      const r = average(red);
      const g = average(green);
      const b = average(blue);
      const a = average(alpha);

      // Set the color of each pixel in the block to the average color
      for (let yy = 0; yy < blockSize; yy++) {
        for (let xx = 0; xx < blockSize; xx++) {
          const px = (x + xx + (y + yy) * width) * 4;

          if (px < pixels.length) {
            newData[px] = r;
            newData[px + 1] = g;
            newData[px + 2] = b;
            newData[px + 3] = a;
          }
        }
      }
    }
  }

  return newImageData;
}

function pixelateImage(
  originalImageData: ImageData,
  pixelationFactor: number,
  width: number,
  height: number
): ImageData {
  const { data: pixels } = originalImageData;
  const newImageData = new ImageData(width, height);
  const newData = newImageData.data;

  for (let y = 0; y < height; y += pixelationFactor) {
    for (let x = 0; x < width; x += pixelationFactor) {
      const red = [];
      const green = [];
      const blue = [];
      const alpha = [];

      for (let yy = 0; yy < pixelationFactor; yy++) {
        for (let xx = 0; xx < pixelationFactor; xx++) {
          const px = (x + xx + (y + yy) * width) * 4;

          if (px < pixels.length) {
            red.push(pixels[px]);
            green.push(pixels[px + 1]);
            blue.push(pixels[px + 2]);
            alpha.push(pixels[px + 3]);
          }
        }
      }

      // Calculate the average color of the block
      const r = average(red);
      const g = average(green);
      const b = average(blue);
      const a = average(alpha);

      // Set the color of each pixel in the block to the average color
      for (let yy = 0; yy < pixelationFactor; yy++) {
        for (let xx = 0; xx < pixelationFactor; xx++) {
          const px = (x + xx + (y + yy) * width) * 4;

          if (px < pixels.length) {
            newData[px] = r;
            newData[px + 1] = g;
            newData[px + 2] = b;
            newData[px + 3] = a;
          }
        }
      }
    }
  }

  return newImageData;
}