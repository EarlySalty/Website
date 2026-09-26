import json
import sys
import time
import urllib.request
import urllib.error

URL = "https://api.deadlock-api.com/v1/mcp"


def run_query(sql, max_tries=4):
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {"name": "execute_query", "arguments": {"sql": sql}},
    }
    body = json.dumps(payload).encode("utf-8")
    last_err = None
    for attempt in range(max_tries):
        req = urllib.request.Request(
            URL,
            data=body,
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json, text/event-stream",
                "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=320) as resp:
                raw = resp.read().decode("utf-8")
        except urllib.error.HTTPError as e:
            last_err = f"HTTP {e.code}: {e.read().decode('utf-8', 'replace')[:500]}"
            if e.code in (429, 500, 502, 503, 504):
                time.sleep(5 * (attempt + 1))
                continue
            raise RuntimeError(last_err)
        except Exception as e:
            last_err = str(e)
            time.sleep(5 * (attempt + 1))
            continue
        result = None
        for line in raw.splitlines():
            if line.startswith("data:"):
                data_line = line[5:].strip()
                if not data_line:
                    continue
                msg = json.loads(data_line)
                if "result" in msg:
                    result = msg["result"]
                elif "error" in msg:
                    raise RuntimeError("RPC error: " + json.dumps(msg["error"])[:1000])
        if result is None:
            raise RuntimeError("Keine result-Zeile in SSE-Antwort: " + raw[:500])
        texts = [c.get("text", "") for c in result.get("content", []) if c.get("type") == "text"]
        if not texts:
            raise RuntimeError("Leere content-Liste: " + json.dumps(result)[:500])
        try:
            parsed = json.loads(texts[0])
        except json.JSONDecodeError:
            raise RuntimeError("Antwort ist kein JSON: " + texts[0][:500])
        if isinstance(parsed, dict) and parsed.get("type") == "text":
            parsed = json.loads(parsed.get("text", "{}"))
        return parsed
    raise RuntimeError("Max Versuche erreicht: " + str(last_err))


if __name__ == "__main__":
    sql = sys.stdin.read() if len(sys.argv) < 2 else sys.argv[1]
    out = run_query(sql)
    json.dump(out, sys.stdout, ensure_ascii=False, indent=1)
    sys.stdout.write("\n")
