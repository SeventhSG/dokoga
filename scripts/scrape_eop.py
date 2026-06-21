#!/usr/bin/env python3
"""Скрейпър за ЦАИС ЕОП (app.eop.bg) — профил на купувача на Община Стара Загора.

Профилът е Angular SPA със server-side rendering. Списъкът с поръчки е таблица
с пагинация (~719 записа). Детайлът се отваря inline при клик на ред и съдържа
секция с документи, всеки със свален бутон (mdi-download), който минава през
service.eop.bg → presigned storage.eop.bg URL. Сваляме чрез Playwright download.

Текущо активни = краен срок за подаване >= сега.

Употреба:
  python scrape_eop.py --max-pages 8                 # каталог + сваляне
  python scrape_eop.py --max-pages 2 --no-download   # бърз тест
  python scrape_eop.py --limit 3                      # само първите N активни
"""
import os, re, sys, json, time, argparse
from datetime import datetime, timedelta
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

sys.stdout.reconfigure(encoding="utf-8")

BUYER_URL = "https://app.eop.bg/buyer/21609"
UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")

BG_MONTHS = {"януари":1,"февруари":2,"март":3,"април":4,"май":5,"юни":6,"юли":7,
             "август":8,"септември":9,"октомври":10,"ноември":11,"декември":12}

def parse_bg_dt(s):
    """'20 юли 2026 (пон), 23:59' -> datetime."""
    if not s:
        return None
    m = re.search(r"(\d{1,2})\s+([А-Яа-я]+)\s+(\d{4})(?:.*?(\d{1,2}):(\d{2}))?", s)
    if not m:
        return None
    d, mon_name, y = int(m.group(1)), m.group(2).lower(), int(m.group(3))
    mon = BG_MONTHS.get(mon_name)
    if not mon:
        return None
    hh = int(m.group(4)) if m.group(4) else 23
    mm = int(m.group(5)) if m.group(5) else 59
    try:
        return datetime(y, mon, d, hh, mm)
    except ValueError:
        return None

def safe(s, n=150):
    s = re.sub(r"[^0-9A-Za-zА-Яа-я._-]+", "_", (s or "").strip())
    return s[:n].strip("_") or "x"

def wait_for_data(page, timeout=20000):
    """Изчаква таблицата да покаже реални данни (а не skeleton редове без дата)."""
    try:
        page.wait_for_function(
            "() => { const r = document.querySelector('table tbody tr');"
            " if(!r) return false; return /20\\d\\d/.test(r.innerText||''); }",
            timeout=timeout)
    except Exception:
        pass
    page.wait_for_timeout(300)

def read_rows(page):
    """Връща списък от dict-ове за текущата страница на таблицата."""
    rows = page.locator("table tbody tr")
    out = []
    for i in range(rows.count()):
        tds = rows.nth(i).locator("td")
        if tds.count() < 4:
            continue
        name_cell = tds.nth(0).inner_text().strip()
        # последният ред-токен е рег. номер (00774-2026-0096 или T572680)
        rm = re.search(r"(\d{5}-\d{4}-\d{4}|T\d{5,})", name_cell)
        regnum = rm.group(1) if rm else ""
        title = name_cell.replace(regnum, "").strip().strip("„“\"").strip()
        proc = tds.nth(1).inner_text().strip()
        deadline_raw = tds.nth(2).inner_text().strip()
        pub_raw = tds.nth(3).inner_text().strip()
        out.append({
            "row_index": i, "regnum": regnum, "title": title,
            "procedure": proc, "deadline_raw": deadline_raw, "pub_raw": pub_raw,
            "deadline": (parse_bg_dt(deadline_raw) or None),
            "pub": (parse_bg_dt(pub_raw) or None),
        })
    return out

def _regset(page):
    """Множеството рег. номера в таблицата — надежден отпечатък на страницата."""
    try:
        txt = page.locator("table tbody").inner_text()
    except Exception:
        return frozenset()
    return frozenset(re.findall(r"\d{5}-\d{4}-\d{4}|T\d{5,}", txt))

def click_next(page):
    """Кликва 'следваща страница' (mdi-chevron-right). Връща False, ако няма/е спрян."""
    nxt = page.locator("button:has(.mdi-chevron-right)").first
    if nxt.count() == 0:
        nxt = page.locator(".mdi-chevron-right").first
    if nxt.count() == 0:
        return False
    try:
        if nxt.is_disabled():
            return False
    except Exception:
        pass
    before = _regset(page)
    nxt.click()
    page.wait_for_timeout(1500)
    page.wait_for_selector("table tbody tr", timeout=30000)
    # изчакай рег.-множеството да се смени (надеждно срещу skeleton/throttle)
    for _ in range(40):
        cur = _regset(page)
        if cur and cur != before:
            break
        page.wait_for_timeout(500)
    return True

def goto_page(page, target_idx):
    """От буферната страница стига до индекс на страница (0-based) чрез 'next'."""
    page.goto(BUYER_URL, wait_until="networkidle", timeout=60000)
    page.wait_for_selector("table tbody tr", timeout=30000)
    wait_for_data(page)
    for _ in range(target_idx):
        if not click_next(page):
            break
    page.wait_for_selector("table tbody tr", timeout=30000)
    wait_for_data(page)

def open_detail(page, row_index):
    rows = page.locator("table tbody tr")
    rows.nth(row_index).locator("td").first.click()
    # изчакваме детайла (секцията с документи/обявление)
    page.wait_for_selector("text=ИЗИСКВАНИЯ, ДОКУМЕНТИ И ОБРАЗЦИ", timeout=25000)
    page.wait_for_timeout(1500)

def scrape_detail_docs(page, dest_dir, download=True):
    """Сваля всички файлове (mdi-download бутони) от детайла."""
    docs = []
    # само бутоните (не и вътрешната икона), за да не сваляме всеки файл двойно
    btns = page.locator("button:has(.mdi-download)")
    if btns.count() == 0:
        btns = page.locator(".mdi-download")
    n = btns.count()
    saved = set()
    for i in range(n):
        b = btns.nth(i)
        try:
            if not b.is_visible():
                continue
        except Exception:
            continue
        rec = {"idx": i}
        if not download:
            docs.append(rec); continue
        try:
            with page.expect_download(timeout=20000) as di:
                b.click()
            dl = di.value
            fn = dl.suggested_filename or f"file_{i}"
            os.makedirs(dest_dir, exist_ok=True)
            name = safe(fn, 180)
            if name in saved:  # дедуп в рамките на поръчката
                continue
            saved.add(name)
            path = os.path.join(dest_dir, name)
            dl.save_as(path)
            rec.update({"filename": fn, "local": path,
                        "size": os.path.getsize(path) if os.path.exists(path) else 0,
                        "url": dl.url[:300]})
            docs.append(rec)
            page.wait_for_timeout(400)
        except PWTimeout:
            rec["err"] = "no-download"; docs.append(rec)
        except Exception as e:
            rec["err"] = str(e)[:120]; docs.append(rec)
    return docs

def scrape_detail_meta(page):
    """Извлича 'Обект на поръчката' и 'Прогнозна стойност (без ДДС)' от детайла."""
    out = {"object_type": None, "value": None, "value_currency": None, "value_raw": None}
    try:
        body = page.inner_text("body")
    except Exception:
        return out
    m = re.search(r"Обект на поръчката\s*\n+\s*([^\n]+)", body)
    if m:
        out["object_type"] = m.group(1).strip()
    m = re.search(r"Прогнозна стойност[^\n]*\n+\s*(EUR|BGN|ЕВРО|лв\.?)?\s*([\d\xa0 .,]+)", body)
    if m:
        out["value_currency"] = (m.group(1) or "").strip() or None
        raw = m.group(2).strip()
        out["value_raw"] = raw
        s = raw.replace("\xa0", "").replace(" ", "")
        if "," in s:                       # EOP: интервал=хиляди, запетая=десетична
            s = s.replace(".", "").replace(",", ".")
        try:
            out["value"] = float(s)
        except ValueError:
            pass
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--buyer", default="21609", help="ID на купувача в ЦАИС ЕОП (напр. 21609 за Стара Загора, 16912 за София)")
    ap.add_argument("--max-pages", type=int, default=8)
    ap.add_argument("--pub-window-days", type=int, default=150,
                    help="спри пагинацията, щом публикуването е по-старо от това")
    ap.add_argument("--limit", type=int, default=None, help="макс активни поръчки (дебъг)")
    ap.add_argument("--no-download", action="store_true")
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "data", "starazagora", "eop"))
    a = ap.parse_args()

    now = datetime.now()
    pub_floor = now - timedelta(days=a.pub_window_days)
    os.makedirs(a.out, exist_ok=True)
    docs_root = os.path.join(a.out, "documents")

    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
        ctx = b.new_context(locale="bg-BG", accept_downloads=True, user_agent=UA)
        page = ctx.new_page()

        # ----- 1) каталог: обхождаме страниците и събираме активните -----
        buyer_url = f"https://app.eop.bg/buyer/{a.buyer}"
        page.goto(buyer_url, wait_until="networkidle", timeout=60000)
        try:
            page.wait_for_selector("table tbody tr", timeout=15000)
            wait_for_data(page)
        except Exception:
            print(f"  -> няма намерени процедури за купувач {a.buyer} или празна таблица.")
            os.makedirs(a.out, exist_ok=True)
            json.dump({"procedures": []}, open(os.path.join(a.out, "eop_index.json"), "w", encoding="utf-8"), ensure_ascii=False)
            sys.exit(0)
        active = []
        seen = set()
        for pidx in range(a.max_pages):
            rows = read_rows(page)
            page_active = 0
            oldest_pub = None
            for r in rows:
                if r["pub"]:
                    oldest_pub = r["pub"] if (oldest_pub is None or r["pub"] < oldest_pub) else oldest_pub
                is_active = r["deadline"] is not None and r["deadline"] >= now
                if is_active and r["regnum"] not in seen:
                    seen.add(r["regnum"])
                    r["page_index"] = pidx
                    active.append(r); page_active += 1
            print(f"[стр {pidx}] редове={len(rows)} активни+={page_active} "
                  f"най-старо публ={oldest_pub.date() if oldest_pub else '?'}")
            # стоп условия
            if oldest_pub and oldest_pub < pub_floor:
                print("  -> публикуването е извън прозореца, спирам пагинацията"); break
            if pidx >= a.max_pages - 1:
                break
            if not click_next(page):
                print("  -> няма следваща страница"); break

        # сериализуем датите
        for r in active:
            r["deadline"] = r["deadline"].isoformat() if r["deadline"] else None
            r["pub"] = r["pub"].isoformat() if r["pub"] else None
        if a.limit:
            active = active[:a.limit]
        print(f"\nАКТИВНИ поръчки: {len(active)} (краен срок >= {now.date()})")

        # ----- 2) детайли + документи -----
        total_docs = 0
        for k, r in enumerate(active, 1):
            tag = r["regnum"] or safe(r["title"], 30)
            try:
                goto_page(page, r["page_index"])
                open_detail(page, r["row_index"])
            except Exception as e:
                print(f"  !! {tag}: детайлът не се отвори: {str(e)[:90]}")
                r["documents"] = []; r["n_documents"] = 0; continue
            r.update(scrape_detail_meta(page))
            dest = os.path.join(docs_root, safe(tag, 60))
            docs = scrape_detail_docs(page, dest, download=not a.no_download)
            ok = [d for d in docs if d.get("local")]
            r["documents"] = docs
            r["n_documents"] = len(ok)
            total_docs += len(ok)
            print(f"  [{k}/{len(active)}] {tag}  {r['procedure'][:24]}  "
                  f"срок={r['deadline_raw'][:18]}  файлове={len(ok)}")

        idx = {
            "generated": now.isoformat(timespec="seconds"),
            "source": BUYER_URL,
            "buyer": "ОБЩИНА - СТАРА ЗАГОРА (ЕИК 000818022, партида 774)",
            "as_of": now.isoformat(timespec="seconds"),
            "criterion": "краен срок за подаване >= сега",
            "n_active": len(active), "n_documents": total_docs,
            "pages_scanned": min(a.max_pages, pidx + 1),
            "procedures": active,
        }
        out_idx = os.path.join(a.out, "eop_index.json")
        json.dump(idx, open(out_idx, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print(f"\nГотово. активни={len(active)} документи={total_docs}")
        print(f"индекс -> {out_idx}")
        print(f"файлове -> {docs_root}/")
        b.close()

if __name__ == "__main__":
    main()
