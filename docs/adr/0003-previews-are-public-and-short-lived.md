# 0003 · Previews are public and short-lived

- Status: accepted · 2026-10-21
- Updated: 2026-10-29 · operator routine and approval boundaries

## Context

Reviewers don't have lane access, so a page is reviewed from a copy. The status board's
preview went to a public link on 19 October and was still up on 21 October, lane data and
all. Nobody had cleaned it up, because that was nobody's issue.

## Decision

- A preview is a static copy of the page (one HTML file) on a human-approved public host behind a public HTTPS link.
  The human approves the host; the harness selects an existing upload CLI. The link must be a real host
  (not an IP, not localhost) we can overwrite.
- Every preview loses its lane marker once its review is in: the same page, saved with `LANE_MARKER`
  unset, uploaded over the same link. The plan has an issue for that.
- No HTML copies in the repo, in issues, or in chat attachments: there the marker can't be taken off again.
  Send the reviewer only the public URL, never the page contents.

## Consequences

- Each plan that ends in a review carries a clean-up step.
- A link that still shows a lane marker after the plan is done is a bug.

## Upload routine used for morning-digest

1. Obtain approval before first publication and separately before the unmarked overwrite,
   unless that exact approval already exists for this plan, URL and contents.
   State the exact URL, file contents, public audience and how to stop the hosting process.
2. Run rig on localhost and save the digest response with `curl`, outside the repo.
   Serve only that single HTML file on the public host, never the rig app, repo or env.
3. Use authenticated `scp` to stage the file and `ssh` to rename it atomically to `index.html`.
   The existing host runs Python's static HTTP server in tmux, bound to IPv6 behind its HTTPS proxy.
   Keep host aliases, directories and process names in private operator configuration.
4. Fetch the public HTTPS URL without account cookies using `curl`; require HTTP 200
   and byte equality with the saved HTML before submitting the link.
5. Leave the preview issue open while waiting. Work on tests and documentation without
   changing the published page. Wait for explicit confirmation that the reviewer has seen it.
6. After separate approval, save a fresh response from rig with `LANE_MARKER` unset.
   Verify the actual marker is absent and the banner reads `no marker set`, stage and rename
   over the same public URL, then fetch it again and compare bytes. Only then finish cleanup.

Use the existing SSH account and installed tools; this routine does not authorize new
accounts, installations, privilege changes or a different hosting target.
Approvals cover the named plan, URL and contents. Reuse an existing approval only within
that explicit scope; this routine does not grant permission for another plan or publication.
