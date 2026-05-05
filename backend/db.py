from __future__ import annotations

from typing import Any

from datetime import datetime

from motor.motor_asyncio import AsyncIOMotorClient

from .config import Settings


class MongoStore:
    def __init__(self, settings: Settings) -> None:
        self._client = AsyncIOMotorClient(settings.mongodb_uri)
        self._db = self._client[settings.mongodb_db]
        self._collection = self._db[settings.mongodb_collection]
        self._users = self._db["users"]
        self._reports = self._db["reports"]
        self._medications = self._db["medications"]
        self._medication_logs = self._db["medication_logs"]

    async def insert_prediction(self, doc: dict[str, Any]) -> str:
        result = await self._collection.insert_one(doc)
        return str(result.inserted_id)

    async def list_predictions(self, limit: int = 20) -> list[dict[str, Any]]:
        cursor = self._collection.find({}).sort("createdAt", -1).limit(limit)
        return await self._serialize_cursor(cursor)

    async def list_predictions_by_user(self, user_id: str, limit: int = 20) -> list[dict[str, Any]]:
        cursor = (
            self._collection.find({"type": "vitals", "userId": user_id})
            .sort("createdAt", -1)
            .limit(limit)
        )
        return await self._serialize_cursor(cursor)

    async def list_chat_by_user(self, user_id: str, limit: int = 20) -> list[dict[str, Any]]:
        cursor = (
            self._collection.find({"type": "chat", "userId": user_id})
            .sort("createdAt", -1)
            .limit(limit)
        )
        return await self._serialize_cursor(cursor)

    async def _serialize_cursor(self, cursor) -> list[dict[str, Any]]:
        results: list[dict[str, Any]] = []
        async for item in cursor:
            # Convert ObjectId to string so it serializes cleanly.
            item["_id"] = str(item["_id"])
            # Convert datetime to ISO string for JSON serialization.
            for k, v in list(item.items()):
                if isinstance(v, datetime):
                    item[k] = v.isoformat()
            results.append(item)
        return results

    async def ensure_user_indexes(self) -> None:
        # Unique email.
        await self._users.create_index("email", unique=True)

    async def find_user_by_email(self, email: str) -> dict[str, Any] | None:
        return await self._users.find_one({"email": email})

    async def find_user_by_id(self, user_id: str) -> dict[str, Any] | None:
        from bson import ObjectId

        try:
            oid = ObjectId(user_id)
        except Exception:
            return None
        return await self._users.find_one({"_id": oid})

    async def create_user(self, doc: dict[str, Any]) -> str:
        result = await self._users.insert_one(doc)
        return str(result.inserted_id)

    async def update_user_profile(self, user_id: str, updates: dict[str, Any]) -> bool:
        from bson import ObjectId

        try:
            oid = ObjectId(user_id)
        except Exception:
            return False
        result = await self._users.update_one({"_id": oid}, {"$set": updates})
        return result.matched_count > 0

    async def update_user_fields(self, user_id: str, updates: dict[str, Any]) -> bool:
        from bson import ObjectId

        try:
            oid = ObjectId(user_id)
        except Exception:
            return False
        result = await self._users.update_one({"_id": oid}, {"$set": updates})
        return result.matched_count > 0

    async def insert_report(self, doc: dict[str, Any]) -> str:
        result = await self._reports.insert_one(doc)
        return str(result.inserted_id)

    async def list_reports_by_user(self, user_id: str, limit: int = 20) -> list[dict[str, Any]]:
        cursor = self._reports.find({"userId": user_id}).sort("createdAt", -1).limit(limit)
        docs = await self._serialize_cursor(cursor)
        # Keep the payload small for the UI; the AI analysis endpoint loads text as needed.
        for d in docs:
            d.pop("extractedText", None)
            d.pop("filePath", None)
        return docs

    async def list_report_metrics_by_user(self, user_id: str, limit: int = 100) -> list[dict[str, Any]]:
        cursor = self._reports.find({"userId": user_id}).sort("createdAt", -1).limit(limit)
        docs = await self._serialize_cursor(cursor)
        metrics: list[dict[str, Any]] = []
        for doc in docs:
            for m in doc.get("metrics", []):
                metrics.append(
                    {
                        "reportId": doc.get("_id"),
                        "createdAt": doc.get("createdAt"),
                        "reportName": doc.get("reportName"),
                        "reportType": doc.get("reportType"),
                        **m,
                    }
                )
        return metrics

    async def find_report_by_id_and_user(self, report_id: str, user_id: str) -> dict[str, Any] | None:
        from bson import ObjectId

        try:
            oid = ObjectId(report_id)
        except Exception:
            return None
        return await self._reports.find_one({"_id": oid, "userId": user_id})

    async def find_latest_report_by_user(self, user_id: str) -> dict[str, Any] | None:
        doc = await self._reports.find_one({"userId": user_id}, sort=[("createdAt", -1)])
        return doc

    async def update_report_analysis(
        self, report_id: str, user_id: str, updates: dict[str, Any]
    ) -> bool:
        from bson import ObjectId

        try:
            oid = ObjectId(report_id)
        except Exception:
            return False
        result = await self._reports.update_one({"_id": oid, "userId": user_id}, {"$set": updates})
        return result.matched_count > 0

    async def insert_medication(self, doc: dict[str, Any]) -> str:
        result = await self._medications.insert_one(doc)
        return str(result.inserted_id)

    async def list_medications_by_user(
        self, user_id: str, include_inactive: bool = False, limit: int = 200
    ) -> list[dict[str, Any]]:
        query: dict[str, Any] = {"userId": user_id}
        if not include_inactive:
            query["isActive"] = True
        cursor = self._medications.find(query).sort("createdAt", -1).limit(limit)
        return await self._serialize_cursor(cursor)

    async def update_medication(self, medication_id: str, user_id: str, updates: dict[str, Any]) -> bool:
        from bson import ObjectId

        try:
            oid = ObjectId(medication_id)
        except Exception:
            return False
        result = await self._medications.update_one({"_id": oid, "userId": user_id}, {"$set": updates})
        return result.matched_count > 0

    async def find_medication_by_id_and_user(self, medication_id: str, user_id: str) -> dict[str, Any] | None:
        from bson import ObjectId

        try:
            oid = ObjectId(medication_id)
        except Exception:
            return None
        return await self._medications.find_one({"_id": oid, "userId": user_id})

    async def insert_medication_log(self, doc: dict[str, Any]) -> str:
        result = await self._medication_logs.insert_one(doc)
        return str(result.inserted_id)

    async def list_medication_logs_by_user(
        self, user_id: str, since_dt: datetime | None = None, limit: int = 300
    ) -> list[dict[str, Any]]:
        query: dict[str, Any] = {"userId": user_id}
        if since_dt is not None:
            query["createdAt"] = {"$gte": since_dt}
        cursor = self._medication_logs.find(query).sort("createdAt", -1).limit(limit)
        return await self._serialize_cursor(cursor)

