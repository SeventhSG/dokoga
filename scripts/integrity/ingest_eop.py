"""Ingest ЦАИС ЕОП daily emission (storage.eop.bg) → contracts, tenders, annexes.

Discovers files from the bucket listing (never reconstructs names), classifies by keyword.
Flat base feed only (OCDS enrichment out of POC scope).
"""
import re, urllib.parse
from common import fetch, fetch_json, to_eur, num, day_iso

BASE = "https://storage.eop.bg/open-data-{date}/"


def _bucket_keys(date: str):
    xml = fetch(BASE.format(date=date) + "", cache=False).decode("utf-8", "ignore")
    return re.findall(r"<Key>([^<]+)</Key>", xml)


def _classify(key: str):
    if "OCDS" in key or "обявления" in key:
        return None  # skip OCDS in POC
    if "договори" in key:
        return "contracts"
    if "поръчки" in key:
        return "tenders"
    if "анекси" in key:
        return "annexes"
    return None


def _load(date: str, kind: str):
    for key in _bucket_keys(date):
        if _classify(key) == kind:
            url = BASE.format(date=date) + urllib.parse.quote(key)
            data = fetch_json(url, cache=False)  # stream-and-discard: don't accumulate daily JSON on disk
            return data if isinstance(data, list) else []
    return []


def _contract_row(r: dict):
    val = num(r.get("contractValue")) or num(r.get("estimatedValue"))
    cur = r.get("contractCurrency") or r.get("currency") or "BGN"
    cid = str(r.get("noticeId") or "")
    if r.get("contractNumber"):
        cid += ":" + str(r["contractNumber"])
    return (
        cid, r.get("uniqueProcurementNumber"), r.get("buyerRegistryNumber"), r.get("buyerName"),
        r.get("supplierRegisterNumber"), r.get("supplierName"), r.get("tenderMainCpv"),
        num(r.get("contractValue")), num(r.get("estimatedValue")), cur, to_eur(val, cur),
        int(r["offersCount"]) if num(r.get("offersCount")) is not None else None,
        int(r["disqualifiedOffersCount"]) if num(r.get("disqualifiedOffersCount")) is not None else None,
        day_iso(r.get("publicationDate")), day_iso(r.get("contractDate")),
        r.get("procedureType") or r.get("awardMethod"),
    )


def _tender_row(r: dict):
    return (
        r.get("uniqueProcurementNumber"), r.get("noticeId"), r.get("subject"),
        r.get("buyerRegistryNumber"), r.get("mainCpvCode"), num(r.get("estimatedValue")),
        r.get("currency") or "BGN", day_iso(r.get("publicationDate")), day_iso(r.get("submissionDeadline")),
        1 if r.get("isCancelled") in (True, 1, "true", "1") else 0, r.get("procedureType"),
    )


def _annex_row(r: dict):
    vb = num(r.get("lastContractValue"))
    va = num(r.get("currentContractValue"))
    delta = num(r.get("contractValueDifference"))
    if delta is None and va is not None and vb is not None:
        delta = va - vb
    return (str(r.get("noticeId") or r.get("uniqueProcurementNumber")), r.get("uniqueProcurementNumber"),
            vb, va, delta, day_iso(r.get("publicationDate")))


def ingest(con, dates, verbose: bool = True):
    nc = nt = na = 0
    for date in dates:
        try:
            cs = _load(date, "contracts"); ts = _load(date, "tenders"); ans = _load(date, "annexes")
        except Exception as e:
            if verbose: print(f"  EOP {date}: ERROR {e}")
            continue
        con.executemany(
            "INSERT OR REPLACE INTO contracts(id,unp,buyer_eik,buyer_name,supplier_eik,supplier_name,cpv,"
            "contract_value,estimated_value,currency,amount_eur,offers_count,disqualified_count,"
            "published_at,contract_date,procedure_type) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            [_contract_row(r) for r in cs if r.get("noticeId")])
        con.executemany(
            "INSERT OR REPLACE INTO tenders(unp,notice_id,title,buyer_eik,cpv,estimated_value,currency,"
            "published_at,deadline_at,is_cancelled,procedure_type) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
            [_tender_row(r) for r in ts if r.get("uniqueProcurementNumber")])
        con.executemany(
            "INSERT OR REPLACE INTO annexes(id,unp,value_before,value_after,value_delta,published_at) "
            "VALUES(?,?,?,?,?,?)", [_annex_row(r) for r in ans if r.get("noticeId") or r.get("uniqueProcurementNumber")])
        nc += len(cs); nt += len(ts); na += len(ans)
        if verbose: print(f"  EOP {date}: contracts={len(cs)} tenders={len(ts)} annexes={len(ans)}")
    con.commit()
    return {"contracts": nc, "tenders": nt, "annexes": na}
