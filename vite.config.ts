import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    global: "globalThis",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/auth/providers": {
        target: "http://localhost:8080",
      },
      "/auth/login": {
        target: "http://localhost:8080",
      },
      "/login": {
        target: "http://localhost:8080",
      },
      "/consent": {
        target: "http://localhost:8080",
      },
      "/me": {
        target: "http://localhost:8080",
      },
      "/admin": {
        target: "http://localhost:8080",
      },
      "/llm": {
        target: "http://localhost:8080",
      },
      "/checker": {
        target: "http://localhost:8080",
      },
      "/conversations": {
        target: "http://localhost:8080",
      },
      "/repos": {
        target: "http://localhost:8080",
        configure: (proxy) => {
          proxy.on("proxyRes", (proxyRes) => {
            // Go may send trailers/chunked encoding on 204 No Content,
            // which crashes Node's HTTP stack. Strip all body-related headers.
            if (proxyRes.statusCode === 204) {
              delete proxyRes.headers["transfer-encoding"]
              delete proxyRes.headers["trailer"]
              delete proxyRes.headers["content-length"]
              proxyRes.rawTrailers = []
              proxyRes.trailers = {}
            }
          })
        },
      },
    },
  },
})
