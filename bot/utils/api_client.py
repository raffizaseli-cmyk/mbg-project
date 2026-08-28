"""
HTTP client untuk komunikasi dengan FastAPI backend.
"""

import logging
import httpx

logger = logging.getLogger(__name__)


class APIError(Exception):
    """Error dari backend API dengan status_code dan pesan yang sudah diparsing."""
    def __init__(self, message: str, status_code: int = 0, raw_data: dict | None = None, response_json: dict | None = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.raw_data = raw_data
        self.response_json = response_json or {}

    @classmethod
    def from_httpx(cls, exc: httpx.HTTPStatusError) -> "APIError":
        """Parse error message dari response JSON."""
        raw = None
        resp_json = {}
        try:
            resp_json = exc.response.json()
            raw = resp_json
            # FastAPI HTTPException wraps payload in {"detail": {...}}
            # Unwrap it so response_json contains the actual error dict
            if "detail" in resp_json and isinstance(resp_json["detail"], dict):
                resp_json = resp_json["detail"]
                raw = resp_json
            msg = resp_json.get("error") or resp_json.get("detail") or str(exc)
            if isinstance(msg, dict):
                msg = msg.get("error") or str(msg)
        except Exception:
            msg = str(exc)
        return cls(message=str(msg), status_code=exc.response.status_code, raw_data=raw, response_json=resp_json)




class APIClient:
    """
    Async HTTP client untuk FastAPI backend.

    Usage:
        api_client = APIClient("http://localhost:8000")
        user = await api_client.get("/auth/me", token="xyz")
    """

    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")
        self.timeout = 30

    def _build_headers(self, token: str | None = None) -> dict:
        """Build request headers."""
        headers = {"Content-Type": "application/json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        return headers

    async def get(
        self,
        endpoint: str,
        token: str | None = None,
        params: dict | None = None,
    ) -> dict:
        """GET request ke backend."""
        url = f"{self.base_url}{endpoint}"
        headers = self._build_headers(token)

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(url, headers=headers, params=params)
                response.raise_for_status()
                return response.json()
        except httpx.TimeoutException:
            raise APIError("Request timeout — backend tidak merespons", status_code=408)
        except httpx.HTTPStatusError as e:
            raise APIError.from_httpx(e)
        except APIError:
            raise
        except Exception as e:
            raise APIError(f"Request error: {str(e)}", status_code=0)

    async def post(
        self,
        endpoint: str,
        data: dict | None = None,
        json: dict | list | None = None,
        token: str | None = None,
        files: dict | None = None,
    ) -> dict:
        """POST request ke backend."""
        url = f"{self.base_url}{endpoint}"
        headers = self._build_headers(token)

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                if files:
                    # Jika ada file, gunakan multipart form
                    response = await client.post(
                        url,
                        headers={"Authorization": headers.get("Authorization", "")},
                        data=data,
                        files=files,
                    )
                else:
                    if json is not None:
                        response = await client.post(url, headers=headers, data=data, json=json)
                    else:
                        response = await client.post(url, headers=headers, json=data)
                response.raise_for_status()
                return response.json()
        except httpx.TimeoutException:
            raise APIError("Request timeout — backend tidak merespons", status_code=408)
        except httpx.HTTPStatusError as e:
            raise APIError.from_httpx(e)
        except APIError:
            raise
        except Exception as e:
            raise APIError(f"Request error: {str(e)}", status_code=0)

    async def put(
        self,
        endpoint: str,
        data: dict | None = None,
        json: dict | list | None = None,
        token: str | None = None,
    ) -> dict:
        """PUT request ke backend."""
        url = f"{self.base_url}{endpoint}"
        headers = self._build_headers(token)

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                if json is not None:
                    response = await client.put(url, headers=headers, data=data, json=json)
                else:
                    response = await client.put(url, headers=headers, json=data)
                response.raise_for_status()
                return response.json()
        except httpx.TimeoutException:
            raise APIError("Request timeout — backend tidak merespons", status_code=408)
        except httpx.HTTPStatusError as e:
            raise APIError.from_httpx(e)
        except APIError:
            raise
        except Exception as e:
            raise APIError(f"Request error: {str(e)}", status_code=0)


    async def delete(
        self,
        endpoint: str,
        token: str | None = None,
    ) -> dict:
        """DELETE request ke backend."""
        url = f"{self.base_url}{endpoint}"
        headers = self._build_headers(token)

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.delete(url, headers=headers)
                response.raise_for_status()
                return response.json()
        except httpx.TimeoutException:
            raise APIError("Request timeout — backend tidak merespons", status_code=408)
        except httpx.HTTPStatusError as e:
            raise APIError.from_httpx(e)
        except APIError:
            raise
        except Exception as e:
            raise APIError(f"Request error: {str(e)}", status_code=0)


# Singleton instance
def get_api_client(base_url: str) -> APIClient:
    """Factory untuk membuat API client."""
    return APIClient(base_url)
