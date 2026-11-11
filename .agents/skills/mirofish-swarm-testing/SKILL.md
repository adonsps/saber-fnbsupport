---
name: mirofish-swarm-testing
description: >-
  Universal Swarm Intelligence & Multi-Agent App Testing skill powered by 666ghj/MiroFish (OASIS + GraphRAG).
  Use this skill whenever the user asks to test an app, simulate real users, stress-test workflows, predict UX drop-offs,
  run QA/UAT swarm simulations, inject "God's-eye view" chaos variables, or run MiroFish predictions across any project.
---

# MiroFish Swarm Intelligence & Multi-Agent App Testing Skill

This global skill adapts **[666ghj/MiroFish](https://github.com/666ghj/MiroFish)** (*"A Simple and Universal Swarm Intelligence Engine, Predicting Anything"*, built on CAMEL-AI OASIS and GraphRAG) into a universal **Multi-Agent Swarm QA, UAT & UX Prediction Engine** for all applications in your workspace.

Instead of testing an application with a single linear script, **MiroFish Swarm Testing** constructs a digital sandbox populated by diverse, autonomous user personas with independent personalities, memory, urgency levels, and behavioral logic—and lets you inject **"God's-eye view" variables** mid-simulation to uncover race conditions, state-machine bugs, and UX friction before real users hit them.

---

## When to Activate This Skill

Activate this skill whenever the user asks to:
- *"Test this app"*, *"test our app with MiroFish"*, *"simulate users on staging/local"*, or *"run UAT / QA testing"*
- Stress-test multi-actor workflows (e.g., Guest + Cashier + Kitchen + Admin interacting simultaneously)
- Predict user adoption, checkout drop-off, or public/customer sentiment after a feature change
- Run "What-If" / "God's-Eye View" chaos injections (e.g., sudden stock-out mid-checkout, store pause switch during peak hour, rejected payment proof, concurrent table QR scans)

---

## The 5-Stage MiroFish Swarm Testing Protocol

Whenever you test an application using this skill, execute all 5 stages in order:

### Stage 1: Seed Extraction & Domain Ontology Graph (`OntologyGenerator`)
Extract the target application's **Seed Material** (routes, Prisma/DB schema, API endpoints, state machines, and business rules) and define:
1. **10 Entity Types** (`8` domain-specific actor/resource types + `2` fallback types `Person` and `Organization` in `PascalCase`):
   - Example for F&B/Commerce: `WalkInDiner`, `PreOrderCustomer`, `DeliveryCustomer`, `CashierOperator`, `KitchenStaff`, `StoreOwner`, `AdversarialBot`, `WhatsAppGateway`, `Person`, `Organization`.
   - Example for HRIS/ERP/SaaS: `EmployeeUser`, `HrManager`, `FinanceApprover`, `VendorSupplier`, `SystemAdmin`, `MobileFieldWorker`, `Auditor`, `AdversarialActor`, `Person`, `Organization`.
2. **6–10 Interaction Edge Types** (`UPPER_SNAKE_CASE`):
   - e.g., `SCANS_TABLE_QR`, `SUBMITS_ORDER`, `AUDITS_STOCK`, `UPLOADS_PAYMENT_PROOF`, `VERIFIES_RECEIPT`, `PAUSES_STORE`, `MOVES_TABLE`.

### Stage 2: OASIS Persona Swarm Synthesis (`OasisProfileGenerator`)
Instantiate a swarm of concrete `OasisAgentProfile` test agents (`user_id`, `user_name`, `name`, `bio`, `persona`, `mbti`, `activity_level`, `sentiment_bias` `[-1.0, 1.0]`, `stance`, `response_delay_min/max`).
Always include these **6 Core Archetypes** in every app test run:
1. **The Hurried Mobile User** (`activity_level: 0.9`, impatient, mobile viewport, tests 1-click speed, tap targets `< 44px`, and autofill friction).
2. **The First-Time / Bilingual User** (`stance: "observer"`, toggles `ID | EN` language, inspects empty states, tests clarity of labels and instructions).
3. **The Edge-Case / Partial-Order Customer** (modifies quantities, requests special notes, tests mid-flow state mutations and recalculations).
4. **The High-Load Operator / Cashier / Admin** (processes multiple queues concurrently, audits stock, rejects blurry receipts, moves/merges sessions).
5. **The "God's-Eye View" Chaos Injector** (dynamically flips emergency switches like `isStoreOpen = false`, marks items `isSoldOut = true` while another agent is checking out, and triggers session resets).
6. **The Adversarial / Fuzzing Agent** (`sentiment_bias: -0.9`, submits invalid slugs, empty payloads, duplicate submissions, unauthorized state transitions, or malformed inputs).

### Stage 3: Parallel Multi-Agent Simulation & Variable Injection (`SimulationRunner`)
Execute the swarm against the target application URL (local dev server or live Staging URL):
- Run the executable swarm runner script:
  ```bash
  python3 ~/.gemini/config/skills/mirofish-swarm-testing/scripts/mirofish_swarm_test.py \
    --url "<TARGET_APP_URL>" \
    --mode auto \
    --rounds 3 \
    --concurrency 6 \
    --output-dir "/tmp/mirofish-report"
  ```
- During the simulation rounds, inject **God's-Eye View Perturbations** (state changes, stock toggles, store pause/resume, concurrent API mutations) and record every agent's action, HTTP status code, latency (`ms`), and state assertion in `actions.jsonl`.

### Stage 4: ReACT ReportAgent Synthesis (`ReportAgent`)
Follow MiroFish's ReACT (`Thought` $\rightarrow$ `PanoramaSearch / InsightForge` $\rightarrow$ `Observation` $\rightarrow$ `Reflection`) structure to generate a comprehensive **MiroFish Swarm QA & Prediction Report**:
1. **Swarm Panorama Summary**: Total agents, total actions executed, pass/fail rate, p50/p95 latency, and state-machine integrity score.
2. **God's-Eye View Variable Injection Results**: How the app behaved when emergency switches, stock-outs, or concurrent edits occurred mid-flight.
3. **Persona-by-Persona Trajectory & UX Friction Prediction**: Where specific user archetypes succeeded, hesitated, or encountered errors.
4. **Actionable Bug & UX Fix List**: Prioritized defects with exact file/route links.

### Stage 5: Post-Simulation Agent Interview (`AgentInterview`)
Include simulated **1-on-1 Persona Interviews** at the end of the report—answering from each persona's memory and action log:
- *"What felt fastest or most intuitive during your session?"*
- *"Where did you almost abandon the flow or get confused?"*
- *"What happened when the environment changed mid-transaction?"*

---

## Reference Documentation & Executable Scripts

- **Executable Universal Swarm Test Runner**: [scripts/mirofish_swarm_test.py](./scripts/mirofish_swarm_test.py)
- **MiroFish Architecture, Full-Stack Server & API Reference**: [references/mirofish-engine-reference.md](./references/mirofish-engine-reference.md)
