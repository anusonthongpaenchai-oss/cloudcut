import React, { useEffect, useRef } from "react";
import type { CursorPosition } from "./usePresence.js";

interface RemoteCursorsProps {
  cursors: Record<string, CursorPosition>;
  timelineWidth: number;
  totalDurationMs: number;
}

// Generate consistent colors based on userId
const getColorForUser = (userId: string) => {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = hash % 360;
  return `hsl(${hue}, 70%, 50%)`;
};

export const RemoteCursors: React.FC<RemoteCursorsProps> = ({
  cursors,
  timelineWidth,
  totalDurationMs,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Use requestAnimationFrame for smooth cursor rendering
  useEffect(() => {
    let animationFrameId: number;

    const renderLoop = () => {
      if (containerRef.current && totalDurationMs > 0) {
        Object.entries(cursors).forEach(([userId, cursor]) => {
          const cursorElement = document.getElementById(`remote-cursor-${userId}`);
          if (cursorElement) {
            const ratio = cursor.currentTimeMs / totalDurationMs;
            const xPos = Math.max(0, Math.min(timelineWidth, ratio * timelineWidth));
            cursorElement.style.transform = `translateX(${xPos}px)`;
          }
        });
      }
      animationFrameId = requestAnimationFrame(renderLoop);
    };

    renderLoop();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [cursors, timelineWidth, totalDurationMs]);

  if (totalDurationMs <= 0) return null;

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 z-50 overflow-hidden"
    >
      {Object.values(cursors).map((cursor) => {
        const color = getColorForUser(cursor.userId);
        return (
          <div
            key={cursor.userId}
            id={`remote-cursor-${cursor.userId}`}
            className="absolute top-0 bottom-0 flex flex-col items-center w-px transition-transform duration-100 ease-linear"
            style={{
              backgroundColor: color,
              // Will be overridden by requestAnimationFrame for smoothness,
              // but provides a fallback starting position.
              transform: `translateX(${(cursor.currentTimeMs / totalDurationMs) * timelineWidth}px)`,
            }}
          >
            {/* Cursor Handle & Name */}
            <div
              className="absolute -top-6 rounded px-2 py-1 text-xs font-semibold text-white whitespace-nowrap shadow"
              style={{ backgroundColor: color }}
            >
              {cursor.name}
              <div
                className="absolute bottom-[-4px] left-1/2 h-2 w-2 -translate-x-1/2 rotate-45"
                style={{ backgroundColor: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
