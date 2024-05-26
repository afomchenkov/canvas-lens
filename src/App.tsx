import { useState, useEffect, useRef, useMemo } from 'react';
import { ColorPickerSvg, SelectedColorSvg } from './utils/svg.icons';
import {
  loadImageBufferWithSize,
  loadSvgString,
  fetchSvgFromString,
  fetchImage
} from './utils/dom.utils';
import { WorkerOutgoingMessage } from './types';
import './App.scss';

let worker: Worker | null = null;
let canvas: HTMLCanvasElement | null = null;

// image 1920x1080 - 433Kb
// const IMG_LINK = './1920x1080-beach-island.jpg';

// image 9810x3798 - 7.5Mb
const IMG_LINK = './9810x3798-stuttgart.jpeg';

const App = () => {
  const [hexColor, setHexColor] = useState('--');
  const [isBackgroundLoaded, setIsBackgroundLoaded] = useState(false);
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);

  const handleColorPickerClick = () => {
    // todo
  }

  const handleMouseMove = (event: MouseEvent) => {
    if (worker && canvas) {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      worker.postMessage({ type: 'mousemove', mouseMovePosition: { x, y } });
    }
  }

  worker = useMemo(
    () => new Worker(new URL('./worker.ts', import.meta.url)),
    []
  );

  useEffect(() => {
    if (worker) {
      if (mainCanvasRef.current) {

        // Render/init canvas only once, React in dev mode calls render
        // twice and setState triggers re-render
        if (!canvas) {
          canvas = mainCanvasRef.current;
          // Transfer the canvas control to OffscreenCanvas in order
          // to be able to handle the calculation in worker
          const offscreen = canvas.transferControlToOffscreen();

          Promise.all([
            fetchImage(IMG_LINK),
            fetchSvgFromString(SelectedColorSvg)
          ]).then(([backgroundImage, selectedColorSvg]) => {
            const { width: backgroundWidth, height: backgroundHeight } = backgroundImage;
            const { width: selectedColorWidth, height: selectedColorHeight } = selectedColorSvg;

            if (!canvas) {
              throw new Error('Main canvas is not initialized');
            }

            if (worker) {
              const backgroundImageBufferData: ArrayBufferLike = loadImageBufferWithSize(backgroundImage);
              const circleImageBufferData: ArrayBufferLike = loadImageBufferWithSize(selectedColorSvg);
              
              worker.postMessage({
                canvas: offscreen,
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

            canvas.addEventListener('mousemove', handleMouseMove);
          });
        }
      }

      worker.onmessage = (event: MessageEvent<WorkerOutgoingMessage>) => {
        const { type, hexColor } = event.data;
        
        switch (type) {
          case 'backgroundRendered': {
            setIsBackgroundLoaded(true);
            break;
          }
          case 'colorChanged': {
            if (hexColor) {
              setHexColor(hexColor);
            }
            break;
          }
          default:
            console.warn('Unsupported message from worker thread');
        }
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
        {!isBackgroundLoaded && <h3>Loading...</h3>}
        <canvas id='main-canvas' ref={mainCanvasRef}></canvas>
      </main>
    </>
  )
}

export default App
