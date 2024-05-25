type WorkerIncomingMessage = {
  canvas: OffscreenCanvas;
  src: string;
  type: string;
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

const WIDTH = 1200;
const HEIGHT = 600;
const lensRadius = 75;
const zoomFactor = 2;

class PixalatedLens {
  private offscreenBackgroundImage: ImageBitmap | null = null;
  private pixelatedImage: Uint8ClampedArray = new Uint8ClampedArray();
  private newImgDataBitmap: ImageBitmap | null = null;

  constructor(
    private canvas: OffscreenCanvas,
    private ctx: OffscreenCanvasRenderingContext2D
  ) {}

  private async loadImage(src: string): Promise<ImageBitmap> {
    const resp = await fetch(src);
    if (!resp.ok) {
      throw "Network error";
    }
    const blob = await resp.blob();
    const image = await createImageBitmap(blob);
    return image;
  }

  public async loadBackgroundImage(src: string): Promise<void> {
    const backgroundImg = await this.loadImage(src);
    this.offscreenBackgroundImage = backgroundImg;
  }

  public renderImageToFillCanvas(image: ImageBitmap): void {
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
    this.pixelatedImage = pixelateBackgroundImage(this.ctx, 4, WIDTH, HEIGHT);
    this.newImgDataBitmap = await createImageBitmap(new ImageData(this.pixelatedImage, WIDTH, HEIGHT));
  }

  public render() {
    if (!this.ctx || !this.offscreenBackgroundImage) {
      return;
    }

    // Clear the canvas
    this.ctx.clearRect(0, 0, WIDTH, HEIGHT);
    // Draw the background image
    this.renderImageToFillCanvas(this.offscreenBackgroundImage);
    // Draw the zoom-in lens effect
    // drawZoomLens(ctx, mousePosition.x, mousePosition.y, lensRadius, zoomFactor);
  }
}

let pixelatedLens: PixalatedLens | null = null;

self.onmessage = async (event: MessageEvent<WorkerIncomingMessage>) => {
  const { type, canvas, src, x, y } = event.data;

  if (type === "init" && canvas) {
    // Initialize OffscreenCanvas
    const offscreenCanvas = canvas;
    const offscreenCtx = offscreenCanvas.getContext("2d");

    if (offscreenCtx) {
      pixelatedLens = new PixalatedLens(offscreenCanvas, offscreenCtx);

      // Load the background image
      await pixelatedLens.loadBackgroundImage(src);
      // load pixelated image for zoom
      await pixelatedLens.loadPixelatedImage();

      pixelatedLens.render();
    }
  }

  if (type === "mousemove") {
    console.log("Worker::mousemove ", { x, y });
  }

  // send back to main
  // self.postMessage('test');
};

function pixelateBackgroundImage(
  ctx: OffscreenCanvasRenderingContext2D,
  pixelSize: number,
  width: number,
  height: number
): Uint8ClampedArray {
  const { data: pixels } = ctx.getImageData(0, 0, width, height);
  const newImageLayout = new Uint8ClampedArray(pixels.length);

  for (let y = 0; y < height; y += pixelSize) {
    for (let x = 0; x < width; x += pixelSize) {
      const red = [];
      const green = [];
      const blue = [];
      const alpha = [];

      for (let yy = 0; yy < pixelSize; yy++) {
        for (let xx = 0; xx < pixelSize; xx++) {
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
      for (let yy = 0; yy < pixelSize; yy++) {
        for (let xx = 0; xx < pixelSize; xx++) {
          const px = (x + xx + (y + yy) * width) * 4;

          if (px < pixels.length) {
            newImageLayout[px] = r;
            newImageLayout[px + 1] = g;
            newImageLayout[px + 2] = b;
            newImageLayout[px + 3] = a;
          }
        }
      }
    }
  }

  return newImageLayout;
}

// function getPixelIndex(x: number, y: number, width: number): number {
//   return (y * width + x) * 4;
// }

function average(arr: number[]): number {
  const sum = arr.reduce((a, b) => a + b, 0);
  return sum / arr.length;
}

// function componentToHex(component: number): string {
//   const hex = component.toString(16);
//   return hex.length === 1 ? "0" : "" + hex;
// }

// function rgbToHex(colors: RGB): string {
//   const { r, g, b } = colors;
//   const rHex = componentToHex(r);
//   const gHex = componentToHex(g);
//   const bHex = componentToHex(b);
//   return `#${rHex}${gHex}${bHex}`.padEnd(7, "0");
// }
