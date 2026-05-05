import os
from dataclasses import dataclass

from dotenv import load_dotenv


_ENV_PATH = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(_ENV_PATH, override=False)


@dataclass(frozen=True)
class Settings:
    mongodb_uri: str
    mongodb_db: str
    mongodb_collection: str
    model_path: str
    meta_path: str


def load_settings() -> Settings:
    # Default to a local Mongo instance for easier local development.
    mongodb_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017").strip()

    mongodb_db = os.getenv("MONGODB_DB", "croniccareai").strip()
    mongodb_collection = os.getenv("MONGODB_COLLECTION", "predictions").strip()

    # Paths are relative to the repo root (workspace).
    model_path = os.getenv(
        "MODEL_PATH",
        os.path.join(os.path.dirname(__file__), "artifacts", "model.joblib"),
    ).strip()
    meta_path = os.getenv(
        "META_PATH",
        os.path.join(os.path.dirname(__file__), "artifacts", "meta.json"),
    ).strip()

    return Settings(
        mongodb_uri=mongodb_uri,
        mongodb_db=mongodb_db,
        mongodb_collection=mongodb_collection,
        model_path=model_path,
        meta_path=meta_path,
    )

