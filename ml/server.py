"""Synthetic decision support with verified CUDA inference."""
import json
import gc
import hashlib
import math
import os
import subprocess
from contextlib import asynccontextmanager
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from typing import Literal
import joblib
import numpy as np
import pandas as pd
import xgboost as xgb
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field, field_validator
from .config import (CLIMATE_PROFILES, CROPS, DATA_SOURCE, DEFAULT_AREA_HA,
    DEFAULT_LOSS_RATE, DEFAULT_MARKETING_TRANSPORT_LKR_KG, GENERATOR_VERSION,
    MARKETS, PRODUCE, STRESS_PRICE_DISCOUNT, STRESS_YIELD_DISCOUNT)
from .features import (FEATURE_VERSION, PRICE_FEATURE_COLUMNS, add_months,
    colombo_today, month_distance, parse_month, price_features, validate_price_history)

BASE = Path(__file__).parent
ARTIFACTS = BASE / "artifacts"
DATA_DIR = BASE / "data"
INFERENCE_DEVICE = os.environ.get("ML_INFERENCE_DEVICE", "cuda:0")
_state = {}
# Keep CUDA contexts on one long-lived worker rather than transient HTTP threads.
_gpu_worker = ThreadPoolExecutor(max_workers=1, thread_name_prefix="cropconvoy-cuda")

def _unavailable(message="Predictions are temporarily unavailable. Please try again."):
    return HTTPException(503, detail={"code": "SERVICE_UNAVAILABLE", "message": message})

def _invalid(field, message):
    return HTTPException(422, detail={"code": "VALIDATION_ERROR", "message": message,
        "fields": [{"path": field, "message": message}]})

def _device(model):
    return json.loads(model.save_config())["learner"]["generic_param"]["device"]

def _check_data():
    if not _state.get("data_ready"):
        raise _unavailable("Historical data is unavailable.")

def _check_ready():
    if not _state.get("ready"):
        raise _unavailable("The prediction service is unavailable. GPU and models must be ready.")
    try:
        fallback = _gpu_worker.submit(lambda: any(
            not _device(_state[f"{n}_model"]).startswith("cuda") for n in ("price", "yield")
        )).result()
    except Exception as exc:
        _state["ready"] = False
        raise _unavailable("GPU readiness could not be verified.") from exc
    if fallback:
        _state["ready"] = False
        raise _unavailable("GPU verification failed. Predictions have been paused.")

def _history(produce, market):
    df = _state["price_history"]
    return df[(df.produce_id == produce) & (df.market_id == market)].sort_values("month")

def _predict(name, values):
    return _gpu_worker.submit(_predict_on_gpu, name, values).result()

def _predict_on_gpu(name, values):
    try:
        model = _state[f"{name}_model"]
        result = float(model.predict(xgb.DMatrix(np.asarray([values], dtype=np.float32)))[0])
        if not math.isfinite(result) or not _device(model).startswith("cuda"):
            raise ValueError("Invalid output or CPU fallback")
        return result
    except Exception as exc:
        _state["ready"] = False
        raise _unavailable("The prediction could not be completed. Please retry the service.") from exc

def _predict_price(produce, market, target):
    hist = _history(produce, market)
    features = price_features(hist.price_per_kg_minor.to_numpy() / 100, hist.month, target)
    pre = _state["price_preprocessors"]
    features["produce_enc"] = pre["produce_encoder"].transform([produce])[0]
    features["market_enc"] = pre["market_encoder"].transform([market])[0]
    change = _predict("price", [features[c] for c in pre["feature_cols"]])
    amount = features["latest_price"] * (1 + change)
    if not math.isfinite(amount) or amount <= 0:
        _state["ready"] = False
        raise _unavailable("The model returned an invalid forecast.")
    return int(round(amount * 100)), change, features

def _predict_yield(crop, region, month, soil, ph, irrigation):
    pre = _state["yield_preprocessors"]
    climate = CLIMATE_PROFILES[region]
    values = [pre["crop_encoder"].transform([crop])[0], pre["region_encoder"].transform([region])[0],
        math.sin(2*math.pi*month/12), math.cos(2*math.pi*month/12),
        pre["soil_encoder"].transform([soil])[0], ph, int(irrigation),
        climate["temp_mean"], climate["rainfall_mean"]]
    result = _predict("yield", values)
    if result < 0:
        _state["ready"] = False
        raise _unavailable("The model returned an invalid yield.")
    return result

def load_models():
    _gpu_worker.submit(release_models).result()
    _state.update(ready=False, data_ready=False, inference_device="unavailable")
    try:
        history = pd.read_csv(DATA_DIR / "price_data.csv")
        cutoff = validate_price_history(history)
        _state.update(price_history=history, data_cutoff=cutoff, data_ready=True)
        manifest = json.loads((ARTIFACTS / "model_manifest.json").read_text(encoding="utf-8"))
        if manifest["feature_version"] != FEATURE_VERSION or manifest["data_cutoff"] != cutoff:
            raise RuntimeError("Models and historical data have different versions or cutoffs.")
        for name, expected in manifest["sha256"].items():
            if name not in {"price_model.ubj", "yield_model.ubj", "price_preprocessors.pkl", "yield_preprocessors.pkl"}:
                raise RuntimeError("The model manifest has an unsupported artifact.")
            if hashlib.sha256((ARTIFACTS / name).read_bytes()).hexdigest() != expected:
                raise RuntimeError("A model artifact does not match its manifest.")
        if set(manifest["sha256"]) != {"price_model.ubj", "yield_model.ubj", "price_preprocessors.pkl", "yield_preprocessors.pkl"}:
            raise RuntimeError("The model manifest is incomplete.")
        if hashlib.sha256((DATA_DIR / "price_data.csv").read_bytes()).hexdigest() != manifest["dataset_sha256"]["price_data.csv"]:
            raise RuntimeError("Price history changed after training. Retrain before serving.")
        if not INFERENCE_DEVICE.startswith("cuda"):
            raise RuntimeError("This demo requires CUDA. CPU fallback is disabled.")
        for name, size in (("price", 13), ("yield", 9)):
            model = xgb.Booster()
            model.load_model(str(ARTIFACTS / f"{name}_model.ubj"))
            pre = joblib.load(ARTIFACTS / f"{name}_preprocessors.pkl")
            if model.num_features() != size or len(pre["feature_cols"]) != size:
                raise RuntimeError(f"{name} model feature schema does not match.")
            if name == "price" and pre["feature_cols"] != PRICE_FEATURE_COLUMNS:
                raise RuntimeError("Price feature order does not match.")
            model.set_param({"device": INFERENCE_DEVICE})
            _state[f"{name}_model"] = model
            _state[f"{name}_preprocessors"] = pre
        _predict_price("tomato", "dambulla", add_months(cutoff, 1))
        _predict_yield("carrot", "mild_midcountry", 1, "loam", 6.0, True)
        devices = [_device(_state[f"{name}_model"]) for name in ("price", "yield")]
        if any(not d.startswith("cuda") for d in devices) or len(set(devices)) != 1:
            raise RuntimeError("CUDA verification failed: CPU fallback detected.")
        _state.update(ready=True, inference_device=devices[0])
        try:
            result = subprocess.run(["nvidia-smi", "--query-gpu=name", "--format=csv,noheader"],
                capture_output=True, text=True, timeout=5)
            _state["gpu_name"] = result.stdout.strip() or "CUDA GPU"
        except (OSError, subprocess.TimeoutExpired):
            _state["gpu_name"] = "CUDA GPU"
        print(f"[ML API] Both models verified on {devices[0]}", flush=True)
    except Exception as exc:
        _state.update(ready=False, inference_device="unavailable", startup_error=str(exc))
        print(f"[ML API] Not ready: {exc}", flush=True)

def release_models():
    _state.clear()
    gc.collect()

@asynccontextmanager
async def lifespan(app):
    load_models()
    try:
        yield
    finally:
        _gpu_worker.submit(release_models).result()

app = FastAPI(title="CropConvoy ML API", version="2.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware,
    allow_origins=[f"http://{h}:{p}" for h in ("localhost", "127.0.0.1") for p in (5173,4173)],
    allow_methods=["GET","POST"], allow_headers=["Content-Type"])

@app.get("/health")
def health():
    _check_ready()
    return {"status":"ok", "models_loaded":True, "inference_device":_state["inference_device"],
        "data_cutoff":_state["data_cutoff"], "data_source":DATA_SOURCE,
        "server_date":colombo_today().isoformat(), "xgboost_version":xgb.__version__,
        "generator_version":GENERATOR_VERSION, "feature_version":FEATURE_VERSION,
        "gpu_name":_state.get("gpu_name","CUDA GPU")}

@app.get("/v1/catalog")
def catalog():
    today = colombo_today()
    current = today.strftime("%Y-%m")
    cutoff = _state.get("data_cutoff")
    forecasts = [add_months(cutoff,n) for n in range(1,7)] if cutoff else []
    return {
        "produce":{k:{"label":v["label"]} for k,v in PRODUCE.items()},
        "markets":{k:{"label":v["label"]} for k,v in MARKETS.items()},
        "crops":{k:{"label":v["label"], "duration_days":v["duration_days"],
            "cost_lkr_ha":v["cost_lkr_ha"], "ref_yield_kg_ha":v["ref_yield_kg_ha"],
            "temp_range":[v["temp_min"],v["temp_max"]], "ph_range":[v["ph_min"],v["ph_max"]]}
            for k,v in CROPS.items()},
        "climate_profiles":{k:{"label":v["label"], "temp_mean":v["temp_mean"],
            "rainfall_mean":v["rainfall_mean"]} for k,v in CLIMATE_PROFILES.items()},
        "assumptions":{"loss_rate":DEFAULT_LOSS_RATE,
            "marketing_transport_lkr_kg":DEFAULT_MARKETING_TRANSPORT_LKR_KG,
            "stress_price_discount":STRESS_PRICE_DISCOUNT, "stress_yield_discount":STRESS_YIELD_DISCOUNT,
            "data_source":DATA_SOURCE},
        "server_date":today.isoformat(), "data_cutoff":cutoff,
        "forecast_months":[m for m in forecasts if m >= current],
        "planting_months":[add_months(current,n) for n in range(3)]}

@app.get("/v1/prices/history")
def price_history(produceId:str, marketId:str):
    _check_data()
    if produceId not in PRODUCE:
        raise _invalid("produceId","Choose a supported produce item.")
    if marketId not in MARKETS:
        raise _invalid("marketId","Choose a supported market.")
    return {"produce_id":produceId, "market_id":marketId, "data_source":DATA_SOURCE,
        "prices":_history(produceId,marketId)[["month","price_per_kg_minor"]].to_dict("records")}

class StrictRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)

    @field_validator("targetMonth","plantingMonth",check_fields=False)
    @classmethod
    def valid_month(cls,value):
        parse_month(value)
        return value

class PriceForecastRequest(StrictRequest):
    produceId:Literal["tomato","potato","carrot","banana","papaya","pineapple"]
    marketId:Literal["dambulla","colombo","kandy"]
    targetMonth:str

class PlantingRequest(StrictRequest):
    plantingMonth:str
    regionProfile:Literal["warm_lowland","mild_midcountry","cool_upland"]
    marketId:Literal["dambulla","colombo","kandy"]
    areaHa:float = Field(default=DEFAULT_AREA_HA,ge=0.1,le=100)
    soilType:Literal["loam","sandy_loam","clay"] = "loam"
    soilPh:float = Field(default=6.0,ge=0,le=14)
    irrigationAvailable:bool = True
    cultivationCostOverride:dict[Literal["tomato","potato","carrot"],float] | None = None

    @field_validator("cultivationCostOverride")
    @classmethod
    def valid_costs(cls,value):
        if value and any(not math.isfinite(v) or v<0 or v>1_000_000_000 for v in value.values()):
            raise ValueError("Costs must be between LKR 0 and 1,000,000,000 per hectare.")
        return value

@app.post("/v1/prices/forecast")
def price_forecast(req:PriceForecastRequest):
    _check_ready()
    cutoff = _state["data_cutoff"]
    if not 1 <= month_distance(cutoff,req.targetMonth) <= 6:
        raise _invalid("targetMonth",f"Choose a month one to six months after {cutoff}.")
    price,change,features = _predict_price(req.produceId,req.marketId,req.targetMonth)
    return {"produce_id":req.produceId, "market_id":req.marketId, "origin_month":cutoff,
        "target_month":req.targetMonth, "horizon_months":features["horizon_months"],
        "forecast_price_per_kg_minor":price,
        "latest_known_price_per_kg_minor":int(round(features["latest_price"]*100)),
        "predicted_change_pct":round(change*100,2),
        "previous_year_price_per_kg_minor":int(round(features["prev_year_price"]*100)),
        "data_source":DATA_SOURCE, "inference_device":_state["inference_device"]}

def _minor(value):
    amount = int((Decimal(str(value))*100).quantize(Decimal("1"),rounding=ROUND_HALF_UP))
    if abs(amount)>9_007_199_254_740_991:
        raise _unavailable("The projection exceeds the supported amount.")
    return amount

def _compute_financials(yield_kg_ha,area_ha,price_lkr_kg,cost_lkr_ha,loss_rate,transport_lkr_kg):
    harvested = yield_kg_ha*area_ha
    sellable = harvested*(1-loss_rate)
    revenue,cultivation,marketing = _minor(sellable*price_lkr_kg),_minor(cost_lkr_ha*area_ha),_minor(sellable*transport_lkr_kg)
    net = revenue-cultivation-marketing
    return {"harvested_kg":round(harvested,1), "sellable_kg":round(sellable,1),
        "revenue_minor":revenue, "cultivation_cost_minor":cultivation,
        "marketing_cost_minor":marketing, "net_return_minor":net,
        "net_return_per_ha_minor":int((Decimal(net)/Decimal(str(area_ha))).quantize(Decimal("1"),rounding=ROUND_HALF_UP))}

@app.post("/v1/planting/recommendations")
def planting_recommendations(req:PlantingRequest):
    _check_ready()
    today = colombo_today()
    if req.plantingMonth not in [add_months(today.strftime("%Y-%m"),n) for n in range(3)]:
        raise _invalid("plantingMonth","Choose the current month or one of the next two months.")
    plant_date = today if req.plantingMonth==today.strftime("%Y-%m") else parse_month(req.plantingMonth)
    climate = CLIMATE_PROFILES[req.regionProfile]
    results,exclusions = [],[]
    for crop_id,crop in CROPS.items():
        reasons = []
        if req.soilType=="clay":
            reasons.append("Heavy clay soil is outside this demo's supported conditions.")
        if not req.irrigationAvailable and climate["rainfall_mean"]<100:
            reasons.append("Expected rainfall without irrigation is outside supported conditions.")
        if not crop["temp_min"]<=climate["temp_mean"]<=crop["temp_max"]:
            reasons.append(f"Expected temperature is outside the supported {crop['temp_min']}-{crop['temp_max']} C range.")
        if not crop["ph_min"]<=req.soilPh<=crop["ph_max"]:
            reasons.append(f"Soil pH is outside the supported {crop['ph_min']}-{crop['ph_max']} range.")
        harvest = plant_date+timedelta(days=crop["duration_days"])
        harvest_month = harvest.strftime("%Y-%m")
        if not 1<=month_distance(_state["data_cutoff"],harvest_month)<=6:
            reasons.append(f"Harvest in {harvest_month} falls outside the available price forecast window.")
        if reasons:
            exclusions.append({"crop_id":crop_id,"crop_label":crop["label"],"reasons":reasons})
            continue
        price,_,_ = _predict_price(crop_id,req.marketId,harvest_month)
        predicted_yield = _predict_yield(crop_id,req.regionProfile,plant_date.month,req.soilType,req.soilPh,req.irrigationAvailable)
        cost = (req.cultivationCostOverride or {}).get(crop_id,crop["cost_lkr_ha"])
        central = _compute_financials(predicted_yield,req.areaHa,price/100,cost,DEFAULT_LOSS_RATE,DEFAULT_MARKETING_TRANSPORT_LKR_KG)
        stressed = _compute_financials(predicted_yield*(1-STRESS_YIELD_DISCOUNT),req.areaHa,
            price/100*(1-STRESS_PRICE_DISCOUNT),cost,DEFAULT_LOSS_RATE,DEFAULT_MARKETING_TRANSPORT_LKR_KG)
        results.append({"crop_id":crop_id,"crop_label":crop["label"],"planting_date":plant_date.isoformat(),
            "harvest_date":harvest.isoformat(),"harvest_month":harvest_month,
            "predicted_yield_kg_ha":round(predicted_yield,1),"forecast_price_per_kg_minor":price,
            "price_source":"model_forecast","cultivation_cost_lkr_ha":cost,
            "central":central,"stressed":stressed,"area_ha":req.areaHa})
    results.sort(key=lambda r:r["stressed"]["net_return_per_ha_minor"],reverse=True)
    return {"planting_month":req.plantingMonth,"region_profile":req.regionProfile,"market_id":req.marketId,
        "soil_type":req.soilType,"soil_ph":req.soilPh,"irrigation_available":req.irrigationAvailable,
        "area_ha":req.areaHa,"data_source":DATA_SOURCE,"data_cutoff":_state["data_cutoff"],
        "inference_device":_state["inference_device"],"recommendations":results,"exclusions":exclusions,
        "all_negative_returns":bool(results) and all(r["stressed"]["net_return_minor"]<0 for r in results),
        "stress_assumptions":{"price_discount":STRESS_PRICE_DISCOUNT,"yield_discount":STRESS_YIELD_DISCOUNT}}
