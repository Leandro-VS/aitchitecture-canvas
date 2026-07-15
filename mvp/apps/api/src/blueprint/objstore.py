"""Acesso a objetos (MinIO local / S3 na AWS — mesmo código via endpoint_url).

boto3 é síncrono; as chamadas rodam em thread para não bloquear o event loop.
"""

import asyncio
import functools

import boto3

from .settings import settings


@functools.cache
def _client():
    return boto3.client("s3", endpoint_url=settings.s3_endpoint_url)


async def get_object(key: str) -> bytes:
    def _get() -> bytes:
        return _client().get_object(Bucket=settings.s3_bucket, Key=key)["Body"].read()

    return await asyncio.to_thread(_get)


async def list_keys(prefix: str) -> list[str]:
    def _list() -> list[str]:
        paginator = _client().get_paginator("list_objects_v2")
        keys: list[str] = []
        for page in paginator.paginate(Bucket=settings.s3_bucket, Prefix=prefix):
            keys.extend(obj["Key"] for obj in page.get("Contents", []))
        return keys

    return await asyncio.to_thread(_list)


async def put_object(key: str, body: bytes, content_type: str = "application/octet-stream") -> None:
    def _put() -> None:
        _client().put_object(
            Bucket=settings.s3_bucket, Key=key, Body=body, ContentType=content_type
        )

    await asyncio.to_thread(_put)


async def presign(key: str, expires_s: int = 3600) -> str:
    def _sign() -> str:
        return _client().generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.s3_bucket, "Key": key},
            ExpiresIn=expires_s,
        )

    return await asyncio.to_thread(_sign)
