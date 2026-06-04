import React, { createContext, useContext, useState } from "react";

interface LivePreviewContextType {
  previewHtml: string;
  setPreviewHtml: (html: string) => void;
  clearPreview: () => void;
  zoom: number | null;
  setZoom: (z: number | null) => void;
}

const LivePreviewContext = createContext<LivePreviewContextType>({
  previewHtml: "",
  setPreviewHtml: () => {},
  clearPreview: () => {},
  zoom: null,
  setZoom: () => {},
});

export function LivePreviewProvider({ children }: { children: React.ReactNode }) {
  const [previewHtml, setPreviewHtml] = useState("");
  const [zoom, setZoom] = useState<number | null>(null);
  return (
    <LivePreviewContext.Provider value={{
      previewHtml,
      setPreviewHtml,
      clearPreview: () => { setPreviewHtml(""); setZoom(null); },
      zoom,
      setZoom,
    }}>
      {children}
    </LivePreviewContext.Provider>
  );
}

export function useLivePreview() {
  return useContext(LivePreviewContext);
}
