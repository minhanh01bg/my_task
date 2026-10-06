import { redirect } from "next/navigation";

export default function CustomerAccountPage() {
  redirect("/account/orders");
}
