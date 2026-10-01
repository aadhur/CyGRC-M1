import logging
import os
from typing import BinaryIO
from uuid import UUID

import boto3
from botocore.exceptions import ClientError

MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "http://localhost:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minio_local_admin")
MINIO_SECRET_KEY = os.getenv(
    "MINIO_SECRET_KEY",
    "minio_local_password_123",
)
BUCKET_NAME = os.getenv("MINIO_BUCKET", "cygrc-evidence")
logger = logging.getLogger(__name__)


def get_s3_client():
    """Create and return a boto3 S3 client configured for MinIO."""
    return boto3.client(
        "s3",
        endpoint_url=MINIO_ENDPOINT,
        aws_access_key_id=MINIO_ACCESS_KEY,
        aws_secret_access_key=MINIO_SECRET_KEY,
        region_name="us-east-1",
    )


def ensure_bucket_exists(client=None) -> None:
    """Create the evidence bucket if it does not already exist."""
    client = client or get_s3_client()

    try:
        client.head_bucket(Bucket=BUCKET_NAME)
    except ClientError as exc:
        error_code = exc.response.get("Error", {}).get("Code", "")

        if error_code in {"404", "NoSuchBucket"}:
            client.create_bucket(Bucket=BUCKET_NAME)
        else:
            raise


def build_evidence_key(
    tenant_id: UUID | str,
    evidence_id: UUID | str,
    extension: str,
) -> str:
    """Build a tenant-isolated S3 object key."""
    extension = extension.lstrip(".")

    return f"tenants/{tenant_id}/evidence/{evidence_id}.{extension}"


def upload_evidence(
    fileobj: BinaryIO,
    tenant_id: UUID | str,
    evidence_id: UUID | str,
    extension: str,
) -> str:
    """Stream an evidence file to MinIO and return its S3 object key."""
    client = get_s3_client()
    ensure_bucket_exists(client)

    object_key = build_evidence_key(
        tenant_id=tenant_id,
        evidence_id=evidence_id,
        extension=extension,
    )

    client.upload_fileobj(
        fileobj,
        BUCKET_NAME,
        object_key,
    )

    return object_key


def delete_evidence_from_storage(object_key: str) -> None:
    """Delete an evidence object from MinIO."""
    client = get_s3_client()

    client.delete_object(
        Bucket=BUCKET_NAME,
        Key=object_key,
    )


def cleanup_evidence_storage(
    object_key: str,
    tenant_id: UUID | str,
    evidence_id: UUID | str,
) -> None:
    """Best-effort cleanup of an evidence object after DB failure."""
    try:
        delete_evidence_from_storage(object_key)
    except Exception:
        logger.exception(
            "Failed to clean up evidence object after database failure",
            extra={
                "tenant_id": str(tenant_id),
                "evidence_id": str(evidence_id),
                "blob_s3_key": object_key,
            },
        )
