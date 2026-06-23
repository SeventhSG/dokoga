"""boss_battle.py — Teacher Boss Battle engine for Докога?
Generates a timed mock exam that mimics a specific teacher's style and rigor.
Rony narrates the buildup, questions have scaled difficulty, and the result is scored.
"""
import os
import re
import json
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
_client = genai.Client(api_key=os.environ["GOOGLE_API_KEY"])

MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite-preview-06-17", "gemini-2.0-flash"]


def _generate(prompt: str, temperature: float = 0.7, max_tokens: int = 2000) -> str:
    last = None
    for m in MODELS:
        try:
            r = _client.models.generate_content(
                model=m,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=temperature,
                    max_output_tokens=max_tokens,
                ),
            )
            if r.text:
                return r.text.strip()
        except Exception as e:
            last = f"{m}: {e}"
            continue
    raise RuntimeError(f"All models failed. Last error: {last}")


def _extract_json(text: str) -> dict | list:
    """Extract the first JSON object or array from LLM output."""
    # Try direct parse first
    try:
        return json.loads(text)
    except Exception:
        pass
    # Try to find ```json ... ``` block
    m = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if m:
        try:
            return json.loads(m.group(1).strip())
        except Exception:
            pass
    # Try to find bare { ... } or [ ... ]
    m = re.search(r"(\{[\s\S]*\}|\[[\s\S]*\])", text)
    if m:
        try:
            return json.loads(m.group(1))
        except Exception:
            pass
    raise ValueError(f"Could not extract JSON from LLM output: {text[:300]}")


# ── RONY NARRATION PROMPT ──────────────────────────────────────────────────────
RONY_BUILDUP_PROMPT = """You are Rony — a sharp, charismatic AI narrator for a student learning app.
Your job: narrate the dramatic buildup before a student faces their teacher's exam.
You speak in Bulgarian, with energy — like a sports commentator hyping a boss fight.
Be dramatic, funny, and slightly menacing about the teacher. Use 2-4 short punchy sentences.
The teacher is: {teacher_name}
Their subject: {subject}
Their reputation/style: {style}

Write ONLY the narration text in Bulgarian. No JSON, no labels, just the text."""

# ── EXAM GENERATION PROMPT ────────────────────────────────────────────────────
EXAM_GENERATION_PROMPT = """You are an AI that generates realistic school exams mimicking a specific teacher's style.

Teacher: {teacher_name}
Subject: {subject}
Grade level: {grade}
Teacher style/reputation: {style}
Exam notes from real exam photo analysis (if any): {exam_notes}

Generate a realistic mock exam with EXACTLY {num_questions} questions.
Difficulty is scaled: first {easy_count} questions are easier, last {hard_count} are harder (teacher's signature traps).

Return ONLY valid JSON (no markdown, no explanation) in this exact format:
{{
  "exam_title": "...",
  "teacher_name": "{teacher_name}",
  "subject": "{subject}",
  "grade": "{grade}",
  "time_limit_minutes": {time_limit},
  "total_points": 100,
  "rony_taunt": "A short menacing Bulgarian sentence Rony says when the timer starts",
  "questions": [
    {{
      "id": 1,
      "type": "multiple_choice",
      "difficulty": "easy|medium|hard",
      "points": 10,
      "text": "Question text in Bulgarian",
      "options": ["А) ...", "Б) ...", "В) ...", "Г) ..."],
      "correct": "А",
      "teacher_trap": false,
      "explanation": "Brief explanation in Bulgarian"
    }}
  ],
  "passing_score": 60,
  "win_message": "What Rony says if student passes (Bulgarian, triumphant)",
  "lose_message": "What Rony says if student fails (Bulgarian, dramatic but encouraging)"
}}

Mix question types: multiple_choice, true_false, short_answer (for hard ones).
For true_false: options = ["Вярно", "Невярно"], correct = "Вярно" or "Невярно".
For short_answer: options = [], correct = "model answer text".
Mark teacher_trap: true for questions with tricky wording the teacher is known for.
Make it feel REAL — like this specific teacher actually wrote it."""


def generate_boss_battle(
    teacher_name: str,
    subject: str,
    grade: str = "11 клас",
    style: str = "",
    exam_notes: str = "",
    num_questions: int = 8,
    time_limit_minutes: int = 30,
) -> dict:
    """Generate a full boss battle exam for a given teacher."""

    # Validate
    num_questions = max(4, min(12, num_questions))
    time_limit_minutes = max(10, min(90, time_limit_minutes))
    easy_count = max(1, num_questions // 3)
    hard_count = max(1, num_questions // 3)

    if not style:
        style = "строга, изисква точност, обича капани и детайли"

    # 1. Generate Rony's buildup narration
    rony_prompt = RONY_BUILDUP_PROMPT.format(
        teacher_name=teacher_name,
        subject=subject,
        style=style,
    )
    try:
        rony_narration = _generate(rony_prompt, temperature=0.85, max_tokens=200)
    except Exception:
        rony_narration = f"Вниманиe! {teacher_name} те чака. Готов ли си за битката?"

    # 2. Generate the exam
    exam_prompt = EXAM_GENERATION_PROMPT.format(
        teacher_name=teacher_name,
        subject=subject,
        grade=grade,
        style=style,
        exam_notes=exam_notes or "няма допълнителни бележки",
        num_questions=num_questions,
        easy_count=easy_count,
        hard_count=hard_count,
        time_limit=time_limit_minutes,
    )

    raw = _generate(exam_prompt, temperature=0.6, max_tokens=3000)
    exam_data = _extract_json(raw)

    # Ensure rony narration is in the response
    return {
        "rony_buildup": rony_narration,
        "exam": exam_data,
        "meta": {
            "teacher_name": teacher_name,
            "subject": subject,
            "grade": grade,
            "num_questions": num_questions,
            "time_limit_minutes": time_limit_minutes,
        },
    }


def score_exam(questions: list, answers: dict) -> dict:
    """
    Score a completed exam.
    answers: dict of {question_id: selected_answer}
    Returns: {score, max_score, percentage, passed, results_per_question}
    """
    total = 0
    earned = 0
    results = []

    for q in questions:
        qid = str(q.get("id", ""))
        user_ans = answers.get(qid, "").strip()
        correct = q.get("correct", "").strip()
        points = q.get("points", 10)
        q_type = q.get("type", "multiple_choice")

        if q_type == "short_answer":
            # Fuzzy match: just check if key words from correct answer appear
            is_correct = len(user_ans) >= 3 and any(
                w.lower() in user_ans.lower()
                for w in correct.split()[:3]
                if len(w) > 3
            )
        else:
            # Exact match on first character (А, Б, В, Г or Вярно/Невярно)
            is_correct = user_ans.lower().startswith(correct[0].lower()) or user_ans.lower() == correct.lower()

        earned_pts = points if is_correct else 0
        total += points
        earned += earned_pts

        results.append({
            "id": q.get("id"),
            "correct": is_correct,
            "user_answer": user_ans,
            "correct_answer": correct,
            "points_earned": earned_pts,
            "points_possible": points,
            "explanation": q.get("explanation", ""),
            "teacher_trap": q.get("teacher_trap", False),
        })

    percentage = round(earned / total * 100) if total > 0 else 0
    return {
        "score": earned,
        "max_score": total,
        "percentage": percentage,
        "passed": percentage >= 60,
        "results": results,
    }
