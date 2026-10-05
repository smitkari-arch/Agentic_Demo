import { test, expect } from '../fixtures/base';
import { HomePage } from '../pages/HomePage';
import { RegisterPage } from '../pages/RegisterPage';

const uniqueEmail = (prefix: string): string => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

test.describe('KAN-8: Register a new customer @kan-8', () => {
  test('TC-01: registration form is displayed from the home page', async ({ page }) => {
    const homePage = new HomePage(page);
    await homePage.goto();
    const registerPage = await homePage.openRegistration();

    await expect(registerPage.firstNameInput).toBeVisible();
    await expect(registerPage.lastNameInput).toBeVisible();
    await expect(registerPage.emailInput).toBeVisible();
    await expect(registerPage.passwordInput).toBeVisible();
    await expect(registerPage.confirmPasswordInput).toBeVisible();
  });

  test('TC-02: successful registration creates a new customer account', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.goto();

    const email = uniqueEmail('kan8-success');
    await registerPage.registerUser({
      firstName: 'Jane',
      lastName: 'Tester',
      email,
      password: 'Password123!',
      confirmPassword: 'Password123!',
    });

    await expect(registerPage.successMessage).toBeVisible();
  });

  test('TC-03: blank required field blocks registration', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.goto();

    await registerPage.registerUser({
      firstName: '',
      lastName: 'Tester',
      email: uniqueEmail('kan8-empty-required'),
      password: 'Password123!',
      confirmPassword: 'Password123!',
    });

    await expect(registerPage.requiredFieldMessage).toBeVisible();
  });

  test('TC-04: mismatched passwords block registration', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.goto();

    await registerPage.registerUser({
      firstName: 'Jane',
      lastName: 'Tester',
      email: uniqueEmail('kan8-mismatch'),
      password: 'Password123!',
      confirmPassword: 'Password321!',
    });

    await expect(registerPage.mismatchMessage).toBeVisible();
  });

  test('TC-05: duplicate email address prevents registration', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    const email = uniqueEmail('kan8-duplicate');

    await registerPage.goto();
    await registerPage.registerUser({
      firstName: 'Jane',
      lastName: 'Tester',
      email,
      password: 'Password123!',
      confirmPassword: 'Password123!',
    });
    await expect(registerPage.successMessage).toBeVisible();

    await registerPage.goto();
    await registerPage.registerUser({
      firstName: 'Jane',
      lastName: 'Tester',
      email,
      password: 'Password123!',
      confirmPassword: 'Password123!',
    });

    await expect(registerPage.duplicateEmailMessage).toBeVisible();
  });
});
