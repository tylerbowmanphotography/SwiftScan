/**
 * Account deletion (required by the App Store for apps with sign-in, and a good idea anyway).
 * Removes everything stored for the signed-in email: user record, saved items, price alerts,
 * Pro entitlement (the Stripe subscription is canceled first), then signs the user out.
 */
import type { Express } from "express";
import { getStore } from "./db";
import { endSession, readSessionEmail } from "./auth";
import { endProForDeletedAccount } from "./monetization";

export async function deleteAccountData(email: string): Promise<void> {
  const s = getStore();
  if (!s) throw new Error("No database configured");
  await endProForDeletedAccount(email);
  await s.del(`alerts:${email}`);
  await s.srem("alerts:index", email);
  await s.del(`items:${email}`);
  await s.del(`user:${email}`);
}

export function registerAccountRoutes(app: Express) {
  app.post(["/api/account/delete", "/api/account/delete/"], async (req, res) => {
    const email = getStore() ? readSessionEmail(req) : null;
    if (!email) return res.status(401).json({ success: false, code: "SIGN_IN_REQUIRED", error: "Sign in to delete your account." });
    if (req.body?.confirm !== true) {
      return res.status(400).json({ success: false, error: "Confirm the deletion to continue." });
    }
    try {
      await deleteAccountData(email);
      endSession(req, res);
      return res.json({ success: true });
    } catch (err: any) {
      console.error("Account deletion failed:", err?.message || err);
      return res.status(500).json({
        success: false,
        error: "We couldn't delete your account right now. Please try again, or email us and we'll do it for you.",
      });
    }
  });
}
