# Butterfly Pilot Testing Guide

## Purpose

Butterfly is a protein-led Western blot planning and troubleshooting tool. This pilot is designed to test whether Butterfly helps scientists:

- understand a good first-pass Western blot strategy
- reduce unnecessary optimisation
- log repeat runs in a useful way
- review final blot images for publication-readiness concerns

This is a pilot decision-support tool. It does not replace scientific judgement or validated lab protocols.

## What Butterfly Currently Does

- uses protein evidence from UniProt, AlphaFold, EMBL-EBI, and FASTA-derived chemistry
- proposes a first-pass Western blot strategy
- checks primary and secondary antibody compatibility from URL-derived product-page evidence and manual fields
- logs repeat experiments so past runs can be compared
- supports troubleshooting from method details, uploaded images, saved runs, and uploaded supporting documents
- screens final blot images for integrity risks such as saturation, splice-like discontinuities, and manipulation warnings

## What Butterfly Does Not Yet Do

- it does not autonomously learn like a trained machine-learning model
- it does not guarantee the correct Western blot method
- it does not replace positive controls, technical controls, or scientific review
- it does not yet perform full PubMed-backed protocol extraction

## Before You Start

Please have ready, if possible:

- a protein name, UniProt ID, or FASTA sequence
- a target type if known, such as total protein or phospho target
- primary and secondary antibody product URLs if available
- one previous or current Western blot setup if you want to test the Experiment Log
- an optional final blot image if you want to test the integrity screen

## Pilot Tasks

### Task 1: Protein-first planning

1. Go to `01 Protein Intelligence`
2. Enter a UniProt ID and/or FASTA sequence
3. Fetch the protein evidence
4. Review the evidence cards
5. Go to `02 Predictive Strategy`
6. Click `Generate strategy`

Please note:

- Was the strategy understandable?
- Did the gel, transfer, and blocking guidance seem scientifically sensible?
- Did Butterfly explain the reasoning clearly enough?

### Task 2: Antibody compatibility

1. Go to `03 Antibody Compatibility`
2. Paste primary and secondary antibody product URLs if available
3. Fill in manual host/isotype/conjugate fields if needed
4. Run the compatibility check

Please note:

- Did the compatibility result feel believable?
- Was the explanation useful?
- Did you trust the URL-derived evidence summary?

### Task 3: Experiment logging

1. Go to `04 Experiment Log`
2. Record a real or recent run
3. Add notes about what actually happened
4. Optionally upload gel and transfer images

Please note:

- Was this section easy to complete?
- Did the fields match how you think about a Western blot run?
- Was anything missing or repetitive?

### Task 4: Final image integrity review

1. Go to `05 Final Image Integrity Review`
2. Upload a final blot image
3. Run the integrity screen

Please note:

- Did the integrity output make sense?
- Did it help you think about publication-readiness?
- Was the terminology clear?

### Task 5: Virtual Assistant

1. Go to `06 Virtual Assistant`
2. Select a troubleshooting symptom
3. Optionally upload supporting PDFs, TXT, or Markdown files
4. Generate assistant support

Please note:

- Did the suggested causes and fixes make sense?
- Did the saved-run comparison help?
- Did the supporting material section feel useful?

## What To Focus On During Testing

Please focus on:

- scientific trust
- clarity of the workflow
- usefulness of the predictive strategy
- usefulness of the troubleshooting support
- whether Butterfly reduces uncertainty before the first blot

## What To Ignore For This Pilot

Please do not judge Butterfly mainly on:

- visual polish alone
- whether every edge case is already covered
- whether it replaces a full senior scientist review

The goal is to evaluate whether the core scientific workflow is useful.

## Key Questions For Testers

After using Butterfly, please be ready to answer:

1. What was the most useful part of Butterfly?
2. What was confusing?
3. Which recommendation did you trust least?
4. What scientific information was missing?
5. Would you use Butterfly before running a first Western blot?
6. Would you use Butterfly to review a failed blot?

## Pilot Version

- Repository: `Butterfly_V2`
- Frozen pilot tag: `butterfly-pilot-v1`

