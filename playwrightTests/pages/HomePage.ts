import { Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { RegisterPage } from './RegisterPage';

export class HomePage extends BasePage {
  readonly registerLink: import('@playwright/test').Locator;

  constructor(page: Page) {
    super(page);
    this.registerLink = this.page.getByRole('link', { name: 'Register' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/');
    await this.waitForReady();
  }

  async openRegistration(): Promise<RegisterPage> {
    await this.registerLink.click();
    return new RegisterPage(this.page);
  }
}
