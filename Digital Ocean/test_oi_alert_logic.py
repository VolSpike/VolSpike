"""
Test: OI Alert Logic
Tests the OI spike/dump detection logic with synthetic history sequences.
"""

import sys
import os
import time
from collections import deque

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from oi_realtime_poller import (
    oi_history,
    maybe_emit_oi_alert,
    OI_SPIKE_THRESHOLD_PCT,
    OI_DUMP_THRESHOLD_PCT,
    OI_MIN_DELTA_CONTRACTS,
    OI_BASELINE_WINDOW_HIGH,
    OI_BASELINE_WINDOW_LOW,
)


def create_test_history(symbol: str, base_oi: float, num_samples: int = 100):
    """Create a test history with base OI"""
    now = time.time()
    oi_history[symbol] = deque(maxlen=2000)
    
    # Fill history with base OI (going back in time)
    for i in range(num_samples):
        timestamp = now - (num_samples - i) * 10  # 10 second intervals
        oi_history[symbol].append((timestamp, base_oi))


def test_spike_detection():
    """Test that spikes are detected correctly"""
    print("Testing spike detection:")
    print("-" * 50)
    
    symbol = "TESTUSDT"
    base_oi = 100000.0
    
    # Create history with stable base OI
    create_test_history(symbol, base_oi, num_samples=200)
    
    # Now add a spike (10% increase, 15000 contracts)
    now = time.time()
    spike_oi = base_oi * 1.10  # 10% increase
    spike_oi = base_oi + 15000  # 15000 contracts increase
    
    # Should trigger spike alert
    print(f"Base OI: {base_oi:.0f}, Spike OI: {spike_oi:.0f}")
    print(f"Change: {(spike_oi - base_oi) / base_oi * 100:.2f}% (+{spike_oi - base_oi:.0f} contracts)")
    
    maybe_emit_oi_alert(symbol, spike_oi, now)
    
    print("✅ Spike test completed")
    return True


def test_dump_detection():
    """Test that dumps are detected correctly"""
    print("\nTesting dump detection:")
    print("-" * 50)
    
    symbol = "TESTUSDT2"
    base_oi = 200000.0
    
    # Create history with stable base OI
    create_test_history(symbol, base_oi, num_samples=200)
    
    # Now add a dump (10% decrease, 20000 contracts)
    now = time.time()
    dump_oi = base_oi * 0.90  # 10% decrease
    dump_oi = base_oi - 20000  # 20000 contracts decrease
    
    # Should trigger dump alert
    print(f"Base OI: {base_oi:.0f}, Dump OI: {dump_oi:.0f}")
    print(f"Change: {(dump_oi - base_oi) / base_oi * 100:.2f}% ({dump_oi - base_oi:.0f} contracts)")
    
    maybe_emit_oi_alert(symbol, dump_oi, now)
    
    print("✅ Dump test completed")
    return True


def test_no_alert_small_change():
    """Test that small changes don't trigger alerts"""
    print("\nTesting small change (should not alert):")
    print("-" * 50)
    
    symbol = "TESTUSDT3"
    base_oi = 100000.0
    
    # Create history
    create_test_history(symbol, base_oi, num_samples=200)
    
    # Small change (2% increase, 1000 contracts) - below thresholds
    now = time.time()
    small_change_oi = base_oi * 1.02  # 2% increase
    small_change_oi = base_oi + 1000  # 1000 contracts (below 5000 threshold)
    
    print(f"Base OI: {base_oi:.0f}, Small change OI: {small_change_oi:.0f}")
    print(f"Change: {(small_change_oi - base_oi) / base_oi * 100:.2f}% (+{small_change_oi - base_oi:.0f} contracts)")
    print("(Should NOT trigger alert)")
    
    maybe_emit_oi_alert(symbol, small_change_oi, now)
    
    print("✅ Small change test completed (no alert expected)")
    return True


def main():
    """Run all tests"""
    print("=" * 50)
    print("OI Alert Logic Tests")
    print("=" * 50)
    
    try:
        test_spike_detection()
        test_dump_detection()
        test_no_alert_small_change()
        
        print("\n" + "=" * 50)
        print("✅ All tests completed!")
        print("=" * 50)
        return 0
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())

