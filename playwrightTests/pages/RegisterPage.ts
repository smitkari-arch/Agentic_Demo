import { Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class RegisterPage extends BasePage {
  readonly firstNameInput: import('@playwright/test').Locator;
  readonly lastNameInput: import('@playwright/test').Locator;
  readonly emailInput: import('@playwright/test').Locator;
  readonly passwordInput: import('@playwright/test').Locator;
  readonly confirmPasswordInput: import('@playwright/test').Locator;
  readonly registerButton: import('@playwright/test').Locator;
  readonly successMessage: import('@playwright/test').Locator;
  readonly requiredFieldMessage: import('@playwright/test').Locator;
  readonly mismatchMessage: import('@playwright/test').Locator;
  readonly duplicateEmailMessage: import('@playwright/test').Locator;

  constructor(page: Page) {
    super(page);
    this.firstNameInput = this.page.locator('#FirstName');
    this.lastNameInput = this.page.locator('#LastName');
    this.emailInput = this.page.locator('#Email');
    this.passwordInput = this.page.locator('#Password');
    this.confirmPasswordInput = this.page.locator('#ConfirmPassword');
    this.registerButton = this.page.locator('#register-button');
    this.successMessage = this.page.getByText('Your registration completed');
    this.requiredFieldMessage = this.page.getByText('First name is required.');
    this.mismatchMessage = this.page.getByText('The password and confirmation password do not match.');
    this.duplicateEmailMessage = this.page.getByText('The specified email already exists');
  }

  async goto(): Promise<void> {
    await this.page.goto('/register');
    await this.waitForReady();
  }

  async registerUser({
    firstName,
    lastName,
    email,
    password,
    confirmPassword,
  }: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    confirmPassword: string;
  }): Promise<void> {
    await this.firstNameInput.fill(firstName);
    await this.lastNameInput.fill(lastName);
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.confirmPasswordInput.fill(confirmPassword);
    await this.registerButton.click();
  }
}
