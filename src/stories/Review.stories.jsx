import React from 'react'
import Review from '../screens/Review.jsx'
import { AppProvider } from '../state.jsx'
import { WithState } from './storyHelpers.jsx'

const MOCK_RESULT = {
  meta: { name: 'Compass Design System', primaryColor: '#1B4F5C', bgColor: '#F8F9FA' },
  variables: {
    collections: {
      Primitives: [
        { name: 'blue/500', resolvedType: 'COLOR', value: '#1B4F5C', scopes: ['FRAME_FILL', 'SHAPE_FILL'] },
        { name: 'blue/300', resolvedType: 'COLOR', value: '#4A8FA0', scopes: ['FRAME_FILL', 'SHAPE_FILL'] },
        { name: 'neutral/900', resolvedType: 'COLOR', value: '#111827', scopes: ['TEXT_FILL'] },
        { name: 'neutral/100', resolvedType: 'COLOR', value: '#F3F4F6', scopes: ['FRAME_FILL'] },
      ],
      Color: [
        { name: 'color/bg/default', resolvedType: 'COLOR', lightValue: '#FFFFFF', darkValue: '#0F172A', scopes: ['FRAME_FILL'] },
        { name: 'color/text/primary', resolvedType: 'COLOR', lightValue: '#111827', darkValue: '#F9FAFB', scopes: ['TEXT_FILL'] },
        { name: 'color/brand/primary', resolvedType: 'COLOR', lightValue: '#1B4F5C', darkValue: '#4A8FA0', scopes: ['FRAME_FILL', 'SHAPE_FILL'] },
      ],
      Spacing: [
        { name: 'spacing/xs', resolvedType: 'FLOAT', value: 4, scopes: ['GAP'] },
        { name: 'spacing/sm', resolvedType: 'FLOAT', value: 8, scopes: ['GAP'] },
        { name: 'spacing/md', resolvedType: 'FLOAT', value: 16, scopes: ['GAP'] },
        { name: 'spacing/lg', resolvedType: 'FLOAT', value: 24, scopes: ['GAP'] },
        { name: 'radius/sm', resolvedType: 'FLOAT', value: 4, scopes: ['CORNER_RADIUS'] },
        { name: 'radius/md', resolvedType: 'FLOAT', value: 8, scopes: ['CORNER_RADIUS'] },
        { name: 'radius/lg', resolvedType: 'FLOAT', value: 12, scopes: ['CORNER_RADIUS'] },
      ],
      Motion: [
        { name: 'motion/duration/fast', resolvedType: 'FLOAT', value: 100, cssVar: '--motion-duration-fast' },
        { name: 'motion/duration/normal', resolvedType: 'FLOAT', value: 200, cssVar: '--motion-duration-normal' },
        { name: 'motion/easing/ease-out', resolvedType: 'STRING', value: 'cubic-bezier(0, 0, 0.2, 1)', cssVar: '--motion-easing-ease-out' },
      ],
    },
  },
  styles: {
    text: [
      { name: 'Display/Hero', fontFamily: 'Inter', fontStyle: 'Bold', fontSize: 56, fontWeight: 700, lineHeight: { value: 64, unit: 'PIXELS' }, letterSpacing: { value: -1, unit: 'PIXELS' } },
      { name: 'H1', fontFamily: 'Inter', fontStyle: 'Bold', fontSize: 36, fontWeight: 700, lineHeight: { value: 44, unit: 'PIXELS' }, letterSpacing: { value: -0.5, unit: 'PIXELS' } },
      { name: 'Body/Medium', fontFamily: 'Inter', fontStyle: 'Regular', fontSize: 16, fontWeight: 400, lineHeight: { value: 24, unit: 'PIXELS' }, letterSpacing: { value: 0, unit: 'PIXELS' } },
      { name: 'Label/Small', fontFamily: 'Inter', fontStyle: 'Medium', fontSize: 12, fontWeight: 500, lineHeight: { value: 16, unit: 'PIXELS' }, letterSpacing: { value: 0.4, unit: 'PIXELS' } },
      { name: 'Code/Base', fontFamily: 'SF Mono', fontStyle: 'Regular', fontSize: 13, fontWeight: 400, lineHeight: { value: 20, unit: 'PIXELS' }, letterSpacing: { value: 0, unit: 'PIXELS' } },
    ],
    effects: [
      { name: 'Shadow/Subtle', effectType: 'DROP_SHADOW', effects: [{ type: 'DROP_SHADOW', radius: 4, spread: 0, color: 'rgba(0,0,0,0.08)' }] },
      { name: 'Shadow/Medium', effectType: 'DROP_SHADOW', effects: [{ type: 'DROP_SHADOW', radius: 12, spread: -2, color: 'rgba(0,0,0,0.12)' }] },
      { name: 'Blur/Background', effectType: 'BACKGROUND_BLUR', effects: [{ type: 'BACKGROUND_BLUR', radius: 20 }] },
    ],
    grids: [
      { name: 'Desktop 12-col', pattern: 'COLUMNS', columns: 12, gutterSize: 24, offset: 80, breakpoint: '1440px' },
      { name: 'Tablet 8-col', pattern: 'COLUMNS', columns: 8, gutterSize: 16, offset: 32, breakpoint: '768px' },
      { name: 'Mobile 4-col', pattern: 'COLUMNS', columns: 4, gutterSize: 16, offset: 16, breakpoint: '375px' },
      { name: 'Baseline 8px', pattern: 'ROWS', sectionSize: 8, breakpoint: 'all' },
    ],
  },
  components: [
    { tier: 'atom', category: 'Feedback', name: 'Badge', variants: ['Default', 'Success', 'Warning', 'Error'], states: ['Default', 'Dismissible'], variableBindings: ['color/brand/primary'] },
    { tier: 'atom', category: 'Display', name: 'Avatar', variants: ['XS', 'SM', 'MD', 'LG', 'XL'], states: ['Image', 'Initials', 'Icon'], variableBindings: [] },
    { tier: 'molecule', category: 'Actions', name: 'Button', variants: ['Primary', 'Secondary', 'Ghost', 'Danger'], states: ['Default', 'Hover', 'Focused', 'Pressed', 'Disabled', 'Loading'], variableBindings: ['color/brand/primary', 'spacing/md', 'radius/md'] },
    { tier: 'molecule', category: 'Inputs', name: 'Text Input', variants: ['Default', 'With prefix', 'With suffix'], states: ['Default', 'Focused', 'Error', 'Disabled'], variableBindings: ['color/bg/default', 'radius/sm'] },
    { tier: 'organism', category: 'Navigation', name: 'Side Navigation', variants: ['Expanded', 'Collapsed', 'Rail'], states: ['Default'], variableBindings: ['color/bg/default', 'color/brand/primary'] },
    { tier: 'organism', category: 'Feedback', name: 'Modal / Dialog', variants: ['SM', 'MD', 'LG', 'XL'], states: ['Default', 'With footer'], variableBindings: ['color/bg/default'] },
    { tier: 'pattern', category: 'Patterns', name: 'Login Screen', variants: ['Email+Password', 'SSO'], states: [], variableBindings: [] },
    { tier: 'pattern', category: 'Patterns', name: 'Data Table with Filters', variants: ['With search'], states: [], variableBindings: [] },
  ],
  patterns: [
    { name: 'Login / Auth', description: 'Full login screen with email, password, SSO, and magic link variants.', components: ['Text Input', 'Button', 'Modal / Dialog'] },
    { name: 'Data Table with Filters', description: 'Table with search, column picker, pagination, and row actions.', components: ['Table', 'Text Input', 'Button', 'Badge'] },
    { name: 'Empty State', description: 'Reusable empty + error state pattern with illustration slot and CTA.', components: ['Button', 'Avatar'] },
  ],
}

const withMockResult = (Story) => (
  <WithState initialState={{ result: MOCK_RESULT, projectName: 'Compass' }}>
    <div style={{ minHeight: '100vh', background: 'var(--dlg-surface, #f8f9fa)', fontFamily: 'Inter, sans-serif' }}>
      <Story />
    </div>
  </WithState>
)

export default {
  title: 'Screens/Review',
  component: Review,
  decorators: [withMockResult],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Review screen — tabbed view of extracted design tokens, components, effects, grids, and patterns.',
      },
    },
  },
}

export const Colors = { name: 'Colors tab' }

export const Mobile = {
  name: 'Mobile viewport',
  parameters: { viewport: { defaultViewport: 'mobile1' } },
}

export const NoResult = {
  name: 'Empty state (no result)',
  decorators: [
    (Story) => (
      <AppProvider>
        <div style={{ minHeight: '100vh', background: 'var(--dlg-surface, #f8f9fa)', fontFamily: 'Inter, sans-serif' }}>
          <Story />
        </div>
      </AppProvider>
    ),
  ],
}
