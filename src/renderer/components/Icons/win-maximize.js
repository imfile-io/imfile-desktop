import { registerIcons } from '@/components/Icons/iconRegistry'

registerIcons({
  'win-maximize': {
    'width': 12,
    'height': 12,
    'raw': `<polyline points="5.5 1.5 10.5 1.5 10.5 6.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <polyline points="1.5 5.5 1.5 10.5 6.5 10.5" fill="none" stroke-linecap="round" stroke-linejoin="round" />`,
    'g': {
      'stroke': '#CBCBCB',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'stroke-width': '1'
    }
  }
})
