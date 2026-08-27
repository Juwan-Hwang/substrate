# Substrate Publishing Protocol & Public Impact Confirmation

> The **Substrate Publishing Protocol** is a deterministic, atomic two-phase publication mechanism with built-in preview generation, public impact assessment, and cryptographic SHA-256 confirmation validation.

---

## 1. Motivation & Product Semantics

In modern multi-entity websites, publishing is rarely an isolated single-entity edit. Often, a publication event consists of:
* Publishing one or more drafts
* Updating relations and cross-links
* Changing entity visibility from private to public
* Archiving or soft-deleting outdated content

Publishing directly without previewing or assessing consequences risks unintentional data exposure. Substrate solves this through **Two-Phase Publication**.

---

## 2. Protocol Workflow

```text
1. ChangeSet Assembly:
   User groups domain operations (create, update, change_visibility, delete) into a ChangeSet.

2. Preview & Impact Assessment (Outside DB Transaction):
   - projectPreview(changeset) -> PreviewState
   - assessPublicImpact(preview) -> PublicImpactAssessment (newly exposed entities, changed public items)

3. SHA-256 Fingerprint Confirmation:
   - calculateAssessmentFingerprint(impact) -> 64-char SHA-256 hex
   - User reviews and confirms the impact with confirmation record.

4. Execution Phase (Inside Atomic Transaction):
   - executePublish(deps, changeset, principal, confirmation, commitWork)
   - Pre-write CAS snapshots if enabled
   - BEGIN DB TRANSACTION
   - Acquire exclusive row locks: SELECT ... FOR UPDATE
   - Reproject preview & re-assess impact inside lock
   - Verify confirmation fingerprint === current locked impact fingerprint
   - If mismatch -> ROLLBACK and abort with 'preview_mismatch'
   - Revalidate authorization inside lock
   - Execute all domain writes atomically
   - Record Snapshot reference & Publication Attempt
   - COMMIT DB TRANSACTION
```

---

## 3. Fingerprint Guarantee

```ts
export function calculateAssessmentFingerprint(assessment: PublicImpactAssessment): string {
  const normalized = {
    becomesPublic: assessment.becomesPublic,
    newlyExposed: [...(assessment.newlyExposedEntities ?? [])].sort(sortEntityRefs),
    modifiedPublic: [...(assessment.modifiedPublicEntities ?? [])].sort(sortEntityRefs),
    removedPublic: [...(assessment.removedPublicEntities ?? [])].sort(sortEntityRefs),
  };
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}
```

If any concurrent mutation occurs between the user's confirmation and final execution, the fingerprint recomputation detects the divergence and safely aborts the publication before any writes are committed.
