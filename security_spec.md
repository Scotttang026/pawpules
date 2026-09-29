# Security Specification & Threat Model: PawPulse

## 1. Data Invariants
1. **Case Integrity**: A case must possess an ID matching `^[a-zA-Z0-9_\\-]+$` with valid triage urgency (`P0`, `P1`, `P2`) and animal type.
2. **Reporter Privacy**: Public case listings do not allow arbitrary users to tamper with reporter phone or email once created.
3. **Role Enforcement**: Normal citizens cannot promote themselves to admins. Admin privilege requires document existence in `/admins/$(request.auth.uid)` or verified admin email `scotttang026jp@gmail.com`.
4. **State Transition Protection**: Case status must only be modified by assigned NGO rescuers or verified platform administrators.
5. **Payload Bound**: All string fields have strict `.size()` upper bounds to guard against denial of wallet / storage exhaustion.
6. **NGO Verification**: NGO capacity and verification statuses cannot be spoofed by unauthenticated clients.

## 2. The Dirty Dozen Payloads (Designed to Fail)
1. **Payload 1 (Ghost Field / Privilege Escalation)**: Creating a case with `{ role: "admin", isAdmin: true }`
2. **Payload 2 (ID Poisoning)**: Document path with 2KB string `cases/$$$junk$$$overflow...`
3. **Payload 3 (Unchecked Status Override)**: Anonymous user attempting `UPDATE /cases/case-123` with `{ status: "rescued" }` without authorization.
4. **Payload 4 (Massive Denial of Wallet String)**: Description exceeding 100,000 characters to bloat database storage.
5. **Payload 5 (Invalid Urgency Injection)**: Triage level set to `"P99"` or `"UNKNOWN"`.
6. **Payload 6 (Admin Self-Creation)**: Regular user writing to `/admins/attacker_uid` with `{ role: "admin" }`.
7. **Payload 7 (NGO Impersonation)**: Unauthenticated user modifying `/ngos/spca_hk` to set `capacityStatus: "full"`.
8. **Payload 8 (Malformed Enum)**: `animalType: "dinosaur"`.
9. **Payload 9 (Reporter Email Spoofing)**: Submitting non-string or 20KB email address.
10. **Payload 10 (Terminal State Tampering)**: Attempting to rewrite status of an already `closed` case without admin rights.
11. **Payload 11 (Empty ID)**: Creating document with blank string ID.
12. **Payload 12 (Shadow Update)**: Updating case with unknown system telemetry fields `{ __internalToken: "leak" }`.

## 3. Test Runner
Verified against Firestore Security Rules using unit tests and ABAC enforcement.
