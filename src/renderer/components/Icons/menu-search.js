import { registerIcons } from '@/components/Icons/iconRegistry'

registerIcons({
  'menu-search': {
    'width': 24,
    'height': 24,
    'raw': `<circle cx="10.5" cy="10.5" r="6" fill="none"/>
    <line x1="15.2" y1="15.2" x2="19.5" y2="19.5"/>`,
    'g': {
      'stroke': '#CBCBCB',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'stroke-width': '3'
    }
  }
})
