import { useEffect, useState } from "react";

type ApiStatus = "loading" | "ok" | "error";

export function App() {
  const [status, setStatus] = useState<ApiStatus>("loading");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/health", { signal: controller.signal })
      .then((res) => setStatus(res.ok ? "ok" : "error"))
      .catch((err: unknown) => {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          setStatus("error");
        }
      });
    return () => controller.abort();
  }, []);

  return (
    <main>
      <h1>Epiquiz</h1>
      <p>API : {status}</p>
    </main>
  );
}
