import { HTMLAttributes } from "react";

interface IconProps extends HTMLAttributes<HTMLElement> {
  name: string;
  solid?: boolean;
  regular?: boolean;
  light?: boolean;
  brand?: boolean;
  size?: "xs" | "sm" | "base" | "lg" | "xl" | "2xl";
  animated?: boolean;
}

const sizeMap = {
  xs: "text-xs",
  sm: "text-sm",
  base: "text-base",
  lg: "text-lg",
  xl: "text-xl",
  "2xl": "text-2xl",
};

export default function Icon({
  name,
  solid = true,
  regular = false,
  light = false,
  brand = false,
  size = "base",
  animated = false,
  className = "",
  ...props
}: IconProps) {
  let prefix = "fas"; // default to solid

  if (regular) prefix = "far";
  else if (light) prefix = "fal";
  else if (brand) prefix = "fab";

  const animationClass = animated ? "animate-spin" : "";
  const sizeClass = sizeMap[size];

  return (
    <i
      className={`${prefix} fa-${name} ${sizeClass} ${animationClass} ${className}`}
      {...props}
    />
  );
}
