import { Link } from "@/i18n/navigation";
import { ArrowLeft } from "lucide-react";

export function BackLink({ href, label }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft size={16} />
      {label ?? "Back"}
    </Link>
  );
}
