"use client";

import type { CSSProperties } from "react";
import { BadgeInfo } from "lucide-react";
import {
  DynamicIcon,
  iconNames,
  type IconName,
} from "lucide-react/dynamic";

const lucideNames = new Set<string>(iconNames);

type DocsIconProps = {
  icon?: string | null;
  iconType?: string;
  size?: number;
  stroke?: number | string | boolean;
  strokeWidth?: number | string;
  className?: string;
  label?: string;
  style?: CSSProperties;
};

export function DocsIcon({
  className,
  icon,
  label,
  size = 18,
  stroke,
  strokeWidth,
  style,
}: DocsIconProps) {
  if (!icon) {
    return null;
  }

  if (isImageIcon(icon)) {
    return (
      <img
        alt={label ?? ""}
        aria-hidden={label ? undefined : true}
        className={className}
        height={size}
        src={icon}
        style={style}
        width={size}
      />
    );
  }

  const name = normalizeIconName(icon);
  const resolvedStroke = toStrokeWidth(strokeWidth ?? stroke);
  const accessibleProps = label
    ? { "aria-label": label }
    : { "aria-hidden": true as const };

  if (lucideNames.has(name)) {
    return (
      <DynamicIcon
        className={className}
        name={name as IconName}
        size={size}
        strokeWidth={resolvedStroke}
        style={style}
        {...accessibleProps}
      />
    );
  }

  return (
    <BadgeInfo
      className={className}
      size={size}
      strokeWidth={resolvedStroke}
      style={style}
      {...accessibleProps}
    />
  );
}

export function normalizeIconName(value: string) {
  return value
    .trim()
    .replace(/^lucide[:\s-]+/i, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}

function isImageIcon(value: string) {
  return /^(?:https?:|data:image\/|\/)/.test(value);
}

function toStrokeWidth(value?: number | string | boolean) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 2;
  }

  return value ? 2.5 : 2;
}
