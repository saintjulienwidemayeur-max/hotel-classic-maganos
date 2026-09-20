import { IconCheck } from "@/components/icons";
import { translator, type Lang, type MessageKey } from "@/lib/i18n";

/** Success banner shown after a redirect (e.g. /stays?notice=created). */
const MESSAGES: Record<string, MessageKey> = {
  created: "stays.notice.created",
  updated: "stays.notice.updated",
};

export function Notice({ code, lang = "fr" }: { code?: string; lang?: Lang }) {
  const key = code ? MESSAGES[code] : undefined;
  if (!key) return null;

  return (
    <div
      role="status"
      className="mb-4 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900"
    >
      <IconCheck width={16} height={16} />
      {translator(lang)(key)}
    </div>
  );
}
