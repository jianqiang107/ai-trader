from pathlib import Path
import re


BACKEND_DIR = Path(__file__).resolve().parents[1]
CONFIG = (BACKEND_DIR / "config.py").read_text()
USER_SERVICE = (BACKEND_DIR / "services" / "user_service.py").read_text()
USER_ROUTER = (BACKEND_DIR / "routers" / "user.py").read_text()


def assert_true(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> None:
    assert_true("ENVIRONMENT" in CONFIG, "settings must expose ENVIRONMENT so production behavior is explicit.")
    assert_true("SMS_PROVIDER" in CONFIG, "settings must expose SMS_PROVIDER for a replaceable SMS implementation.")
    assert_true("ALLOW_MOCK_SMS" in CONFIG, "settings must expose ALLOW_MOCK_SMS to block mock SMS in production.")
    assert_true('VERIFY_CODE: str = "123456"' not in CONFIG, "fixed MVP VERIFY_CODE must be removed from config.")

    assert_true("_generate_verify_code" in USER_SERVICE, "user_service must generate a fresh verification code.")
    assert_true("secrets" in USER_SERVICE, "verification code generation must use a random source.")
    assert_true("SmsProvider" in USER_SERVICE, "user_service must expose a replaceable SMS provider interface.")
    assert_true("SmsProviderNotConfigured" in USER_SERVICE, "production SMS misconfiguration must fail explicitly.")
    assert_true(
        re.search(r"settings\.VERIFY_CODE(?!_)", USER_SERVICE) is None,
        "user_service must not store a fixed settings.VERIFY_CODE value.",
    )
    assert_true("_verify_codes.pop(phone, None)" in USER_SERVICE, "successful verification must consume the code once.")

    assert_true("except ValueError as e" in USER_ROUTER, "send-code route must translate SMS failures into API errors.")


if __name__ == "__main__":
    main()
    print("verify code contract checks passed")
