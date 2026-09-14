#!/usr/bin/env python3
"""Extract every stock row from the original ACRS PDF without catalogue cleanup.

Run from any directory with a Python environment containing pdfplumber.
The JSON retains source spelling, blank values, quantities and prices. The audit
is separate so that illustrative app policies never become source facts.
"""

from collections import Counter, defaultdict
from decimal import Decimal
import json
from pathlib import Path

import pdfplumber


ROOT = Path(__file__).resolve().parents[1]
COLUMNS = [
    "codigoACRS", "familia", "material", "tamanho", "descricao", "marca",
    "quantidade", "precoUnitario", "precoTotal", "localizacao",
]
NUMERIC_COLUMNS = {"quantidade", "precoUnitario", "precoTotal"}


def decimal_pt(value):
    if value is None or not str(value).strip():
        return None
    # The numeric PDF cells use a decimal comma, with no thousands separator.
    return Decimal(str(value).strip().replace("\u00a0", "").replace(" ", "").replace(",", "."))


def json_number(value):
    if value is None:
        return None
    return int(value) if value == value.to_integral_value() else float(value)


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main():
    candidates = list((ROOT / "data").glob("STOCK*.pdf"))
    if len(candidates) != 1:
        raise ValueError(f"Expected one STOCK*.pdf, found {len(candidates)}")
    source = candidates[0]
    records, decimals, totals, page_counts = [], {}, [], {}
    with pdfplumber.open(source) as pdf:
        for page_number, page in enumerate(pdf.pages, start=1):
            tables = page.extract_tables()
            stock_tables = [table for table in tables if len(table[0]) == 10]
            if len(stock_tables) != 1:
                raise ValueError(f"Expected one ten-column stock table on page {page_number}")
            table = stock_tables[0]
            if "COD PEÇA" not in (table[0][0] or ""):
                raise ValueError(f"Unrecognised header on page {page_number}")
            page_counts[page_number] = 0
            for source_row, cells in enumerate(table[1:], start=2):
                if len(cells) != len(COLUMNS) or not cells[0]:
                    raise ValueError(f"Unrecognised row p{page_number}:{source_row}: {cells}")
                record = {"id": f"inv-p{page_number:02d}-r{source_row:03d}"}
                for key, cell in zip(COLUMNS, cells):
                    if key in NUMERIC_COLUMNS:
                        value = decimal_pt(cell)
                        decimals[(record["id"], key)] = value
                        record[key] = json_number(value)
                    else:
                        record[key] = cell.strip() if cell and cell.strip() else None
                record.update(source="ACRS", sourcePage=page_number, sourceRow=source_row)
                records.append(record)
                page_counts[page_number] += 1
            for other_table in tables:
                if len(other_table[0]) == 2 and other_table[0][0] == "TOTAL":
                    totals.append(decimal_pt(other_table[0][1]))

    by_code, identical_rows = defaultdict(list), defaultdict(list)
    mismatches = []
    for item in records:
        by_code[item["codigoACRS"]].append(item["id"])
        identical_rows[tuple(item[key] for key in COLUMNS)].append(item["id"])
        quantity, unit, total = [decimals[item["id"], k] for k in ("quantidade", "precoUnitario", "precoTotal")]
        if None not in (quantity, unit, total) and quantity * unit != total:
            mismatches.append({
                "id": item["id"], "codigoACRS": item["codigoACRS"],
                "sourcePage": item["sourcePage"], "sourceRow": item["sourceRow"],
                "sourceTotal": json_number(total), "calculatedTotal": json_number(quantity * unit),
                "difference": json_number(total - quantity * unit),
            })

    line_total = sum((decimals[x["id"], "precoTotal"] or Decimal(0) for x in records), Decimal(0))
    assert len({x["id"] for x in records}) == len(records), "Internal identifiers must be unique"
    audit = {
        "sourceFile": str(source.relative_to(ROOT)),
        "referenceMonth": "Agosto",
        "referenceYear": None,
        "sourceRowConvention": "1-based PDF table row including the header; first article is row 2",
        "pageCount": len(page_counts),
        "rowCount": len(records),
        "rowsPerPage": page_counts,
        "uniqueCodeCount": len(by_code),
        "familyCounts": dict(sorted(Counter(x["familia"] for x in records).items())),
        "materialCounts": dict(sorted(Counter(x["material"] or "(ausente)" for x in records).items())),
        "brandCounts": dict(sorted(Counter(x["marca"] or "(ausente)" for x in records).items())),
        "locationCounts": dict(sorted(Counter(x["localizacao"] or "(ausente)" for x in records).items())),
        "zeroStockCount": sum(x["quantidade"] == 0 for x in records),
        "fractionalQuantityCount": sum(x["quantidade"] is not None and x["quantidade"] % 1 != 0 for x in records),
        "missingByColumn": {key: sum(x[key] is None for x in records) for key in COLUMNS},
        "sourcePrintedTotals": [json_number(x) for x in totals],
        "sumOfLineTotals": json_number(line_total),
        "lineSumMinusPrintedTotal": json_number(line_total - totals[0]) if len(totals) == 1 else None,
        "lineArithmeticMismatches": mismatches,
        "duplicateCodes": {key: ids for key, ids in sorted(by_code.items()) if len(ids) > 1},
        "identicalSourceRows": [ids for ids in identical_rows.values() if len(ids) > 1],
        "notes": [
            "No article was removed, deduplicated, regrouped, corrected or invented.",
            "Blank source cells become null; numeric cells use JSON decimal numbers.",
            "Source code spelling, family names, materials and size strings are preserved.",
            "Quantities mix units: the source has pieces, metres and mass-based rows. Do not present their sum as a meaningful physical stock count.",
            "No minimum stock, internal mark-up, machine fee or consumption policy is supplied by this PDF.",
            "August is printed on the final page; no year is stated in the document body.",
        ],
    }
    write_json(ROOT / "data/source/inventory.json", records)
    write_json(ROOT / "data/source/inventory-audit.json", audit)
    print(json.dumps({key: audit[key] for key in (
        "rowCount", "uniqueCodeCount", "rowsPerPage", "familyCounts", "zeroStockCount",
        "sumOfLineTotals", "sourcePrintedTotals", "lineSumMinusPrintedTotal",
        "lineArithmeticMismatches", "duplicateCodes", "identicalSourceRows",
    )}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
