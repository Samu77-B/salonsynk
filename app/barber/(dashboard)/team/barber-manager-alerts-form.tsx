"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateBarberManagerNotifications } from "@modules/barber/actions/team";

export function BarberManagerAlertsForm({
  initialDashboardAlerts,
  initialSmsAlerts,
  initialNotifyPhone,
}: {
  initialDashboardAlerts: boolean;
  initialSmsAlerts: boolean;
  initialNotifyPhone: string;
}) {
  const router = useRouter();
  const [dashboardAlerts, setDashboardAlerts] = useState(initialDashboardAlerts);
  const [smsAlerts, setSmsAlerts] = useState(initialSmsAlerts);
  const [notifyPhone, setNotifyPhone] = useState(initialNotifyPhone);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<"saved" | "error" | null>(null);
  const [errorText, setErrorText] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    const result = await updateBarberManagerNotifications({
      dashboardAlerts,
      smsAlerts,
      notifyPhone,
    });
    setLoading(false);
    if (result.error) {
      setErrorText(result.error);
      setMessage("error");
      return;
    }
    setMessage("saved");
    router.refresh();
  }

  return (
    <form
      id="alerts"
      onSubmit={handleSubmit}
      className="space-y-3 rounded border border-border p-4 scroll-mt-20"
    >
      <div>
        <p className="text-sm font-medium">Manager alerts</p>
        <p className="text-xs text-muted mt-1">
          Get notified when someone joins the queue or books for later. Turn each option on or off
          anytime.
        </p>
      </div>

      <label className="flex items-start gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          className="mt-1"
          checked={dashboardAlerts}
          onChange={(e) => setDashboardAlerts(e.target.checked)}
        />
        <span>
          <span className="font-medium">Sound &amp; banner on live queue</span>
          <span className="block text-xs text-muted mt-0.5">
            Plays a short chime and shows a banner when the live queue page is open.
          </span>
        </span>
      </label>

      <label className="flex items-start gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          className="mt-1"
          checked={smsAlerts}
          onChange={(e) => setSmsAlerts(e.target.checked)}
        />
        <span>
          <span className="font-medium">SMS me</span>
          <span className="block text-xs text-muted mt-0.5">
            Texts your phone even if the dashboard is closed. Uses your Twilio SMS setup.
          </span>
        </span>
      </label>

      <div>
        <label htmlFor="managerNotifyPhone" className="block text-xs text-muted mb-1">
          Alert mobile number
        </label>
        <input
          id="managerNotifyPhone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={notifyPhone}
          onChange={(e) => setNotifyPhone(e.target.value)}
          placeholder="07…"
          className="w-full rounded border border-border bg-canvas px-3 py-2 text-sm"
        />
        <p className="text-xs text-muted mt-1">Required when SMS alerts are on.</p>
      </div>

      {message === "saved" && <p className="text-sm text-green-400">Saved.</p>}
      {message === "error" && <p className="text-sm text-red-400">{errorText}</p>}
      <button
        type="submit"
        disabled={loading}
        className="rounded bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading ? "Saving…" : "Save alert settings"}
      </button>
    </form>
  );
}
