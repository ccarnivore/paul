<purpose>Review a plan for concrete architectural and delivery risks before execution.</purpose>

1. Load runtime context for the selected plan, the PLAN, applicable project constraints and audit configuration. Audit is optional unless configured or requested. Check the existing AUDIT's plan hash and findings; reuse resolved unchanged findings rather than generating the same report again. Recheck changed assumptions and dependencies.
2. Review six dimensions against actual scope: requirements/AC coverage; architecture and dependencies; data/security/privacy; implementation feasibility and failure handling; verification/observability; delivery/compatibility. For each, record concrete findings or a brief justified not-applicable result. Do not invent enterprise/compliance requirements.
3. Classify findings as must-have, strongly-recommended or can-safely-defer, with evidence, impact and precise remediation. Automatically apply must-have/strongly-recommended corrections within authorized planning scope. Material scope/architecture decisions need user input; retain deferred findings with rationale. Do not modify application code during a plan audit.
4. Save a concise `{id}-AUDIT.md` with stable finding IDs, reviewed/resulting plan hashes, six-dimension coverage, applied changes, unresolved findings and approval implications. Avoid repeating the full plan. If the plan changed, run plan-ready for that same still-planned plan; old approval hashes cease to apply. Record audit completion and remaining blockers in STATE without dropping unrelated rules.
5. Present material findings and corrected plan path. Route to approval/APPLY only if blockers are resolved and approval covers the resulting revision. Further unchanged audits should not repeatedly enlarge the plan.

## Extensions

<!-- Extension hooks may be appended here. -->
