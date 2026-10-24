export const mockCatalog = {
  "produce": {
    "tomato": {
      "label": "Tomato"
    },
    "potato": {
      "label": "Potato"
    },
    "carrot": {
      "label": "Carrot"
    },
    "banana": {
      "label": "Banana"
    },
    "papaya": {
      "label": "Papaya"
    },
    "pineapple": {
      "label": "Pineapple"
    }
  },
  "markets": {
    "dambulla": {
      "label": "Dambulla"
    },
    "colombo": {
      "label": "Colombo"
    },
    "kandy": {
      "label": "Kandy"
    }
  },
  "crops": {
    "tomato": {
      "label": "Tomato",
      "duration_days": 90,
      "cost_lkr_ha": 1800000,
      "ref_yield_kg_ha": 25000,
      "temp_range": [
        16,
        32
      ],
      "ph_range": [
        5.5,
        7.5
      ]
    },
    "potato": {
      "label": "Potato",
      "duration_days": 110,
      "cost_lkr_ha": 2200000,
      "ref_yield_kg_ha": 18000,
      "temp_range": [
        10,
        25
      ],
      "ph_range": [
        5.0,
        6.5
      ]
    },
    "carrot": {
      "label": "Carrot",
      "duration_days": 90,
      "cost_lkr_ha": 1600000,
      "ref_yield_kg_ha": 30000,
      "temp_range": [
        10,
        28
      ],
      "ph_range": [
        5.5,
        7.5
      ]
    }
  },
  "climate_profiles": {
    "warm_lowland": {
      "label": "Warm lowland",
      "temp_mean": 28,
      "rainfall_mean": 180
    },
    "mild_midcountry": {
      "label": "Mild mid-country",
      "temp_mean": 24,
      "rainfall_mean": 150
    },
    "cool_upland": {
      "label": "Cool upland",
      "temp_mean": 18,
      "rainfall_mean": 120
    }
  },
  "assumptions": {
    "loss_rate": 0.1,
    "marketing_transport_lkr_kg": 15,
    "stress_price_discount": 0.15,
    "stress_yield_discount": 0.2,
    "data_source": "synthetic"
  },
  "server_date": "2026-10-24",
  "data_cutoff": "2026-09",
  "forecast_months": [
    "2026-10",
    "2026-11",
    "2026-12",
    "2027-01",
    "2027-02",
    "2027-03"
  ],
  "planting_months": [
    "2026-10",
    "2026-11",
    "2026-12"
  ]
};

export const mockHealth = {
  "status": "ok",
  "models_loaded": true,
  "inference_device": "cuda:0",
  "data_cutoff": "2026-09",
  "data_source": "synthetic",
  "server_date": "2026-10-24",
  "xgboost_version": "3.2.0",
  "generator_version": "1.0.0",
  "feature_version": "2.0.0",
  "gpu_name": "NVIDIA GeForce RTX 4070 Laptop GPU"
};

export const mockHistory = {
  "produce_id": "tomato",
  "market_id": "dambulla",
  "data_source": "synthetic",
  "prices": [
    {
      "month": "2016-01",
      "price_per_kg_minor": 18469
    },
    {
      "month": "2016-02",
      "price_per_kg_minor": 19730
    },
    {
      "month": "2016-03",
      "price_per_kg_minor": 21381
    },
    {
      "month": "2016-04",
      "price_per_kg_minor": 24923
    },
    {
      "month": "2016-05",
      "price_per_kg_minor": 24503
    },
    {
      "month": "2016-06",
      "price_per_kg_minor": 23539
    },
    {
      "month": "2016-07",
      "price_per_kg_minor": 23989
    },
    {
      "month": "2016-08",
      "price_per_kg_minor": 23818
    },
    {
      "month": "2016-09",
      "price_per_kg_minor": 22773
    },
    {
      "month": "2016-10",
      "price_per_kg_minor": 21626
    },
    {
      "month": "2016-11",
      "price_per_kg_minor": 21512
    },
    {
      "month": "2016-12",
      "price_per_kg_minor": 19817
    },
    {
      "month": "2017-01",
      "price_per_kg_minor": 19782
    },
    {
      "month": "2017-02",
      "price_per_kg_minor": 20601
    },
    {
      "month": "2017-03",
      "price_per_kg_minor": 23842
    },
    {
      "month": "2017-04",
      "price_per_kg_minor": 24046
    },
    {
      "month": "2017-05",
      "price_per_kg_minor": 26329
    },
    {
      "month": "2017-06",
      "price_per_kg_minor": 25915
    },
    {
      "month": "2017-07",
      "price_per_kg_minor": 26663
    },
    {
      "month": "2017-08",
      "price_per_kg_minor": 25788
    },
    {
      "month": "2017-09",
      "price_per_kg_minor": 23742
    },
    {
      "month": "2017-10",
      "price_per_kg_minor": 21485
    },
    {
      "month": "2017-11",
      "price_per_kg_minor": 20357
    },
    {
      "month": "2017-12",
      "price_per_kg_minor": 19459
    },
    {
      "month": "2018-01",
      "price_per_kg_minor": 20379
    },
    {
      "month": "2018-02",
      "price_per_kg_minor": 21807
    },
    {
      "month": "2018-03",
      "price_per_kg_minor": 25051
    },
    {
      "month": "2018-04",
      "price_per_kg_minor": 25979
    },
    {
      "month": "2018-05",
      "price_per_kg_minor": 28840
    },
    {
      "month": "2018-06",
      "price_per_kg_minor": 28588
    },
    {
      "month": "2018-07",
      "price_per_kg_minor": 27862
    },
    {
      "month": "2018-08",
      "price_per_kg_minor": 25906
    },
    {
      "month": "2018-09",
      "price_per_kg_minor": 24307
    },
    {
      "month": "2018-10",
      "price_per_kg_minor": 23945
    },
    {
      "month": "2018-11",
      "price_per_kg_minor": 21036
    },
    {
      "month": "2018-12",
      "price_per_kg_minor": 18160
    },
    {
      "month": "2019-01",
      "price_per_kg_minor": 21254
    },
    {
      "month": "2019-02",
      "price_per_kg_minor": 23187
    },
    {
      "month": "2019-03",
      "price_per_kg_minor": 24883
    },
    {
      "month": "2019-04",
      "price_per_kg_minor": 27067
    },
    {
      "month": "2019-05",
      "price_per_kg_minor": 28456
    },
    {
      "month": "2019-06",
      "price_per_kg_minor": 28857
    },
    {
      "month": "2019-07",
      "price_per_kg_minor": 29046
    },
    {
      "month": "2019-08",
      "price_per_kg_minor": 26503
    },
    {
      "month": "2019-09",
      "price_per_kg_minor": 24362
    },
    {
      "month": "2019-10",
      "price_per_kg_minor": 22951
    },
    {
      "month": "2019-11",
      "price_per_kg_minor": 22548
    },
    {
      "month": "2019-12",
      "price_per_kg_minor": 23384
    },
    {
      "month": "2020-01",
      "price_per_kg_minor": 23614
    },
    {
      "month": "2020-02",
      "price_per_kg_minor": 24098
    },
    {
      "month": "2020-03",
      "price_per_kg_minor": 26438
    },
    {
      "month": "2020-04",
      "price_per_kg_minor": 29653
    },
    {
      "month": "2020-05",
      "price_per_kg_minor": 29073
    },
    {
      "month": "2020-06",
      "price_per_kg_minor": 29361
    },
    {
      "month": "2020-07",
      "price_per_kg_minor": 29737
    },
    {
      "month": "2020-08",
      "price_per_kg_minor": 28336
    },
    {
      "month": "2020-09",
      "price_per_kg_minor": 26964
    },
    {
      "month": "2020-10",
      "price_per_kg_minor": 25145
    },
    {
      "month": "2020-11",
      "price_per_kg_minor": 22203
    },
    {
      "month": "2020-12",
      "price_per_kg_minor": 21984
    },
    {
      "month": "2021-01",
      "price_per_kg_minor": 24097
    },
    {
      "month": "2021-02",
      "price_per_kg_minor": 25402
    },
    {
      "month": "2021-03",
      "price_per_kg_minor": 26564
    },
    {
      "month": "2021-04",
      "price_per_kg_minor": 28771
    },
    {
      "month": "2021-05",
      "price_per_kg_minor": 32250
    },
    {
      "month": "2021-06",
      "price_per_kg_minor": 30819
    },
    {
      "month": "2021-07",
      "price_per_kg_minor": 30249
    },
    {
      "month": "2021-08",
      "price_per_kg_minor": 30451
    },
    {
      "month": "2021-09",
      "price_per_kg_minor": 27730
    },
    {
      "month": "2021-10",
      "price_per_kg_minor": 25987
    },
    {
      "month": "2021-11",
      "price_per_kg_minor": 23268
    },
    {
      "month": "2021-12",
      "price_per_kg_minor": 22920
    },
    {
      "month": "2022-01",
      "price_per_kg_minor": 24336
    },
    {
      "month": "2022-02",
      "price_per_kg_minor": 25879
    },
    {
      "month": "2022-03",
      "price_per_kg_minor": 27939
    },
    {
      "month": "2022-04",
      "price_per_kg_minor": 28624
    },
    {
      "month": "2022-05",
      "price_per_kg_minor": 31906
    },
    {
      "month": "2022-06",
      "price_per_kg_minor": 31774
    },
    {
      "month": "2022-07",
      "price_per_kg_minor": 31021
    },
    {
      "month": "2022-08",
      "price_per_kg_minor": 30261
    },
    {
      "month": "2022-09",
      "price_per_kg_minor": 28269
    },
    {
      "month": "2022-10",
      "price_per_kg_minor": 27639
    },
    {
      "month": "2022-11",
      "price_per_kg_minor": 24133
    },
    {
      "month": "2022-12",
      "price_per_kg_minor": 23772
    },
    {
      "month": "2023-01",
      "price_per_kg_minor": 24143
    },
    {
      "month": "2023-02",
      "price_per_kg_minor": 26060
    },
    {
      "month": "2023-03",
      "price_per_kg_minor": 29605
    },
    {
      "month": "2023-04",
      "price_per_kg_minor": 31682
    },
    {
      "month": "2023-05",
      "price_per_kg_minor": 34632
    },
    {
      "month": "2023-06",
      "price_per_kg_minor": 34074
    },
    {
      "month": "2023-07",
      "price_per_kg_minor": 33329
    },
    {
      "month": "2023-08",
      "price_per_kg_minor": 24533
    },
    {
      "month": "2023-09",
      "price_per_kg_minor": 30409
    },
    {
      "month": "2023-10",
      "price_per_kg_minor": 27591
    },
    {
      "month": "2023-11",
      "price_per_kg_minor": 24410
    },
    {
      "month": "2023-12",
      "price_per_kg_minor": 24712
    },
    {
      "month": "2024-01",
      "price_per_kg_minor": 24856
    },
    {
      "month": "2024-02",
      "price_per_kg_minor": 28768
    },
    {
      "month": "2024-03",
      "price_per_kg_minor": 31065
    },
    {
      "month": "2024-04",
      "price_per_kg_minor": 30773
    },
    {
      "month": "2024-05",
      "price_per_kg_minor": 32547
    },
    {
      "month": "2024-06",
      "price_per_kg_minor": 33073
    },
    {
      "month": "2024-07",
      "price_per_kg_minor": 34073
    },
    {
      "month": "2024-08",
      "price_per_kg_minor": 34019
    },
    {
      "month": "2024-09",
      "price_per_kg_minor": 31771
    },
    {
      "month": "2024-10",
      "price_per_kg_minor": 28039
    },
    {
      "month": "2024-11",
      "price_per_kg_minor": 25987
    },
    {
      "month": "2024-12",
      "price_per_kg_minor": 24199
    },
    {
      "month": "2025-01",
      "price_per_kg_minor": 26845
    },
    {
      "month": "2025-02",
      "price_per_kg_minor": 26849
    },
    {
      "month": "2025-03",
      "price_per_kg_minor": 30190
    },
    {
      "month": "2025-04",
      "price_per_kg_minor": 32574
    },
    {
      "month": "2025-05",
      "price_per_kg_minor": 35148
    },
    {
      "month": "2025-06",
      "price_per_kg_minor": 24573
    },
    {
      "month": "2025-07",
      "price_per_kg_minor": 33490
    },
    {
      "month": "2025-08",
      "price_per_kg_minor": 35298
    },
    {
      "month": "2025-09",
      "price_per_kg_minor": 30042
    },
    {
      "month": "2025-10",
      "price_per_kg_minor": 28684
    },
    {
      "month": "2025-11",
      "price_per_kg_minor": 36387
    },
    {
      "month": "2025-12",
      "price_per_kg_minor": 30697
    },
    {
      "month": "2026-01",
      "price_per_kg_minor": 19711
    },
    {
      "month": "2026-02",
      "price_per_kg_minor": 29657
    },
    {
      "month": "2026-03",
      "price_per_kg_minor": 33528
    },
    {
      "month": "2026-04",
      "price_per_kg_minor": 38344
    },
    {
      "month": "2026-05",
      "price_per_kg_minor": 37768
    },
    {
      "month": "2026-06",
      "price_per_kg_minor": 45580
    },
    {
      "month": "2026-07",
      "price_per_kg_minor": 40455
    },
    {
      "month": "2026-08",
      "price_per_kg_minor": 36337
    },
    {
      "month": "2026-09",
      "price_per_kg_minor": 32902
    }
  ]
};

export const mockForecast = {
  "produce_id": "tomato",
  "market_id": "dambulla",
  "origin_month": "2026-09",
  "target_month": "2026-10",
  "horizon_months": 1,
  "forecast_price_per_kg_minor": 30161,
  "latest_known_price_per_kg_minor": 32902,
  "predicted_change_pct": -8.33,
  "previous_year_price_per_kg_minor": 28684,
  "data_source": "synthetic",
  "inference_device": "cuda:0"
};

export const mockRecommendations = {
  "planting_month": "2026-10",
  "region_profile": "mild_midcountry",
  "market_id": "dambulla",
  "soil_type": "loam",
  "soil_ph": 6.0,
  "irrigation_available": true,
  "area_ha": 1.0,
  "data_source": "synthetic",
  "data_cutoff": "2026-09",
  "inference_device": "cuda:0",
  "recommendations": [
    {
      "crop_id": "tomato",
      "crop_label": "Tomato",
      "planting_date": "2026-10-24",
      "harvest_date": "2027-01-22",
      "harvest_month": "2027-01",
      "predicted_yield_kg_ha": 20901.7,
      "forecast_price_per_kg_minor": 33401,
      "price_source": "model_forecast",
      "cultivation_cost_lkr_ha": 1800000,
      "central": {
        "harvested_kg": 20901.7,
        "sellable_kg": 18811.5,
        "revenue_minor": 628323068,
        "cultivation_cost_minor": 180000000,
        "marketing_cost_minor": 28217257,
        "net_return_minor": 420105811,
        "net_return_per_ha_minor": 420105811
      },
      "stressed": {
        "harvested_kg": 16721.3,
        "sellable_kg": 15049.2,
        "revenue_minor": 427259686,
        "cultivation_cost_minor": 180000000,
        "marketing_cost_minor": 22573806,
        "net_return_minor": 224685880,
        "net_return_per_ha_minor": 224685880
      },
      "area_ha": 1.0
    },
    {
      "crop_id": "carrot",
      "crop_label": "Carrot",
      "planting_date": "2026-10-24",
      "harvest_date": "2027-01-22",
      "harvest_month": "2027-01",
      "predicted_yield_kg_ha": 25294.5,
      "forecast_price_per_kg_minor": 23073,
      "price_source": "model_forecast",
      "cultivation_cost_lkr_ha": 1600000,
      "central": {
        "harvested_kg": 25294.5,
        "sellable_kg": 22765.0,
        "revenue_minor": 525257471,
        "cultivation_cost_minor": 160000000,
        "marketing_cost_minor": 34147541,
        "net_return_minor": 331109930,
        "net_return_per_ha_minor": 331109930
      },
      "stressed": {
        "harvested_kg": 20235.6,
        "sellable_kg": 18212.0,
        "revenue_minor": 357175081,
        "cultivation_cost_minor": 160000000,
        "marketing_cost_minor": 27318033,
        "net_return_minor": 169857048,
        "net_return_per_ha_minor": 169857048
      },
      "area_ha": 1.0
    },
    {
      "crop_id": "potato",
      "crop_label": "Potato",
      "planting_date": "2026-10-24",
      "harvest_date": "2027-02-11",
      "harvest_month": "2027-02",
      "predicted_yield_kg_ha": 15190.5,
      "forecast_price_per_kg_minor": 36611,
      "price_source": "model_forecast",
      "cultivation_cost_lkr_ha": 2200000,
      "central": {
        "harvested_kg": 15190.5,
        "sellable_kg": 13671.4,
        "revenue_minor": 500524941,
        "cultivation_cost_minor": 220000000,
        "marketing_cost_minor": 20507154,
        "net_return_minor": 260017787,
        "net_return_per_ha_minor": 260017787
      },
      "stressed": {
        "harvested_kg": 12152.4,
        "sellable_kg": 10937.1,
        "revenue_minor": 340356960,
        "cultivation_cost_minor": 220000000,
        "marketing_cost_minor": 16405723,
        "net_return_minor": 103951237,
        "net_return_per_ha_minor": 103951237
      },
      "area_ha": 1.0
    }
  ],
  "exclusions": [],
  "all_negative_returns": false,
  "stress_assumptions": {
    "price_discount": 0.15,
    "yield_discount": 0.2
  }
};
