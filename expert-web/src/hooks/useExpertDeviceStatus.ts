"use client";

import { useEffect, useState } from "react";

export type ExpertNetworkChip = {
  label: string;
  tone: "good" | "ok" | "bad" | "unknown";
};

export type ExpertBatteryChip = {
  label: string;
  percent: number | null;
  charging: boolean | null;
  tone: "good" | "ok" | "bad" | "unknown";
};

type NavigatorConnection = {
  downlink?: number;
  effectiveType?: string;
  rtt?: number;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
};

type BatteryManager = {
  level: number;
  charging: boolean;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
};

function networkFromNavigator(): ExpertNetworkChip {
  if (typeof navigator === "undefined") {
    return { label: "Network —", tone: "unknown" };
  }
  if (!navigator.onLine) {
    return { label: "Offline", tone: "bad" };
  }

  const conn = (
    navigator as Navigator & {
      connection?: NavigatorConnection;
      mozConnection?: NavigatorConnection;
      webkitConnection?: NavigatorConnection;
    }
  ).connection ||
    (navigator as Navigator & { mozConnection?: NavigatorConnection }).mozConnection ||
    (navigator as Navigator & { webkitConnection?: NavigatorConnection })
      .webkitConnection;

  if (!conn) {
    return { label: "Online", tone: "good" };
  }

  const type = (conn.effectiveType ?? "").toLowerCase();
  const rtt = conn.rtt ?? 0;
  if (type === "4g" || (rtt > 0 && rtt < 100)) {
    return { label: "Excellent", tone: "good" };
  }
  if (type === "3g" || (rtt >= 100 && rtt < 300)) {
    return { label: "Good", tone: "ok" };
  }
  if (type === "2g" || type === "slow-2g" || rtt >= 300) {
    return { label: "Weak", tone: "bad" };
  }
  return { label: "Online", tone: "good" };
}

function batteryTone(percent: number, charging: boolean): ExpertBatteryChip["tone"] {
  if (charging) return "good";
  if (percent <= 15) return "bad";
  if (percent <= 30) return "ok";
  return "good";
}

/** Expert browser battery + network chips for the Active Session card. */
export function useExpertDeviceStatus() {
  const [network, setNetwork] = useState<ExpertNetworkChip>({
    label: "—",
    tone: "unknown",
  });
  const [battery, setBattery] = useState<ExpertBatteryChip>({
    label: "Battery —",
    percent: null,
    charging: null,
    tone: "unknown",
  });

  useEffect(() => {
    const refreshNetwork = () => setNetwork(networkFromNavigator());
    refreshNetwork();

    window.addEventListener("online", refreshNetwork);
    window.addEventListener("offline", refreshNetwork);

    const conn = (
      navigator as Navigator & { connection?: NavigatorConnection }
    ).connection;
    conn?.addEventListener?.("change", refreshNetwork);

    return () => {
      window.removeEventListener("online", refreshNetwork);
      window.removeEventListener("offline", refreshNetwork);
      conn?.removeEventListener?.("change", refreshNetwork);
    };
  }, []);

  useEffect(() => {
    let batteryRef: BatteryManager | null = null;
    let cancelled = false;

    const syncBattery = () => {
      if (!batteryRef || cancelled) return;
      const percent = Math.round(batteryRef.level * 100);
      const charging = batteryRef.charging;
      setBattery({
        percent,
        charging,
        tone: batteryTone(percent, charging),
        label: charging ? `${percent}% charging` : `${percent}%`,
      });
    };

    const nav = navigator as Navigator & {
      getBattery?: () => Promise<BatteryManager>;
    };

    if (!nav.getBattery) {
      setBattery({
        label: "Battery n/a",
        percent: null,
        charging: null,
        tone: "unknown",
      });
      return;
    }

    void nav
      .getBattery()
      .then((mgr) => {
        if (cancelled) return;
        batteryRef = mgr;
        syncBattery();
        mgr.addEventListener("levelchange", syncBattery);
        mgr.addEventListener("chargingchange", syncBattery);
      })
      .catch(() => {
        if (!cancelled) {
          setBattery({
            label: "Battery n/a",
            percent: null,
            charging: null,
            tone: "unknown",
          });
        }
      });

    return () => {
      cancelled = true;
      if (batteryRef) {
        batteryRef.removeEventListener("levelchange", syncBattery);
        batteryRef.removeEventListener("chargingchange", syncBattery);
      }
    };
  }, []);

  return { network, battery };
}
