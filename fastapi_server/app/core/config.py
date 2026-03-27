from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Banking Management System API"
    env: str = "development"
    host: str = "0.0.0.0"
    port: int = 3000

    database_url: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/banking_system"

    jwt_secret: str = "banking_system_super_secret_key_2024"
    jwt_algorithm: str = "HS256"
    jwt_expires_minutes: int = 60 * 24


settings = Settings()
