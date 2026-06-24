import { redirect } from "next/navigation";

export default function NailSettingsRedirect() {
  redirect("/nail/queue");
}
