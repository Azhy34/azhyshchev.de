"""Scoring invariants for the AI Readiness Checker API (portfolio/api).

Guards the scoring bugs fixed on 2026-11-08:
  1. The score used to be `min(100, round(base*100/90) + llms_bonus + md_bonus)`.
     The base percentage already peaks at 100, so the additive bonuses could only
     paper over lost base points: a site with 84/90 base + llms.txt became
     93 + 10 = 103 -> capped at 100 "Optimal" while two cards still showed gaps.
  2. `_check_token_economics("")` paid a full 15/15 for "~0 Tokens (Optimal)",
     i.e. an empty / unextractable page scored maximum token points.

Run from portfolio/api:
    python -m unittest test_scoring -v
"""
import unittest

import main as api

# Declared per-check maxima. They must add up to exactly api.TOTAL_MAX,
# because the final score is now a plain sum of these values.
CHECK_MAXIMA = {
    "agent_readable_content": 20,
    "ai_agent_access": 15,
    "token_economics": 10,
    "server_side_rendering": 10,
    "schema_org": 10,
    "performance": 10,
    "sitemap": 10,
    "llms_txt": 10,
    "markdown_availability": 5,
}


def breakdown_with(**overrides):
    """Return a breakdown where every check is full, lowered by `overrides`."""
    points = dict(CHECK_MAXIMA)
    points.update(overrides)
    return {
        key: {"points": points[key], "max": CHECK_MAXIMA[key]}
        for key in CHECK_MAXIMA
    }


class TestComputeScore(unittest.TestCase):
    def test_check_maxima_add_up_to_the_declared_total(self):
        self.assertEqual(sum(CHECK_MAXIMA.values()), api.TOTAL_MAX)

    def test_perfect_site_scores_full_marks(self):
        self.assertEqual(api._compute_score(breakdown_with()), api.TOTAL_MAX)

    def test_score_is_the_plain_sum_of_all_checks(self):
        # Arrange: schema and TTFB lose 3 points each, markdown endpoint is absent
        breakdown = breakdown_with(schema_org=7, performance=7, markdown_availability=0)

        # Act
        score = api._compute_score(breakdown)

        # Assert: 20 + 15 + 10 + 10 + 7 + 7 + 10 + 10 + 0 = 89
        self.assertEqual(score, 89)

    def test_bonuses_cannot_lift_a_site_with_gaps_to_100(self):
        # Regression: itunite.ru scored 100 despite schema 7/10 and performance 7/10
        breakdown = breakdown_with(schema_org=7, performance=7, markdown_availability=0)

        self.assertLess(api._compute_score(breakdown), 100)

    def test_100_requires_every_single_check_to_be_full(self):
        for key, max_points in CHECK_MAXIMA.items():
            with self.subTest(check=key):
                score = api._compute_score(breakdown_with(**{key: max_points - 1}))
                self.assertEqual(score, api.TOTAL_MAX - 1)

    def test_more_points_never_lower_the_score(self):
        low = api._compute_score(breakdown_with(agent_readable_content=10))
        high = api._compute_score(breakdown_with(agent_readable_content=20))

        self.assertLess(low, high)


class TestVerdicts(unittest.TestCase):
    def test_verdict_bands(self):
        expected_verdicts = {
            100: "Optimal",
            90: "Optimal",
            89: "Needs Improvement",
            70: "Needs Improvement",
            69: "Critical",
            0: "Critical",
        }

        for score, expected in expected_verdicts.items():
            with self.subTest(score=score):
                self.assertEqual(api._verdict_for_score(score), expected)


class TestTokenEconomics(unittest.TestCase):
    def test_empty_text_scores_zero_instead_of_full_marks(self):
        points, max_points, detail, recommendation = api._check_token_economics("")

        self.assertEqual(points, 0)
        self.assertEqual(max_points, 10)
        self.assertEqual(detail, "No extractable text")
        self.assertIsNotNone(recommendation)

    def test_normal_page_gets_full_marks(self):
        page_text = "word " * 1000  # ~1250 tokens, far below the 50k limit

        points, max_points, _, _ = api._check_token_economics(page_text)

        self.assertEqual((points, max_points), (10, 10))

    def test_oversized_dom_loses_all_points(self):
        huge_text = "x" * 800_001  # ~200k tokens

        points, max_points, _, _ = api._check_token_economics(huge_text)

        self.assertEqual((points, max_points), (0, 10))


class TestCheckMaximaInCode(unittest.TestCase):
    """Declared maxima must match what the check functions really return."""

    RICH_HTML = "<html><body><main>" + ("word " * 900) + "</main></body></html>"
    JSON_LD = '<script type="application/ld+json">{"@type":"Organization"}</script>'

    def test_base_checks_report_the_declared_maxima(self):
        self.assertEqual(
            api._check_ai_bot_access("")[1], CHECK_MAXIMA["ai_agent_access"]
        )
        self.assertEqual(
            api._check_ssr(self.RICH_HTML, False, False)[1],
            CHECK_MAXIMA["server_side_rendering"],
        )
        self.assertEqual(
            api._check_agent_readable_content(self.RICH_HTML, False, False)[1],
            CHECK_MAXIMA["agent_readable_content"],
        )
        self.assertEqual(
            api._check_schema_org(self.JSON_LD)[1], CHECK_MAXIMA["schema_org"]
        )
        self.assertEqual(api._check_performance(120)[1], CHECK_MAXIMA["performance"])
        self.assertEqual(
            api._check_token_economics("word " * 1000)[1],
            CHECK_MAXIMA["token_economics"],
        )

    def test_perfect_run_of_real_checks_scores_full_marks(self):
        # Arrange: real check functions for everything that needs no network call
        raw_breakdown = {
            "ai_agent_access": api._check_ai_bot_access(""),
            "server_side_rendering": api._check_ssr(self.RICH_HTML, False, False),
            "agent_readable_content": api._check_agent_readable_content(
                self.RICH_HTML, False, False
            ),
            "schema_org": api._check_schema_org(self.JSON_LD),
            "performance": api._check_performance(120),
            "token_economics": api._check_token_economics("word " * 1000),
            # sitemap / llms.txt / markdown need HTTP — pin them at full marks
            "sitemap": (10, 10, "Sitemap found in robots.txt", None),
            "llms_txt": (10, 10, "llms.txt found", None),
            "markdown_availability": (5, 5, "Markdown found at /index.md", None),
        }

        # Act
        breakdown = {
            key: {"points": value[0], "max": value[1]}
            for key, value in raw_breakdown.items()
        }
        score = api._compute_score(breakdown)

        # Assert
        self.assertEqual(score, api.TOTAL_MAX)


if __name__ == "__main__":
    unittest.main()
