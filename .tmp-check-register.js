const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://demowebshop.tricentis.com/register');
  await page.locator('#LastName').fill('Test');
  await page.locator('#Email').fill('user' + Date.now() + '@example.com');
  await page.locator('#Password').fill('Password123!');
  await page.locator('#ConfirmPassword').fill('Password123!');
  await page.locator('#register-button').click();

  const errors = await page.locator('span.field-validation-error, .validation-summary-errors, [data-valmsg-for], .validation-summary-valid').evaluateAll((els) =>
    els.map((el) => ({
      tag: el.tagName,
      className: el.className,
      text: el.textContent.trim(),
      forAttr: el.getAttribute('for'),
      dataValMsgFor: el.getAttribute('data-valmsg-for'),
      outerHTML: el.outerHTML.slice(0, 250)
    }))
  );
  console.log(JSON.stringify(errors, null, 2));
  console.log('URL=', page.url());
  await browser.close();
})();
