import glob
import json

NUM = ["n", "wins", "n_vorn", "w_vorn", "n_gleich", "w_gleich", "n_hinten", "w_hinten",
       "n_unb", "w_unb", "steals"]
EVENTS = ("mb", "shr", "urn")
HIST = ("hist_mb", "hist_shr", "hist_urn")


def load(fn):
    with open(fn) as f:
        return json.load(f)


def main():
    files = sorted(glob.glob("a2_D_*.json"))
    tage = len(files)
    print("Tag-Dateien:", tage)
    zellen = {}
    hist = {}
    events_gesehen = set()
    for fn in files:
        d = load(fn)
        idx = {c: i for i, c in enumerate(d["columns"])}
        for row in d["rows"]:
            event = row[idx["event"]]
            events_gesehen.add(event)
            if event in HIST:
                tier = str(int(row[idx["grp"]]))
                hkey = (event, tier)
                bins = json.loads(row[idx["hist"]])
                acc = hist.setdefault(hkey, {})
                for k, v in bins.items():
                    acc[k] = acc.get(k, 0) + int(v)
                continue
            b0 = row[idx["b0"]]
            key = (event, None if b0 is None else int(b0), row[idx["grp"]])
            acc = zellen.setdefault(key, {k: 0 for k in NUM})
            for k in NUM:
                acc[k] += int(row[idx[k]] or 0)
    for e in EVENTS + HIST:
        if e not in events_gesehen:
            raise SystemExit(f"Ereignis-Zweig {e} fehlt in den Tages-Dateien")

    zeilen = []
    for (event, b0, grp) in sorted(zellen, key=lambda k: (k[0], k[1] is not None, k[1] or 0, k[2])):
        row = {"event": event, "b0": b0, "grp": grp}
        row.update(zellen[(event, b0, grp)])
        zeilen.append(row)
    hist_aus = {}
    for (event, tier) in sorted(hist, key=lambda k: (k[0], int(k[1]))):
        bins = hist[(event, tier)]
        hist_aus.setdefault(event, {})[tier] = {k: bins[k] for k in sorted(bins, key=int)}
    out = {"tage": tage, "zellen": zeilen, "hist": hist_aus}
    with open("a2_merged.json", "w") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)

    for e in EVENTS:
        n = sum(r["n"] for r in zeilen if r["event"] == e)
        print(f"{e}: n={n}")
    for e in HIST:
        n = sum(sum(b.values()) for b in hist_aus.get(e, {}).values())
        print(f"{e}: n={n}")


if __name__ == "__main__":
    main()
