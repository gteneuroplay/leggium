export function initials(nome: string): string {
  const parts = nome.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function hueOf(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
  return h;
}

export function avatarStyle(nome: string, size: number) {
  const h = hueOf(nome || "?");
  return {
    width: size,
    height: size,
    fontSize: size * 0.38,
    background: `linear-gradient(155deg, oklch(0.42 0.07 ${h}), oklch(0.30 0.05 ${h}))`,
    borderColor: `oklch(0.5 0.08 ${h} / 0.4)`,
    color: `oklch(0.92 0.04 ${h})`,
  } as const;
}
