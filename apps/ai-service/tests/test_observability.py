from app.core.observability import build_structured_log, truncate_for_log


def test_build_structured_log_envelope() -> None:
    envelope = build_structured_log(
        level="info",
        event="ai.campaign.strategy.completed",
        service="miraaj-ai-service",
        environment="test",
        module="campaigns",
        request_id="req-1",
        correlation_id="corr-1",
        campaign_job_id="job-1",
        outcome="success",
    )
    assert envelope["event"] == "ai.campaign.strategy.completed"
    assert envelope["campaignJobId"] == "job-1"
    assert "timestamp" in envelope


def test_truncate_and_redact_campaign_metadata() -> None:
    envelope = build_structured_log(
        level="info",
        event="ai.campaign.master.generated",
        service="miraaj-ai-service",
        environment="test",
        metadata={
            "campaignContent": "x" * 400,
            "authorization": "Bearer secret-token",
        },
    )
    assert str(envelope["metadata"]["campaignContent"]).endswith("…[truncated]")
    assert envelope["metadata"]["authorization"] == "[REDACTED]"


def test_truncate_for_log_helper() -> None:
    assert truncate_for_log("short") == "short"
    assert truncate_for_log("y" * 300, 50).endswith("…[truncated]")
