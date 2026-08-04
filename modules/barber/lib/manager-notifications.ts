import type { SupabaseClient } from "@supabase/supabase-js";
import { canSendSms } from "@core/utils/sms";
import { sendBarberQueueSms } from "./queue-sms";
import { managerAlertSmsBody, type ManagerAlertKind } from "./queue-sms-messages";

export type BarberManagerNotificationSettings = {
  dashboardAlerts: boolean;
  smsAlerts: boolean;
  notifyPhone: string;
};

export function parseManagerNotificationSettings(
  settings: Record<string, unknown> | null | undefined
): BarberManagerNotificationSettings {
  const raw = (settings?.manager_notifications as Record<string, unknown> | undefined) ?? {};
  return {
    dashboardAlerts: raw.dashboard_alerts !== false,
    smsAlerts: raw.sms_alerts === true,
    notifyPhone: typeof raw.notify_phone === "string" ? raw.notify_phone.trim() : "",
  };
}

/** SMS the shop's configured manager number when a public join/book happens. */
export async function notifyBarberManagerBySms(opts: {
  supabase: SupabaseClient;
  shopId: string;
  shopName: string;
  kind: ManagerAlertKind;
  guestName: string;
  detail?: string | null;
  /** Pass shop settings if already loaded to avoid an extra query. */
  settings?: Record<string, unknown> | null;
}): Promise<void> {
  if (!canSendSms()) return;

  let settings = opts.settings ?? null;
  if (!settings) {
    const { data: shop } = await opts.supabase
      .from("barber_shops")
      .select("settings")
      .eq("id", opts.shopId)
      .maybeSingle();
    settings = (shop?.settings as Record<string, unknown>) ?? null;
  }

  const prefs = parseManagerNotificationSettings(settings);
  if (!prefs.smsAlerts || !prefs.notifyPhone) return;

  const body = managerAlertSmsBody({
    kind: opts.kind,
    shopName: opts.shopName,
    guestName: opts.guestName,
    detail: opts.detail,
  });
  await sendBarberQueueSms(prefs.notifyPhone, body);
}
