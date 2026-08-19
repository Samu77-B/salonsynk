import type { CSSProperties } from "react";

/** Shared offer line for marketing homepages and signup. */
export function FirstMonthFree({
  className = "",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <p className={`text-sm font-semibold tracking-wide ${className}`} style={style}>
      First Month Free
    </p>
  );
}
