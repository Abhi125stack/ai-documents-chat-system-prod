import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @napi-rs/canvas ships a native .node addon and pdf-parse/pdfjs-dist pull in
  // non-ESM assets; Turbopack cannot place these in the ESM server chunk
  // ("non-ecmascript placeable asset"). Externalize them so they are required
  // at runtime from node_modules instead of bundled. chromadb resolves optional
  // embedding packages via a dynamic `@chroma-core/${name}` import that
  // Turbopack cannot bundle, so it is externalized too.
  serverExternalPackages: ["@napi-rs/canvas", "pdf-parse", "pdfjs-dist", "chromadb"],
};

export default nextConfig;
