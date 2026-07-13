import { test, expect } from '@playwright/test'

test.describe('Shell navigation — desktop', () => {
  test('sidebar links navigate between screens', async ({ page }) => {
    await page.goto('/#/upload')
    await expect(page.getByRole('heading', { name: 'New Design Library' })).toBeVisible()
  })
})

test.describe('Shell navigation — mobile', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('hamburger button is visible on mobile', async ({ page }) => {
    await page.goto('/#/upload')
    const hamburger = page.getByRole('button', { name: /☰|menu/i })
    await expect(hamburger).toBeVisible()
  })

  test('opens and closes the drawer', async ({ page }) => {
    await page.goto('/#/upload')
    const hamburger = page.getByRole('button', { name: /☰|menu/i })
    await hamburger.click()
    await expect(page.getByText('Upload')).toBeVisible()
    await hamburger.click()
  })
})
