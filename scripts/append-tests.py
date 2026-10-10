"""Append regression tests for loadPackages / loadPackage."""
import re
from pathlib import Path

path = Path("src/tests/ai-hub.test.ts")
content = path.read_text()

pattern = re.compile(
    r'(  it\("returns empty for unknown package ID".*?expect\(hub\.getPackage\("nonexistent-id"\)\)\.toBeUndefined\(\);\s*\}\);\n)(}\);)',
    re.DOTALL,
)
m = pattern.search(content)
assert m, "last test pattern not found"

new_block = m.group(1) + (
    "\n"
    "  // Regression: loadPackages / loadPackage must import packages from\n"
    "  // localStorage into the shared hub so other components (CandyCollection)\n"
    "  // can see them. Previously AIHubPage created an isolated instance and\n"
    "  // the packages never reached the shared hub.\n"
    "  it('loadPackage registers a single package by id', () => {\n"
    "    const card = makeTestCard('LoadedAI');\n"
    "    const pkg = hub.createPackage({ card, creator: 'src' });\n"
    "    const fresh = new AIHub();\n"
    "    fresh.loadPackage(pkg);\n"
    "    expect(fresh.getPackage(pkg.id)).toEqual(pkg);\n"
    "  });\n"
    "\n"
    "  it('loadPackages imports an array into the shared hub', () => {\n"
    "    const cardA = makeTestCard('Alpha');\n"
    "    const cardB = makeTestCard('Beta');\n"
    "    const pkgA = hub.createPackage({ card: cardA, creator: 'a' });\n"
    "    const pkgB = hub.createPackage({ card: cardB, creator: 'b' });\n"
    "    const fresh = new AIHub();\n"
    "    expect(fresh.getAllPackages()).toEqual([]);\n"
    "    fresh.loadPackages([pkgA, pkgB]);\n"
    "    expect(fresh.getAllPackages()).toHaveLength(2);\n"
    "    expect(fresh.getPackage(pkgA.id)?.metadata.name).toBe('Alpha');\n"
    "    expect(fresh.getPackage(pkgB.id)?.metadata.name).toBe('Beta');\n"
    "  });\n"
    "\n"
    "  it('loadPackages ignores entries without an id', () => {\n"
    "    const card = makeTestCard('Valid');\n"
    "    const pkg = hub.createPackage({ card, creator: 'v' });\n"
    "    const fresh = new AIHub();\n"
    "    // biome-ignore lint/suspicious/noExplicitAny: intentional bad payload\n"
    "    fresh.loadPackages([pkg, { metadata: { name: 'broken' } } as any]);\n"
    "    expect(fresh.getAllPackages()).toHaveLength(1);\n"
    "  });\n"
) + m.group(2)

path.write_text(content[: m.start()] + new_block + content[m.end() :])
print("OK")
