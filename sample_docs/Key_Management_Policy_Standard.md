# Key Management Policy Standard
**Company:** [Company Name]  
**Version:** 1.0  
**Status:** Draft/Approved  
**Effective Date:** 2026-01-16  
**Owner:** Security / Information Security  
**Applies To:** All employees, contractors, applications, services, infrastructure, and third parties that create, store, use, or manage cryptographic keys for [Company Name].

---

## 1. Purpose
This policy establishes minimum requirements for **cryptographic key management** across the organization. It standardizes how keys are:
- Generated
- Distributed/established
- Stored and protected
- Rotated and retired/destroyed
- Audited and accounted for
- Recovered after compromise (including zeroization)

The goal is to prevent unauthorized access to key material, reduce exposure time of plaintext keys, and ensure recoverability and compliance.

---

## 2. Scope
This policy applies to:
- **Symmetric keys** (e.g., encryption, MAC/HMAC, wrapping)
- **Asymmetric keys** (e.g., signing, TLS private keys, key agreement)
- **Key wrapping / envelope encryption keys** (KEKs and DEKs)
- **Certificates and trust anchors** (trust stores)
- Keys used in production, staging, development, and test environments

**Passwords** are not considered “cryptographic keys” for the purposes of this policy and must follow the company’s Password Storage / Authentication Standards.

---

## 3. Definitions
- **Key lifecycle:** Generation → Distribution/Establishment → Storage → Operational Use → Rotation/Update → Revocation/De-registration → Destruction → (Backup/Recovery as applicable)
- **DEK (Data Encryption Key):** encrypts application data
- **KEK (Key Encryption Key / wrapping key):** encrypts (wraps) other keys
- **Zeroization:** clearing key material from memory/storage to prevent recovery
- **Trust store:** managed store of trusted certificates/roots/anchors

---

## 4. Core Principles (Non‑Negotiables)
1. **Document and harmonize** key management rules across teams and systems.
2. **Map key flows**: identify all components that store/process key material and reduce key exposure points.
3. **Single-purpose keys**: do not reuse a key for multiple functions (e.g., encryption + signing).
4. **Least privilege & separation of duties**: grant only the minimum key permissions needed.
5. **Minimize plaintext key exposure**: keep keys encrypted at rest and limit plaintext presence to memory only when needed.
6. **Prefer managed cryptographic services** (KMS/HSM) for key storage and cryptographic operations.

---

## 5. Roles & Responsibilities
- **Security (Policy Owner):** sets standards, approves exceptions, reviews audits, owns compromise playbooks.
- **System Owner:** maintains key inventory for their services, ensures compliance, coordinates rotations and incident response.
- **KMS/HSM Administrators (Platform):** operate key services, enforce access controls, rotation tooling, logging, and monitoring.
- **Developers:** must use approved crypto/KMS APIs and must not hardcode, export, or directly handle raw key material.

---

## 6. Key Inventory & Classification
Each key (or logical key set) MUST have an inventory record containing:
- Key ID / alias (not key material)
- Purpose (encryption, signing, wrapping, etc.)
- Owner and backup owner
- Environment (dev/stage/prod) and data classification impact
- Allowed operations (encrypt, decrypt, sign, verify, wrap, unwrap)
- Storage location (KMS/HSM/vault)
- Creation date and rotation cadence
- Dependencies (services, data stores, certificates, applications)
- Recovery requirements (is the key needed to decrypt long-term data?)

---

## 7. Key Usage Requirements
### 7.1 General
- Use keys only for their designated purpose (no cross-use).
- Prefer **envelope encryption**:
  - DEKs encrypt data
  - KEKs in KMS/HSM wrap/unwrap DEKs

### 7.2 Algorithm & Strength Selection
- Cryptographic choices MUST be based on the application’s security objectives (data at rest, data in transit, integrity, authenticity).
- Key strength MUST be appropriate for the data sensitivity and expected lifetime.
- A KEK used to wrap keys MUST be **equal or stronger** than the keys being wrapped.

> Implementation teams may maintain a separate “Approved Cryptography Baseline” document with exact algorithms/cipher suites.

---

## 8. Cryptographic Module Requirements
- Keys SHOULD be generated, stored, and used within approved cryptographic modules/services (e.g., HSM, cloud KMS).
- Where compliance requires it, cryptographic modules MUST be **FIPS 140-2 or FIPS 140-3 validated** (or an approved equivalent).
- Key generation MUST use strong, approved randomness sources (CSPRNG) and appropriate parameter sizes.

---

## 9. Key Management Lifecycle Controls

### 9.1 Generation
- Keys MUST be generated using approved cryptographic services/modules.
- Keys MUST NOT be derived from predictable values (usernames, hostnames, timestamps, etc.).
- Keys MUST be unique per environment (no dev/prod reuse).
- Private keys SHOULD be non-exportable wherever possible (HSM/KMS-backed).

### 9.2 Distribution / Establishment
- Keys MUST NOT be transmitted in plaintext.
- Use secure key establishment methods (e.g., protocols with authenticated key exchange) and mutually authenticated secure channels for any key transport.
- Imported keys (if allowed) MUST be imported into the approved KMS/HSM and then removed from all transient locations.

### 9.3 Storage
- Keys MUST NOT be stored in plaintext on disk, in source control, CI variables, tickets, docs, chat, or container images.
- Keys MUST be stored in an approved KMS/HSM or vault with:
  - Strong access control
  - Audit logging
  - Encryption at rest
  - Integrity protections for stored/wrapped keys
- When keys must be exported (exception-only), they MUST be wrapped with a KEK that is equal or stronger, and exports must be encrypted and access-controlled.

### 9.4 Escrow & Backup
- Keys required to decrypt long-term data MUST have a defined backup and recovery approach.
- Backups MUST be encrypted, access-controlled, and tested.
- Signature private keys SHOULD NOT be escrowed except where explicitly required and approved; use controlled recovery procedures instead.

### 9.5 Accountability & Audit
- All key usage and administrative operations MUST be logged:
  - Key ID / alias, operation type (encrypt/decrypt/sign/wrap/etc.), calling identity, timestamp, success/failure
- Logs MUST be protected from tampering and retained per retention policy.
- Access reviews MUST occur on a scheduled cadence and during significant role/team/vendor changes.

### 9.6 Key Compromise & Recovery
If compromise is suspected or confirmed:
1. **Contain:** revoke/disable affected identities and key permissions immediately.
2. **Rotate:** replace compromised keys, rotate dependent keys/tokens, and update services.
3. **Invalidate:** reissue certificates/credentials as needed; invalidate sessions/tokens.
4. **Assess re-encryption:** determine whether encrypted data must be re-encrypted based on exposure and key hierarchy.
5. **Investigate:** use audit logs to determine scope and timeline.
6. **Zeroize:** remove key material from compromised systems and ensure it is not present in logs, backups, or artifacts.

---

## 10. Rotation, Revocation, and Destruction
### 10.1 Rotation
- Keys MUST be rotated:
  - On a schedule proportional to risk
  - Immediately upon suspected compromise
  - On major personnel/vendor changes where access scope could include keys
- Prefer automated rotation (KMS rotation, cert automation).

### 10.2 Revocation / De-registration
- Keys MUST be revocable (or effectively disabled) through access control changes, key state transitions, or trust-store updates (for certificates).
- Revoked keys MUST not be usable by applications except where explicitly required for decrypting historical data under controlled procedures.

### 10.3 Destruction
- Keys no longer required MUST be securely destroyed in the KMS/HSM and removed from all backups/artifacts where feasible.
- Destruction events MUST be logged and recorded in the inventory.

---

## 11. Trust Stores (Certificates / Roots)
- Trust stores MUST be centrally managed and controlled.
- Changes to trust anchors (roots/intermediates) MUST follow change control and be auditable.
- Certificate issuance and renewal SHOULD be automated; private keys should be generated and stored in approved cryptographic services where possible.

---

## 12. Development & CI/CD Requirements
- Developers MUST NOT hardcode keys or store key material in repositories.
- CI/CD MUST integrate with KMS/vault systems and avoid exposing key material to build logs.
- Non-production environments MUST use non-production keys with restricted permissions.
- Secret scanning and policy checks SHOULD be enabled to detect key material in commits/artifacts.

---

## 13. Third Parties & Vendors
Vendors handling company keys or performing cryptographic operations MUST:
- Provide equivalent or stronger key management controls (including auditability and rotation support)
- Support incident notification and rapid key rotation
- Document key custody and responsibility model

---

## 14. Exceptions
Any deviation requires a documented exception including:
- Business justification and scope
- Compensating controls
- Risk acceptance owner
- Expiration date
Exceptions MUST be reviewed at least every 6 months.

---

## 15. Enforcement
Violations may result in:
- Immediate key access revocation
- Required remediation work
- Security review
- Disciplinary action per HR policy

---

## 16. References
- OWASP Cheat Sheet Series: Key Management Cheat Sheet  
  https://cheatsheetseries.owasp.org/cheatsheets/Key_Management_Cheat_Sheet.html

---

## Appendix A — Quick Checklist
- [ ] Key inventory exists and is current (owners, purpose, lifecycle, rotation)
- [ ] Keys generated and stored in approved KMS/HSM/vault
- [ ] No plaintext keys in repos, images, tickets, docs, chat, or logs
- [ ] Least privilege enforced; access reviewed regularly
- [ ] Rotation automated where possible; compromise playbook documented
- [ ] Key operations and admin actions logged and retained
- [ ] Trust stores centrally managed and changes controlled
