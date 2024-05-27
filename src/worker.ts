export type RGB = {
  r: number;
  g: number;
  b: number;
};

type ImageSize = {
  width: number;
  height: number;
};

type MousePosition = {
  x: number;
  y: number;
};

type WorkerIncomingMessage = {
  canvas: OffscreenCanvas;
  type: "init" | "mousemove" | "lensToggle";
  backgroundImageBufferData: ArrayBufferLike;
  backgroundImageSize: ImageSize;
  circleImageBufferData: ArrayBufferLike;
  circleImageSize: ImageSize;
  mouseMovePosition: MousePosition;
  isLensEnabled: boolean;
};

type LoadedImageData = {
  image: ImageData;
  data: ImageBitmap;
  width: number;
  height: number;
};

class PixalatedLens {
  public static LENS_RADIUS = 80;
  public static ZOOM_FACTOR = 3;
  public static DIAMETER = PixalatedLens.LENS_RADIUS * 2;

  private offscreenBackgroundImage: LoadedImageData | null = null;
  // private selectedColorImage: LoadedImageData | null = null;
  private pixelatedBackgroundImage: ImageData | null = null;
  private pixelatedBackgroundImageBitmap: ImageBitmap | null = null;
  // Create an offscreen canvas to hold the zoomed circle area
  private zoomCanvas: OffscreenCanvas = new OffscreenCanvas(PixalatedLens.DIAMETER, PixalatedLens.DIAMETER);
  private previousCirclePosition: MousePosition = { x: 0, y: 0 };
  private isLensEnabled: boolean = false;

  constructor(
    private canvas: OffscreenCanvas,
    private ctx: OffscreenCanvasRenderingContext2D
  ) { }

  private async loadImageOntoCanvas(
    imageBufferData: ArrayBufferLike,
    imageSize: ImageSize
  ): Promise<LoadedImageData> {
    const { width, height } = imageSize;
    const image = new ImageData(
      new Uint8ClampedArray(imageBufferData),
      width,
      height
    );
    const data = await createImageBitmap(image);

    return { image, data, width, height };
  }

  public async loadBackgroundImageOntoCanvas(
    imageBufferData: ArrayBufferLike,
    imageSize: ImageSize
  ): Promise<void> {
    this.offscreenBackgroundImage = await this.loadImageOntoCanvas(
      imageBufferData,
      imageSize
    );
  }

  public renderBackgroundImage(): void {
    if (!this.canvas || !this.ctx || !this.offscreenBackgroundImage) {
      throw new Error("Canvas or background image are not initialised");
    }

    const { data: image, width: imageWidth, height: imageHeight } = this.offscreenBackgroundImage;
    const { width: canvasWidth, height: canvasHeight } = this.canvas;

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

    // Clear the canvas
    this.ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    // Draw background image
    this.ctx.drawImage(
      image,
      xStart,
      yStart,
      renderableWidth,
      renderableHeight
    );
  }

  public async loadPixelatedImage(): Promise<void> {
    if (!this.offscreenBackgroundImage) {
      throw new Error("Background image is not loaded");
    }

    const { width, height } = this.offscreenBackgroundImage;
    this.pixelatedBackgroundImage = pixelateByAverageSquare(
      this.ctx,
      3,
      width,
      height
    );
    this.pixelatedBackgroundImageBitmap = await createImageBitmap(
      this.pixelatedBackgroundImage
    );
  }

  public renderZoomLens({ x, y }: MousePosition): void {
    if (!this.pixelatedBackgroundImageBitmap || !this.offscreenBackgroundImage) {
      return;
    }

    const { data: backgroundImage } = this.offscreenBackgroundImage;

    const radius = PixalatedLens.LENS_RADIUS;
    const zoom = PixalatedLens.ZOOM_FACTOR;
    const diameter = PixalatedLens.DIAMETER;

    const startX = x - radius;
    const startY = y - radius;

    const zoomCtx = this.zoomCanvas.getContext("2d");
    if (!zoomCtx) {
      return;
    }

    let hex = "#000000";
    let rgb = [0, 0, 0, 0];
    if (this.pixelatedBackgroundImage) {
      const { data, width, height } = this.pixelatedBackgroundImage;
      // Log the pixel data at the clicked position, calculate the index of the pixel
      rgb = getPixel(data, x, y, width, height);
      hex = rgbToHex({ r: rgb[0], g: rgb[1], b: rgb[2] });
      zoomCtx.clearRect(0, 0, width, height);

      (self.postMessage as Worker['postMessage'])({
        type: "colorChanged",
        hexColor: hex,
      });
    }

    // In order to optimize re-render heavily, do the re-draw
    // for only the old sector where the lens was present
    const prevX = this.previousCirclePosition.x - radius - 10;
    const prevY = this.previousCirclePosition.y - radius - 10;
    this.ctx.clearRect(prevX, prevY, 180, 180);
    this.ctx.drawImage(
      backgroundImage,
      prevX, prevY,
      180, 180,
      prevX, prevY,
      180, 180,
    );
    this.previousCirclePosition = { x, y };

    // Draw zoomed portion of the image onto the offscreen canvas
    zoomCtx.drawImage(
      this.pixelatedBackgroundImageBitmap,
      x - radius / zoom,
      y - radius / zoom,
      diameter / zoom,
      diameter / zoom,
      0,
      0,
      diameter,
      diameter
    );

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

    // Draw lens border
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.strokeStyle = hex;
    this.ctx.lineWidth = 13;
    this.ctx.stroke();
  }

  public toggleLens(isLensEnabled: boolean): void {
    if (!isLensEnabled) {
      this.renderBackgroundImage();
    }
    this.isLensEnabled = isLensEnabled;
  }

  public render(mousePosition?: MousePosition) {
    if (!this.ctx || !this.offscreenBackgroundImage) {
      return;
    }

    if (!mousePosition) {
      // Draw the background image on init
      this.renderBackgroundImage();
    }

    // Draw the zoom-in lens effect
    if (mousePosition && this.isLensEnabled) {
      this.renderZoomLens(mousePosition);
    }
  }
}

let pixelatedLens: PixalatedLens | null = null;
let offscreenCanvas: OffscreenCanvas | null = null;
let offscreenCtx: OffscreenCanvasRenderingContext2D | null = null;

self.onmessage = async function (event: MessageEvent<WorkerIncomingMessage>) {
  const {
    type,
    canvas,
    mouseMovePosition,
    backgroundImageBufferData,
    backgroundImageSize,
    isLensEnabled,
    // circleImageBufferData,
    // circleImageSize
  } = event.data;

  switch (type) {
    case "init": {
      // Initialize OffscreenCanvas
      offscreenCanvas = canvas;
      offscreenCtx = offscreenCanvas.getContext("2d");

      // Preserve original background image size
      const { width, height } = backgroundImageSize;
      offscreenCanvas.width = width;
      offscreenCanvas.height = height;

      if (offscreenCtx) {
        pixelatedLens = new PixalatedLens(offscreenCanvas, offscreenCtx);

        // Load the background image
        await pixelatedLens.loadBackgroundImageOntoCanvas(
          backgroundImageBufferData,
          backgroundImageSize
        );
        // Load selected circle image - skip rendering image and draw the circle instead
        // await pixelatedLens.loadSelectedColorImageOntoCanvas(circleImageBufferData, circleImageSize);
        // Load pixelated image for zoom lens
        await pixelatedLens.loadPixelatedImage();

        // Wait for the next repaint when background image has been rendered on the canvas
        requestAnimationFrame(async () => {
          await pixelatedLens?.loadPixelatedImage();
        });

        pixelatedLens.render();

        (self.postMessage as Worker['postMessage'])({
          type: "backgroundRendered",
        });
      }

      break;
    }
    case "mousemove": {
      if (pixelatedLens) {
        pixelatedLens.render(mouseMovePosition);
      }
      break;
    }
    case "lensToggle": {
      pixelatedLens?.toggleLens(isLensEnabled);
      break;
    }
    default: {
      console.warn("Command type not supported");
    }
  }
};

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

function drawRoundedRect(
  ctx: OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  color?: string
): void {
  ctx.fillStyle = color || "grey";
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
