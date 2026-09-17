const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

/**
 * Uploads a single evidence file with progress reporting. `fetch`/`api.post`
 * (see client.ts) can't report upload progress and always JSON-encode the
 * body, so this goes straight to XMLHttpRequest. Auth follows the same
 * pattern as apiFetch: no manual Authorization header, the access-token
 * cookie rides along via `withCredentials`, and a 401 triggers one
 * refresh-and-retry against /api/auth/refresh before giving up and sending
 * the user back to /login.
 */
export function uploadEvidenceFile(
  controlId: string,
  file: File,
  onProgress?: (percent: number) => void,
  allowRetry = true,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("control_id", controlId);
    formData.append("file", file);

    xhr.open("POST", `${API_BASE_URL}/v1/evidence`, true);
    xhr.withCredentials = true;

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          resolve(undefined);
        }
        return;
      }

      if (xhr.status === 401 && allowRetry) {
        const refreshed = await fetch("/api/auth/refresh", {
          method: "POST",
          credentials: "include",
        })
          .then((r) => r.ok)
          .catch(() => false);

        if (refreshed) {
          try {
            resolve(await uploadEvidenceFile(controlId, file, onProgress, false));
          } catch (err) {
            reject(err);
          }
          return;
        }

        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
      }

      let message = `Upload failed: ${xhr.status}`;
      try {
        const parsed = JSON.parse(xhr.responseText);
        if (typeof parsed?.detail === "string") message = parsed.detail;
      } catch {
        // keep the default message
      }
      reject(new Error(message));
    };

    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(formData);
  });
}
