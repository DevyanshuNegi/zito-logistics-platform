export const COURIER_CAPACITY_OPTIONS = [
  {
    value: 'OWNED_FLEET',
    label: 'Owned Fleet',
    description: 'Use the courier company fleet as the primary execution source.',
  },
  {
    value: 'CFA_NETWORK',
    label: 'CFA Network',
    description: 'Run the movement through the Zito CFA network and partner operations.',
  },
  {
    value: 'BLENDED',
    label: 'Blended',
    description: 'Mix owned fleet with the Zito CFA network under one movement plan.',
  },
] as const;

export function formatCourierCapacitySource(value?: string | null) {
  switch (String(value ?? '').trim().toUpperCase()) {
    case 'OWNED_FLEET':
      return 'Owned Fleet';
    case 'BLENDED':
      return 'Blended';
    case 'CFA_NETWORK':
    default:
      return 'CFA Network';
  }
}
