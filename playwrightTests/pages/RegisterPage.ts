import { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class RegisterPage extends BasePage {
  readonly pageTitle: Locator;

  constructor(page: Page) {
    super(page);
    this.pageTitle = page.locator('h1');
  }

  async goto(): Promise<void> {
    await this.page.goto('/register');
    await this.page.waitForLoadState('domcontentloaded');
  }
}
