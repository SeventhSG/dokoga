"""Детерминистични заявки върху projects.sqlite.
Това е ЕДИНСТВЕНИЯТ източник на числа — LLM-ът никога не смята сам.
"""
import os, sqlite3

DB = os.path.join(os.path.dirname(__file__), "..", "data", "app", "projects.sqlite")

def _con():
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    return con

def get_region_stats(region_name: str) -> dict:
    """Статистика за просрочване по област (напр. 'Шумен', 'Пловдив')."""
    con = _con()
    r = con.execute(
        "SELECT region_name, n, n_overrun, overrun_rate, median_overrun_days, avg_risk "
        "FROM region_stats WHERE region_name LIKE ? ORDER BY n DESC LIMIT 1",
        (f"%{region_name}%",)).fetchone()
    con.close()
    if not r:
        return {"found": False, "region": region_name}
    return {"found": True, "region": r["region_name"], "договори": r["n"],
            "просрочени": r["n_overrun"], "дял_просрочка": round(r["overrun_rate"], 3),
            "медиана_дни": r["median_overrun_days"], "среден_риск": round(r["avg_risk"], 3)}

def get_contractor_stats(name: str) -> dict:
    """Статистика за изпълнител по име или ЕИК (напр. 'ЕЛПИДА')."""
    con = _con()
    r = con.execute(
        "SELECT supplier, supplier_eik, n_contracts, n_overrun, overrun_rate, avg_overrun_days, avg_risk "
        "FROM contractor_stats WHERE supplier LIKE ? OR supplier_eik = ? "
        "ORDER BY n_contracts DESC LIMIT 1", (f"%{name}%", name)).fetchone()
    con.close()
    if not r:
        return {"found": False, "name": name}
    return {"found": True, "изпълнител": r["supplier"], "ЕИК": r["supplier_eik"],
            "договори": r["n_contracts"], "просрочени": r["n_overrun"],
            "дял_просрочка": round(r["overrun_rate"], 3),
            "среден_размер_дни": round(r["avg_overrun_days"] or 0), "среден_риск": round(r["avg_risk"], 3)}

def search_contracts(keyword: str, limit: int = 5) -> list:
    """Търси ремонтни договори по дума в заглавието; връща най-рисковите."""
    con = _con()
    rows = con.execute(
        "SELECT title, region_name, value, risk, expected_days, overrun_days, supplier "
        "FROM contracts WHERE title LIKE ? ORDER BY risk DESC LIMIT ?",
        (f"%{keyword}%", limit)).fetchall()
    con.close()
    return [{"заглавие": r["title"], "област": r["region_name"],
             "стойност": r["value"], "риск": round(r["risk"], 2),
             "очаквани_дни": r["expected_days"], "реално_просрочване": r["overrun_days"],
             "изпълнител": r["supplier"]} for r in rows]

def top_risky_regions(limit: int = 5) -> list:
    """Областите с най-висок дял просрочени договори (мин. 20 договора)."""
    con = _con()
    rows = con.execute(
        "SELECT region_name, n, overrun_rate, median_overrun_days FROM region_stats "
        "WHERE n >= 20 ORDER BY overrun_rate DESC LIMIT ?", (limit,)).fetchall()
    con.close()
    return [{"област": r["region_name"], "договори": r["n"],
             "дял_просрочка": round(r["overrun_rate"], 3), "медиана_дни": r["median_overrun_days"]}
            for r in rows]

def top_risky_contractors(limit: int = 5, min_contracts: int = 3) -> list:
    """Изпълнителите с най-висок дял просрочени договори."""
    con = _con()
    rows = con.execute(
        "SELECT supplier, n_contracts, overrun_rate, avg_overrun_days FROM contractor_stats "
        "WHERE n_contracts >= ? ORDER BY overrun_rate DESC, n_contracts DESC LIMIT ?",
        (min_contracts, limit)).fetchall()
    con.close()
    return [{"изпълнител": r["supplier"], "договори": r["n_contracts"],
             "дял_просрочка": round(r["overrun_rate"], 3),
             "среден_размер_дни": round(r["avg_overrun_days"] or 0)} for r in rows]

TOOLS = {
    "get_region_stats": get_region_stats,
    "get_contractor_stats": get_contractor_stats,
    "search_contracts": search_contracts,
    "top_risky_regions": top_risky_regions,
    "top_risky_contractors": top_risky_contractors,
}
