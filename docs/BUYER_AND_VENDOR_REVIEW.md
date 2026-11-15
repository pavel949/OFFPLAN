# Buyer evidence and developer-commissioned review

## Two different products

1. **Basic project review for buyers:** show public facts, source dates, recorded review dates, unanswered document questions and the limits of the evidence. A populated catalogue card is not a verified project. Missing public evidence is not proof of a legal violation or proof that the developer has no documents. Do not infer an overall grade or a purchase recommendation.
2. **Vendor due diligence:** a developer commissions a detailed independent examination for **49,000 THB**. Taxes, scope, third-party costs and delivery dates must be agreed before accepting an order. Payment buys work, never a favorable result. The commissioning developer must be disclosed alongside the reviewer and conclusions.

## Current implementation

`ProjectAssessment` accepts the public facts query for the exact project. It lists only published facts with safe source URLs. A recorded review requires valid nonfuture source/review dates in sequence. This is an editorial review record, not proof of independent legal validation or ongoing freshness.

Five document areas explain the question to ask and why it matters: land/seller rights, permits/construction, contract/payments, price/availability and ownership costs. A matching source link is displayed as a link whose contents have not been verified. It does not close any document requirement. The current data schema does not contain structured reviewed legal conclusions, so the component does not invent them.

The facts query propagates source-query failure. A load failure must not be presented as a factual absence of documentation.

### Integration

Import `ProjectAssessment` from `@/components/clearview/ProjectAssessment` into the buyer project page. Mount once with:

```tsx
<ProjectAssessment
  input={{
    projectId: extras.catalogProjectId,
    facts: facts.facts,
    sources: facts.sources,
    error: facts.error,
  }}
  lang={ru ? "ru" : "en"}
/>
```

Replace overlapping preliminary-review blocks rather than displaying two competing summaries. Preserve the original public source/evidence section if it provides additional detail. Do not feed private documents or developer-supplied legacy ratings into this component.

## Independent review process to implement next

The defined policy states are: not requested → scope agreed → collecting documents → independent review → awaiting clarification (when needed) → report ready → published. A publication may later expire or be withdrawn. These are policy definitions, not persisted current orders.

Before opening a real order, agree scope, price/tax terms, disclosure rules and reviewer eligibility. Assign reviewers separately from sales. Record and resolve conflicts of interest. Keep source documents private unless specifically authorized for publication. Let the developer correct factual errors without controlling the findings or suppressing adverse conclusions.

A public report requires the exact project identity, a safe public report URL, date and validity period, scope, findings, unresolved questions, limitations, reviewer identity, reviewed independence, commissioning-party disclosure and publication approval. The pure `canDisplayVendorReport` guard expresses this acceptance contract; it does not publish reports and is not yet connected to any report store. Only trusted reviewer-controlled records may eventually supply it.

## Deliberate boundaries

No order, payment, invoice, reviewer assignment, access grant, document upload, signed agreement, live publication or verified-project badge is created by this increment. The contact link opens the existing inquiry route. No assumption is made that a project has commissioned due diligence. Do not display “independently verified” from price/payment status, a developer claim or an opaque legacy badge.

Before real service launch, implement authorized persistence, role separation, review audit history, explicit public-report approval, report delivery, renewal/withdrawal handling and a buyer-visible report reader. Test those workflows with real roles before advertising online ordering.
