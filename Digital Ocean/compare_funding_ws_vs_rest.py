#!/usr/bin/env python3
"""
Compare funding rates between Digital Ocean WebSocket cache and Binance REST API.

Usage:
    python3 compare_funding_ws_vs_rest.py \
        --state-file .funding_state.json \
        --symbols 1000PEPEUSDT,BTCUSDT,ETHUSDT \
        --max-symbols 50

If --symbols is omitted, the script compares the first N symbols from the
WebSocket cache (alphabetical order) up to --max-symbols.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import time
from typing import Dict, List, Tuple

import requests


BINANCE_PREMIUM_INDEX_URL = "https://fapi.binance.com/fapi/v1/premiumIndex"


def load_ws_state(state_file: str) -> Dict[str, Dict[str, float]]:
    if not os.path.exists(state_file):
        raise FileNotFoundError(f"State file not found: {state_file}")

    with open(state_file, "r") as f:
        data = json.load(f)

    state = data.get("funding_state", {})
    if not state:
        raise ValueError("No funding_state found in state file")
    return state


def fetch_rest_funding(symbol: str, session: requests.Session) -> Tuple[float, float]:
    """Return (funding_rate, mark_price) from Binance REST API."""
    response = session.get(
        BINANCE_PREMIUM_INDEX_URL,
        params={"symbol": symbol},
        timeout=5,
    )
    response.raise_for_status()
    payload = response.json()
    funding_rate = float(payload.get("lastFundingRate", 0.0))
    mark_price = float(payload.get("markPrice", 0.0))
    return funding_rate, mark_price


def compare_symbols(
    symbols: List[str],
    ws_state: Dict[str, Dict[str, float]],
    session: requests.Session,
) -> List[Dict[str, float]]:
    rows = []
    for symbol in symbols:
        ws_data = ws_state.get(symbol)
        if not ws_data:
            rows.append(
                {
                    "symbol": symbol,
                    "ws_funding": math.nan,
                    "rest_funding": math.nan,
                    "diff_abs": math.nan,
                    "diff_pct": math.nan,
                    "note": "missing_ws_data",
                }
            )
            continue

        ws_funding = float(ws_data.get("fundingRate", 0.0))
        ws_age = time.time() - float(ws_data.get("updatedAt", 0.0))

        try:
            rest_funding, rest_mark_price = fetch_rest_funding(symbol, session)
            diff_abs = rest_funding - ws_funding
            diff_pct = (
                abs(diff_abs) / abs(rest_funding) * 100 if rest_funding != 0 else math.nan
            )
            rows.append(
                {
                    "symbol": symbol,
                    "ws_funding": ws_funding,
                    "rest_funding": rest_funding,
                    "diff_abs": diff_abs,
                    "diff_pct": diff_pct,
                    "ws_age": ws_age,
                    "ws_mark": ws_data.get("markPrice"),
                    "rest_mark": rest_mark_price,
                    "note": "",
                }
            )
        except requests.HTTPError as e:
            rows.append(
                {
                    "symbol": symbol,
                    "ws_funding": ws_funding,
                    "rest_funding": math.nan,
                    "diff_abs": math.nan,
                    "diff_pct": math.nan,
                    "ws_age": ws_age,
                    "note": f"rest_error:{e.response.status_code}",
                }
            )
        except Exception as e:  # pylint: disable=broad-except
            rows.append(
                {
                    "symbol": symbol,
                    "ws_funding": ws_funding,
                    "rest_funding": math.nan,
                    "diff_abs": math.nan,
                    "diff_pct": math.nan,
                    "ws_age": ws_age,
                    "note": f"rest_error:{e}",
                }
            )

        time.sleep(0.05)  # avoid hitting REST rate limits

    return rows


def main():
    parser = argparse.ArgumentParser(
        description="Compare WebSocket and REST funding rates."
    )
    parser.add_argument(
        "--state-file",
        default=".funding_state.json",
        help="Path to WebSocket state file (.funding_state.json)",
    )
    parser.add_argument(
        "--symbols",
        default="",
        help="Comma separated list of symbols to compare (e.g., BTCUSDT,ETHUSDT).",
    )
    parser.add_argument(
        "--max-symbols",
        type=int,
        default=50,
        help="Maximum number of symbols to compare if --symbols not provided.",
    )
    parser.add_argument(
        "--sort-by",
        default="diff_pct",
        choices=["diff_pct", "diff_abs", "symbol"],
        help="Sort output by field.",
    )
    args = parser.parse_args()

    ws_state = load_ws_state(args.state_file)

    if args.symbols:
        symbols = [sym.strip().upper() for sym in args.symbols.split(",") if sym.strip()]
    else:
        symbols = sorted(ws_state.keys())[: args.max_symbols]

    session = requests.Session()
    session.headers.update({"User-Agent": "VolSpike-Funding-Comparator/1.0"})

    rows = compare_symbols(symbols, ws_state, session)

    # Sort results
    if args.sort_by == "symbol":
        rows.sort(key=lambda r: r["symbol"])
    else:
        rows.sort(
            key=lambda r: (math.inf if math.isnan(r[args.sort_by]) else -abs(r[args.sort_by])),
            reverse=False,
        )

    print(
        f"{'Symbol':<15} {'WS':>12} {'REST':>12} {'Diff':>12} {'Diff%':>9} {'WS Age(s)':>10} {'Note'}"
    )
    print("-" * 80)
    for row in rows:
        ws_funding = (
            f"{row['ws_funding']:.6f}" if not math.isnan(row["ws_funding"]) else "NaN"
        )
        rest_funding = (
            f"{row['rest_funding']:.6f}"
            if not math.isnan(row["rest_funding"])
            else "NaN"
        )
        diff_abs = (
            f"{row['diff_abs']:.6f}" if not math.isnan(row["diff_abs"]) else "NaN"
        )
        diff_pct = (
            f"{row['diff_pct']:.3f}%"
            if not math.isnan(row["diff_pct"])
            else "NaN"
        )
        ws_age = f"{row.get('ws_age', 0):.1f}" if row.get("ws_age") is not None else "NaN"
        note = row.get("note", "")

        print(
            f"{row['symbol']:<15} {ws_funding:>12} {rest_funding:>12} {diff_abs:>12} {diff_pct:>9} {ws_age:>10} {note}"
        )

    # Summary
    valid_rows = [r for r in rows if not math.isnan(r["diff_pct"])]
    if valid_rows:
        avg_diff_pct = sum(r["diff_pct"] for r in valid_rows) / len(valid_rows)
        max_row = max(valid_rows, key=lambda r: r["diff_pct"])
        print("\nSummary:")
        print(f"  Compared symbols: {len(symbols)}")
        print(f"  Valid comparisons: {len(valid_rows)}")
        print(f"  Average diff %: {avg_diff_pct:.4f}%")
        print(
            f"  Worst diff %: {max_row['diff_pct']:.4f}% ({max_row['symbol']}) [WS={max_row['ws_funding']:.6f}, REST={max_row['rest_funding']:.6f}]"
        )
    else:
        print("\nNo valid comparisons (REST errors or missing data).")


if __name__ == "__main__":
    main()

