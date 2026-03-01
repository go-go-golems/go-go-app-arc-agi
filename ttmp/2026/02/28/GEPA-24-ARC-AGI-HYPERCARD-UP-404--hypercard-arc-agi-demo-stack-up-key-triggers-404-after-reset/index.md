---
Title: HyperCard ARC-AGI demo stack Up key triggers 404 after reset
Ticket: GEPA-24-ARC-AGI-HYPERCARD-UP-404
Status: complete
Topics:
    - arc-agi
    - bug
    - frontend
    - backend
    - go-go-os
    - go-go-app-arc-agi-3
    - hypercard
    - vm
DocType: index
Intent: long-term
Owners: []
RelatedFiles:
    - Path: workspaces/2026-02-22/add-gepa-optimizer/go-go-gepa/ttmp/2026/02/28/GEPA-24-ARC-AGI-HYPERCARD-UP-404--hypercard-arc-agi-demo-stack-up-key-triggers-404-after-reset/design-doc/01-arc-agi-hypercard-vm-stack-architecture-and-up-key-404-investigation.md
      Note: Primary architecture and bug analysis document
    - Path: workspaces/2026-02-22/add-gepa-optimizer/go-go-gepa/ttmp/2026/02/28/GEPA-24-ARC-AGI-HYPERCARD-UP-404--hypercard-arc-agi-demo-stack-up-key-triggers-404-after-reset/reference/01-investigation-diary-hypercard-arc-agi-up-key-404.md
      Note: Chronological investigation diary with commands and findings
    - Path: workspaces/2026-02-22/add-gepa-optimizer/go-go-gepa/ttmp/2026/02/28/GEPA-24-ARC-AGI-HYPERCARD-UP-404--hypercard-arc-agi-demo-stack-up-key-triggers-404-after-reset/scripts/repro_arc_demo_up_404.sh
      Note: Programmatic repro script for lowercase up 404 vs ACTION1 200 control
ExternalSources: []
Summary: Reproduced and analyzed HyperCard demo action 404. Root cause is lowercase directional action tokens sent by demo card, which are forwarded upstream as unsupported /api/cmd/UP style commands.
LastUpdated: 2026-02-28T14:27:57.287708158-05:00
WhatFor: Entry point for architecture analysis, investigation diary, and reproducibility assets for the ARC HyperCard Up-key 404 bug.
WhenToUse: Use when onboarding to this bug, implementing the fix, or validating expected behavior in wesen-os launcher ARC demo stack.
---



# HyperCard ARC-AGI demo stack Up key triggers 404 after reset

## Overview

This ticket documents an evidence-backed investigation of a reproducible ARC HyperCard demo failure:

1. `Create Session` -> success
2. `Load Games` -> success
3. select game -> success
4. `Reset Game` -> success
5. `Up` -> `404`

The analysis maps how `go-go-os`, `go-go-app-arc-agi-3`, and `wesen-os` compose this flow, explains why the request fails, and provides a remediation plan.

## Key links

1. Design doc:
   - `design-doc/01-arc-agi-hypercard-vm-stack-architecture-and-up-key-404-investigation.md`
2. Investigation diary:
   - `reference/01-investigation-diary-hypercard-arc-agi-up-key-404.md`
3. Programmatic repro script:
   - `scripts/repro_arc_demo_up_404.sh`

## Status

Current status: **active**

## Tasks

See `tasks.md` for completion checklist and remaining actions.

## Changelog

See `changelog.md` for chronological updates.

## Structure

1. `design-doc/`: architecture and analysis
2. `reference/`: investigation chronology
3. `scripts/`: reproducibility tooling
