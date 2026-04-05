from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    gemini_api_key: str = ""
    hydradb_api_key: str = ""
    jwt_secret: str = "styleme-hackathon-secret"
    cors_origins: str = "http://localhost:3000"
    hydradb_tenant_id: str = "styleme"
    embedding_dimensions: int = 768
    max_upload_images: int = 20
    image_max_size_px: int = 1024

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
