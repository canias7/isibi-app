// `node --import ./worker-register.mjs …` — installs the loader hooks before the
// first import, which is the only moment they can be installed. See
// worker-loader.mjs for what they do and why.
import { register } from "node:module";
register("./worker-loader.mjs", import.meta.url);
