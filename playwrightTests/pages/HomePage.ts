import { Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { LoginPage } from './LoginPage';
import { RegisterPage } from './RegisterPage';

export class HomePage extends BasePage {
  readonly registerLink: import('@playwright/test').Locator;
  readonly loginLink: import('@playwright/test').Locator;
  readonly logoutLink: import('@playwright/test').Locator;

  constructor(page: Page) {
    super(page);
    this.registerLink = this.page.getByRole('link', { name: 'Register' });
    this.loginLink = this.page.getByRole('link', { name: 'Log in' });
    this.logoutLink = this.page.getByRole('link', { name: 'Log out' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/');
    await this.waitForReady();
  }

  async openRegistration(): Promise<RegisterPage> {
    await this.registerLink.click();
    return new RegisterPage(this.page);
  }

  async openLogin(): Promise<LoginPage> {
    await this.loginLink.click();
    return new LoginPage(this.page);
  }

  async logout(): Promise<void> {
    const logoutLink = this.logoutLink;
    if (await logoutLink.isVisible().catch(() => false)) {
      await logoutLink.click();
    }
  }
}
