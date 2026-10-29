/** All visible text for the landing page. Edit here, not in components. */

export const GITHUB_URL = 'https://github.com/uwaifo18/settl'

export const COPY = {
  announcementBar: 'Arc Testnet\u202f\u2014\u202fpayments settle in under a second, and USDC is the only token you need.',

  nav: {
    features: 'Features',
    howItWorks: 'How it works',
    developers: 'Developers',
    faq: 'FAQ',
    cta: 'Open Settl',
  },

  hero: {
    h1First: 'Get paid before',
    h1Muted: 'the receipt prints.',
    sub: 'A USDC point of sale built for merchants. Type an amount, show a QR code, and your screen turns green \u2014 usually within a second.',
    ctaPrimary: 'Open Settl',
    // No demo section yet \u2014 button hidden
  },

  whyArc: [
    {
      title: 'Sub-second finality',
      body: 'Payments on Arc are final in under a second, so PAID means paid.',
    },
    {
      title: 'USDC is the gas token',
      body: 'Gas is paid in USDC, so customers never need ETH or any other token. One wallet, one balance, one tap.',
    },
    {
      title: 'Non-custodial by design',
      body: 'Funds go straight from the customer to you. Settl never holds them.',
    },
  ],

  tapOrScan: {
    label: 'Tap or scan',
    h2First: 'Two ways in,',
    h2Muted: 'one payment page.',
    body: 'Show a QR code to anyone with a camera. On Android Chrome, write the same link to an NFC tag and customers tap to open it.',
    cardCaption: 'NFC tag writing works in Chrome on Android. QR works on every phone.',
    // Honest disclosure
    caveat: 'Tapping an NFC tag opens the payment page in a browser, the same as scanning a QR. It is not a contactless card terminal.',
  },

  howItWorks: {
    label: 'How it works',
    h2First: 'From amount',
    h2Muted: 'to PAID.',
    steps: [
      { n: '1', title: 'Type an amount', body: 'Enter what to charge on the keypad.' },
      { n: '2', title: 'Show the code', body: 'Display the QR, or use an NFC tag where supported.' },
      { n: '3', title: 'Customer approves', body: 'They check the merchant and amount, then confirm in their wallet.' },
      { n: '4', title: 'See PAID', body: 'Settl reads the on\u2011chain receipt and turns your screen green. No manual refresh, no waiting.' },
    ],
  },

  features: [
    {
      label: '01 \u00b7 Charge',
      h2First: 'Type an amount.',
      h2Muted: 'Show a code.',
      body: 'The invoice lives in the link, so there are no accounts and no backend. Your phone only watches the chain.',
    },
    {
      label: '02 \u00b7 Pay',
      h2First: 'Customers see who they pay',
      h2Muted: 'before they sign.',
      // The fee estimate is shown before signing via simulateContract — confirmed in PayPage.tsx.
      body: 'The full merchant address and the amount are shown before the wallet prompt. Approvals cover only this invoice, never more.',
    },
    {
      label: '03 \u00b7 Settled',
      h2First: 'The screen turns green',
      h2Muted: 'only when it is true.',
      // Confirmed in PayPage.tsx: Paid event parse + isPaid() cross-check before success.
      body: 'Settl checks the payment on\u2011chain against your invoice before it shows PAID, even if you closed the app in between.',
    },
    {
      label: '04 \u00b7 Convert \u2014 coming soon',
      h2First: 'Turn USDC into',
      h2Muted: 'local currency.',
      body: 'Once paid, convert your USDC balance to USD, EUR, NGN, or another local currency and withdraw to your bank or mobile money wallet\u2014without touching a crypto exchange.',
    },
  ],

  faq: [
    {
      q: 'Do customers need NFC?',
      a: 'No. The QR code works on any phone with a camera. NFC tags are an extra on supported Android phones.',
    },
    {
      q: 'Who holds the money?',
      a: 'Only you. USDC moves from the customer straight to your address, and Settl never holds it.',
    },
    {
      q: 'What do customers pay in fees?',
      a: 'A small network fee, paid in USDC, so they never need a second token.',
    },
    {
      q: 'Is it safe to use?',
      a: 'Settl is early software. Its smart contract has not had a formal security audit. Keep invoices small until an audit is complete.',
    },
  ],

  cta: {
    h2: 'Take your first payment.',
    sub: 'Open it on your phone. No account, no signup \u2014 just your wallet address and you are ready.',
    button: 'Open Settl',
  },

  footer: {
    disclaimer:
      'Settl is early software on Arc. The smart contract has not been formally audited. Use small amounts.',
    github: 'GitHub',
    githubUrl: GITHUB_URL,
    x: 'X / Twitter',
    xUrl: 'https://x.com/aisuskii?s=11',
  },
}
