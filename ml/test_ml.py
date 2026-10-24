"""HTTP and model regression tests. No training or dataset regeneration."""
from datetime import date
from pathlib import Path
import json
import hashlib
import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from ml import server, features
from ml.features import price_features, validate_price_history, add_months
from ml.train import _price_features
from ml.generate_prices import generate_price_data
from ml.generate_yields import generate_yield_data

BASE = Path(__file__).parent
FROZEN = date(2026,10,24)
REQUEST = {"plantingMonth":"2026-10","regionProfile":"mild_midcountry","marketId":"dambulla",
    "areaHa":1,"soilType":"loam","soilPh":6,"irrigationAvailable":True}

@pytest.fixture(scope="module")
def client():
    server.load_models()
    assert server._state.get("ready"), server._state.get("startup_error")
    client = TestClient(server.app)
    yield client
    client.close()
    server._gpu_worker.submit(server.release_models).result()
    server._gpu_worker.shutdown(wait=True)

@pytest.fixture(autouse=True)
def frozen(monkeypatch):
    monkeypatch.setattr(server,"colombo_today",lambda:FROZEN)
    monkeypatch.setattr(features,"colombo_today",lambda:FROZEN)

def test_runtime_gpu_and_artifact_provenance(client):
    res = client.get("/health").json()
    assert res["inference_device"].startswith("cuda")
    for name in ("price","yield"):
        assert server._device(server._state[name+"_model"]).startswith("cuda")
    manifest = json.loads((BASE/"artifacts/model_manifest.json").read_text())
    for name,digest in manifest["sha256"].items():
        assert hashlib.sha256((BASE/"artifacts"/name).read_bytes()).hexdigest()==digest

def test_dataset_reproducibility():
    pd.testing.assert_frame_equal(pd.read_csv(BASE/"data/price_data.csv"),generate_price_data(today=FROZEN))
    pd.testing.assert_frame_equal(pd.read_csv(BASE/"data/yield_data.csv"),generate_yield_data())

@pytest.mark.parametrize("horizon",range(1,7))
def test_shared_features_and_no_future_leak(horizon):
    df = pd.read_csv(BASE/"data/price_data.csv")
    group = df[(df.produce_id=="tomato") & (df.market_id=="dambulla")].sort_values("month")
    prices = group.price_per_kg_minor.to_numpy()/100
    months = group.month.tolist()
    origin = len(prices)-7
    target = months[origin+horizon]
    offline = _price_features(group)
    row = offline[(offline.origin_month==months[origin]) & (offline.target_month==target)].iloc[0]
    live = price_features(prices[:origin+1],months[:origin+1],target)
    for key,value in live.items():
        assert row[key]==pytest.approx(value)
    future = prices.copy(); future[origin+1:]*=1000
    assert price_features(future,months,target,origin)==live
    previous = group[group.month==add_months(target,-12)].iloc[0].price_per_kg_minor/100
    assert live["prev_year_price"]==previous

@pytest.mark.parametrize("produce",list(server.PRODUCE))
@pytest.mark.parametrize("market",list(server.MARKETS))
def test_all_forecast_horizons(client,produce,market):
    for horizon in range(1,7):
        target = add_months("2026-09",horizon)
        response = client.post("/v1/prices/forecast",json={"produceId":produce,"marketId":market,"targetMonth":target})
        assert response.status_code==200,response.text
        payload = response.json()
        assert payload["horizon_months"]==horizon
        assert isinstance(payload["forecast_price_per_kg_minor"],int)
        assert payload["forecast_price_per_kg_minor"]>0
        group = server._history(produce,market)
        expected = int(group[group.month==add_months(target,-12)].iloc[0].price_per_kg_minor)
        assert payload["previous_year_price_per_kg_minor"]==expected

@pytest.mark.parametrize("changes",[
    {"plantingMonth":"2026-13"},{"plantingMonth":"2026-1"},{"plantingMonth":"2020-01"},
    {"plantingMonth":"2030-01"},{"areaHa":-1},{"areaHa":0},{"areaHa":101},{"areaHa":"NaN"},
    {"soilPh":-1},{"soilPh":15},{"soilPh":"NaN"},{"soilType":"unknown"},{"regionProfile":"unknown"},
    {"cultivationCostOverride":{"tomato":-1}},{"cultivationCostOverride":{"mango":1}},
    {"cultivationCostOverride":{"tomato":1e12}},{"extra":True},
])
def test_http_planting_validation(client,changes):
    response = client.post("/v1/planting/recommendations",json={**REQUEST,**changes})
    assert response.status_code==422,response.text
    assert response.json().get("detail")

@pytest.mark.parametrize("changes",[{"targetMonth":"2026-13"},{"targetMonth":"2026-10-01"},
    {"targetMonth":"2030-01"},{"produceId":"mango"},{"marketId":"unknown"}])
def test_http_price_validation(client,changes):
    response = client.post("/v1/prices/forecast",json={**{"produceId":"tomato","marketId":"dambulla","targetMonth":"2026-10"},**changes})
    assert response.status_code==422

def test_current_date_ranking_and_currency(client):
    payload = client.post("/v1/planting/recommendations",json=REQUEST).json()
    assert len(payload["recommendations"])==3
    returns = [r["stressed"]["net_return_per_ha_minor"] for r in payload["recommendations"]]
    assert returns==sorted(returns,reverse=True)
    for rec in payload["recommendations"]:
        assert rec["planting_date"]=="2026-10-24"
        for scenario in ("central","stressed"):
            f=rec[scenario]
            assert f["net_return_minor"]==f["revenue_minor"]-f["cultivation_cost_minor"]-f["marketing_cost_minor"]

def test_area_scaling_and_zero_cost(client):
    a = client.post("/v1/planting/recommendations",json=REQUEST).json()
    b = client.post("/v1/planting/recommendations",json={**REQUEST,"areaHa":2.5,"cultivationCostOverride":{"carrot":0}}).json()
    rec = next(r for r in b["recommendations"] if r["crop_id"]=="carrot")
    assert rec["central"]["cultivation_cost_minor"]==0
    original = next(r for r in a["recommendations"] if r["crop_id"]=="carrot")
    assert rec["central"]["harvested_kg"]==pytest.approx(original["central"]["harvested_kg"]*2.5,abs=.2)

def test_all_negative_exclusions_and_zero_ph(client):
    negative = client.post("/v1/planting/recommendations",json={**REQUEST,"cultivationCostOverride":dict.fromkeys(server.CROPS,100_000_000)}).json()
    assert negative["all_negative_returns"]
    for changes in ({"soilType":"clay"},{"soilPh":0}):
        res = client.post("/v1/planting/recommendations",json={**REQUEST,**changes}).json()
        assert not res["recommendations"]
        assert len(res["exclusions"])==3

def test_out_of_horizon_excluded_without_fallback(client,monkeypatch):
    monkeypatch.setattr(server,"colombo_today",lambda:date(2027,3,1))
    res=client.post("/v1/planting/recommendations",json={**REQUEST,"plantingMonth":"2027-03"})
    assert res.status_code==200
    assert res.json()["recommendations"]==[]
    assert all("forecast window" in r["reasons"][-1] for r in res.json()["exclusions"])

def test_missing_gpu_and_cpu_fallback_fail_closed(client,monkeypatch):
    monkeypatch.setitem(server._state,"ready",False)
    assert client.get("/health").status_code==503
    assert client.post("/v1/prices/forecast",json={"produceId":"tomato","marketId":"dambulla","targetMonth":"2026-10"}).status_code==503
    assert client.get("/v1/prices/history?produceId=tomato&marketId=dambulla").status_code==200
    monkeypatch.setitem(server._state,"ready",True)
    monkeypatch.setattr(server,"_device",lambda model:"cpu")
    assert client.get("/health").status_code==503

@pytest.mark.parametrize("output",[float("nan"),-2.0])
def test_bad_model_output_returns_503(client,monkeypatch,output):
    monkeypatch.setitem(server._state,"ready",True)
    model=server._state["price_model"]
    monkeypatch.setattr(model,"predict",lambda *args,**kwargs:np.array([output]))
    try:
        assert client.post("/v1/prices/forecast",json={"produceId":"tomato","marketId":"dambulla","targetMonth":"2026-10"}).status_code==503
    finally:
        server._state["ready"]=True

@pytest.mark.parametrize("mutation",["duplicate","missing_month","negative","fractional","missing_series","future"])
def test_history_validation(mutation):
    df=pd.read_csv(BASE/"data/price_data.csv")
    if mutation=="duplicate": df=pd.concat([df,df.iloc[:1]])
    elif mutation=="missing_month": df=df.drop(df.index[20])
    elif mutation=="negative": df.loc[0,"price_per_kg_minor"]=-1
    elif mutation=="fractional": df=df.astype({"price_per_kg_minor":float}); df.loc[0,"price_per_kg_minor"]=1.5
    elif mutation=="missing_series": df=df[df.produce_id!="tomato"]
    else: df.loc[df.month=="2026-09","month"]="2030-01"
    with pytest.raises(ValueError): validate_price_history(df,today=FROZEN)

def test_calendar_rollover(client,monkeypatch):
    monkeypatch.setattr(server,"colombo_today",lambda:date(2026,12,31))
    result=client.get("/v1/catalog").json()
    assert result["planting_months"]==["2026-12","2027-01","2027-02"]
    assert result["forecast_months"]==["2026-12","2027-01","2027-02","2027-03"]

def test_startup_missing_artifacts(client,monkeypatch):
    saved=server._state.copy()
    try:
        monkeypatch.setattr(server,"ARTIFACTS",BASE/"missing-artifacts-for-test")
        server.load_models()
        assert client.get("/health").status_code==503
        assert server._state["data_ready"]
    finally:
        server._state.clear(); server._state.update(saved)


def test_exact_break_even_arithmetic():
    result = server._compute_financials(20_000, 1, 200, 3_330_000, 0.1, 15)
    assert result["net_return_minor"] == 0
    assert result["net_return_per_ha_minor"] == 0
