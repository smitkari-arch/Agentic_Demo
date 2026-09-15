import { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { RegisterPage } from './RegisterPage';

export class HomePage extends BasePage {
  readonly registerLink: Locator;

  constructor(page: Page) {
    super(page);
    this.registerLink = page.getByRole('link', { name: 'Register' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async openRegisterPage(): Promise<RegisterPage> {
    await this.registerLink.waitFor({ state: 'visible' });
    await this.registerLink.click();
    return new RegisterPage(this.page);
  }
}
