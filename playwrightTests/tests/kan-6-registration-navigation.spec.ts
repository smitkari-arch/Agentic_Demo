import { test, expect } from '../fixtures/base';
import { HomePage } from '../pages/HomePage';
import { RegisterPage } from '../pages/RegisterPage';

test.describe('KAN-6 registration navigation @kan-6', () => {
  test('navigates from the home page to the registration page', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.goto();

    await expect(homePage.registerLink).toBeVisible();
    await expect(homePage.registerLink).toBeEnabled();

    const registerPage = await homePage.openRegisterPage();
    await expect(page).toHaveURL(/\/register$/);
    await expect(page).toHaveTitle('Demo Web Shop. Register');
    await expect(registerPage.pageTitle).toContainText('Register');
  });
});
