from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


def _chunk_text(text: str, chunk_chars: int = 900, overlap: int = 150) -> list[str]:
    text = text.strip()
    if not text:
        return []
    chunks: list[str] = []
    i = 0
    while i < len(text):
        end = min(len(text), i + chunk_chars)
        chunk = text[i:end].strip()
        if chunk:
            chunks.append(chunk)
        i = end - overlap
        if i < 0:
            i = 0
        if end == len(text):
            break
    return chunks


@dataclass
class RetrievalResult:
    chunk: str
    score: float


class TfidfRetriever:
    def __init__(self, kb_path: str) -> None:
        self.kb_path = kb_path
        self._vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), min_df=1)
        self._chunks: list[str] = []
        self._X = None

    def load(self) -> None:
        kb_text = Path(self.kb_path).read_text(encoding="utf-8")
        self._chunks = _chunk_text(kb_text)
        if not self._chunks:
            self._chunks = ["(Knowledge base is empty.)"]
        self._X = self._vectorizer.fit_transform(self._chunks)

    def retrieve(self, query: str, k: int = 4) -> list[RetrievalResult]:
        if self._X is None:
            self.load()
        q = (query or "").strip()
        if not q:
            return []
        qv = self._vectorizer.transform([q])
        sims = cosine_similarity(qv, self._X).flatten()
        top_idx = sims.argsort()[::-1][:k]
        results: list[RetrievalResult] = []
        for idx in top_idx:
            results.append(RetrievalResult(chunk=self._chunks[int(idx)], score=float(sims[int(idx)])))
        return results

