# Security and privacy boundary

Use anonymous synthetic adult labels only. Do not enter personal information, minors' data, medical/financial information, or sensitive relationships into this prototype.

The static UI has no runtime external dependencies, analytics, network fetches, accounts, persistent storage, or uploads. Input exists in page memory and worker memory until the page closes. Exports are local user downloads, which can contain every entered label and constraint; handle them accordingly.

- Strict bounded schema and 256 KiB JSON import cap
- No dynamic code execution; all user labels render via textContent
- Print HTML escapes label content; downloaded HTML contains no scripts
- CSV fields are quoted and formula-leading values (including leading whitespace) receive an apostrophe prefix
- CSP denies external resources, connections, objects, forms, and base changes
- Browser generation is cancellable by terminating the module worker
- Editing or failed import clears the exportable plan, preventing stale downloads
- CLI reads only regular files, with a 256 KiB + 1 bounded read and nonblocking open; it refuses existing output directories and uses exclusive file creation
- Local development server binds loopback only and is not a hardened public host

The independent validator is not a signature scheme. A JSON author can fabricate historical facts or search metadata while remaining structurally valid. Audit metrics are recomputed, but attendee identity and actual attendance cannot be attested. The app's “frozen” state protects its own replanning workflow, not adversarial editing outside it.

No license is granted by this document. Report issues privately through the project owner; no external reporting address is provisioned.
