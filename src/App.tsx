import { useState, useEffect, useRef, useMemo } from 'react';
import { ColorPickerSvg } from './utils/svg.icons';
import { loadSvgString } from './utils/dom.utils';
import './App.scss';

let worker: Worker | null = null;
let canvas: HTMLCanvasElement | null = null;

// image 3120x3900
const IMG_LINK = 'https://images.pexels.com/photos/12043242/pexels-photo-12043242.jpeg';

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
          worker.postMessage({ canvas: offscreen, src: IMG_LINK, type: 'init' }, [offscreen]);
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
        <canvas id='main-canvas' width='1200' height='600' ref={mainCanvasRef}></canvas>
      </main>
    </>
  )
}

export default App
