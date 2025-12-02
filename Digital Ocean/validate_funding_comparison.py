"""
Funding Rate Comparison Validation Script
────────────────────────────────────────────────────────────────────────────
• Parses comparison logs from volume alert and OI poller scripts
• Generates validation reports showing REST vs WebSocket data accuracy
• Helps determine when it's safe to switch to WebSocket-only mode

Usage:
    python validate_funding_comparison.py [log_file]
    
    If no log_file provided, reads from stdin.
"""

import sys
import re
from collections import defaultdict
from typing import Dict, List, Tuple

# ─────────────────────── Parsing Functions ───────────────────────

def parse_funding_mismatch(line: str) -> Tuple[str, float, float, float]:
    """
    Parse funding mismatch log line:
    '  ⚠️  Funding mismatch for BTCUSDT: REST=0.000300, WS=0.000301, diff=0.333%'
    """
    pattern = r'Funding mismatch for (\w+): REST=([\d.]+), WS=([\d.]+), diff=([\d.]+)%'
    match = re.search(pattern, line)
    if match:
        symbol, rest_val, ws_val, diff_pct = match.groups()
        return symbol, float(rest_val), float(ws_val), float(diff_pct)
    return None


def parse_mark_price_mismatch(line: str) -> Tuple[str, float, float, float]:
    """
    Parse mark price mismatch log line:
    '⚠️  Mark price mismatch for BTCUSDT: REST=11185.88, WS=11185.90, diff=0.018%'
    """
    pattern = r'Mark price mismatch for (\w+): REST=([\d.]+), WS=([\d.]+), diff=([\d.]+)%'
    match = re.search(pattern, line)
    if match:
        symbol, rest_val, ws_val, diff_pct = match.groups()
        return symbol, float(rest_val), float(ws_val), float(diff_pct)
    return None


def parse_comparison_summary(line: str) -> Dict:
    """
    Parse comparison summary log line:
    '📊 Funding Comparison Summary:'
    '   Total comparisons: 1000'
    '   Matches: 995 (99.5%)'
    '   Mismatches: 5'
    '   Avg difference: 0.012%'
    '   Max difference: 0.333% (BTCUSDT)'
    """
    # This is a multi-line summary, we'll parse it differently
    return None


# ─────────────────────── Statistics Collection ───────────────────────

funding_stats = {
    "total": 0,
    "matches": 0,
    "mismatches": 0,
    "differences": [],
    "by_symbol": defaultdict(list),
}

mark_price_stats = {
    "total": 0,
    "matches": 0,
    "mismatches": 0,
    "differences": [],
    "by_symbol": defaultdict(list),
}


def process_log_file(file_handle):
    """Process log file and collect statistics"""
    for line in file_handle:
        line = line.strip()
        
        # Check for funding mismatch
        funding_mismatch = parse_funding_mismatch(line)
        if funding_mismatch:
            symbol, rest_val, ws_val, diff_pct = funding_mismatch
            funding_stats["mismatches"] += 1
            funding_stats["differences"].append(diff_pct)
            funding_stats["by_symbol"][symbol].append(diff_pct)
            continue
        
        # Check for mark price mismatch
        mark_price_mismatch = parse_mark_price_mismatch(line)
        if mark_price_mismatch:
            symbol, rest_val, ws_val, diff_pct = mark_price_mismatch
            mark_price_stats["mismatches"] += 1
            mark_price_stats["differences"].append(diff_pct)
            mark_price_stats["by_symbol"][symbol].append(diff_pct)
            continue
        
        # Check for comparison summary (we'll need to parse multiple lines)
        # For now, we'll rely on the individual mismatch logs


# ─────────────────────── Report Generation ───────────────────────

def generate_report():
    """Generate validation report"""
    print("=" * 70)
    print("Funding Rate & Mark Price Comparison Validation Report")
    print("=" * 70)
    print()
    
    # Funding Rate Statistics
    print("📊 Funding Rate Comparison:")
    print("-" * 70)
    if funding_stats["differences"]:
        total_comparisons = funding_stats["mismatches"]  # We only log mismatches
        matches_estimate = total_comparisons * 10  # Rough estimate (assuming 90% match rate)
        total_estimate = matches_estimate + total_comparisons
        
        avg_diff = sum(funding_stats["differences"]) / len(funding_stats["differences"]) if funding_stats["differences"] else 0
        max_diff = max(funding_stats["differences"]) if funding_stats["differences"] else 0
        
        print(f"   Total mismatches logged: {funding_stats['mismatches']}")
        print(f"   Average difference: {avg_diff:.4f}%")
        print(f"   Maximum difference: {max_diff:.4f}%")
        
        if funding_stats["by_symbol"]:
            worst_symbol = max(funding_stats["by_symbol"].items(), key=lambda x: sum(x[1]) / len(x[1]))
            print(f"   Worst symbol: {worst_symbol[0]} (avg diff: {sum(worst_symbol[1]) / len(worst_symbol[1]):.4f}%)")
    else:
        print("   No mismatches found (all comparisons matched)")
    print()
    
    # Mark Price Statistics
    print("📊 Mark Price Comparison:")
    print("-" * 70)
    if mark_price_stats["differences"]:
        total_comparisons = mark_price_stats["mismatches"]  # We only log mismatches
        
        avg_diff = sum(mark_price_stats["differences"]) / len(mark_price_stats["differences"]) if mark_price_stats["differences"] else 0
        max_diff = max(mark_price_stats["differences"]) if mark_price_stats["differences"] else 0
        
        print(f"   Total mismatches logged: {mark_price_stats['mismatches']}")
        print(f"   Average difference: {avg_diff:.4f}%")
        print(f"   Maximum difference: {max_diff:.4f}%")
        
        if mark_price_stats["by_symbol"]:
            worst_symbol = max(mark_price_stats["by_symbol"].items(), key=lambda x: sum(x[1]) / len(x[1]))
            print(f"   Worst symbol: {worst_symbol[0]} (avg diff: {sum(worst_symbol[1]) / len(worst_symbol[1]):.4f}%)")
    else:
        print("   No mismatches found (all comparisons matched)")
    print()
    
    # Validation Recommendation
    print("✅ Validation Recommendation:")
    print("-" * 70)
    
    funding_ok = not funding_stats["differences"] or max(funding_stats["differences"]) < 1.0
    mark_price_ok = not mark_price_stats["differences"] or max(mark_price_stats["differences"]) < 1.0
    
    if funding_ok and mark_price_ok:
        print("   ✅ SAFE TO SWITCH: All differences < 1.0%")
        print("   ✅ WebSocket data matches REST API data accurately")
        print("   ✅ Ready to remove REST API calls and use WebSocket-only")
    else:
        print("   ⚠️  REVIEW NEEDED: Some differences > 1.0%")
        if not funding_ok:
            print(f"      - Funding rate max diff: {max(funding_stats['differences']):.4f}%")
        if not mark_price_ok:
            print(f"      - Mark price max diff: {max(mark_price_stats['differences']):.4f}%")
        print("   ⚠️  Investigate discrepancies before switching to WebSocket-only")
    
    print()
    print("=" * 70)


# ─────────────────────── Main ───────────────────────

def main():
    """Main entry point"""
    if len(sys.argv) > 1:
        # Read from file
        with open(sys.argv[1], 'r') as f:
            process_log_file(f)
    else:
        # Read from stdin
        process_log_file(sys.stdin)
    
    generate_report()


if __name__ == "__main__":
    main()

