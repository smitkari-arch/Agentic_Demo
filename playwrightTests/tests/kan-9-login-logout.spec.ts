import { Page } from '@playwright/test';
import { test, expect } from '../fixtures/base';
import { HomePage } from '../pages/HomePage';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';

const uniqueEmail = (prefix: string): string => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
const validPassword = 'Password123!';

const registerAndReturnCredentials = async (page: Page): Promise<{ email: string; password: string }> => {
  const registerPage = new RegisterPage(page);
  const email = uniqueEmail('kan9-user');
  await registerPage.goto();
  await registerPage.registerUser({
    firstName: 'Jane',
    lastName: 'Tester',
    email,
    password: validPassword,
    confirmPassword: validPassword,
  });

  await expect(page.getByText('Your registration completed')).toBeVisible();
  return { email, password: validPassword };
};

test.describe('KAN-9: Log in and log out @kan-9', () => {
  test('TC-01: registered customer can sign in with valid credentials', async ({ page }) => {
    const { email } = await registerAndReturnCredentials(page);
    const homePage = new HomePage(page);
    await homePage.logout();

    const loginPage = await homePage.openLogin();
    await loginPage.login(email, validPassword);

    await expect(page.getByText(email)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Log out' })).toBeVisible();
  });

  test('TC-02: invalid password denies access and shows an error message', async ({ page }) => {
    const { email } = await registerAndReturnCredentials(page);
    const homePage = new HomePage(page);
    await homePage.logout();

    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(email, 'WrongPassword!');

    await expect(loginPage.errorMessage).toBeVisible();
    await expect(page).toHaveURL(/\/login/i);
    await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();
  });

  test('TC-03: signed-in user can log out and return to the login state', async ({ page }) => {
    const { email } = await registerAndReturnCredentials(page);
    const homePage = new HomePage(page);
    await homePage.logout();

    const loginPage = await homePage.openLogin();
    await loginPage.login(email, validPassword);
    await homePage.logout();

    await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Register' })).toBeVisible();
  });
});
