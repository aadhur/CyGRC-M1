# CyGRC Platform Documentation

This directory contains the engineering specifications, technical implementation report, initial planning documents, and sprint issue tickets for the CyGRC (Governance, Risk, and Compliance) Platform.

## Directory Index

* **`report/`**: The complete **Engineering Implementation Report (v1.0)**. Contains detailed subsystem mechanics, database ERD, architecture topologies, and local SLM deployment specifications.
* **`planning/`**: Founding product planning artifacts, including **PRD v3.0** and the **Project Proposal**.
* **`issues/`**: The sprint tickets and issue specifications spanning backend and frontend sprints.

---

## Technical Lead Note on Implementation Scope & Evolution

> **Important Note for Reviewers & Evaluators:**
> 
> The issue specifications archived in the `issues/` folder represent the **initial milestone targets** assigned at the start of each sprint.
> 
> During platform development and integration, several mission-critical architectural patterns, security controls, and subsystems were designed and implemented directly into the codebase that extend beyond the original ticket descriptions. Few include:
> 
> 1. **PostgreSQL Row-Level Security (RLS) Hardening**: Beyond basic table creation and forcing RLS, isolation was hardened using non-superuser connecting roles (`NOSUPERUSER NOBYPASSRLS`), guaranteeing that application-tier flaws cannot bypass database tenant boundaries.
> 2. **Dual-Control Break-Glass JIT Access**: Implemented a complete two-person authorization lifecycle requiring peer sign-off, dynamic `X-Break-Glass-Session` request context swapping, and automated permission downgrades to read-only customer scopes.
> 3. **Local 4-Bit Quantized SLM Integration**: Deployed an on-premise Qwen2.5-7B assistant on a Tesla T4 GPU (BitsAndBytes NF4 4-bit quantization) featuring a single-use token human-in-the-loop review workflow preventing unverified database writes.
> 4. **OIDC Session Synchronization &  Middleware Pipeline**: Engineered backchannel refresh token rotation in Next.js and architected auth middleware execution.


For the comprehensive, source-grounded documentation of the platform as currently deployed, please refer to the **[Engineering Implementation Report](report/CyGRC_Engineering_Report_v1.0.pdf)**.