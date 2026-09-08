import os


class Settings:
    APP_ENV: str = os.getenv("APP_ENV", "local")

    # Keycloak Configurations
    KEYCLOAK_BASE_URL: str = os.getenv("KEYCLOAK_BASE_URL", "http://localhost:8080")
    KEYCLOAK_REALM: str = "cyart-platform"
    KEYCLOAK_CLIENT_ID: str = "cygrc-app"

    # Keycloak Administration
    KEYCLOAK_ADMIN_USER: str = os.getenv("KEYCLOAK_ADMIN_USER", "admin")
    KEYCLOAK_ADMIN_PASSWORD: str = os.getenv(
        "KEYCLOAK_ADMIN_PASSWORD", "admin_password_123"
    )


settings = Settings()

# 2. Build the JWKS URL dynamically from the Base URL and Realm
settings.KEYCLOAK_JWKS_URL = f"{settings.KEYCLOAK_BASE_URL}/realms/{settings.KEYCLOAK_REALM}/protocol/openid-connect/certs"
