/**
 * Room number rendered as a brass key tag - the visual anchor of the app.
 * tone="muted" is used for rooms that are out of service.
 */
export function KeyTag({
  number,
  size = "md",
  tone = "brass",
}: {
  number: string;
  size?: "md" | "lg";
  tone?: "brass" | "muted";
}) {
  const classes = ["key-tag", size === "lg" ? "key-tag-lg" : "", tone === "muted" ? "key-tag-muted" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes}>
      <span className="sr-only">Chambre </span>
      {number}
    </span>
  );
}
