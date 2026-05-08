# Architecture Layers Specification Delta

## Purpose

Updates architecture-layers spec to use dynamic threshold selection instead of hardcoded value.

## MODIFIED Requirements

### Requirement: Layer threshold calculation
The system SHALL calculate layer threshold dynamically based on project scale.

#### Scenario: Threshold from project scale
- **WHEN** getArchitectureLayers analyzes a project
- **THEN** threshold is determined by `getThresholdForScale(detectProjectScale(projectRoot))`

#### Scenario: No hardcoded threshold
- **WHEN** system initializes layer inference
- **THEN** no hardcoded LAYER_THRESHOLD constant exists in core.ts

#### Scenario: Threshold adapts to project size
- **WHEN** small project (<50 files) is analyzed
- **THEN** layer inference uses threshold: 5
- **AND** when large project (>500 files) is analyzed
- **THEN** layer inference uses threshold: 1