"""Suggest likely-related contracts for a report (bonus attribution)."""
CATEGORY_SECTORS = {
    "pothole": ["roads"],
    "stalled_construction": ["roads", "buildings", "water", "other"],
    "public_renovation": ["buildings", "other"],
    "broken_infra": ["roads", "lighting", "water", "other"],
    "other": [],
}


def suggest(con, region_name, category, note="", limit=3):
    sectors = CATEGORY_SECTORS.get(category, [])
    sql = ("SELECT ocid, title, value, overrun_days, supplier FROM contracts "
           "WHERE region_name = ?")
    params = [region_name]
    if sectors:
        sql += " AND sector IN (%s)" % ",".join("?" * len(sectors))
        params += sectors
    sql += " ORDER BY COALESCE(overrun_days,0) DESC, COALESCE(value,0) DESC LIMIT ?"
    params.append(limit)
    return [dict(r) for r in con.execute(sql, params).fetchall()]
