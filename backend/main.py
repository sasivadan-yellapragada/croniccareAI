from __future__ import annotations

import json
import os
import random
import smtplib
import shutil
from datetime import datetime, timedelta
from email.message import EmailMessage
from pathlib import Path
from typing import Any, Optional

import httpx
import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException, Header, UploadFile, File, Form
from fastapi.responses import JSONResponse
from groq import Groq

from .config import load_settings
from .db import MongoStore
from .auth import create_access_token, decode_access_token, hash_password, verify_password
from .models import (
    Advice,
    AuthResponse,
    ChatRequest,
    ChatResponse,
    ChatMessage,
    HealthProfileRequest,
    AnalyzeReportRequest,
    AnalyzeReportResponse,
    MedicationUpsertRequest,
    MedicationAiAdvisoryResponse,
    MedicationRemindersRequest,
    MedicationAdherenceRequest,
    DoctorNotificationRequest,
    CriticalAlertsResponse,
    CriticalAlertItem,
    LoginRequest,
    PasswordResetRequest,
    PredictRequest,
    PredictResponse,
    ProfileUpdateRequest,
    SignupRequest,
)
from .rag.retriever import TfidfRetriever
from .report_parser import extract_text_from_file, parse_metrics
from .report_ai import analyze_report


def _bmi_from_height_weight(height_cm: float, weight_kg: float) -> float:
    height_m = height_cm / 100.0
    if height_m <= 0:
        return 0.0
    return float(weight_kg / (height_m * height_m))


def _generate_advice(risk: str, features: dict[str, Any]) -> Advice:
    # Rule-based advice: stable + fast, and can be replaced later with LLM if desired.
    exercise = str(features.get("Exercise", "")).strip()
    bmi = float(features.get("BMI", 0) or 0)
    gh = str(features.get("General_Health", "")).strip()

    if risk == "High":
        food = (
            "Focus on low-glycemic, high-fiber meals. Reduce refined sugars and white carbs, and prioritize "
            "vegetables, legumes, and lean proteins."
        )
        activity = (
            "Aim for 20-40 minutes of moderate movement most days (brisk walking, cycling, or swimming). Start "
            "slowly and build up."
        )
        hydration = (
            "Stay well-hydrated (8–10 cups/day). If you monitor symptoms, pair hydration with your clinician's "
            "guidance."
        )
        sleep = "Prioritize 7–8 hours of sleep. Keep a consistent schedule and avoid heavy meals late at night."
    elif risk == "Medium":
        food = (
            "Make gradual improvements: increase fiber (vegetables/whole grains) and limit processed carbs. Keep "
            "portions consistent."
        )
        activity = (
            "Try to get 25–35 minutes of daily activity. If you have joint discomfort, choose low-impact options."
        )
        hydration = "Drink 6–8 cups of water daily. Herbal teas can help too."
        sleep = "Aim for 7–9 hours of sleep. Consistency matters more than perfection."
    else:
        food = (
            "You're in a strong position. Maintain balanced meals with plenty of vegetables, healthy fats, and "
            "adequate protein."
        )
        activity = "Keep moving regularly - 20-30 minutes daily is a great baseline."
        hydration = "Stay hydrated (roughly 6–8 cups/day). Listen to your thirst and adjust for activity."
        sleep = "Keep a consistent bedtime routine. Quality sleep supports glucose and blood pressure regulation."

    # Light personalization from inputs.
    if gh in ("Poor", "Fair") and risk != "Low":
        food += " Consider tracking your meals briefly to identify patterns."
    if exercise == "No" and risk == "High":
        activity += " If you're new to exercise, begin with short 10-minute walks."
    if bmi >= 30 and risk != "Low":
        activity += " For comfort, choose joint-friendly activities and consider professional guidance."

    return Advice(food=food, activity=activity, hydration=hydration, sleep=sleep)


settings = load_settings()
mongo = MongoStore(settings)

app = FastAPI(title="CronicCareAI Backend")

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile").strip()
_groq_client: Groq | None = None
if GROQ_API_KEY:
    # Some environments inject HTTP(S)_PROXY and that can break Groq calls locally.
    # We explicitly bypass env proxies to keep direct API connectivity reliable.
    _groq_client = Groq(api_key=GROQ_API_KEY, http_client=httpx.Client(trust_env=False, timeout=30.0))

_retriever = TfidfRetriever(
    kb_path=os.path.join(os.path.dirname(__file__), "rag", "kb.md")
)
_upload_root = Path(os.path.join(os.path.dirname(__file__), "uploads", "reports"))
_upload_root.mkdir(parents=True, exist_ok=True)


MODEL = None
META: dict[str, Any] | None = None


def _load_artifacts() -> None:
    global MODEL, META
    if not os.path.exists(settings.model_path):
        raise RuntimeError(f"Model file not found at {settings.model_path}. Run training first.")
    if not os.path.exists(settings.meta_path):
        raise RuntimeError(f"Meta file not found at {settings.meta_path}. Run training first.")

    MODEL = joblib.load(settings.model_path)
    META = json.loads(open(settings.meta_path, "r", encoding="utf-8").read())


@app.on_event("startup")
def startup_event() -> None:
    _load_artifacts()
    _retriever.load()
    # Ensure indexes exist (users.email unique).
    # Fire-and-forget index creation at startup.
    try:
        import asyncio

        loop = asyncio.get_event_loop()
        if loop.is_running():
            loop.create_task(mongo.ensure_user_indexes())
        else:
            loop.run_until_complete(mongo.ensure_user_indexes())
    except Exception:
        pass


FEATURE_KEY_TO_COLUMN: dict[str, str] = {
    "generalHealth": "General_Health",
    "checkup": "Checkup",
    "exercise": "Exercise",
    "skinCancer": "Skin_Cancer",
    "otherCancer": "Other_Cancer",
    "sex": "Sex",
    "ageCategory": "Age_Category",
    "smokingHistory": "Smoking_History",
    "alcoholConsumption": "Alcohol_Consumption",
    "fruitConsumption": "Fruit_Consumption",
    "greenVegetablesConsumption": "Green_Vegetables_Consumption",
    "friedPotatoConsumption": "FriedPotato_Consumption",
}


def _request_to_features(req: PredictRequest) -> dict[str, Any]:
    # Convert frontend-friendly keys into the exact CSV column names expected by training.
    features: dict[str, Any] = {}
    for key, col in FEATURE_KEY_TO_COLUMN.items():
        features[col] = getattr(req, key)  # type: ignore[attr-defined]

    # BMI must match how training computed it (we used dataset BMI, which should be consistent with formula).
    features["BMI"] = _bmi_from_height_weight(req.heightCm, req.weightKg)
    features["Height_(cm)"] = req.heightCm
    features["Weight_(kg)"] = req.weightKg

    return features


def _current_user_id_from_auth_header(authorization: Optional[str]) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    return str(payload["sub"])


def _sanitize_user(user: dict[str, Any]) -> dict[str, Any]:
    return {
        "_id": str(user.get("_id")),
        "email": user.get("email"),
        "name": user.get("name"),
        "patientId": user.get("patientId"),
        "healthProfileCompleted": bool(user.get("healthProfileCompleted", False)),
        "profile": user.get("profile", {}),
    }


def _safe_disclaimer() -> str:
    return "This is not medical advice. Please consult a healthcare professional."


def _fallback_report_analysis(
    *,
    report_type: str,
    mode: str,
    metrics: list[dict[str, Any]],
    out_of_range: list[dict[str, Any]],
) -> dict[str, Any]:
    flagged = [m for m in out_of_range if isinstance(m, dict)]
    metric_labels = [str(m.get("label") or m.get("key") or "metric") for m in flagged[:6]]
    summary_bits: list[str] = []
    if metric_labels:
        summary_bits.append(f"Detected out-of-range metrics: {', '.join(metric_labels)}.")
    else:
        summary_bits.append("No major out-of-range metrics were detected from extracted report values.")
    summary_bits.append(f"Report type: {report_type}.")
    summary_bits.append("AI network was unavailable, so this is a safe fallback summary.")

    food: list[str] = [
        "Prefer whole foods, high-fiber vegetables, and adequate hydration.",
        "Reduce added sugar and highly processed packaged foods.",
    ]
    exercise: list[str] = [
        "Aim for regular moderate activity such as brisk walking.",
        "Keep movement consistent and discuss safe intensity with your clinician.",
    ]
    meds: list[str] = []
    if mode == "medications" or metric_labels:
        meds = [
            "Discuss these out-of-range findings with your doctor before changing medicines.",
            "Ask whether repeat testing or medication review is needed based on trends.",
        ]
    safety = [
        _safe_disclaimer(),
        "If you have severe symptoms (chest pain, breathlessness, fainting), seek urgent care.",
    ]
    return {
        "summary": " ".join(summary_bits),
        "foodHabits": food,
        "exerciseIdeas": exercise,
        "medicationsToDiscuss": meds,
        "safetyNotes": safety,
    }


def _critical_alerts_from_prediction_doc(doc: dict[str, Any]) -> list[CriticalAlertItem]:
    alerts: list[CriticalAlertItem] = []
    input_data = (doc or {}).get("input") or {}
    prediction = (doc or {}).get("prediction") or {}

    systolic = input_data.get("systolicBp")
    diastolic = input_data.get("diastolicBp")
    heart_rate = input_data.get("heartRate")
    sleep_hours = input_data.get("sleepHours")
    risk = prediction.get("risk")

    if isinstance(systolic, (int, float)) and float(systolic) > 140:
        alerts.append(
            CriticalAlertItem(
                key="bp_systolic",
                severity="high" if float(systolic) <= 180 else "critical",
                title="High systolic blood pressure",
                detail=f"Systolic BP is {int(systolic)} mmHg (threshold > 140).",
            )
        )
    if isinstance(diastolic, (int, float)) and float(diastolic) > 90:
        alerts.append(
            CriticalAlertItem(
                key="bp_diastolic",
                severity="high" if float(diastolic) <= 120 else "critical",
                title="High diastolic blood pressure",
                detail=f"Diastolic BP is {int(diastolic)} mmHg (threshold > 90).",
            )
        )
    if isinstance(heart_rate, (int, float)) and (float(heart_rate) > 110 or float(heart_rate) < 50):
        alerts.append(
            CriticalAlertItem(
                key="heart_rate",
                severity="high" if 45 <= float(heart_rate) <= 130 else "critical",
                title="Abnormal heart rate",
                detail=f"Heart rate is {int(heart_rate)} bpm (typical resting range ~50-110).",
            )
        )
    if isinstance(sleep_hours, (int, float)) and float(sleep_hours) < 5:
        alerts.append(
            CriticalAlertItem(
                key="sleep_low",
                severity="high",
                title="Low sleep duration",
                detail=f"Sleep is {float(sleep_hours):.1f} hours (< 5 hours).",
            )
        )
    if str(risk) == "High":
        alerts.append(
            CriticalAlertItem(
                key="predicted_risk",
                severity="high",
                title="Predicted high chronic risk",
                detail="Latest model prediction is High risk. Consider clinician follow-up.",
            )
        )
    return alerts


@app.post("/api/predict", response_model=PredictResponse)
async def predict(req: PredictRequest, authorization: Optional[str] = Header(default=None)) -> PredictResponse:
    if MODEL is None or META is None:
        raise HTTPException(status_code=500, detail="Model artifacts not loaded yet.")

    try:
        user_id = _current_user_id_from_auth_header(authorization)
        features = _request_to_features(req)
        X = pd.DataFrame([features])

        # predict_proba returns columns in the same order as model.classes_
        proba = MODEL.predict_proba(X)[0]
        classes = list(META.get("model_classes") or MODEL.named_steps["clf"].classes_)

        proba_by_class: dict[str, float] = {}
        for label, p in zip(classes, proba):
            proba_by_class[str(label)] = float(p)

        # Determine predicted risk and score.
        risk = max(proba_by_class.keys(), key=lambda k: proba_by_class[k])

        score_map = META.get("risk_to_score", {"Low": 100, "Medium": 60, "High": 20})
        score = int(round(float(score_map.get(risk, 50))))

        advice = _generate_advice(risk, features)

        doc = {
            "type": "vitals",
            "userId": user_id,
            "createdAt": datetime.utcnow(),
            "input": req.model_dump(),
            "features": features,
            "prediction": {
                "risk": risk,
                "score": score,
                "probabilities": proba_by_class,
                "advice": advice.model_dump(),
            },
        }
        prediction_id = await mongo.insert_prediction(doc)

        return PredictResponse(
            risk=risk,
            score=score,
            probabilities=proba_by_class,
            advice=advice,
            predictionId=prediction_id,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {e}")


@app.get("/api/predictions")
async def list_predictions(limit: int = 20) -> JSONResponse:
    items = await mongo.list_predictions(limit=limit)
    return JSONResponse({"items": items})


@app.get("/api/predictions/me")
async def list_my_predictions(
    limit: int = 20, authorization: Optional[str] = Header(default=None)
) -> JSONResponse:
    user_id = _current_user_id_from_auth_header(authorization)
    items = await mongo.list_predictions_by_user(user_id=user_id, limit=limit)
    return JSONResponse({"items": items})


@app.post("/api/auth/signup", response_model=AuthResponse)
async def signup(req: SignupRequest) -> AuthResponse:
    email = req.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Invalid email")
    if not req.password or len(req.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    existing = await mongo.find_user_by_email(email)
    if existing is not None:
        raise HTTPException(status_code=409, detail="Email already in use")

    user_doc = {
        "email": email,
        "name": (req.name or "").strip() or None,
        "passwordHash": hash_password(req.password),
        "patientId": str(random.randint(10000, 99999)),
        "healthProfileCompleted": False,
        "profile": {
            "age": None,
            "sex": None,
            "bloodGroup": None,
            "height": None,
            "weight": None,
            "contact": None,
            "bmi": None,
            "previousDiseases": [],
            "chronicDiseases": [],
        },
        "createdAt": datetime.utcnow(),
    }
    user_id = await mongo.create_user(user_doc)
    token = create_access_token(subject=user_id)
    user_payload = _sanitize_user({"_id": user_id, **user_doc})
    return AuthResponse(accessToken=token, user=user_payload, needsOnboarding=True)


@app.post("/api/auth/login", response_model=AuthResponse)
async def login(req: LoginRequest) -> AuthResponse:
    email = req.email.strip().lower()
    user = await mongo.find_user_by_email(email)
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not verify_password(req.password, user.get("passwordHash", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user_id = str(user["_id"])
    token = create_access_token(subject=user_id)
    user_payload = _sanitize_user(user)
    return AuthResponse(
        accessToken=token,
        user=user_payload,
        needsOnboarding=not bool(user.get("healthProfileCompleted", False)),
    )


@app.get("/api/auth/me")
async def me(authorization: Optional[str] = Header(default=None)) -> JSONResponse:
    user_id = _current_user_id_from_auth_header(authorization)
    user = await mongo.find_user_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return JSONResponse(_sanitize_user(user))


@app.post("/api/auth/health-profile")
async def save_health_profile(
    req: HealthProfileRequest, authorization: Optional[str] = Header(default=None)
) -> JSONResponse:
    user_id = _current_user_id_from_auth_header(authorization)
    updates = {
        "healthProfileCompleted": True,
        "profile": {
            "age": req.age,
            "sex": req.sex,
            "bloodGroup": req.bloodGroup,
            "height": req.height,
            "weight": req.weight,
            "contact": req.contact,
            "bmi": req.bmi,
            "previousDiseases": req.previousDiseases,
            "chronicDiseases": req.chronicDiseases,
        },
        "profileUpdatedAt": datetime.utcnow(),
    }
    ok = await mongo.update_user_profile(user_id=user_id, updates=updates)
    if not ok:
        raise HTTPException(status_code=404, detail="User not found")
    user = await mongo.find_user_by_id(user_id)
    return JSONResponse({"ok": True, "user": _sanitize_user(user or {})})


@app.put("/api/auth/profile")
async def update_profile(
    req: ProfileUpdateRequest, authorization: Optional[str] = Header(default=None)
) -> JSONResponse:
    user_id = _current_user_id_from_auth_header(authorization)
    user = await mongo.find_user_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    existing_profile = user.get("profile") or {}
    updates = {
        "name": (req.name or "").strip() or None,
        "profile": {
            "age": req.age if req.age is not None else existing_profile.get("age"),
            "sex": req.sex if req.sex is not None else existing_profile.get("sex"),
            "bloodGroup": req.bloodGroup if req.bloodGroup is not None else existing_profile.get("bloodGroup"),
            "height": req.height if req.height is not None else existing_profile.get("height"),
            "weight": req.weight if req.weight is not None else existing_profile.get("weight"),
            "contact": req.contact if req.contact is not None else existing_profile.get("contact"),
            "bmi": req.bmi if req.bmi is not None else existing_profile.get("bmi"),
            "previousDiseases": req.previousDiseases
            if req.previousDiseases
            else existing_profile.get("previousDiseases", []),
            "chronicDiseases": req.chronicDiseases
            if req.chronicDiseases
            else existing_profile.get("chronicDiseases", []),
        },
        "profileUpdatedAt": datetime.utcnow(),
    }
    ok = await mongo.update_user_fields(user_id=user_id, updates=updates)
    if not ok:
        raise HTTPException(status_code=404, detail="User not found")
    updated = await mongo.find_user_by_id(user_id)
    return JSONResponse({"ok": True, "user": _sanitize_user(updated or {})})


async def _reset_password_impl(
    req: PasswordResetRequest, authorization: Optional[str] = Header(default=None)
) -> JSONResponse:
    user_id = _current_user_id_from_auth_header(authorization)
    user = await mongo.find_user_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if not verify_password(req.currentPassword, user.get("passwordHash", "")):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    if len(req.newPassword or "") < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")
    if verify_password(req.newPassword, user.get("passwordHash", "")):
        raise HTTPException(status_code=400, detail="New password must be different")

    ok = await mongo.update_user_fields(
        user_id=user_id,
        updates={"passwordHash": hash_password(req.newPassword), "passwordUpdatedAt": datetime.utcnow()},
    )
    if not ok:
        raise HTTPException(status_code=404, detail="User not found")
    return JSONResponse({"ok": True})


@app.post("/api/auth/password-reset")
async def reset_password(
    req: PasswordResetRequest, authorization: Optional[str] = Header(default=None)
) -> JSONResponse:
    return await _reset_password_impl(req=req, authorization=authorization)


@app.post("/api/auth/reset-password")
async def reset_password_alias(
    req: PasswordResetRequest, authorization: Optional[str] = Header(default=None)
) -> JSONResponse:
    return await _reset_password_impl(req=req, authorization=authorization)


@app.post("/api/auth/change-password")
async def change_password_alias(
    req: PasswordResetRequest, authorization: Optional[str] = Header(default=None)
) -> JSONResponse:
    return await _reset_password_impl(req=req, authorization=authorization)


def _system_prompt() -> str:
    return (
        "You are ChronicCare AI, a supportive chronic-disease self-management assistant. "
        "Be practical, calm, and evidence-informed. "
        "You must not diagnose or replace a clinician. "
        "If the user reports emergency symptoms (chest pain, stroke symptoms, severe shortness of breath, fainting, "
        "severe hypo/hyperglycemia), tell them to seek urgent medical care. "
        "Prefer short actionable steps, and ask 1-2 clarifying questions when needed."
    )


@app.post("/api/chat", response_model=ChatResponse)
async def chat(req: ChatRequest, authorization: Optional[str] = Header(default=None)) -> ChatResponse:
    if _groq_client is None:
        raise HTTPException(status_code=500, detail="Missing GROQ_API_KEY on server.")
    user_id = _current_user_id_from_auth_header(authorization)
    user = await mongo.find_user_by_id(user_id)
    latest_predictions = await mongo.list_predictions_by_user(user_id=user_id, limit=1)
    latest_prediction = latest_predictions[0] if latest_predictions else {}
    latest_input = latest_prediction.get("input") if isinstance(latest_prediction, dict) else {}
    latest_risk = (
        (latest_prediction.get("prediction") or {}).get("risk")
        if isinstance(latest_prediction, dict)
        else None
    )

    # Use the last user message for retrieval.
    last_user = next((m for m in reversed(req.messages) if m.role == "user"), None)
    query = last_user.content if last_user else ""
    retrieved = _retriever.retrieve(query, k=4)
    context_blocks = [r.chunk for r in retrieved if r.score > 0.02]

    context = "\n\n---\n\n".join(context_blocks) if context_blocks else ""
    rag_prefix = (
        "Use the following knowledge base excerpts when relevant. If not relevant, ignore them.\n\n"
        f"{context}"
    ).strip()

    messages = [{"role": "system", "content": _system_prompt()}]
    if user:
        profile = user.get("profile") or {}
        user_context = {
            "name": user.get("name"),
            "age": profile.get("age"),
            "sex": profile.get("sex"),
            "chronicDiseases": profile.get("chronicDiseases", []),
            "previousDiseases": profile.get("previousDiseases", []),
            "latestRisk": latest_risk,
            "latestBp": {
                "systolic": (latest_input or {}).get("systolicBp"),
                "diastolic": (latest_input or {}).get("diastolicBp"),
            },
            "latestHeartRate": (latest_input or {}).get("heartRate"),
            "latestSleepHours": (latest_input or {}).get("sleepHours"),
        }
        messages.append(
            {
                "role": "system",
                "content": (
                    "Personalize responses using this user context when relevant. "
                    "Do not mention unavailable fields.\n"
                    f"{json.dumps(user_context)}"
                ),
            }
        )
    if context:
        messages.append({"role": "system", "content": rag_prefix})
    # Forward last ~12 messages to keep latency reasonable.
    for m in req.messages[-12:]:
        if m.role == "system":
            continue
        messages.append({"role": m.role, "content": m.content})

    try:
        completion = _groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=messages,
            temperature=0.4,
            max_tokens=512,
        )
        content = completion.choices[0].message.content or ""
        assistant_msg = ChatMessage(role="assistant", content=content)

        await mongo.insert_prediction(
            {
                "createdAt": datetime.utcnow(),
                "type": "chat",
                "userId": user_id,
                "predictionId": req.predictionId,
                "messages": [m.model_dump() for m in req.messages] + [assistant_msg.model_dump()],
                "sources": [r.chunk for r in retrieved[:3]],
            }
        )

        return ChatResponse(
            message=assistant_msg,
            sources=[f"kb.md (score={r.score:.3f})" for r in retrieved[:3] if r.score > 0.02],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat failed: {e}")


@app.get("/api/chat/me")
async def list_my_chat(limit: int = 20, authorization: Optional[str] = Header(default=None)) -> JSONResponse:
    user_id = _current_user_id_from_auth_header(authorization)
    items = await mongo.list_chat_by_user(user_id=user_id, limit=limit)
    return JSONResponse({"items": items})


@app.get("/api/alerts/critical/me", response_model=CriticalAlertsResponse)
async def list_my_critical_alerts(authorization: Optional[str] = Header(default=None)) -> CriticalAlertsResponse:
    user_id = _current_user_id_from_auth_header(authorization)
    latest_predictions = await mongo.list_predictions_by_user(user_id=user_id, limit=1)
    latest = latest_predictions[0] if latest_predictions else {}
    alerts = _critical_alerts_from_prediction_doc(latest if isinstance(latest, dict) else {})
    based_on = str(latest.get("_id")) if isinstance(latest, dict) and latest.get("_id") else None
    return CriticalAlertsResponse(alerts=alerts, basedOnPredictionId=based_on)


@app.post("/api/alerts/doctor-notify")
async def notify_doctor(
    req: DoctorNotificationRequest, authorization: Optional[str] = Header(default=None)
) -> JSONResponse:
    user_id = _current_user_id_from_auth_header(authorization)
    user = await mongo.find_user_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    latest_predictions = await mongo.list_predictions_by_user(user_id=user_id, limit=1)
    latest = latest_predictions[0] if latest_predictions else {}
    alerts = _critical_alerts_from_prediction_doc(latest if isinstance(latest, dict) else {})
    if not alerts:
        return JSONResponse({"ok": False, "sent": False, "detail": "No critical alerts to notify."})

    doctor_email = (req.doctorEmail or os.getenv("DOCTOR_EMAIL_DEFAULT", "")).strip()
    if not doctor_email:
        raise HTTPException(status_code=400, detail="Doctor email is required")

    smtp_host = os.getenv("SMTP_HOST", "").strip()
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "").strip()
    smtp_pass = os.getenv("SMTP_PASS", "").strip()
    smtp_from = os.getenv("SMTP_FROM", "").strip() or smtp_user
    if not smtp_host or not smtp_user or not smtp_pass or not smtp_from:
        return JSONResponse(
            {
                "ok": False,
                "sent": False,
                "detail": "SMTP not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM.",
            }
        )

    patient_name = (user.get("name") or user.get("email") or "Patient").strip()
    patient_id = str(user.get("patientId") or "N/A")
    alert_lines = "\n".join([f"- {a.title}: {a.detail}" for a in alerts])
    custom_message = (req.message or "").strip()

    msg = EmailMessage()
    msg["Subject"] = f"[ChronicCareAI] Critical vitals alert for {patient_name}"
    msg["From"] = smtp_from
    msg["To"] = doctor_email
    msg.set_content(
        (
            f"Patient: {patient_name}\n"
            f"Patient ID: {patient_id}\n\n"
            f"Detected alerts:\n{alert_lines}\n\n"
            f"{'Additional note: ' + custom_message if custom_message else ''}\n\n"
            "This message was generated by ChronicCareAI."
        )
    )

    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)
        return JSONResponse({"ok": True, "sent": True, "alertsCount": len(alerts), "to": doctor_email})
    except Exception as e:
        return JSONResponse({"ok": False, "sent": False, "detail": f"Failed to send email: {e}"})


@app.post("/api/reports/upload")
async def upload_report(
    file: UploadFile = File(...),
    reportType: str = Form(default="General"),
    authorization: Optional[str] = Header(default=None),
) -> JSONResponse:
    user_id = _current_user_id_from_auth_header(authorization)

    user_dir = _upload_root / user_id
    user_dir.mkdir(parents=True, exist_ok=True)
    safe_name = f"{int(datetime.utcnow().timestamp())}_{file.filename or 'report'}"
    target = user_dir / safe_name

    with target.open("wb") as out:
        shutil.copyfileobj(file.file, out)

    try:
        text = extract_text_from_file(str(target), mime_type=file.content_type)
    except Exception:
        text = ""
    extracted_text = (text or "").strip()
    extracted_text_truncated = extracted_text[:12000]
    metrics = parse_metrics(extracted_text)
    out_of_range = [m for m in metrics if m.get("status") in {"high", "low"}]

    doc = {
        "userId": user_id,
        "createdAt": datetime.utcnow(),
        "reportName": file.filename,
        "reportType": reportType,
        "filePath": str(target),
        "contentType": file.content_type,
        "textExtractLength": len(extracted_text),
        "extractedText": extracted_text_truncated,
        "metrics": metrics,
        "outOfRangeMetrics": out_of_range,
    }
    report_id = await mongo.insert_report(doc)

    return JSONResponse(
        {
            "reportId": report_id,
            "reportName": file.filename,
            "reportType": reportType,
            "metrics": metrics,
            "outOfRangeMetrics": out_of_range,
            "textExtractLength": len(extracted_text),
        }
    )


@app.get("/api/reports/me")
async def list_my_reports(limit: int = 20, authorization: Optional[str] = Header(default=None)) -> JSONResponse:
    user_id = _current_user_id_from_auth_header(authorization)
    items = await mongo.list_reports_by_user(user_id=user_id, limit=limit)
    return JSONResponse({"items": items})


@app.get("/api/reports/metrics/me")
async def list_my_report_metrics(
    limit: int = 100, authorization: Optional[str] = Header(default=None)
) -> JSONResponse:
    user_id = _current_user_id_from_auth_header(authorization)
    items = await mongo.list_report_metrics_by_user(user_id=user_id, limit=limit)
    return JSONResponse({"items": items})


@app.post("/api/reports/analyze", response_model=AnalyzeReportResponse)
async def analyze_report_endpoint(
    req: AnalyzeReportRequest,
    authorization: Optional[str] = Header(default=None),
) -> AnalyzeReportResponse:
    if _groq_client is None:
        raise HTTPException(status_code=500, detail="Groq API key not configured.")

    user_id = _current_user_id_from_auth_header(authorization)

    report_doc: dict[str, Any] | None = None
    if req.reportId:
        report_doc = await mongo.find_report_by_id_and_user(report_id=req.reportId, user_id=user_id)
    else:
        report_doc = await mongo.find_latest_report_by_user(user_id=user_id)

    if not report_doc:
        raise HTTPException(status_code=404, detail="Report not found.")

    report_id = str(report_doc.get("_id"))
    report_type = str(report_doc.get("reportType") or "General")
    mode = req.mode or "lifestyle"

    metrics = report_doc.get("metrics") or []
    out_of_range = report_doc.get("outOfRangeMetrics") or []

    extracted_text = str(report_doc.get("extractedText") or "").strip()
    if not extracted_text:
        # Fallback: re-extract from the stored filePath (only happens if extractedText is missing).
        file_path = report_doc.get("filePath")
        mime_type = report_doc.get("contentType")
        if file_path:
            extracted_text = extract_text_from_file(str(file_path), mime_type=str(mime_type or ""))
            extracted_text = (extracted_text or "").strip()[:12000]
            await mongo.update_report_analysis(
                report_id=report_id, user_id=user_id, updates={"extractedText": extracted_text}
            )

    analysis: dict[str, Any]
    try:
        analysis = await analyze_report(
            groq_client=_groq_client,
            groq_model=GROQ_MODEL,
            report_type=report_type,
            mode=mode,
            extracted_text=extracted_text[:12000],
            metrics=metrics,
            out_of_range=out_of_range,
        )
    except Exception:
        analysis = _fallback_report_analysis(
            report_type=report_type,
            mode=mode,
            metrics=metrics,
            out_of_range=out_of_range,
        )

    await mongo.update_report_analysis(
        report_id=report_id,
        user_id=user_id,
        updates={"aiAnalysis": analysis, "aiAnalysisUpdatedAt": datetime.utcnow()},
    )

    return AnalyzeReportResponse(reportId=report_id, analysis=analysis)


@app.post("/api/medications")
async def create_medication(
    req: MedicationUpsertRequest, authorization: Optional[str] = Header(default=None)
) -> JSONResponse:
    user_id = _current_user_id_from_auth_header(authorization)
    user = await mongo.find_user_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    name = (req.medicationName or "").strip()
    frequency = (req.frequency or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Medication name is required")
    if not frequency:
        raise HTTPException(status_code=400, detail="Frequency is required")

    doc = {
        "userId": user_id,
        "patientId": str(user.get("patientId") or ""),
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow(),
        "isActive": True,
        "medicationName": name,
        "dosage": (req.dosage or "").strip() or None,
        "frequency": frequency,
        "startDate": (req.startDate or "").strip() or None,
        "notes": (req.notes or "").strip() or None,
        "endDate": None,
    }
    medication_id = await mongo.insert_medication(doc)
    return JSONResponse({"ok": True, "medicationId": medication_id})


@app.get("/api/medications/me")
async def list_my_medications(
    includeHistory: bool = False, limit: int = 200, authorization: Optional[str] = Header(default=None)
) -> JSONResponse:
    user_id = _current_user_id_from_auth_header(authorization)
    items = await mongo.list_medications_by_user(
        user_id=user_id, include_inactive=includeHistory, limit=limit
    )
    return JSONResponse({"items": items})


@app.put("/api/medications/{medication_id}")
async def update_medication(
    medication_id: str, req: MedicationUpsertRequest, authorization: Optional[str] = Header(default=None)
) -> JSONResponse:
    user_id = _current_user_id_from_auth_header(authorization)
    existing = await mongo.find_medication_by_id_and_user(medication_id=medication_id, user_id=user_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Medication not found")

    name = (req.medicationName or "").strip()
    frequency = (req.frequency or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Medication name is required")
    if not frequency:
        raise HTTPException(status_code=400, detail="Frequency is required")

    ok = await mongo.update_medication(
        medication_id=medication_id,
        user_id=user_id,
        updates={
            "updatedAt": datetime.utcnow(),
            "medicationName": name,
            "dosage": (req.dosage or "").strip() or None,
            "frequency": frequency,
            "startDate": (req.startDate or "").strip() or None,
            "notes": (req.notes or "").strip() or None,
        },
    )
    if not ok:
        raise HTTPException(status_code=404, detail="Medication not found")
    return JSONResponse({"ok": True})


@app.delete("/api/medications/{medication_id}")
async def delete_medication(medication_id: str, authorization: Optional[str] = Header(default=None)) -> JSONResponse:
    user_id = _current_user_id_from_auth_header(authorization)
    ok = await mongo.update_medication(
        medication_id=medication_id,
        user_id=user_id,
        updates={"isActive": False, "updatedAt": datetime.utcnow(), "endDate": datetime.utcnow()},
    )
    if not ok:
        raise HTTPException(status_code=404, detail="Medication not found")
    return JSONResponse({"ok": True})


@app.put("/api/medications/{medication_id}/reminders")
async def set_medication_reminders(
    medication_id: str,
    req: MedicationRemindersRequest,
    authorization: Optional[str] = Header(default=None),
) -> JSONResponse:
    user_id = _current_user_id_from_auth_header(authorization)
    existing = await mongo.find_medication_by_id_and_user(medication_id=medication_id, user_id=user_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Medication not found")

    normalized: list[dict[str, Any]] = []
    for r in req.reminders:
        time_value = (r.time or "").strip()
        if not time_value or ":" not in time_value:
            continue
        days = [str(d).strip() for d in r.days if str(d).strip()]
        normalized.append({"time": time_value[:5], "days": days, "enabled": bool(r.enabled)})

    ok = await mongo.update_medication(
        medication_id=medication_id,
        user_id=user_id,
        updates={"reminders": normalized, "updatedAt": datetime.utcnow()},
    )
    if not ok:
        raise HTTPException(status_code=404, detail="Medication not found")
    return JSONResponse({"ok": True, "reminders": normalized})


@app.post("/api/medications/{medication_id}/adherence")
async def mark_medication_adherence(
    medication_id: str,
    req: MedicationAdherenceRequest,
    authorization: Optional[str] = Header(default=None),
) -> JSONResponse:
    user_id = _current_user_id_from_auth_header(authorization)
    med = await mongo.find_medication_by_id_and_user(medication_id=medication_id, user_id=user_id)
    if med is None:
        raise HTTPException(status_code=404, detail="Medication not found")

    taken_at = None
    if req.takenAt:
        try:
            taken_at = datetime.fromisoformat(req.takenAt)
        except Exception:
            taken_at = None
    if taken_at is None:
        taken_at = datetime.utcnow()

    log_doc = {
        "userId": user_id,
        "medicationId": medication_id,
        "medicationName": med.get("medicationName"),
        "status": req.status,
        "takenAt": taken_at,
        "note": (req.note or "").strip() or None,
        "createdAt": datetime.utcnow(),
    }
    log_id = await mongo.insert_medication_log(log_doc)
    return JSONResponse({"ok": True, "logId": log_id})


@app.get("/api/medications/adherence/me")
async def list_my_medication_adherence(
    days: int = 30, limit: int = 300, authorization: Optional[str] = Header(default=None)
) -> JSONResponse:
    user_id = _current_user_id_from_auth_header(authorization)
    safe_days = max(1, min(int(days), 365))
    since_dt = datetime.utcnow() - timedelta(days=safe_days)
    items = await mongo.list_medication_logs_by_user(user_id=user_id, since_dt=since_dt, limit=limit)
    return JSONResponse({"items": items})


@app.post("/api/medications/advisory", response_model=MedicationAiAdvisoryResponse)
async def medication_advisory(authorization: Optional[str] = Header(default=None)) -> MedicationAiAdvisoryResponse:
    user_id = _current_user_id_from_auth_header(authorization)
    disclaimer = _safe_disclaimer()

    # Build minimal patient context from latest vitals + latest report findings.
    latest_predictions = await mongo.list_predictions_by_user(user_id=user_id, limit=1)
    latest_reports = await mongo.list_reports_by_user(user_id=user_id, limit=1)
    latest_prediction = latest_predictions[0] if latest_predictions else {}
    latest_report = latest_reports[0] if latest_reports else {}

    risk = (
        str((latest_prediction.get("prediction") or {}).get("risk") or "").strip()
        if isinstance(latest_prediction, dict)
        else ""
    )
    out_metrics = []
    if isinstance(latest_report, dict):
        out_metrics = latest_report.get("outOfRangeMetrics") or []

    if _groq_client is None:
        # Deterministic fallback.
        suggestions: list[str] = []
        if risk == "High":
            suggestions.append("You may discuss cardiovascular risk management options with your doctor.")
            suggestions.append("Consider consulting your doctor about diabetes prevention or management options.")
        if any(str(m.get("key")) in {"ldl", "cholesterol_total", "triglycerides"} for m in out_metrics):
            suggestions.append("You may discuss cholesterol management options with your doctor.")
        if any(str(m.get("key")) in {"glucose", "hba1c"} for m in out_metrics):
            suggestions.append("Consider consulting your doctor about diabetes management options.")
        if any(str(m.get("key")) in {"creatinine", "urea"} for m in out_metrics):
            suggestions.append("You may discuss kidney-health follow-up options with your doctor.")
        if not suggestions:
            suggestions.append("Continue routine follow-ups and discuss preventive care options with your doctor.")
        return MedicationAiAdvisoryResponse(disclaimer=disclaimer, suggestions=suggestions[:5])

    prompt = (
        "You are a SAFE chronic-care assistant. Generate exactly 3-5 short suggestions for topics a patient may "
        "discuss with their doctor. "
        "DO NOT prescribe medication names as instructions, DO NOT provide dosage, DO NOT provide start/end plans. "
        "Only use wording like 'You may discuss ... with your doctor'. "
        "Return JSON only: {\"suggestions\": [\"...\"]}.\n\n"
        f"RISK: {risk or 'unknown'}\n"
        f"OUT_OF_RANGE_METRICS: {json.dumps(out_metrics[:10])}\n"
    )
    try:
        completion = _groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": "You return valid JSON only."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.1,
            max_tokens=220,
        )
        raw = completion.choices[0].message.content or ""
        parsed = json.loads(raw)
        suggestions = parsed.get("suggestions") if isinstance(parsed, dict) else []
        if not isinstance(suggestions, list):
            suggestions = []
        clean = [str(s).strip() for s in suggestions if str(s).strip()]
        if not clean:
            clean = ["Continue routine follow-ups and discuss preventive care options with your doctor."]
        # Hard safety filter: remove any line that contains explicit dose-like tokens.
        clean = [s for s in clean if "mg" not in s.lower() and "twice daily" not in s.lower()]
        if not clean:
            clean = ["Discuss your latest reports and risk profile with your doctor for personalized guidance."]
        return MedicationAiAdvisoryResponse(disclaimer=disclaimer, suggestions=clean[:5])
    except Exception:
        return MedicationAiAdvisoryResponse(
            disclaimer=disclaimer,
            suggestions=["Discuss your latest reports and risk profile with your doctor for personalized guidance."],
        )

