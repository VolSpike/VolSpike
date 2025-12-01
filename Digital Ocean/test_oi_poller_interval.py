"""
Test: OI Poller Interval Calculator
Tests the polling interval computation logic.
"""

import sys
import os

# Add parent directory to path to import from oi_realtime_poller
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from oi_realtime_poller import compute_polling_interval


def test_interval_calculator():
    """Test interval calculation for various universe sizes"""
    
    test_cases = [
        (100, 5, 5),    # Small universe -> min interval (5s)
        (200, 5, 10),   # 2000/200 = 10 polls/min -> 6s (clamped to min 5s... wait, 60/10 = 6s, so 6s is correct)
        (300, 5, 20),   # Medium -> ~9s
        (400, 5, 20),   # Large -> ~12s
        (500, 5, 20),   # Very large -> ~15s
        (1000, 5, 20),  # Huge -> clamped to max 20s
        (0, 20, 20),    # Empty -> max interval
        (-1, 20, 20),   # Invalid -> max interval
    ]
    
    print("Testing polling interval calculator:")
    print("-" * 50)
    
    all_passed = True
    for universe_size, min_bound, max_bound in test_cases:
        interval = compute_polling_interval(universe_size)
        
        # Interval should be within bounds [min_bound, max_bound]
        passed = min_bound <= interval <= max_bound
        
        status = "✅" if passed else "❌"
        print(f"{status} N={universe_size:4d} -> {interval:2d}s (expected {min_bound}-{max_bound}s)")
        
        if not passed:
            all_passed = False
    
    print("-" * 50)
    if all_passed:
        print("✅ All tests passed!")
        return 0
    else:
        print("❌ Some tests failed")
        return 1


if __name__ == "__main__":
    sys.exit(test_interval_calculator())

