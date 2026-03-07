import { motion } from "framer-motion";
import { useEffect, useRef } from "react";

function WaveGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let time = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const waveRows = 20;
      const rowSpacing = h / (waveRows - 1);
      const step = 3; // pixel step for smooth curves

      for (let row = 0; row < waveRows; row++) {
        const baseY = row * rowSpacing;
        const rowPhase = row * 0.4;
        
        // Fade opacity: stronger in middle, softer at edges
        const distFromCenter = Math.abs(row - waveRows / 2) / (waveRows / 2);
        const alpha = 0.06 + (1 - distFromCenter) * 0.14;

      ctx.strokeStyle = `hsla(250, 55%, 55%, ${alpha * 0.4})`;
      ctx.lineWidth = 1.2 + Math.sin(time * 0.3 + row * 0.5) * 0.4;
        ctx.beginPath();

        for (let x = 0; x <= w; x += step) {
          const wave1 = Math.sin((x * 0.008) + time + rowPhase) * 18;
          const wave2 = Math.sin((x * 0.015) - time * 0.7 + rowPhase * 0.5) * 10;
          const wave3 = Math.sin((x * 0.003) + time * 0.4 + row * 0.2) * 25;
          const y = baseY + wave1 + wave2 + wave3;

          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      time += 0.08;
      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ pointerEvents: "none" }}
    />
  );
}

export function AnimatedBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* Base gradient */}
      <div className="absolute inset-0 bg-background" />

      {/* Animated wave grid */}
      <WaveGrid />

      {/* Floating yellow blob - top right */}
      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full opacity-[0.08]"
        style={{
          background: 'radial-gradient(circle, hsl(250 55% 55%) 0%, transparent 70%)',
          filter: 'blur(80px)',
          top: '-10%',
          right: '-5%',
        }}
        animate={{
          x: [0, 80, -40, 60, 0],
          y: [0, 60, 120, 40, 0],
          scale: [1, 1.2, 0.9, 1.1, 1],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Floating purple blob - bottom left */}
      <motion.div
        className="absolute w-[600px] h-[600px] rounded-full opacity-[0.06]"
        style={{
          background: 'radial-gradient(circle, hsl(220 70% 50%) 0%, transparent 70%)',
          filter: 'blur(100px)',
          bottom: '-15%',
          left: '-10%',
        }}
        animate={{
          x: [0, -60, 80, -30, 0],
          y: [0, -80, -20, -100, 0],
          scale: [1, 1.1, 1.3, 0.95, 1],
        }}
        transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Small yellow accent blob - center left */}
      <motion.div
        className="absolute w-[300px] h-[300px] rounded-full opacity-[0.06]"
        style={{
          background: 'radial-gradient(circle, hsl(250 55% 55%) 0%, transparent 70%)',
          filter: 'blur(60px)',
          top: '40%',
          left: '10%',
        }}
        animate={{
          x: [0, 100, 50, -50, 0],
          y: [0, -60, 80, -30, 0],
          scale: [1, 0.8, 1.2, 1, 1],
        }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Decorative floating squares */}
      {[
        { size: 40, top: '15%', left: '8%', delay: 0, opacity: 0.08 },
        { size: 30, top: '70%', right: '12%', delay: 2, opacity: 0.06 },
        { size: 50, top: '25%', right: '20%', delay: 4, opacity: 0.07 },
        { size: 25, bottom: '30%', left: '20%', delay: 1, opacity: 0.05 },
        { size: 35, top: '55%', right: '8%', delay: 3, opacity: 0.06 },
      ].map((block, i) => (
        <motion.div
          key={i}
          className="absolute rounded-md border border-primary/15"
          style={{
            width: block.size,
            height: block.size,
            background: i % 2 === 0
              ? 'hsl(250 55% 55% / 0.06)'
              : 'hsl(220 70% 50% / 0.05)',
            top: block.top,
            left: (block as any).left,
            right: (block as any).right,
            bottom: (block as any).bottom,
            opacity: block.opacity,
          }}
          animate={{
            y: [0, -20, 10, -15, 0],
            rotate: [0, 5, -3, 8, 0],
            opacity: [block.opacity, block.opacity * 1.5, block.opacity * 0.8, block.opacity * 1.2, block.opacity],
          }}
          transition={{
            duration: 12 + i * 2,
            repeat: Infinity,
            ease: "easeInOut",
            delay: block.delay,
          }}
        />
      ))}
    </div>
  );
}
