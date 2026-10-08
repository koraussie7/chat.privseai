export default async function run(page, ui) {
  const field = page.getByPlaceholder("Message Luna... (Enter to send)");
  await field.fill("이거 베트남어로 번역해줘: 안녕하세요");
  await field.press("Enter");
  await page.waitForTimeout(8000);
  return {
    text: (await page.locator("body").innerText()).slice(-1600),
    chatRequests: await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .map((x) => x.name)
        .filter((x) => /\/chat|v1\/chat|completions/.test(x))
        .slice(-8),
    ),
  };
}
