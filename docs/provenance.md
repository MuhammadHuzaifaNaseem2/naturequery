# Authorship and provenance

NatureQuery should be developed from product requirements, original interaction decisions, and reviewed implementation work. Repository structure alone cannot prove that every line is unique, so the project uses traceable practices instead of making an unverifiable "plagiarism-free" claim.

## Project policy

1. Write product code specifically for NatureQuery and review generated code before it is committed.
2. Do not copy source, layouts, illustrations, or written copy from another product without permission and attribution.
3. Use third-party packages through their documented public APIs and retain required license notices.
4. Record the origin and license of externally sourced assets in this document or beside the asset.
5. Keep experiments and generated drafts out of production paths until they have been reviewed and adapted.
6. Never remove copyright or attribution notices from third-party material.

## Current third-party categories

- npm dependencies are declared in the root and desktop `package.json` files and resolved in their lockfiles.
- Product icons are provided through `lucide-react` unless an asset states otherwise.
- Hosted services and SDKs remain governed by their providers' terms.
- Files in `docs/archive` and `docs/audits` are internal project records, not product source templates.

Before publishing or open-sourcing the repository, run a dependency license inventory and add a repository license chosen by the owner. The current repository is private and unlicensed for redistribution.
