import io
from datetime import datetime, timezone
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    HRFlowable,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


def generate_audit_pdf(audit_data: dict[str, Any]) -> io.BytesIO:
    """Generates an audit report PDF containing:

    1. Cover page
    2. Executive summary
    3. Control-by-control review table
    4. Findings log
    5. Plain-text signature block

    Returns an in-memory BytesIO buffer.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40,
    )

    styles = getSampleStyleSheet()

    # Custom typography styles
    title_style = ParagraphStyle(
        "CoverTitle",
        parent=styles["Title"],
        fontSize=28,
        leading=34,
        textColor=colors.HexColor("#1e293b"),
        alignment=0,
    )
    subtitle_style = ParagraphStyle(
        "CoverSubtitle",
        parent=styles["Normal"],
        fontSize=14,
        leading=20,
        textColor=colors.HexColor("#64748b"),
    )
    h1_style = ParagraphStyle(
        "Heading1_Custom",
        parent=styles["Heading1"],
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#0f172a"),
        spaceAfter=10,
    )
    body_style = ParagraphStyle(
        "Body_Custom",
        parent=styles["Normal"],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#334155"),
    )
    table_header_style = ParagraphStyle(
        "TableHeader",
        parent=styles["Normal"],
        fontSize=9,
        leading=11,
        fontName="Helvetica-Bold",
        textColor=colors.white,
    )
    table_cell_style = ParagraphStyle(
        "TableCell",
        parent=styles["Normal"],
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#1e293b"),
    )

    story = []

    # ---------------------------------------------------------
    # 1. Cover Page
    # ---------------------------------------------------------
    story.append(Spacer(1, 1.5 * inch))
    story.append(Paragraph("CyGRC Audit Report", title_style))
    story.append(Spacer(1, 12))
    audit_title = audit_data.get("title", "Compliance & Controls Assessment")
    story.append(Paragraph(f"Cycle: {audit_title}", subtitle_style))
    story.append(Spacer(1, 24))
    story.append(
        HRFlowable(
            width="100%",
            thickness=2,
            color=colors.HexColor("#2563eb"),
            spaceBefore=0,
            spaceAfter=24,
        )
    )

    audit_id = str(audit_data.get("audit_id", "N/A"))
    framework = audit_data.get("framework_name", "N/A")
    period_start = audit_data.get("period_start", "N/A")
    period_end = audit_data.get("period_end", "N/A")

    metadata = [
        [
            Paragraph("<b>Audit ID:</b>", body_style),
            Paragraph(audit_id, body_style),
        ],
        [
            Paragraph("<b>Framework:</b>", body_style),
            Paragraph(framework, body_style),
        ],
        [
            Paragraph("<b>Period:</b>", body_style),
            Paragraph(f"{period_start} to {period_end}", body_style),
        ],
        [
            Paragraph("<b>Generated On:</b>", body_style),
            Paragraph(
                datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
                body_style,
            ),
        ],
    ]
    meta_table = Table(metadata, colWidths=[1.5 * inch, 4.5 * inch], hAlign="LEFT")
    meta_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(meta_table)
    story.append(PageBreak())

    # ---------------------------------------------------------
    # 2. Executive Summary
    # ---------------------------------------------------------
    story.append(Paragraph("1. Executive Summary", h1_style))
    summary_text = audit_data.get(
        "summary",
        "This document details the evaluation of scoped security controls and "
        "operational policies for the compliance period. Control verdicts, identified findings, "
        "and closing sign-offs are detailed in subsequent sections.",
    )
    story.append(Paragraph(summary_text, body_style))
    story.append(Spacer(1, 14))

    # Metric counts
    total_controls = len(audit_data.get("controls", []))
    total_findings = len(audit_data.get("findings", []))
    passed_controls = sum(
        1
        for c in audit_data.get("controls", [])
        if str(c.get("verdict", "")).lower() == "pass"
    )

    summary_metrics = [
        [
            Paragraph("<b>Total Scoped Controls</b>", body_style),
            Paragraph(str(total_controls), body_style),
            Paragraph("<b>Passed Controls</b>", body_style),
            Paragraph(str(passed_controls), body_style),
        ],
        [
            Paragraph("<b>Total Findings Raised</b>", body_style),
            Paragraph(str(total_findings), body_style),
            Paragraph("<b>Audit Status</b>", body_style),
            Paragraph(str(audit_data.get("status", "Closed")), body_style),
        ],
    ]
    metrics_table = Table(
        summary_metrics,
        colWidths=[1.8 * inch, 1.2 * inch, 1.8 * inch, 1.2 * inch],
        hAlign="LEFT",
    )
    metrics_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(metrics_table)
    story.append(Spacer(1, 20))

    # ---------------------------------------------------------
    # 3. Control-by-Control Table
    # ---------------------------------------------------------
    story.append(Paragraph("2. Control Reviews", h1_style))
    controls_data = [
        [
            Paragraph("Code", table_header_style),
            Paragraph("Title", table_header_style),
            Paragraph("Verdict", table_header_style),
            Paragraph("Evidence / Review Notes", table_header_style),
        ]
    ]

    for ctrl in audit_data.get("controls", []):
        verdict = ctrl.get("verdict", "Pending")
        controls_data.append(
            [
                Paragraph(ctrl.get("code", "N/A"), table_cell_style),
                Paragraph(ctrl.get("title", "N/A"), table_cell_style),
                Paragraph(verdict, table_cell_style),
                Paragraph(
                    ctrl.get("evidence_summary", ctrl.get("notes", "None")),
                    table_cell_style,
                ),
            ]
        )

    ctrl_table = Table(
        controls_data,
        colWidths=[1.1 * inch, 1.9 * inch, 1.0 * inch, 2.5 * inch],
        hAlign="LEFT",
        repeatRows=1,
    )
    ctrl_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(ctrl_table)
    story.append(Spacer(1, 20))

    # ---------------------------------------------------------
    # 4. Findings Log
    # ---------------------------------------------------------
    story.append(Paragraph("3. Findings Log", h1_style))
    findings_list = audit_data.get("findings", [])

    if findings_list:
        findings_data = [
            [
                Paragraph("Severity", table_header_style),
                Paragraph("Description", table_header_style),
                Paragraph("Recommendation", table_header_style),
                Paragraph("Status", table_header_style),
            ]
        ]
        for f in findings_list:
            findings_data.append(
                [
                    Paragraph(f.get("severity", "Info"), table_cell_style),
                    Paragraph(f.get("description", "N/A"), table_cell_style),
                    Paragraph(f.get("recommendation", "N/A"), table_cell_style),
                    Paragraph(f.get("status", "Open"), table_cell_style),
                ]
            )

        f_table = Table(
            findings_data,
            colWidths=[1.0 * inch, 2.4 * inch, 2.1 * inch, 1.0 * inch],
            hAlign="LEFT",
            repeatRows=1,
        )
        f_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#b91c1c")),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        story.append(f_table)
    else:
        story.append(
            Paragraph("No findings were recorded for this audit cycle.", body_style)
        )

    story.append(Spacer(1, 28))

    # ---------------------------------------------------------
    # 5. Plain-Text Signature Block
    # ---------------------------------------------------------
    story.append(Paragraph("4. Sign-Off & Attestation", h1_style))
    signed_off_by = audit_data.get("signed_off_by") or "Pending Sign-off"
    signed_off_at = audit_data.get("signed_off_at") or "Pending"

    sig_data = [
        [
            Paragraph("<b>Sign-off Status:</b>", body_style),
            Paragraph(
                "Closed & Verified" if audit_data.get("signed_off_by") else "Pending",
                body_style,
            ),
        ],
        [
            Paragraph("<b>Signed Off By (User ID):</b>", body_style),
            Paragraph(str(signed_off_by), body_style),
        ],
        [
            Paragraph("<b>Sign-off Timestamp (UTC):</b>", body_style),
            Paragraph(str(signed_off_at), body_style),
        ],
        [
            Paragraph("<b>Attestation Statement:</b>", body_style),
            Paragraph(
                "The undersigned CISO / Tenant Administrator confirms that all control verdicts "
                "and associated remediation findings have been reviewed and accepted per organizational policy.",
                body_style,
            ),
        ],
    ]

    sig_table = Table(sig_data, colWidths=[2.2 * inch, 4.3 * inch], hAlign="LEFT")
    sig_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f1f5f9")),
                ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#94a3b8")),
                ("LINEBELOW", (0, 0), (-1, -2), 0.5, colors.HexColor("#e2e8f0")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(sig_table)

    doc.build(story)
    buffer.seek(0)
    return buffer
