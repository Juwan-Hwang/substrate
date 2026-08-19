import type { Meta, StoryObj } from '@storybook/react';
import { Badge, Box, Button, GlassCard, Stack, Switch } from '../components';

const meta: Meta = {
  title: 'Components',
  parameters: { layout: 'centered' },
};

export default meta;

// ── Button ──────────────────────────────────────────────────────────

export const ButtonGhost: StoryObj = {
  render: () => <Button variant="ghost">Ghost Button</Button>,
};

export const ButtonPrimary: StoryObj = {
  render: () => <Button variant="primary">Primary Button</Button>,
};

export const ButtonAccent: StoryObj = {
  render: () => <Button variant="accent">Accent Button</Button>,
};

export const ButtonDanger: StoryObj = {
  render: () => <Button variant="danger">Danger Button</Button>,
};

export const ButtonSuccess: StoryObj = {
  render: () => <Button variant="success">Success Button</Button>,
};

export const ButtonBusy: StoryObj = {
  render: () => (
    <Button variant="primary" busy>
      Busy Button
    </Button>
  ),
};

// ── GlassCard ───────────────────────────────────────────────────────

export const Card: StoryObj = {
  render: () => (
    <GlassCard className="p-6" style={{ width: 320 }}>
      <h3 className="text-lg font-semibold text-text-primary">Card Title</h3>
      <p className="mt-2 text-sm text-text-secondary">
        A glass-morphism card with backdrop blur and subtle border.
      </p>
    </GlassCard>
  ),
};

// ── Badge ───────────────────────────────────────────────────────────

export const Badges: StoryObj = {
  render: () => (
    <Stack style={{ gap: 8, alignItems: 'flex-start' }}>
      <Badge>Default</Badge>
      <Badge variant="accent">Accent</Badge>
      <Badge variant="danger">Danger</Badge>
      <Badge variant="warning">Warning</Badge>
      <Badge variant="success">Success</Badge>
    </Stack>
  ),
};

// ── Switch ──────────────────────────────────────────────────────────

export const SwitchOn: StoryObj = {
  render: () => <Switch checked onChange={() => {}} />,
};

export const SwitchOff: StoryObj = {
  render: () => <Switch checked={false} onChange={() => {}} />,
};

// ── Layout primitives ───────────────────────────────────────────────

export const StackLayout: StoryObj = {
  render: () => (
    <Stack style={{ gap: 12, padding: 24 }}>
      <Box className="substrate-glass-card p-4">Item 1</Box>
      <Box className="substrate-glass-card p-4">Item 2</Box>
      <Box className="substrate-glass-card p-4">Item 3</Box>
    </Stack>
  ),
};
