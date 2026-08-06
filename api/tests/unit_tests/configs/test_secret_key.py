from unittest.mock import MagicMock, patch

import pytest

from configs.secret_key import (
    GENERATED_SECRET_KEY_FILENAME,
    _load_or_create_secret_key,
    resolve_secret_key,
)


def _make_redis_lock(*, acquired: bool = True) -> MagicMock:
    lock = MagicMock()
    lock.acquire.return_value = acquired
    return lock


class TestResolveSecretKey:
    def test_returns_explicit_secret_key_without_touching_storage(self):
        with patch("configs.secret_key.storage.load_once") as mock_load_once:
            assert resolve_secret_key("explicit-key") == "explicit-key"
            mock_load_once.assert_not_called()

    def test_returns_persisted_key_without_acquiring_lock(self):
        with (
            patch("configs.secret_key.storage.load_once", return_value=b"persisted-key\n") as mock_load_once,
            patch("configs.secret_key.redis_client.lock") as mock_lock,
        ):
            assert resolve_secret_key("") == "persisted-key"
            mock_load_once.assert_called_once_with(GENERATED_SECRET_KEY_FILENAME)
            mock_lock.assert_not_called()

    def test_generates_and_persists_key_when_missing(self):
        lock = _make_redis_lock(acquired=True)
        with (
            patch("configs.secret_key.storage.load_once", side_effect=FileNotFoundError()),
            patch("configs.secret_key.storage.save") as mock_save,
            patch("configs.secret_key.redis_client.lock", return_value=lock),
        ):
            generated = _load_or_create_secret_key()

        assert generated
        mock_save.assert_called_once()
        assert mock_save.call_args.args[0] == GENERATED_SECRET_KEY_FILENAME
        lock.acquire.assert_called_once_with(blocking=True)
        lock.release.assert_called_once()

    def test_uses_key_persisted_by_concurrent_process_instead_of_generating_own(self):
        """Regression test for the api/api_websocket first-boot race (issue #40008).

        Two processes can both miss the file before any lock is taken. Whichever
        process wins the lock must re-check storage before generating: if the other
        process already persisted a key while this one was waiting, it must reuse
        that key rather than minting and returning its own.
        """
        lock = _make_redis_lock(acquired=True)
        with (
            patch(
                "configs.secret_key.storage.load_once",
                side_effect=[FileNotFoundError(), b"key-from-other-process\n"],
            ),
            patch("configs.secret_key.storage.save") as mock_save,
            patch("configs.secret_key.redis_client.lock", return_value=lock),
        ):
            result = _load_or_create_secret_key()

        assert result == "key-from-other-process"
        mock_save.assert_not_called()
        lock.release.assert_called_once()

    def test_raises_when_lock_times_out_and_no_key_persisted(self):
        lock = _make_redis_lock(acquired=False)
        with (
            patch("configs.secret_key.storage.load_once", side_effect=FileNotFoundError()),
            patch("configs.secret_key.redis_client.lock", return_value=lock),
        ):
            with pytest.raises(ValueError, match="timed out waiting"):
                _load_or_create_secret_key()
