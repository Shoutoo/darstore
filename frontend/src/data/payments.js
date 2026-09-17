export const PAYMENT_GROUPS = [
  {
    id: 'qris_ewallet',
    title: 'QRIS & E-Wallet (Instan)',
    badge: 'BEST PRICE',
    minPrice: 1000,
    methods: [
      { id: 'qris_all', name: 'QRIS (All Payment)', fee: 800, image: '/assets/payments/qris_bca.png' },
      { id: 'gopay', name: 'GoPay', fee: 1000, image: '/assets/payments/qris_gopay.png' },
      { id: 'dana', name: 'DANA', fee: 1000, image: '/assets/payments/qris_dana.png' },
      { id: 'ovo', name: 'OVO', fee: 1000, image: '/assets/payments/qris_ovo.png' },
      { id: 'shopeepay', name: 'ShopeePay', fee: 1000, image: '/assets/payments/qris_shopeepay.png' },
      { id: 'linkaja', name: 'LinkAja', fee: 1000, image: '/assets/payments/qris_linkaja.png' }
    ]
  }
];
