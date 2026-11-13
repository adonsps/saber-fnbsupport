# 666ghj/MiroFish Engine Architecture & API Reference

Source Repository: `https://github.com/666ghj/MiroFish`

## 1. Core Overview
**MiroFish** is a multi-agent swarm intelligence and prediction engine built on **CAMEL-AI OASIS (Open Agent Social Interaction Simulations)** and **Zep GraphRAG**. It extracts entities and relationships from seed documents or system specifications, synthesizes autonomous agent personas (`OasisAgentProfile`), simulates parallel multi-agent interactions across temporal rounds (`TimeSimulationConfig`), and synthesizes findings via a ReACT `ReportAgent`.

---

## 2. Data Structures (`backend/app/services/`)

### 2.1 Ontology Definition (`ontology_generator.py`)
- **Entity Types (`entity_types`)**: Exactly 10 types in `PascalCase` — 8 domain-specific concrete actor types + 2 mandatory fallback types (`Person`, `Organization`).
- **Edge Types (`edge_types`)**: 6 to 10 interaction relationship types in `UPPER_SNAKE_CASE` with `source_targets` pairs.

### 2.2 OASIS Agent Profile (`oasis_profile_generator.py`)
```python
@dataclass
class OasisAgentProfile:
    user_id: int
    user_name: str
    name: str
    bio: str
    persona: str
    age: Optional[int] = None
    gender: Optional[str] = None
    mbti: Optional[str] = None
    country: Optional[str] = None
    profession: Optional[str] = None
    interested_topics: List[str] = field(default_factory=list)
    source_entity_uuid: Optional[str] = None
    source_entity_type: Optional[str] = None
```

### 2.3 Simulation Parameters & Temporal Multipliers (`simulation_config_generator.py`)
```python
@dataclass
class AgentActivityConfig:
    agent_id: int
    entity_uuid: str
    entity_name: str
    entity_type: str
    activity_level: float = 0.5       # 0.0 - 1.0
    posts_per_hour: float = 1.0
    comments_per_hour: float = 2.0
    active_hours: List[int] = field(default_factory=lambda: list(range(8, 23)))
    response_delay_min: int = 5
    response_delay_max: int = 60
    sentiment_bias: float = 0.0       # -1.0 (adversarial/critical) to +1.0 (supportive)
    stance: str = "neutral"           # supportive | opposing | neutral | observer
    influence_weight: float = 1.0
```
- **Temporal Activity Multipliers**:
  - `dead_hours` (`00:00–05:00`): `0.05x`
  - `morning_hours` (`06:00–08:00`): `0.40x`
  - `work_hours` (`09:00–18:00`): `0.70x`
  - `peak_hours` (`19:00–22:00`): `1.50x`
  - `night_hours` (`23:00`): `0.50x`

### 2.4 ReACT ReportAgent Tools (`report_agent.py` & `zep_tools.py`)
- **`insight_forge`**: Deep causal retrieval and sub-question decomposition across simulated agent actions.
- **`panorama_search`**: Broad sweep across all simulated rounds, statuses, and emergent anomalies.
- **`interview_agents`**: Direct 1-on-1 or batch interview of simulated personas using `INTERVIEW_PROMPT_PREFIX` to ask why an agent took a specific action or where they experienced friction.

---

## 3. Running Full MiroFish Web UI & Backend (Optional Standalone Server)

When running full social-media public opinion simulations with the MiroFish Vue3 Frontend (`:3000`) and Flask/OASIS Backend (`:5001`):

```bash
# Required .env variables:
# LLM_API_KEY=...
# LLM_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1 (or any OpenAI-compatible endpoint)
# LLM_MODEL_NAME=qwen-plus
# ZEP_API_KEY=...

# Docker Compose startup:
docker compose up -d
```

### Key REST Endpoints (`:5001`)
- `POST /api/graph/ontology/generate` — Upload seed files & simulation requirements to generate the 10-entity ontology.
- `POST /api/graph/build` — Build the GraphRAG knowledge graph from seed material.
- `POST /api/simulation/create` & `POST /api/simulation/prepare` — Generate `OasisAgentProfile` personas and `simulation_config.json`.
- `POST /api/simulation/start` — Launch parallel multi-agent simulation (`run_parallel_simulation.py`).
- `POST /api/simulation/interview` — Interview an individual agent or batch of agents mid- or post-simulation.
- `POST /api/report/generate` — Trigger the ReACT `ReportAgent` to produce the final prediction report.
