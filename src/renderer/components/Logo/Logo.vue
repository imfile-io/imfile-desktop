<template>
  <div class="logo">
    <a target="_blank" href="https://imfile.org/">
      <svg width="40" height="34" viewBox="0 0 40 34" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10.6337 10.9403C10.9031 9.77199 11.9433 8.94434 13.1423 8.94434C14.7977 8.94434 16.0229 10.4842 15.6509 12.0973L13.1154 23.0921C12.846 24.2604 11.8058 25.088 10.6068 25.088C8.95137 25.088 7.7262 23.5482 8.09819 21.9351L10.6337 10.9403Z" fill="#CBCBCB"/>
      <path d="M23.176 10.3584C22.7854 9.4784 21.9129 8.91113 20.9501 8.91113C19.1883 8.91113 18.0095 10.7241 18.7242 12.3344L23.728 23.6075C24.1186 24.4876 24.991 25.0548 25.9539 25.0548C27.7157 25.0548 28.8945 23.2419 28.1797 21.6316L23.176 10.3584Z" fill="url(#paint0_linear_569_4403)"/>
      <path d="M18.278 10.9962C18.5673 9.7927 19.6437 8.94434 20.8815 8.94434C22.6135 8.94434 23.8899 10.5638 23.4851 12.2479L20.8918 23.0362C20.6025 24.2396 19.526 25.088 18.2882 25.088C16.5562 25.088 15.2799 23.4685 15.6847 21.7845L18.278 10.9962Z" fill="#CBCBCB"/>
      <path d="M26.0516 10.9403C26.3211 9.77199 27.3613 8.94434 28.5602 8.94434C30.2157 8.94434 31.4408 10.4842 31.0689 12.0973L28.5334 23.0921C28.264 24.2604 27.2237 25.088 26.0248 25.088C24.3694 25.088 23.1442 23.5482 23.5162 21.9351L26.0516 10.9403Z" fill="#CBCBCB"/>
      <defs>
      <linearGradient id="paint0_linear_569_4403" x1="23.452" y1="8.91113" x2="23.452" y2="25.0548" gradientUnits="userSpaceOnUse">
      <stop offset="0.192708" stop-color="#CBCBCB"/>
      <stop offset="1" stop-color="#CBCBCB"/>
      </linearGradient>
      </defs>
      </svg>
    </a>
  </div>
</template>

<script>
export default {
  name: 'mo-logo',
  props: {
    width: {
      type: Number,
      default: 62
    },
    height: {
      type: Number,
      default: 14
    }
  }
}
</script>

<style lang="scss">
.logo {
  display: inline-block;
  margin: 0;
  padding: 0;
  > a {
    display: block;
    width: 100%;
    height: 100%;
    outline: none;
    border: none;
    text-align: center;
    font-size: 0;
    color: $--app-logo-color;
  }
  svg {
    fill: currentColor;
  }
}
</style>
