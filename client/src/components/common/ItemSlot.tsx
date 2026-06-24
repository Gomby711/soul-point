import { useState, useEffect } from "react";
import { getItemImage } from "@/api/client";

interface ItemSlotProps {
  itemId: number;
  size?: number;
}

export function ItemSlot({ itemId, size = 32 }: ItemSlotProps) {
  const [imgSrc, setImgSrc] = useState<string>("");

  useEffect(() => {
    if (!itemId) return;
    getItemImage(itemId).then(setImgSrc);
  }, [itemId]);

  if (!itemId) {
    return (
      <div
        className="relative shrink-0 bg-[#0A1428] rounded-sm border border-[#1E2D3D]"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div className="relative group shrink-0" style={{ width: size, height: size }}>
      <div className="absolute inset-0 bg-[#0A1428] rounded-sm border border-[#1E2D3D]" />
      {imgSrc && (
        <img
          src={imgSrc}
          alt={`Item ${itemId}`}
          width={size}
          height={size}
          className="relative z-10 rounded-sm"
          onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      )}
    </div>
  );
}
