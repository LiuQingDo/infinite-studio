# Architecture Foundation Implementation Plan

**Goal:** Create a runnable foundation for the approved image-first architecture without enabling unverified paid generation.

**Architecture:** A Vite/React app talks to a Cloudflare Worker using same-origin API routes; Supabase supplies authentication and RLS-protected task and asset records. Provider and queue integration remain gated until pricing, safe submission and recovery are implemented.

**Tech Stack:** pnpm workspace, TypeScript, React, Vite, React Flow, Cloudflare Workers, Supabase/PostgreSQL, Vitest.

1. Create workspace, shared contracts, Worker configuration, and provider interface; verify type checking and bundling.
2. Implement an authenticated read-only task API and an explicitly disabled generation endpoint; test missing configuration, authentication and owner scoping.
3. Add a private Storage bucket and RLS-protected task and asset schema; do not grant client writes before upload validation and budget controls exist.
4. Build a minimal English studio shell with session handling, a node canvas and truthful service status; verify local browser rendering.
5. Document setup, changed architecture status and remaining integration work; run available checks without deploying or creating external accounts.
