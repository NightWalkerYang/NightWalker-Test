---
name: tenant-member-bootstrap-filter
description: "Filter BOOTSTRAP.md only for tenant member chat bootstrap injection."
metadata:
  openclaw:
    emoji: "🧭"
    events: ["agent:bootstrap"]
---

# Tenant Member Bootstrap Filter

This workspace hook keeps parent and child Agent files aligned on disk, but
filters `BOOTSTRAP.md` out of normal tenant-member chat bootstrap injection at
runtime so new member sessions do not fall into the generic first-boot script.
