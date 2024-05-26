import { useState, useEffect, useRef, useMemo } from 'react';
import { ColorPickerSvg, SelectedColorSvg } from './utils/svg.icons';
import { loadSvgString, fetchSvgFromString, fetchImage } from './utils/dom.utils';
import './App.scss';

// const WIDTH = 1200;
// const HEIGHT = 800;

const WIDTH = 1600;
const HEIGHT = 1200;

let worker: Worker | null = null;
let canvas: HTMLCanvasElement | null = null;

// image 3120x3900
const IMG_LINK = 'https://images.pexels.com/photos/12043242/pexels-photo-12043242.jpeg';
// image 9810x3798
const LOCAL_HEAVY_IMG_LINK = './9810x3798-stuttgart.jpeg';

const App = () => {
  const [hexColor, setHexColor] = useState('--');
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);

  const handleColorPickerClick = () => {
    // todo
  }

  const handleMouseMove = (event: MouseEvent) => {
    if (worker && canvas) {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      worker.postMessage({ type: 'mousemove', x, y });
    }
  }

  worker = useMemo(
    () => new Worker(new URL('./worker.ts', import.meta.url)),
    []
  );

  useEffect(() => {
    if (worker) {
      if (mainCanvasRef.current) {

        if (!canvas) {
          canvas = mainCanvasRef.current;
          // Transfer the canvas control to OffscreenCanvas
          const offscreen = canvas.transferControlToOffscreen();

          Promise.all([
            fetchImage(LOCAL_HEAVY_IMG_LINK),
            fetchSvgFromString(SelectedColorSvg)
          ]).then(([backgroundImage, selectedColorSvg]) => {
            const { width: backgroundWidth, height: backgroundHeight } = backgroundImage;
            const offscreenBackgroundImageCtx = new OffscreenCanvas(WIDTH, HEIGHT).getContext('2d');
            const { width: selectedColorWidth, height: selectedColorHeight } = selectedColorSvg;
            const offscreenCircleImageCtx = new OffscreenCanvas(selectedColorWidth, selectedColorHeight).getContext('2d');

            if (offscreenCircleImageCtx && offscreenBackgroundImageCtx && worker) {
              // Draw background image on the canvas to get ImageDate
              offscreenBackgroundImageCtx.clearRect(0, 0, WIDTH, HEIGHT);
              offscreenBackgroundImageCtx.drawImage(backgroundImage, 0, 0, WIDTH, HEIGHT);
              // Get background ImageData from the canvas to get ImageDate
              const backgroundImageData = offscreenBackgroundImageCtx.getImageData(0, 0, WIDTH, HEIGHT);
              const backgroundImageBufferData: ArrayBufferLike = backgroundImageData.data.buffer;

              // Draw circle on the canvas
              offscreenCircleImageCtx.clearRect(0, 0, selectedColorWidth, selectedColorHeight);
              offscreenCircleImageCtx.drawImage(selectedColorSvg, 0, 0, selectedColorWidth, selectedColorHeight);
              // Get selected color circle ImageData from the canvas
              const circleImageData = offscreenCircleImageCtx.getImageData(0, 0, selectedColorWidth, selectedColorHeight);
              const circleImageBufferData: ArrayBufferLike = circleImageData.data.buffer;

              // TODO: duplication - move to function logic above

              worker.postMessage({
                canvas: offscreen,
                src: IMG_LINK, // TODO: remove
                type: 'init',
                backgroundImageBufferData,
                backgroundImageSize: {
                  width: backgroundWidth,
                  height: backgroundHeight
                },
                circleImageBufferData,
                circleImageSize: {
                  width: selectedColorWidth,
                  height: selectedColorHeight
                },
              }, [
                offscreen,
                backgroundImageBufferData,
                circleImageBufferData,
              ]);
            }
          });
          
          canvas.addEventListener('mousemove', handleMouseMove);
        }
      }

      worker.onmessage = (event: MessageEvent<string>) => {
        console.log('App ', event);
        setHexColor('');
      };
    }

    return () => {
      // canvas?.removeEventListener('mousemove', handleMouseMove);
    }
  }, [])

  return (
    <>
      <header className='app-header'>
        <div onClick={handleColorPickerClick} className='app-color-picker'>
          <img src={loadSvgString(ColorPickerSvg)} alt='color picker' />
        </div>
        <div className='app-hex-color'>
          <span>{hexColor}</span>
        </div>
      </header>
      <main className='app-canvas-container'>
        <canvas id='main-canvas' width={WIDTH} height={HEIGHT} ref={mainCanvasRef}></canvas>
      </main>
    </>
  )
}

export default App
