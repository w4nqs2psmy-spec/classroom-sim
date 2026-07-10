import { useT } from "./i18n";

export function DowntimeBadge() {
  const { t } = useT();
  return (
    <div className="downtime-badge">
      <span className="downtime-dot" />
      {t.downtimeBadge}
    </div>
  );
}
