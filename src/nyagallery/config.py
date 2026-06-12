from __future__ import annotations

from dataclasses import dataclass
import os
from pathlib import Path
import tomllib
from typing import Any


DEFAULT_CONFIG_FILENAME = "nyagallery.toml"
CONFIG_ENV = "NYAGALLERY_CONFIG"
PROJECT_REPOSITORY = "https://github.com/NayaCcR/NyaGallery"


@dataclass(frozen=True)
class CoreConfig:
    storage: str = "storage"
    database_url: str | None = None
    tag_catalog_path: str | None = None


@dataclass(frozen=True)
class ServerConfig:
    host: str = "127.0.0.1"
    port: int = 8001
    access_log: bool = False
    secure_cookies: bool = False


@dataclass(frozen=True)
class SiteConfig:
    project_homepage: str = PROJECT_REPOSITORY
    repository: str = PROJECT_REPOSITORY
    icp_beian: str = ""


@dataclass(frozen=True)
class PixivConfig:
    refresh_token: str | None = None
    cookie: str | None = None
    default_request_delay_seconds: float = 1.0
    max_concurrency: int = 1


@dataclass(frozen=True)
class RedisConfig:
    url: str | None = None
    key_prefix: str = "nyagallery"
    security_limiter: bool = False


@dataclass(frozen=True)
class NyaGalleryConfig:
    core: CoreConfig = CoreConfig()
    server: ServerConfig = ServerConfig()
    site: SiteConfig = SiteConfig()
    pixiv: PixivConfig = PixivConfig()
    redis: RedisConfig = RedisConfig()
    path: Path | None = None


def load_config(path: str | Path | None = None) -> NyaGalleryConfig:
    resolved = _resolve_config_path(path)
    data: dict[str, Any] = {}
    if resolved:
        data = tomllib.loads(resolved.read_text(encoding="utf-8"))
    config = _config_from_dict(data, resolved)
    return _with_env_overrides(config)


def apply_config_environment(config: NyaGalleryConfig) -> None:
    os.environ.setdefault("NYAGALLERY_STORAGE", config.core.storage)
    if config.core.database_url:
        os.environ.setdefault("NYAGALLERY_DATABASE_URL", config.core.database_url)
    if config.server.secure_cookies:
        os.environ.setdefault("NYAGALLERY_SECURE_COOKIES", "1")
    if config.pixiv.refresh_token:
        os.environ.setdefault("PIXIV_REFRESH_TOKEN", config.pixiv.refresh_token)
    if config.redis.url:
        os.environ.setdefault("NYAGALLERY_REDIS_URL", config.redis.url)


def _resolve_config_path(path: str | Path | None) -> Path | None:
    requested = path or os.environ.get(CONFIG_ENV)
    if requested:
        resolved = Path(requested).expanduser()
        if not resolved.exists():
            raise FileNotFoundError(f"config file not found: {resolved}")
        return resolved

    default_path = Path(DEFAULT_CONFIG_FILENAME)
    return default_path if default_path.exists() else None


def _config_from_dict(data: dict[str, Any], path: Path | None) -> NyaGalleryConfig:
    core = _table(data, "core")
    server = _table(data, "server")
    site = _table(data, "site")
    pixiv = _table(data, "pixiv")
    redis = _table(data, "redis")
    return NyaGalleryConfig(
        core=CoreConfig(
            storage=_str(core.get("storage"), "storage"),
            database_url=_optional_str(core.get("database_url")),
            tag_catalog_path=_optional_str(core.get("tag_catalog_path")),
        ),
        server=ServerConfig(
            host=_str(server.get("host"), "127.0.0.1"),
            port=_int(server.get("port"), 8001),
            access_log=_bool(server.get("access_log"), False),
            secure_cookies=_bool(server.get("secure_cookies"), False),
        ),
        site=SiteConfig(
            project_homepage=_str(site.get("project_homepage"), PROJECT_REPOSITORY),
            repository=_str(site.get("repository"), PROJECT_REPOSITORY),
            icp_beian=_str(site.get("icp_beian"), ""),
        ),
        pixiv=PixivConfig(
            refresh_token=_optional_str(pixiv.get("refresh_token")),
            cookie=_optional_str(pixiv.get("cookie")),
            default_request_delay_seconds=_float(pixiv.get("default_request_delay_seconds"), 1.0),
            max_concurrency=_int(pixiv.get("max_concurrency"), 1),
        ),
        redis=RedisConfig(
            url=_optional_str(redis.get("url")),
            key_prefix=_str(redis.get("key_prefix"), "nyagallery"),
            security_limiter=_bool(redis.get("security_limiter"), False),
        ),
        path=path,
    )


def _with_env_overrides(config: NyaGalleryConfig) -> NyaGalleryConfig:
    core = CoreConfig(
        storage=os.environ.get("NYAGALLERY_STORAGE") or config.core.storage,
        database_url=os.environ.get("NYAGALLERY_DATABASE_URL") or config.core.database_url,
        tag_catalog_path=os.environ.get("NYAGALLERY_TAG_CATALOG") or config.core.tag_catalog_path,
    )
    server = ServerConfig(
        host=os.environ.get("NYAGALLERY_HOST") or config.server.host,
        port=_int(os.environ.get("NYAGALLERY_PORT"), config.server.port),
        access_log=_bool(os.environ.get("NYAGALLERY_ACCESS_LOG"), config.server.access_log),
        secure_cookies=_bool(os.environ.get("NYAGALLERY_SECURE_COOKIES"), config.server.secure_cookies),
    )
    site = SiteConfig(
        project_homepage=os.environ.get("NYAGALLERY_SITE_HOMEPAGE") or config.site.project_homepage,
        repository=os.environ.get("NYAGALLERY_SITE_REPOSITORY") or config.site.repository,
        icp_beian=os.environ.get("NYAGALLERY_SITE_ICP_BEIAN") or config.site.icp_beian,
    )
    pixiv = PixivConfig(
        refresh_token=os.environ.get("PIXIV_REFRESH_TOKEN") or config.pixiv.refresh_token,
        cookie=os.environ.get("PIXIV_COOKIE") or config.pixiv.cookie,
        default_request_delay_seconds=_float(
            os.environ.get("NYAGALLERY_PIXIV_DEFAULT_DELAY"),
            config.pixiv.default_request_delay_seconds,
        ),
        max_concurrency=_int(os.environ.get("NYAGALLERY_PIXIV_MAX_CONCURRENCY"), config.pixiv.max_concurrency),
    )
    redis = RedisConfig(
        url=os.environ.get("NYAGALLERY_REDIS_URL") or config.redis.url,
        key_prefix=os.environ.get("NYAGALLERY_REDIS_KEY_PREFIX") or config.redis.key_prefix,
        security_limiter=_bool(
            os.environ.get("NYAGALLERY_REDIS_SECURITY_LIMITER"),
            config.redis.security_limiter,
        ),
    )
    return NyaGalleryConfig(core=core, server=server, site=site, pixiv=pixiv, redis=redis, path=config.path)


def _table(data: dict[str, Any], key: str) -> dict[str, Any]:
    value = data.get(key, {})
    return value if isinstance(value, dict) else {}


def _optional_str(value: Any) -> str | None:
    text = str(value).strip() if value is not None else ""
    return text or None


def _str(value: Any, default: str) -> str:
    text = str(value).strip() if value is not None else ""
    return text or default


def _int(value: Any, default: int) -> int:
    if value in (None, ""):
        return default
    return int(value)


def _float(value: Any, default: float) -> float:
    if value in (None, ""):
        return default
    return float(value)


def _bool(value: Any, default: bool) -> bool:
    if value is None or value == "":
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "on"}
