import { test, expect } from '@playwright/test';

test('Forge Dashboard loads before project creation', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Forge Engine')).toBeVisible();
  await expect(page.getByText('Build worlds.')).toBeVisible();
  await expect(page.getByText('Quick Start')).toBeVisible();
  await expect(page.getByRole('button', { name: /2D Game/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /3D Game/i })).toBeVisible();
});
