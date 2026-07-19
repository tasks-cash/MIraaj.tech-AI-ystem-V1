export interface SubmissionResult {
  ok: boolean;
  message: string;
}

export async function submitQuote(payload: Record<string, unknown>): Promise<SubmissionResult> {
  const endpoint = process.env.NEXT_PUBLIC_API_URL;
  if (!endpoint) {
    return {
      ok: false,
      message:
        "Online submission is not configured. Please use the published contact details.",
    };
  }
  try {
    const response = await fetch(`${endpoint.replace(/\/$/, "")}/quotes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
    return { ok: true, message: "Your request has been received." };
  } catch {
    return { ok: false, message: "We could not submit your request. Your details are still here—please try again." };
  }
}
