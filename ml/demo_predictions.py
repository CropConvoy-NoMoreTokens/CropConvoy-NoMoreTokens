import urllib.request
import json

def post(endpoint, payload):
    req = urllib.request.Request(
        f"http://127.0.0.1:8001{endpoint}",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))

print("=" * 68)
print("1. PRODUCE PRICE FORECASTS (CUDA XGBoost Inference)")
print("=" * 68)
items = [
    ("tomato", "dambulla", "2026-10"),
    ("potato", "colombo", "2026-10"),
    ("carrot", "kandy", "2026-10"),
    ("banana", "colombo", "2026-11"),
    ("papaya", "dambulla", "2026-11"),
    ("pineapple", "colombo", "2026-12"),
]
print(f"{'Commodity':<12} {'Market':<10} {'Target':<9} {'Latest LKR':<12} {'Forecast LKR':<14} {'Change'}")
print("-" * 68)
for prod, mkt, month in items:
    res = post("/v1/prices/forecast", {"produceId": prod, "marketId": mkt, "targetMonth": month})
    latest = res["latest_known_price_per_kg_minor"] / 100.0
    fc = res["forecast_price_per_kg_minor"] / 100.0
    chg = res["predicted_change_pct"]
    print(f"{prod.capitalize():<12} {mkt.capitalize():<10} {month:<9} LKR {latest:<8.2f} LKR {fc:<10.2f} {chg:>+5.1f}%")

print("\n" + "=" * 68)
print("2. CULTIVATION RECOMMENDATIONS (Mild Mid-Country, 1 Hectare, Oct 2026)")
print("=" * 68)
plant_res = post("/v1/planting/recommendations", {
    "plantingMonth": "2026-10",
    "regionProfile": "mild_midcountry",
    "marketId": "dambulla",
    "areaHa": 1.0,
    "soilType": "loam",
    "soilPh": 6.0,
    "irrigationAvailable": True
})

for i, rec in enumerate(plant_res["recommendations"], 1):
    c_ret = rec["central"]["net_return_minor"] / 100.0
    s_ret = rec["stressed"]["net_return_minor"] / 100.0
    y = rec["predicted_yield_kg_ha"]
    p = rec["forecast_price_per_kg_minor"] / 100.0
    print(f"Rank #{i}: {rec['crop_label']}")
    print(f"  • Harvest Schedule: {rec['harvest_date']} ({rec['harvest_month']})")
    print(f"  • Predicted Yield:  {y:,.1f} kg/ha (Sellable: {rec['central']['sellable_kg']:,.1f} kg)")
    print(f"  • Harvest Forecast: LKR {p:.2f}/kg ({rec['price_source']})")
    print(f"  • Central Net Return:  LKR {c_ret:>13,.2f}")
    print(f"  • Stressed Net Return: LKR {s_ret:>13,.2f} (Rank Metric)\n")

print("=" * 68)
print("3. SUITABILITY EXCLUSION SCENARIO (Clay Soil / Water Stress)")
print("=" * 68)
clay_res = post("/v1/planting/recommendations", {
    "plantingMonth": "2026-10",
    "regionProfile": "mild_midcountry",
    "marketId": "dambulla",
    "areaHa": 1.0,
    "soilType": "clay",
    "soilPh": 6.0,
    "irrigationAvailable": True
})
print(f"Eligible recommendations: {len(clay_res['recommendations'])}")
print("Exclusions triggered:")
for ex in clay_res["exclusions"]:
    print(f"  [EXCLUDED] {ex['crop_label']}: {ex['reasons'][0]}")
