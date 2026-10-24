"""Hardware-independent service checks; never train or substitute CPU predictions."""
from datetime import date
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import shutil
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from ml import features, server

BASE = Path(__file__).parent


@pytest.fixture
def unavailable_client(monkeypatch):
    monkeypatch.setattr(features, "colombo_today", lambda: date(2026, 10, 24))
    monkeypatch.setattr(server, "colombo_today", lambda: date(2026, 10, 24))
    # Exercise invalid device configuration without requiring any GPU hardware.
    monkeypatch.setattr(server, "INFERENCE_DEVICE", "unsupported")
    # Own this worker so the GPU suite's teardown cannot affect these checks.
    with ThreadPoolExecutor(max_workers=1) as worker:
        monkeypatch.setattr(server, "_inference_worker", worker)
        with TestClient(server.app) as client:
            assert server._state["data_ready"]
            assert not server._state["ready"]
            assert "ML_INFERENCE_DEVICE must be" in server._state["startup_error"]
            yield client


def test_checked_in_artifacts_and_datasets_match_manifest():
    manifest = json.loads((BASE / "artifacts/model_manifest.json").read_text())
    for name, expected in manifest["sha256"].items():
        assert hashlib.sha256((BASE / "artifacts" / name).read_bytes()).hexdigest() == expected
    for name, expected in manifest["dataset_sha256"].items():
        assert features.dataset_sha256(BASE / "data" / name) == expected


def test_dataset_hash_ignores_line_endings_but_detects_changed_values(tmp_path):
    path = tmp_path / "example.csv"
    path.write_bytes(b"crop,price\ntomato,22000\n")
    expected = features.dataset_sha256(path)
    path.write_bytes(b"crop,price\r\ntomato,22000\r\n")
    assert features.dataset_sha256(path) == expected
    path.write_bytes(b"crop,price\ntomato,22001\n")
    assert features.dataset_sha256(path) != expected


def test_unavailable_predictions_do_not_hide_catalog_or_history(unavailable_client):
    client = unavailable_client
    assert client.get("/health").status_code == 503
    catalog = client.get("/v1/catalog")
    assert catalog.status_code == 200
    assert catalog.json()["assumptions"]["data_source"] == "synthetic"
    for produce in server.PRODUCE:
        for market in server.MARKETS:
            response = client.get("/v1/prices/history", params={"produceId": produce, "marketId": market})
            assert response.status_code == 200
            assert len(response.json()["prices"]) == 129
    for path, body in [
        ("/v1/prices/forecast", {"produceId": "tomato", "marketId": "dambulla", "targetMonth": "2026-10"}),
        ("/v1/planting/recommendations", {"plantingMonth": "2026-10", "regionProfile": "mild_midcountry",
         "marketId": "dambulla", "areaHa": 1, "soilType": "loam", "soilPh": 6, "irrigationAvailable": True}),
    ]:
        response = client.post(path, json=body)
        assert response.status_code == 503
        assert response.json()["detail"]["code"] == "SERVICE_UNAVAILABLE"


def test_unavailable_service_still_validates_requests(unavailable_client):
    response = unavailable_client.post("/v1/prices/forecast", json={
        "produceId": "mango", "marketId": "dambulla", "targetMonth": "2026-10", "unknown": True,
    })
    assert response.status_code == 422
    assert unavailable_client.get("/v1/prices/history?produceId=mango&marketId=dambulla").status_code == 422


def test_catalog_calendar_rollover_without_gpu(unavailable_client, monkeypatch):
    monkeypatch.setattr(server, "colombo_today", lambda: date(2026, 12, 31))
    response = unavailable_client.get("/v1/catalog")
    assert response.json()["planting_months"] == ["2026-12", "2027-01", "2027-02"]


def test_service_key_protects_analytical_routes(unavailable_client, monkeypatch):
    monkeypatch.setenv("ML_API_KEY", "test-service-key")
    assert unavailable_client.get("/v1/catalog").status_code == 401
    assert unavailable_client.get("/v1/catalog", headers={"X-ML-API-Key": "wrong-key"}).status_code == 401
    assert unavailable_client.get("/v1/catalog", headers={"X-ML-API-Key": "test-service-key"}).status_code == 200
    assert unavailable_client.get("/health").status_code == 503  # Public, but models are unavailable here.


def test_render_requires_service_auth_configuration(unavailable_client, monkeypatch):
    monkeypatch.setenv("RENDER", "true")
    monkeypatch.delenv("ML_API_KEY", raising=False)
    assert unavailable_client.get("/v1/catalog").status_code == 503


def test_missing_artifacts_return_unavailable_without_training(unavailable_client, monkeypatch, tmp_path):
    monkeypatch.setattr(server, "ARTIFACTS", tmp_path)
    server.load_models()
    assert unavailable_client.get("/health").status_code == 503
    assert unavailable_client.get("/v1/prices/history?produceId=tomato&marketId=dambulla").status_code == 200


@pytest.mark.parametrize("name", ["price_data.csv", "yield_data.csv"])
def test_modified_training_data_is_rejected(unavailable_client, monkeypatch, tmp_path, name):
    for source in (BASE / "data").glob("*.csv"):
        shutil.copyfile(source, tmp_path / source.name)
    path = tmp_path / name
    rows = path.read_bytes().splitlines()
    if name == "price_data.csv":
        fields = rows[1].split(b",")
        index = rows[0].split(b",").index(b"price_per_kg_minor")
        fields[index] = str(int(fields[index]) + 1).encode()
        rows[1] = b",".join(fields)
    else:
        # A byte-level change must also invalidate the training provenance.
        rows.append(rows[-1])
    path.write_bytes(b"\n".join(rows) + b"\n")
    monkeypatch.setattr(server, "DATA_DIR", tmp_path)
    server.load_models()
    assert "Training data changed" in server._state["startup_error"]
    assert unavailable_client.get("/health").status_code == 503
