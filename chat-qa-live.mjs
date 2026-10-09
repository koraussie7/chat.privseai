export default async function run(page, ui) {
  // Simulate a BYOK user so the request includes the Bearer header.
  await page.evaluate(() =>
    localStorage.setItem(
      "byok_key",
      JSON.stringify({ openai: { apiKey: "sk-qa-test-invalid" } }),
    ),
  );
  await page.reload();
  await page.waitForTimeout(1500);
  const field = page.getByPlaceholder("Message Luna... (Enter to send)");
  await field.fill("이거 베트남어로 번역해줘: 안녕하세요");
  await field.press("Enter");
  await page.waitForTimeout(14000);
  const txt = await page.locator("body").innerText();
  return {
    userVisible: txt.includes("이거 베트남어로 번역해줘"),
    tail: txt.slice(-320),
  };
}
