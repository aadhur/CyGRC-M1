import hashlib

from fastapi import UploadFile


async def calculate_sha256(file: UploadFile) -> str:
    sha256 = hashlib.sha256()

    while chunk := await file.read(65536):
        sha256.update(chunk)

    await file.seek(0)

    return sha256.hexdigest()
