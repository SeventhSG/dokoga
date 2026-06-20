"""Derive a report's status from its confirmations.
Thresholds (Global Constraints): >=3 distinct-account confirms within 30 days
-> verified; >=3 distinct-account fixed/nothere -> resolved."""
VERIFY_N = 3
RESOLVE_N = 3


def _count(con, report_id, kinds):
    qs = ",".join("?" * len(kinds))
    return con.execute(
        f"SELECT COUNT(DISTINCT user_id) FROM confirmations "
        f"WHERE report_id=? AND kind IN ({qs}) "
        f"AND created_at >= datetime('now','-30 days')",
        [report_id, *kinds]).fetchone()[0]


def recompute(con, report_id):
    if _count(con, report_id, ["fixed", "nothere"]) >= RESOLVE_N:
        status = "resolved"
    elif _count(con, report_id, ["confirm"]) >= VERIFY_N:
        status = "verified"
    else:
        status = "reported"
    con.execute("UPDATE reports SET status=? WHERE id=? AND status!='under_review'",
                (status, report_id))
    con.commit()
    return status
