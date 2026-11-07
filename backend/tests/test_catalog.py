"""Generated error-code catalog (scripts/build_catalog.py): integrity, mapping rules, no invented fields."""
import re

import pytest

from app.knowledge import interpret, load_catalog

CAT = load_catalog()
E = CAT["entries"]
BY = CAT["_by_code"]
CODE = re.compile(r"^\d{4}-\d{4}-\d{4}-\d{4}$")


def test_size_and_uniqueness():
    assert len(E) >= 400 and len(BY) == len(E)
    assert CAT["catalog_version"] == "0.3.0"


@pytest.mark.parametrize("e", E, ids=[e["code"] for e in E])
def test_entry_shape(e):
    assert CODE.match(e["code"]) and e["title"] and e["summary"]
    assert e["toolhead"] in (None, 1, 2, 3, 4)
    assert e["mapping"] in (None, "ROW_TEXT", "MODULE_INDEX_RULE")
    assert (e["toolhead"] is None) == (e["mapping"] is None)
    assert isinstance(e["actions"], list) and e["actions"]
    a = e["article"]
    assert a is None or (a["url"].startswith("https://") and a["kind"] in ("wiki", "video") and a["title"])
    lvl, mod, _, _ = e["code"].split("-")
    assert lvl in CAT["levels"] and mod in CAT["modules"]


def test_hand_written_entries_are_preserved():
    e = BY["0002-0525-0002-0002"]
    assert e["title"] == "Filament feeder 3 loading anomaly" and e["toolhead"] == 3 and e["summary"].startswith("Loading anomaly reported for feeder 3.")


def test_row_text_wins_over_index_for_power_off_series():
    # 0522-*-0017 shifts the index by one: 0 = mainboard MCU, 1..4 = toolheads (the 0006/0008/0016 rows use 2..5)
    assert BY["0003-0522-0000-0017"]["toolhead"] is None and BY["0003-0522-0000-0017"]["title"].startswith("Mainboard MCU")
    for idx, head in ((1, 1), (2, 2), (3, 3), (4, 4)):
        e = BY[f"0003-0522-000{idx}-0017"]
        assert e["toolhead"] == head and e["mapping"] == "ROW_TEXT"
    assert BY["0003-0522-0002-0016"]["toolhead"] == 1  # 0016 uses 2..5


def test_axis_is_not_a_toolhead():
    ax = [e for e in E if e.get("axis")]
    assert ax and all(e["axis"] in "XYZ" for e in ax)


def test_new_code_decodes_as_known():
    d = interpret("0003-0522-0002-0017")
    assert d["status"] == "KNOWN" and d["classification"] == "OBSERVED" and d["entry"]["toolhead"] == 2


def test_unlisted_code_stays_inconclusive():
    d = interpret("0003-0522-0009-0099")
    assert d["status"] == "STRUCTURE_ONLY" and d["classification"] == "INCONCLUSIVE"


def test_every_module_has_entries():
    assert {e["code"].split("-")[1] for e in E} >= {"0522", "0523", "0525", "0526", "0527", "0528", "0529", "0530", "0531"}


def test_inspect_hints_follow_the_row_text():
    listed = BY["0002-0523-0003-0024"]  # head 4 picking failure: the row names heads 1 and 2
    assert listed["toolhead"] == 4 and listed["inspect_toolheads"] == [1, 2] and listed["inspect_scope"] == "listed"
    assert BY["0002-0523-0000-0013"]["inspect_toolheads"] == [1, 2, 3]
    assert BY["0002-0523-0000-0018"]["inspect_scope"] == "all" and BY["0002-0523-0000-0018"]["inspect_toolheads"] == [1, 2, 3, 4]
    assert BY["0002-0523-0000-0040"]["inspect_scope"] == "this_head" and BY["0002-0523-0000-0040"]["inspect_toolheads"] == [1]


def test_inspect_fields_shape():
    with_hint = [e for e in E if "inspect_scope" in e]
    assert len(with_hint) >= 140
    for e in with_hint:
        h = e["inspect_toolheads"]
        assert h == sorted(set(h)) and h and set(h) <= {1, 2, 3, 4}
        assert e["inspect_scope"] in ("listed", "all", "this_head")
        if e["inspect_scope"] == "this_head":
            assert h == [e["toolhead"]]
        if e["inspect_scope"] == "all":
            assert h == [1, 2, 3, 4]


# ---- known issues (BACKLOG #5) ------------------------------------------------
def test_known_issues_are_well_formed_and_link_real_codes():
    from app.knowledge import load_catalog, load_known_issues
    ki = load_known_issues()
    assert ki["source_url"].startswith("https://wiki.snapmaker.com/") and len(ki["issues"]) >= 5
    cat = load_catalog()["_by_code"]
    for i in ki["issues"]:
        assert set(i["title"]) == set(i["symptom"]) == set(i["cause"]) == set(i["fix"]) == {"en", "fr"}
        assert all(i[k][lang].strip() for k in ("title", "symptom", "cause", "fix") for lang in ("en", "fr"))
        if "code" in i["applies"]:
            assert i["applies"]["code"] in cat, i["id"]


def test_known_issue_decimal_comma_is_linked_to_its_code_and_version():
    from app.knowledge import load_known_issues
    one = next(i for i in load_known_issues()["issues"] if i["id"] == "KI-ORCA-DECIMAL-COMMA")
    assert one["applies"] == {"code": "0003-0529-0000-0001", "software": "Snapmaker Orca", "version_lt": "2.1.2"}
