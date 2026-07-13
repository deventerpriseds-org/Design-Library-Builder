import { test, expect } from '@playwright/test'

test.describe('Upload screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/upload')
  })

  test('renders heading and form sections', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'New Design Library' })).toBeVisible()
    await expect(page.getByText('Project Details')).toBeVisible()
    await expect(page.getByText('Screenshots & Images')).toBeVisible()
    await expect(page.getByText('Web Links')).toBeVisible()
    await expect(page.getByText('Description')).toBeVisible()
  })

  test('Continue button disabled until input provided', async ({ page }) => {
    const btn = page.getByRole('button', { name: /Extract Design System/ })
    await expect(btn).toBeDisabled()
  })

  test('Continue button enabled after typing description', async ({ page }) => {
    await page.getByPlaceholder(/Enterprise SaaS/).fill('A test design system')
    const btn = page.getByRole('button', { name: /Extract Design System/ })
    await expect(btn).toBeEnabled()
  })

  test('can add and remove a URL', async ({ page }) => {
    await page.locator('input[placeholder="https://…"]').fill('https://example.com')
    await page.getByRole('button', { name: 'Add' }).click()
    await expect(page.getByText('https://example.com')).toBeVisible()
    // Remove button uses × character — click by text content
    await page.locator('button', { hasText: '×' }).first().click()
    await expect(page.getByText('https://example.com')).not.toBeVisible()
  })

  test('project name field updates', async ({ page }) => {
    const input = page.getByPlaceholder(/Compass, Executive Engine/)
    await input.fill('My App')
    await expect(input).toHaveValue('My App')
  })
})

test.describe('Upload screen — mobile', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('renders correctly on mobile viewport', async ({ page }) => {
    await page.goto('/#/upload')
    await expect(page.getByRole('heading', { name: 'New Design Library' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Extract Design System/ })).toBeVisible()
  })
})
