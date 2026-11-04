"use client";

import { useEffect, useState } from "react";

/** Release the browser's file URL when a selection changes or the preview unmounts. */
export function LocalPhotoPreview({ file, className }: { file: File; className?: string }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img src={url} alt="" className={className} /> : null;
}
