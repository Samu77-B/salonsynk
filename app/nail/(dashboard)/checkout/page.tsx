import { redirect } from "next/navigation";

export default function NailCheckoutRedirect() {
  redirect("/nail/queue");
}
