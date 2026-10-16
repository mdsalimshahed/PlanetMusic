Crawler policy templates

These files are kept outside public/ and are not copied into the production site.

Two matching sets are available:
- allow-ai/: allows the listed AI crawlers to access public pages.
- disallow-ai/: preserves the current restrictive robots.txt and llms.txt.

To switch policies, copy both files from the chosen folder into public/ as
robots.txt and llms.txt, replacing the live versions, then build and deploy.

robots.txt controls which crawlers are asked to access pages. llms.txt provides
additional guidance. Neither file can technically enforce how a crawler uses
content after accessing it.
