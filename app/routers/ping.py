from fastapi import APIRouter
from fastapi.responses import Response

router = APIRouter(prefix="/api", tags=["ping"])

_SPEEDTEST_SIZE = 524288  # 512 KB
_SPEEDTEST_PAYLOAD = bytes(_SPEEDTEST_SIZE)


@router.get("/ping")
async def ping():
    return Response(status_code=200)


@router.get("/speedtest")
async def speedtest():
    return Response(
        content=_SPEEDTEST_PAYLOAD,
        media_type="application/octet-stream",
        headers={"Content-Length": str(_SPEEDTEST_SIZE)},
    )
