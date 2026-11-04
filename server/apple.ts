/**
 * Apple In-App Purchase (StoreKit 2) verification.
 *
 * The iPhone app sends the signed transaction (JWS) StoreKit gives it after a purchase or restore.
 * We verify Apple's signature chain against Apple Root CA - G3 (no API keys needed), check it's
 * for our app and our Pro product, and record Pro for the signed-in account.
 * Renewals, billing problems, refunds and expirations arrive later as App Store Server
 * Notifications V2 (also signed by Apple) at POST /api/apple-notifications.
 */
import {
  Environment,
  SignedDataVerifier,
  type JWSRenewalInfoDecodedPayload,
  type JWSTransactionDecodedPayload,
  type ResponseBodyV2DecodedPayload,
} from "@apple/app-store-server-library";
import { clean } from "./util";

// Apple Root CA - G3 (DER, base64). SHA-256 fingerprint
// 63:34:3A:BF:B8:9A:6A:03:EB:B5:7E:9B:3F:5F:A7:BE:7C:4F:5C:75:6F:30:17:B3:A8:C4:88:C3:65:3E:91:79
// Source: https://www.apple.com/certificateauthority/AppleRootCA-G3.cer
const APPLE_ROOT_CA_G3 = "MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwSQXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9uIEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcNMTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2WjBnMRswGQYDVQQDDBJBcHBsZSBSb290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9yaXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqGSM49AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtfTjjTuxxEtX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517IDvYuVTZXpmkOlEKMaNCMEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySrMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2gAMGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3meoyhpmvOwgPUnPWTxnS4at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkLF1vLUagM6BgD56KyKA==";

export const appleBundleId = () => clean(process.env.APPLE_BUNDLE_ID) || "store.swiftscan.app";
export const appleAppId = () => Number(clean(process.env.APPLE_APP_ID)) || 6823987573;
/** Product IDs that unlock Pro. Must match the subscription created in App Store Connect. */
export const appleProProductIds = () =>
  (clean(process.env.APPLE_PRO_PRODUCT_IDS) || "store.swiftscan.app.pro.monthly").split(/[,\s]+/).filter(Boolean);

export interface AppleVerifier {
  transaction(jws: string): Promise<{ tx: JWSTransactionDecodedPayload; environment: string }>;
  notification(signedPayload: string): Promise<ResponseBodyV2DecodedPayload>;
  renewal(signedRenewalInfo: string): Promise<JWSRenewalInfoDecodedPayload>;
}

function realVerifier(): AppleVerifier {
  const roots = [Buffer.from(APPLE_ROOT_CA_G3, "base64")];
  // Production first, then Sandbox (TestFlight and App Review purchase in Sandbox).
  const verifiers: [string, SignedDataVerifier][] = [
    ["Production", new SignedDataVerifier(roots, true, Environment.PRODUCTION, appleBundleId(), appleAppId())],
    ["Sandbox", new SignedDataVerifier(roots, true, Environment.SANDBOX, appleBundleId())],
  ];
  const tryAll = async <T>(fn: (v: SignedDataVerifier) => Promise<T>): Promise<[T, string]> => {
    let last: any;
    for (const [env, v] of verifiers) {
      try {
        return [await fn(v), env];
      } catch (err) {
        last = err;
      }
    }
    throw last || new Error("Apple signature verification failed");
  };
  return {
    async transaction(jws) {
      const [tx, environment] = await tryAll((v) => v.verifyAndDecodeTransaction(jws));
      return { tx, environment };
    },
    async notification(signedPayload) {
      const [n] = await tryAll((v) => v.verifyAndDecodeNotification(signedPayload));
      return n;
    },
    async renewal(signedRenewalInfo) {
      const [r] = await tryAll((v) => v.verifyAndDecodeRenewalInfo(signedRenewalInfo));
      return r;
    },
  };
}

let override: AppleVerifier | null = null;
let cached: AppleVerifier | null = null;
export function setAppleVerifierForTests(v: AppleVerifier | null) {
  override = v;
}
export function getAppleVerifier(): AppleVerifier {
  if (override) return override;
  return (cached ||= realVerifier());
}

/** Pro status a verified Apple transaction gives right now. */
export function appleTxStatus(tx: JWSTransactionDecodedPayload, now = Date.now()): { active: boolean; periodEnd?: number; reason?: string } {
  if (tx.bundleId && tx.bundleId !== appleBundleId()) return { active: false, reason: "wrong app" };
  if (!tx.productId || !appleProProductIds().includes(tx.productId)) return { active: false, reason: "not a Pro product" };
  if (tx.revocationDate) return { active: false, periodEnd: tx.expiresDate, reason: "refunded or revoked" };
  if (!tx.expiresDate) return { active: false, reason: "no expiry" };
  return tx.expiresDate > now ? { active: true, periodEnd: tx.expiresDate } : { active: false, periodEnd: tx.expiresDate, reason: "expired" };
}
