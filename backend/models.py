from typing import Literal, Optional

from pydantic import BaseModel, Field


class Advice(BaseModel):
    food: str
    activity: str
    hydration: str
    sleep: str


class ChatMessage(BaseModel):
  role: Literal["system", "user", "assistant"]
  content: str


class PredictRequest(BaseModel):
    # Keys intentionally use JSON-friendly names (no parentheses).
    generalHealth: str = Field(..., description="Poor/Fair/Good/Very Good/Excellent")
    checkup: str
    exercise: str  # Yes/No
    skinCancer: str  # Yes/No
    otherCancer: str  # Yes/No
    sex: str  # Male/Female
    ageCategory: str

    heightCm: float = Field(..., gt=0)
    weightKg: float = Field(..., gt=0)

    smokingHistory: str  # Yes/No
    alcoholConsumption: float
    fruitConsumption: float
    greenVegetablesConsumption: float
    friedPotatoConsumption: float
    systolicBp: Optional[int] = None
    diastolicBp: Optional[int] = None
    heartRate: Optional[int] = None
    sleepHours: Optional[float] = None
    lifestyleNotes: Optional[str] = None


class PredictResponse(BaseModel):
    risk: Literal["Low", "Medium", "High"]
    score: int = Field(..., ge=0, le=100)
    probabilities: dict[str, float]
    advice: Advice
    predictionId: str


class PredictionListResponse(BaseModel):
    items: list[dict]


class ChatRequest(BaseModel):
  messages: list[ChatMessage]
  # Optional: if you want to tie the chat to a prediction id later.
  predictionId: Optional[str] = None


class ChatResponse(BaseModel):
  message: ChatMessage
  sources: list[str] = []


class SignupRequest(BaseModel):
  email: str
  password: str
  name: Optional[str] = None


class LoginRequest(BaseModel):
  email: str
  password: str


class AuthResponse(BaseModel):
  accessToken: str
  user: dict
  needsOnboarding: Optional[bool] = None


class HealthProfileRequest(BaseModel):
  age: Optional[int] = None
  sex: Optional[str] = None
  bloodGroup: Optional[str] = None
  height: Optional[str] = None
  weight: Optional[str] = None
  contact: Optional[str] = None
  bmi: Optional[float] = None
  previousDiseases: list[str] = []
  chronicDiseases: list[str] = []


class ProfileUpdateRequest(HealthProfileRequest):
  name: Optional[str] = None


class PasswordResetRequest(BaseModel):
  currentPassword: str
  newPassword: str


class AnalyzeReportRequest(BaseModel):
  """
  Mode controls what kind of recommendations to generate from the uploaded report.
  - lifestyle: food + exercise guidance
  - medications: suggest what to discuss with a clinician (NO dosing/prescribing)
  """
  reportId: Optional[str] = None
  mode: Optional[Literal["lifestyle", "medications"]] = "lifestyle"


class AiReportAnalysis(BaseModel):
  summary: str
  foodHabits: list[str] = []
  exerciseIdeas: list[str] = []
  medicationsToDiscuss: list[str] = []
  safetyNotes: list[str] = []


class AnalyzeReportResponse(BaseModel):
  reportId: str
  analysis: AiReportAnalysis


class MedicationUpsertRequest(BaseModel):
  medicationName: str
  dosage: Optional[str] = None
  frequency: str
  startDate: Optional[str] = None
  notes: Optional[str] = None


class MedicationAiAdvisoryResponse(BaseModel):
  disclaimer: str
  suggestions: list[str] = []


class MedicationReminderSlot(BaseModel):
  time: str
  days: list[str] = []
  enabled: bool = True


class MedicationRemindersRequest(BaseModel):
  reminders: list[MedicationReminderSlot] = []


class MedicationAdherenceRequest(BaseModel):
  status: Literal["taken", "skipped"]
  takenAt: Optional[str] = None
  note: Optional[str] = None


class DoctorNotificationRequest(BaseModel):
  doctorEmail: Optional[str] = None
  message: Optional[str] = None


class CriticalAlertItem(BaseModel):
  key: str
  severity: Literal["high", "critical"]
  title: str
  detail: str


class CriticalAlertsResponse(BaseModel):
  alerts: list[CriticalAlertItem] = []
  basedOnPredictionId: Optional[str] = None

