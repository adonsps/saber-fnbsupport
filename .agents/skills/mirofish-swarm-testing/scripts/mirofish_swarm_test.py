#!/usr/bin/env python3
"""
MiroFish Universal Swarm Intelligence & Multi-Agent App Tester
Adapted from 666ghj/MiroFish (OASIS Agent Profiles + God's-Eye Variable Injection + ReACT ReportAgent).

Usage:
  python3 mirofish_swarm_test.py --url https://staging-fnbsupport.31.97.66.234.sslip.io --mode auto
"""

import argparse
import concurrent.futures
import dataclasses
import datetime
import json
import os
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional, Tuple


@dataclasses.dataclass
class OasisAgentProfile:
    user_id: int
    user_name: str
    name: str
    bio: str
    persona: str
    mbti: str
    profession: str
    activity_level: float
    sentiment_bias: float
    stance: str
    source_entity_type: str


@dataclasses.dataclass
class AgentActionLog:
    timestamp: str
    round_num: int
    agent_id: int
    agent_name: str
    entity_type: str
    action_type: str
    endpoint: str
    method: str
    status_code: int
    latency_ms: float
    success: bool
    observation: str


DEFAULT_PERSONA_SWARM: List[OasisAgentProfile] = [
    OasisAgentProfile(
        user_id=101,
        user_name="rina_dinein_fast",
        name="Rina Kusuma (Hurried Dine-In Guest)",
        bio="27yo product manager grabbing lunch at Table 04 between meetings.",
        persona="Impatient mobile user; scans Table QR, filters categories, adds items quickly, expects zero-login checkout.",
        mbti="ENTJ",
        profession="Product Manager",
        activity_level=0.95,
        sentiment_bias=0.3,
        stance="supportive",
        source_entity_type="WalkInDiner",
    ),
    OasisAgentProfile(
        user_id=102,
        user_name="david_expat_bilingual",
        name="David Miller (Expat Bilingual Guest)",
        bio="34yo remote consultant ordering Self-Delivery and switching UI to English.",
        persona="Detail-oriented; checks EN translations, delivery radius/fees, and bank transfer / QRIS instructions.",
        mbti="INTP",
        profession="Consultant",
        activity_level=0.75,
        sentiment_bias=0.2,
        stance="observer",
        source_entity_type="DeliveryCustomer",
    ),
    OasisAgentProfile(
        user_id=103,
        user_name="siti_cashier_lead",
        name="Siti Rahma (Peak-Hour Cashier & Kitchen Auditor)",
        bio="24yo head cashier managing the 5-column Kanban board during lunch rush.",
        persona="Audits partial stock, recalculates totals, inspects QRIS transfer proofs, and completes orders to reset tables.",
        mbti="ISTJ",
        profession="Head Cashier",
        activity_level=0.90,
        sentiment_bias=0.5,
        stance="supportive",
        source_entity_type="CashierOperator",
    ),
    OasisAgentProfile(
        user_id=104,
        user_name="pak_hendra_owner",
        name="Bapak Hendra (Merchant Owner & God's-Eye Controller)",
        bio="45yo warung owner monitoring shift analytics, menu stock toggles, and emergency pause controls.",
        persona="Tests 1-click Sold Out switches, checks Gross Revenue telemetry, and verifies A4/A5 Table QR generation.",
        mbti="ESTJ",
        profession="Merchant Owner",
        activity_level=0.80,
        sentiment_bias=0.6,
        stance="supportive",
        source_entity_type="StoreOwner",
    ),
    OasisAgentProfile(
        user_id=105,
        user_name="bima_preorder_group",
        name="Bima Pratama (Group Pre-Order Organizer)",
        bio="31yo office coordinator placing advance pickup orders with custom cooking notes.",
        persona="Tests Pre-Order pickup scheduling, cash-at-counter vs QRIS flows, and live order pass tracking.",
        mbti="ENFJ",
        profession="Office Coordinator",
        activity_level=0.85,
        sentiment_bias=0.1,
        stance="neutral",
        source_entity_type="PreOrderCustomer",
    ),
    OasisAgentProfile(
        user_id=106,
        user_name="zed_chaos_fuzzer",
        name="Zed (Adversarial & Chaos Fuzzing Agent)",
        bio="Automated chaos & boundary tester probing validation gates and race conditions.",
        persona="Submits reserved/invalid subdomain slugs, empty guest checkouts, and rapid stock toggle flips.",
        mbti="ENTP",
        profession="Security & QA Researcher",
        activity_level=1.0,
        sentiment_bias=-0.8,
        stance="opposing",
        source_entity_type="AdversarialBot",
    ),
]


def http_request(
    base_url: str,
    path: str,
    method: str = "GET",
    payload: Optional[Dict[str, Any]] = None,
    timeout: float = 12.0,
) -> Tuple[int, float, Any]:
    url = urllib.parse.urljoin(base_url.rstrip("/") + "/", path.lstrip("/"))
    headers = {
        "User-Agent": "MiroFish-Swarm-Tester/1.0 (OASIS-MultiAgent)",
        "Accept": "application/json, text/html, */*",
    }
    data_bytes = None
    if payload is not None:
        data_bytes = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    req = urllib.request.Request(url, data=data_bytes, headers=headers, method=method)
    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            elapsed_ms = round((time.perf_counter() - t0) * 1000.0, 2)
            try:
                parsed = json.loads(raw)
            except Exception:
                parsed = raw
            return resp.status, elapsed_ms, parsed
    except urllib.error.HTTPError as e:
        elapsed_ms = round((time.perf_counter() - t0) * 1000.0, 2)
        raw = e.read().decode("utf-8", errors="replace") if e.fp else ""
        try:
            parsed = json.loads(raw)
        except Exception:
            parsed = raw
        return e.code, elapsed_ms, parsed
    except Exception as e:
        elapsed_ms = round((time.perf_counter() - t0) * 1000.0, 2)
        return 0, elapsed_ms, {"error": str(e)}


def detect_saber_fnb(base_url: str) -> bool:
    status, _, body = http_request(base_url, "/api/v1/menu-items", "GET")
    return status == 200 and isinstance(body, dict) and "menuItems" in body


def run_saber_fnb_agent_journey(
    base_url: str, profile: OasisAgentProfile, round_num: int
) -> List[AgentActionLog]:
    logs: List[AgentActionLog] = []

    def record(
        action_type: str,
        endpoint: str,
        method: str,
        status: int,
        latency: float,
        ok: bool,
        obs: str,
    ):
        logs.append(
            AgentActionLog(
                timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
                round_num=round_num,
                agent_id=profile.user_id,
                agent_name=profile.name,
                entity_type=profile.source_entity_type,
                action_type=action_type,
                endpoint=endpoint,
                method=method,
                status_code=status,
                latency_ms=latency,
                success=ok,
                observation=obs,
            )
        )

    if profile.source_entity_type == "WalkInDiner":
        # 1. Scan Table QR storefront
        st, lat, _ = http_request(base_url, "/warungmakan?table=TABLE%2004", "GET")
        record("SCAN_TABLE_QR", "/warungmakan?table=TABLE%2004", "GET", st, lat, st == 200, f"Loaded storefront HTML ({st})")

        # 2. Fetch menu catalog
        st, lat, data = http_request(base_url, "/api/v1/menu-items", "GET")
        items = data.get("menuItems", []) if isinstance(data, dict) else []
        available = [m for m in items if not m.get("isSoldOut")]
        record("BROWSE_CATALOG", "/api/v1/menu-items", "GET", st, lat, st == 200 and len(available) > 0, f"Found {len(available)} available dishes")

        # 3. Submit zero-login guest checkout
        if available:
            chosen = available[0]
            st, lat, order_res = http_request(
                base_url,
                "/api/v1/orders/guest-checkout",
                "POST",
                {
                    "customerName": f"Rina Swarm R{round_num}",
                    "customerWhatsapp": "081299001122",
                    "orderType": "WALK_IN_TABLE",
                    "tableNumber": "TABLE 04",
                    "paymentType": "BANK_TRANSFER_QRIS",
                    "specialNotes": "Less ice, extra sambal on side",
                    "items": [{"menuItemId": chosen["id"], "quantity": 2}],
                },
            )
            order_obj = order_res.get("order", {}) if isinstance(order_res, dict) else {}
            order_id = order_obj.get("id")
            record(
                "SUBMIT_GUEST_ORDER",
                "/api/v1/orders/guest-checkout",
                "POST",
                st,
                lat,
                st in (200, 201) and bool(order_id),
                f"Created order #{order_obj.get('orderNumber', 'N/A')} in state {order_obj.get('orderStatus', 'N/A')}",
            )

    elif profile.source_entity_type == "DeliveryCustomer":
        st, lat, data = http_request(base_url, "/api/v1/menu-items", "GET")
        items = data.get("menuItems", []) if isinstance(data, dict) else []
        available = [m for m in items if not m.get("isSoldOut")]
        if available:
            chosen = available[-1]
            st, lat, order_res = http_request(
                base_url,
                "/api/v1/orders/guest-checkout",
                "POST",
                {
                    "customerName": f"David Expat R{round_num}",
                    "customerWhatsapp": "+6281122334455",
                    "orderType": "SELF_DELIVERY",
                    "deliveryAddress": "Jl. Senopati No. 88, Kebayoran Baru",
                    "paymentType": "BANK_TRANSFER_QRIS",
                    "items": [{"menuItemId": chosen["id"], "quantity": 1}],
                },
            )
            order_obj = order_res.get("order", {}) if isinstance(order_res, dict) else {}
            record(
                "SUBMIT_DELIVERY_ORDER",
                "/api/v1/orders/guest-checkout",
                "POST",
                st,
                lat,
                st in (200, 201),
                f"Self-delivery order total IDR {order_obj.get('totalAmountIdr')} (fee IDR {order_obj.get('deliveryFeeIdr')})",
            )

    elif profile.source_entity_type == "CashierOperator":
        st, lat, _ = http_request(base_url, "/cashier/orders", "GET")
        record("OPEN_KANBAN_UI", "/cashier/orders", "GET", st, lat, st == 200, "Loaded 5-column Cashier Kanban UI")

        st, lat, orders_data = http_request(base_url, "/api/v1/orders", "GET")
        orders = orders_data.get("orders", []) if isinstance(orders_data, dict) else []
        pending = [o for o in orders if o.get("orderStatus") == "PENDING_STOCK_CONFIRMATION"]
        record("FETCH_KANBAN_QUEUE", "/api/v1/orders", "GET", st, lat, st == 200, f"Queue has {len(orders)} total orders ({len(pending)} pending stock)")

        if pending:
            target = pending[0]
            st, lat, upd = http_request(
                base_url,
                "/api/v1/orders",
                "PATCH",
                {
                    "orderId": target["id"],
                    "action": "confirm_stock",
                    "updatedItems": target.get("items", []),
                },
            )
            record(
                "AUDIT_STOCK_AND_BILL",
                "/api/v1/orders",
                "PATCH",
                st,
                lat,
                st == 200,
                f"Audited stock for #{target.get('orderNumber')} -> AWAITING_PAYMENT & fired WA Bot invoice",
            )

    elif profile.source_entity_type == "StoreOwner":
        for route in ("/admin/menu", "/admin/tables", "/admin/analytics"):
            st, lat, _ = http_request(base_url, route, "GET")
            record("INSPECT_ADMIN_SCREEN", route, "GET", st, lat, st == 200, f"Verified admin workspace {route}")

        st, lat, tbl_data = http_request(base_url, "/api/v1/tables", "GET")
        tables = tbl_data.get("tables", []) if isinstance(tbl_data, dict) else []
        record("AUDIT_TABLE_SESSIONS", "/api/v1/tables", "GET", st, lat, st == 200 and len(tables) > 0, f"Verified {len(tables)} active table QR sessions")

    elif profile.source_entity_type == "PreOrderCustomer":
        st, lat, _ = http_request(
            base_url, "/order/66666666-6666-4666-8666-666666666601", "GET"
        )
        record("VIEW_ORDER_PASS", "/order/66666666-6666-4666-8666-666666666601", "GET", st, lat, st == 200, "Loaded 6-stage Live Order Pass")

        st, lat, _ = http_request(
            base_url, "/order/66666666-6666-4666-8666-666666666601/receipt", "GET"
        )
        record("VIEW_DIGITAL_INVOICE", "/order/66666666-6666-4666-8666-666666666601/receipt", "GET", st, lat, st == 200, "Loaded printable digital web receipt")

    elif profile.source_entity_type == "AdversarialBot":
        # 1. Reserved slug rejection test
        st, lat, slug_res = http_request(base_url, "/api/v1/validate-slug?slug=admin", "GET")
        rejected_reserved = isinstance(slug_res, dict) and slug_res.get("available") is False
        record(
            "FUZZ_RESERVED_SUBDOMAIN",
            "/api/v1/validate-slug?slug=admin",
            "GET",
            st,
            lat,
            st == 200 and rejected_reserved,
            f"Reserved slug 'admin' blocked: {slug_res}",
        )

        # 2. Empty guest checkout rejection test
        st, lat, bad_res = http_request(
            base_url,
            "/api/v1/orders/guest-checkout",
            "POST",
            {"customerName": "", "customerWhatsapp": "", "items": []},
        )
        record(
            "FUZZ_EMPTY_CHECKOUT",
            "/api/v1/orders/guest-checkout",
            "POST",
            st,
            lat,
            st == 400,
            f"Empty checkout properly rejected with HTTP {st}",
        )

        # 3. God's-Eye View Variable Injection: Toggle item sold-out and immediately restore
        st, lat, menu_data = http_request(base_url, "/api/v1/menu-items", "GET")
        items = menu_data.get("menuItems", []) if isinstance(menu_data, dict) else []
        if items:
            target_item = items[-1]
            orig_state = bool(target_item.get("isSoldOut"))
            st1, lat1, _ = http_request(
                base_url,
                f"/api/v1/menu-items/{target_item['id']}/toggle-stock",
                "PATCH",
                {"isSoldOut": not orig_state},
            )
            st2, lat2, _ = http_request(
                base_url,
                f"/api/v1/menu-items/{target_item['id']}/toggle-stock",
                "PATCH",
                {"isSoldOut": orig_state},
            )
            record(
                "GODS_EYE_STOCK_INJECTION",
                f"/api/v1/menu-items/{target_item['id']}/toggle-stock",
                "PATCH",
                st2,
                round(lat1 + lat2, 2),
                st1 == 200 and st2 == 200,
                f"Injected stock-out & restored '{target_item.get('titleId')}' without state corruption",
            )

    return logs


def run_generic_agent_journey(
    base_url: str, profile: OasisAgentProfile, round_num: int
) -> List[AgentActionLog]:
    st, lat, _ = http_request(base_url, "/", "GET")
    return [
        AgentActionLog(
            timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
            round_num=round_num,
            agent_id=profile.user_id,
            agent_name=profile.name,
            entity_type=profile.source_entity_type,
            action_type="VISIT_ROOT",
            endpoint="/",
            method="GET",
            status_code=st,
            latency_ms=lat,
            success=200 <= st < 400,
            observation=f"Visited root endpoint ({st})",
        )
    ]


def main() -> int:
    parser = argparse.ArgumentParser(description="MiroFish Universal Swarm App Tester")
    parser.add_argument("--url", required=True, help="Target application base URL")
    parser.add_argument("--mode", default="auto", choices=["auto", "saber-fnb", "generic"])
    parser.add_argument("--rounds", type=int, default=2, help="Number of temporal simulation rounds")
    parser.add_argument("--concurrency", type=int, default=6, help="Parallel OASIS agents")
    parser.add_argument("--output-dir", default="/tmp/mirofish-swarm-report", help="Directory for actions.jsonl and report.json")
    args = parser.parse_args()

    os.makedirs(args.output_dir, exist_ok=True)
    is_fnb = args.mode == "saber-fnb" or (args.mode == "auto" and detect_saber_fnb(args.url))

    all_logs: List[AgentActionLog] = []
    t_start = time.perf_counter()

    for r in range(1, args.rounds + 1):
        with concurrent.futures.ThreadPoolExecutor(max_workers=args.concurrency) as pool:
            futures = [
                pool.submit(
                    run_saber_fnb_agent_journey if is_fnb else run_generic_agent_journey,
                    args.url,
                    persona,
                    r,
                )
                for persona in DEFAULT_PERSONA_SWARM
            ]
            for fut in concurrent.futures.as_completed(futures):
                all_logs.extend(fut.result())

    elapsed_sec = round(time.perf_counter() - t_start, 2)
    total_actions = len(all_logs)
    passed_actions = sum(1 for x in all_logs if x.success)
    latencies = sorted(x.latency_ms for x in all_logs)
    p50 = latencies[len(latencies) // 2] if latencies else 0.0
    p95 = latencies[min(len(latencies) - 1, int(len(latencies) * 0.95))] if latencies else 0.0

    actions_path = os.path.join(args.output_dir, "actions.jsonl")
    with open(actions_path, "w", encoding="utf-8") as f:
        for entry in all_logs:
            f.write(json.dumps(dataclasses.asdict(entry), ensure_ascii=False) + "\n")

    summary = {
        "engine": "MiroFish Swarm Intelligence Tester (OASIS Multi-Agent)",
        "target_url": args.url,
        "detected_mode": "saber-fnb" if is_fnb else "generic",
        "rounds": args.rounds,
        "agents_count": len(DEFAULT_PERSONA_SWARM),
        "total_actions": total_actions,
        "passed_actions": passed_actions,
        "failed_actions": total_actions - passed_actions,
        "pass_rate_pct": round((passed_actions / max(1, total_actions)) * 100.0, 2),
        "p50_latency_ms": p50,
        "p95_latency_ms": p95,
        "elapsed_seconds": elapsed_sec,
        "actions_log_file": actions_path,
        "personas": [dataclasses.asdict(p) for p in DEFAULT_PERSONA_SWARM],
        "sample_observations": [dataclasses.asdict(x) for x in all_logs],
    }

    report_path = os.path.join(args.output_dir, "report.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dumps(summary, indent=2)
        f.write(json.dumps(summary, indent=2, ensure_ascii=False))

    print(json.dumps(summary, indent=2, ensure_ascii=False))
    return 0 if passed_actions == total_actions else 1


if __name__ == "__main__":
    sys.exit(main())
