import * as React from "react";
import { Box } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * One thing you can turn, in 3D: a product, a piece, a model. The kit's ONLY
 * door to a WebGL canvas, so a page never hand-writes three.js.
 *
 * ALMOST NEVER THE RIGHT CHOICE. A canvas is the heaviest thing on a page. Use
 * this only when the 3D object IS what the business sells (a chair to turn, a
 * ring, a massing model) and the design asked for it. Never for words, a logo
 * or a background effect: those belong to the stylesheet.
 *
 * THE POSTER IS THE COMPONENT; THE CANVAS IS A BONUS ON TOP. What the server
 * renders, what shows before three.js has loaded, what shows when WebGL will
 * not start, is the same
 * poster: the `poster` picture when given, otherwise a quiet placeholder. So
 * the server markup and the first client render are identical (no hydration
 * mismatch), and a failure never leaves a hole in the page.
 *
 * THREE.JS LOADS ONLY IN THE BROWSER, ONLY ONCE THE BOX IS NEAR THE SCREEN. It
 * is a dynamic `import()` inside an effect, so it is never in the server render
 * and never in the page's first download.
 *
 * REDUCED MOTION NEVER SPINS BY ITSELF. The object is shown and still turns
 * when dragged; there are no buttons on it at all.
 *
 * COLOURS COME FROM THE THEME. A primitive is painted with `--primary`, lit
 * on a see-through canvas with NO BOX (owner, 2026-10-22: "No box pls"): the
 * object sits on the page's own background, so it follows the
 * site's palette and its dark mode. A glTF/GLB model keeps its own materials.
 *
 * DRAG TO TURN, AND THE ARROW KEYS DO THE SAME, because the box is focusable and
 * a turn only a mouse can make is not available to everyone. `label` is read
 * out as the picture's description; it is required.
 *
 * The height is FIXED (`height`, px), so the page never jumps when the canvas
 * arrives.
 */
export type Scene3DShape = "box" | "sphere" | "torus" | "knot" | "cone" | "cylinder";

export function Scene3D({
  label, src, shape = "knot", poster, height = 360, autoRotate = true, caption, className,
}: {
  label: string;
  src?: string;
  shape?: Scene3DShape;
  poster?: string;
  height?: number;
  autoRotate?: boolean;
  caption?: React.ReactNode;
  className?: string;
}) {
  const boxRef = React.useRef<HTMLDivElement>(null);
  const [live, setLive] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const [reduced, setReduced] = React.useState(false);
  const [near, setNear] = React.useState(false);

  React.useEffect(() => {
    try { setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch { /* old browser */ }
  }, []);

  React.useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") { setNear(true); return; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) setNear(true); }, { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // NO BUTTONS (owner, 2026-10-22: "No buttons or anything just the asset
  // floating"): reduced motion still shows the object, it just never spins by
  // itself; dragging and the arrow keys still turn it.
  const wanted = near && !failed;

  React.useEffect(() => {
    const el = boxRef.current;
    if (!wanted || !el) return;
    let stop = () => {};
    let cancelled = false;
    (async () => {
      try {
        const probe = document.createElement("canvas");
        if (!(probe.getContext("webgl2") || probe.getContext("webgl"))) throw new Error("no webgl");
        const THREE = await import("three");
        if (cancelled) return;
        const w = el.clientWidth || 1, h = height;
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(w, h);
        renderer.domElement.setAttribute("aria-hidden", "true");
        renderer.domElement.className = "absolute inset-0 size-full";
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100);
        camera.position.set(0, 0, 4.2);
        scene.add(new THREE.HemisphereLight(0xffffff, 0x888888, 1.6));
        const sun = new THREE.DirectionalLight(0xffffff, 2.2);
        sun.position.set(3, 4, 5);
        scene.add(sun);
        const group = new THREE.Group();
        scene.add(group);

        if (src) {
          const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
          const gltf = await new GLTFLoader().loadAsync(src);
          if (cancelled) return;
          const obj = gltf.scene;
          const bounds = new THREE.Box3().setFromObject(obj);
          const size = bounds.getSize(new THREE.Vector3()).length() || 1;
          obj.position.sub(bounds.getCenter(new THREE.Vector3()));
          group.scale.setScalar(2.4 / size);
          group.add(obj);
        } else {
          const geometry =
            shape === "box" ? new THREE.BoxGeometry(1.5, 1.5, 1.5)
            : shape === "sphere" ? new THREE.SphereGeometry(1.1, 64, 32)
            : shape === "torus" ? new THREE.TorusGeometry(0.9, 0.36, 48, 128)
            : shape === "cone" ? new THREE.ConeGeometry(1, 1.8, 64)
            : shape === "cylinder" ? new THREE.CylinderGeometry(0.9, 0.9, 1.6, 64)
            : new THREE.TorusKnotGeometry(0.8, 0.28, 220, 32);
          const material = new THREE.MeshStandardMaterial({ color: themeColour(el, "--primary"), roughness: 0.35, metalness: 0.15 });
          group.add(new THREE.Mesh(geometry, material));
        }

        el.appendChild(renderer.domElement);
        const spin = autoRotate && !reduced;
        let dragging = false, lastX = 0, lastY = 0, raf = 0;
        const draw = () => renderer.render(scene, camera);
        const loop = () => { if (spin && !dragging) group.rotation.y += 0.006; draw(); raf = requestAnimationFrame(loop); };
        const down = (e: PointerEvent) => { dragging = true; lastX = e.clientX; lastY = e.clientY; renderer.domElement.setPointerCapture?.(e.pointerId); };
        const move = (e: PointerEvent) => {
          if (!dragging) return;
          group.rotation.y += (e.clientX - lastX) * 0.01;
          group.rotation.x = Math.max(-1.2, Math.min(1.2, group.rotation.x + (e.clientY - lastY) * 0.01));
          lastX = e.clientX; lastY = e.clientY; draw();
        };
        const up = () => { dragging = false; };
        const key = (e: KeyboardEvent) => {
          const by = { ArrowLeft: [0, -0.2], ArrowRight: [0, 0.2], ArrowUp: [-0.2, 0], ArrowDown: [0.2, 0] }[e.key];
          if (!by) return;
          e.preventDefault();
          group.rotation.x = Math.max(-1.2, Math.min(1.2, group.rotation.x + by[0]));
          group.rotation.y += by[1]; draw();
        };
        const resize = () => { const nw = el.clientWidth || 1; renderer.setSize(nw, h); camera.aspect = nw / h; camera.updateProjectionMatrix(); draw(); };
        renderer.domElement.addEventListener("pointerdown", down);
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
        el.addEventListener("keydown", key);
        window.addEventListener("resize", resize);
        
        loop();
        setLive(true);
        stop = () => {
          cancelAnimationFrame(raf);
          renderer.domElement.removeEventListener("pointerdown", down);
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
          el.removeEventListener("keydown", key);
          window.removeEventListener("resize", resize);
          renderer.dispose();
          renderer.domElement.remove();
        };
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; stop(); setLive(false); };
  }, [wanted, src, shape, height, autoRotate, reduced]);

  return (
    <figure data-slot="scene-3d" className={cn("flex flex-col gap-2", className)}>
      {/* The buttons sit BESIDE the picture, not in it: a role="img" hides its
          children from assistive technology, buttons included. */}
      <div style={{ height }} className="relative w-full">
        {/* A SOFT SHADOW, so the object rests on the page instead of hanging
            in it. Theme foreground at low strength, never a colour of ours. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-[30%] -bottom-3 h-6 rounded-[50%] bg-foreground/20 blur-lg" />
        <div
          ref={boxRef}
          role="img"
          aria-label={label}
          tabIndex={live ? 0 : -1}
          className={cn(
            "absolute inset-0",
            live && "cursor-grab touch-none active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
          )}
        >
          {!live && (poster ? (
            <img src={poster} alt="" className="absolute inset-0 size-full object-contain" />
          ) : (
            <div aria-hidden="true" className="absolute inset-0 grid place-items-center text-muted-foreground">
              <Box className="size-12 opacity-40" strokeWidth={1.25} />
            </div>
          ))}
        </div>
      </div>
      {(caption || live) && (
        <figcaption className="text-sm text-muted-foreground">
          {caption}
          {live && <span className="sr-only"> Drag, or use the arrow keys, to turn it.</span>}
        </figcaption>
      )}
    </figure>
  );
}

/** A theme token as a colour three.js can read: the browser resolves oklch for us. Unreadable is undefined (three.js's own default), never a colour of ours. */
function themeColour(el: HTMLElement, token: string): string | undefined {
  const raw = getComputedStyle(el).getPropertyValue(token).trim();
  try {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    const g = c.getContext("2d");
    if (!g || !raw) return undefined;
    g.fillStyle = raw;
    g.fillRect(0, 0, 1, 1);
    const [r, gr, b] = g.getImageData(0, 0, 1, 1).data;
    return `rgb(${r}, ${gr}, ${b})`;
  } catch { return undefined; }
}
