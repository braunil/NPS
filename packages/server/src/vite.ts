// server/vite.ts - Temporary stub for Vite (disabled for CommonJS compatibility)
import express, { type Express } from "express";
import { type Server } from "http";

export async function setupVite(app: Express, server?: Server) {      
  console.log("WARNING: Vite development server disabled (CommonJS mode)");
  console.log("INFO: Serving static files instead");
  
  // Serve static files as fallback
  app.use(express.static("dist"));
  
  // Fallback route for SPA - avoid template literals
  app.get("*", (req, res) => {
    const html = "<html><head><title>DataVisualizer</title></head><body><div id=\"root\"><h1>DataVisualizer Server Running!</h1><p>Backend is ready. Frontend build needed for full functionality.</p><p>API endpoints are available at /api/*</p></div></body></html>";
    res.send(html);
  });
}

export function serveStatic(app: Express) {
  app.use(express.static("dist"));
  app.get("*", (req, res) => {
    res.sendFile("index.html", { root: "dist" });
  });
}

export function log(message: string) {
  console.log(message);
}