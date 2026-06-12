from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
import os
from pathlib import Path
import tempfile
from urllib.parse import unquote, urlparse

from nyagallery.metadata import GalleryMetadata, make_asset_key


class StorageError(RuntimeError):
    pass


class OriginalAlreadyExistsError(StorageError):
    pass


class MetadataAlreadyExistsError(StorageError):
    pass


class MetadataNotFoundError(StorageError):
    pass


@dataclass(frozen=True)
class StoredOriginal:
    path: Path
    relative_path: str
    filename: str
    sha256: str
    size: int
    was_existing: bool


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def filename_from_url(url: str) -> str:
    parsed = urlparse(url)
    name = Path(unquote(parsed.path)).name
    return name or "original"


def archival_suffix(source_filename: str) -> str:
    suffixes = [suffix.lower() for suffix in Path(source_filename).suffixes]
    if not suffixes:
        return ""
    if len(suffixes) >= 2 and suffixes[-2:] == [".ugoira", ".zip"]:
        return ".ugoira.zip"
    return suffixes[-1]


class GalleryStorage:
    """Filesystem storage that keeps originals immutable and metadata rebuildable."""

    def __init__(self, root: str | Path) -> None:
        self.root = Path(root).resolve()
        self.original_dir = self.root / "original"
        self.preview_dir = self.root / "preview"
        self.thumbs_dir = self.root / "thumbs"
        self.metadata_dir = self.root / "metadata"
        self.tags_dir = self.root / "tags"

    def ensure(self) -> None:
        for directory in (
            self.original_dir,
            self.preview_dir,
            self.thumbs_dir,
            self.metadata_dir,
            self.tags_dir,
        ):
            directory.mkdir(parents=True, exist_ok=True)

    def original_path(self, asset_key: str, source_filename: str) -> Path:
        suffix = archival_suffix(source_filename)
        return self.original_dir / f"{asset_key}{suffix}"

    def metadata_path(self, asset_key: str) -> Path:
        return self.metadata_dir / f"{asset_key}.json"

    def metadata_group_path(self, group_key: str) -> Path:
        return self.metadata_dir / f"{group_key}.json"

    def metadata_path_for(self, metadata: GalleryMetadata) -> Path:
        return self.metadata_group_path(metadata.metadata_group_key)

    def preview_path(self, asset_key: str, suffix: str = ".avif") -> Path:
        return self.preview_dir / f"{asset_key}{suffix}"

    def thumb_path(self, asset_key: str, suffix: str = ".avif") -> Path:
        return self.thumbs_dir / f"{asset_key}{suffix}"

    def cache_relative_path(self, path: Path) -> str:
        return self._relative(path)

    def resolve_relative_path(self, relative_path: str) -> Path:
        root = self.root.resolve()
        resolved = (self.root / relative_path).resolve()
        if not resolved.is_relative_to(root):
            raise StorageError(f"path escapes storage root: {relative_path}")
        return resolved

    def source_metadata_path(self, source: str, source_id: str, page_index: int | None = None) -> Path:
        return self.metadata_path(make_asset_key(source, source_id, page_index))

    def metadata_exists(self, source: str, source_id: str, page_index: int | None = None) -> bool:
        asset_key = make_asset_key(source, source_id, page_index)
        return self.find_metadata_path(asset_key) is not None

    def write_original(self, asset_key: str, source_filename: str, content: bytes) -> StoredOriginal:
        self.ensure()
        final_path = self.original_path(asset_key, source_filename)
        new_sha = sha256_bytes(content)

        try:
            fd = os.open(final_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL)
        except FileExistsError:
            existing_sha = sha256_file(final_path)
            if existing_sha != new_sha:
                raise OriginalAlreadyExistsError(
                    f"refusing to overwrite immutable original {final_path}"
                ) from None
            return StoredOriginal(
                path=final_path,
                relative_path=self._relative(final_path),
                filename=final_path.name,
                sha256=existing_sha,
                size=final_path.stat().st_size,
                was_existing=True,
            )

        with os.fdopen(fd, "wb") as file:
            file.write(content)

        return StoredOriginal(
            path=final_path,
            relative_path=self._relative(final_path),
            filename=final_path.name,
            sha256=new_sha,
            size=len(content),
            was_existing=False,
        )

    def write_metadata(self, metadata: GalleryMetadata, *, replace: bool = False) -> Path:
        self.ensure()
        path = self.metadata_path_for(metadata)
        existing_path = self.find_metadata_path(metadata.asset_key)
        if existing_path and existing_path != path:
            self._remove_metadata_from_file(existing_path, metadata.asset_key)

        group = self._read_metadata_group(path)
        assets = group["assets"]
        old = assets.get(metadata.asset_key)
        if old is not None and not replace:
            if old.to_dict() == metadata.to_dict():
                return path
            raise MetadataAlreadyExistsError(f"metadata already exists: {path}#{metadata.asset_key}")

        assets[metadata.asset_key] = metadata
        self._write_metadata_group(path, assets.values())
        return path

    def read_metadata(self, asset_key: str) -> GalleryMetadata:
        found = self._find_metadata(asset_key)
        if found is None:
            raise MetadataNotFoundError(f"metadata not found: {asset_key}")
        return found[1]

    def find_metadata_path(self, asset_key: str) -> Path | None:
        found = self._find_metadata(asset_key)
        return found[0] if found else None

    def iter_metadata(self) -> list[GalleryMetadata]:
        self.ensure()
        items: dict[str, GalleryMetadata] = {}
        for path in sorted(self.metadata_dir.glob("*.json")):
            if path.name.startswith("_"):
                continue
            data = json.loads(path.read_text(encoding="utf-8"))
            for metadata in self._metadata_items_from_json(data):
                items[metadata.asset_key] = metadata
        return [items[key] for key in sorted(items)]

    def migrate_metadata_to_groups(self, *, archive_legacy: bool = True) -> dict[str, int]:
        self.ensure()
        legacy_paths: list[Path] = []
        metadata_items: dict[str, GalleryMetadata] = {}
        for path in sorted(self.metadata_dir.glob("*.json")):
            if path.name.startswith("_"):
                continue
            data = json.loads(path.read_text(encoding="utf-8"))
            is_group = isinstance(data, dict) and isinstance(data.get("assets"), list)
            for metadata in self._metadata_items_from_json(data):
                metadata_items[metadata.asset_key] = metadata
            if not is_group:
                legacy_paths.append(path)

        grouped_paths: set[Path] = set()
        groups: dict[Path, list[GalleryMetadata]] = {}
        for metadata in metadata_items.values():
            path = self.metadata_path_for(metadata)
            groups.setdefault(path, []).append(metadata)
        for path, items in groups.items():
            self._write_metadata_group(path, items)
            grouped_paths.add(path)

        archived = 0
        if archive_legacy and legacy_paths:
            archive_dir = self.metadata_dir / "_legacy"
            archive_dir.mkdir(parents=True, exist_ok=True)
            for path in legacy_paths:
                if path.exists() and path not in grouped_paths:
                    target = archive_dir / path.name
                    os.replace(path, target)
                    archived += 1

        return {
            "assets": len(metadata_items),
            "groups": len(grouped_paths),
            "archived_legacy_files": archived,
        }

    def remove_metadata(self, asset_key: str) -> bool:
        found = self._find_metadata(asset_key)
        if found is None:
            return False
        self._remove_metadata_from_file(found[0], asset_key)
        return True

    def delete_asset_files(self, metadata: GalleryMetadata) -> list[str]:
        deleted: list[str] = []
        candidates = [
            self.resolve_relative_path(metadata.original_path),
            self.preview_path(metadata.asset_key, ".avif"),
            self.preview_path(metadata.asset_key, ".webp"),
            self.thumb_path(metadata.asset_key, ".avif"),
        ]
        for path in candidates:
            if path.exists():
                path.unlink()
                deleted.append(self._relative(path))
        return deleted

    def find_by_sha256(self, sha256: str, *, exclude_asset_key: str | None = None) -> GalleryMetadata | None:
        for metadata in self.iter_metadata():
            if metadata.asset_key == exclude_asset_key:
                continue
            if metadata.file_sha256 == sha256:
                return metadata
        return None

    def _relative(self, path: Path) -> str:
        return path.relative_to(self.root).as_posix()

    def _find_metadata(self, asset_key: str) -> tuple[Path, GalleryMetadata] | None:
        self.ensure()
        legacy_path = self.metadata_path(asset_key)
        if legacy_path.exists():
            data = json.loads(legacy_path.read_text(encoding="utf-8"))
            if not (isinstance(data, dict) and isinstance(data.get("assets"), list)):
                metadata = GalleryMetadata.from_dict(data)
                if metadata.asset_key == asset_key:
                    return legacy_path, metadata

        for path in sorted(self.metadata_dir.glob("*.json")):
            if path.name.startswith("_"):
                continue
            data = json.loads(path.read_text(encoding="utf-8"))
            for metadata in self._metadata_items_from_json(data):
                if metadata.asset_key == asset_key:
                    return path, metadata
        return None

    def _metadata_items_from_json(self, data: dict) -> list[GalleryMetadata]:
        if isinstance(data, dict) and isinstance(data.get("assets"), list):
            return [GalleryMetadata.from_dict(item) for item in data["assets"]]
        return [GalleryMetadata.from_dict(data)]

    def _read_metadata_group(self, path: Path) -> dict[str, dict[str, GalleryMetadata]]:
        if not path.exists():
            return {"assets": {}}
        data = json.loads(path.read_text(encoding="utf-8"))
        return {
            "assets": {
                metadata.asset_key: metadata
                for metadata in self._metadata_items_from_json(data)
            }
        }

    def _write_metadata_group(self, path: Path, items) -> None:
        assets = sorted(items, key=lambda metadata: metadata.asset_key)
        first = assets[0] if assets else None
        document = {
            "schema": "nyagallery.creator_metadata.v1",
            "creator_key": first.metadata_group_key if first else path.stem,
            "creator": {
                "artist_id": first.artist_id if first else "",
                "artist_name": first.artist_name if first else "",
                "uploader_user_id": first.uploader_user_id if first else None,
                "uploader_username": first.uploader_username if first else None,
            },
            "assets": [metadata.to_dict() for metadata in assets],
        }
        self._atomic_write_json(path, document)

    def _remove_metadata_from_file(self, path: Path, asset_key: str) -> None:
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data, dict) and isinstance(data.get("assets"), list):
            remaining = [
                metadata
                for metadata in self._metadata_items_from_json(data)
                if metadata.asset_key != asset_key
            ]
            if remaining:
                self._write_metadata_group(path, remaining)
            else:
                path.unlink()
        elif path.exists():
            metadata = GalleryMetadata.from_dict(data)
            if metadata.asset_key == asset_key:
                path.unlink()

    def _atomic_write_json(self, path: Path, data: dict) -> None:
        content = json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True)
        content_bytes = f"{content}\n".encode("utf-8")
        path.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile("wb", delete=False, dir=path.parent) as tmp:
            tmp.write(content_bytes)
            tmp_path = Path(tmp.name)
        os.replace(tmp_path, path)
