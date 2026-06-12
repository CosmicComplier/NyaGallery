from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from typing import Callable
import time
import zipfile

from nyagallery.metadata import GalleryMetadata
from nyagallery.storage import GalleryStorage


ProgressCallback = Callable[[dict[str, object]], None]


@dataclass(frozen=True)
class GeneratedMedia:
    asset_key: str
    preview_path: str | None
    thumb_path: str | None
    kind: str


class MediaGenerationError(RuntimeError):
    pass


def _emit_progress(callback: ProgressCallback | None, **payload: object) -> None:
    if callback is None:
        return
    try:
        callback(payload)
    except Exception:
        pass


class MediaGenerator:
    def __init__(
        self,
        storage: GalleryStorage,
        *,
        preview_max_edge: int = 1800,
        thumb_max_edge: int = 420,
        avif_quality: int = 82,
        webp_quality: int = 82,
    ) -> None:
        self.storage = storage
        self.preview_max_edge = preview_max_edge
        self.thumb_max_edge = thumb_max_edge
        self.avif_quality = avif_quality
        self.webp_quality = webp_quality

    def generate_all(self) -> list[GeneratedMedia]:
        return [self.generate_for_metadata(metadata) for metadata in self.storage.iter_metadata()]

    def generate_for_asset_key(self, asset_key: str) -> GeneratedMedia:
        return self.generate_for_metadata(self.storage.read_metadata(asset_key))

    def generate_for_metadata(
        self,
        metadata: GalleryMetadata,
        *,
        progress: ProgressCallback | None = None,
    ) -> GeneratedMedia:
        self.storage.ensure()
        original_path = self.storage.resolve_relative_path(metadata.original_path)
        if not original_path.exists():
            raise MediaGenerationError(f"original file does not exist: {original_path}")
        _emit_progress(progress, stage="starting", progress=0.0, message="starting media cache generation")
        if original_path.suffix.lower() == ".zip" or metadata.mime_type == "application/zip":
            return self._generate_ugoira(metadata, original_path, progress=progress)
        if is_animated_raster(original_path):
            return self._generate_animated_raster(metadata, original_path, progress=progress)
        return self._generate_static(metadata, original_path, progress=progress)

    def _generate_static(
        self,
        metadata: GalleryMetadata,
        original_path: Path,
        *,
        progress: ProgressCallback | None = None,
    ) -> GeneratedMedia:
        Image, ImageOps, _ = _load_pillow()
        with Image.open(original_path) as source:
            _emit_progress(progress, stage="reading_image", progress=20.0, message="reading image")
            image = ImageOps.exif_transpose(source)
            _write_media_metadata_if_changed(self.storage, metadata, image.size, is_animated=False)
            preview = _fit_image(image, self.preview_max_edge)
            thumb = _fit_image(image, self.thumb_max_edge)
            preview_path = self.storage.preview_path(metadata.asset_key, ".avif")
            thumb_path = self.storage.thumb_path(metadata.asset_key, ".avif")
            _remove_if_exists(self.storage.preview_path(metadata.asset_key, ".webp"))
            _emit_progress(progress, stage="encoding_preview", progress=65.0, message="encoding preview")
            _save_avif(preview, preview_path, self.avif_quality)
            _emit_progress(progress, stage="encoding_thumb", progress=85.0, message="encoding thumbnail")
            _save_avif(thumb, thumb_path, self.avif_quality)
        return GeneratedMedia(
            asset_key=metadata.asset_key,
            preview_path=self.storage.cache_relative_path(preview_path),
            thumb_path=self.storage.cache_relative_path(thumb_path),
            kind="static",
        )

    def _generate_animated_raster(
        self,
        metadata: GalleryMetadata,
        original_path: Path,
        *,
        progress: ProgressCallback | None = None,
    ) -> GeneratedMedia:
        Image, ImageOps, ImageSequence = _load_pillow()
        with Image.open(original_path) as source:
            frames = []
            durations = []
            first_frame_size: tuple[int, int] | None = None
            total_frames = max(1, int(getattr(source, "n_frames", 1) or 1))
            start = time.perf_counter()
            last_emit = 0.0
            for index, frame in enumerate(ImageSequence.Iterator(source), 1):
                image = ImageOps.exif_transpose(frame)
                if first_frame_size is None:
                    first_frame_size = image.size
                frames.append(_fit_image(image.convert("RGBA"), self.preview_max_edge))
                durations.append(max(20, int(frame.info.get("duration") or source.info.get("duration") or 100)))
                now = time.perf_counter()
                if index == 1 or index == total_frames or now - last_emit >= 0.75:
                    elapsed = max(0.001, now - start)
                    _emit_progress(
                        progress,
                        stage="reading_frames",
                        progress=min(85.0, 5.0 + 75.0 * index / total_frames),
                        message="reading animated frames",
                        frames_done=index,
                        frames_total=total_frames,
                        frames_per_second=index / elapsed,
                    )
                    last_emit = now
            loop = int(source.info.get("loop") or 0)

        if not frames:
            raise MediaGenerationError(f"animated image has no frames: {original_path}")
        if first_frame_size:
            _write_media_metadata_if_changed(self.storage, metadata, first_frame_size, is_animated=True)

        preview_path = self.storage.preview_path(metadata.asset_key, ".webp")
        thumb_path = self.storage.thumb_path(metadata.asset_key, ".avif")
        _remove_if_exists(self.storage.preview_path(metadata.asset_key, ".avif"))
        _emit_progress(
            progress,
            stage="encoding_webp",
            progress=90.0,
            message="encoding animated preview",
            frames_done=len(frames),
            frames_total=len(frames),
        )
        _save_animated_webp(frames, durations, preview_path, self.webp_quality, loop=loop)
        _emit_progress(progress, stage="encoding_thumb", progress=96.0, message="encoding thumbnail")
        _save_avif(_fit_image(frames[0], self.thumb_max_edge), thumb_path, self.avif_quality)
        return GeneratedMedia(
            asset_key=metadata.asset_key,
            preview_path=self.storage.cache_relative_path(preview_path),
            thumb_path=self.storage.cache_relative_path(thumb_path),
            kind="animated",
        )

    def _generate_ugoira(
        self,
        metadata: GalleryMetadata,
        original_path: Path,
        *,
        progress: ProgressCallback | None = None,
    ) -> GeneratedMedia:
        Image, _, _ = _load_pillow()
        frame_specs = metadata.extra.get("ugoira_frames") or []
        frames_by_name = {
            str(frame.get("file")): int(frame.get("delay") or 100)
            for frame in frame_specs
            if isinstance(frame, dict) and str(frame.get("file") or "").strip()
        }
        with zipfile.ZipFile(original_path) as archive:
            names = [name for name in archive.namelist() if _is_image_name(name)]
            if not names:
                raise MediaGenerationError(f"ugoira zip has no image frames: {original_path}")
            ordered_names = [name for name in frames_by_name if name in names] or sorted(names)
            frames = []
            durations = []
            first_frame_size: tuple[int, int] | None = None
            total_frames = max(1, len(ordered_names))
            start = time.perf_counter()
            last_emit = 0.0
            for index, name in enumerate(ordered_names, 1):
                with archive.open(name) as file:
                    frame = Image.open(BytesIO(file.read())).convert("RGBA")
                    if first_frame_size is None:
                        first_frame_size = frame.size
                    frames.append(_fit_image(frame, self.preview_max_edge))
                    durations.append(frames_by_name.get(name, 100))
                now = time.perf_counter()
                if index == 1 or index == total_frames or now - last_emit >= 0.75:
                    elapsed = max(0.001, now - start)
                    _emit_progress(
                        progress,
                        stage="reading_frames",
                        progress=min(85.0, 5.0 + 75.0 * index / total_frames),
                        message="reading ugoira frames",
                        frames_done=index,
                        frames_total=total_frames,
                        frames_per_second=index / elapsed,
                    )
                    last_emit = now
        if first_frame_size:
            _write_media_metadata_if_changed(self.storage, metadata, first_frame_size, is_animated=True)

        preview_path = self.storage.preview_path(metadata.asset_key, ".webp")
        _remove_if_exists(self.storage.preview_path(metadata.asset_key, ".avif"))
        _emit_progress(
            progress,
            stage="encoding_webp",
            progress=90.0,
            message="encoding ugoira preview",
            frames_done=len(frames),
            frames_total=len(frames),
        )
        frames[0].save(
            preview_path,
            format="WEBP",
            save_all=True,
            append_images=frames[1:],
            duration=durations,
            loop=0,
            quality=self.webp_quality,
            method=6,
        )
        thumb = _fit_image(frames[0], self.thumb_max_edge)
        thumb_path = self.storage.thumb_path(metadata.asset_key, ".avif")
        _emit_progress(progress, stage="encoding_thumb", progress=96.0, message="encoding thumbnail")
        _save_avif(thumb, thumb_path, self.avif_quality)
        return GeneratedMedia(
            asset_key=metadata.asset_key,
            preview_path=self.storage.cache_relative_path(preview_path),
            thumb_path=self.storage.cache_relative_path(thumb_path),
            kind="ugoira",
        )


def probe_media_size(path: Path, *, mime_type: str | None = None) -> tuple[int | None, int | None]:
    try:
        if path.suffix.lower() == ".zip" or mime_type == "application/zip":
            return _probe_ugoira_size(path)
        return _probe_static_size(path)
    except Exception:
        return (None, None)


def is_animated_raster(path: Path) -> bool:
    try:
        Image, _, _ = _load_pillow()
        with Image.open(path) as source:
            return bool(getattr(source, "is_animated", False) and getattr(source, "n_frames", 1) > 1)
    except Exception:
        return False


def _load_pillow():
    try:
        import pillow_avif  # noqa: F401
        from PIL import Image, ImageOps, ImageSequence
    except ImportError as exc:
        raise MediaGenerationError(
            "Install media support with: pip install -e .[media]"
        ) from exc
    return Image, ImageOps, ImageSequence


def _probe_static_size(path: Path) -> tuple[int | None, int | None]:
    Image, ImageOps, _ = _load_pillow()
    with Image.open(path) as source:
        image = ImageOps.exif_transpose(source)
        return image.size


def _probe_ugoira_size(path: Path) -> tuple[int | None, int | None]:
    Image, _, _ = _load_pillow()
    with zipfile.ZipFile(path) as archive:
        for name in sorted(archive.namelist()):
            if not _is_image_name(name):
                continue
            with archive.open(name) as file:
                with Image.open(BytesIO(file.read())) as image:
                    return image.size
    return (None, None)


def _write_media_metadata_if_changed(
    storage: GalleryStorage,
    metadata: GalleryMetadata,
    size: tuple[int, int],
    *,
    is_animated: bool,
) -> None:
    width, height = size
    if metadata.width == width and metadata.height == height and metadata.is_animated == is_animated:
        return
    updated = metadata.__class__(
        **{
            **metadata.to_dict(),
            "width": width,
            "height": height,
            "is_animated": is_animated,
        }
    )
    storage.write_metadata(updated, replace=True)


def _fit_image(image, max_edge: int):
    fitted = image.copy()
    if fitted.mode not in ("RGB", "RGBA"):
        fitted = fitted.convert("RGBA")
    fitted.thumbnail((max_edge, max_edge))
    return fitted


def _save_avif(image, path: Path, quality: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="AVIF", quality=quality)


def _save_animated_webp(frames, durations: list[int], path: Path, quality: int, *, loop: int = 0) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    frames[0].save(
        path,
        format="WEBP",
        save_all=True,
        append_images=frames[1:],
        duration=durations,
        loop=loop,
        quality=quality,
        method=6,
    )


def _remove_if_exists(path: Path) -> None:
    if path.exists():
        path.unlink()


def _is_image_name(name: str) -> bool:
    return Path(name).suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}
