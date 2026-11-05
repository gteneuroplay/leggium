import { avatarStyle, initials } from "@/lib/institutional-avatar";
import { cn } from "@/lib/utils";

export function InstitutionalAvatar({
  nome,
  size = 40,
  square = false,
  className,
}: {
  nome: string;
  size?: number;
  square?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-full border font-bold tracking-tight",
        square && "rounded-[9px]",
        className,
      )}
      style={avatarStyle(nome, size)}
    >
      {initials(nome)}
    </div>
  );
}
