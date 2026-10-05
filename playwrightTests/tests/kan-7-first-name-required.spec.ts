import { test, expect } from '../fixtures/base';
import { RegisterPage } from '../pages/RegisterPage';

const uniqueEmail = (prefix: string): string => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

test.describe('KAN-7: Verify inline error message for blank first name during registration @kan-7', () => {
  test('TC-01: blank first name prevents registration and shows inline validation message', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    await registerPage.goto();

    await registerPage.registerUser({
      firstName: '',
      lastName: 'Test',
      email: uniqueEmail('kan7-first-name-blank'),
      password: 'Password123!',
      confirmPassword: 'Password123!',
    });

    await expect(registerPage.requiredFieldMessage).toBeVisible();
    await expect(registerPage.firstNameInput).toHaveValue('');
    await expect(registerPage.lastNameInput).toHaveValue('Test');
  });

  test('TC-02: blank first name keeps valid data in the other fields', async ({ page }) => {
    const registerPage = new RegisterPage(page);
    const email = uniqueEmail('kan7-keep-values');
    await registerPage.goto();

    await registerPage.firstNameInput.fill('');
    await registerPage.lastNameInput.fill('Test');
    await registerPage.emailInput.fill(email);
    await registerPage.passwordInput.fill('Password123!');
    await registerPage.confirmPasswordInput.fill('Password123!');
    await registerPage.registerButton.click();

    await expect(registerPage.requiredFieldMessage).toBeVisible();
    await expect(registerPage.lastNameInput).toHaveValue('Test');
    await expect(registerPage.emailInput).toHaveValue(email);
    await expect(registerPage.passwordInput).toHaveValue('Password123!');
    await expect(registerPage.confirmPasswordInput).toHaveValue('Password123!');
    await expect(page).toHaveURL(/\/register/i);
  });
});
