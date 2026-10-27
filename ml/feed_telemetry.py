"""
LECO Smart Electricity Meter - Telemetry Stream & Batch Feeder Tool
Feeds realistic smart meter telemetry into the Python Adaptive ML Service
and updates online models in real-time.

Usage:
  # Stream live readings every 30 seconds:
  .venv\\Scripts\\python.exe ml/feed_telemetry.py --meter-id 18 --mode stream --interval 30

  # Feed a batch of the last 7 days of realistic historical telemetry:
  .venv\\Scripts\\python.exe ml/feed_telemetry.py --meter-id 18 --mode batch --days 7

  # Single pulse test:
  .venv\\Scripts\\python.exe ml/feed_telemetry.py --meter-id 18 --mode single --kwh-delta 0.15
"""

import argparse
import json
import random
import time
from datetime import datetime, timezone, timedelta
import urllib.request
import urllib.error

ML_API_URL = "http://localhost:8000/api/ml/telemetry"


def post_json(endpoint: str, payload: dict) -> dict:
    url = f"{ML_API_URL}/{endpoint}"
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8")
        print(f"[Error {e.code}] Telemetry feed rejected: {error_body}")
        return {"status": "ERROR", "code": e.code, "detail": error_body}
    except Exception as e:
        print(f"[Connection Error] Could not reach ML service at {url}: {e}")
        return {"status": "OFFLINE", "error": str(e)}


def generate_diurnal_load(hour: int) -> float:
    """
    Returns realistic Sri Lankan domestic kW power draw for a given hour of day:
    - 00:00 - 05:00: Sleep baseline (refrigerators, standby) -> 0.15 - 0.35 kW
    - 06:00 - 08:30: Morning peak (water heater, kettle, iron) -> 0.80 - 1.80 kW
    - 09:00 - 17:00: Daytime baseline / work hours -> 0.25 - 0.60 kW
    - 18:00 - 21:30: Evening PUCSL Peak (cooking, AC/fans, TV, lights) -> 1.20 - 2.50 kW
    - 22:00 - 23:50: Wind-down -> 0.40 - 0.70 kW
    """
    if 0 <= hour < 6:
        base = random.uniform(0.15, 0.35)
    elif 6 <= hour < 9:
        base = random.uniform(0.80, 1.80)
    elif 9 <= hour < 18:
        base = random.uniform(0.25, 0.60)
    elif 18 <= hour < 22:
        base = random.uniform(1.20, 2.50)
    else:
        base = random.uniform(0.40, 0.70)
    return round(base, 3)


def run_single(meter_id: int, delta_kwh: float, balance: float):
    now = datetime.now(timezone.utc)
    kw = round(delta_kwh * 120, 2)  # approx kW power draw for a 30s pulse
    payload = {
        "meter_id": meter_id,
        "timestamp": now.isoformat(),
        "cumulative_kwh": round(150.0 + delta_kwh, 3),
        "prepaid_balance": balance,
        "connection_type": "prepaid",
        "tariff_id": "DOMESTIC_D1",
        "billing_cycle_day": now.day,
        "voltage": round(random.uniform(228.0, 232.0), 1),
        "current_amps": round((kw * 1000) / 230.0, 2),
        "power_factor": round(random.uniform(0.92, 0.98), 2)
    }
    print(f"Feeding single telemetry pulse for Meter #{meter_id} (Delta: {delta_kwh} kWh, Power: {kw} kW)...")
    res = post_json("ingest", payload)
    print(f"Result: {json.dumps(res, indent=2)}")


def run_batch(meter_id: int, days: int, balance_start: float):
    print(f"Generating and feeding {days} days of realistic historical telemetry for Meter #{meter_id}...")
    now = datetime.now(timezone.utc)
    readings = []
    cum_kwh = 100.0
    balance = balance_start

    # Generate 1 reading per hour over the requested days
    total_hours = days * 24
    for h in range(total_hours, 0, -1):
        ts = now - timedelta(hours=h)
        kw = generate_diurnal_load(ts.hour)
        hour_kwh = round(kw * 1.0, 3)
        cum_kwh += hour_kwh
        # Rough tariff deduction ~Rs. 35/kWh
        balance = max(0.0, balance - (hour_kwh * 35.0))

        readings.append({
            "meter_id": meter_id,
            "timestamp": ts.isoformat(),
            "cumulative_kwh": round(cum_kwh, 3),
            "prepaid_balance": round(balance, 2),
            "connection_type": "prepaid",
            "tariff_id": "DOMESTIC_D1",
            "billing_cycle_day": ts.day,
            "voltage": round(random.uniform(228.0, 232.0), 1),
            "current_amps": round((kw * 1000) / 230.0, 2),
            "power_factor": round(random.uniform(0.92, 0.98), 2)
        })

    print(f"Submitting batch of {len(readings)} hourly observations to /api/ml/telemetry/batch...")
    res = post_json("batch", readings)
    print(f"Batch ingestion completed: {json.dumps(res, indent=2)}")
    print(f"Total Cumulative kWh reached: {round(cum_kwh, 2)} kWh")
    print(f"Remaining Simulated Prepaid Balance: Rs. {round(balance, 2)}")


def run_stream(meter_id: int, interval_seconds: int, balance: float):
    print(f"Starting continuous telemetry streaming for Meter #{meter_id}...")
    print(f"Interval: every {interval_seconds} seconds. Press Ctrl+C to stop.")
    cum_kwh = 245.50

    try:
        pulse_count = 0
        while True:
            pulse_count += 1
            now = datetime.now(timezone.utc)
            load_kw = generate_diurnal_load(now.hour)
            # Delta kWh for this interval
            delta_kwh = round((load_kw * (interval_seconds / 3600.0)), 4)
            cum_kwh += delta_kwh
            balance = max(0.0, round(balance - (delta_kwh * 38.0), 2))

            payload = {
                "meter_id": meter_id,
                "timestamp": now.isoformat(),
                "cumulative_kwh": round(cum_kwh, 4),
                "prepaid_balance": balance,
                "connection_type": "prepaid",
                "tariff_id": "DOMESTIC_D1",
                "billing_cycle_day": now.day,
                "voltage": round(random.uniform(228.0, 232.0), 1),
                "current_amps": round((load_kw * 1000) / 230.0, 2),
                "power_factor": round(random.uniform(0.93, 0.97), 2)
            }

            res = post_json("ingest", payload)
            status_text = res.get("status", "UNKNOWN")
            print(f"[{now.strftime('%H:%M:%S')}] Pulse #{pulse_count} | Meter #{meter_id} | Load: {load_kw:.2f} kW | Delta: +{delta_kwh:.4f} kWh | Bal: Rs. {balance:.2f} | ML: {status_text}")
            time.sleep(interval_seconds)
    except KeyboardInterrupt:
        print("\nStreaming paused by user.")


def main():
    parser = argparse.ArgumentParser(description="LECO Smart Electricity Meter Telemetry Feeder")
    parser.add_argument("--meter-id", type=int, default=18, help="Meter ID to feed telemetry for (default: 18)")
    parser.add_argument("--mode", choices=["single", "batch", "stream"], default="stream", help="Feeding mode")
    parser.add_argument("--interval", type=int, default=30, help="Stream pulse interval in seconds (default: 30)")
    parser.add_argument("--days", type=int, default=7, help="Number of historical days for batch mode (default: 7)")
    parser.add_argument("--balance", type=float, default=1850.0, help="Initial prepaid balance (default: 1850.00)")
    parser.add_argument("--kwh-delta", type=float, default=0.10, help="kWh consumption delta for single mode (default: 0.10)")

    args = parser.parse_args()

    if args.mode == "single":
        run_single(args.meter_id, args.kwh_delta, args.balance)
    elif args.mode == "batch":
        run_batch(args.meter_id, args.days, args.balance)
    elif args.mode == "stream":
        run_stream(args.meter_id, args.interval, args.balance)


if __name__ == "__main__":
    main()
