from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


DATA_PATH_DEFAULT = os.path.join(
    os.path.dirname(__file__), "..", "..", "backend", "data", "CVD_cleaned.csv"
)


def derive_overall_risk(df: pd.DataFrame) -> pd.Series:
    major_cols = ["Heart_Disease", "Diabetes", "Arthritis", "Depression"]

    def is_yes(v: Any) -> bool:
        if v is None:
            return False
        s = str(v).strip()
        if not s:
            return False
        # Diabetes has additional "Yes, but ..." variants in this dataset.
        if s.lower().startswith("yes"):
            return True
        return s == "Yes"

    major_yes = pd.Series(False, index=df.index)
    for col in major_cols:
        major_yes |= df[col].apply(is_yes)

    risk = pd.Series(index=df.index, dtype="object")
    # If any major condition is yes -> High.
    risk[major_yes] = "High"

    # Else derive from General_Health:
    gh = df["General_Health"].astype(str).str.strip()
    mask = ~major_yes
    risk.loc[mask & (gh == "Poor")] = "High"
    risk.loc[mask & (gh == "Fair")] = "Medium"
    risk.loc[mask & gh.isin(["Good", "Very Good", "Excellent"])] = "Low"

    # Any unexpected value: default to Medium.
    risk.fillna("Medium", inplace=True)
    return risk


def build_pipeline(df: pd.DataFrame) -> tuple[Pipeline, list[str], list[str]]:
    numeric_cols = [
        "Height_(cm)",
        "Weight_(kg)",
        "BMI",
        "Alcohol_Consumption",
        "Fruit_Consumption",
        "Green_Vegetables_Consumption",
        "FriedPotato_Consumption",
    ]

    # Exclude the major condition columns: they are only used to derive the label.
    excluded_feature_cols = {"Heart_Disease", "Diabetes", "Arthritis", "Depression", "overall_risk"}
    feature_cols = [c for c in df.columns if c not in excluded_feature_cols]

    # Keep only columns we can preprocess.
    categorical_cols = [c for c in feature_cols if c not in numeric_cols]
    categorical_cols = [c for c in categorical_cols if c not in numeric_cols]

    preprocessor = ColumnTransformer(
        transformers=[
            ("cat", OneHotEncoder(handle_unknown="ignore"), categorical_cols),
            ("num", StandardScaler(), numeric_cols),
        ],
        remainder="drop",
        verbose_feature_names_out=False,
    )

    clf = LogisticRegression(
        max_iter=2000,
        multi_class="multinomial",
        solver="lbfgs",
        class_weight="balanced",
    )

    pipeline = Pipeline(steps=[("preprocessor", preprocessor), ("clf", clf)])
    return pipeline, feature_cols, categorical_cols


def train(
    data_path: str = DATA_PATH_DEFAULT,
    artifacts_dir: str | None = None,
) -> None:
    if artifacts_dir is None:
        artifacts_dir = os.path.join(os.path.dirname(__file__), "..", "artifacts")

    artifacts = Path(artifacts_dir)
    artifacts.mkdir(parents=True, exist_ok=True)

    df = pd.read_csv(data_path)

    # Basic sanity
    required_cols = [
        "General_Health",
        "Checkup",
        "Exercise",
        "Heart_Disease",
        "Skin_Cancer",
        "Other_Cancer",
        "Depression",
        "Diabetes",
        "Arthritis",
        "Sex",
        "Age_Category",
        "Height_(cm)",
        "Weight_(kg)",
        "BMI",
        "Smoking_History",
        "Alcohol_Consumption",
        "Fruit_Consumption",
        "Green_Vegetables_Consumption",
        "FriedPotato_Consumption",
    ]
    missing = [c for c in required_cols if c not in df.columns]
    if missing:
        raise RuntimeError(f"Missing required columns: {missing}")

    df["overall_risk"] = derive_overall_risk(df)

    pipeline, feature_cols, categorical_cols = build_pipeline(df)

    X = df[feature_cols].copy()
    y = df["overall_risk"].copy()

    # Stratified split for stable metrics.
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.15, random_state=42, stratify=y
    )

    pipeline.fit(X_train, y_train)

    # Quick training report (stdout only; artifacts store meta).
    test_acc = float(pipeline.score(X_test, y_test))
    model_classes = list(pipeline.named_steps["clf"].classes_)
    print(f"[train] test_accuracy={test_acc:.4f} classes={model_classes}")

    model_path = artifacts / "model.joblib"
    meta_path = artifacts / "meta.json"

    joblib.dump(pipeline, model_path)

    meta: dict[str, Any] = {
        "feature_cols": feature_cols,
        "numeric_cols": [
            "Height_(cm)",
            "Weight_(kg)",
            "BMI",
            "Alcohol_Consumption",
            "Fruit_Consumption",
            "Green_Vegetables_Consumption",
            "FriedPotato_Consumption",
        ],
        "categorical_cols": categorical_cols,
        "label_map": {
            "Low": 0,
            "Medium": 1,
            "High": 2,
        },
        "risk_to_score": {
            "Low": 100,
            "Medium": 60,
            "High": 20,
        },
        "model_classes": model_classes,
        "test_accuracy": test_acc,
        "data_path": data_path,
    }
    meta_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")


if __name__ == "__main__":
    train()

