"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function SaleCountdown({ endsAt }: { endsAt: Date | string }) {
  const t = useTranslations("shop.product");
  const [remaining, setRemaining] = useState("");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const end = new Date(endsAt).getTime();
    const tick = () => {
      const diff = end - Date.now();
      if (diff <= 0 || diff > SEVEN_DAYS_MS) {
        setRemaining("");
        setVisible(false);
        return;
      }
      setVisible(true);
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      if (days > 0) {
        setRemaining(`${days}d ${hours}h`);
      } else {
        setRemaining(`${hours}h ${mins}m`);
      }
    };
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [endsAt]);

  if (!visible || !remaining) return null;

  return (
    <p className="text-sm text-amber-600 dark:text-amber-400">
      {t("saleEnds")}: {remaining}
    </p>
  );
}
