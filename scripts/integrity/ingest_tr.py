"""Ingest Търговски регистър daily deltas (data.egov.bg, CC0) → organizations, persons, roles.

Persons keyed by stable hashed ЕГН (privacy-preserving); cross-company linkage uses the hash,
never raw personal data. Company key = UIC (= ЕИК), the join to procurement.
"""
import re, datetime
from common import fetch, fetch_json, norm_name

DATASET = "https://data.egov.bg/organisation/dataset/2df0c2af-e769-4397-be33-fcbe269806f3"
DOWNLOAD = "https://data.egov.bg/resource/download/{uuid}/json"

_ROLE_HINTS = [
    ("manager", ("manager", "representative", "управ", "представ")),
    ("beneficial_owner", ("actualowner", "beneficial", "действ")),
    ("owner", ("soleowner", "solecapital", "едноличен", "owner")),
    ("partner", ("partner", "subscriber", "съдружник", "shareholder", "capital")),
]


def _role_of(container_key: str, current: str) -> str:
    k = (container_key or "").lower()
    for role, hints in _ROLE_HINTS:
        if any(h in k for h in hints):
            return role
    return current


def recent_resource_uuids(limit: int) -> list:
    """Paginate the dataset (newest first) until `limit` distinct daily-delta resources collected."""
    seen, out, page = set(), [], 1
    while len(out) < limit and page <= 200:
        url = DATASET + (f"?page={page}" if page > 1 else "")
        html = fetch(url, cache=(page > 1)).decode("utf-8", "ignore")  # page1 fresh (newest), rest cacheable
        found = 0
        for m in re.finditer(r"resourceView/([0-9a-f-]{36})", html):
            u = m.group(1)
            if u not in seen:
                seen.add(u); out.append(u); found += 1
        if found == 0:
            break
        page += 1
    return out[:limit]


def _person(node):
    """Return (name, indent, indent_type) if node is a Person-like dict, else None."""
    def first(key):
        v = node.get(key)
        if isinstance(v, list) and v and isinstance(v[0], dict):
            return v[0].get("_")
        return None
    if "Name" in node and "Indent" in node and "IndentType" in node:
        return first("Name"), first("Indent"), first("IndentType")
    return None


def _walk(node, uic, role_ctx, persons, roles):
    if isinstance(node, dict):
        p = _person(node)
        if p:
            name, indent, itype = p
            if indent:
                pk = str(indent)
            elif name:
                pk = "name:" + norm_name(name)
            else:
                return
            persons[pk] = (itype or "NAME", name)
            if uic:
                roles.add((uic, pk, role_ctx))
            return
        for k, v in node.items():
            _walk(v, uic, _role_of(k, role_ctx), persons, roles)
    elif isinstance(node, list):
        for x in node:
            _walk(x, uic, role_ctx, persons, roles)


def ingest(con, days: int = 6, verbose: bool = True):
    uuids = recent_resource_uuids(days)
    orgs, persons, roles = {}, {}, set()
    now = datetime.date.today().isoformat()
    for i, u in enumerate(uuids, 1):
        try:
            d = fetch_json(DOWNLOAD.format(uuid=u), cache=False)  # stream-and-discard: never cache 10MB raw deltas
        except Exception as e:
            if verbose: print(f"  TR resource {u}: ERROR {e}")
            continue
        deeds = d["Message"][0]["Body"][0]["Deeds"][0]["Deed"]
        for dd in deeds:
            meta = dd.get("$", {})
            uic = meta.get("UIC")
            if uic:
                orgs[uic] = (meta.get("CompanyName"), meta.get("LegalForm"), now)
            _walk(dd, uic, "other", persons, roles)
        if verbose: print(f"  TR delta {i}/{len(uuids)}: {len(deeds)} deeds | orgs={len(orgs)} persons={len(persons)} roles={len(roles)}")
    con.executemany("INSERT OR REPLACE INTO organizations(eik,name,legal_form,tr_seen_at) VALUES(?,?,?,?)",
                    [(e, n, lf, ts) for e, (n, lf, ts) in orgs.items()])
    con.executemany("INSERT OR REPLACE INTO persons(person_key,indent_type,name) VALUES(?,?,?)",
                    [(pk, it, nm) for pk, (it, nm) in persons.items()])
    con.executemany("INSERT OR IGNORE INTO roles(eik,person_key,role) VALUES(?,?,?)", list(roles))
    con.commit()
    return {"orgs": len(orgs), "persons": len(persons), "roles": len(roles)}
