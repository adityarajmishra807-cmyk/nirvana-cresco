import { useEffect, useRef, useState } from 'react';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = workerUrl;

const PDF_PATH = '/assets/animation-frames/smooth_scroll_animation_frames.pdf';
const FRAMES_PER_PAGE = 4;
const FRAME_CROP = { x: 0.262, y: 0.069, width: 0.477, height: 0.188 };

type FrameCanvas = HTMLCanvasElement;

function createFrameCanvas(pageCanvas: HTMLCanvasElement, frameNumber: number): FrameCanvas {
  const width = Math.floor(pageCanvas.width * FRAME_CROP.width);
  const height = Math.floor(pageCanvas.height * FRAME_CROP.height);
  const frameCanvas = document.createElement('canvas');
  frameCanvas.width = width;
  frameCanvas.height = height;
  const context = frameCanvas.getContext('2d');
  if (!context) return frameCanvas;

  const sourceX = Math.floor(pageCanvas.width * FRAME_CROP.x);
  const sourceY = Math.floor(pageCanvas.height * (FRAME_CROP.y + frameNumber * 0.237));
  context.drawImage(pageCanvas, sourceX, sourceY, width, height, 0, 0, width, height);
  return frameCanvas;
}

function drawCover(context: CanvasRenderingContext2D, frame: FrameCanvas, width: number, height: number, opacity = 1) {
  const scale = Math.max(width / frame.width, height / frame.height);
  const drawWidth = frame.width * scale;
  const drawHeight = frame.height * scale;
  context.globalAlpha = opacity;
  context.drawImage(frame, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
  context.globalAlpha = 1;
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const framesRef = useRef<FrameCanvas[]>([]);
  const progressRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const [frameCount, setFrameCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const loadFrames = async () => {
      const documentTask = getDocument({ url: PDF_PATH });
      const pdf = await documentTask.promise;
      const frames: FrameCanvas[] = [];

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        if (cancelled) return;
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 2 });
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = Math.ceil(viewport.width);
        pageCanvas.height = Math.ceil(viewport.height);
        const pageContext = pageCanvas.getContext('2d');
        if (!pageContext) continue;
        await page.render({ canvas: pageCanvas, canvasContext: pageContext, viewport }).promise;
        for (let frameNumber = 0; frameNumber < FRAMES_PER_PAGE; frameNumber += 1) {
          frames.push(createFrameCanvas(pageCanvas, frameNumber));
        }
      }

      if (!cancelled) {
        framesRef.current = frames;
        setFrameCount(frames.length);
      }
    };

    loadFrames().catch(() => {
      if (!cancelled) setFrameCount(0);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    const drawFrame = () => {
      const frames = framesRef.current;
      const width = window.innerWidth;
      const height = window.innerHeight;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const targetWidth = Math.floor(width * pixelRatio);
      const targetHeight = Math.floor(height * pixelRatio);

      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }

      context.fillStyle = '#07191d';
      context.fillRect(0, 0, canvas.width, canvas.height);
      if (frames.length > 0) {
        const framePosition = progressRef.current * (frames.length - 1);
        const firstFrameIndex = Math.floor(framePosition);
        const secondFrameIndex = Math.min(firstFrameIndex + 1, frames.length - 1);
        const blend = framePosition - firstFrameIndex;
        drawCover(context, frames[firstFrameIndex], canvas.width, canvas.height);
        if (blend > 0 && secondFrameIndex !== firstFrameIndex) {
          drawCover(context, frames[secondFrameIndex], canvas.width, canvas.height, blend);
        }
      }
      rafRef.current = null;
    };

    const requestDraw = () => {
      if (rafRef.current === null) rafRef.current = requestAnimationFrame(drawFrame);
    };

    const updateProgress = () => {
      const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
      progressRef.current = scrollableHeight > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollableHeight)) : 0;
      requestDraw();
    };

    window.addEventListener('scroll', updateProgress, { passive: true });
    window.addEventListener('resize', requestDraw);
    requestDraw();
    return () => {
      window.removeEventListener('scroll', updateProgress);
      window.removeEventListener('resize', requestDraw);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [frameCount]);

  return (
    <main className="sequence" aria-label="Scroll-controlled cinematic property sequence">
      <section className="sequence-sticky">
        <canvas ref={canvasRef} className="sequence-canvas" aria-hidden="true" />
      </section>
    </main>
  );
}

export default App;
