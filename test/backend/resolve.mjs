// ESM resolve/load hook: stub the two native/wasm deps the worker imports at the
// top so it can be imported unmodified under plain Node for offline route testing.
const STUBS = {
  "@cf-wasm/photon":
    "export class PhotonImage{static new_from_byteslice(){return new PhotonImage()} get_bytes_jpeg(){return new Uint8Array()} get_bytes_webp(){return new Uint8Array()} get_bytes(){return new Uint8Array()} width(){return 0} height(){return 0} free(){}}; " +
    "export function watermark(){}; export function resize(){return new PhotonImage()}; " +
    "export const SamplingFilter={Nearest:0,Triangle:1,CatmullRom:2,Gaussian:3,Lanczos3:4};",
  "@cloudflare/containers":
    "export class Container{constructor(){this.defaultPort=8080}}; " +
    "export function getContainer(){return {fetch:async()=>new Response('{}',{headers:{'content-type':'application/json'}})}};",
};
export async function resolve(spec, ctx, next) {
  if (STUBS[spec]) return { url: "stub:" + spec, shortCircuit: true };
  return next(spec, ctx);
}
export async function load(url, ctx, next) {
  if (url.startsWith("stub:")) return { format: "module", source: STUBS[url.slice(5)], shortCircuit: true };
  return next(url, ctx);
}
