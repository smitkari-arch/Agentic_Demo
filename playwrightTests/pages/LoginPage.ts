import { Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class LoginPage extends BasePage {
  readonly emailInput: import('@playwright/test').Locator;
  readonly passwordInput: import('@playwright/test').Locator;
  readonly rememberMeCheckbox: import('@playwright/test').Locator;
  readonly loginButton: import('@playwright/test').Locator;
  readonly errorMessage: import('@playwright/test').Locator;
  readonly logoutLink: import('@playwright/test').Locator;

  constructor(page: Page) {
    super(page);
    this.emailInput = this.page.locator('#Email');
    this.passwordInput = this.page.locator('#Password');
    this.rememberMeCheckbox = this.page.locator('#RememberMe');
    this.loginButton = this.page.locator('input[value="Log in"]');
    this.errorMessage = this.page.getByText('Login was unsuccessful. Please correct the errors and try again.');
    this.logoutLink = this.page.getByRole('link', { name: 'Log out' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/login');
    await this.waitForReady();
  }

  async login(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }
}
