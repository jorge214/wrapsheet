import React, { createContext, useContext, useState } from "react";

interface LivePreviewContextType {
  previewHtml: string;
  setPreviewHtml: (html: string) => void;
  clearPreview: () => void;
}

const LivePreviewContext = createContext<LivePreviewContextType>({
  previewHtml: "",
  setPreviewHtml: () => {},
  clearPreview: () => {},
});

export function LivePreviewProvider({ children }: { children: React.ReactNode }) {
  const [previewHtml, setPreviewHtml] = useState("");
  return (
    <LivePreviewContext.Provider value={{ previewHtml, setPreviewHtml, clearPreview: () => setPreviewHtml("") }}>
      {children}
    </LivePreviewContext.Provider>
  );
}

export function useLivePreview() {
  return useContext(LivePreviewContext);
}
