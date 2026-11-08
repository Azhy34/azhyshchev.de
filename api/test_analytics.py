"""Lead-analytics helpers for the AI Readiness Checker (portfolio/api).

Covers the pure functions behind `ai_checker_logs`: domain normalisation,
GDPR-safe IP hashing and the "gaps" extraction that turns a breakdown into the
actual sales argument ("what is still missing on this site").

Run from portfolio/api:
    python -m unittest test_analytics -v
"""
import unittest

import main as api


class TestNormalizeDomain(unittest.TestCase):
    def test_strips_scheme_path_and_www(self):
        self.assertEqual(
            api._normalize_domain("https://www.Example.com/page?x=1"), "example.com"
        )

    def test_keeps_subdomains(self):
        self.assertEqual(
            api._normalize_domain("https://shop.example.com/a"), "shop.example.com"
        )

    def test_returns_empty_string_for_bare_host(self):
        # The checker always stores the final URL (scheme included); a bare host
        # has no netloc, so it must not silently become a bogus domain.
        self.assertEqual(api._normalize_domain("itunite.ru"), "")

    def test_handles_garbage_without_raising(self):
        self.assertEqual(api._normalize_domain(""), "")


class TestHashIp(unittest.TestCase):
    def test_is_deterministic_and_fixed_length(self):
        first = api._hash_ip("89.66.169.176")
        second = api._hash_ip("89.66.169.176")

        self.assertEqual(first, second)
        self.assertEqual(len(first), 32)

    def test_does_not_leak_the_raw_ip(self):
        raw_ip = "89.66.169.176"

        self.assertNotIn(raw_ip, api._hash_ip(raw_ip))

    def test_differs_per_visitor(self):
        self.assertNotEqual(api._hash_ip("89.66.169.176"), api._hash_ip("212.183.16.185"))


class TestExtractGaps(unittest.TestCase):
    def test_returns_only_checks_below_max(self):
        breakdown = {
            "agent_readable_content": {"points": 20, "max": 20, "detail": "800 words"},
            "schema_org": {
                "points": 7,
                "max": 10,
                "detail": "Microdata Schema detected",
                "recommendation": "Switch to JSON-LD",
            },
            "markdown_availability": {
                "points": 0, "max": 5, "detail": "No Markdown endpoint", "bonus": True,
            },
        }

        gaps = api._extract_gaps(breakdown)

        self.assertEqual([gap["check"] for gap in gaps], ["schema_org", "markdown_availability"])
        self.assertEqual(gaps[0]["points"], 7)
        self.assertEqual(gaps[0]["max"], 10)
        self.assertEqual(gaps[0]["recommendation"], "Switch to JSON-LD")

    def test_perfect_site_has_no_gaps(self):
        breakdown = {
            "sitemap": {"points": 10, "max": 10},
            "llms_txt": {"points": 10, "max": 10, "bonus": True},
        }

        self.assertEqual(api._extract_gaps(breakdown), [])

    def test_tolerates_missing_or_null_values(self):
        breakdown = {"performance": {"points": None, "max": 10}, "sitemap": {}}

        self.assertEqual([gap["check"] for gap in api._extract_gaps(breakdown)], ["performance"])

    def test_empty_breakdown_is_safe(self):
        self.assertEqual(api._extract_gaps({}), [])


class TestLoggingConfiguration(unittest.TestCase):
    def test_log_token_is_required_only_when_configured(self):
        # Without a token configured the endpoint stays open (dev/self-hosted default).
        self.assertFalse(api.LOG_TOKEN)
        # With a token configured, a wrong/missing header must be rejected.
        original = api.LOG_TOKEN
        api.LOG_TOKEN = "secret-token"
        try:
            self.assertIsNone(api._require_log_token(_RequestStub({"x-log-token": "secret-token"})))
            with self.assertRaises(Exception):
                api._require_log_token(_RequestStub({}))
            with self.assertRaises(Exception):
                api._require_log_token(_RequestStub({"x-log-token": "wrong"}))
        finally:
            api.LOG_TOKEN = original


class _RequestStub:
    def __init__(self, headers):
        self.headers = headers


if __name__ == "__main__":
    unittest.main()
