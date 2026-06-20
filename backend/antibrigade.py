"""Cheap, no-friction anti-brigade checks for confirmations.

Brigade signals must NOT collide with the legitimate verify-at-3 path, so:
- cluster: 3+ confirms from a single *known* IP (NULL ip_hash is ignored);
- burst: 5+ confirms within 10s (well above the 3 distinct humans that
  legitimately verify a popular problem)."""


def can_confirm(con, report_id, user_id, device_id=None):
    # Email is the identity now: one verified account = one vote per problem.
    if con.execute("SELECT 1 FROM confirmations WHERE report_id=? AND user_id=?",
                   (report_id, user_id)).fetchone():
        return False, "already_confirmed"
    return True, "ok"


def is_brigaded(con, report_id):
    top_ip = con.execute(
        "SELECT COUNT(*) FROM confirmations WHERE report_id=? AND ip_hash IS NOT NULL "
        "GROUP BY ip_hash ORDER BY COUNT(*) DESC LIMIT 1", (report_id,)).fetchone()
    if top_ip and top_ip[0] >= 3:
        return True
    burst = con.execute(
        "SELECT COUNT(*) FROM confirmations WHERE report_id=? "
        "AND created_at >= datetime('now','-10 seconds')", (report_id,)).fetchone()[0]
    return burst >= 5
