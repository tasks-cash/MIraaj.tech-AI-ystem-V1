
import { redirect } from "next/navigation";

export default async function QRedirect({ params }: { params: Promise<{ publicCode: string }> }) {
  const { publicCode } = await params;
  redirect(`/p/${publicCode}`);
}
