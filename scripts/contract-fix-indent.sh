#!/bin/sh
# 1. Escape indented "N. " -> "N\. " (for MDX)
# 2. Normalize over-indented section numbers (8+ spaces -> 4 spaces)
# 3. Collapse crazy indents: 12+ spaces -> 8, keep (i)(ii) at 12
FILE="${1:-src/content/sitePages/2021-2026-contract.mdx}"
perl -i -pe '
  s/^(\s*)(\d+)\.(\s)/$1$2\\.$3/g;       # escape N. -> N\.
  s/^(\s{8,})(\d+)(\\.)(\s)/    $2$3$4/g;  # section numbers: 8+ spaces -> 4
  s/^(\s{9,})/        /;                   # 9+ spaces -> 8
' "$FILE"
